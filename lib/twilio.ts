import twilio from "twilio"

// Lazy-init so the Twilio client is constructed at request time, not at
// module load. Build-time page-data collection would otherwise crash
// because env vars aren't injected during `next build`.
let _client: ReturnType<typeof twilio> | null = null
function getClient() {
  if (_client) return _client
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!accountSid || !authToken) {
    throw new Error("Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN env var")
  }
  _client = twilio(accountSid, authToken)
  return _client
}

export async function sendSMS(to: string, body: string) {
  return getClient().messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER,
    to,
  })
}
