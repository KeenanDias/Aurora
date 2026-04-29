-- ============================================================
-- Migration 004: KYC Onboarding Fields
-- ============================================================

-- Extended identity / KYC fields for the onboarding wizard
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS age INTEGER,
  ADD COLUMN IF NOT EXISTS annual_income NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS monthly_take_home NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS living_situation TEXT CHECK (living_situation IN ('single', 'couple', 'living_alone', 'other')),
  ADD COLUMN IF NOT EXISTS housing_status TEXT CHECK (housing_status IN ('rent', 'own', 'other')),
  ADD COLUMN IF NOT EXISTS financial_goals TEXT,
  ADD COLUMN IF NOT EXISTS money_habits TEXT;

-- Onboarding bonus: 50 Financial Karma for completing the wizard
-- (applied in code, not SQL)
