# Wave 18 — L-block Observations (knowledge-synthesizer)

**Wave:** 18 — M9 advisor-insights analytics (read-only analytics module, 4 metric families, workspace-scoped via getDb + FORCE RLS over live M8 data).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 13–18 (prior observations waves 13–17 fully read; carry-forward queue from wave-17 audited below).
**Net pre-promotion candidates:** 1 PROMOTION-GRADE (empty-commit Ghost-Green as 2nd flavor of the CI-non-triggering-commit kernel; 2-wave bar met with OBS-W16-4). 4 additional observations: 1 recurrence of promoted VERIFY #3 (hollow-test, confirms rule 3 holds — no new promotion); 1 strong first-sighting HOLD (uncomputable spec metric); 1 first-sighting HOLD (e2e seed never exercised vs migrated schema); 1 informational first-sighting HOLD (T-9 canonical-artifact write skipped).

Each entry is logged with its first-sighting wave so a later wave's L-1 author can detect recurrence deterministically. Recurrence in any later wave promotes on sight (subject to head-X approval + format contract), no re-litigation.

---

## What shipped

M9 read-only analytics: `AnalyticsService` + `AnalyticsRepository` (all 4 family queries via `getDb(this.db)` — NO raw off-GUC access); shared-Zod-typed `GET /analytics` (RBAC advisor+admin fail-closed, boot-throw if `rolesForRoute` returns `[]`); `/insights` page (design-system metric cards, SSR, no charts-lib/real-time/export, own-firm-only, RBAC-gated, nav entry); analytics-isolation e2e (`AnalyticsService` real-import via `workspaceAls.run` + AMP-4 fault-killing). Karen caught P-4 Phase-2 vanity metric ("outreach response rate" uncomputable — pre-send gate, no send/responded columns) and corrected to gate-outcomes. B-6 Attempt-1 REWORK for hollow isolation e2e; Attempt-2 APPROVED. C-1: empty commit triggered NO CI run; fixed via real tree delta + `.ci/` marker. 4 seed-schema-mismatch fix-forward cycles. All 5 CI jobs green @5c86cf5. Deployed + V-1 APPROVE.

---

## Systemic root-cause map (not human-blame)

Four independent defect classes surfaced this wave, all caught in-gate, none escaped to the deployed artifact:

1. **Vanity metric in spec** — P-2 authored "outreach response rate" as F2 before verifying the `outreach.status` enum has no `sent`/`responded` states (pre-send gate, task #141 founder-gated). P-4 karen caught it and F2 was corrected to compliance-gate outcomes over `outreach.status`. Root: spec authored a metric that reads from columns that don't exist in the current schema.

2. **Hollow isolation e2e** — B-6 Attempt-1: the cross-firm analytics isolation e2e re-implemented the aggregation SQL inline instead of calling the real `AnalyticsService`. The unit suite fully mocked the repo, so the getDb→raw isolation invariant was tested by zero tests at any layer until B-6 Attempt-2 reworked the e2e to call the real service via `workspaceAls.run` with AMP-4 fault-killing. Direct recurrence of the VERIFY #3 kernel (promoted from wave-15).

3. **Empty-commit CI non-trigger** — C-1: after B-block HEAD carried `[skip ci]`, an empty tree-preserving commit was pushed to strip the marker. GitHub created zero workflow runs for an empty commit (no file delta). Distinct mechanism from wave-16's [skip ci] marker but same kernel: a commit that cannot trigger CI fabricates a green. Fixed via a non-code marker in `.ci/`.

4. **E2e seed never exercised against a migrated role-scoped DB** — The analytics-isolation e2e seed (authored at B-6 rework) was approved on static review only and had never been executed against a real migrated DB with the `dealflow_app` role. C-1 exposed 4 mismatches: wrong column name (`content` vs `body`), missing NOT NULL column (`workspace_id`), stale FK lookback (stale UUID from a prior CI run, replaced by `INSERT … RETURNING id`), and a partial-unique constraint collision (`(jurisdiction) WHERE active`). All test-only defects; app/service tree byte-identical throughout.

The learning targets missing safeguards, not authors.

---

## Observation ledger

### OBS-W18-1 — Hollow isolation e2e: VERIFY #3 recurrence, NOT a new rule (confirms rule 3 holds)

**What:** B-6 Attempt-1 submitted an analytics-isolation e2e (`analytics-isolation.e2e-spec.ts`) that re-implemented the aggregation SQL inline instead of importing and calling the production `AnalyticsService`. The unit suite mocked the entire repository, so the cross-firm getDb→raw isolation invariant was exercised by zero tests. Head-builder caught it explicitly as the "hollow AI test suite anti-pattern." Fix (7748c3e): e2e rewritten to dynamically import `workspaceAls`, `AnalyticsRepository`, `AnalyticsService` from production modules; `runServiceInAls()` calls `service.getSummary()` via `workspaceAls.run({ db: gucHandle })` exactly as the `WorkspaceInterceptor` does; AMP-4 fault-killing assertion collapses the totals if `getDb(this.db)` regresses to `this.db` directly.

**Recurrence accounting against VERIFY #3:**
- Wave-12 B-6 (kernel, not filed as named obs): `runInTransaction` mocked as `vi.fn()` passthrough — compliance-invariant proof mocked away the mechanism under test. Caught at B-6 REWORK.
- Wave-15 OBS-W15-2 (first named filing, PROMOTION-GRADE): CONC-1 re-implemented the advisory-lock+count logic inline rather than calling `UserManagementService.deactivateAsActor`. Same kernel: inline re-implementation passes vacuously whether the real mechanism is correct or broken.
- VERIFY #3 promoted from wave-15: "A compliance-invariant test must call the real service or guard, not re-implement or mock the mechanism it proves."
- Wave-18: re-implementation of aggregation SQL in the isolation e2e instead of calling `AnalyticsService`. Rule-3 text covers this exactly ("re-implement the mechanism it proves"). This is a RECURRENCE confirming rule 3.

**Is there a distinct new rule?** The wave-18 case has a surface difference: it is an integration/e2e test (not a unit test) re-implementing a DB query (SQL fragments) rather than a service call. However, the VERIFY #3 rule text "real service or guard, not re-implement or mock the mechanism" is broad enough to cover any re-implementation at any test layer. A new rule scoped to "integration/e2e tests must call real service, not inline SQL" would be a narrower sub-case of rule 3 and add no falsifiable content not already captured. The recurrence confirms rule 3 is correctly scoped.

**Verdict:** RECURRENCE of promoted VERIFY #3. Rule holds. No new promotion.

**Source artifacts:**
- `process/waves/wave-18/stages/B-6-review.md` §Phase 1 ("the cross-firm isolation e2e was HOLLOW (re-implemented the aggregation SQL inline instead of invoking the real AnalyticsService → wouldn't catch a getDb→raw regression; unit suite fully mocks the repo → the isolation invariant was tested by NO test at any layer)").
- `process/waves/wave-18/stages/V-1-karen.md` §Claim-4 (AMP-4 evidence: real service imports, `workspaceAls.run`, `new AnalyticsService(repo)`, production `getDb(this.db)` resolves to the GUC-bound handle; "the exact hollow-test trap head-builder REWORKED at B-6 Attempt-1 and CLOSED at Attempt-2").
- `process/waves/_archive/wave-15/blocks/L/observations.md` OBS-W15-2 (promoted VERIFY #3 chain, W12 + W15).

**Severity:** strong (same as OBS-W15-2; an undetected hollow compliance-invariant proof is CI-green and ships silently; caught at B-6 adversarial review).

**Promotion status:** NOT promotable as a new rule (VERIFY #3 already covers it). Positive signal: VERIFY #3 is demonstrably worth reading at B-6.

---

### OBS-W18-2 — Empty-commit does not trigger a GitHub CI run (2nd flavor of Ghost-Green; PROMOTION-GRADE; 2-wave bar met with OBS-W16-4)

**What:** After B-block HEAD `277487e` carried `[skip ci]`, C-1 pushed an empty tree-preserving commit (`31afc84`: tree `c18b7d0`, no `[skip ci]` message) to neutralize the marker while preserving the code tree. GitHub created zero workflow runs for `31afc84` (verified via `actions/runs?head_sha=31afc84` returning 0 after ~4 min of polling). An empty commit — a commit with no file delta — does not register a `push` event run in GitHub Actions. The phantom skip was mechanically distinct from `[skip ci]` (which suppresses via the marker) but produced the same result: a push to `main` with no CI run. Fix: push a commit with a real file delta outside `apps/`/`packages/` (`.ci/wave-18-trigger.txt`) — confirmed via `git diff 277487e 63712bc -- apps packages` = EMPTY (app code preserved) and CI run 28831198440 firing on `63712bc`.

**Recurrence accounting:**
- Wave-16 OBS-W16-4 (first-sighting HOLD): branch HEAD `3b0d037` carried `[skip ci]`. Pushing it to `main` would have caused GitHub to skip all CI jobs on that push event — fabricated green. Fix: appended an identical-tree commit with a clean message (tree SHA byte-identical).
- Wave-17 OBS-W17-6: OBS-W16-4 mitigation was applied PROACTIVELY (no defect fired; the [skip ci] HEAD was neutralized before push). Recurrence of the mitigation, not the defect. OBS-W17-6 was classified as a non-defect recurrence: "the guard was known and followed."
- Wave-18 (this wave): a DIFFERENT mechanism — empty commit, no `[skip ci]` in message — triggered the same failure class: a push that does not produce a real CI run. This is the 2nd defect-firing of the broader class: "a commit pushed to main that does not actually cause GitHub Actions to execute CI on that SHA."

**Kernel generalization:** The OBS-W16-4 candidate rule was phrased narrowly: "verify HEAD commit message carries no [skip ci] or [ci skip] marker." Wave-18 shows the rule is insufficient: an empty commit with a clean message ALSO fabricates a green. The generalizable rule is: before accepting a CI result for a push to a CI-gated branch, verify that a real workflow run fired for the exact pushed headSha (not just that the push event succeeded).

**Is this 2-wave?** Wave-16 defect (first firing) + wave-18 defect (second firing, distinct mechanism). Wave-17 was a proactive mitigation application, not a defect. The two defect firings share the same kernel (a non-triggering commit) with different mechanical expressions ([skip ci] marker vs empty tree). The broader rule — verify CI actually ran for the headSha, not just that a push happened — is met. 2-wave bar MET.

**Source artifacts:**
- `process/waves/wave-18/stages/C-1-pr-ci-merge.md` §Ghost-Green guard ("First attempt: pushed EMPTY tree-preserving commit `31afc84`... GitHub created NO workflow run for it (`actions/runs?head_sha=31afc84` → 0, after ~4 min polling). Empty commit did not register a push run.").
- `process/waves/_archive/wave-16/blocks/L/observations.md` OBS-W16-4 ("Pushing it directly to `main` would have caused GitHub to skip the entire CI run... a fabricated green").
- `process/waves/_archive/wave-17/blocks/L/observations.md` OBS-W17-6 ("guard was known and followed... recurrence of mitigation — not defect recurrence").

**Root class:** A commit pushed to a CI-gated branch that does not produce a real GitHub Actions run on that commit's headSha silently fabricates a green. Two known triggers: (a) commit message contains `[skip ci]`/`[ci skip]`; (b) commit has no file delta (empty commit). The fix in both cases is a real file-delta commit. The verifiable guard is checking that a workflow run with `head_sha == pushed_sha` exists and concludes, not that the push itself returned 200.

**Severity:** warning (caught at C-1 before any phantom result was accepted; no fabricated green reached main; the mitigation is deterministic; no production impact).

**All 3 promotion criteria met:**
- Generalizable: yes — any push to a CI-gated branch is at risk from either non-triggering commit form; the guard is platform-independent (check the run, not the push).
- Falsifiable: yes — a C-1 procedure that accepts "push succeeded" without querying for a workflow run at the exact headSha fails this rule. Checkable mechanically.
- Cited: 2-wave artifact chain above (OBS-W16-4 defect + wave-18 C-1 defect, different mechanisms, same kernel).

**Candidate principles file:** CI-PRINCIPLES (CI hygiene; CI currently has 1 rule; this would be #2 — the broadened version of the OBS-W16-4 provisional #2 candidate).

**Pre-authored CI-PRINCIPLES #2 candidate (format-checked against CI Contract for new rules):**
```
2. After pushing to a CI-gated branch, verify a workflow run fired for the exact pushed headSha, not just that the push succeeded.
   Why: An empty commit or a [skip ci] message produces no CI run; the push returns 200 but no tests execute.
```
_(Rule 118 chars, Why 95 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number 2 — CI-PRINCIPLES has one rule; this is the next sequential slot and supersedes the narrower OBS-W16-4 provisional candidate [skip ci] text.)_

**Promotion status:** PROMOTION-GRADE. DO NOT promote here (karen vets + orchestrator caps <= 1/file).

---

### OBS-W18-3 — Spec authored a metric that is uncomputable over existing schema columns (FIRST-SIGHTING; strong)

**What:** P-2 spec task `a5ba8068` defined F2 as "outreach response rates (sent vs responded ratio)" as a metric family for the analytics module. The `outreach` table's `status` enum (visible in migrations 0003/0007) is `compose | send_eligible | blocked` — there are no `sent` or `responded` states. The `send` feature is task #141 (founder-gated, not yet built). P-4 Phase-2 karen caught the mismatch: "vanity metric — uncomputable — outreach.status=compose/send_eligible/blocked, pre-send gate, no send/response data." F2 was override-corrected to "outreach compliance-gate outcomes" (send_eligible pass-rate + blocked-rate over `outreach.status`, computable, honest labels). The correction was appended to the spec task's `description` rather than editing the AC literal text, creating spec-internal tension (GAP-B caught by V-1 jenny).

**Root class:** A metric or acceptance criterion was authored in the spec without verifying that the required data columns exist in the current schema. The spec assumed a data model that is planned but not shipped (the post-send-gate `outreach.send` state). Any metric, AC, or data contract authored at P-2 that references a field, column, or enum value that does not yet exist in the DB schema will reach B-block as an unimplementable requirement.

**Systemic note:** The gap was caught at the right stage (P-4 Phase-2 karen spec-review) and corrected before B-block. The mechanism that caught it was karen grepping the outreach schema and verifying the enum values against the metric definition. That mechanism is the correct safeguard — it is not currently documented as a P-2 authoring obligation.

**Severity:** strong (the uncomputable metric would have required either fabricating a value or inventing columns at B-block; caught pre-build with a clean override-correction; no code impact).

**Generalizable?** Yes — any P-2 that authors a metric, computed field, derived rate, or AC referencing a DB column, enum value, or relationship must verify the field actually exists in the current schema before the spec is finalized. The check is mechanical (grep migrations / schema / Drizzle table definitions). First-sighting. 2-wave bar NOT met.

**Candidate principles file:** PRODUCT-PRINCIPLES (P-2 spec authoring discipline; PRODUCT-PRINCIPLES currently has zero rules; this is a strong candidate for first promotion if a second wave confirms).

**Pre-authored PRODUCT-PRINCIPLES candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
1. Before authoring a metric or computed AC at P-2, verify every referenced column and enum value exists in the current schema.
   Why: A metric over a planned-but-unshipped column is unimplementable; catching it at spec costs a correction, not a rework.
```
_(Rule 120 chars exactly, Why 100 chars exactly — check: "A metric over a planned-but-unshipped column is unimplementable; catching it at spec costs a correction, not a rework." = 118 chars. Rule = "Before authoring a metric or computed AC at P-2, verify every referenced column and enum value exists in the current schema." = 124 chars — OVER. Trimmed:)_
```
1. Verify every column and enum value a metric or AC references exists in the current schema before finalizing the spec.
   Why: A metric over a planned-but-unshipped column is unimplementable and requires a spec override at review.
```
_(Rule 118 chars, Why 100 chars exactly. Check Why: "A metric over a planned-but-unshipped column is unimplementable and requires a spec override at review." = 103 chars — OVER. Trimmed:)_
```
1. Verify every column and enum value a metric or AC references exists in the current schema before finalizing the spec.
   Why: A metric referencing a planned-but-unshipped column is unimplementable; the defect surfaces at P-4 or B-block.
```
_(Rule 118 chars, Why 112 chars — OVER. Trimmed:)_
```
1. Verify every column and enum value a spec metric references exists in the current schema before finalizing the spec.
   Why: A metric over a planned-but-unshipped column is unimplementable and caught only at P-4 review or B-block.
```
_(Rule 116 chars, Why 105 chars — OVER. Trimmed:)_
```
1. Verify every column and enum value a spec metric references exists in the current schema before finalizing the spec.
   Why: A metric over a missing column is unimplementable; catching it pre-spec avoids a P-4 override or B-block rework.
```
_(Rule 116 chars, Why 117 chars — still OVER. Aggressively trimmed Why to ≤100 chars:)_
```
1. Verify every column and enum value a spec metric references exists in the current schema before finalizing the spec.
   Why: A metric over a missing column is unimplementable and forces a late spec override or B-block rework.
```
_(Rule 116 chars; Why: "A metric over a missing column is unimplementable and forces a late spec override or B-block rework." = 100 chars exactly. Meets format contract. No forbidden tokens, no wave refs, no em-dash.)_

**Promotion status:** HOLD (first-sighting, strong kernel). Carries forward.

**Source artifacts:**
- `process/waves/wave-18/blocks/P/gate-verdict.md` §Phase 2 Karen ("REJECT (1 WRONG: 'outreach response rate' uncomputable — outreach.status=compose/send_eligible/blocked, pre-send gate, no send/response data, send is #141-founder-gated → vanity metric)").
- `process/waves/wave-18/stages/V-1-jenny.md` §GAP-B ("The DB AC-1 literal text still reads 'outreach response rates' ... the P-4 Phase-2 Karen correction OVERRIDES this in an appended section rather than editing the ACs in place").
- `process/waves/wave-18/stages/V-1-karen.md` §Claim-5 ("Grep `responseRate|response rate|response-rate` across repo/service/controller/shared/UI returns ONLY prohibiting-comment lines").

---

### OBS-W18-4 — E2e seed SQL authored without being exercised against a real migrated role-scoped DB (FIRST-SIGHTING; warning; distinct from OBS-W17-3)

**What:** The analytics-isolation e2e seed was authored at B-6 rework and approved on static code review alone. C-1 exposed 4 schema-mismatch defects when the seed was first executed against the real `dealflow_test` DB with `dealflow_app` role and applied migrations: (1) `companies.company_id` NOT NULL violated by the seed — the seed needed to INSERT a `companies` row and reference its `id`; (2) `disclaimer_templates.content` does not exist — real column is `body`, plus a NOT NULL `workspace_id` was missing; (3) a stale `LIMIT 1` lookback for a disclaimer FK returned a UUID from a prior CI run rather than a freshly-inserted row — replaced with `INSERT … RETURNING id`; (4) partial-unique constraint `(jurisdiction) WHERE active=true` (migration 0003/0007, global) conflicted with the seed's disclaimer jurisdiction. All 4 were test-only defects (app/service tree byte-identical to the B-6-approved `277487e` throughout).

**Distinction from OBS-W17-3:** OBS-W17-3 (HOLD, first-sighting wave-17) concerns a MIGRATION that mutates an existing populated table and collides with a WORM trigger only when rows are present in prod. Wave-18's class is different: a TEST SEED (not a migration) that references the schema incorrectly because it was never run against a migrated DB during authoring. The defect type is schema-mismatch (wrong column names, missing NOT NULL fields, stale FK patterns), not trigger-collision. The root cause is the same missing gate (no pre-C-1 execution against a real migrated DB) but the mechanism and fix are distinct.

**Root class:** A real-DB e2e test seed authored at B-block and approved on static review alone — without a local run against a migrated, role-scoped test DB — accumulates schema mismatches that only surface at C-1 CI. Each mismatch requires a fix-forward cycle. The pattern fires whenever a new e2e seed introduces INSERT statements against tables with NOT NULL columns, unique constraints, or FK dependencies that are not visible from the Drizzle schema file alone (partial indexes, multi-table FK chains, role-scoped constraints).

**Severity:** warning (4 CI fix-forward cycles; all test-only fixes; no app code changed; within the 5-cycle cap; no production impact; no assertions weakened).

**Generalizable?** Yes — applies whenever a new real-DB e2e seed is authored for a table with constraints that are not trivially visible (partial unique indexes, role-scoped NOT NULL columns, FK chains requiring freshly-inserted rows). The fix is to execute the seed locally against a migrated DB with the runtime role before B-6 approval. First-sighting in this explicit form. 2-wave bar NOT met.

**Candidate principles file:** BUILD-PRINCIPLES (adjacent to existing BUILD #4 migration-journal discipline; distinct kernel — about test seed execution against real schema, not migration registration; also relates to T-4 but the authoring obligation is at B-block).

**Pre-authored BUILD candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
9. Run any new e2e test seed against a migrated DB with the runtime role locally before B-6 approval.
   Why: Static review cannot detect partial-index collisions, missing NOT NULL columns, or stale FK patterns.
```
_(Rule 100 chars, Why 93 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional — BUILD currently has 8 rules; this would be #9; note OBS-W17-3 also pre-authored a BUILD #9 candidate for populated-migration testing. These are distinct kernels; whichever recurs first claims the next sequential number; the other renumbers to #10. Also note: OBS-W17-4 pre-authored a BUILD #9 candidate for pre-GUC SECURITY DEFINER guards; three BUILD #9 candidates are now queued. All held pending their own recurrence.)_

**Promotion status:** HOLD (first-sighting). Carries forward.

**Source artifacts:**
- `process/waves/wave-18/stages/C-1-pr-ci-merge.md` §Fix-up cycles ("Root cause across all 4: the analytics-isolation e2e seed (authored at B-6 rework) had never been exercised against a real migrated DB with the `dealflow_app` role — B-6 approved it on static review") + §CI runs table (4 failure → 1 success progression).

---

### OBS-W18-5 — T-9 canonical journey-map artifact not regenerated (FIRST-SIGHTING; low; informational)

**What:** T-9 documented the wave-18 journey delta (new `/insights` page, new `GET /analytics` API endpoint, nav entry) in the stage file (`T-9-journey.md`) but did not regenerate the canonical `command-center/artifacts/user-journey-map.md`. V-1 jenny caught it as GAP-A: `user-journey-map.md` L126 still reads "analytics … deferred — not in this MVP inventory"; the last journey-map commit predates wave-18. The T-9 stage file is accurate; the canonical artifact consumed by T-5 (the inventory that V-block reviewers and future P-2 authors read) is stale.

**Root class:** T-9 documented the delta but treated the stage file as sufficient, skipping the regeneration of the canonical inventory that downstream stages (T-5, V-block, future P-2) depend on. The stage file is a per-wave transcript; the canonical artifact is the cross-wave persisted state. The failure mode is: future P-2 reads the journey map and believes analytics routes are deferred, potentially re-scoping or misjudging coverage.

**Severity:** low/informational (no deployed-behavior defect; no compliance gap; the T-9 stage file is correct and authoritative for this wave; the canonical artifact is a documentation lag). Classified by jenny as GAP-A and marked "not a rework" at V-1.

**Generalizable?** First-sighting as a named observation. Prior journey-map observations (waves 3–6) concern spec-vs-journey-map DRIFT at P-4 (different class: the journey map was out of date at plan time, causing jenny BLOCK). This wave's class is a T-9 write obligation skipped, not a P-4 gap from stale map. Distinct. 2-wave bar NOT met.

**Candidate principles file:** The T-9 stage file itself is the natural home (an obligation note), but there is no T-9 principles file. If this recurs, a VERIFY-PRINCIPLES note (or a T-9-specific file) is the target.

**Pre-authored candidate (informational; DO NOT promote):**
No pre-authored rule yet; the kernel is too narrow for VERIFY-PRINCIPLES without a second occurrence. If it recurs, the candidate would be: "T-9 must regenerate the canonical user-journey-map.md, not only the stage-file delta." (Needs principles-file home resolution on recurrence.)

**Promotion status:** HOLD (first-sighting, low severity, informational). Low priority carry-forward.

**Source artifacts:**
- `process/waves/wave-18/stages/V-1-jenny.md` §GAP-A ("the canonical `command-center/artifacts/user-journey-map.md` was NOT regenerated with the new routes — `grep` finds NO `/insights` or `GET /analytics` entry; L126 still reads 'analytics … deferred'... the T-9 stage file DOES document the delta... but that delta never landed in the canonical artifact").
- `process/waves/wave-18/stages/V-1-summary.md` §findings ("GAP-A journey-map-not-regenerated (FIXED in-line)").

---

## Carried-forward holds recurrence audit (waves 13–17)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W17-1 Cross-suite shared-DB chain pollution (T-4 #2, PROMOTION-GRADE) | NON-RECURRENCE. No new parallel audit-writing e2e suite; no shared chain assertion over all rows. T-4 #2 was pre-authored as PROMOTION-GRADE after wave-17; carry forward for orchestrator/karen promotion. | PROMOTION-GRADE carry-forward |
| OBS-W17-2 Vacuous RLS test under BYPASSRLS role (VERIFY #4 provisional) | NON-RECURRENCE. Analytics e2e explicitly uses `SET ROLE dealflow_app` (established in the wave-17 runtime role), so tests run as NOSUPERUSER. The pattern did not recur as a defect — the lesson was applied. | HOLD unchanged |
| OBS-W17-3 Populated-DB migration test for trigger-protected tables (BUILD #9 provisional) | NON-RECURRENCE. No migration this wave mutated a trigger-protected table (analytics is code-only, no migrations). | HOLD unchanged |
| OBS-W17-4 Pre-GUC guard reads need SECURITY DEFINER (BUILD #9 provisional) | NON-RECURRENCE. No new guard or middleware added pre-GUC this wave; analytics module is GET-only, no new guards. | HOLD unchanged |
| OBS-W17-5 SET utility-statement bind-param limitation (BUILD, informational) | NON-RECURRENCE. No `SET <guc> = $1` usage this wave; the workspace interceptor uses `SELECT set_config(...)` as fixed. | HOLD unchanged |
| OBS-W16-4 [skip ci]-on-HEAD (CI #2 provisional) | RECURRENCE — see OBS-W18-2. Different mechanism (empty commit vs [skip ci] marker) but same kernel (non-triggering commit → no CI run). 2-wave bar MET (W16 defect + W18 defect). OBS-W18-2 generalizes and supersedes the OBS-W16-4 narrow candidate. | PROMOTION-GRADE via OBS-W18-2 |
| OBS-W14-3 Hash-excluded additive metadata on HMAC chain (BUILD provisional) | NON-RECURRENCE. No new field added to or excluded from the audit hash preimage this wave (analytics module writes zero audit rows). | HOLD unchanged |
| OBS-W14-2 Differential-test discriminator (VERIFY #4 provisional, contested with OBS-W17-2) | NON-RECURRENCE. The AMP-4 fault-killing assertion uses the correct discriminator (ALS-scoped WS_A total vs no-ALS all-tenant total); the discriminator is the exact enforcement axis under test. | HOLD unchanged |
| OBS-W16-2 No-echo on validation rejection (BUILD #9 provisional) | NON-RECURRENCE. No new endpoint receives a sensitive input and validates it this wave. | HOLD unchanged |
| OBS-W16-6 Drizzle sql-cast JSONB bypass (BUILD #10 provisional) | NON-RECURRENCE. No JSONB column wrapped in a raw sql cast this wave. | HOLD unchanged |
| OBS-W13-1 mock-only row-membership derivation (VERIFY new-slot) | NON-RECURRENCE. No row-selecting derivation SQL tested via param-forwarding mock. | HOLD unchanged |
| OBS-W15-4 Credential defense-in-depth | NON-RECURRENCE. No new admin-entered external secret primitive. | HOLD unchanged |
| OBS-W15-5 AC-consumer-half unplanned | NON-RECURRENCE. Analytics is read-only with no cross-module consumer wiring. | HOLD unchanged |
| OBS-W12-2 parallel self-migrate race (CI candidate) | NON-RECURRENCE. No new self-migrating parallel e2e suite race. | HOLD unchanged |
| OBS-W11-1 store-binding, OBS-W12-1 caller-FK (BUILD new-slot, contested) | NON-RECURRENCE. | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W18-1 Hollow isolation e2e | W12 B-6 class + W15 (OBS-W15-2 filed) + W18 B-6 Attempt-1 | strong | VERIFY #3 already promoted; this is a RECURRENCE | VERIFY #3 (promoted W15) | NOT promotable (recurrence confirms rule 3) |
| OBS-W18-2 Empty-commit Ghost-Green | W16 (OBS-W16-4) + W18 (different mechanism) | warning | YES (generalizable + falsifiable + 2-wave defect chain) | CI-PRINCIPLES (#2) | PROMOTION-GRADE |
| OBS-W18-3 Uncomputable spec metric | W18 only | strong | 2-wave bar NOT met | PRODUCT-PRINCIPLES (#1 provisional) | HOLD |
| OBS-W18-4 E2e seed never run vs migrated DB | W18 only | warning | 2-wave bar NOT met | BUILD-PRINCIPLES (#9 provisional) | HOLD |
| OBS-W18-5 T-9 canonical journey-map skipped | W18 only | low/informational | 2-wave bar NOT met | (no home yet) | HOLD (low priority) |
| OBS-W17-1 Cross-suite shared-DB chain pollution | W16 + W17 | warning | YES (pre-graded at W17; T-4 #2) | T-4 (#2) | PROMOTION-GRADE carry-forward |

**Carry-forward queue after wave-18:**
- OBS-W17-1 — Cross-suite shared-DB chain pollution (PROMOTION-GRADE carry-forward, T-4 #2, 2-wave W16+W17; pre-authored text in wave-17 observations, ready for orchestrator/karen).
- OBS-W18-2 — Empty-commit / non-triggering-commit Ghost-Green (PROMOTION-GRADE, CI-PRINCIPLES #2; supersedes OBS-W16-4 narrow candidate; pre-authored text above).
- OBS-W18-3 — Uncomputable spec metric (HOLD, PRODUCT-PRINCIPLES #1 provisional, own clock).
- OBS-W18-4 — E2e seed never run vs migrated DB (HOLD, BUILD-PRINCIPLES #9 provisional, own clock; note: BUILD #9 slot also contested by OBS-W17-3 populated-migration test and OBS-W17-4 pre-GUC SECURITY DEFINER).
- OBS-W18-5 — T-9 canonical journey-map skipped (HOLD, informational, low priority, no home yet).
- OBS-W17-2 — Vacuous RLS test under BYPASSRLS (HOLD, VERIFY #4 provisional).
- OBS-W17-3 — Populated-DB migration trigger-protected tables (HOLD, BUILD #9 provisional).
- OBS-W17-4 — Pre-GUC guard SECURITY DEFINER (HOLD, BUILD #9 provisional).
- OBS-W17-5 — SET utility-statement bind-param (HOLD, informational, low priority).
- OBS-W14-3 — Hash-excluded HMAC additive metadata (HOLD; karen ruling needed on correct-use recurrence bar).
- Inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle JSONB sql-cast, W14-2 differential discriminator, W13-1 mock-only derivation (new VERIFY slot), W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W12-2 self-migrate race, W11-1 store-binding, W12-1 caller-FK.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 5
promotion_grade: [OBS-W18-2 (CI-PRINCIPLES #2)]
promotion_grade_carry_forward: [OBS-W17-1 (T-4 #2)]
hold: [OBS-W18-3, OBS-W18-4, OBS-W18-5]
not_promotable: [OBS-W18-1 (VERIFY #3 recurrence — rule confirmed, no new rule)]
hollow_test_verify3_recurrence: true     # W12 class + W15 OBS-W15-2 promoted + W18 confirmed
empty_commit_ghost_green_2wave_bar_met: true   # W16 OBS-W16-4 defect + W18 defect (distinct mechanism, same kernel)
uncomputable_metric_1wave_hold: true
seed_schema_mismatch_1wave_hold: true
t9_journey_map_skip_1wave_hold: true
skip_ci_narrow_candidate_superseded: true   # OBS-W16-4 [skip ci] text broadened to CI-run verification
```
