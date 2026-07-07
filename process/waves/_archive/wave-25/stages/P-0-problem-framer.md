verdict: REFRAME
verdict_source: problem-framer
matched_antipatterns: [1, 2]
reasoning: |
  Symptom-vs-cause check (MANDATORY, security-sensitive) — run on all 3 items:

  ITEM 1 (rate-limiting on /auth/*): CAUSAL FIX IS CORRECT. Grep confirmed ZERO
  rate-limiting exists in the API (no @Throttle / ThrottlerModule / rate-limit
  source files). Rate-limiting is the right causal fix for the brute-force /
  credential-stuffing gap — invite-only signup does NOT cover /auth/signin
  brute-force against EXISTING accounts, so relying on invite-only alone would be
  the wrong fix. Framing is CAUSALLY sound but INCOMPLETE on two load-bearing
  decisions the seed itself flags as risks (carry into P-2/P-3, below).

  ITEM 2 (missing inviteToken 500→400): SYMPTOM-VS-CAUSE MISMATCH (antipattern #1)
  + WRONG-LAYER (antipattern #2). The seed frames the fix as "validate inviteToken
  presence via the shared Zod → clean 400." But the shared Zod schema ALREADY
  declares `inviteToken: z.string().min(1)` (packages/shared/src/auth.ts:48-53).
  Adding a schema rule that already exists will NOT fix the 500. The true cause:
  NO global ZodValidationPipe / APP_PIPE / useGlobalPipes is registered anywhere in
  apps/api (confirmed by grep — the createZodDto DTOs in dto.ts are declared but
  NEVER enforced at runtime). So a missing inviteToken flows past the controller as
  `undefined` → auth.service.ts:114 hashToken(undefined) → createHash().update(undefined)
  throws → uncaught → 500. Confirmed SAFE per seed: the throw happens at step (1)
  BEFORE any EmailPassword.signUp — no Core user, no app user created. The fix layer
  is VALIDATION-PIPE WIRING, not the schema.

  ITEM 3 (logout anti-CSRF): FRAMING IS VERIFICATION-FIRST, not "add hardening."
  POST /auth/logout is already behind SessionGuard → Session.getSession
  (session.guard.ts), and the SuperTokens config sets antiCsrf:'VIA_CUSTOM_HEADER'
  (supertokens.config.ts:145) — the SDK's own anti-CSRF check (custom `rid` header,
  never settable by a cross-site form/simple-request) fires INSIDE getSession on
  this session-verifying POST. So logout is ALREADY anti-CSRF-protected by the
  existing session model. The seed correctly warns against a hand-rolled CSRF; the
  reframe makes item 3 a VERIFY-the-SDK-check-fires task (add a test proving a
  logout without the custom header is rejected), NOT new hardening that could
  conflict with SuperTokens (validation-theater risk, antipattern #7).

  Item 2's wrong-cause/wrong-layer framing would send the builder to the schema
  layer where the rule already exists — the 500 would persist. That is a genuine
  "right code, wrong problem," so overall verdict is REFRAME.
proposed_reframe: |
  Rewrite the 3 items as follows (WHAT, not HOW):

  ITEM 2 — REFRAMED: The 500 on missing inviteToken is caused by the ABSENCE of a
  global request-validation pipe, NOT a missing schema rule (the schema already has
  `inviteToken: z.string().min(1)`). Frame the fix as: wire runtime enforcement of
  the existing createZodDto contracts at the API boundary so malformed bodies on ALL
  /auth/* Nest routes (signup, invite, reset/*) return a uniform 4xx BEFORE handler
  code runs. Acceptance: POST /auth/signup with missing/empty inviteToken → 400 (not
  500), no Core user + no app user created, and the same enforcement covers the other
  Zod-bound auth DTOs (regression-proof the whole boundary, not one field).

  ITEM 3 — REFRAMED: Do NOT add hardening. VERIFY the existing SuperTokens
  VIA_CUSTOM_HEADER anti-CSRF check already protects POST /auth/logout (it verifies
  a session via getSession, so the SDK check fires). Acceptance: a test proving a
  state-changing logout lacking the custom `rid` header is rejected, and a session
  WITH it succeeds — no hand-rolled CSRF token that could conflict with the SDK model.

  ITEM 1 — CARRY (framing sound; two load-bearing constraints P-2/P-3 MUST bind):
    (a) ACROSS-REPLICAS: an in-memory per-instance limiter does NOT hold if Railway
        runs >1 replica — an attacker round-robins instances and bypasses it. No
        Redis is in-stack (grep confirmed), but Postgres 16 IS in-stack → use a
        SHARED store (Postgres-backed) OR document + enforce a single-replica
        assumption at deploy. Decision MUST be explicit in the spec.
    (b) MIDDLEWARE ORDER: /auth/signin is a SuperTokens AUTO-route served by
        app.use(middleware()) in main.ts — a rate-limit middleware registered AFTER
        it will NEVER see signin. It MUST be app.use()'d BEFORE middleware() to
        cover signin (and signup/reset). This is a wrong-layer trap if missed.
    (c) KEYING: per-account (per-email) + per-IP, not per-IP alone (IP rotation
        defeats per-IP). Per seed.
    (d) FAIL-OPEN vs FAIL-CLOSED: for auth endpoints, decide + document (limiter
        backing-store error → deny vs allow). Undecided in the seed; must be decided.
    (e) THRESHOLDS: sane enough not to lock out the legit pilot; no regression to
        invite-only signup or the session model.

  SECURITY-SCOPE-TIGHTENED confirmed WARRANTED: touches auth + CSRF + rate-limits →
  P-4 security-auditor Phase-2 gate + T-8 Security stage APPLY. Concur.
escalation_reason: |
  n/a
sibling_visible: false
