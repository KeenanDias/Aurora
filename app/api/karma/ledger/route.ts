import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * Returns the user's recent Financial Karma events for the dashboard
 * "Karma Earned" feed. Capped at 20 most recent.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await getSupabase()
    .from("points_ledger")
    .select("id, action, points, description, created_at")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("karma ledger fetch error:", error)
    return NextResponse.json({ events: [] })
  }

  return NextResponse.json({ events: data ?? [] })
}
