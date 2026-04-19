import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { plaidClient } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase"

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { public_token } = await req.json()

  // Exchange for permanent access token
  const response = await plaidClient.itemPublicTokenExchange({
    public_token,
  })

  const { access_token, item_id } = response.data

  // Save to user profile
  const { error } = await getSupabase()
    .from("user_profiles")
    .update({
      plaid_access_token: access_token,
      plaid_item_id: item_id,
      bank_linked: true,
      updated_at: new Date().toISOString(),
    })
    .eq("clerk_user_id", userId)

  if (error) {
    console.error("Supabase Plaid save error:", error)
    return NextResponse.json(
      { error: "Failed to save bank connection" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
