# Wave 12 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId head-builder-b6-w12)
**Reviewed against:** process/waves/wave-12/blocks/B/review-artifacts.md
**Attempt:** 1  (1 = first gate, 2+ = post-rework)

## Verdict
REWORK

## Rationale
The pipeline implementation is structurally sound and passes almost every compliance invariant on inspection of the source: the schema is additive-only (migration 0011, journal ts 1783728000000 > 0010's 1783641600000, distinct `pipeline_stage`/`pipeline_event_type` enums, `.down.sql` present, XOR CHECK + two partial-UNIQUE indexes as structural idempotency guards, correct FK ON DELETE semantics); all three mutations call the REAL M2 `AuditService.append(input, tx)` LAST-IN-TXN inside one `runInTransaction`; actor identity is resolved via `getUserWithRole` to the app `users.id` and the raw SuperTokens id is never persisted (wave-5 lesson held); the eligible-source guard reads tx-scoped and rejects ineligible outreach/match_candidate with 400; enroll idempotency rides the DB unique constraint with a real 23505→409 unwrap (not a service-level find-first race); the fixed-enum transition is re-guarded server-side; pipeline_events has no update/delete path; boundaries are clean (no Anthropic/LLM, no email SDK, no webhook, no send — verified by grep excluding comments); RBAC excludes analyst on every route (→403) with anon→401, and nav (`NAV_PIPELINE`) references the same `['advisor','compliance']` array as the `/pipeline` route (nav⊆RBAC); the frontend SSR-hydrates, renders the 7 FIXED columns derived from the shared `pipelineStageEnum.options` (not design/pipeline.html's illustrative labels), routes mutations through the non-colliding `/pipeline-data` proxy, and asserts absence of any send/AI affordance. **The blocker is the test gate, not the code.** The single load-bearing compliance invariant for this platform — "audit append throws mid-txn → the whole mutation rolls back, no orphan pipeline/pipeline_events row" (an explicit acceptance-criterion edge-case on task 07989285, and asserted as a B-block guarantee in the service/schema headers) — is UNPROVEN. `runInTransaction` is mocked as a `vi.fn()` passthrough (`pipeline.spec.ts:131-133`, `work({} as Tx)`); the only rollback test (test 15, `:475-490`) covers addNote alone and asserts merely that the promise rejects — nothing is ever persisted to a real store, so nothing is proven rolled back, and the real `db.transaction()` ROLLBACK path (`pipeline.repository.ts:104`) is executed by zero tests. No pglite/real-transaction/e2e rollback coverage exists anywhere in the module. This is hollow-test theater on exactly the invariant this gate exists to protect. Two secondary test gaps compound it: audit-ordering is call-order-asserted for addNote only (enroll + transition unproven), and the "exactly one audit row" claim is never asserted with a call-count on `append`. Because the fix is mechanically well-defined (add real-transaction rollback + ordering + count assertions), this is REWORK, not ESCALATE.

## Rework instructions  (only if REWORK)

### Stages requiring rework
- B-5: pipeline test suite has hollow coverage on the audit-rollback compliance invariant (over-mocked `runInTransaction`); add real-transaction proofs + missing ordering/count assertions.

### Per stage

#### B-5
- **What's wrong:** The audit-last-in-txn ROLLBACK invariant is asserted only against a mocked `runInTransaction` (`pipeline.spec.ts:131-133`) that calls `work({})` and never opens a real transaction. Test 15 (`:475-490`) covers only addNote and only proves the promise rejects — it does NOT query a store to prove zero orphan rows persist. The real `this.db.transaction(work)` ROLLBACK path (`pipeline.repository.ts:104`) is exercised by no test. Enroll and transition have no rollback test at all. Audit-ordering (append LAST) is call-order-asserted for addNote only; enroll (after insertPipeline + insertPipelineEvent) and transition (after update + event insert) are unproven. The "exactly one audit row" claim has no `toHaveBeenCalledOnce()` on `AuditService.append` in the addNote path.
- **Heuristic fired:** The Hollow AI Test Suite + Silent Audit Bypass — a mutating deal-state / audit-trail invariant whose test mocks away the exact seam (`db.transaction`) that provides the guarantee, cementing a compliance claim that is structurally unprovable by the test as written. For a compliance-first M&A platform, an unproven "no orphan business row without its audit entry" is the failure mode the B-gate exists to catch.
- **What "good" looks like:** A real-transaction (pglite-backed, following the codebase's existing "instantiate the real repository, not a mock" pattern already used for the 23505 unwrap tests at `pipeline.spec.ts:309-345`) integration test for BOTH `enrollAsActor` and `addNoteAsActor` in which `AuditService.append` is stubbed to throw mid-txn, after which the test queries the real store and asserts `count(pipeline) === 0` AND `count(pipeline_events) === 0` for the attempted deal target — proving the ROLLBACK actually fires. Plus: call-order assertions (shared `callOrder[]` array pattern already used at `:443-473`) for `enrollAsActor` and `transitionStageAsActor` proving `append` is invoked after all business writes; plus `expect(auditAppendSpy).toHaveBeenCalledOnce()` in the addNote path. All new tests green under B-5's full suite.
- **Re-do instructions:**
  1. Route via `command-center/AGENTS.md`: assign the rollback/integration test authoring to **test-automator** (real-transaction pglite harness) with **postgres-pro** consulted on the transaction/ROLLBACK assertion shape (isolation + orphan-row query). Do NOT let the orchestrator hand-edit.
  2. test-automator: add a pglite-backed suite instantiating the real `PipelineRepository` + real `PipelineService`, with `AuditService.append` stubbed to reject; assert zero `pipeline` and zero `pipeline_events` rows after a failed `enrollAsActor` and after a failed `addNoteAsActor`.
  3. Add enroll + transition audit-ordering call-order assertions and the `toHaveBeenCalledOnce()` audit-count assertion for addNote.
  4. Re-run B-5 (lint + typecheck + full unit/integration + build). Then re-enter B-6 Action 0 for a fresh head-builder spawn (attempt 2).

### Cascade

B-block cascade rules (apply where the rework stage is the trigger):

| Trigger stage | Stages that must re-run downstream |
|---|---|
| B-5 verify | (terminal — only itself) |

- **Stages that must re-run after the above:** B-5 (re-run full suite after the new tests land), then B-6 (fresh gate).
- **Stages that stay untouched:** B-0, B-1, B-2, B-3, B-4 — no schema, contract, service, frontend, or wiring change is required; the implementation code is correct. This is test-coverage rework only.

## Escalation  (only if ESCALATE)
- N/A

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---

# Wave 12 — B-6 Verdict (attempt 2)

**Reviewer:** head-builder (fresh spawn, agentId head-builder-b6-w12-a2)
**Reviewed against:** commit 9d0bc82 / 3b34324 (test-only rework), attempt-1 REWORK instructions (B-5 scope)
**Attempt:** 2  (post-rework re-gate)

## Verdict
APPROVED

## Rationale
The single load-bearing gap from attempt-1 is genuinely closed. Attempt-1 REWORK was scoped to B-5 ONLY: the audit-rollback compliance invariant ("audit append throws mid-txn → whole mutation rolls back, no orphan pipeline/pipeline_events row") was asserted against a mocked `runInTransaction` (`vi.fn` passthrough calling `work({})`), so the real `db.transaction()` ROLLBACK path had zero coverage — hollow-test theater on exactly the invariant this gate protects. The rework adds `apps/api/test/pipeline-gate.e2e-spec.ts` (599 lines), a self-migrating real-DB e2e mirroring the proven wave-11 outreach-gate pattern, and it closes the gap for real, not cosmetically. **Real transaction, not mocked:** the suite instantiates the REAL `PipelineRepository` + REAL `PipelineService` + REAL `AuditService` (keyring→repository ctor order, the wave-11 lesson) against `TEST_DATABASE_URL`; `runInTransaction` is never spied — it delegates directly to `this.db.transaction(work)` (repository:103-104), and `appendAudit` awaits `auditService.append(input, tx)` as the LAST write inside the `runInTransaction` block on all three paths (enroll:174, transition:259, note:327), with no try/catch swallow. The tests spy ONLY `auditService.append` with `mockRejectedValueOnce`, so the rejection propagates out of Drizzle's transaction callback → a real Postgres ROLLBACK. **The 4 proofs are genuine** (independently confirmed by postgres-pro, no false-green path given the seeded `send_eligible` fixture): (1) enroll audit-throw → pipeline + enrolled-event counts unchanged, read AFTER via a separate autocommit `db.execute` (isolation-safe, reads only committed state); (2) addNote audit-throw → zero new note events after a real prior commit; (3) happy-path enroll+transition+addNote → exactly 1 enrolled/stage_changed/note event and `audit_log_entries` +1 per action, all asserted against committed rows (values from `.returning()`, not tautological); (4) idempotent 2nd enroll → the real partial-unique index raises 23505 → `ConflictException` with unchanged row count. **It will actually RUN (no Ghost Green):** the `test/**/*.{spec,test,e2e-spec}.ts` vitest glob (vitest.config.ts:20) collects the file — the wave-11 uncollected-test lesson held via the `.e2e-spec.ts` suffix; locally `TEST_DATABASE_URL` is unset so `describe.skipIf` skips clean (4 tests / 4 skipped, api 635 pass + 11 skipped); in CI, ci.yml creates `dealflow_test` and sets `TEST_DATABASE_URL`, and `beforeAll` self-migrates via the drizzle migrator against `src/db/migrations` before executing all 4 against real Postgres. **No implementation drift:** `git diff 9d0bc82^..3b34324` touched only the e2e-spec and this gate-verdict — zero changes under `apps/api/src/modules/pipeline/**` — so the attempt-1 code APPROVAL stands untouched. Attempt-1 invariants re-confirmed on a light pass: actor identity resolved via `getUserWithRole` (raw SuperTokens id never persisted as actor), eligible-source guard (`send_eligible` else 400), fixed-enum transition re-guarded against `pipelineStageEnum.options`, pipeline_events append-only (no update/delete path), boundaries clean (no Anthropic/LLM, no email SDK, no webhook/send). The compliance invariant the B-gate exists to protect — no orphan business row without its audit entry — is now proven against the real transaction boundary in CI. Nothing hollow remains.

## Rework instructions  (only if REWORK)
- N/A

## Escalation  (only if ESCALATE)
- N/A

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---

# Wave 12 — B-6 Verdict (Phase 2 — /review code-reviewer)
**Attempt:** 1 (Phase 2)
## Verdict: REWORK (1 HIGH + 2 MEDIUM; clean at CRITICAL)
- **H-1 (HIGH — compliance provenance):** enroll input carries caller-supplied mandateId, but the eligible-source guard (pipeline.service.ts:130-197 + repository findOutreachByIdInTx/findMatchCandidateEligibilityInTx) NEVER verifies the source (outreach/match_candidate) belongs to that mandateId. Advisor can enroll a mandate-A source under mandate B → false mandate association in the pipeline row + every downstream pipeline_events + audit_log_entries row. Single-mandate fixtures hid it. FIX: select the source's mandate_id in the guard (outreach.mandateId / matchRun.mandateId via the existing join) + reject 400 if != input.mandateId, IN-TX before insertPipeline; + a divergent-mandate spec test (source mandate A, enroll mandate B → 400, no row).
- **M-1 (MEDIUM):** the 5 new /pipeline sub-routes (/pipeline/new, /:id, /:id/stage, /:id/notes, /:id/events) are NOT in the pinned rbac.test matrix (subset assertion, no length-equality) → the write-vs-read RBAC split unpinned. FIX: add the 5 patterns + exact roles to matrixRows.
- **M-2 (MEDIUM):** board SSR fetch (page.tsx:120-137) collapses any non-OK/parse-fail to an empty 7-column board — a real board-shape regression renders as benign-empty (the wave-8/9/10/11 drift class). Events path is fine (surfaces errors). FIX: distinguish fetch-error from empty-board in the SSR path (error flag → distinct client state).
- LOW (no action, consistent w/ codebase): L-1 getEvents 2-query non-tx read (harmless append-only), L-2 single-level cause unwrap, L-3 local boardResponseSchema dup.
## Clean (verified): audit-last-in-txn (3 paths, real rollback), idempotent-enroll race (DB partial-unique+409), actor-id, fixed-enum+append-only, SQL-safety (sql-tag fixtures), migration 0011 additive+distinct-enums+journal, response-shape (SSR+proxy), RBAC+provenance (no send/AI).
## Footer
```yaml
verdict_complete: true
phase1_head_builder: APPROVED (attempt 2)
phase2_review: REWORK
criticals: 0
highs: [H-1-cross-mandate-enrollment]
routed: [backend-developer (H-1 mandate-consistency + M-1 rbac-matrix-pin), nextjs-developer (M-2 board-error-state)]
rework_attempt_cap_remaining: 2
```

---

# Wave 12 — B-6 Verdict (Phase 2 REWORK RE-VERIFY) → APPROVED
**Reviewer:** code-reviewer (fresh re-review of fix commits 438579d + 2e9475b)
**Attempt:** 2 (post-rework)
## Verdict: CONFIRMED-RESOLVED → **B-6 APPROVED (overall)**
- **H-1 RESOLVED** — findOutreachByIdInTx + findMatchCandidateEligibilityInTx now project the source mandate_id (outreach.mandate_id; match_run.mandate_id via join); enrollAsActor compares source.mandateId !== input.mandateId → 400 IN-TX before insertPipeline, for BOTH source types. Un-bypassable: insertPipeline has exactly ONE call site, reachable only after both guards. 2 divergent-mandate spec tests genuine (mandate A source + mandate B enroll → 400 + insertPipeline not-called), both paths.
- **M-1 RESOLVED** — 5 /pipeline sub-routes pinned in rbac.test matrixRows with exact roles; completeness loop toEqual would FAIL CI on any role-widening.
- **M-2 RESOLVED** — fetchBoard returns discriminated BoardResult; non-OK/parse-fail → error banner (role=alert + retry), mutually exclusive with the 7-column render; 3 genuine tests (500/403 → alert + no columns; OK+empty → 7 columns + no alert).
No regressions (e2e enroll happy-path passes matching mandate; select-projection change additive; attempt-1 invariants intact). No new CRITICAL/HIGH. Suites green: pipeline.spec 44, rbac.test 240, page.test 22; full repo 463+637+453.
Minor (non-blocking, build hygiene): apps/api/dist/ has stale compiled output — source authoritative, dist gitignored.
## Footer
```yaml
verdict_complete: true
verdict: APPROVED
phase1_head_builder: APPROVED
phase2_review: REWORK→CONFIRMED-RESOLVED
rework_attempts_used: 1
gate: PASSED
```

---
## B-block exit
```yaml
build_block_status: complete
branch: wave-12-pipeline-tracking
review_verdict: APPROVE
last_commit_sha: 4531a9f
ready_for_ci: true
```
