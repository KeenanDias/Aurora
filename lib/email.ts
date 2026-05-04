import { Resend } from "resend"

/**
 * Send approval email via Resend. If RESEND_API_KEY is unset, logs to console
 * and returns success — so local dev / preview deployments don't blow up.
 *
 * Setup: https://resend.com → grab API key → set RESEND_API_KEY + EMAIL_FROM
 *   EMAIL_FROM should be "Aurora <noreply@yourdomain.com>" once you verify a domain,
 *   or "onboarding@resend.dev" for testing without domain setup.
 */
export async function sendApprovalEmail(params: {
  to: string
  name: string
  signInUrl: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? "Aurora <onboarding@resend.dev>"

  const subject = "You're in! Welcome to the Aurora beta"
  const html = approvalEmailHtml(params.name, params.signInUrl)
  const text = approvalEmailText(params.name, params.signInUrl)

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — would have sent:", { to: params.to, subject })
    return { ok: true }
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from,
      to: params.to,
      subject,
      html,
      text,
    })
    if (error) {
      console.error("[email] resend error:", error)
      return { ok: false, error: error.message }
    }
    return { ok: true }
  } catch (err) {
    console.error("[email] send threw:", err)
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error" }
  }
}

export async function sendDenialEmail(params: {
  to: string
  name: string
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM ?? "Aurora <onboarding@resend.dev>"

  const subject = "An update on your Aurora early access request"
  const html = `<p>Hi ${escapeHtml(params.name)},</p><p>Thanks so much for your interest in the Aurora beta. Unfortunately, we aren't able to give you access at this time. We'll keep your details on file and reach out if anything changes.</p><p>— The Aurora team</p>`
  const text = `Hi ${params.name},\n\nThanks for your interest in the Aurora beta. Unfortunately, we aren't able to give you access at this time. We'll keep your details on file and reach out if anything changes.\n\n— The Aurora team`

  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — would have sent denial:", { to: params.to })
    return { ok: true }
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({ from, to: params.to, subject, html, text })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown email error" }
  }
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
