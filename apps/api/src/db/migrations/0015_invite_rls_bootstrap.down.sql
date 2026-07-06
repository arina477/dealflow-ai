-- Rollback for migration 0015 — invite RLS-exempt bootstrap (wave-17, M8 DEV-1 fix).
-- Additive-only: only the SECURITY DEFINER function is dropped.

DROP FUNCTION IF EXISTS resolve_invite(text);
