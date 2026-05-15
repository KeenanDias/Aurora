-- ============================================================
-- Migration 011: Plaid-verified goal contributions
-- ============================================================
-- Each "I saved $X" claim now writes a row here, then the
-- verification engine (lib/verify-savings.ts) attempts to match it
-- against actual Plaid cash movement. Karma streaks only count
-- contributions that reach verification_status = 'verified'.
--
-- Flow:
--   pending   → just claimed; verifier hasn't found a match yet
--   verified  → Plaid showed a checking→savings transfer OR net
--               balance grew by at least 90% of the claim
--   unverified → 48h passed and we still can't confirm; goal
--                progress kept but no Karma awarded

CREATE TABLE IF NOT EXISTS goal_contributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id             UUID NOT NULL,           -- references goals(id) but no FK so legacy "primary" works
  clerk_user_id       TEXT NOT NULL,
  amount              NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  verification_status TEXT NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN ('pending', 'verified', 'unverified', 'probable')),
  verification_method TEXT,                    -- 'transfer_match' | 'balance_growth' | null
  -- Snawshot of total liquid balance (sum of depository available) at
  -- the moment of the claim. Used for the Option-1 fallback comparison
  -- against the next claim.
  balance_at_claim    NUMERIC(14, 2),
  observed_growth     NUMERIC(14, 2),          -- net balance growth since last claim
  matched_transfer_id TEXT,                    -- Plaid transaction id when method = transfer_match
  notes               TEXT,
  karma_awarded       BOOLEAN NOT NULL DEFAULT false,
  claimed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goal_contributions_goal_claimed
  ON goal_contributions (goal_id, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_goal_contributions_user_status
  ON goal_contributions (clerk_user_id, verification_status, claimed_at DESC);

NOTIFY pgrst, 'reload schema';
