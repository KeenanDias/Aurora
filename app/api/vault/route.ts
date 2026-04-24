import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch all vault uploads for this user (without the encrypted blob)
  const { data: uploads, error } = await getSupabase()
    .from("vault_uploads")
    .select("id, filename, period_start, period_end, total_income, total_spending, fixed_bills, transaction_count, source, last_accessed, created_at")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("Vault fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch vault data" }, { status: 500 })
  }

  // Also check if Plaid is connected
  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("bank_linked, plaid_access_token")
    .eq("clerk_user_id", userId)
    .single()

  const plaidConnected = !!(profile?.bank_linked && profile?.plaid_access_token)

  return NextResponse.json({
    uploads: uploads ?? [],
    plaidConnected,
  })
}
