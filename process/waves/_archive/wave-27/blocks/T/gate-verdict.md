# Wave 27 — T-9 Verdict (T-8 Security + T-9 Journey gate)

**Reviewer:** head-tester (fresh spawn)
**Reviewed against:** process/waves/wave-27/blocks/T/review-artifacts.md + findings-aggregate.md
**Wave:** M10 recordkeeping EXPORTS (extended export: CSV + deal/pipeline scope + cap/truncation, RLS-scoped) + firm-admin `/compliance/export` page. LIVE @ff29cf4. SECURITY-SCOPE-TIGHTENED.
**Attempt:** 1 (first gate)
**Verdict source:** direct audit of shipped test source + shipped feature source + CI evidence (C-1) — NOT inferred from a green badge or a prose summary.

## Verdict
**APPROVED**

## Rationale

Every T-8 SEC obligation is verified GENUINE against the shipped code, and the one load-bearing defect B-6 caught (SEC-4 silent-truncation) is provably fixed end-to-end with its tautology killed. I audited the actual test files and the actual controller/frontend/serializer source rather than trusting the deliverable prose. The crown-jewel cross-tenant isolation (SEC-8) is a real fault-killing e2e — not a mock, not coverage theater — and it demonstrably ran (17/17, 0 skipped) as `dealflow_app`, the non-superuser role under which FORCE RLS actually applies. Coverage is adequate at every layer touched, flakiness discipline held (the two RED cycles were deterministic test-harness defects routed under the Iron Law, not silent retries), and the compliance invariants (HMAC-chain payload isolation, firm-local ordinal masking, RBAC/SoD-adjacent export gating, injection-safe CSV) are each asserted on concrete output state. The T-9 journey-map delta (+`/compliance/export` route, +extended export endpoint) is REQUIRED and unskippable (UI wave: new route + frontend files touched) — that is a Phase-2 regen task to execute post-APPROVED, not a gate blocker.

## SEC-by-SEC audit (shipped code, not prose)

| SEC | Verdict | Evidence (verified this review) |
|---|---|---|
| **SEC-8 cross-tenant isolation (crown jewel)** | **GENUINE** | `recordkeeping-export-isolation.e2e-spec.ts`: `withWorkspace`/`runExportInAls` issue `SET ROLE dealflow_app` (line 137/366, explicit "NOT postgres — 0016 trap" comment) so FORCE RLS binds; real `RecordkeepingService.exportAsActor` invoked inside `workspaceAls.run` with a GUC-bound drizzle handle. Seeds firm A (3 audit + 2 pipeline) + firm B (2 audit + 1 pipeline). REISO-1 asserts firm A export has ZERO firm B actorUserId AND ZERO firm B pipelineId (both scope); REISO-2 (deal scope) + REISO-3 (audit scope) each exclude firm B. Only audit-write + verifyChain-boolean are mocked — the payload READ path is real; a RLS bypass leaks firm-B rows and fails the test. **Fault-killing confirmed by history:** C-1 RED#1 reported all 17 SEC-8 tests SKIPPED + suite FAILED on the seed PK collision — proving the harness does NOT silently pass on zero execution. Final green run: `(17 tests) ✓, 0 skipped, 0 failed`. |
| **SEC-1 getDb/RLS payload; verifyChain boolean-only; no rls-exempt in payload** | **GENUINE** | REISO-8 asserts `verifyChain` called exactly once (boolean summary only) while payload `pkg.entries` are RLS-scoped (firm A only) and `'sequenceNumber' in entry === false`. Service reads payload via the tx-scoped bounded repo path, never the rls-exempt chain walk. |
| **SEC-4 bounded + truncation-honesty (B-6 P1 catch)** | **RESOLVED — no silent-complete possible** | Controller (`recordkeeping.controller.ts:217-219`) sets `X-Export-Manifest` (+ `Access-Control-Expose-Headers`) UNCONDITIONALLY, before the csv/json branch split — both branches carry it. Frontend (`RecordkeepingExportForm.tsx:588-610`): reads `x-export-manifest`, validates via `exportManifestSchema`, and on absent/invalid manifest routes to `error` state — NOT `truncated:false` success. **Tautology killed:** `makeExportFetchNoManifest` test (page.test.tsx:656-714) asserts absent header → `error-panel` (role=alert), NO "Integrity verified", NO download link. Controller SEC-4 contract suite (recordkeeping.spec.ts:941-1069) asserts the header carries real `truncated`/`rowsReturned`/`rowsAvailable`, incl. a capped `truncated:true` case reaching the header. A capped export can never be shown complete. |
| **SEC-2 .strict() no workspace_id + negative** | **GENUINE** | `exportScopeSchema.safeParse` → 400 in controller (line 188-193). REISO-4 asserts `workspace_id` AND `firmId` rejected, valid body passes. Workspace server-resolved from ALS, never a client param. |
| **SEC-5 CSV-injection escape (two-layer)** | **GENUINE** | `csv.serializer.ts` real two-layer: Layer-1 injection-prefix on first char `= + - @` / TAB / CR / LF; Layer-2 RFC-4180 quote-wrap + doubled quotes. REISO-6 tests each trigger class, the safe-cell negative (wrapped, NOT prefixed), and internal-quote doubling. |
| **SEC-6 firm-local ordinal, global seq masked** | **GENUINE** | REISO-7 asserts exported entries carry `firmLocalOrdinal` 1..N ascending AND `'sequenceNumber' in entry === false` (audit + deal). Global sequence never leaves the boundary. |
| **SEC-7 RBAC export compliance+admin fail-closed** | **GENUINE** | Controller `@Roles(...EXPORT_ROLES)` sourced from shared `rolesForRoute` + boot-fail assertion if `[]` (lines 108-114). DB-authoritative `RolesGuard` (resolveRoleRlsExempt). Matrix: export compliance/admin → ALLOW, advisor/analyst → 403, anon → 401; service-layer re-check throws ForbiddenException for advisor/analyst; page `assertRole` server-redirects advisor/analyst → `/`, 401/403 → `/login`. `@Roles` metadata test asserts export = [admin, compliance], NOT advisor. |
| **SEC-9 export audit-log scope/count-only, last-in-txn, rollback** | **GENUINE** | Unit suite: exactly-one `export_generated` append (incl. zero-entries case), actor = app users.id not ST id, rollback-on-append-throw propagates (no package without its row). |
| **SEC-3 / SEC-10 extends RLS-scoped repo; no cross-firm joins** | **GENUINE (per B-6 code binding, unchanged)** | Deal query joins only RLS-covered tenant tables; reuses existing repository, no 2nd surface. |

## Coverage adequacy / anti-theater checks

- **No coverage theater:** assertions are on concrete output state (row identity, ordinal sequence, header payload, exception type), not `toHaveBeenCalled` truthiness. The one `toHaveBeenCalledTimes(1)` (REISO-8 verifyChain) is paired with a real state assertion (payload RLS-scoped), so it is not tautological.
- **No over-mocking at the isolation boundary:** SEC-8 uses a real containerized Postgres (Testcontainers-equivalent CI service) with the real service+repo; mocks are limited to the audit-write and the boolean verifier — the correct unmanaged/irrelevant boundaries for a payload-READ-isolation proof.
- **No flaky tolerance:** C-1's two REDs were deterministic (PK collision; WORM hash-chain corruption caught by sibling-baselining) and routed to backend-developer — no auto-retry-until-green. No test weakened or skipped in the fix.
- **No CI blindness / no skipped-E2E false-PASS:** the DB-gated SEC-8 suite is `describe.skipIf(TEST_DATABASE_URL unset)`; CI (`ci.yml`) provisions `dealflow_test` and sets `TEST_DATABASE_URL`, and the run reports 0 skipped with a non-zero executed count (17). Executed-test volume audited against the RED#1 baseline (which showed the skip failure mode), confirming the guard is not silently swallowing the suite. (No Playwright/browser-binary gate applies — this wave's UI verification is jsdom component tests, not live Chrome E2E; no false-PASS-from-missing-binary risk.)
- **No regression:** api 1103/1103, web 900/900, 0 failed, 0 skipped; audit gate (`pnpm audit --audit-level=high`) green.
- **Secret-grep (T-8 Action 5, always runs):** wave diff clean — no api-key/secret/password/bearer/PEM leak; only the dummy test HMAC key (`test-audit-hmac-key-dummy-do-not-use-in-prod`), which is a legitimate non-secret test fixture.

## T-9 Journey — Phase 2 directive (post-APPROVED)

Journey-regen is REQUIRED (NOT skippable): `wave_type` includes `ui`, B-3 Frontend ran, new route `/compliance/export` + new frontend files touched (Action 2 skip conditions do not all hold). The current `command-center/artifacts/user-journey-map.md` still reflects only the wave-13 `/compliance/audit-log` surface and does NOT yet carry the wave-27 delta. Orchestrator must, post-verdict, regen the map to add:
- **Route:** `/compliance/export` (firm-admin RBAC-gated: compliance + admin; advisor/analyst → `/`, anon → `/login`) — the export configuration page (scope: audit/deal/both; format: CSV/JSON; optional date range; 12-month default; 50k cap w/ truncation warning).
- **Endpoint:** extended `POST /compliance/audit-log/export` (proxied via `/compliance/audit-log-data/export`) — CSV + JSON, deal/pipeline scope, `X-Export-Manifest` truncation header.
This is a Phase-2 regen task, not a gate blocker.

## Cascade

No REWORK — no downstream T-stage re-run required.
- **Stages that must re-run:** none.
- **Stages untouched:** all.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3
- sec8_isolation_genuine: true (17/17 as dealflow_app, 0 skipped, fault-killing)
- sec1_getdb_not_exempt: true
- sec4_truncation_honesty_no_silent_complete: true (tautology killed; absent manifest → error)
- sec2_5_6_7_tested: true
- no_coverage_gap_no_regression: true (api 1103/1103, web 900/900, 0 skipped; secret-grep clean)
- journey_delta_required: true (Phase-2 regen: +/compliance/export route + extended export endpoint)
