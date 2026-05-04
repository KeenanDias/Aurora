-- ============================================================
-- Migration 005: Beta Access Control
-- ============================================================
-- Pre-signup waitlist + per-user access status for the closed beta.
--
-- Flow:
--   1. Visitor submits name + email on landing page → row created in access_requests (status='pending')
--   2. Admin reviews in /admin dashboard → updates status to 'approved' or 'denied'
--   3. When user signs up via Clerk, user_profiles.access_status mirrors access_requests.status
--      (or stays 'pending' if no waitlist match)
--   4. Approved users get full app access; everyone else hits /pending-approval
-- ============================================================

CREATE TABLE IF NOT EXISTS access_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  source TEXT DEFAULT 'landing',  -- 'landing' (form), 'manual' (admin added), 'signup' (created by signup hook)
  notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decided_by TEXT,                  -- admin email who made the call
  notified_at TIMESTAMPTZ           -- when approval email was sent
);

CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(LOWER(email));

-- Mirror access status onto user_profiles for fast gating checks
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS access_status TEXT DEFAULT 'pending'
    CHECK (access_status IN ('pending', 'approved', 'denied'));

-- Index for the gating lookup that runs on every dashboard hit
CREATE INDEX IF NOT EXISTS idx_user_profiles_access_status ON user_profiles(access_status);
