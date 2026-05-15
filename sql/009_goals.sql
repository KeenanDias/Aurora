-- ============================================================
-- Migration 009: Multi-goal support
-- ============================================================
-- Lets users line up multiple savings goals from the dashboard.
--
-- Note: the existing single-goal columns on user_profiles
-- (goal_description, goal_amount, goal_deadline, goal_saved, goal_status)
-- still drive Safe-to-Spend math and act as the "primary" goal. This
-- table holds all goals (including a copy of the primary so the dashboard
-- can render them in one list).

CREATE TABLE IF NOT EXISTS goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id   TEXT NOT NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  saved           NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (saved >= 0),
  deadline        DATE,
  emoji           TEXT,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_user_created
  ON goals (clerk_user_id, created_at DESC);

NOTIFY pgrst, 'reload schema';
