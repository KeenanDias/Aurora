import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { plaidClient } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase"
import { calculateSafeToSpend } from "@/lib/safe-to-spend"
import type { AccountBalance, VaultMetrics } from "@/lib/safe-to-spend"

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

  // ── Vault-only path: no bank linked but has uploaded statements ────
  if (!profile.plaid_access_token) {
    const { data: latestVault } = await getSupabase()
      .from("vault_uploads")
      .select("total_income, total_spending, fixed_bills, closing_balance, period_start, period_end")
      .eq("clerk_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (!latestVault) {
      return NextResponse.json({ error: "No bank linked and no statements uploaded" }, { status: 400 })
    }

    const vaultMetrics: VaultMetrics = {
      totalIncome: latestVault.total_income,
      totalSpending: latestVault.total_spending,
      fixedBills: latestVault.fixed_bills,
      closingBalance: latestVault.closing_balance ?? null,
      periodStart: latestVault.period_start,
      periodEnd: latestVault.period_end,
    }

    const incomeUsed = Math.max(profile.monthly_income ?? 0, vaultMetrics.totalIncome)

    const safeToSpend = calculateSafeToSpend({
      monthlyIncome: incomeUsed,
      fixedBills: 0,
      goalAmount: profile.goal_amount,
      goalDeadline: profile.goal_deadline,
      safetyBuffer: profile.safety_buffer ?? 0,
      spentThisMonth: 0,
      taxWithholding: profile.tax_withholding ?? false,
      accounts: [],
      vaultMetrics,
    })

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
      spendingByCategory: {},
      recentTransactions: [],
      source: "vault",
    })
  }

  // Get last 30 days of transactions
  const now = new Date()
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

  // Smart income selection: use whichever is higher
  // Also floor at total spending — if someone spent $7k, they clearly earn at least that
  const selfReportedIncome = profile.monthly_income ?? 0
  // Floor at 1.5x spending — if someone spent $7k, they likely earn ~$10k+
  // This prevents $0/day when income signals are weak (sandbox, new accounts)
  const incomeUsed = Math.max(selfReportedIncome, observedMonthlyIncome, totalSpent * 1.5)
  const usingObservedIncome = incomeUsed > selfReportedIncome * 1.2 && incomeUsed !== selfReportedIncome

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

  // Discretionary spending = total minus fixed bills (avoid double-counting)
  const discretionarySpent = totalSpent - fixedBills

  // Total balance across all accounts (for overview display)
  const totalBalance = accounts.reduce(
    (sum, a) => sum + (a.balances.current ?? 0),
    0
  )

  // Fetch latest vault upload for this user (if any) to merge manual statement data
  let vaultMetrics: VaultMetrics | null = null
  const { data: latestVault } = await getSupabase()
    .from("vault_uploads")
    .select("total_income, total_spending, fixed_bills, closing_balance, period_start, period_end")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (latestVault) {
    vaultMetrics = {
      totalIncome: latestVault.total_income,
      totalSpending: latestVault.total_spending,
      fixedBills: latestVault.fixed_bills,
      closingBalance: latestVault.closing_balance ?? null,
      periodStart: latestVault.period_start,
      periodEnd: latestVault.period_end,
    }
  }

  // Calculate Safe-to-Spend with account data for liquidity
  // Pass discretionary spending so fixed bills aren't subtracted twice
  const safeToSpend = calculateSafeToSpend({
    monthlyIncome: incomeUsed,
    fixedBills,
    goalAmount: profile.goal_amount,
    goalDeadline: profile.goal_deadline,
    safetyBuffer: profile.safety_buffer ?? 0,
    spentThisMonth: discretionarySpent,
    taxWithholding: profile.tax_withholding ?? false,
    accounts: accountBalances,
    vaultMetrics,
  })

  // Categorize spending (excluding transfers)
  const spendingByCategory: Record<string, number> = {}
  for (const t of realSpending) {
    const cat =
      t.personal_finance_category?.primary ??
      t.category?.[0] ??
      "Other"
    spendingByCategory[cat] = (spendingByCategory[cat] ?? 0) + t.amount
  }

  return NextResponse.json({
    safeToSpend,
    income: {
      selfReported: selfReportedIncome,
      observed: Math.round(observedMonthlyIncome * 100) / 100,
      used: Math.round(incomeUsed * 100) / 100,
      usingObserved: usingObservedIncome,
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
