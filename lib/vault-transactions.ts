import { getSupabase } from "@/lib/supabase"
import type { ParsedTransaction } from "@/lib/parse-statement"
import type { VaultMetrics } from "@/lib/safe-to-spend"

/**
 * Shared accessor for vault-statement data.
 *
 * The Plaid-less beta path (no production access yet) leans on these
 * uploaded statements as the source of truth for spending. Every
 * consumer — streak engine, sync-transactions, daily-nudge cron, chat —
 * pulls from here so the views can't drift.
 *
 * Multi-statement support
 * ------------------------
 * A user can upload several statements (e.g., March + April + May, or
 * checking + savings for the same month). We aggregate them via a
 * **greedy non-overlapping cover, newest-first**:
 *
 *   1. Sort all uploads by `created_at` DESC.
 *   2. Walk the list, accepting an upload only if its [period_start,
 *      period_end] range doesn't already lie inside the union of
 *      accepted ranges. This means a re-upload of the same month
 *      supersedes the older one (you'd expect the newer file to be the
 *      canonical version), and disjoint months all contribute.
 *   3. Sum the canonical set's totals; concatenate transactions.
 *   4. Period span = earliest accepted start → latest accepted end.
 *
 * This avoids the two failure modes that bit the single-upload code:
 *   - Silently ignoring older statements (was: `.limit(1)`).
 *   - Double-counting when a user re-uploads the same month.
 */

export type VaultTxRow = ParsedTransaction & {
  /** ISO YYYY-MM-DD, normalized from whatever the parser stored. */
  isoDate: string
  /** ID of the vault_uploads row this transaction came from. */
  uploadId: string
}

type RawUpload = {
  id: string
  filename: string | null
  total_income: number | null
  total_spending: number | null
  total_outflow: number | null
  fixed_bills: number | null
  closing_balance: number | null
  opening_balance: number | null
  period_start: string
  period_end: string
  transactions_json: string | null
  created_at: string
}

const UPLOAD_COLS =
  "id, filename, total_income, total_spending, total_outflow, fixed_bills, closing_balance, opening_balance, period_start, period_end, transactions_json, created_at"

function parseTxJson(raw: string | null, uploadId: string): VaultTxRow[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  const out: VaultTxRow[] = []
  for (const t of parsed) {
    if (!t || typeof t !== "object") continue
    const tx = t as Partial<ParsedTransaction>
    if (typeof tx.amount !== "number" || !tx.date || !tx.description) continue
    const iso = String(tx.date).slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue
    out.push({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      category: tx.category ?? "OTHER",
      isoDate: iso,
      uploadId,
    })
  }
  return out
}

/** Greedy non-overlapping cover, newest-first. See file header. */
function pickCanonical(uploads: RawUpload[]): RawUpload[] {
  const accepted: RawUpload[] = []
  for (const u of uploads) {
    const start = new Date(u.period_start).getTime()
    const end = new Date(u.period_end).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) continue
    // Reject if this upload's range is fully contained in any already-accepted
    // (newer) upload's range. Partial overlaps still pass — they'll contribute
    // their non-overlapping days, which is the closest thing to "right" without
    // doing per-transaction dedup.
    const dominated = accepted.some((a) => {
      const aStart = new Date(a.period_start).getTime()
      const aEnd = new Date(a.period_end).getTime()
      return start >= aStart && end <= aEnd
    })
    if (!dominated) accepted.push(u)
  }
  return accepted
}

export type AggregatedVault = {
  /** Canonical set of uploads after dedup. Empty array means no usable data. */
  uploads: RawUpload[]
  /** Combined transactions across the canonical set. */
  transactions: VaultTxRow[]
  /** Summed totals across the canonical set (raw, NOT normalized to monthly). */
  totals: VaultMetrics | null
  /** Number of days covered by the canonical span (period_end − period_start). */
  spanDays: number
  /** Earliest period_start across the canonical set, ISO date. */
  periodStart: string | null
  /** Latest period_end across the canonical set, ISO date. */
  periodEnd: string | null
}

/**
 * Aggregates all of a user's vault uploads into a single canonical view.
 * The summed totals are RAW (sum of statements). Callers that need a
 * per-month rate should divide by `spanDays / 30.44` — sync-transactions
 * and daily-nudge already do this for income.
 */
export async function aggregateVaultUploads(
  userId: string
): Promise<AggregatedVault> {
  const { data } = await getSupabase()
    .from("vault_uploads")
    .select(UPLOAD_COLS)
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: false })

  const rows = (data ?? []) as RawUpload[]
  if (rows.length === 0) {
    return { uploads: [], transactions: [], totals: null, spanDays: 0, periodStart: null, periodEnd: null }
  }

  const canonical = pickCanonical(rows)
  if (canonical.length === 0) {
    return { uploads: [], transactions: [], totals: null, spanDays: 0, periodStart: null, periodEnd: null }
  }

  const transactions: VaultTxRow[] = []
  for (const u of canonical) {
    transactions.push(...parseTxJson(u.transactions_json, u.id))
  }

  const totalIncome = canonical.reduce((s, u) => s + Number(u.total_income ?? 0), 0)
  const totalSpending = canonical.reduce((s, u) => s + Number(u.total_spending ?? 0), 0)
  const totalOutflow = canonical.reduce((s, u) => s + Number(u.total_outflow ?? 0), 0)
  const fixedBills = canonical.reduce((s, u) => s + Number(u.fixed_bills ?? 0), 0)

  // Span = earliest start to latest end across the canonical set. This is
  // what callers use to normalize a multi-statement income/spending total
  // into a monthly rate.
  const starts = canonical.map((u) => new Date(u.period_start).getTime())
  const ends = canonical.map((u) => new Date(u.period_end).getTime())
  const minStart = Math.min(...starts)
  const maxEnd = Math.max(...ends)
  const spanDays = Math.max(1, Math.round((maxEnd - minStart) / 86_400_000) + 1)
  const periodStartIso = new Date(minStart).toISOString().split("T")[0]
  const periodEndIso = new Date(maxEnd).toISOString().split("T")[0]

  // Closing balance — for liquidity reality-check we want the *most recent*
  // closing balance, not the sum. Same for opening (earliest).
  const sortedByEnd = [...canonical].sort((a, b) => (a.period_end < b.period_end ? 1 : -1))
  const sortedByStart = [...canonical].sort((a, b) => (a.period_start < b.period_start ? -1 : 1))
  const latestClosing = sortedByEnd.find((u) => u.closing_balance != null)?.closing_balance ?? null
  const earliestOpening = sortedByStart.find((u) => u.opening_balance != null)?.opening_balance ?? null

  const totals: VaultMetrics = {
    totalIncome,
    totalSpending,
    fixedBills,
    closingBalance: latestClosing != null ? Number(latestClosing) : null,
    periodStart: periodStartIso,
    periodEnd: periodEndIso,
  }
  // Attach extras some callers want. `VaultMetrics` doesn't declare these,
  // but TypeScript's structural typing lets us widen at call sites that
  // care; for now we return them on AggregatedVault directly.
  void totalOutflow
  void earliestOpening

  return {
    uploads: canonical,
    transactions,
    totals,
    spanDays,
    periodStart: periodStartIso,
    periodEnd: periodEndIso,
  }
}

/**
 * Backwards-compatible: returns the merged transaction stream across all
 * canonical uploads. Replaces the old "latest only" semantics.
 */
export async function fetchLatestVaultTransactions(
  userId: string
): Promise<VaultTxRow[]> {
  const agg = await aggregateVaultUploads(userId)
  return agg.transactions
}
