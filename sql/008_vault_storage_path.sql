-- ============================================================
-- Migration 008: Move encrypted PDF blob to Supabase Storage
-- ============================================================
-- Storing 2-6MB hex-encoded blobs in a regular column was tripping
-- PostgREST's body limits (manifested as
--   TypeError: fetch failed / SocketError: other side closed).
-- We now upload the encrypted bytes to a private Storage bucket and
-- only keep a short path in the row. IV + auth tag + key version stay
-- in the row (they're tiny and needed for decryption).

ALTER TABLE vault_uploads ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Old hex blobs become optional. Leaving the column for backwards
-- compatibility with rows that pre-date this migration.
ALTER TABLE vault_uploads ALTER COLUMN encrypted_data DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- IMPORTANT — manual step in the Supabase dashboard:
--   1. Storage → New bucket → name "vault-statements" → Private (NOT public).
--   2. Bucket Settings → file size limit 15 MB, MIME types: application/octet-stream
-- The service-role key the server uses bypasses RLS so no extra policies needed
-- for the API path. Add Storage RLS policies later if you ever expose direct
-- client-side access.
-- ============================================================
