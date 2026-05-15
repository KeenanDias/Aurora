import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * PATCH /api/goals/[id]
 * Updates an individual goal. Supports status (active|paused|completed),
 * amount, deadline, and saved.
 *
 * If the goal is the user's primary, also mirrors changes to user_profiles
 * so calculateSafeToSpend reflects the change immediately. Pausing the
 * primary goal sets goal_status='paused' on user_profiles, which the math
 * engine respects (savings stop deducting).
 *
 * Special id "primary" handles the synthesized legacy goal — writes go
 * straight to user_profiles.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params

  let body: { status?: string; amount?: number; deadline?: string | null; saved?: number; description?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.status && ["active", "paused", "completed"].includes(body.status)) {
    updates.status = body.status
  }
  if (typeof body.amount === "number" && body.amount > 0 && body.amount <= 10_000_000) {
    updates.amount = body.amount
  }
  if (body.deadline !== undefined) {
    updates.deadline = body.deadline && /^\d{4}-\d{2}-\d{2}/.test(body.deadline)
      ? body.deadline.slice(0, 10)
      : null
  }
  if (typeof body.saved === "number" && body.saved >= 0) {
    updates.saved = body.saved
  }
  if (typeof body.description === "string" && body.description.trim().length >= 2) {
    updates.description = body.description.trim().slice(0, 200)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 })
  }

  const supabase = getSupabase()

  // Synthesized legacy primary — only lives on user_profiles.
  if (id === "primary") {
    const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.status) profileUpdate.goal_status = updates.status
    if (updates.amount) profileUpdate.goal_amount = updates.amount
    if (updates.deadline !== undefined) profileUpdate.goal_deadline = updates.deadline
    if (updates.saved !== undefined) profileUpdate.goal_saved = updates.saved
    if (updates.description) profileUpdate.goal_description = updates.description

    const { error } = await supabase
      .from("user_profiles")
      .update(profileUpdate)
      .eq("clerk_user_id", userId)
    if (error) {
      console.error("primary goal update error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, primary: true })
  }

  // Real goals row.
  updates.updated_at = new Date().toISOString()

  const { data: row, error } = await supabase
    .from("goals")
    .update(updates)
    .eq("id", id)
    .eq("clerk_user_id", userId)
    .select("id, description, amount, saved, deadline, emoji, status, is_primary, created_at")
    .single()

  if (error) {
    console.error("goals update error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 })
  }

  // Mirror primary changes to user_profiles so STS math stays in sync.
  if (row.is_primary) {
    const mirror: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (updates.status) mirror.goal_status = updates.status
    if (updates.amount) mirror.goal_amount = updates.amount
    if (updates.deadline !== undefined) mirror.goal_deadline = updates.deadline
    if (updates.saved !== undefined) mirror.goal_saved = updates.saved
    if (updates.description) mirror.goal_description = updates.description
    const { error: mirrorErr } = await supabase
      .from("user_profiles")
      .update(mirror)
      .eq("clerk_user_id", userId)
    if (mirrorErr) console.warn("primary goal mirror failed:", mirrorErr.message)
  }

  return NextResponse.json({ success: true, goal: row })
}
