import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * Persist scripted-onboarding answers and flip onboarded=true.
 *
 * Update-if-exists, insert-otherwise — same pattern as executeSaveProfile in
 * app/api/chat/route.ts. Avoids the upsert NOT-NULL trap on user_profiles.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const incomeTypeMap: Record<string, string> = {
    salary: "fixed",
    hourly: "fixed",
    gig: "variable",
    irregular: "variable",
    other: "variable",
  }

  // Whitelist + light coercion. All optional — only set what was provided.
  const fields: Record<string, unknown> = {}
  if (typeof body.name === "string" && body.name.trim()) fields.name = body.name.trim()
  if (typeof body.full_name === "string" && body.full_name.trim()) fields.full_name = body.full_name.trim()
  if (typeof body.age === "number" && body.age > 0) fields.age = body.age
  if (typeof body.job === "string" && body.job.trim()) fields.job = body.job.trim()
  if (typeof body.income_type === "string") {
    fields.income_type_raw = body.income_type
    fields.income_type = incomeTypeMap[body.income_type] ?? "variable"
  }
  if (typeof body.annual_income === "number" && body.annual_income > 0) fields.annual_income = body.annual_income
  if (typeof body.monthly_take_home === "number" && body.monthly_take_home > 0) {
    fields.monthly_take_home = body.monthly_take_home
    fields.monthly_income = body.monthly_take_home
  }
  if (typeof body.living_situation === "string") fields.living_situation = body.living_situation
  if (typeof body.housing_status === "string") fields.housing_status = body.housing_status
  if (typeof body.household_type === "string") fields.household_type = body.household_type
  if (typeof body.goal_description === "string" && body.goal_description.trim())
    fields.goal_description = body.goal_description.trim()
  if (typeof body.goal_amount === "number" && body.goal_amount > 0) fields.goal_amount = body.goal_amount
  if (typeof body.goal_deadline === "string" && body.goal_deadline) fields.goal_deadline = body.goal_deadline
  if (typeof body.safety_buffer === "number" && body.safety_buffer >= 0) fields.safety_buffer = body.safety_buffer
  if (typeof body.buffer_type === "string") fields.buffer_type = body.buffer_type
  if (typeof body.tax_withholding === "boolean") fields.tax_withholding = body.tax_withholding
  if (typeof body.money_habits === "string") fields.money_habits = body.money_habits
  if (typeof body.phone_number === "string" && body.phone_number.trim()) fields.phone_number = body.phone_number.trim()

  fields.onboarded = true
  fields.updated_at = new Date().toISOString()

  const supabase = getSupabase()

  const { data: existing, error: lookupError } = await supabase
    .from("user_profiles")
    .select("clerk_user_id, points")
    .eq("clerk_user_id", userId)
    .maybeSingle()

  if (lookupError && lookupError.code !== "PGRST116") {
    console.error("user_profiles lookup error:", lookupError)
    return NextResponse.json({ error: lookupError.message }, { status: 500 })
  }

  // 50-Karma onboarding bonus, only on the first completion.
  const currentPoints = (existing?.points as number | undefined) ?? 0
  fields.points = currentPoints + 50

  // Drop any column that PostgREST says doesn't exist, retry up to 6 times.
  // Same self-healing pattern as the vault-upload route.
  let working: Record<string, unknown> = { ...fields }
  let error: { code?: string; message: string } | null = null
  const dropped: string[] = []

  for (let attempt = 0; attempt < 6; attempt++) {
    const op = existing
      ? supabase.from("user_profiles").update(working).eq("clerk_user_id", userId)
      : supabase.from("user_profiles").insert({ clerk_user_id: userId, ...working })
    const { error: e } = await op
    error = e
    if (!error) break

    const missing = error.message?.match(/Could not find the '([^']+)' column/i)?.[1]
    if (missing && missing in working) {
      dropped.push(missing)
      delete working[missing]
      continue
    }
    break
  }

  if (dropped.length > 0) {
    console.warn(
      `onboarding/complete dropped missing columns: ${dropped.join(", ")}. Add them via SQL migration when convenient.`
    )
  }

  if (error) {
    console.error("onboarding/complete save error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Best-effort points-ledger entry. Don't fail the response if it errors.
  try {
    await supabase.from("points_ledger").insert({
      clerk_user_id: userId,
      action: "onboarding_bonus",
      points: 50,
      description: "Completed scripted KYC onboarding",
    })
  } catch {
    // ignore
  }

  return NextResponse.json({ success: true })
}
