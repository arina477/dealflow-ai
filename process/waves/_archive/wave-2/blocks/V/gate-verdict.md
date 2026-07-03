# Wave 2 — V-3 Verdict

**Reviewer:** head-verifier (fresh spawn, Phase 1 gate)
**Reviewed against:** process/waves/wave-2/blocks/V/review-artifacts.md
**Attempt:** 1  (1 = first gate)

## Verdict
APPROVED

## Rationale

Both V-1 reviewers APPROVE against the LIVE deploy `bc558f7`, and — per the V-block's proof-carrying standard — I did not accept those APPROVEs on inference. I independently re-probed the deployed state and reproduced every load-bearing claim first-hand: `/health` returns the exact deployed hash `bc558f7d4db...` (no health-check mirage); the web-origin `/auth/signin` bad-creds path returns `200 {"status":"WRONG_CREDENTIALS_ERROR"}` as `application/json` (same-origin proxy reaches SuperTokens, not a Next 404); OPTIONS `/auth/signup` preflight returns `204` with `access-control-allow-origin: <web>` + `allow-credentials: true` (browser-bug CORS/middleware-order fix is live). Most importantly, I ran a full independent invite→signup: minted an advisor invite, POSTed signup through the web-origin proxy, and observed `201` with `Set-Cookie sAccessToken`/`sRefreshToken` (`HttpOnly; Secure; SameSite=Lax`) **scoped to the web origin, not the api origin** (cookie jar confirmed), then `/auth/me` with that cookie → `200 {userId,email,role:advisor}`. This is the wave's signature claim — first-party same-origin session, login lands in the app with no bounce — proven live, not extrapolated from the green suite. The FINAL deployed state after four fix-cycles is genuinely correct, not a mid-cycle artifact. Karen's source-claim pass (files/routes/migration/env/fix-cycle honesty) and jenny's semantic-spec pass (FINDING-2 fixed, all 8 Block-1/2/3 ACs) were run in parallel with zero shared context and are internally consistent with my probes.

**Compliance invariants (this is a compliance-first platform) — all verified live:**
- **Invite-only:** invalid token → `400 "Invalid or expired invite"` (no account); consumed/reused token → `400` (no second account, single-use enforced). Reproduced independently.
- **No user-enumeration:** reset request returns a uniform generic response for unknown emails; login returns generic `WRONG_CREDENTIALS_ERROR` (wrong-pw == unknown-email). Confirmed both surfaces.
- **Role claim / SoD foundation:** JWT + `/auth/me` carry the correct `role`; jenny verified all 4 seeded roles (advisor/analyst/compliance/admin). RBAC guard is **primitive-only, not route-enforced** — correctly NOT leaked (problem-framer guardrail honored; no premature enforcement this slice).
- **SuperTokens Postgres isolation:** the one invariant not externally HTTP-probeable — but it is NOT left to inference: it is backed by a fail-closed no-alias boot assertion (app cannot boot if `SUPERTOKENS_DATABASE_URL == DATABASE_URL`), and the app booted clean (`/health db:ok`). The boot itself is the observable artifact. Acceptable proof-carrying evidence.

**V-2 triage is sound — no load-bearing finding downgraded:**
- The whole-point-of-the-wave claim (session persists, no bounce to /login) is TRUE — proven live (authed `/dashboard`/`/auth/me` 200 role-aware; anon `/dashboard` 307→/login).
- **DRIFT-1 (signup missing `inviteToken` → 500 not 4xx)** correctly non-blocking: I reproduced the 500, and confirmed it is a pre-provisioning validation crash — no account is created, no enumeration, no data leak, no security-invariant violation. Routed to hardening task `6fe232e3`. Correct call.
- **Rate-limit gap (T-8, medium)** correctly non-blocking for this slice: no public self-signup route (invite-gated), 0-user pilot; medium-severity hardening, not a wave blocker. Bundled into `6fe232e3` alongside logout anti-CSRF. Sound.
- 2 noise items (cosmetic path naming, wave-1 test-fixture cast) correctly suppressed with rationale.

No Done-Theater, no false-green, no spec-vs-deployed drift missed. Notably, the T-5 real-browser E2E caught 2 CRITICAL browser bugs (CORS/middleware ordering + cross-origin session) that the API-curl smoke + unit tests missed — exactly the anti-false-green discipline the V-block demands — and both were fixed and re-verified live. Fast-fix queue is empty (0 blocking); Phase 2 does not run. Every applicable V-1/V-2/V-3 stage-exit check is tickable from a concrete observable artifact.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2
