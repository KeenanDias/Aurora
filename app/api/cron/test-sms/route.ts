import { NextResponse } from "next/server"
import { sendSMS } from "@/lib/twilio"

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const to = new URL(req.url).searchParams.get("to")
  if (!to) {
    return NextResponse.json({ error: "Missing ?to=+1XXXXXXXXXX" }, { status: 400 })
  }

  try {
    const result = await sendSMS(to, "Hey! This is Aurora, your financial coach. Just testing that SMS nudges are working. You're all set!")
    return NextResponse.json({ success: true, sid: result.sid })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("SMS test error:", e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
