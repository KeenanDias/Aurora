import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { verifySavingsClaim } from "@/lib/verify-savings"

/**
 * POST /api/goals/[id]/log-contribution
 * Body: { amount: number }
 *
 * 1. Writes a goal_contributions row (verification_status='pending').
 * 2. Bumps goals.saved (cumulative — used for STS math + progress UI).
 * 3. Calls the Plaid verifier and updates the row to verified/probable/
 *    pending/unverified.
 * 4. If verified, awards Karma points (+10 per verified save, capped via
 *    points_ledger dedup by contribution id).
 *
 * Returns the contribution + Aurora-flavored message for the chat.
 */

const KARMA_PER_VERIFIED_SAVE = 10

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: goalId } = await ctx.params

  let body: { amount?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json({ error: "Amount must be a positive number under $1M." }, { status: 400 })
  }

  const supabase = getSupabase()
  const now = new Date()

  // ── 1. Update cumulative goals.saved (legacy 'primary' goes to user_profiles)
  if (goalId === "primary") {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("goal_saved, goal_amount")
      .eq("clerk_user_id", userId)
      .maybeSingle()
    const cap = Number(profile?.goal_amount ?? Infinity)
    const next = Math.min(cap, Number(profile?.goal_saved ?? 0) + amount)
    await supabase
      .from("user_profiles")
      .update({ goal_saved: next, updated_at: now.toISOString() })
      .eq("clerk_user_id", userId)
  } else {
    const { data: goal } = await supabase
      .from("goals")
      .select("saved, amount, is_primary")
      .eq("id", goalId)
      .eq("clerk_user_id", userId)
      .maybeSingle()
    if (!goal) return NextResponse.json({ error: "Goal not found." }, { status: 404 })
    const cap = Number(goal.amount)
    const next = Math.min(cap, Number(goal.saved ?? 0) + amount)
    await supabase
      .from("goals")
      .update({ saved: next, updated_at: now.toISOString() })
      .eq("id", goalId)
      .eq("clerk_user_id", userId)
    // Mirror to user_profiles for primary goal
    if (goal.is_primary) {
      await supabase
        .from("user_profiles")
        .update({ goal_saved: next, updated_at: now.toISOString() })
        .eq("clerk_user_id", userId)
    }
  }

  // ── 2. Pull previous balance snapshot (most recent prior contribution)
  const { data: lastRow } = await supabase
    .from("goal_contributions")
    .select("balance_at_claim")
    .eq("clerk_user_id", userId)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const previousBalanceSnapshot = lastRow?.balance_at_claim != null
    ? Number(lastRow.balance_at_claim)
    : null

  // ── 3. Insert the pending contribution row
  const { data: inserted, error: insertError } = await supabase
    .from("goal_contributions")
    .insert({
      goal_id: goalId,
      clerk_user_id: userId,
      amount,
      verification_status: "pending",
      claimed_at: now.toISOString(),
    })
    .select("id")
    .single()

  if (insertError || !inserted) {
    console.error("goal_contributions insert failed:", insertError)
    return NextResponse.json({ error: "Could not log contribution." }, { status: 500 })
  }
  const contributionId = inserted.id as string

  // ── 4. Run verification (Plaid scan + balance fallback)
  const result = await verifySavingsClaim({
    userId,
    contributionId,
    claimedAmount: amount,
    claimedAt: now,
    previousBalanceSnapshot,
  })

  await supabase
    .from("goal_contributions")
    .update({
      verification_status: result.status,
      verification_method: result.method,
      observed_growth: result.observedGrowth,
      balance_at_claim: result.balanceSnapshot,
      matched_transfer_id: result.matchedTransferId,
      verified_at: result.status === "verified" || result.status === "probable" ? now.toISOString() : null,
      updated_at: now.toISOString(),
    })
    .eq("id", contributionId)

  // ── 5. Karma — only on fully verified, and only once per contribution
  if (result.status === "verified") {
    const { data: existingKarma } = await supabase
      .from("points_ledger")
      .select("id")
      .eq("description", `goal_contribution:${contributionId}`)
      .maybeSingle()
    if (!existingKarma) {
      await supabase.from("points_ledger").insert({
        clerk_user_id: userId,
        action: "verified_save",
        points: KARMA_PER_VERIFIED_SAVE,
        description: `goal_contribution:${contributionId}`,
      })
      await supabase
        .from("goal_contributions")
        .update({ karma_awarded: true })
        .eq("id", contributionId)

      // Bump the user_profiles aggregate
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("points")
        .eq("clerk_user_id", userId)
        .maybeSingle()
      await supabase
        .from("user_profiles")
        .update({
          points: Number(prof?.points ?? 0) + KARMA_PER_VERIFIED_SAVE,
          updated_at: now.toISOString(),
        })
        .eq("clerk_user_id", userId)
    }
  }

  return NextResponse.json({
    success: true,
    contribution: {
      id: contributionId,
      amount,
      verification_status: result.status,
      verification_method: result.method,
      observed_growth: result.observedGrowth,
      matched_transfer_id: result.matchedTransferId,
      karma_awarded: result.status === "verified",
      claimed_at: now.toISOString(),
    },
    message: result.message,
  })
}
