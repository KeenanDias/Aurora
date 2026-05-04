-- ============================================================
-- Migration 006: Encryption key versioning + manual transactions
-- ============================================================
-- Apply via Supabase SQL editor or psql.

-- ── Vault: per-row encryption key version ───────────────────────────
-- Allows VAULT_ENCRYPTION_KEY rotation without invalidating old data.
-- Existing rows default to v1 (the first/legacy key).
ALTER TABLE vault_uploads
  ADD COLUMN IF NOT EXISTS key_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_vault_uploads_key_version
  ON vault_uploads (key_version);

-- ── Manual transactions ─────────────────────────────────────────────
-- Captures spending the user reports through the chatbot ("I just spent
-- $50 on dinner"). Powers the chat → dashboard sync loop so the daily
-- limit reflects the spend immediately, before the next Plaid sync.
CREATE TABLE IF NOT EXISTS manual_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   TEXT NOT NULL,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0 AND amount < 100000),
  category        TEXT NOT NULL DEFAULT 'OTHER',
  description     TEXT,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source          TEXT NOT NULL DEFAULT 'chat',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_tx_user_occurred
  ON manual_transactions (clerk_user_id, occurred_at DESC);
