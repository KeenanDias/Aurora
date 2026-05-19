import { Resend } from "resend"
import { getSupabase } from "@/lib/supabase"

/**
 * Production transactional email engine.
 *
 * Configuration (set via Cloudflare env / .env.local):
 *   RESEND_API_KEY   — required in production (sandbox API key fine in dev)
 *   EMAIL_FROM       — required. Must use a verified Resend domain in production.
 *                      Example: "Aurora <hi@youraurora.com>". The onboarding@resend.dev
 *                      fallback is intentionally NOT used as a default — it would
 *                      limit delivery to the developer's own inbox in sandbox mode.
 *
 * Failure handling: every send wraps the call. On error we:
 *   1. Log a redacted line to the server console.
 *   2. Persist a row to `email_errors` (Supabase) for ops visibility.
 *   3. Return { ok: false } to the caller — never throws, never crashes the
 *      route handler that triggered the email.
 */

type EmailResult = { ok: boolean; error?: string }

function resolveFromAddress(): { from: string | null; reason?: string } {
  const from = process.env.EMAIL_FROM?.trim()
  if (!from) return { from: null, reason: "EMAIL_FROM env var is not set" }
  // Quick sanity check — block obvious typo or trailing-whitespace cases.
  if (!/<[^>]+@[^>]+>/.test(from) && !/^[^@\s]+@[^@\s]+$/.test(from)) {
    return { from: null, reason: `EMAIL_FROM "${from}" doesn't look like a valid sender address` }
  }
  return { from }
}

async function recordFailure(stage: string, to: string, message: string) {
  try {
    await getSupabase().from("email_errors").insert({
      stage,
      recipient: to,
      error_message: message.slice(0, 500),
    })
  } catch {
    // If even the Supabase insert fails, don't cascade — just console it.
    console.error(`[email] failed to record failure to Supabase (${stage} → ${to}): ${message}`)
  }
}

async function sendEmail(params: {
  stage: string
  to: string
  subject: string
  html: string
  text: string
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const { from, reason } = resolveFromAddress()

  if (!apiKey) {
    const msg = "RESEND_API_KEY missing — email skipped (dev mode)"
    console.warn(`[email] ${msg}:`, { to: params.to, subject: params.subject })
    return { ok: true }
  }

  if (!from) {
    const msg = reason ?? "EMAIL_FROM missing"
    console.error(`[email] ${msg}`)
    await recordFailure(params.stage, params.to, msg)
    return { ok: false, error: msg }
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
    if (error) {
      console.error(`[email] resend error (${params.stage}):`, error.message)
      await recordFailure(params.stage, params.to, error.message)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown email error"
    console.error(`[email] send threw (${params.stage}):`, msg)
    await recordFailure(params.stage, params.to, msg)
    return { ok: false, error: msg }
  }
}

export async function sendApprovalEmail(params: {
  to: string
  name: string
  signInUrl: string
}): Promise<EmailResult> {
  return sendEmail({
    stage: "approval",
    to: params.to,
    subject: "You're in! Welcome to the Aurora beta",
    html: approvalEmailHtml(params.name, params.signInUrl),
    text: approvalEmailText(params.name, params.signInUrl),
  })
}

export async function sendDenialEmail(params: {
  to: string
  name: string
}): Promise<EmailResult> {
  const html = `<p>Hi ${escapeHtml(params.name)},</p><p>Thanks so much for your interest in the Aurora beta. Unfortunately, we aren't able to give you access at this time. We'll keep your details on file and reach out if anything changes.</p><p>— The Aurora team</p>`
  const text = `Hi ${params.name},\n\nThanks for your interest in the Aurora beta. Unfortunately, we aren't able to give you access at this time. We'll keep your details on file and reach out if anything changes.\n\n— The Aurora team`
  return sendEmail({
    stage: "denial",
    to: params.to,
    subject: "An update on your Aurora early access request",
    html,
    text,
  })
}

function approvalEmailHtml(name: string, signInUrl: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0f172a;">
      <div style="background: linear-gradient(135deg, #34d399, #2dd4bf, #818cf8); padding: 1px; border-radius: 16px;">
        <div style="background: white; border-radius: 15px; padding: 32px;">
          <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 700;">You're in! 🎉</h1>
          <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.6;">
            Hi ${escapeHtml(name)},
          </p>
          <p style="margin: 0 0 16px; color: #475569; font-size: 15px; line-height: 1.6;">
            Welcome to the Aurora beta. Your access has been approved — you can now sign in
            and start using your AI financial coach.
          </p>
          <a href="${signInUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: linear-gradient(135deg, #34d399, #2dd4bf, #8b5cf6); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
            Sign in to Aurora
          </a>
          <p style="margin: 24px 0 0; color: #64748b; font-size: 13px; line-height: 1.6;">
            We'd love your feedback as you use it. Reply to this email anytime with thoughts,
            bugs, or feature ideas — we read every one.
          </p>
        </div>
      </div>
      <p style="margin: 16px 0 0; color: #94a3b8; font-size: 12px; text-align: center;">
        — The Aurora team
      </p>
    </div>
  `
}

function approvalEmailText(name: string, signInUrl: string) {
  return `Hi ${name},

You're in! Welcome to the Aurora beta. Your access has been approved — sign in and start using your AI financial coach:

${signInUrl}

We'd love your feedback as you use it. Reply to this email anytime with thoughts, bugs, or feature ideas.

— The Aurora team`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!))
}
