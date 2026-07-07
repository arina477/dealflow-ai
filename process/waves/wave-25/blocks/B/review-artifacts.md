# Wave 25 — B-block review artifacts
**Block:** B (Build) | **Wave topic:** M10 auth-hardening (rate-limit + wire-validation + verify-logout-CSRF) — SECURITY-SCOPE-TIGHTENED | **Block exit gate:** B-6 | **Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | (claim+branch) | done | branch wave-25-auth-hardening; rate-limit store migration this wave |
| B-1/B-2 | stages/B-2-backend.md | pending | rate-limit middleware + validation-wire + logout-verify + T-8-adjacent tests |
| B-3 | — | likely SKIP | backend-only (unless the 429/400 needs a client message) |
| B-4/B-5/B-6 | ... | pending | |
## claimed_task_ids: [6fe232e3] (single-task auth-hardening)
## P-4 SECURITY B-BLOCK OBLIGATIONS (SEC-1..11 — BINDING; head-builder + T-8 police):
- SEC-1 [HIGH] ATOMIC counter (INSERT...ON CONFLICT DO UPDATE ... RETURNING; post-increment value; CONCURRENT-request test)
- SEC-2 [HIGH] WINDOW named (short fixed + coarser 2nd bucket, or sliding — in the AC, not B-2 discretion)
- SEC-3 [HIGH] trust proxy = exact hop count (Railway=1, NOT true/unset); XFF-spoof test; doc the hop count
- SEC-4 [MED] per-account key normalized (email.trim().toLowerCase())
- SEC-5 [HIGH] DIFFERENTIATED failure: signup/reset-request fail-OPEN; signin/reset-confirm fail-CLOSED-SOFT (conservative in-proc fallback ~5/min on limiter-DB-error — invite-only doesn't protect signin)
- SEC-6 [LOW] bucket on submitted email pre-lookup (no enumeration oracle; identical 429 real vs fake)
- SEC-7 [MED] endpoints = signin + signup + reset/request + reset/confirm (add reset/confirm — token brute-force)
- SEC-8 [load-bearing] register as Express app.use() BEFORE middleware() in main.ts (NOT a Nest guard — misses /auth/signin)
- SEC-9 [MED] 500->400 NO global pipe (regresses 18 controllers) — per-handler safeParse OR auth-scoped @UsePipes; guard-test a tenant CRUD endpoint still passes through
- SEC-10 [LOW] 500->400 generic message (byte-identical for missing/empty/malformed/non-existent; no account created)
- SEC-11 [logout] VERIFY existing SuperTokens VIA_CUSTOM_HEADER (test no-header logout→401; with→200; no hand-roll)
## LOAD-BEARING: the 4 HIGH (SEC-1/2/3/5) are what make the rate-limit REAL not theater; T-8 Security stage tests each. NO regression to invite-only/session.

## B-6 outcome — APPROVED (Attempt 2) + /review + P2-hardening
- **Phase 1 head-builder:** Attempt-1 REWORK (3 prod defects: unjournaled migration, unverified atomicity, email-keying-falls-to-IP) → all fixed (0e423cf) → **Attempt-2 APPROVED** (journaled idx-19 + drizzle-kit-check-clean; real-PG SEC-1-DB atomicity test; ensureBodyParsed verified vs SuperTokens+body-parser source — no stream break).
- **Phase 2 /review:** recommend SHIP (no P0/P1; non-bypassability holds, body-buffering safe). 4 P2s found in the new code → ALL CLOSED (6476bc5): P2-A body-size-cap(100KB)+read-timeout(5s) [a NEW unauth DoS surface from the DEFECT-3 fix — closed]; P2-B cleanup-sweeper(unref'd interval)+honest-comment; P2-C fail-open-narrowed-to-connection-class (isConnectionError; non-conn→soft-fallback, no silent-disable); P2-D comment-fixed.
- Green: typecheck 4/4, lint exit 0, build 3/3, 983 unit pass / 95 DB-gated skip (13 new hardening tests). SEC-1..11 all honored + hardened.
## Block exit handoff
```yaml
build_block_status: complete
branch: wave-25-auth-hardening
review_verdict: APPROVE (head-builder Attempt-2 + /review ship + 4 P2s closed)
sec_obligations: SEC-1..11 all honored (4 HIGH real: atomic+journaled table, dual-window, trust-proxy=1, differentiated-fail); DEFECT-1/2/3 closed; P2-A..D hardened
fix_up_commits: [0e423cf (prod defects), 6476bc5 (P2 hardening), 1f97b67 (lint)]
db_gated_tests: [SEC-1-DB atomicity, SEC-4-DB email-keying] (run at C-1/T-8)
migration: 0019_rate_limit_hits (journaled idx-19)
ready_for_ci: true
security_scope_tightened: true (T-8 Security stage tests SEC-1..11)
```
