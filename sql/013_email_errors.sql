-- ============================================================
-- Migration 013: Email delivery diagnostics
-- ============================================================
-- Captures every Resend failure (auth error, invalid recipient,
-- domain not verified, rate-limit, etc.) so production email issues
-- are visible in the database without grepping container logs.
--
-- Inserts are best-effort: lib/email.ts catches its own errors when
-- writing here so a Supabase outage can't cascade-break the calling
-- request.

CREATE TABLE IF NOT EXISTS email_errors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage           TEXT NOT NULL,        -- 'approval' | 'denial' | future stages
  recipient       TEXT NOT NULL,        -- email address we tried to send to
  error_message   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_errors_created
  ON email_errors (created_at DESC);

-- Same pattern for SMS — Twilio failures land here so we can spot
-- delivery issues without grepping container logs.
CREATE TABLE IF NOT EXISTS sms_errors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_mask  TEXT NOT NULL,        -- last 4 digits only
  error_message   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_errors_created
  ON sms_errors (created_at DESC);

-- ── Predictive nudge dedup ──────────────────────────────────────────
-- The daily-nudge cron sets this when it fires a predictive SMS so the
-- user doesn't get the same warning every morning until their velocity
-- drops below the overspend threshold.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS last_predictive_nudge_date DATE;

NOTIFY pgrst, 'reload schema';
