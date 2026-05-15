import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * POST /api/goals/[id]/toggle-enrollment
 * Body: { enrolled: boolean }
 *
 * Flips the goal's is_enrolled flag. The dashboard listens on
 * BroadcastChannel('aurora') for `profile-updated` to refetch STS after a
 * toggle, since enrollment changes the daily limit.
 *
 * Special id "primary" mirrors the legacy single-goal path — there's no
 * is_enrolled column on user_profiles, so toggling the legacy primary "off"
 * is honored by setting goal_status='paused' (which calculateSafeToSpend
 * already respects). Toggling back on resets to 'active'.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await ctx.params

  let body: { enrolled?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (typeof body.enrolled !== "boolean") {
    return NextResponse.json({ error: "Body must include `enrolled: boolean`." }, { status: 400 })
  }

  const supabase = getSupabase()

  // Legacy synthesized primary — flip status on user_profiles instead.
  if (id === "primary") {
    const { error } = await supabase
      .from("user_profiles")
      .update({
        goal_status: body.enrolled ? "active" : "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_user_id", userId)
    if (error) {
      console.error("primary enrollment toggle failed:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, primary: true, enrolled: body.enrolled })
  }

  const { data: row, error } = await supabase
    .from("goals")
    .update({
      is_enrolled: body.enrolled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clerk_user_id", userId)
    .select("id, description, is_enrolled, is_primary")
    .single()

  if (error) {
    console.error("goals enrollment toggle failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: "Goal not found." }, { status: 404 })
  }

  // If this is the primary, mirror to user_profiles.goal_status too so the
  // legacy STS path stays in sync until everything's fully migrated.
  if (row.is_primary) {
    await supabase
      .from("user_profiles")
      .update({
        goal_status: body.enrolled ? "active" : "paused",
        updated_at: new Date().toISOString(),
      })
      .eq("clerk_user_id", userId)
  }

  return NextResponse.json({
    success: true,
    enrolled: row.is_enrolled,
    description: row.description,
  })
}
