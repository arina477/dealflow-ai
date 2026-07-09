-- Migration 0021 — self-serve firm workspace bootstrap (wave-37, M7 self-serve firm setup)
-- Task: 6235baf7
--
-- PURPOSE:
--   Provide a SECURITY DEFINER function for the self-serve workspace-creating signup path.
--   A brand-new user creating their own firm has NO workspace context yet — the
--   app.workspace_id GUC is unset, so FORCE RLS on workspaces and users rejects every
--   INSERT. This function breaks that chicken-and-egg cycle by running as its DEFINER
--   (the migration role / table owner), bypassing RLS for the specific atomic INSERT of
--   the new workspace + the first admin users row.
--
-- SECURITY DESIGN (mirrors resolve_invite / resolve_user_workspace precedent):
--   1. workspace_id is SERVER-MINTED inside the function (gen_random_uuid()). It is
--      NEVER accepted from the caller. Cross-workspace steering is structurally impossible.
--   2. firmName is DATA — it sets workspace.name only and has zero influence on identity
--      or routing. Parameterized ($2) → SQL-injection-safe.
--   3. role_id is resolved from the roles table by name 'admin' inside the function —
--      never passed in. The first user of a new workspace is ALWAYS admin.
--   4. The workspace INSERT and users INSERT both use the same function-minted uuid so
--      they are guaranteed coherent.
--   5. Returns: workspace_id (minted uuid), users.id (minted uuid), and the resolved
--      role_name — exactly what the service needs to mint the session.
--   6. SECURITY DEFINER + SET search_path = '' (prevents search_path injection).
--      Identical pattern to resolve_invite (0015) and resolve_user_workspace (0014 step 7).
--
-- EXECUTE grant: dealflow_app must be granted EXECUTE (added in this migration).
--
-- ADDITIVE-ONLY: no schema changes, no ALTER TABLE, no DROP. Only a CREATE FUNCTION
-- and a GRANT — fully reversible by the .down file.
--
-- JOURNALED: idx 21, when > (0020 when).

-- ============================================================================
-- STEP 1 — SECURITY DEFINER function: create_firm_workspace
--
-- Atomically creates a new workspace + the first admin users row in one function
-- call, bypassing FORCE RLS on both tables (neither has a GUC set yet).
--
-- Parameters:
--   p_supertokens_user_id text  — the just-minted SuperTokens user id
--   p_email               text  — the normalised (lowercase) email
--   p_firm_name           text  — the human-readable workspace name (DATA, not identity)
--
-- Returns TABLE(workspace_id uuid, user_id uuid, role_name text)
--   workspace_id  — the SERVER-MINTED new workspace uuid (never client-supplied)
--   user_id       — the SERVER-MINTED new users row uuid
--   role_name     — always 'admin' (the first user of a new workspace is admin)
--
-- SECURITY INVARIANT: this function can ONLY insert a fresh uuid-keyed workspace
-- and one users row tied to that uuid. There is no parameter that can supply or
-- redirect to an existing workspace_id. The caller cannot steer the INSERT into
-- another firm's workspace.
-- ============================================================================

CREATE OR REPLACE FUNCTION create_firm_workspace(
    p_supertokens_user_id text,
    p_email               text,
    p_firm_name           text
)
RETURNS TABLE(workspace_id uuid, user_id uuid, role_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_workspace_id uuid;
    v_user_id      uuid;
    v_role_id      uuid;
    v_role_name    text;
BEGIN
    -- 1. Resolve the 'admin' role id from the roles table (no workspace_id column —
    --    roles is a global RBAC lookup table excluded from RLS per migration 0014).
    SELECT r.id, r.name
    INTO   v_role_id, v_role_name
    FROM   public.roles r
    WHERE  r.name = 'admin'
    LIMIT  1;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Invariant violation: admin role not found in roles table';
    END IF;

    -- 2. SERVER-MINT a new workspace uuid. This is never client-supplied.
    v_workspace_id := gen_random_uuid();

    -- 3. INSERT the new workspace row (workspaces has no RLS — it is the tenant-root
    --    table; the isolation is enforced on the child tables via workspace_id FK).
    INSERT INTO public.workspaces (id, name)
    VALUES (v_workspace_id, p_firm_name);

    -- 4. SERVER-MINT a new users row uuid.
    v_user_id := gen_random_uuid();

    -- 5. INSERT the first admin users row with workspace_id = the just-minted uuid.
    --    workspace_id is server-derived (v_workspace_id above) — never the caller's param.
    INSERT INTO public.users (id, supertokens_user_id, email, role_id, workspace_id)
    VALUES (v_user_id, p_supertokens_user_id, p_email, v_role_id, v_workspace_id);

    -- 6. Return the minted ids and the admin role name so the service can mint the session.
    RETURN QUERY SELECT v_workspace_id, v_user_id, v_role_name;
END;
$$;
--> statement-breakpoint

-- ============================================================================
-- STEP 2 — GRANT EXECUTE to dealflow_app
-- Mirrors the EXECUTE grants in migration 0016 for resolve_invite /
-- resolve_user_workspace / read_audit_chain_rls_exempt.
-- ============================================================================

GRANT EXECUTE ON FUNCTION create_firm_workspace(text, text, text) TO dealflow_app;
