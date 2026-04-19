import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile, error } = await getSupabase()
    .from("user_profiles")
    .select("name, onboarded, goal_description, goal_amount, goal_deadline, goal_saved, monthly_income, safety_buffer, bank_linked")
    .eq("clerk_user_id", userId)
    .single()

  if (!error && profile) {
    return NextResponse.json(profile)
  }

  // Fallback without goal_saved if column doesn't exist yet
  const { data: fallback } = await getSupabase()
    .from("user_profiles")
    .select("name, onboarded, goal_description, goal_amount, goal_deadline, monthly_income, safety_buffer, bank_linked")
    .eq("clerk_user_id", userId)
    .single()

  if (!fallback) {
    return NextResponse.json({ onboarded: false })
  }

  return NextResponse.json({ ...fallback, goal_saved: 0 })
}
