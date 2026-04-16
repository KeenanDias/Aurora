"use server"

import { auth } from "@clerk/nextjs/server"
import { getSupabase } from "@/lib/supabase"

export async function completeOnboarding(formData: FormData) {
  const { userId } = await auth()
  if (!userId) throw new Error("Not authenticated")

  const name = formData.get("name") as string
  const job = formData.get("job") as string
  const income = parseFloat(formData.get("income") as string)

  if (!name || !job || isNaN(income)) {
    return { error: "Please fill in all fields." }
  }

  const { error } = await getSupabase().from("user_profiles").upsert(
    {
      clerk_user_id: userId,
      name,
      job,
      monthly_income: income,
      onboarded: false, // Full onboarding happens through Aurora chat (Core 5)
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clerk_user_id" }
  )

  if (error) {
    console.error("Supabase onboarding error:", error)
    return { error: "Something went wrong. Please try again." }
  }

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
