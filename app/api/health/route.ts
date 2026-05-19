import { NextRequest, NextResponse } from "next/server"
import { getSupabase } from "@/lib/supabase"
import { sendSMS } from "@/lib/twilio"
import { sendApprovalEmail } from "@/lib/email"

/**
 * GET /api/health
 *   Reports configuration status for Supabase, Plaid, OpenAI, Resend, Twilio,
 *   Clerk, and the vault encryption key. No external network calls — just
 *   checks env vars and that lib clients can initialize. Safe to hit from a
 *   browser. Auth-gated by CRON_SECRET so randos can't enumerate your config.
 *
 * GET /api/health?send=email&to=you@example.com
 *   Sends a REAL test approval email to the given address. Use sparingly.
 *
 * GET /api/health?send=sms&to=+14165551234
 *   Sends a REAL test SMS to the given E.164 number. Use sparingly.
 */
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

type CheckResult = { ok: boolean; message: string; detail?: string }

function present(name: string): CheckResult {
  const v = process.env[name]
  if (!v || v.trim() === "") return { ok: false, message: `${name} is not set` }
  return { ok: true, message: `${name} configured`, detail: `length=${v.length}` }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const secret = process.env.CRON_SECRET
  if (!secret || auth !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // ── Live-send branches (use sparingly) ─────────────────────────────
  const sendKind = url.searchParams.get("send")
  const to = url.searchParams.get("to") ?? ""

  if (sendKind === "email") {
    if (!to.includes("@")) return NextResponse.json({ error: "missing ?to=valid@email" }, { status: 400 })
    const result = await sendApprovalEmail({
      to,
      name: "Aurora Health Check",
      signInUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com",
    })
    return NextResponse.json({ kind: "email", to, result })
  }
  if (sendKind === "sms") {
    if (!/^\+\d{10,}/.test(to)) return NextResponse.json({ error: "missing ?to=+E164number" }, { status: 400 })
    const result = await sendSMS(to, "Aurora health check ✅ — your Twilio config is live.")
    return NextResponse.json({ kind: "sms", to: to.slice(-4), result })
  }

  // ── Config check ────────────────────────────────────────────────────
  const checks: Record<string, CheckResult> = {
    NEXT_PUBLIC_APP_URL: present("NEXT_PUBLIC_APP_URL"),
    NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
    CLERK_SECRET_KEY: present("CLERK_SECRET_KEY"),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: present("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
    OPENAI_API_KEY: present("OPENAI_API_KEY"),
    PLAID_CLIENT_ID: present("PLAID_CLIENT_ID"),
    PLAID_SECRET: present("PLAID_SECRET"),
    PLAID_ENV: present("PLAID_ENV"),
    RESEND_API_KEY: present("RESEND_API_KEY"),
    EMAIL_FROM: present("EMAIL_FROM"),
    TWILIO_ACCOUNT_SID: present("TWILIO_ACCOUNT_SID"),
    TWILIO_AUTH_TOKEN: present("TWILIO_AUTH_TOKEN"),
    TWILIO_PHONE_NUMBER: present("TWILIO_PHONE_NUMBER"),
    VAULT_ENCRYPTION_KEY_V1: present("VAULT_ENCRYPTION_KEY_V1"),
    CRON_SECRET: present("CRON_SECRET"),
  }

  // Validate EMAIL_FROM shape (won't catch unverified domain, but flags typos)
  const from = process.env.EMAIL_FROM?.trim() ?? ""
  if (from && !/<[^>]+@[^>]+>/.test(from) && !/^[^@\s]+@[^@\s]+$/.test(from)) {
    checks.EMAIL_FROM = { ok: false, message: `EMAIL_FROM has invalid shape: "${from}"` }
  }

  // Validate TWILIO_PHONE_NUMBER E.164 shape
  const twilioNum = process.env.TWILIO_PHONE_NUMBER?.trim() ?? ""
  if (twilioNum && !/^\+\d{10,15}$/.test(twilioNum)) {
    checks.TWILIO_PHONE_NUMBER = {
      ok: false,
      message: `TWILIO_PHONE_NUMBER must be E.164 (e.g. +14165551234), got: "${twilioNum}"`,
    }
  }

  // Quick Supabase ping — confirm the service role key actually works
  let supabaseLive = false
  try {
    const { error } = await getSupabase().from("user_profiles").select("clerk_user_id").limit(1)
    supabaseLive = !error
  } catch {
    supabaseLive = false
  }

  const allOk = Object.values(checks).every((c) => c.ok) && supabaseLive

  return NextResponse.json({
    ok: allOk,
    env: process.env.NODE_ENV,
    plaidEnv: process.env.PLAID_ENV,
    supabaseLive,
    checks,
    hints: {
      sendEmailTest: "GET /api/health?send=email&to=you@example.com (with Authorization: Bearer CRON_SECRET)",
      sendSmsTest: "GET /api/health?send=sms&to=+14165551234 (with Authorization: Bearer CRON_SECRET)",
    },
  })
}
