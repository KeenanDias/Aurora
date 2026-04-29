"use server"

import { auth } from "@clerk/nextjs/server"
import { getSupabase } from "@/lib/supabase"

export type OnboardingData = {
  full_name: string
  age: number
  annual_income: number
  income_type: string
  monthly_take_home: number
  living_situation: string
  housing_status: string
  financial_goals: string
  money_habits: string
}

export async function completeOnboarding(data: OnboardingData) {
  const { userId } = await auth()
  if (!userId) throw new Error("Not authenticated")

  if (!data.full_name || !data.age || !data.annual_income || !data.monthly_take_home) {
    return { error: "Please fill in all required fields." }
  }

  // Extract first name for the "name" field (used by Aurora chat)
  const firstName = data.full_name.split(" ")[0]

  // Determine income_type mapping for Aurora's existing field
  const incomeTypeMap: Record<string, string> = {
    salary: "fixed",
    hourly: "fixed",
    gig: "variable",
    irregular: "variable",
    other: "variable",
  }

  const { data: existing } = await getSupabase()
    .from("user_profiles")
    .select("points")
    .eq("clerk_user_id", userId)
    .single()

  const currentPoints = (existing?.points as number) ?? 0

  const { error } = await getSupabase().from("user_profiles").upsert(
    {
      clerk_user_id: userId,
      name: firstName,
      full_name: data.full_name,
      age: data.age,
      annual_income: data.annual_income,
      income_type: incomeTypeMap[data.income_type] ?? "variable",
      monthly_income: data.monthly_take_home,
      monthly_take_home: data.monthly_take_home,
      living_situation: data.living_situation,
      housing_status: data.housing_status,
      financial_goals: data.financial_goals,
      money_habits: data.money_habits,
      // Don't set onboarded=true yet — Aurora chat still needs to collect
      // goal amount, deadline, and safety buffer (the Core 5 remaining items)
      onboarded: false,
      // Award 50 Financial Karma for completing the wizard
      points: currentPoints + 50,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clerk_user_id" }
  )

  if (error) {
    console.error("Supabase onboarding error:", error)
    return { error: "Something went wrong. Please try again." }
  }

  // Log the onboarding bonus to the points ledger
  await getSupabase().from("points_ledger").insert({
    clerk_user_id: userId,
    action: "onboarding_bonus",
    points: 50,
    description: "Completed onboarding wizard",
  })

  return { success: true }
}

export async function getProfile() {
  const { userId } = await auth()
  if (!userId) return null

  const { data } = await getSupabase()
    .from("user_profiles")
    .select("*")
    .eq("clerk_user_id", userId)
    .single()

  return data
}
