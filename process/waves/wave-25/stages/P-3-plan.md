# Wave 25 — P-3 Plan (single-spec: M10 auth-hardening)
## Approach — 3 items (rate-limit + wire-validation + verify-logout-CSRF)
### Action 1 — Architecture deltas
- **Rate-limiting [MEDIUM]:** a NestJS middleware (or guard) on /auth/signin, /auth/signup, /auth/reset/request. **SHARED store = Postgres** (a small rate_limit_hits table OR a fixed-window/sliding-window counter keyed by (bucket, window) — additive migration; NO Redis in-stack, so across-replica-safe via the DB). Key = per-account (per-email, robust to IP rotation) AND per-IP (with correct proxy/forwarded-for handling — trust the platform's client-IP). **Middleware ORDER: before the SuperTokens middleware()** (so auth attempts are limited before session processing). On LIMIT EXCEEDED → 429 (with Retry-After). On LIMITER INTERNAL ERROR → fail-OPEN (allow + log — avoid locking out the pilot on a DB blip; documented decision, acceptable pre-external-user + the invite-only mitigation). Sane thresholds (e.g. N attempts / window per account + per IP — generous enough for legit ret/typos, tight enough to blunt brute-force). Consider audit-logging repeated-limit events.
  - *Alt:* @nestjs/throttler with the default in-memory store — REJECTED (in-memory is per-instance → bypassable across Railway replicas + resets on deploy; use the DB-backed store, or throttler with a Postgres storage adapter).
- **Missing-inviteToken 500→400 [LOW]:** the shared Zod already has inviteToken min(1); the fix is the MISSING VALIDATION WIRING — add a global ZodValidationPipe (APP_PIPE) OR validate the DTO in the signup handler so a missing/empty inviteToken → 400 (not hashToken(undefined)→500). Verify no OTHER endpoint regresses from a global pipe (or scope it to the auth DTO).
- **Logout anti-CSRF [LOW]:** VERIFY the existing SuperTokens anti-csrf (VIA_CUSTOM_HEADER under the cookie model) protects POST /auth/logout — confirm the session-verify + anti-csrf check fires; add a test proving a cross-site logout without the anti-csrf header/rid is rejected. Do NOT hand-roll a conflicting CSRF.
### Action 2 — Data model
IF the rate-limiter uses a Postgres table → ONE additive migration (rate_limit_hits or a counter table; workspace-agnostic — it's pre-auth/global, NOT tenant-scoped, so NOT under workspace RLS; document that). Journaled. Populated-migration test only if it touches a WORM table (it does NOT).
### Action 3 — API: no new product endpoints; the /auth/* behavior hardens (429 + 400 + CSRF-verified).
### Action 4 — Deps: a rate-limit lib is OK (@nestjs/throttler + a Postgres storage adapter, OR hand-rolled DB counter — no new external service). NO Redis, NO new SDK/secret.
## Plan (by B-stage)
**B-0 Schema** (backend-developer): the rate-limit store migration (if DB-backed) — additive, journaled.
**B-1 Contracts** (backend-developer): the signup DTO validation (the shared Zod already has it; wire the pipe) + any rate-limit config.
**B-2 Backend** (backend-developer): the rate-limit middleware (Postgres shared store, per-account+per-IP, before SuperTokens, 429, fail-open-on-error) + the ZodValidationPipe wiring (500→400) + verify the logout anti-csrf. **T-8-adjacent tests: rate-limit actually returns 429 after N attempts (per-account + per-IP); the 429 holds across a simulated 2nd instance / shared-store; missing-inviteToken → 400 (not 500); logout without anti-csrf → rejected; legit pilot flow NOT locked out; no regression to invite-only signin/session.**
**B-3 Frontend:** SKIP (no UI — unless the 429/400 needs a client message; likely backend-only. If the web signup/login should show a rate-limit message, a thin B-3; judge at B-2).
**B-4/B-5/B-6:** head-builder polices rate-limit-shared-store-not-in-memory + enforces-429 + fail-open/closed-as-designed + 500→400-wired + logout-csrf-verified-not-handrolled + no-auth-regression.
### Action 6 — Specialist: backend-developer (auth/security). Consider security-engineer for the rate-limit design if backend-developer flags. Parallelization: serial.
### Action 8 — Self-consistency CLEAN. SECURITY-SCOPE-TIGHTENED → P-4 security-auditor Phase-2 + T-8 Security stage.
```yaml
deps_new: [rate-limit-mechanism (@nestjs/throttler + Postgres adapter OR hand-rolled DB counter — NO Redis)]
schema_change: true   # IF DB-backed rate-limit store — additive, journaled, NOT WORM, NOT tenant-scoped (pre-auth global)
new_secret: false
new_sdk: false
specialists: [backend-developer]
compliance_invariants: [rate-limit-shared-store-across-replicas, rate-limit-enforces-429, rate-limit-non-spoofable-per-account-key, fail-open-on-limiter-error-documented, no-pilot-lockout, 500->400-via-wired-validation, logout-anti-csrf-existing-SuperTokens-verified, no-invite-only-session-regression]
hard_boundaries: "harden the LIVE auth; rate-limit MUST be a SHARED store (Postgres, across-replica-safe — NOT in-memory-per-instance), per-account+per-IP, before SuperTokens middleware, 429-on-exceed, fail-open-on-limiter-error (documented); 500->400 by WIRING validation (schema already has it); logout-CSRF = VERIFY existing SuperTokens VIA_CUSTOM_HEADER (no hand-roll); NO regression to invite-only/session; sane thresholds (no pilot lockout)"
design_gap_flag: false
security_scope_tightened: true
self_consistency: clean
```
