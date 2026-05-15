-- ============================================================
-- Migration 010: Active Enrollment for multi-goal STS
-- ============================================================
-- Lets users opt any goal into the daily Safe-to-Spend math.
-- Without this flag, only the legacy primary goal bit into STS.
--
-- Default: false (tracking-only) so existing goals don't suddenly
-- start carving out daily allowance without the user opting in.
-- The exception is the primary goal, which is auto-enrolled to
-- preserve the existing behavior.

ALTER TABLE goals
  ADD COLUMN IF NOT EXISTS is_enrolled BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing primary goal becomes enrolled by default.
UPDATE goals
   SET is_enrolled = true
 WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_goals_user_enrolled
  ON goals (clerk_user_id) WHERE is_enrolled = true;

NOTIFY pgrst, 'reload schema';
