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
