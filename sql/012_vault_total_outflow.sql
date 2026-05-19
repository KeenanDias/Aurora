-- ============================================================
-- Migration 012: Vault outflow tracking
-- ============================================================
-- Adds the raw "Total Money Out" figure parsed from each uploaded
-- statement. This matches what a user reads off their paper bank
-- document — the absolute sum of every debit, withdrawal, transfer
-- out, fee, and payment during the statement period.
--
-- Also stores opening_balance so we can fall back to balance
-- arithmetic (opening + income - closing) when the AI can't find
-- an explicit "Total Debits" line.

ALTER TABLE vault_uploads
  ADD COLUMN IF NOT EXISTS total_outflow   NUMERIC(14, 2),
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14, 2);

NOTIFY pgrst, 'reload schema';
