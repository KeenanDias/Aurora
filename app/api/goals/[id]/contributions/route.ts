import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * GET /api/goals/[id]/contributions
 * Returns recent contributions for a single goal so the detail panel can
 * show the Plaid-Verified / Pending / Unverified history.
 */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: goalId } = await ctx.params

  const { data, error } = await getSupabase()
    .from("goal_contributions")
    .select(
      "id, amount, verification_status, verification_method, observed_growth, karma_awarded, claimed_at, verified_at"
    )
    .eq("clerk_user_id", userId)
    .eq("goal_id", goalId)
    .order("claimed_at", { ascending: false })
    .limit(25)

  if (error) {
    console.warn("contributions fetch error:", error.message)
    return NextResponse.json({ contributions: [] })
  }

  return NextResponse.json({ contributions: data ?? [] })
}
