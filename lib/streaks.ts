import { getSupabase } from "@/lib/supabase"
import { plaidClient } from "@/lib/plaid"
import { calculateSafeToSpend, type EnrolledGoal } from "@/lib/safe-to-spend"
import { fetchActiveGoals } from "@/lib/enrolled-goals"
import { fetchLatestVaultTransactions } from "@/lib/vault-transactions"

/**
 * Budget-Streak engine.
 *
 * StreakCondition: ∀ d ∈ {1..n}, Spent_d ≤ DailySTS_d
 *
 * Walks backwards from yesterday checking each day's discretionary
 * spending (Plaid + manual_transactions) against the day's daily STS
 * limit. Counts consecutive days that satisfy the condition. Stops on
 * the first day that fails.
 *
 * We separately compute whether today is already over budget so the UI
 * can show a "cooling down" visual without breaking the historical
 * streak number.
 *
 * Per-day STS limit:
 *   The "true" historical STS would require time-travelling the user's
 *   profile (goals, buffer, income at that moment). For Beta we use a
 *   stable approximation: today's monthly_available divided by days_in_
 *   that_month. Same approach used by the daily-nudge cron.
 */

const IGNORED_SPENDING = new Set(["TRANSFER_IN", "TRANSFER_OUT", "CREDIT_CARD", "LOAN_PAYMENTS"])

export type StreakResult = {
  streak: number
  longest: number
  brokenToday: boolean
  todaySpent: number
  todayLimit: number
  lastVerifiedDate: string | null
  daysChecked: number
  source: "plaid" | "vault" | "manual_only" | "none"
}

type SpendingDay = {
  date: string // YYYY-MM-DD
  spent: number
}

function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

export async function computeBudgetStreak(userId: string): Promise<StreakResult> {
  const supabase = getSupabase()
  const now = new Date()
  const lookbackDays = 60 // cap the walk so we don't scan forever

  // ── 1. Pull the user's profile + enrolled goals so we can compute the
  //       daily limit per month seen in the window.
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("monthly_income, safety_buffer, tax_withholding, plaid_access_token, bank_linked, longest_streak, created_at")
    .eq("clerk_user_id", userId)
    .maybeSingle()

  if (!profile) {
    return emptyResult()
  }

  const activeGoals = (await fetchActiveGoals(userId)) as EnrolledGoal[]

  // Helper: compute the day's STS limit using the current profile shape.
  // We accept this is a simplification — historical income/goal state at
  // the time of each day isn't tracked, so we use "today's monthly setup
  // applied uniformly across the day's month."
  const dailyLimitForDate = (d: Date): number => {
    const sts = calculateSafeToSpend({
      monthlyIncome: profile.monthly_income ?? 0,
      fixedBills: 0,
      goalAmount: null,
      goalDeadline: null,
      activeGoals,
      safetyBuffer: profile.safety_buffer ?? 0,
      spentThisMonth: 0,
      taxWithholding: profile.tax_withholding ?? false,
      _now: d,
    })
    return sts.monthlyAvailable / daysInMonth(d)
  }

  // ── 2. Gather per-day spending from Plaid (if linked) + manual_transactions
  const startWindow = new Date(now)
  startWindow.setDate(now.getDate() - lookbackDays)

  const perDay = new Map<string, number>()
  let plaidSourced = false
  let vaultSourced = false

  if (profile.bank_linked && profile.plaid_access_token) {
    try {
      const res = await plaidClient.transactionsGet({
        access_token: profile.plaid_access_token as string,
        start_date: startWindow.toISOString().split("T")[0],
        end_date: now.toISOString().split("T")[0],
        options: { count: 500, offset: 0 },
      })
      const accounts = res.data.accounts
      const spendingIds = new Set(
        accounts
          .filter((a) => a.type === "depository" || a.type === "credit")
          .map((a) => a.account_id)
      )
      for (const t of res.data.transactions) {
        if (!spendingIds.has(t.account_id)) continue
        const cat = t.personal_finance_category?.primary ?? ""
        if (IGNORED_SPENDING.has(cat)) continue
        if (t.amount <= 0) continue // ignore deposits/refunds
        const k = t.date // already YYYY-MM-DD
        perDay.set(k, (perDay.get(k) ?? 0) + t.amount)
      }
      plaidSourced = true
    } catch {
      // Fall through to manual-only
    }
  }

  // ── Vault fallback. When Plaid isn't linked (beta path) we lean on the
  //    most recent uploaded statement so the streak isn't permanently zero.
  //    The parser already filters out deposits via positive `amount` and
  //    we apply the same IGNORED_SPENDING category set so transfers don't
  //    inflate the daily total.
  if (!plaidSourced) {
    const vaultTx = await fetchLatestVaultTransactions(userId)
    for (const t of vaultTx) {
      if (t.amount <= 0) continue
      if (IGNORED_SPENDING.has(t.category)) continue
      // Window: only include rows inside the lookback range so old multi-
      // month statements don't run the walk back to the dawn of time.
      const d = new Date(t.isoDate + "T00:00:00")
      if (d < startWindow || d > now) continue
      perDay.set(t.isoDate, (perDay.get(t.isoDate) ?? 0) + t.amount)
    }
    vaultSourced = vaultTx.length > 0
  }

  // Manual transactions in the same window
  const { data: manual } = await supabase
    .from("manual_transactions")
    .select("amount, occurred_at")
    .eq("clerk_user_id", userId)
    .gte("occurred_at", startWindow.toISOString())

  for (const m of manual ?? []) {
    const k = dayKey(new Date(m.occurred_at as string))
    perDay.set(k, (perDay.get(k) ?? 0) + Number(m.amount ?? 0))
  }

  // If we have no signal at all, return an empty streak.
  if (perDay.size === 0 && !plaidSourced && !vaultSourced) {
    return emptyResult({
      todayLimit: dailyLimitForDate(now),
      longest: profile.longest_streak ?? 0,
      source: "none",
    })
  }

  // ── 3. Today's status
  const todayKey = dayKey(now)
  const todaySpent = perDay.get(todayKey) ?? 0
  const todayLimit = dailyLimitForDate(now)
  const brokenToday = todayLimit > 0 && todaySpent > todayLimit

  // ── 4. Cap the walk by account age. The anchor priority:
  //       1. user_profiles.created_at is the HARD ceiling — the user
  //          literally couldn't have had a streak before signing up.
  //          Plaid sandbox returns transactions up to 2 years old, so
  //          using the earliest tx date here would falsely inflate the
  //          streak count.
  //       2. Fall back to earliest transaction date only when there's
  //          no account creation timestamp on the profile.
  //       3. If neither exists, cap = 0 → empty streak.
  const txDates = Array.from(perDay.keys()).sort()
  const earliestTxIso = txDates[0] // YYYY-MM-DD or undefined
  const accountCreatedAt = profile.created_at ? new Date(profile.created_at as string) : null

  let earliestAnchor: Date | null = null
  if (accountCreatedAt) {
    earliestAnchor = accountCreatedAt
  } else if (earliestTxIso) {
    earliestAnchor = new Date(earliestTxIso + "T00:00:00")
  }

  const daysSinceFirstActivity = earliestAnchor
    ? Math.max(0, Math.floor((now.getTime() - earliestAnchor.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const effectiveLookback = Math.min(lookbackDays, daysSinceFirstActivity)

  // ── 5. Walk backwards from yesterday counting consecutive days where
  //       Spent_d <= DailySTS_d.
  const days: SpendingDay[] = []
  for (let i = 1; i <= effectiveLookback; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const k = dayKey(d)
    days.push({ date: k, spent: perDay.get(k) ?? 0 })
  }

  let streak = 0
  let lastVerifiedDate: string | null = null
  for (const d of days) {
    const limit = dailyLimitForDate(new Date(d.date + "T12:00:00"))
    if (limit <= 0) break // no budget defined → can't credit a streak day
    if (d.spent <= limit) {
      streak++
      lastVerifiedDate = d.date
    } else {
      break
    }
  }

  return {
    streak,
    longest: Math.max(profile.longest_streak ?? 0, streak),
    brokenToday,
    todaySpent: Math.round(todaySpent * 100) / 100,
    todayLimit: Math.round(todayLimit * 100) / 100,
    lastVerifiedDate,
    daysChecked: days.length,
    source: plaidSourced ? "plaid" : vaultSourced ? "vault" : "manual_only",
  }
}

function emptyResult(overrides: Partial<StreakResult> = {}): StreakResult {
  return {
    streak: 0,
    longest: 0,
    brokenToday: false,
    todaySpent: 0,
    todayLimit: 0,
    lastVerifiedDate: null,
    daysChecked: 0,
    source: "none",
    ...overrides,
  }
}
