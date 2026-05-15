-- ============================================================
-- Migration 007: Sync vault_uploads schema with current code
-- ============================================================
-- Adds columns the upload route writes but that may be missing on
-- older Supabase databases (PGRST204 "column not found" errors).
-- All ADDs are idempotent.

ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS closing_balance       NUMERIC(14, 2);
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS institution_name       TEXT;
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS account_mask           TEXT;
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS account_holder_name    TEXT;
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS transit_number         TEXT;
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS institution_number     TEXT;
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS verification_status    TEXT DEFAULT 'pending';
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS verification_details   TEXT;
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS transactions_json      TEXT;
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS transaction_count      INTEGER DEFAULT 0;
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS source                 TEXT DEFAULT 'manual_upload';
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS last_accessed          TIMESTAMPTZ;
ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS key_version            INTEGER NOT NULL DEFAULT 1;

-- Refresh PostgREST's schema cache so new columns are picked up immediately.
NOTIFY pgrst, 'reload schema';
