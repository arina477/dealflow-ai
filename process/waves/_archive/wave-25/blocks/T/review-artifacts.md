# Wave 25 — T-block review artifacts (SECURITY-SCOPE-TIGHTENED)
**Wave topic:** M10 auth-hardening — rate-limit (SEC-1..8) + 500->400 (SEC-9/10) + logout-CSRF (SEC-11). LIVE @987ebb4, 429 smoke passed in prod. | **Block exit gate:** T-9
**wave_type:** backend security-hardening (auth path) | **T-8 Security stage: MANDATORY**
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28876707093 lint+typecheck @987ebb4 GREEN |
| T-2 | unit/integration | A (CI) | done | 983 unit + auth/rate-limit specs (52+13 new); GREEN |
| T-3 | contract | N/A | done | no new product API contract (auth path hardened, shape unchanged) |
| T-4 | integration/DB | A (CI) | done | SEC-1-DB (real-PG concurrent atomic UPSERT -> exactly one 429) + SEC-4-DB (email-keying same-email/diff-IP->shared bucket) RAN+PASSED in CI (0 skipped); migration 0019 applied (transitive proof) |
| T-5..T-7 | e2e/layout/perf | N/A | done | backend-only (no UI); perf N/A (indexed PK UPSERT) |
| T-8 | SECURITY (MANDATORY - tightened) | active | pending | head-tester + SEC-1..11 proof + 429-live-in-prod smoke + secret-grep |
| T-9 | journey | active | pending | head-tester gate |
