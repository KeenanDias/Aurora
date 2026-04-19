import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { plaidClient } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase"

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch existing access token
  const { data: profile } = await getSupabase()
    .from("user_profiles")
    .select("plaid_access_token")
    .eq("clerk_user_id", userId)
    .single()

  // Remove the item from Plaid if we have a token
  if (profile?.plaid_access_token) {
    try {
      await plaidClient.itemRemove({
        access_token: profile.plaid_access_token,
      })
    } catch {
      // Item may already be removed on Plaid's side — continue cleanup
    }
  }

  // Clear Plaid data from the user profile
  const { error } = await getSupabase()
    .from("user_profiles")
    .update({
      plaid_access_token: null,
      plaid_item_id: null,
      bank_linked: false,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_user_id", userId)

  if (error) {
    console.error("Supabase unlink error:", error)
    return NextResponse.json({ error: "Failed to unlink bank" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
