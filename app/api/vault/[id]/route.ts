import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await getSupabase()
    .from("vault_uploads")
    .select("id, filename, period_start, period_end, total_income, total_spending, fixed_bills, transaction_count, transactions_json, last_accessed, created_at")
    .eq("id", id)
    .eq("clerk_user_id", userId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Update last_accessed timestamp (security ledger)
  await getSupabase()
    .from("vault_uploads")
    .update({ last_accessed: new Date().toISOString() })
    .eq("id", id)

  return NextResponse.json({
    ...data,
    transactions: data.transactions_json ? JSON.parse(data.transactions_json) : [],
    transactions_json: undefined,
  })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const { error } = await getSupabase()
    .from("vault_uploads")
    .delete()
    .eq("id", id)
    .eq("clerk_user_id", userId)

  if (error) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
