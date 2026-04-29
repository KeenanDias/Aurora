-- ============================================================
-- Migration 003: Goal State Machine, Points System, Escrow
-- ============================================================

-- Goal state machine: active → completed → paused
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS goal_status TEXT DEFAULT 'active' CHECK (goal_status IN ('active', 'completed', 'paused'));

-- Points system: streaks and detailed tracking
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS points_streak INTEGER DEFAULT 0,        -- consecutive days on budget
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0,       -- all-time best streak
  ADD COLUMN IF NOT EXISTS last_points_date DATE;                  -- prevent double-awarding

-- Upcoming/recurring bills for escrow logic
CREATE TABLE IF NOT EXISTS recurring_bills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL REFERENCES user_profiles(clerk_user_id),
  name TEXT NOT NULL,                          -- "Rent", "Car Insurance", etc.
  amount NUMERIC(10,2) NOT NULL,
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),  -- day of month
  category TEXT DEFAULT 'FIXED',               -- RENT, INSURANCE, UTILITIES, LOAN, SUBSCRIPTION, OTHER
  source TEXT DEFAULT 'manual',                -- 'manual' (user told Aurora), 'plaid' (detected), 'statement' (parsed)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookup during cron + dashboard
CREATE INDEX IF NOT EXISTS idx_recurring_bills_user ON recurring_bills(clerk_user_id) WHERE is_active = true;

-- Points ledger for audit trail (optional but useful)
CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clerk_user_id TEXT NOT NULL REFERENCES user_profiles(clerk_user_id),
  action TEXT NOT NULL,                        -- 'daily_discipline', 'weekly_streak', 'goal_milestone', 'link_bonus', 'rainy_day'
  points INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger(clerk_user_id);
