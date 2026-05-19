import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { plaidClient } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase"
import { calculateSafeToSpend } from "@/lib/safe-to-spend"
import type { AccountBalance, VaultMetrics, UpcomingBill } from "@/lib/safe-to-spend"
import { fetchActiveGoals } from "@/lib/enrolled-goals"
import { aggregateVaultUploads } from "@/lib/vault-transactions"

// Categories to ignore for spending — internal money movements, not real spending
const IGNORED_SPENDING_CATEGORIES = new Set([
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "CREDIT_CARD",
  "LOAN_PAYMENTS", // counted as fixed bills separately
])

// Categories to ignore for income
// Note: we do NOT filter TRANSFER_IN — gig workers receive income via
// Venmo, PayPal, Zelle, and direct deposit which Plaid may tag as transfers
const IGNORED_INCOME_CATEGORIES = new Set([
  "TRANSFER_OUT",
  "CREDIT_CARD",
])

async function fetchUpcomingBills(userId: string, now: Date): Promise<UpcomingBill[]> {
  const { data: bills } = await getSupabase()
    .from("recurring_bills")
    .select("name, amount, due_day")
    .eq("clerk_user_id", userId)
    .eq("is_active", true)

  if (!bills || bills.length === 0) return []

  const currentDay = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  return bills
    .map((b) => {
      const dueDay = Math.min(b.due_day, daysInMonth)
      let dueDate: Date
      if (dueDay >= currentDay) {
        dueDate = new Date(now.getFullYear(), now.getMonth(), dueDay)
      } else {
        dueDate = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(b.due_day, new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()))
      }
      return { name: b.name as string, amount: b.amount as number, dueDate: dueDate.toISOString().split("T")[0] }
    })
    .filter((b) => {
      const days = Math.ceil((new Date(b.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return days >= 0 && days <= 7
    })
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch user profile with Plaid token
  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("*")
    .eq("clerk_user_id", userId)
    .single()

  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 400 })
  }

  const now = new Date()
  const upcomingBills = await fetchUpcomingBills(userId, now)

  // ── Vault-only path: no bank linked but has uploaded statements ────
  if (!profile.plaid_access_token) {
    // Aggregate every statement the user has uploaded (greedy non-overlap,
    // newest-first). This makes 3-month uploads behave like 3 months of
    // data instead of silently using only the most recent file.
    const agg = await aggregateVaultUploads(userId)
    if (!agg.totals || agg.uploads.length === 0) {
      return NextResponse.json({ error: "No bank linked and no statements uploaded" }, { status: 400 })
    }

    const vaultMetrics: VaultMetrics = agg.totals

    // Normalize the aggregated totals to a per-month rate using the full
    // canonical span. 3 stitched-together 30-day statements = ~90 days,
    // so total income / (90/30.44) ≈ ~one month's income.
    const periodDays = agg.spanDays
    const monthlyFactor = 30.44 / periodDays
    const monthlyVaultIncome = vaultMetrics.totalIncome * monthlyFactor

    // Same conservative band as the Plaid path — only trust vault income
    // when it's in the believable range vs self-reported. Savings-account
    // statements where "income" is really transfers from checking get
    // discarded because they fall way outside the band.
    const selfReportedIncome = profile.monthly_income ?? 0
    let incomeUsed: number
    if (selfReportedIncome > 0) {
      const inBand =
        monthlyVaultIncome >= selfReportedIncome * 0.8 &&
        monthlyVaultIncome <= selfReportedIncome * 2.0
      incomeUsed = inBand
        ? Math.max(selfReportedIncome, monthlyVaultIncome)
        : selfReportedIncome
    } else if (monthlyVaultIncome > 0) {
      incomeUsed = monthlyVaultIncome
    } else {
      incomeUsed = 0
    }

    const activeGoals = await fetchActiveGoals(userId)

    const safeToSpend = calculateSafeToSpend({
      monthlyIncome: incomeUsed,
      fixedBills: 0,
      goalAmount: profile.goal_amount,
      goalDeadline: profile.goal_deadline,
      goalStatus: profile.goal_status ?? "active",
      goalSaved: profile.goal_saved ?? 0,
      activeGoals,
      safetyBuffer: profile.safety_buffer ?? 0,
      spentThisMonth: 0,
      taxWithholding: profile.tax_withholding ?? false,
      accounts: [],
      vaultMetrics,
      upcomingBills,
    })

    // ── Category breakdown across ALL uploaded statements (canonical set).
    //    Mirrors the Plaid branch so the Categories tab is populated even
    //    when no bank is linked (beta path without Plaid prod). Filters out
    //    the same internal-movement categories used by STS math so the
    //    donut totals reconcile with `spentThisMonth`.
    const spendingByCategory: Record<string, number> = {}
    const transactionsByCategory: Record<
      string,
      { name: string; amount: number; date: string }[]
    > = {}
    const IGNORED_VAULT_CATS = new Set([
      "TRANSFER_IN",
      "TRANSFER_OUT",
      "TRANSFER",
      "INTERNAL_TRANSFER",
      "CREDIT_CARD",
      "LOAN_PAYMENTS",
      "INCOME",
    ])
    for (const t of agg.transactions) {
      if (t.amount <= 0) continue
      if (IGNORED_VAULT_CATS.has(t.category)) continue
      const cat = t.category || "OTHER"
      spendingByCategory[cat] = (spendingByCategory[cat] ?? 0) + t.amount
      if (!transactionsByCategory[cat]) transactionsByCategory[cat] = []
      transactionsByCategory[cat].push({
        name: t.description,
        amount: t.amount,
        date: t.isoDate,
      })
    }
    for (const cat of Object.keys(transactionsByCategory)) {
      transactionsByCategory[cat].sort((a, b) => (a.date < b.date ? 1 : -1))
    }

    return NextResponse.json({
      safeToSpend,
      income: {
        selfReported: profile.monthly_income ?? 0,
        observed: vaultMetrics.totalIncome,
        used: Math.round(incomeUsed * 100) / 100,
        usingObserved: incomeUsed > (profile.monthly_income ?? 0),
      },
      accounts: [],
      totalBalance: 0,
      spentThisMonth: Math.round(vaultMetrics.totalSpending * 100) / 100,
      fixedBills: Math.round(vaultMetrics.fixedBills * 100) / 100,
      spendingByCategory,
      transactionsByCategory,
      recentTransactions: [],
      source: "vault",
    })
  }

  // Get last 30 days of transactions
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 30)

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const transactionsResponse = await plaidClient.transactionsGet({
    access_token: profile.plaid_access_token,
    start_date: thirtyDaysAgo.toISOString().split("T")[0],
    end_date: now.toISOString().split("T")[0],
    options: { count: 500, offset: 0 },
  })

  const { accounts, transactions } = transactionsResponse.data

  // Build account balances for the liquidity calculation
  const accountBalances: AccountBalance[] = accounts.map((a) => ({
    type: a.type as AccountBalance["type"],
    subtype: a.subtype,
    currentBalance: a.balances.current ?? 0,
    availableBalance: a.balances.available ?? null,
  }))

  // Only count transactions from spending accounts (checking + credit cards)
  const spendingAccountIds = new Set(
    accounts
      .filter((a) => a.type === "depository" || a.type === "credit")
      .map((a) => a.account_id)
  )

  // Filter to this month + spending accounts only
  const thisMonthTransactions = transactions.filter((t) => {
    const tDate = new Date(t.date)
    return (
      tDate >= startOfMonth &&
      tDate <= now &&
      spendingAccountIds.has(t.account_id)
    )
  })

  // Filter out transfers and credit card payments to avoid double-counting
  const realSpending = thisMonthTransactions.filter((t) => {
    const primary = t.personal_finance_category?.primary ?? ""
    return t.amount > 0 && !IGNORED_SPENDING_CATEGORIES.has(primary)
  })

  const totalSpent = realSpending.reduce((sum, t) => sum + t.amount, 0)

  // Calculate observed income from deposits (negative amounts in Plaid = money in)
  // Use all 30 days of transactions, not just this month
  const depositAccountIds = new Set(
    accounts.filter((a) => a.type === "depository").map((a) => a.account_id)
  )
  const observedMonthlyIncome = transactions
    .filter((t) => {
      const primary = t.personal_finance_category?.primary ?? ""
      return (
        t.amount < 0 && // Plaid: negative = credit/deposit
        depositAccountIds.has(t.account_id) &&
        !IGNORED_INCOME_CATEGORIES.has(primary)
      )
    })
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  // Income selection — be conservative. The old `totalSpent * 1.5` floor
  // wildly overstated STS when a user had a one-off big spending month
  // (or in Plaid sandbox where the test user has erratic patterns). New rule:
  //   - Trust self-reported by default.
  //   - Only "upgrade" to observed if observed is within a believable band
  //     around self-reported (between 80% and 200% of it). This treats
  //     observed as a confirmation signal, not a free upgrade.
  //   - Fall back to observed-only if there's no self-reported number.
  //   - Cap the floor at 1.2× spending (not 1.5×) and only when both
  //     self-reported and observed are missing — i.e., sandbox safety net.
  const selfReportedIncome = profile.monthly_income ?? 0
  let incomeUsed: number
  if (selfReportedIncome > 0) {
    const observedInBand =
      observedMonthlyIncome >= selfReportedIncome * 0.8 &&
      observedMonthlyIncome <= selfReportedIncome * 2.0
    incomeUsed = observedInBand
      ? Math.max(selfReportedIncome, observedMonthlyIncome)
      : selfReportedIncome
  } else if (observedMonthlyIncome > 0) {
    incomeUsed = observedMonthlyIncome
  } else {
    // No real signal at all — last-resort floor for the dashboard to show
    // something other than $0. Capped low so it doesn't lie too hard.
    incomeUsed = Math.min(totalSpent * 1.2, 2000)
  }
  const usingObservedIncome = incomeUsed > selfReportedIncome && observedMonthlyIncome >= selfReportedIncome * 0.8

  // Identify likely fixed bills (rent, utilities, insurance, loans)
  const fixedBills = realSpending
    .filter(
      (t) =>
        t.personal_finance_category?.primary === "RENT_AND_UTILITIES" ||
        t.category?.includes("Rent") ||
        t.category?.includes("Utilities") ||
        t.category?.includes("Insurance")
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Manual chatbot-reported spending — currently inserted into
  // manual_transactions but ignored by STS math, so users can "spend $50"
  // in chat and the dashboard never sees it. Roll the current-month entries
  // into discretionary so the daily limit reflects them too.
  const startOfMonthIso = startOfMonth.toISOString()
  const { data: manualRows } = await getSupabase()
    .from("manual_transactions")
    .select("amount")
    .eq("clerk_user_id", userId)
    .gte("occurred_at", startOfMonthIso)
  const manualSpentThisMonth = (manualRows ?? []).reduce(
    (s, r) => s + Number(r.amount ?? 0),
    0
  )

  // Discretionary spending = (total - fixed) + manual claims. Plaid won't
  // see manual entries, so we add them on top without subtracting fixed.
  const discretionarySpent = totalSpent - fixedBills + manualSpentThisMonth

  // Total balance across all accounts (for overview display)
  const totalBalance = accounts.reduce(
    (sum, a) => sum + (a.balances.current ?? 0),
    0
  )

  // Aggregate ALL vault uploads (canonical non-overlapping set) so the
  // STS math can use the user's full statement history as a reality
  // check against Plaid — not just whichever PDF they uploaded last.
  let vaultMetrics: VaultMetrics | null = null
  const vaultAgg = await aggregateVaultUploads(userId)
  if (vaultAgg.totals) {
    vaultMetrics = vaultAgg.totals
  }

  // Calculate Safe-to-Spend with account data for liquidity
  // Pass discretionary spending so fixed bills aren't subtracted twice
  const activeGoalsForBank = await fetchActiveGoals(userId)
  const safeToSpend = calculateSafeToSpend({
    monthlyIncome: incomeUsed,
    fixedBills,
    goalAmount: profile.goal_amount,
    goalDeadline: profile.goal_deadline,
    goalStatus: profile.goal_status ?? "active",
    goalSaved: profile.goal_saved ?? 0,
    activeGoals: activeGoalsForBank,
    safetyBuffer: profile.safety_buffer ?? 0,
    spentThisMonth: discretionarySpent,
    taxWithholding: profile.tax_withholding ?? false,
    accounts: accountBalances,
    vaultMetrics,
    upcomingBills,
  })

  // Categorize spending (excluding transfers). CRITICAL: the per-category
  // transactions list MUST be derived from the same `realSpending` array
  // that feeds spendingByCategory — otherwise the summary number and the
  // expanded transactions disagree (the old code built `recentTransactions`
  // from the unfiltered 30-day window which included transfers, deposits,
  // and out-of-month rows).
  const spendingByCategory: Record<string, number> = {}
  const transactionsByCategory: Record<
    string,
    { name: string; amount: number; date: string }[]
  > = {}
  for (const t of realSpending) {
    const cat =
      t.personal_finance_category?.primary ??
      t.category?.[0] ??
      "Other"
    spendingByCategory[cat] = (spendingByCategory[cat] ?? 0) + t.amount
    if (!transactionsByCategory[cat]) transactionsByCategory[cat] = []
    transactionsByCategory[cat].push({
      name: t.name,
      amount: t.amount,
      date: t.date,
    })
  }
  // Sort each category's transactions by date descending so the "last N"
  // slice the client takes are actually the most-recent.
  for (const cat of Object.keys(transactionsByCategory)) {
    transactionsByCategory[cat].sort((a, b) => (a.date < b.date ? 1 : -1))
  }

  return NextResponse.json({
    safeToSpend,
    income: {
      selfReported: selfReportedIncome,
      observed: Math.round(observedMonthlyIncome * 100) / 100,
      used: Math.round(incomeUsed * 100) / 100,
      usingObserved: usingObservedIncome,
    },
    // Dev visibility — every input that fed calculateSafeToSpend so you can
    // see why the daily number is what it is. Strip from prod if you'd
    // rather not expose it.
    debug: {
      monthlyIncomeUsed: Math.round(incomeUsed * 100) / 100,
      fixedBills: Math.round(fixedBills * 100) / 100,
      plaidSpentThisMonth: Math.round(totalSpent * 100) / 100,
      manualSpentThisMonth: Math.round(manualSpentThisMonth * 100) / 100,
      discretionarySpentFedToMath: Math.round(discretionarySpent * 100) / 100,
      safetyBuffer: profile.safety_buffer ?? 0,
      taxWithholding: profile.tax_withholding ?? false,
      activeGoalsCount: activeGoalsForBank.length,
      activeGoals: activeGoalsForBank.map((g) => ({
        id: g.id,
        description: g.description,
        amount: g.amount,
        saved: g.saved,
        deadline: g.deadline,
      })),
      goalBitesByGoal: safeToSpend.goalBitesByGoal,
      totalMonthlyGoalBite: safeToSpend.totalMonthlyGoalBite,
      escrowTotal: safeToSpend.escrowTotal,
      weightedEscrowBite: safeToSpend.weightedEscrowBite,
      vaultMetrics,
      daysRemaining: safeToSpend.daysRemaining,
    },
    accounts: accounts.map((a) => ({
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      balance: a.balances.current,
      available: a.balances.available,
    })),
    totalBalance,
    spentThisMonth: Math.round(totalSpent * 100) / 100,
    fixedBills: Math.round(fixedBills * 100) / 100,
    spendingByCategory,
    transactionsByCategory,
    // Kept for back-compat with anything else that reads it, but
    // CategoriesTab now consumes transactionsByCategory above.
    recentTransactions: transactions
      .filter((t) => spendingAccountIds.has(t.account_id))
      .slice(0, 10)
      .map((t) => ({
        name: t.name,
        amount: t.amount,
        date: t.date,
        category: t.personal_finance_category?.primary ?? t.category?.[0],
      })),
  })
}
