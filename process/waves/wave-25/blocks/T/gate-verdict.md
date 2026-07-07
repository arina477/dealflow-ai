# Wave 25 — T-9 Verdict (T-8 Security + T-9 Journey block-exit gate)

**Reviewer:** head-tester (fresh spawn, T-9 gate, wave-25 M10 auth-hardening, SECURITY-SCOPE-TIGHTENED)
**Reviewed against:** process/waves/wave-25/blocks/T/review-artifacts.md + findings-aggregate.md; deliverables C-1 (+RESUME), C-2, B-6; source specs apps/api/src/modules/auth/rate-limit.middleware.spec.ts + auth.controller.spec.ts
**Attempt:** 1
**Deployed commit:** 987ebb42e48df759ca7b6b1872b48c54be5dd7fe · CI run 28876707093 (5/5 green, 0 skipped)

## Verdict
APPROVED

## Rationale

Every SEC-1..11 acceptance criterion is backed by a genuine, non-tautological assertion against observable state — not coverage theater, not mock-was-called tautologies. The two crown-jewel proofs for this wave were audited at source and are real: **SEC-1-DB** fires N+1 real concurrent Postgres UPSERTs and asserts every RETURNING value is unique (`uniqueCounts.size === concurrentCount`), the max equals the total, and the stored row equals the total — a SELECT-then-UPDATE implementation races and produces duplicate counts, which would fail this test, so it genuinely proves atomicity (not a mock tautology). **SEC-4-DB** drives the *real* `createRateLimitMiddleware` against real Postgres and asserts same-email/different-IP land in one bucket (count=2) with a negative control (different-email/same-IP → count=1), proving per-account keying and that the request body is actually parsed in the prod path. Both DB-gated tests **RAN and PASSED in CI** (run 28876707093, `rate-limit.middleware.spec.ts` 48 tests green, SEC-1-DB 1809 ms of genuine PG work, **0 skipped / 0 pending across the entire run** — not silently skipped). The **prod-429 smoke is sound live proof**: `/auth/reset/request` is fail-OPEN, so it returns `next()`/allow on any DB or table error; a 429 there is only producible by a genuinely-firing DB-backed limiter with `rate_limit_hits` present — and the boundary hit exactly at req 6 with a correct `Retry-After`, reproduced on a fresh bucket. SEC-2 (dual-window, coarse bucket kills the boundary-burst), SEC-5 (all four fail paths + the P2-C narrowing that a non-connection error degrades to soft-fallback rather than fail-open), SEC-6 (real-vs-fake email → byte-identical 429 body), SEC-7/8 (reset/confirm limited; signin flood intercepted at the Express level before the SuperTokens SDK route), SEC-9 (per-handler safeParse throwing `BadRequestException` with the service never called + the non-auth POST passthrough guard proving no global pipe / no 18-controller regression), and SEC-10 (missing vs empty invite → identical generic 400 message + status) are all concretely asserted. The P2 hardening set (body-size cap, slow-loris read-timeout, cleanup sweeper incl. single-interval guard, fail-open narrowing) is genuinely tested with observable assertions. No secret leaked (audit exit 0, log grep empty), auth flow not regressed (all suites green, 0 failed, 0 skipped), migration 0019 is additive-only and proven applied in prod. The three INFO findings are correctly routed (migration-timestamp cosmetic → no-op; M10 recordkeeping-decomposition → N-block + wave-26 tripwire; Actions-billing 3× → founder decision doc). The gate approves with four non-blocking coverage-thinness findings surfaced to V-2 — none touch this wave's crown-jewel invariants, all concern config-level or vendored-library-guaranteed controls whose regression IS caught by the static assertions present.

## Non-blocking findings (surface to V-2 — significant/info, not blocking)

- **F1 (significant) — SEC-3 trust-proxy: no forged-XFF integration assertion.** The unit test proves the middleware keys on `req.ip` (same resolved IP → shared bucket), but it never sets an `X-Forwarded-For` header and does not assert Express's `trust proxy` value; the "attacker cannot mint a fresh bucket with a forged XFF" claim rests on the (untested here) `app.set('trust proxy', 1)` config. Genuine end-to-end coverage would send a forged multi-hop XFF and confirm the bucket is unchanged. Practical risk is bounded (the middleware provably keys on the Express-resolved `req.ip`, and the prod smoke keyed correctly), so this is thin coverage, not a live bypass. Recommend a trust-proxy config assertion + a forged-XFF integration probe in a future auth wave.
- **F2 (significant) — SEC-11 logout rid-missing→401 is static-only, not probed live.** The unit tests statically assert `antiCsrf: 'VIA_CUSTOM_HEADER'` in supertokens.config.ts and `@UseGuards(SessionGuard)` on the logout handler (both genuine, regression-catching), but the runtime "logout without the custom `rid` header → 401" behavior was deferred to a live-SuperTokens-Core integration test and was **not** probed in C-2 prod (C-2 smoked only the rate-limit 429, not logout-CSRF). Enforcement therefore rests on the static config+guard assertions plus the vendored SuperTokens VIA_CUSTOM_HEADER guarantee. Acceptable for APPROVED because logout-CSRF is a standard web control (not one of DealFlow's crown-jewel compliance invariants — audit-log HMAC chain / pre-send gate / SoD) and this is a rate-limit+validation wave; recommend adding the live rid-missing→401 probe once a SuperTokens-Core-backed integration harness exists.
- **F3 (info) — SEC-1-DB inlines the atomic SQL rather than calling the middleware's `atomicIncrement`.** It proves the `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` pattern is atomic under real concurrency, but the middleware's own query path against real PG is exercised by SEC-4-DB — combined, both the atomic SQL and the middleware wiring are covered. No action required.
- **F4 (info) — two `expect(true).toBe(true)` marker assertions** (rate-limit spec SEC-11 doc-marker; controller spec SEC-9 no-global-pipe marker). Harmless — real evidence lives in adjacent tests — but they are hygiene noise; recommend deleting the markers so the suite contains no self-passing assertions.

## Journey (T-9 Phase 2) — regen skip evaluation

Journey-map regeneration is correctly **skipped** (`journey_regen_skipped: true`): `wave_type` is `backend` (no `ui`/`heavy`), D-block did not fire, and no frontend directory was touched (backend-only auth-hardening). The auth endpoints' *behavior* changed (429 added on rate-limit; 500→400 on malformed auth bodies) but **no route/screen was added or removed**, so the canonical `user-journey-map.md` remains valid and needs no new route entry. The 500→400 and +429 changes are intentional per the wave spec (hardening), so they are a documented behavior delta, not a regression. Scenario smoke runs only if `user-scenarios/` exists (record its presence/absence in the T-9 deliverable). No cross-wave journey regression.

## Cascade

| Trigger stage | Downstream re-run |
|---|---|
| (none — APPROVED) | none |

- **Stages that must re-run:** none.
- **Stages that stay untouched:** all.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3
- head_signoff:
    verdict: APPROVED
    stage: T-9
    reviewers: {security_invariants: head-tester-source-audit, ci_evidence: run-28876707093, prod_smoke: C-2-rate-limit-429}
    failed_checks: []
    rationale: SEC-1..11 genuinely tested (real-PG atomicity SEC-1-DB + email-keying SEC-4-DB ran+passed in CI, 0 skipped; prod-429 fail-open smoke = sound live proof; differentiated-fail/no-enum/dual-window/generic-400/no-global-pipe all concretely asserted; P2 hardening tested). No auth regression, no secret leak, migration additive+applied. 4 non-blocking coverage-thinness findings (SEC-3 forged-XFF integration, SEC-11 live rid-401, SEC-1-DB inline-SQL, tautology markers) surfaced to V-2; 3 INFO findings routed. Journey regen correctly skipped (backend-only).
    next_action: PROCEED_TO_V
