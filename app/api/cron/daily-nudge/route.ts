import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { plaidClient } from "@/lib/plaid"
import { calculateSafeToSpend } from "@/lib/safe-to-spend"
import type { AccountBalance, VaultMetrics } from "@/lib/safe-to-spend"
import { sendSMS } from "@/lib/twilio"
import OpenAI from "openai"

const CRON_SECRET = process.env.CRON_SECRET

// Categories to ignore for spending (internal movements)
const IGNORED_SPENDING = new Set(["TRANSFER_IN", "TRANSFER_OUT", "CREDIT_CARD", "LOAN_PAYMENTS"])

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function GET(req: Request) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch all onboarded users with phone numbers
  const { data: users, error } = await getSupabase()
    .from("user_profiles")
    .select("clerk_user_id, name, phone_number, plaid_access_token, bank_linked, monthly_income, goal_amount, goal_deadline, safety_buffer, tax_withholding, points")
    .eq("onboarded", true)
    .not("phone_number", "is", null)

  if (error || !users) {
    console.error("Cron: failed to fetch users", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }

  const results: { userId: string; action: string }[] = []

  for (const user of users) {
    try {
      const metrics = await getUserMetrics(user)
      if (!metrics) {
        results.push({ userId: user.clerk_user_id, action: "skipped_no_metrics" })
        continue
      }

      const { dailySafeToSpend, spentToday, topSpend } = metrics

      if (spentToday > dailySafeToSpend) {
        // Over limit — generate and send nudge
        const overBy = Math.round((spentToday - dailySafeToSpend) * 100) / 100
        const nudge = await generateNudge(user.name ?? "there", topSpend, overBy)

        await sendSMS(user.phone_number, nudge)
        results.push({ userId: user.clerk_user_id, action: `nudge_sent_over_$${overBy}` })
      } else {
        // Under limit — award 10 points
        const currentPoints = user.points ?? 0
        await getSupabase()
          .from("user_profiles")
          .update({ points: currentPoints + 10, updated_at: new Date().toISOString() })
          .eq("clerk_user_id", user.clerk_user_id)

        results.push({ userId: user.clerk_user_id, action: `points_awarded_${currentPoints + 10}` })
      }
    } catch (e) {
      console.error(`Cron: error for user ${user.clerk_user_id}:`, e)
      results.push({ userId: user.clerk_user_id, action: "error" })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}

// ── Fetch yesterday's spending for a user ──────────────────────────────
async function getUserMetrics(user: Record<string, unknown>): Promise<{
  dailySafeToSpend: number
  spentToday: number
  topSpend: { name: string; amount: number } | null
} | null> {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)

  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  // ── Plaid path ──────────────────────────────────────────────────────
  if (user.bank_linked && user.plaid_access_token) {
    const accessToken = user.plaid_access_token as string
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const res = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startOfMonth.toISOString().split("T")[0],
      end_date: now.toISOString().split("T")[0],
      options: { count: 500, offset: 0 },
    })

    const { accounts, transactions } = res.data

    const accountBalances: AccountBalance[] = accounts.map((a) => ({
      type: a.type as AccountBalance["type"],
      subtype: a.subtype,
      currentBalance: a.balances.current ?? 0,
      availableBalance: a.balances.available ?? null,
    }))

    const spendingAccountIds = new Set(
      accounts.filter((a) => a.type === "depository" || a.type === "credit").map((a) => a.account_id)
    )

    // This month's spending for safe-to-spend calc
    const thisMonth = transactions.filter((t) => {
      const d = new Date(t.date)
      return d >= startOfMonth && d <= now && spendingAccountIds.has(t.account_id)
    })

    const realSpending = thisMonth.filter((t) => {
      const cat = t.personal_finance_category?.primary ?? ""
      return t.amount > 0 && !IGNORED_SPENDING.has(cat)
    })

    const totalSpent = realSpending.reduce((s, t) => s + t.amount, 0)

    const fixedBills = realSpending
      .filter((t) =>
        t.personal_finance_category?.primary === "RENT_AND_UTILITIES" ||
        t.category?.includes("Rent") ||
        t.category?.includes("Utilities") ||
        t.category?.includes("Insurance")
      )
      .reduce((s, t) => s + t.amount, 0)

    const selfReported = (user.monthly_income as number) ?? 0
    const depositIds = new Set(accounts.filter((a) => a.type === "depository").map((a) => a.account_id))
    const observedIncome = transactions
      .filter((t) => t.amount < 0 && depositIds.has(t.account_id))
      .reduce((s, t) => s + Math.abs(t.amount), 0)

    const incomeUsed = Math.max(selfReported, observedIncome, totalSpent * 1.5)

    const sts = calculateSafeToSpend({
      monthlyIncome: incomeUsed,
      fixedBills,
      goalAmount: user.goal_amount as number | null,
      goalDeadline: user.goal_deadline as string | null,
      safetyBuffer: (user.safety_buffer as number) ?? 0,
      spentThisMonth: totalSpent - fixedBills,
      taxWithholding: (user.tax_withholding as boolean) ?? false,
      accounts: accountBalances,
    })

    // Last 24h spending
    const last24h = realSpending.filter((t) => new Date(t.date) >= yesterday)
    const spentToday = last24h.reduce((s, t) => s + t.amount, 0)

    // Largest single purchase
    const top = last24h.sort((a, b) => b.amount - a.amount)[0]

    return {
      dailySafeToSpend: sts.dailySafeToSpend,
      spentToday: Math.round(spentToday * 100) / 100,
      topSpend: top ? { name: top.name ?? "a purchase", amount: top.amount } : null,
    }
  }

  // ── Vault-only path ─────────────────────────────────────────────────
  const { data: vault } = await getSupabase()
    .from("vault_uploads")
    .select("total_income, total_spending, fixed_bills, closing_balance, period_start, period_end")
    .eq("clerk_user_id", user.clerk_user_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!vault) return null

  const vaultMetrics: VaultMetrics = {
    totalIncome: vault.total_income,
    totalSpending: vault.total_spending,
    fixedBills: vault.fixed_bills,
    closingBalance: vault.closing_balance ?? null,
    periodStart: vault.period_start,
    periodEnd: vault.period_end,
  }

  const incomeUsed = Math.max((user.monthly_income as number) ?? 0, vaultMetrics.totalIncome)

  const sts = calculateSafeToSpend({
    monthlyIncome: incomeUsed,
    fixedBills: 0,
    goalAmount: user.goal_amount as number | null,
    goalDeadline: user.goal_deadline as string | null,
    safetyBuffer: (user.safety_buffer as number) ?? 0,
    spentThisMonth: 0,
    taxWithholding: (user.tax_withholding as boolean) ?? false,
    accounts: [],
    vaultMetrics,
  })

  // Without live Plaid data, we can't know exact 24h spending
  // Use the daily average from the statement as an estimate
  const periodDays = Math.max(1, Math.ceil(
    (new Date(vault.period_end).getTime() - new Date(vault.period_start).getTime()) / (1000 * 60 * 60 * 24)
  ))
  const dailyAvgSpend = vault.total_spending / periodDays

  return {
    dailySafeToSpend: sts.dailySafeToSpend,
    spentToday: Math.round(dailyAvgSpend * 100) / 100,
    topSpend: null,
  }
}

// ── Generate a friendly 160-char nudge via OpenAI ──────────────────────
async function generateNudge(
  name: string,
  topSpend: { name: string; amount: number } | null,
  overBy: number
): Promise<string> {
  const spendContext = topSpend
    ? `${name} just spent $${topSpend.amount.toFixed(2)} on ${topSpend.name} and is $${overBy} over their daily safe-to-spend limit.`
    : `${name} is $${overBy} over their daily safe-to-spend limit today.`

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 80,
    messages: [
      {
        role: "system",
        content: "You are Aurora, a kind financial coach. Write a friendly, encouraging SMS nudge in under 160 characters. No emojis. Be warm, not preachy. Help them stay on track without guilt.",
      },
      {
        role: "user",
        content: `Aurora, ${spendContext} Write a friendly 160-character nudge to help them stay on track.`,
      },
    ],
  })

  const nudge = response.choices[0].message.content?.trim() ?? ""
  // Ensure SMS fits in one message
  return nudge.slice(0, 160)
}
