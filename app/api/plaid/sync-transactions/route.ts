import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { plaidClient } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase"
import { calculateSafeToSpend } from "@/lib/safe-to-spend"

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

  if (!profile || !profile.plaid_access_token) {
    return NextResponse.json(
      { error: "No bank linked" },
      { status: 400 }
    )
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

  // Calculate spending this month (positive amounts = money out)
  const thisMonthTransactions = transactions.filter((t) => {
    const tDate = new Date(t.date)
    return tDate >= startOfMonth && tDate <= now
  })

  const spentThisMonth = thisMonthTransactions
    .filter((t) => t.amount > 0) // Plaid: positive = debit/spend
    .reduce((sum, t) => sum + t.amount, 0)

  // Identify likely fixed bills (recurring, same-ish amounts)
  const fixedBills = thisMonthTransactions
    .filter(
      (t) =>
        t.amount > 0 &&
        (t.category?.includes("Rent") ||
          t.category?.includes("Utilities") ||
          t.category?.includes("Insurance") ||
          t.category?.includes("Loan") ||
          t.personal_finance_category?.primary === "LOAN_PAYMENTS" ||
          t.personal_finance_category?.primary === "RENT_AND_UTILITIES")
    )
    .reduce((sum, t) => sum + t.amount, 0)

  // Total account balances
  const totalBalance = accounts.reduce(
    (sum, a) => sum + (a.balances.current ?? 0),
    0
  )

  // Calculate Safe-to-Spend
  const safeToSpend = calculateSafeToSpend({
    monthlyIncome: profile.monthly_income ?? 0,
    fixedBills,
    goalAmount: profile.goal_amount,
    goalDeadline: profile.goal_deadline,
    safetyBuffer: profile.safety_buffer ?? 0,
    spentThisMonth,
    taxWithholding: profile.tax_withholding ?? false,
  })

  // Categorize spending
  const spendingByCategory: Record<string, number> = {}
  for (const t of thisMonthTransactions) {
    if (t.amount > 0) {
      const cat =
        t.personal_finance_category?.primary ??
        t.category?.[0] ??
        "Other"
      spendingByCategory[cat] = (spendingByCategory[cat] ?? 0) + t.amount
    }
  }

  return NextResponse.json({
    safeToSpend,
    accounts: accounts.map((a) => ({
      name: a.name,
      type: a.type,
      balance: a.balances.current,
    })),
    totalBalance,
    spentThisMonth: Math.round(spentThisMonth * 100) / 100,
    fixedBills: Math.round(fixedBills * 100) / 100,
    spendingByCategory,
    recentTransactions: transactions.slice(0, 10).map((t) => ({
      name: t.name,
      amount: t.amount,
      date: t.date,
      category: t.personal_finance_category?.primary ?? t.category?.[0],
    })),
  })
}
