-- Migration 0015 — invite RLS-exempt bootstrap (wave-17, M8 DEV-1 fix)
-- Tasks: c-? (auth/M1) + 0db154ff (workspace isolation seed)
--
-- PROBLEM (DEV-1): invites has FORCE ROW LEVEL SECURITY. The pre-auth signup
-- path (getInviteEmail + consumeInviteAndCreateUser) runs BEFORE any session or
-- app.workspace_id GUC is set. Without the GUC:
--   workspace_id = current_setting('app.workspace_id', true)::uuid
--   → workspace_id = NULL → false → 0 rows → signup returns "invalid invite".
--
-- RESOLUTION: a SECURITY DEFINER function that bypasses RLS for the single
-- specific operation needed during invite bootstrap. Identical pattern to
-- resolve_user_workspace (migration 0014 step 7).
--
-- JOURNALED: idx 15, when > 1783987200000 (0014 when).
--
-- EXECUTION ORDER: additive-only (no schema changes, no ALTER TABLE).
--   1. CREATE SECURITY DEFINER function resolve_invite.
--   (No .down rollback needed for STEP 1 only — see .down file for DROP.)

-- ============================================================================
-- STEP 1 — SECURITY DEFINER function: resolve_invite (DEV-1 fix)
--
-- Purpose: RLS-bypassing bootstrap resolver for the pre-auth invite path.
--   The invites table has FORCE ROW LEVEL SECURITY with the workspace_id GUC
--   policy (migration 0014 step 5-6). The signup flow calls this BEFORE any
--   session exists:
--     invite lookup → needs GUC → GUC not set → 0 rows → signup broken.
--   This function breaks the cycle by running as its DEFINER (the migration
--   role / table owner), which bypasses RLS for this specific token lookup.
--
-- MINIMAL SURFACE (security design):
--   • Accepts ONLY the token hash (the capability — SHA-256 of the user's
--     plaintext token). The hash is unguessable; a caller cannot enumerate
--     other invites without their token hashes.
--   • Filters to unconsumed + unexpired invites only (same predicate as the
--     normal Drizzle path). Consumed or expired invites return 0 rows.
--   • Returns ONLY the three fields the pre-auth path needs:
--       email       — for EmailPassword.signUp (the user's invited address)
--       workspace_id — for the new user's tenant placement (server-derived,
--                      never client-supplied)
--       role_id     — for the users INSERT (same FK as in the invite row)
--   • No token content, no invite id, no other invite fields are returned.
--   • A caller cannot iterate all invites (no range scan, no wildcard).
--
-- WORKSPACE PLACEMENT INVARIANT:
--   The new user's workspace_id is sourced from invite.workspace_id (set when
--   the admin created the invite). The invitee joins the SAME workspace as the
--   admin who issued the invite. workspace_id is NEVER client-supplied.
--
-- SECURITY DEFINER + SEARCH_PATH = '' (prevents search_path injection).
-- The function owner is the role running this migration.
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_invite(p_token_hash text)
RETURNS TABLE(email text, workspace_id uuid, role_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        i.email,
        i.workspace_id,
        i.role_id
    FROM   public.invites i
    WHERE  i.token        = p_token_hash
    AND    i.consumed_at  IS NULL
    AND    i.expiry       > now()
    LIMIT  1;
$$;
