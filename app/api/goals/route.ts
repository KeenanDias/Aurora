import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * Multi-goal API.
 *
 * GET  /api/goals          → list of goals for the current user, including a
 *                            "synthesized" primary goal pulled from
 *                            user_profiles for back-compat with single-goal
 *                            users who haven't created any rows in `goals` yet.
 *
 * POST /api/goals          → create a new goal. Body:
 *                            { description, amount, deadline?, emoji? }
 *                            If the user has no primary goal yet, also writes
 *                            this one back into user_profiles so the existing
 *                            Safe-to-Spend math picks it up.
 */

const EMOJI_HINTS: { match: RegExp; emoji: string }[] = [
  { match: /pc|computer|laptop|gaming|gpu/i, emoji: "🖥️" },
  { match: /car|vehicle|truck|bike|motorcycle/i, emoji: "🚗" },
  { match: /house|home|apartment|condo|rent|down ?payment/i, emoji: "🏠" },
  { match: /trip|travel|vacation|flight|tokyo|europe|paris|japan|hawaii/i, emoji: "✈️" },
  { match: /wedding|ring|honeymoon/i, emoji: "💍" },
  { match: /emergency|rainy|cushion|buffer/i, emoji: "🛡️" },
  { match: /school|college|tuition|degree|education/i, emoji: "🎓" },
  { match: /debt|loan|credit/i, emoji: "💳" },
  { match: /baby|kid|child/i, emoji: "👶" },
  { match: /retire|pension/i, emoji: "🏝️" },
]

function inferEmoji(description: string): string {
  for (const h of EMOJI_HINTS) if (h.match.test(description)) return h.emoji
  return "🎯"
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const supabase = getSupabase()

  // Try with is_enrolled; if the migration isn't applied yet, fall back.
  let rows: Record<string, unknown>[] | null = null
  let { data, error } = await supabase
    .from("goals")
    .select("id, description, amount, saved, deadline, emoji, status, is_primary, is_enrolled, created_at")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: true })
  if (error && error.message?.toLowerCase().includes("is_enrolled")) {
    const fallback = await supabase
      .from("goals")
      .select("id, description, amount, saved, deadline, emoji, status, is_primary, created_at")
      .eq("clerk_user_id", userId)
      .order("created_at", { ascending: true })
    data = fallback.data as typeof data
    error = fallback.error
  }
  rows = data as Record<string, unknown>[] | null

  if (error) {
    console.error("goals fetch error:", error)
    return NextResponse.json({ goals: [] })
  }

  // Compute per-goal monthly bite for any enrolled+active goal so the UI
  // can show "$X/day reserved" without re-running the math client-side.
  const now = new Date()
  const enriched = (rows ?? []).map((g) => {
    const amount = Number(g.amount)
    const saved = Number(g.saved ?? 0)
    const deadline = g.deadline as string | null
    const isEnrolled = g.is_enrolled === undefined ? !!g.is_primary : !!g.is_enrolled
    let monthlyBite = 0
    let dailyBite = 0
    if (isEnrolled && deadline && saved < amount) {
      const d = new Date(deadline)
      const monthsRemaining = Math.max(
        1,
        (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
      )
      monthlyBite = (amount - saved) / monthsRemaining
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      dailyBite = monthlyBite / daysInMonth
    }
    return {
      ...g,
      is_enrolled: isEnrolled,
      monthly_bite: Math.round(monthlyBite * 100) / 100,
      daily_bite: Math.round(dailyBite * 100) / 100,
    }
  })

  // Back-compat: surface the single-goal columns on user_profiles as a
  // synthesized first row when the goals table is empty. Lets pre-existing
  // users see their goal in the new UI without a manual migration.
  if (enriched.length === 0) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("goal_description, goal_amount, goal_deadline, goal_saved, goal_status")
      .eq("clerk_user_id", userId)
      .maybeSingle()

    if (profile?.goal_description && profile?.goal_amount) {
      const amount = Number(profile.goal_amount)
      const saved = Number(profile.goal_saved ?? 0)
      const deadline = profile.goal_deadline ?? null
      const status = (profile.goal_status as string) ?? "active"
      const isEnrolled = status === "active"
      let monthlyBite = 0
      let dailyBite = 0
      if (isEnrolled && deadline && saved < amount) {
        const d = new Date(deadline)
        const monthsRemaining = Math.max(
          1,
          (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth())
        )
        monthlyBite = (amount - saved) / monthsRemaining
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
        dailyBite = monthlyBite / daysInMonth
      }
      return NextResponse.json({
        goals: [
          {
            id: "primary",
            description: profile.goal_description,
            amount,
            saved,
            deadline,
            emoji: inferEmoji(profile.goal_description),
            status,
            is_primary: true,
            is_enrolled: isEnrolled,
            monthly_bite: Math.round(monthlyBite * 100) / 100,
            daily_bite: Math.round(dailyBite * 100) / 100,
            created_at: null,
            synthesized: true,
          },
        ],
      })
    }
  }

  return NextResponse.json({ goals: enriched })
}

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { description?: string; amount?: number; deadline?: string; emoji?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const description = (body.description ?? "").toString().trim().slice(0, 200)
  const amount = Number(body.amount)
  const deadline = body.deadline && /^\d{4}-\d{2}-\d{2}/.test(body.deadline) ? body.deadline.slice(0, 10) : null
  const emoji = body.emoji?.trim().slice(0, 8) || inferEmoji(description)

  if (!description || description.length < 2) {
    return NextResponse.json({ error: "Description is required." }, { status: 400 })
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return NextResponse.json({ error: "Amount must be a positive number under $10M." }, { status: 400 })
  }

  const supabase = getSupabase()

  // Is this the user's first goal? If so, mark it primary AND mirror to
  // user_profiles so calculateSafeToSpend keeps deducting savings.
  const { data: existingGoals } = await supabase
    .from("goals")
    .select("id")
    .eq("clerk_user_id", userId)
    .limit(1)

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("goal_amount")
    .eq("clerk_user_id", userId)
    .maybeSingle()

  const noGoalsYet = (existingGoals ?? []).length === 0
  const profileHasNoGoal = !profile?.goal_amount
  const shouldBePrimary = noGoalsYet && profileHasNoGoal

  // First/primary goal is auto-enrolled (matches the legacy single-goal
  // expectation that any goal you set carves out the daily limit).
  // Subsequent goals start as tracking-only and the user opts them in.
  const insertPayload: Record<string, unknown> = {
    clerk_user_id: userId,
    description,
    amount,
    saved: 0,
    deadline,
    emoji,
    status: "active",
    is_primary: shouldBePrimary,
    is_enrolled: shouldBePrimary,
  }

  const initial = await supabase
    .from("goals")
    .insert(insertPayload)
    .select("id, description, amount, saved, deadline, emoji, status, is_primary, is_enrolled, created_at")
    .single()
  let inserted: Record<string, unknown> | null = initial.data
  let error = initial.error

  // Graceful fallback if migration 010 isn't applied yet — drop is_enrolled.
  if (error && error.message?.toLowerCase().includes("is_enrolled")) {
    console.warn("goals.is_enrolled column missing — applying sql/010 will enable enrollment toggles.")
    delete insertPayload.is_enrolled
    const retry = await supabase
      .from("goals")
      .insert(insertPayload)
      .select("id, description, amount, saved, deadline, emoji, status, is_primary, created_at")
      .single()
    inserted = retry.data
    error = retry.error
  }

  if (error) {
    console.error("goals insert error:", error)
    return NextResponse.json({ error: "Could not save goal." }, { status: 500 })
  }

  // Mirror primary to user_profiles for STS math compatibility.
  if (shouldBePrimary) {
    const { error: mirrorErr } = await supabase
      .from("user_profiles")
      .update({
        goal_description: description,
        goal_amount: amount,
        goal_deadline: deadline,
        goal_saved: 0,
        goal_status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_user_id", userId)
    if (mirrorErr) console.warn("primary goal mirror failed:", mirrorErr.message)
  }

  return NextResponse.json({ success: true, goal: inserted })
}
