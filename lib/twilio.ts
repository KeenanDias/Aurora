import twilio from "twilio"
import { getSupabase } from "@/lib/supabase"

/**
 * Production SMS engine.
 *
 * Configuration (set in Render dashboard → Environment):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER  — e.g. "+14165551234" (E.164 format)
 *
 * Failure handling: every send wraps the call. On error we:
 *   1. Log a redacted line to the server console.
 *   2. Persist a row to `sms_errors` (Supabase) for ops visibility.
 *   3. Return { ok: false } to the caller — never throws.
 *
 * In dev mode (any env var missing) we no-op and return { ok: true,
 * skipped: true } so local runs don't crash.
 */

export type SmsResult = {
  ok: boolean
  skipped?: boolean
  messageSid?: string
  error?: string
}

let _client: ReturnType<typeof twilio> | null = null

function getClient() {
  if (_client) return _client
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) return null
  _client = twilio(accountSid, authToken)
  return _client
}

async function recordFailure(to: string, message: string) {
  try {
    // Mask everything but the last 4 digits of the recipient before logging
    const masked = to.length > 4 ? `${"*".repeat(to.length - 4)}${to.slice(-4)}` : to
    await getSupabase().from("sms_errors").insert({
      recipient_mask: masked,
      error_message: message.slice(0, 500),
    })
  } catch {
    console.error(`[sms] failed to record failure to Supabase: ${message}`)
  }
}

export async function sendSMS(to: string, body: string): Promise<SmsResult> {
  // Up-front config sanity
  if (!to || !body) {
    return { ok: false, error: "Missing recipient or body" }
  }

  const client = getClient()
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!client || !from) {
    console.warn("[sms] Twilio env not configured — message skipped (dev mode):", {
      to: to.slice(-4),
      length: body.length,
    })
    return { ok: true, skipped: true }
  }

  try {
    const msg = await client.messages.create({ body, from, to })
    return { ok: true, messageSid: msg.sid }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Twilio error"
    console.error(`[sms] send failed to ${to.slice(-4)}: ${message}`)
    await recordFailure(to, message)
    return { ok: false, error: message }
  }
}
