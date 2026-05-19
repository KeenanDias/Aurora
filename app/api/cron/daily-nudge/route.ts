import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { plaidClient } from "@/lib/plaid"
import { calculateSafeToSpend } from "@/lib/safe-to-spend"
import type { AccountBalance, VaultMetrics, UpcomingBill } from "@/lib/safe-to-spend"
import { sendSMS } from "@/lib/twilio"
import OpenAI from "openai"
import { aggregateVaultUploads } from "@/lib/vault-transactions"

// Force this route to be dynamic — never prerendered. Next.js's page-data
// collection step would otherwise try to evaluate the module at build
// time, which blows up because the runtime env vars aren't available.
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const IGNORED_SPENDING = new Set(["TRANSFER_IN", "TRANSFER_OUT", "CREDIT_CARD", "LOAN_PAYMENTS"])

// Lazy-init so the OpenAI client is constructed at request time, not at
// module load. Without this Cloudflare's build crashes during page-data
// collection with "Missing credentials."
let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: users, error } = await getSupabase()
    .from("user_profiles")
    .select("clerk_user_id, name, phone_number, plaid_access_token, bank_linked, monthly_income, goal_amount, goal_description, goal_deadline, goal_saved, goal_status, safety_buffer, tax_withholding, points, points_streak, longest_streak, last_points_date, last_predictive_nudge_date")
    .eq("onboarded", true)
    .not("phone_number", "is", null)

  if (error || !users) {
    console.error("Cron: failed to fetch users", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }

  const results: { userId: string; action: string }[] = []
  const today = new Date().toISOString().split("T")[0]

  for (const user of users) {
    try {
      // Skip if already awarded points today (prevent double-runs)
      if (user.last_points_date === today) {
        results.push({ userId: user.clerk_user_id, action: "already_processed_today" })
        continue
      }

      const metrics = await getUserMetrics(user)
      const { dailySafeToSpend, spentYesterday, topSpend, wasOverYesterday, overBy, escrowedBills, escrowTotal } = metrics

      const currentPoints = user.points ?? 0
      const currentStreak = user.points_streak ?? 0
      const longestStreak = user.longest_streak ?? 0
      const bankLinked = !!user.bank_linked

      // ── Points Logic (Plaid-only) ────────────────────────────────────
      let pointsEarned = 0
      let newStreak = currentStreak
      let pointsActions: string[] = []

      if (bankLinked) {
        if (!wasOverYesterday && spentYesterday >= 0) {
          // Daily Discipline: +10 pts
          pointsEarned += 10
          pointsActions.push("daily_discipline")
          newStreak = currentStreak + 1

          // Weekly Perfect Streak: +50 pts bonus at 7 days
          if (newStreak > 0 && newStreak % 7 === 0) {
            pointsEarned += 50
            pointsActions.push("weekly_streak")
          }

          // Rainy Day Resilience: +20 pts for staying under during escrow week
          if (escrowTotal > 0) {
            pointsEarned += 20
            pointsActions.push("rainy_day")
          }
        } else {
          // Streak broken
          newStreak = 0
        }

        // Goal milestones: +100 pts at 25%, 50%, 75%, 100%
        if (user.goal_amount && user.goal_saved && user.goal_status === "active") {
          const progress = (user.goal_saved / user.goal_amount) * 100
          const milestones = [25, 50, 75, 100]
          for (const m of milestones) {
            if (progress >= m) {
              // Check if this milestone was already awarded
              const { data: existing } = await getSupabase()
                .from("points_ledger")
                .select("id")
                .eq("clerk_user_id", user.clerk_user_id)
                .eq("action", `goal_milestone_${m}`)
                .limit(1)
                .single()

              if (!existing) {
                pointsEarned += 100
                pointsActions.push(`goal_milestone_${m}`)
                await getSupabase().from("points_ledger").insert({
                  clerk_user_id: user.clerk_user_id,
                  action: `goal_milestone_${m}`,
                  points: 100,
                  description: `Reached ${m}% of savings goal`,
                })
              }
            }
          }
        }

        // Record daily points in ledger
        if (pointsEarned > 0) {
          for (const action of pointsActions) {
            if (!action.startsWith("goal_milestone")) {
              await getSupabase().from("points_ledger").insert({
                clerk_user_id: user.clerk_user_id,
                action,
                points: action === "weekly_streak" ? 50 : action === "rainy_day" ? 20 : 10,
                description: action === "daily_discipline" ? `Day ${newStreak} on budget`
                  : action === "weekly_streak" ? `${newStreak}-day streak bonus`
                  : "Stayed under during Big Bill week",
              })
            }
          }
        }
      }

      // Update user points, streak, and date
      const newTotal = currentPoints + pointsEarned
      await getSupabase()
        .from("user_profiles")
        .update({
          points: newTotal,
          points_streak: newStreak,
          longest_streak: Math.max(longestStreak, newStreak),
          last_points_date: today,
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_user_id", user.clerk_user_id)

      // ── SMS Message ──────────────────────────────────────────────────
      // Priority:
      //   1. Predictive nudge — user is on pace to overspend by month-end.
      //      Dedup'd via last_predictive_nudge_date so we don't spam.
      //   2. Yesterday-overspend reactive nudge (legacy fallback).
      //   3. Standard morning check-in.
      const {
        isOnPaceToOverspend,
        predictedRunoutDate,
        velocity,
        projectedDiscretionary,
        monthlyAvailable: projMonthlyAvailable,
      } = metrics
      const alreadyNudgedToday = user.last_predictive_nudge_date === today
      const fireRunoutDate = predictedRunoutDate ?? today

      if (isOnPaceToOverspend && !alreadyNudgedToday) {
        const nudge = generatePredictiveNudge({
          name: user.name ?? "there",
          predictedRunoutIso: fireRunoutDate,
          primaryGoalName: (user.goal_description as string | null) ?? null,
        })
        await sendSMS(user.phone_number, nudge)
        // Mark as nudged so we don't repeat the warning every morning until
        // they course-correct (velocity drops below the overspend threshold).
        await getSupabase()
          .from("user_profiles")
          .update({ last_predictive_nudge_date: today })
          .eq("clerk_user_id", user.clerk_user_id)
        results.push({
          userId: user.clerk_user_id,
          action: `predictive_v$${velocity}_proj$${projectedDiscretionary}_avail$${projMonthlyAvailable}_runout${fireRunoutDate}`,
        })
      } else if (wasOverYesterday && spentYesterday > 0) {
        const nudge = await generateOverspendNudge(
          user.name ?? "there",
          topSpend,
          overBy,
          dailySafeToSpend,
          escrowedBills
        )
        await sendSMS(user.phone_number, nudge)
        results.push({ userId: user.clerk_user_id, action: `nudge_over_$${overBy}_streak_reset` })
      } else {
        const message = await generateMorningCheckIn(
          user.name ?? "there",
          dailySafeToSpend,
          bankLinked ? newTotal : null,
          newStreak,
          escrowedBills,
          pointsEarned
        )
        await sendSMS(user.phone_number, message)
        results.push({ userId: user.clerk_user_id, action: `ok_pts+${pointsEarned}_streak${newStreak}_daily$${dailySafeToSpend}` })
      }
    } catch (e) {
      console.error(`Cron: error for user ${user.clerk_user_id}:`, e)
      results.push({ userId: user.clerk_user_id, action: "error" })
    }
  }

  return NextResponse.json({ processed: results.length, results })
}

// ── Fetch upcoming bills for escrow ──────────────────────────────────────
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

// ── Metrics ─────────────────────────────────────────────────────────
type UserMetrics = {
  dailySafeToSpend: number
  spentYesterday: number
  topSpend: { name: string; amount: number } | null
  wasOverYesterday: boolean
  overBy: number
  escrowedBills: { name: string; amount: number; dueDate: string }[]
  escrowTotal: number
  // ── Predictive velocity (Velocity Math) ──────────────────────────────
  // V = discretionarySpent / daysElapsed (month-to-date)
  // ProjectedDiscretionary = V × daysInMonth
  // If ProjectedDiscretionary > monthlyAvailable → user is statistically
  // on pace to run out of money before next paycheck → fire predictive SMS.
  discretionaryMTD: number      // month-to-date discretionary spend
  daysElapsed: number           // days into the current month, incl today
  daysInMonth: number
  monthlyAvailable: number      // income - bills - goal carve-out - buffer
  velocity: number              // discretionaryMTD / daysElapsed
  projectedDiscretionary: number
  isOnPaceToOverspend: boolean
  predictedRunoutDate: string | null // ISO YYYY-MM-DD when V × X exceeds monthlyAvailable
}

async function getUserMetrics(user: Record<string, unknown>): Promise<UserMetrics> {
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  // Fetch upcoming bills for all paths
  const upcomingBills = await fetchUpcomingBills(user.clerk_user_id as string, now)
  const escrowTotal = upcomingBills.reduce((s, b) => s + b.amount, 0)

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

    // Aggregate all vault uploads (newest-first non-overlapping cover) so
    // STS reality-checks against the user's full statement history, not
    // just the most recent PDF.
    let vaultMetrics: VaultMetrics | null = null
    const vaultAgg = await aggregateVaultUploads(user.clerk_user_id as string)
    if (vaultAgg.totals) vaultMetrics = vaultAgg.totals

    const sts = calculateSafeToSpend({
      monthlyIncome: incomeUsed,
      fixedBills,
      goalAmount: user.goal_amount as number | null,
      goalDeadline: user.goal_deadline as string | null,
      goalStatus: (user.goal_status as "active" | "completed" | "paused") ?? "active",
      goalSaved: (user.goal_saved as number) ?? 0,
      safetyBuffer: (user.safety_buffer as number) ?? 0,
      spentThisMonth: totalSpent - fixedBills,
      taxWithholding: (user.tax_withholding as boolean) ?? false,
      accounts: accountBalances,
      vaultMetrics,
      upcomingBills,
    })

    // Yesterday's spending
    const yesterdaySpending = realSpending.filter((t) => {
      const d = new Date(t.date)
      return d >= yesterday && d < todayStart
    })
    const spentYesterday = yesterdaySpending.reduce((s, t) => s + t.amount, 0)

    const yesterdayDaysRemaining = Math.max(1, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - yesterday.getDate() + 1)
    const spentBeforeYesterday = totalSpent - spentYesterday
    const remainingBeforeYesterday = (incomeUsed - fixedBills - sts.monthlySavingsGoal - ((user.safety_buffer as number) ?? 0) - escrowTotal) - (spentBeforeYesterday - fixedBills)
    const yesterdayLimit = Math.max(0, remainingBeforeYesterday / yesterdayDaysRemaining)

    const wasOverYesterday = spentYesterday > yesterdayLimit && spentYesterday > 0
    const overBy = Math.round(Math.max(0, spentYesterday - yesterdayLimit) * 100) / 100
    const top = yesterdaySpending.sort((a, b) => b.amount - a.amount)[0]

    // ── Predictive velocity calculation ────────────────────────────────
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysElapsed = Math.max(1, now.getDate())
    const discretionaryMTD = Math.max(0, totalSpent - fixedBills)
    const velocity = discretionaryMTD / daysElapsed
    const projectedDiscretionary = velocity * daysInMonth
    const monthlyAvailable = sts.monthlyAvailable
    const isOnPaceToOverspend =
      monthlyAvailable > 0 && projectedDiscretionary > monthlyAvailable && velocity > 0

    // Predicted run-out date: solve V × X = monthlyAvailable → X days from
    // start of month. If X < daysElapsed they're already past it; cap at
    // daysInMonth so the string never claims "Dec 35".
    let predictedRunoutDate: string | null = null
    if (isOnPaceToOverspend) {
      const xDays = Math.min(daysInMonth, Math.max(daysElapsed + 1, Math.ceil(monthlyAvailable / velocity)))
      const runoutD = new Date(now.getFullYear(), now.getMonth(), xDays)
      predictedRunoutDate = runoutD.toISOString().split("T")[0]
    }

    return {
      dailySafeToSpend: sts.dailySafeToSpend,
      spentYesterday: Math.round(spentYesterday * 100) / 100,
      topSpend: top ? { name: top.name ?? "a purchase", amount: top.amount } : null,
      wasOverYesterday,
      overBy,
      escrowedBills: sts.escrowedBills,
      escrowTotal: sts.escrowTotal,
      discretionaryMTD: Math.round(discretionaryMTD * 100) / 100,
      daysElapsed,
      daysInMonth,
      monthlyAvailable: Math.round(monthlyAvailable * 100) / 100,
      velocity: Math.round(velocity * 100) / 100,
      projectedDiscretionary: Math.round(projectedDiscretionary * 100) / 100,
      isOnPaceToOverspend,
      predictedRunoutDate,
    }
  }

  // ── Vault-only path ────────────────────────────────────────────────
  // Aggregate across every uploaded statement. Income is normalized to a
  // monthly rate using the canonical span so 3 months of statements stop
  // tripling the perceived income.
  const vaultAggOnly = await aggregateVaultUploads(user.clerk_user_id as string)
  if (vaultAggOnly.totals) {
    const vaultMetrics: VaultMetrics = vaultAggOnly.totals
    const monthlyFactor = 30.44 / Math.max(1, vaultAggOnly.spanDays)
    const monthlyVaultIncome = vaultMetrics.totalIncome * monthlyFactor
    const incomeUsed = Math.max((user.monthly_income as number) ?? 0, monthlyVaultIncome)
    const sts = calculateSafeToSpend({
      monthlyIncome: incomeUsed,
      fixedBills: 0,
      goalAmount: user.goal_amount as number | null,
      goalDeadline: user.goal_deadline as string | null,
      goalStatus: (user.goal_status as "active" | "completed" | "paused") ?? "active",
      goalSaved: (user.goal_saved as number) ?? 0,
      safetyBuffer: (user.safety_buffer as number) ?? 0,
      spentThisMonth: 0,
      taxWithholding: (user.tax_withholding as boolean) ?? false,
      accounts: [],
      vaultMetrics,
      upcomingBills,
    })
    return emptyPredictiveMetrics(sts.dailySafeToSpend, sts.escrowedBills, sts.escrowTotal, sts.monthlyAvailable, now)
  }

  // ── Profile-only path ──────────────────────────────────────────────
  const sts = calculateSafeToSpend({
    monthlyIncome: (user.monthly_income as number) ?? 0,
    fixedBills: 0,
    goalAmount: user.goal_amount as number | null,
    goalDeadline: user.goal_deadline as string | null,
    goalStatus: (user.goal_status as "active" | "completed" | "paused") ?? "active",
    goalSaved: (user.goal_saved as number) ?? 0,
    safetyBuffer: (user.safety_buffer as number) ?? 0,
    spentThisMonth: 0,
    taxWithholding: (user.tax_withholding as boolean) ?? false,
    accounts: [],
    upcomingBills,
  })
  return emptyPredictiveMetrics(sts.dailySafeToSpend, sts.escrowedBills, sts.escrowTotal, sts.monthlyAvailable, now)
}

// Default metrics for users we can't measure (no Plaid + no vault). Predictive
// engine treats them as not-on-pace because we have no spending signal at all.
function emptyPredictiveMetrics(
  dailySafeToSpend: number,
  escrowedBills: { name: string; amount: number; dueDate: string }[],
  escrowTotal: number,
  monthlyAvailable: number,
  now: Date
): UserMetrics {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  return {
    dailySafeToSpend,
    spentYesterday: 0,
    topSpend: null,
    wasOverYesterday: false,
    overBy: 0,
    escrowedBills,
    escrowTotal,
    discretionaryMTD: 0,
    daysElapsed: Math.max(1, now.getDate()),
    daysInMonth,
    monthlyAvailable: Math.round(monthlyAvailable * 100) / 100,
    velocity: 0,
    projectedDiscretionary: 0,
    isOnPaceToOverspend: false,
    predictedRunoutDate: null,
  }
}

// ── Generate predictive nudge ─────────────────────────────────────────
// Triggered when projected end-of-month discretionary exceeds the user's
// monthly_available. Uses the supportive copy template from the spec.
function generatePredictiveNudge(params: {
  name: string
  predictedRunoutIso: string
  primaryGoalName: string | null
}): string {
  const runoutDate = new Date(params.predictedRunoutIso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  })
  const goalClause = params.primaryGoalName
    ? ` to protect your ${params.primaryGoalName} goal`
    : ""
  const message = `Hey ${params.name}, Aurora here. At your current spending pace this week, your Safe-to-Spend limit will hit $0 by ${runoutDate}. Let's freeze non-essential spending for 48 hours${goalClause}!`
  return message.slice(0, 320) // SMS multi-segment cap; ~2 segments worst case
}

// ── Generate overspending nudge ──────────────────────────────────────
async function generateOverspendNudge(
  name: string,
  topSpend: { name: string; amount: number } | null,
  overBy: number,
  newDailyLimit: number,
  escrowedBills: { name: string; amount: number; dueDate: string }[]
): Promise<string> {
  const spendContext = topSpend
    ? `${name} spent $${topSpend.amount.toFixed(2)} on ${topSpend.name} yesterday and went $${overBy} over.`
    : `${name} went $${overBy} over their daily safe-to-spend yesterday.`

  const escrowContext = escrowedBills.length > 0
    ? ` Note: $${escrowedBills.reduce((s, b) => s + b.amount, 0)} is protected for ${escrowedBills.map(b => b.name).join(", ")} coming up.`
    : ""

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 80,
    messages: [
      {
        role: "system",
        content: "You are Aurora, a kind financial coach who mirrors the user's vibe. Write a friendly SMS under 160 chars. No emojis. Warm, not preachy. Include the new daily limit.",
      },
      {
        role: "user",
        content: `${spendContext}${escrowContext} Updated safe-to-spend today: $${newDailyLimit}. Write a 160-char nudge.`,
      },
    ],
  })

  return (response.choices[0].message.content?.trim() ?? "").slice(0, 160)
}

// ── Generate morning check-in ────────────────────────────────────────
async function generateMorningCheckIn(
  name: string,
  dailySafeToSpend: number,
  points: number | null,
  streak: number,
  escrowedBills: { name: string; amount: number; dueDate: string }[],
  pointsEarned: number
): Promise<string> {
  const karmaNote = points != null
    ? `They earned +${pointsEarned} Financial Karma (total: ${points}, ${streak}-day streak).`
    : "No Financial Karma (bank not linked)."

  const escrowNote = escrowedBills.length > 0
    ? ` $${escrowedBills.reduce((s, b) => s + b.amount, 0)} is escrowed for ${escrowedBills.map(b => b.name).join(", ")}.`
    : ""

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 80,
    messages: [
      {
        role: "system",
        content: "You are Aurora, a kind financial coach who mirrors the user's vibe. Write a friendly morning SMS under 160 chars. No emojis. Include daily limit. If they have Karma points, mention the streak. If escrow is active, briefly note why the limit is adjusted.",
      },
      {
        role: "user",
        content: `${name}'s safe-to-spend today: $${dailySafeToSpend}. ${karmaNote}${escrowNote} Write a warm 160-char morning text.`,
      },
    ],
  })

  return (response.choices[0].message.content?.trim() ?? "").slice(0, 160)
}
