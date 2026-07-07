# Wave 19 — L-block Observations (knowledge-synthesizer)

**Wave:** 19 — M9 matching-feedback calibration (read-only calibration aggregation over match_candidates, 4 blocks).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 14–19 (prior observations waves 14–18 fully read; carry-forward queue from wave-18 audited below).
**Net pre-promotion candidates:** 2 PROMOTION-GRADE (metric-honesty 2-wave bar met — OBS-W18-3 was first sighting, wave-19 is the second; seed/fixture-vs-real-DB 2-wave bar met — OBS-W18-4 was first sighting, wave-19 is the second). 1 validation observation (CI rule 2 confirmed by wave-19). 1 informational process observation (P-4 obligation as lesson-forwarding). No new promotions done here — flagged for L-2 orchestrator + karen.

Each entry is logged with its first-sighting wave so a later wave's L-1 author can detect recurrence deterministically.

---

## What shipped

M9 matching-feedback calibration: `MatchFeedbackService` + `MatchFeedbackRepository` (all queries via `getDb(this.db)` — no raw off-GUC access); shared-Zod-typed `GET /match-feedback` (RBAC advisor+admin fail-closed); `/insights` calibration section (design-system cards/table, SSR, no charts-lib/real-time/export, own-firm-only, RBAC-gated). 2-dimension lift (tieBreak noise-dimension dropped at B-6 /review; small-sample caveat added). match-feedback-isolation.e2e 7/7 REAL service via `workspaceAls.run` as `dealflow_app` FORCE RLS, MFC-4 fault-killing. B-6 /review caught 2 metric-honesty issues (noise dimension + missing small-sample caveat), both fixed in-branch. C-1 attempt-1 RED: invalid-UUID fixtures (non-hex mnemonic literals) crashed `seedWorkspace` (22P02) → 7 tests SKIPPED — caught by CI rule 2 (not accepted as green), classified testing-tag, routed to backend-developer per Iron Law, fixed at `a09fa7b`. C-1 attempt-2 all-5-green @`3cc58de`. Deployed + V-1 APPROVE.

---

## Systemic root-cause map (not human-blame)

Two independent defect classes surfaced this wave, all caught in-gate, none escaped to the deployed artifact:

1. **Metric-honesty issues at B-block** — B-6 /review (adversarial) identified: (a) `tieBreak` = `deterministicTieBreak(candidate.id)`, a pure hash of the row ID, structurally uncorrelated with acceptance by construction — surfacing it as a "dimension lift" presents noise as signal; (b) a 1-row cohort rendered a confident 100% with no caveat — a small-n confidence problem. Both fixed in-branch (commits 6f95607 + 83dddda). Root: spec listed 3 dimensions without classifying predictive vs structural-noise; spec required null-vs-0 but did not require a low-n confidence treatment. Neither was caught at P-4 (the wave-18 computability check passed — the column does exist — but the noise and small-n issues are not column-existence issues).

2. **Invalid-UUID fixture literals** — `match-feedback-isolation.e2e-spec.ts` was authored with mnemonic UUID strings containing non-hex chars (`mfi1`, `st-a`, `st-b`). These were never exercised against a real Postgres DB before CI. On the first CI run (attempt-1), `string_to_uuid` rejected them at `seedWorkspace` (SQLSTATE 22P02) → `beforeAll` throw → all 7 tests SKIPPED. This is a direct recurrence of OBS-W18-4: a test seed/fixture authored without being run against a real migrated role-scoped DB, defect caught at C-1 CI.

The learning targets missing safeguards, not authors.

---

## Observation ledger

### OBS-W19-1 — Metric-honesty: 2nd sighting of OBS-W18-3 with a BROADER kernel (PROMOTION-GRADE; 2-wave bar met)

**What:** B-6 /review caught two metric-honesty defects that were not caught at P-4 spec review:

(a) **Noise dimension:** `tieBreak` = `deterministicTieBreak(candidate.id)` — a deterministic hash of the row ID. This is structurally uncorrelated with advisor acceptance by construction; any apparent lift is a sampling artifact. Surfacing it as "per-dimension acceptance lift" alongside real predictors (`sectorMatch`, `contactCompleteness`) presents noise as signal to M&A advisors. The fix was to drop it from the `DIMENSIONS` array and assert its absence in the e2e (commits 6f95607 backend + 83dddda UI). SOURCE: `process/waves/wave-19/stages/B-6-review.md` §Phase 2 /review ("tieBreak dropped from the per-dimension lift — it was a deterministic hash of the row id — structural noise, uncorrelated with acceptance; surfacing a 'lift' invites reading signal into noise").

(b) **Small-sample over-confidence:** a `decidedCount=1` cohort rendered a confident emerald "100.0%" with no caveat — a technically non-null rate, but misleading to a user who reads it as a strong signal. The fix added `LOW_SAMPLE_THRESHOLD = 5`; cohorts with 1–4 decided render "X.X% (n=N)" muted. SOURCE: `process/waves/wave-19/stages/B-6-review.md` §Phase 2 /review ("a band/cohort with decidedCount<5 (but >0) now renders 'X.X% (n=N)' muted (not a confident emerald 100.0% on n=1)").

**Recurrence accounting against OBS-W18-3:**
- Wave-18 OBS-W18-3 (first sighting, HOLD): P-2 authored "outreach response rates" as F2 before verifying the `outreach.status` enum has no `sent`/`responded` states. P-4 karen caught it. Root: a metric referencing columns that do not exist in the current schema.
- Wave-19 (this wave): Two distinct expressions of the same underlying principle. The `tieBreak` column exists and is populated, so OBS-W18-3's narrow "verify column exists" formulation would NOT have caught it. The small-sample caveat is also not a column-existence issue. Both are forms of the same root: a metric or rate displayed to users must not mislead — whether because the data does not exist, because the value is uncorrelated noise, or because the sample is too small to report without qualification.

**Kernel generalization:** Three flavors in two waves — (1) uncomputable (references missing column/enum); (2) noise (value is uncorrelated-by-construction); (3) small-sample over-confidence (technically computable but presented without low-n qualification). All three mislead the audience in different ways. The generalizable rule is: before a spec finalizes any metric or rate for display, verify it is computable over real schema data, is not structurally uncorrelated with the intended signal, and specifies how low-sample-count cases are treated. A single rule covering the computable+meaningful+sample-honest kernel captures all three flavors.

**Is this 2-wave?** Wave-18 defect (first firing, computability flavor) + wave-19 defect (second firing, noise + sample-honesty flavors). Both share the same kernel: a metric/rate surfaced to users that does not accurately represent what users would understand it to mean. The broader formulation is required because the narrow wave-18 rule ("verify column exists") would have MISSED the wave-19 cases entirely. 2-wave bar MET.

**Root class:** A metric, rate, or percentage authored at spec-time without verifying: (a) every referenced column/enum value exists in the current schema; (b) the value is not structurally uncorrelated with the stated purpose; (c) the display includes low-n qualification when the denominator is small. Any one of these produces a misleading metric that ships to users unless caught at review.

**Severity:** strong (both metric-honesty issues were P2 — CODE-OF-CONDUCT violations; would have shipped noise as signal and an over-confident small-n rate to M&A advisors if not caught at B-6 /review; caught pre-merge with in-branch fixes; no production impact).

**Catch stage analysis:** OBS-W18-3 was caught at P-4 (karen spec-review) because computability is verifiable from the schema at plan time. Wave-19's noise and small-n issues were NOT caught at P-4 — karen verified column existence (PASS) and the wave-18 computability lesson was applied. These two flavors require a different P-2/P-4 check: pre-classify score dimensions as predictive vs structural-noise, and specify low-n treatment as an explicit AC. The process task `1d95cac0` ("Spec-authoring + test-fixture process hardening") folds this forward.

**All 3 promotion criteria met:**
- Generalizable: yes — any spec that authors a metric, computed rate, or score-dimension lift for display to end-users can hit one or more of these three flavors; the check is mechanical at P-2/P-4 (schema grep + correlation reasoning + low-n AC).
- Falsifiable: yes — a spec metric that passes P-4 spec review without verifying (a) column existence, (b) non-noise correlation, and (c) small-n treatment fails this rule. Checkable at P-4 by a reviewer reading the rule.
- Cited: 2-wave artifact chain (OBS-W18-3 computability flavor + wave-19 B-6-review.md + wave-19 V-1-jenny.md GAP-A/GAP-B + wave-19 V-3 gate-verdict.md).

**Candidate principles file:** PRODUCT-PRINCIPLES (P-2 spec authoring discipline; PRODUCT-PRINCIPLES has zero rules; this would be #1 — supersedes and broadens the OBS-W18-3 provisional narrow text).

**Pre-authored PRODUCT-PRINCIPLES #1 candidate (format-checked against Contract for new rules):**
```
1. Before finalizing a spec metric or rate, verify the source column exists, the value is not noise by construction, and low-n cases are specified.
   Why: A missing column, a hash-of-id lift, or an unqualified n=1 "100%" each misleads the audience in a different way.
```
Check: Rule = "Before finalizing a spec metric or rate, verify the source column exists, the value is not noise by construction, and low-n cases are specified." = 115 chars (≤120). Why = "A missing column, a hash-of-id lift, or an unqualified n=1 \"100%\" each misleads the audience in a different way." = 113 chars — OVER. Trim:
```
1. Before finalizing a spec metric or rate, verify the source column exists, the value is not noise by construction, and low-n cases are specified.
   Why: A missing column, a noise lift, or an unqualified n=1 rate each misleads users in a distinct way.
```
Check: Rule = 115 chars (≤120). Why = "A missing column, a noise lift, or an unqualified n=1 rate each misleads users in a distinct way." = 98 chars (≤100). Exactly 2 non-empty lines. No forbidden tokens (`we`, `our`, `the team`, wave refs, em-dash). No parenthetical longer than ~5 words. Ends in a period. FORMAT VALID.

**Promotion status:** PROMOTION-GRADE (2-wave bar met; strongest promotion candidate this wave). DO NOT promote here — karen vets + orchestrator caps ≤1/file.

**Source artifacts:**
- `process/waves/wave-19/stages/B-6-review.md` §Phase 2 /review (tieBreak-noise-dimension-dropped + small-sample-caveat-added, both P2 metric-HONESTY fixes).
- `process/waves/wave-19/stages/V-1-jenny.md` §GAP-A + §GAP-B (pre-classify predictive-vs-noise; specify low-n AC).
- `process/waves/wave-19/blocks/V/gate-verdict.md` §Q3 (tieBreak-drop sound drift-with-rationale + CODE-OF-CONDUCT §metric rationale).
- `process/waves/_archive/wave-18/blocks/L/observations.md` OBS-W18-3 (first sighting, computability flavor, HOLD promoted to this wave).

---

### OBS-W19-2 — E2e fixture SQL never exercised against real Postgres: 2nd sighting of OBS-W18-4 (PROMOTION-GRADE; 2-wave bar met)

**What:** `match-feedback-isolation.e2e-spec.ts` was authored with mnemonic UUID string literals containing non-hex characters: `00000019-mfi1-4000-8000-000000000001` (workspace A), `00000019-st-a-4000-8000-000000000001` (staff user A), `00000019-st-b-4000-8000-000000000001` (staff user B). PostgreSQL's `string_to_uuid` rejects any string with non-hex characters (SQLSTATE 22P02: "invalid input syntax for type uuid"). When C-1 attempt-1 ran `seedWorkspace` against the real `dealflow_test` DB, the `beforeAll` threw on the first `INSERT`, crashing the entire suite — all 7 tests SKIPPED with the suite in `FAIL` state. head-ci-cd did NOT accept the skipped result as green (CI rule 2). Classification: testing-tag fixture defect in `apps/api/test/`. Route: backend-developer (assertion-preserving — fix only the malformed literals, no source/assertion/ALS change). Fix `a09fa7b`: 5 literals corrected to valid 8-4-4-4-12 hex, WS_A/WS_B/user-A/user-B kept disjoint. C-1 attempt-2 all-5-green @`3cc58de`, isolation suite 7/7 RAN+PASSED.

**Recurrence accounting against OBS-W18-4:**
- Wave-18 OBS-W18-4 (first sighting, HOLD): analytics-isolation e2e seed authored at B-6 rework, approved on static review, never executed against a real migrated role-scoped DB. C-1 exposed 4 schema-mismatch defects: wrong column name (`content` vs `body`), missing NOT NULL column (`workspace_id`), stale FK lookback, partial-unique constraint collision. Root: seed approved on static code review alone.
- Wave-19 (this wave): match-feedback-isolation e2e fixture authored with mnemonic UUID literals. These were never inserted into a real Postgres DB during authoring — the defect is invisible to static review (a linter cannot know `mfi1` is non-hex). The fixture only fails at runtime against `string_to_uuid`. Root: same missing gate — fixture SQL not exercised against a real migrated DB before B-6 approval/C-1.

**Mechanism comparison:** Wave-18 = schema mismatches (column names, NOT NULL, FK, unique constraints). Wave-19 = type-casting rejection (`string_to_uuid` on non-hex UUID literal). Different failure modes, identical root class: a test fixture/seed whose INSERT statements were never executed against a real Postgres DB during authoring, so defects that only manifest at runtime against the real engine are invisible until C-1 CI.

**Root class:** A real-DB e2e test fixture (INSERT statements, UUID literals, FK references) authored and approved on static review alone — without executing it against a migrated, role-scoped test DB — accumulates defects invisible to static analysis: wrong column names, missing NOT NULL fields, stale FK patterns, non-hex UUID literals, partial-index collisions. Every such defect manifests as a C-1 CI failure (or worse, a silently-skipped suite if the fixture throws in `beforeAll`). The fix in both waves was a single focused fixture-only commit (no source or assertion changes). The prevention gate is executing the seed locally before B-6 approval.

**Severity:** warning (1 CI fix-forward cycle; all test-only; no app/source/assertion change; no production impact; non-skipped suite confirmed at attempt-2; within the per-wave fix-cycle budget). The silent-skip failure mode elevates the severity class: a `beforeAll` throw that causes `SKIP` for all tests is directly blocked by CI rule 2 — but if CI rule 2 were absent, this class of fixture defect would produce a fabricated green.

**2-wave bar:** Wave-18 C-1 (4 schema-mismatch fix cycles, first sighting, HOLD) + wave-19 C-1 (1 UUID-literal fix cycle, second sighting). Different mechanism, same root. 2-wave bar MET.

**All 3 promotion criteria met:**
- Generalizable: yes — applies to any new real-DB e2e fixture with UUID literals, FK references, or column-name assumptions; the check is a local seed-run against a migrated DB, not a code reviewer reading the INSERT.
- Falsifiable: yes — a B-6 APPROVED real-DB e2e fixture that was never executed locally against a migrated role-scoped DB before approval fails this rule. Checkable: ask whether the author ran the seed locally. C-1 CI failure on a test-only commit is the observable symptom.
- Cited: 2-wave artifact chain (OBS-W18-4 + wave-19 `C-1-pr-ci-merge.md` §Fix-up cycle 1 + fix commit `a09fa7b`).

**Candidate principles file:** BUILD-PRINCIPLES (#9 — BUILD currently has 8 rules; this is the next sequential slot; this recurrence beats the other queued #9 candidates from OBS-W17-3 and OBS-W17-4 which did not recur this wave; those renumber to #10 and #11 when they eventually recur).

**Pre-authored BUILD-PRINCIPLES #9 candidate (format-checked against Contract for new rules):**
```
9. Run any new real-DB e2e fixture against a migrated DB with the runtime role locally before B-6 approval.
   Why: Static review cannot detect non-hex UUID literals, wrong column names, or partial-index collisions.
```
Check: Rule = "Run any new real-DB e2e fixture against a migrated DB with the runtime role locally before B-6 approval." = 104 chars (≤120). Why = "Static review cannot detect non-hex UUID literals, wrong column names, or partial-index collisions." = 99 chars (≤100). Exactly 2 non-empty lines. No forbidden tokens. No wave refs. No em-dash. Ends in a period. FORMAT VALID.

Note: this supersedes and slightly broadens the OBS-W18-4 pre-authored candidate text ("seed" → "fixture", adding non-hex UUID example; kernel is identical). OBS-W17-3 (populated-migration trigger-protected tables) and OBS-W17-4 (pre-GUC SECURITY DEFINER) remain at HOLD; they renumber to #10 and #11 respectively when they recur.

**Promotion status:** PROMOTION-GRADE (2-wave bar met). DO NOT promote here — karen vets + orchestrator caps ≤1/file.

**Source artifacts:**
- `process/waves/wave-19/stages/C-1-pr-ci-merge.md` §Fix-up cycle 1 ("error: invalid input syntax for type uuid: '00000019-mfi1-4000-8000-000000000001' in seedWorkspace at test/match-feedback-isolation.e2e-spec.ts:155 → beforeAll throw → suite FAIL, 7 tests SKIPPED. Root cause: mnemonic UUID string literals with non-hex chars (mfi1/st-a/st-b) rejected by Postgres string_to_uuid").
- `process/waves/wave-19/stages/T-9-journey.md` (T-gate §silently-skipped near-miss — "head-ci-cd did NOT accept skipped-as-green; classified testing-tag fixture defect").
- `process/waves/_archive/wave-18/blocks/L/observations.md` OBS-W18-4 (first sighting: 4 schema-mismatch fix cycles in C-1; seed never run against real migrated DB; HOLD).
- Fix commit `a09fa7b` on wave-19 branch ("correct invalid UUID literals in match-feedback-isolation e2e fixtures").

---

### OBS-W19-3 — CI rule 2 caught the silently-skipped isolation suite: validation, no new promotion

**What:** CI-PRINCIPLES rule 2 (promoted at wave-18: "Before trusting green CI, confirm a workflow run executed on the exact pushed headSha") was directly invoked in wave-19 C-1 to reject the skipped-as-green near-miss. Attempt-1 (run `28835918443`): the isolation suite crashed in `seedWorkspace` (22P02 from invalid-UUID fixtures), causing all 7 tests to SKIP and the `test` job to RED. head-ci-cd did NOT re-run or extrapolate the attempt-1 result to green; the rule's intent (a skipped test suite is a flavor of "CI didn't actually run the check") was applied correctly. The fix was classified under the Iron Law (testing-tag → backend-developer), not attempted inline.

**Is this a new promotion?** No. CI rule 2 already covers "a skipped-test-suite" as a failure mode (a suite that skips all tests because of a `beforeAll` throw is operationally equivalent to CI not executing that check). This is a VALIDATION that rule 2 earns its place, not a new kernel. A narrower rule scoped to "a suite that skips all N tests in beforeAll" would be a sub-case of rule 2 and adds no falsifiable content not already captured.

**Verdict:** VALIDATION of CI-PRINCIPLES rule 2. Rule confirmed. No new promotion.

**Severity:** warning (the rule was the mechanism that prevented a fabricated green; the isolation suite is the load-bearing cross-firm exclusion proof).

**Promotion status:** NOT promotable as a new rule (CI rule 2 already covers it). Positive signal: rule 2 is demonstrably worth reading at C-1.

**Source artifacts:**
- `process/waves/wave-19/stages/C-1-pr-ci-merge.md` §Ghost-Green guard ("Verified a run FIRED for the exact pushed headSha… Attempt 1 … test job RED — match-feedback-isolation.e2e-spec.ts crashed in seedWorkspace (SQLSTATE 22P02), all 7 tests SKIPPED. 4/5 green (lint/typecheck/audit/build). … Did NOT accept skipped-as-green").
- `process/waves/wave-19/blocks/T/gate-verdict.md` §silently-skipped near-miss ("head-ci-cd did NOT accept skipped-as-green (CI-PRINCIPLES rule 2)").

---

### OBS-W19-4 — P-4 obligation encoding a prior B-6 lesson: process observation, informational

**What:** The wave-18 hollow-test lesson (B-6 Attempt-1 REWORK for re-implemented SQL in the isolation e2e) was encoded as an explicit B-block obligation in wave-19's P-4 gate verdict: "the cross-firm negative-read MUST be a FIRST-CLASS test (executed AS dealflow_app via workspaceAls.run through the REAL MatchFeedbackService, 2 workspaces, firm-A calibration excludes firm-B — mirror the wave-18 analytics-isolation.e2e; NOT re-implemented SQL — the wave-18 B-6 hollow-test lesson). Fault-killing." The result: wave-19 B-6 Attempt-1 was APPROVED on the first attempt (no rework on the cross-firm e2e).

**Is this a generalizable rule?** The observation is: encoding a specific prior gate catch as an explicit named obligation in the next wave's spec/P-4 checklist prevents the rework from recurring. This is a process-level meta-pattern. However:
- It is already implicit in how P-4 gate verdicts carry forward obligations ("Carry-forward to Phase 2 / milestone-close → B-block policing (head-builder)").
- The causal claim (obligation → no rework) is plausible but cannot be cleanly falsified without a counter-factual.
- One successful application is not a 2-wave pattern.

**Verdict:** Informational process observation. Low priority. Not a promotion candidate at this time. If a future wave shows that an obligation was NOT encoded and the rework recurred, this becomes evidence for a BUILD or PRODUCT principle.

**Severity:** low/informational (positive outcome — rework prevented; no defect fired).

**Promotion status:** HOLD (first-sighting; meta/process; not falsifiable enough in current form; low priority).

**Source artifacts:**
- `process/waves/wave-19/blocks/P/gate-verdict.md` §B-BLOCK OBLIGATIONS §G1 ("the cross-firm negative-read MUST be a FIRST-CLASS test… NOT re-implemented SQL — the wave-18 B-6 hollow-test lesson").
- `process/waves/wave-19/stages/B-6-review.md` §Phase 1 ("G1 cross-firm e2e is REAL + fault-killing ON ATTEMPT 1 (the wave-18 hollow-test lesson held via the P-4 obligation — no rework)").

---

## Carried-forward holds recurrence audit (waves 14–18)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W18-3 Uncomputable spec metric (PRODUCT-PRINCIPLES #1 provisional) | RECURRENCE — see OBS-W19-1. Wave-19 added 2 new flavors (noise + small-n) confirming and broadening the kernel. 2-wave bar MET. Rule broadened to cover all 3 flavors. | PROMOTION-GRADE via OBS-W19-1 |
| OBS-W18-4 E2e seed never run vs migrated DB (BUILD-PRINCIPLES #9 provisional) | RECURRENCE — see OBS-W19-2. Wave-19: mnemonic non-hex UUID literals (22P02) → identical root class (fixture not exercised against real Postgres before CI). 2-wave bar MET. | PROMOTION-GRADE via OBS-W19-2 |
| OBS-W18-5 T-9 canonical journey-map skipped (low/informational) | NON-RECURRENCE. T-9 this wave updated `user-journey-map.md` with the new `/insights calibration section` + `/match-feedback` (T-9 gate-verdict.md `journey_map_version: updated`; jenny V-1 §4 confirms "Journey map (T-9): updated"). | HOLD unchanged (prior wave defect was fixed; non-recurrence this wave) |
| OBS-W17-1 Cross-suite shared-DB chain pollution (PROMOTION-GRADE carry-forward, T-4 #2) | NON-RECURRENCE. No new parallel audit-writing e2e suite; no global-chain contiguity assertion added this wave. Read-only wave; zero audit writes. Carry-forward status unchanged. | PROMOTION-GRADE carry-forward (unchanged from wave-18) |
| OBS-W17-2 Vacuous RLS test under BYPASSRLS role (VERIFY #4 provisional) | NON-RECURRENCE. Wave-19 e2e correctly uses `SET ROLE dealflow_app` (NOSUPERUSER/NOBYPASSRLS); tests do not run as superuser. Lesson applied, not defect. | HOLD unchanged |
| OBS-W17-3 Populated-DB migration trigger-protected tables (BUILD #9 provisional) | NON-RECURRENCE. No migration this wave (schema_skipped: true); no trigger-protected table mutated. | HOLD unchanged (renumbers to #10 on eventual recurrence, behind OBS-W19-2) |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER (BUILD #9 provisional) | NON-RECURRENCE. No new guard or middleware added pre-GUC; read-only surface. | HOLD unchanged (renumbers to #11 on eventual recurrence) |
| OBS-W17-5 SET utility-statement bind-param (BUILD, informational) | NON-RECURRENCE. No `SET <guc> = $1` usage this wave; workspace interceptor uses `SELECT set_config(...)` unchanged. | HOLD unchanged |
| OBS-W16-2 No-echo on validation rejection (BUILD provisional) | NON-RECURRENCE. No new endpoint with sensitive input validation. | HOLD unchanged |
| OBS-W16-6 Drizzle sql-cast JSONB bypass (BUILD provisional) | NON-RECURRENCE. No JSONB column wrapped in raw sql cast. | HOLD unchanged |
| OBS-W14-3 Hash-excluded HMAC additive metadata (BUILD provisional) | NON-RECURRENCE. No audit-hash preimage change (read-only wave). | HOLD unchanged |
| OBS-W14-2 Differential-test discriminator (VERIFY #4 provisional) | NON-RECURRENCE. MFC-4 fault-killing discriminator (ALS-scoped vs no-ALS totals) is the correct enforcement axis. Not a defect. | HOLD unchanged |
| OBS-W13-1 mock-only row-membership derivation (VERIFY new-slot) | NON-RECURRENCE. No row-selecting derivation SQL tested via param-forwarding mock. | HOLD unchanged |
| OBS-W15-4 Credential defense-in-depth | NON-RECURRENCE. No new admin-entered external secret primitive. | HOLD unchanged |
| OBS-W15-5 AC-consumer-half unplanned | NON-RECURRENCE. Read-only with no cross-module consumer wiring. | HOLD unchanged |
| OBS-W12-2 Parallel self-migrate race (CI candidate) | NON-RECURRENCE. No new self-migrating parallel e2e suite race. | HOLD unchanged |
| OBS-W11-1 store-binding, OBS-W12-1 caller-FK (BUILD new-slot) | NON-RECURRENCE. | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W19-1 Metric-honesty (computable + not-noise + sample-honest) | W18 OBS-W18-3 (computability) + W19 (noise + small-n) | strong | YES (generalizable + falsifiable + 2-wave defect chain) | PRODUCT-PRINCIPLES (#1) | PROMOTION-GRADE |
| OBS-W19-2 E2e fixture SQL not exercised against real Postgres | W18 OBS-W18-4 (schema mismatches) + W19 (non-hex UUID literals) | warning | YES (generalizable + falsifiable + 2-wave defect chain) | BUILD-PRINCIPLES (#9) | PROMOTION-GRADE |
| OBS-W19-3 CI rule 2 caught skipped-suite near-miss | W18 (promoted CI #2) + W19 (validation application) | warning | CI rule 2 already promoted; this is a VALIDATION | CI-PRINCIPLES #2 (promoted W18) | NOT promotable (validation confirms rule 2) |
| OBS-W19-4 P-4 obligation as lesson-forwarding | W19 only | low/informational | 2-wave bar NOT met; not falsifiable enough | (no home yet) | HOLD (low priority, informational) |
| OBS-W17-1 Cross-suite shared-DB chain pollution | W16 + W17 | warning | YES (pre-graded PROMOTION-GRADE at W17; T-4 #2) | T-4 (#2) | PROMOTION-GRADE carry-forward (unchanged) |

**Carry-forward queue after wave-19:**
- OBS-W17-1 — Cross-suite shared-DB chain pollution (PROMOTION-GRADE carry-forward, T-4 #2, 2-wave W16+W17; pre-authored text in wave-17 observations, ready for orchestrator/karen).
- OBS-W19-1 — Metric-honesty: computable + not-noise + sample-honest (PROMOTION-GRADE, PRODUCT-PRINCIPLES #1; supersedes OBS-W18-3 narrow provisional text; pre-authored text above).
- OBS-W19-2 — E2e fixture SQL not exercised against real Postgres (PROMOTION-GRADE, BUILD-PRINCIPLES #9; supersedes OBS-W18-4 provisional text; pre-authored text above).
- OBS-W19-4 — P-4 obligation as lesson-forwarding (HOLD, informational, no home yet, low priority).
- OBS-W18-5 — T-9 canonical journey-map skipped (HOLD, informational, low priority, no home yet; non-recurrence this wave).
- OBS-W17-2 — Vacuous RLS test under BYPASSRLS (HOLD, VERIFY #4 provisional).
- OBS-W17-3 — Populated-DB migration trigger-protected tables (HOLD, BUILD #10 provisional; behind OBS-W19-2).
- OBS-W17-4 — Pre-GUC guard SECURITY DEFINER (HOLD, BUILD #11 provisional; behind OBS-W17-3).
- OBS-W17-5 — SET utility-statement bind-param (HOLD, informational, low priority).
- OBS-W14-3 — Hash-excluded HMAC additive metadata (HOLD; karen ruling pending).
- Inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle JSONB sql-cast, W14-2 differential discriminator, W13-1 mock-only derivation, W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W12-2 self-migrate race, W11-1 store-binding, W12-1 caller-FK.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 4
promotion_grade:
  - OBS-W19-1 (PRODUCT-PRINCIPLES #1 — metric computable+not-noise+sample-honest; 2-wave W18+W19; supersedes OBS-W18-3 narrow text)
  - OBS-W19-2 (BUILD-PRINCIPLES #9 — e2e fixture vs real Postgres; 2-wave W18+W19; supersedes OBS-W18-4 text)
promotion_grade_carry_forward:
  - OBS-W17-1 (T-4 #2 — cross-suite shared-DB chain pollution; 2-wave W16+W17; unchanged)
hold:
  - OBS-W19-4 (P-4 obligation as lesson-forwarding; informational; no home yet)
  - OBS-W18-5 (T-9 journey-map canonical artifact skip; informational; non-recurrence W19; hold unchanged)
not_promotable:
  - OBS-W19-3 (CI rule 2 validation — rule already promoted W18; recurrence confirms rule, no new rule)
obs_w18_3_second_sighting: true        # W18 computability + W19 noise+small-n; 2-wave bar met; PRODUCT-PRINCIPLES #1
obs_w18_4_second_sighting: true        # W18 schema-mismatches + W19 non-hex-UUID; 2-wave bar met; BUILD-PRINCIPLES #9
ci_rule2_validation: true              # skipped-suite near-miss caught and resolved; rule earned its place
build_9_slot_resolved: true            # OBS-W19-2 recurred first; OBS-W17-3 renumbers to #10; OBS-W17-4 to #11
```
