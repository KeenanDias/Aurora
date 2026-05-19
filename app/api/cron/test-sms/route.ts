import { NextResponse } from "next/server"
import { sendSMS } from "@/lib/twilio"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const to = new URL(req.url).searchParams.get("to")
  if (!to) {
    return NextResponse.json({ error: "Missing ?to=+1XXXXXXXXXX" }, { status: 400 })
  }

  const result = await sendSMS(
    to,
    "Hey! This is Aurora, your financial coach. Just testing that SMS nudges are working. You're all set!"
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "send failed" }, { status: 500 })
  }
  return NextResponse.json({ success: true, messageSid: result.messageSid, skipped: result.skipped })
}
