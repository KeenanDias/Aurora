import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch all vault uploads for this user (without the encrypted blob).
  // Try with the new outflow columns first; fall back if migration 012
  // hasn't been applied yet.
  const supabase = getSupabase()
  const initial = await supabase
    .from("vault_uploads")
    .select(
      "id, filename, period_start, period_end, total_income, total_spending, total_outflow, fixed_bills, opening_balance, closing_balance, transaction_count, source, last_accessed, created_at"
    )
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: false })

  let uploads: Record<string, unknown>[] | null = initial.data
  let error = initial.error

  if (error && /total_outflow|opening_balance|closing_balance/.test(error.message ?? "")) {
    const fallback = await supabase
      .from("vault_uploads")
      .select(
        "id, filename, period_start, period_end, total_income, total_spending, fixed_bills, transaction_count, source, last_accessed, created_at"
      )
      .eq("clerk_user_id", userId)
      .order("created_at", { ascending: false })
    uploads = fallback.data
    error = fallback.error
  }

  if (error) {
    console.error("Vault fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch vault data" }, { status: 500 })
  }

  // Implicit fallback for rows from before migration 012 (or where the AI
  // couldn't extract an explicit total). Per the user's spec:
  //   TotalOutflow = Opening - Closing - Income  (rearranged to positive form)
  const enriched = (uploads ?? []).map((u) => {
    const o = u as Record<string, unknown>
    const totalOutflow = o.total_outflow
    if (totalOutflow == null) {
      const opening = typeof o.opening_balance === "number" ? o.opening_balance : null
      const closing = typeof o.closing_balance === "number" ? o.closing_balance : null
      const income = typeof o.total_income === "number" ? o.total_income : 0
      const spending = typeof o.total_spending === "number" ? o.total_spending : 0
      const derived =
        opening != null && closing != null
          ? Math.max(0, opening + income - closing)
          : spending // last-resort: best signal we have
      return { ...o, total_outflow: Math.round(derived * 100) / 100, derived_outflow: true }
    }
    return o
  })

  // Also check if Plaid is connected
  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("bank_linked, plaid_access_token")
    .eq("clerk_user_id", userId)
    .single()

  const plaidConnected = !!(profile?.bank_linked && profile?.plaid_access_token)

  return NextResponse.json({
    uploads: enriched,
    plaidConnected,
  })
}
