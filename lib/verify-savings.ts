import { plaidClient } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase"

/**
 * Plaid-based savings verification.
 *
 * Level 1 (transfer_match):
 *   Scan Plaid transactions for a TRANSFER_OUT from a depository.checking
 *   account that matches a TRANSFER_IN credit to a depository.savings
 *   (or investment) account within a 72-hour window of the claim.
 *
 * Level 2 (balance_growth):
 *   If no transfer is found, compare current total liquid balance to the
 *   snapshot taken at the user's previous claim. If the balance grew by at
 *   least 90% of the claimed amount, mark it 'probable'.
 *
 * Returns 'pending' when neither check passes but we want to give it more
 * time (banks lag 24-48h). The cron route /api/cron/verify-savings
 * re-runs verification for stale pending rows and flips them to
 * 'unverified' after 48 hours.
 */

export type VerifySavingsResult = {
  status: "verified" | "probable" | "pending" | "unverified"
  method: "transfer_match" | "balance_growth" | null
  observedGrowth: number | null
  balanceSnapshot: number | null
  matchedTransferId: string | null
  message: string
}

const TRANSFER_WINDOW_MS = 72 * 60 * 60 * 1000 // 72 hours
const GROWTH_TOLERANCE = 0.9 // 90% of claim must show up as net balance growth
const PENDING_GRACE_MS = 48 * 60 * 60 * 1000 // 48h before flipping pending → unverified

const NON_SPENDING_SUBTYPES = new Set([
  "savings",
  "money market",
  "cd",
  "hsa",
  "ira",
  "401k",
  "401a",
  "brokerage",
  "non-taxable brokerage account",
  "mutual fund",
])

type PlaidAccount = {
  account_id: string
  type: string
  subtype: string | null
  balances: { available: number | null; current: number | null }
}

type PlaidTxn = {
  transaction_id: string
  account_id: string
  amount: number
  date: string
  name?: string | null
  personal_finance_category?: { primary?: string | null; detailed?: string | null } | null
}

/**
 * Sum of available balances across depository accounts. This is the user's
 * total liquid cash and what we compare against snapshots.
 */
function totalLiquidBalance(accounts: PlaidAccount[]): number {
  return accounts
    .filter((a) => a.type === "depository")
    .reduce((sum, a) => sum + (a.balances.available ?? a.balances.current ?? 0), 0)
}

/**
 * Try to find a transfer that explains the claim.
 *   - outbound: TRANSFER_OUT from a checking subtype within window
 *   - inbound:  matching positive arrival in a non-spending account
 * Returns the inbound transaction id when found, null otherwise.
 */
function findMatchingTransfer(
  txns: PlaidTxn[],
  accounts: PlaidAccount[],
  claimedAmount: number,
  claimedAt: Date
): string | null {
  const claimMs = claimedAt.getTime()
  const inWindow = (date: string) => Math.abs(claimMs - new Date(date).getTime()) <= TRANSFER_WINDOW_MS

  const accountById = new Map(accounts.map((a) => [a.account_id, a]))
  const isCheckingId = (id: string) => {
    const a = accountById.get(id)
    return a?.type === "depository" && (a.subtype === "checking" || a.subtype == null)
  }
  const isSavingsId = (id: string) => {
    const a = accountById.get(id)
    if (!a) return false
    const sub = (a.subtype ?? "").toLowerCase()
    return a.type === "investment" || NON_SPENDING_SUBTYPES.has(sub)
  }

  // Plaid convention: positive amount = debit (money out), negative = credit
  // (money in). So a transfer-out is amount > 0, transfer-in is amount < 0.
  const outbound = txns.filter(
    (t) =>
      t.amount > 0 &&
      inWindow(t.date) &&
      isCheckingId(t.account_id) &&
      (t.personal_finance_category?.primary === "TRANSFER_OUT" ||
        /transfer|xfer|to\s+savings|to\s+investment/i.test(t.name ?? ""))
  )
  const inbound = txns.filter(
    (t) =>
      t.amount < 0 &&
      inWindow(t.date) &&
      isSavingsId(t.account_id) &&
      (t.personal_finance_category?.primary === "TRANSFER_IN" ||
        /transfer|xfer|from\s+checking/i.test(t.name ?? ""))
  )

  // Match by absolute value within $1 tolerance. Plaid sometimes lags by a
  // day between the two sides — pair the first plausible inbound to any
  // outbound of the same magnitude.
  for (const out of outbound) {
    for (const inn of inbound) {
      if (Math.abs(out.amount - Math.abs(inn.amount)) <= 1) {
        // and at least 90% of claim
        if (Math.abs(inn.amount) >= claimedAmount * GROWTH_TOLERANCE) {
          return inn.transaction_id
        }
      }
    }
  }

  // Looser fallback — any single inbound to a savings account of the right
  // magnitude, no matched outbound. Banks sometimes show only the deposit
  // side for instant transfers.
  for (const inn of inbound) {
    if (Math.abs(inn.amount) >= claimedAmount * GROWTH_TOLERANCE) {
      return inn.transaction_id
    }
  }

  return null
}

/**
 * Run verification against Plaid for a specific contribution.
 *
 * If the user has no Plaid link, returns { status: 'pending' } — the cron
 * re-runs verification later, and after the grace period flips to
 * 'unverified' so the user knows Karma won't be awarded.
 */
export async function verifySavingsClaim(params: {
  userId: string
  contributionId: string
  claimedAmount: number
  claimedAt: Date
  previousBalanceSnapshot: number | null
}): Promise<VerifySavingsResult> {
  const { userId, claimedAmount, claimedAt, previousBalanceSnapshot } = params

  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("plaid_access_token, bank_linked")
    .eq("clerk_user_id", userId)
    .maybeSingle()

  if (!profile?.bank_linked || !profile.plaid_access_token) {
    return {
      status: "pending",
      method: null,
      observedGrowth: null,
      balanceSnapshot: null,
      matchedTransferId: null,
      message: "No bank linked — Karma can't be awarded without Plaid verification.",
    }
  }

  // Pull a window wide enough to catch the transfer and let us compute the
  // current total balance.
  const start = new Date(claimedAt.getTime() - TRANSFER_WINDOW_MS - 24 * 60 * 60 * 1000)
  const end = new Date()

  let txns: PlaidTxn[] = []
  let accounts: PlaidAccount[] = []
  try {
    const res = await plaidClient.transactionsGet({
      access_token: profile.plaid_access_token as string,
      start_date: start.toISOString().split("T")[0],
      end_date: end.toISOString().split("T")[0],
      options: { count: 500, offset: 0 },
    })
    txns = res.data.transactions as unknown as PlaidTxn[]
    accounts = res.data.accounts as unknown as PlaidAccount[]
  } catch (e) {
    console.warn("verifySavingsClaim: Plaid fetch failed", e)
    return {
      status: "pending",
      method: null,
      observedGrowth: null,
      balanceSnapshot: null,
      matchedTransferId: null,
      message: "Couldn't reach the bank yet — I'll retry within 48 hours.",
    }
  }

  const currentBalance = totalLiquidBalance(accounts)

  // ── Level 1: transfer match ────────────────────────────────────────
  const transferId = findMatchingTransfer(txns, accounts, claimedAmount, claimedAt)
  if (transferId) {
    return {
      status: "verified",
      method: "transfer_match",
      observedGrowth: previousBalanceSnapshot != null ? currentBalance - previousBalanceSnapshot : null,
      balanceSnapshot: currentBalance,
      matchedTransferId: transferId,
      message: "Bank confirmed! That's a verified save toward your goal. Streak stays hot! 🔥",
    }
  }

  // ── Level 2: balance growth fallback ───────────────────────────────
  if (previousBalanceSnapshot != null) {
    const growth = currentBalance - previousBalanceSnapshot
    if (growth >= claimedAmount * GROWTH_TOLERANCE) {
      return {
        status: "probable",
        method: "balance_growth",
        observedGrowth: Math.round(growth * 100) / 100,
        balanceSnapshot: currentBalance,
        matchedTransferId: null,
        message:
          "Looks plausible based on balance growth — I'll upgrade this to fully verified once the transfer actually settles.",
      }
    }
  }

  // Within the grace window we keep it pending so the cron can retry.
  const ageMs = Date.now() - claimedAt.getTime()
  if (ageMs <= PENDING_GRACE_MS) {
    return {
      status: "pending",
      method: null,
      observedGrowth: previousBalanceSnapshot != null ? currentBalance - previousBalanceSnapshot : null,
      balanceSnapshot: currentBalance,
      matchedTransferId: null,
      message:
        "Claim logged! I'll keep an eye on your bank balance over the next 48 hours to verify the move and lock in your points.",
    }
  }

  return {
    status: "unverified",
    method: null,
    observedGrowth: previousBalanceSnapshot != null ? currentBalance - previousBalanceSnapshot : null,
    balanceSnapshot: currentBalance,
    matchedTransferId: null,
    message:
      "Hey, I didn't see that hold steady in your accounts. We'll keep the goal progress, but I can't award Karma points for this one until the bank confirms it.",
  }
}

export const VERIFY_SAVINGS_CONSTANTS = {
  TRANSFER_WINDOW_MS,
  PENDING_GRACE_MS,
  GROWTH_TOLERANCE,
}
