import { auth } from "@clerk/nextjs/server"
import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"

/**
 * Manual transaction insert. Powers the chat → dashboard sync loop.
 *
 * Used when a user tells the chatbot "I just spent $50 on groceries" — Aurora
 * calls this via the report_spending tool so the dashboard shows the spend
 * immediately instead of waiting for a Plaid sync.
 *
 * POST body:
 *   { amount: number, category?: string, description?: string, occurred_at?: string }
 *
 * Returns the inserted row id + the running spent_today total.
 */

const VALID_CATEGORIES = new Set([
  "FOOD_AND_DRINK",
  "RENT_AND_UTILITIES",
  "TRANSPORTATION",
  "SHOPPING",
  "ENTERTAINMENT",
  "RECREATION",
  "GENERAL_MERCHANDISE",
  "PERSONAL_CARE",
  "GENERAL_SERVICES",
  "INSURANCE",
  "OTHER",
])

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: {
    amount?: number
    category?: string
    description?: string
    occurred_at?: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000) {
    return NextResponse.json({ error: "Amount must be a positive number under $100,000." }, { status: 400 })
  }

  const category = body.category && VALID_CATEGORIES.has(body.category) ? body.category : "OTHER"
  const description = (body.description ?? "").toString().slice(0, 200)

  const occurredAt = body.occurred_at ? new Date(body.occurred_at) : new Date()
  if (isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "Invalid occurred_at date." }, { status: 400 })
  }

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from("manual_transactions")
    .insert({
      clerk_user_id: userId,
      amount,
      category,
      description: description || null,
      occurred_at: occurredAt.toISOString(),
    })
    .select("id, amount, category, description, occurred_at, created_at")
    .single()

  if (error) {
    console.error("manual_transactions insert error:", error)
    return NextResponse.json({ error: "Failed to record transaction." }, { status: 500 })
  }

  // Best-effort tally for the day so the chatbot can confirm with context
  let spentToday = amount
  try {
    const startOfDay = new Date(occurredAt)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(occurredAt)
    endOfDay.setHours(23, 59, 59, 999)

    const { data: dayRows } = await supabase
      .from("manual_transactions")
      .select("amount")
      .eq("clerk_user_id", userId)
      .gte("occurred_at", startOfDay.toISOString())
      .lte("occurred_at", endOfDay.toISOString())

    if (dayRows) spentToday = dayRows.reduce((s, r) => s + Number(r.amount), 0)
  } catch {
    // non-fatal — we already inserted
  }

  return NextResponse.json({
    success: true,
    transaction: data,
    spentToday: Math.round(spentToday * 100) / 100,
  })
}
