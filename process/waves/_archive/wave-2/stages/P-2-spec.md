# Wave 2 — P-2 Spec (pointer)

**Source of truth:** the spec contract lives in `tasks.description` of the primary/seed task **`e15f71dd-8f61-441c-904a-bdfa108bd6e1`** (YAML head + `---` + prose). This file is a convenience copy for P-3/P-4 reference. On divergence, the DB row wins.

**wave_type:** multi-spec (3 self-contained spec blocks). **design_gap_flag:** false. **claimed_task_ids:** [e15f71dd (seed: SuperTokens+data model), e1c0e81e (auth API), af6cbc59 (auth screens)].

## Acceptance criteria (copy)

### Block 1 — SuperTokens + user/role data model (e15f71dd)
- SuperTokens Core on its OWN Postgres (SUPERTOKENS_CONNECTION_URI ≠ DATABASE_URL, ≠ TEST_DATABASE_URL).
- NestJS initializes SuperTokens SDK (EmailPassword + Session) at boot; fails fast if Core unreachable.
- Additive Drizzle migration creates users/roles/invites (+ down-migration; no destructive DDL).
- roles seeded with exactly 4: advisor, analyst, compliance, admin.
- invites: token(unique), invited_by, role, expiry, consumed_at.
- Valid-invite provisioning → app users row mapped 1:1 to SuperTokens user id.
- Session JWT carries role claim.
- Invite-only: signup without a valid invite rejected (no account created).

### Block 2 — Auth API: signup/session/reset (e1c0e81e)
- Valid-invite signup → 2xx + session + role claim; invalid/expired/consumed → 4xx, no account.
- GET /auth/me → 200 {userId,email,role} authed | 401 anon.
- Reset request → 202 always (no user-enumeration); confirm with valid token sets password; invalid/expired → 4xx.
- Logout invalidates session (subsequent request 401).
- Role-aware guard PRIMITIVE exists (reads claim) but per-route RBAC NOT enforced this wave (problem-framer guardrail).

### Block 3 — Auth screens (af6cbc59)
- login/accept-invite/reset-password render per design/*.html; valid flows wired to API; invalid → inline error (no enumeration).
- Shared Zod contracts + design-system form components (aria-invalid/describedby, focus-ring).
- Playwright E2E: login ok/fail, accept-invite happy, reset happy (requires host Chrome — task fa23349a).
- No secrets in client bundle.

## Security-scope note
Wave touches auth/user-creation/sessions/cookies → P-4 security-scope tightened gate applies; T-8 Security runs (non-skip). Compliance-first invariants seeded (enforced later): 4-role SoD foundation, invite-only, no user-enumeration, additive+reversible migrations.
