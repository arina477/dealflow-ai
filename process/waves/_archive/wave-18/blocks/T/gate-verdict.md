# Wave 18 — T-9 Verdict

**Reviewer:** head-tester (fresh spawn, T-9 Journey Phase 1)
**Reviewed against:** process/waves/wave-18/blocks/T/review-artifacts.md + findings-aggregate.md
**Attempt:** 1  (first gate)
**Wave topic:** M9 advisor-insights analytics (aggregation + API + /insights dashboard); read-only, workspace-scoped
**wave_type:** [backend, ui, analytics] — post-M8 cross-firm isolation-respect is the hard invariant
**Deployed:** LIVE @ 5c86cf5 (both dealflow-api + dealflow-web SUCCESS, /health version==tip)

## Verdict
APPROVED

## Rationale

The load-bearing invariant of this wave — cross-firm analytics isolation (a leak here silently
undoes the M8/wave-17 isolation layer) — is proven NON-hollowly, and I verified the proof by direct
artifact inspection rather than trusting deliverable prose. **(1) The isolation e2e is genuine, not
coverage theater.** `apps/api/test/analytics-isolation.e2e-spec.ts` `runServiceInAls()` (L665)
instantiates `new AnalyticsRepository(gucHandle)` + `new AnalyticsService(repo)` — the REAL, UNMOCKED
service — and runs `service.getSummary()` inside `workspaceAls.run({ db: gucHandle, workspaceId })`
(L691), so the production `getDb(this.db)` resolves to the `dealflow_app` GUC-bound handle exactly as
the WorkspaceInterceptor does at request time. AMP-1/2/3 primary assertions flow through the real
service (L710-828); the previous inline-SQL re-implementation survives only as a secondary WS_B=0
confirmation. **AMP-4 is genuinely fault-killing** (L859-917): CALL A (ALS-scoped, WS_A only) vs
CALL B (`serviceNoAls.getSummary()` with NO `workspaceAls.run` → `getDb` returns the raw singleton =
all-tenant rows); with WS_B seeded, `noAlsTotal != alsTotal` is asserted. A `getDb(this.db)→this.db`
regression in the shipped repo would collapse CALL A onto the singleton, equalise the totals, and fail
the assertion automatically — no manual red-then-revert needed. This is the exact hollow trap head-builder
caught and REWORKED at B-6 Attempt-1 (inline SQL that re-proved Postgres RLS, never touching the repo);
Attempt-2 CLOSED it, and I confirmed the closure holds at the shipped tip. **(2) It RAN, not skipped.**
C-1 run **28832010151** @5c86cf5 logged `✓ test/analytics-isolation.e2e-spec.ts (7 tests) 2101ms` —
NOT `(7 tests | 7 skipped)`; headSha == origin/main, Turbo remote-cache disabled + cache-miss executed
(no Ghost-Green / stale-cache false-PASS), all 5 required jobs green incl. `pnpm audit --audit-level=high`.
The 4 C-1 fix-forward cycles were all test-seed schema mismatches (23502/42703/23503/23505) routed to
backend-developer per Iron Law; `git diff 277487e 5c86cf5 -- apps/api/src/modules/analytics apps/web`
is **EMPTY** — the app/service tree is byte-identical to the B-6-approved commit, so the green carries
the reviewed code with zero post-approval drift. **(3) Every aggregation query via getDb** — grep of
`analytics.repository.ts` shows `getDb(this.db)` on all queries (F1 L64, F2 L100, F3 L144/L153, F4 L199);
no raw `this.db`, `pool.query`, or `.query(` in any query method (only doc-comments). No leak vector in
the shipped code. **(4) F2 is honest, not a vanity metric** — karen caught the uncomputable "response
rate" pre-build; the code/service/shared/UI carry `gatePassRate`/`blockedRate` over `outreach.status`
with div-by-zero guarded (`null` when 0), and `responseRate` is absent from all production surfaces;
`analytics.spec.ts` (15/15) covers the gate-math + empty-state. **(5) RBAC fail-closed** — advisor+admin
200, analyst/compliance 403, anon 401 (analytics.spec + C-2 live anon `/analytics` 401 = mounted +
SessionGuard fail-closed, 401 not 404); `/insights` redirect-gated. **(6) Read-only** — zero
INSERT/UPDATE/DELETE in the module, no audit row on a read; C-2 `/compliance/audit-log/verify` → 401
(auth gate, not 500 ⇒ HMAC-SHA256 chain intact, analytics deploy did not touch it).

**On the two info findings + the deferral (I rule the deferral ACCEPTABLE):**
- **F2 rate-math CI-coverage nuance (P2, accepted):** the F2 math is validated by the e2e AMP-3, which
  RUNS in CI (`TEST_DATABASE_URL` provisioned), exercising the real service. A repo-unmocked unit test
  would be redundant with the e2e that already drives `getSummary()` unmocked. CI coverage is sufficient;
  does NOT block.
- **Live-authed 4-family check deferred at C-2 (no prod advisor fixtures):** ACCEPTABLE, not a T-5 rework.
  Rationale: (a) this is [backend, ui, analytics], NOT an auth-scope wave — the isolation proof is a
  Vitest-DB e2e that RAN in CI, with **no Playwright Chrome-binary dependency**, so the "silently-skipped
  E2E / missing-browser-binary" ESCALATE trigger does not apply here; (b) a 2-firm cross-firm live test is
  STRUCTURALLY IMPOSSIBLE with one real prod workspace — the authoritative cross-firm proof can only be the
  CI e2e (7/7 as `dealflow_app` under FORCE RLS + AMP-4 fault-killing); (c) using dev-seed creds against
  prod SuperTokens is the explicit anti-pattern to avoid (silent auth failures / catastrophic-if-they-work),
  and `test-accounts.md` is an unpopulated template this pre-first-prod-test wave; (d) C-2 DID verify the
  live RBAC boundary (anon 401 mounted, /insights 307) — the app-behavior surface is proven live to the
  extent single-tenant prod permits. The authed 200-with-4-families read is legitimately deferrable to a
  later founder-onboarding pass when prod fixtures exist; the CI proof is authoritative for the invariant
  this gate must protect. (Waves 15-17 could run a live-authed C-2 check because prod fixtures existed by
  then; this M9 pre-fixture wave cannot, and the CI proof is not weaker for the isolation invariant.)

No coverage theater, no tautological assertions, no hollow test on the load-bearing invariant, no
untested isolation invariant, no silently-skipped suite. Every distrust-the-green check (RAN vs skipped,
fault-killing vs vacuous, headSha==tip, no code drift, real service vs mock) resolves to verifiable
evidence. Findings total 2 (0 crit/high/med, 0 low, 2 info/P2-accepted). APPROVED.

## Rework instructions
(none — verdict is APPROVED)

## Cascade
- **Stages that must re-run:** none
- **Stages that stay untouched:** all (T-1 … T-8 stand)

## Escalation
(none — verdict is APPROVED; no unevaluable checkbox, no infra-readiness blocker; the Playwright
Chrome-binary gate does not apply — no browser E2E is load-bearing this wave)

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3
