# L-2 — Distill (wave-10)

> Block: L (Learn). Stage L-2 (∥ L-1). Deterministic match spine (M5 deterministic half).

## Action 1-2 — Tasks marked done + verified

`claimed_task_ids` (from P-2 spec / seed `47ed7ddd` multi-spec contract): 3 tasks. All flipped `todo/in_progress/blocked → done` in one batch; verification SELECT confirms all three report `done`.

| Task id | Title (trunc) | Status |
|---|---|---|
| `47ed7ddd-f384-490c-9529-6143dd4701da` | Build deterministic match spine + rule-based pre-score (spine) | done |
| `fb82d339-27dd-4c5d-9819-9bf72e3baa9b` | Build /matches-shortlist ranked-list page with fit scores (page) | done |
| `f74dce45-a644-4ffc-a931-44383fcebe24` | Persist accept/reject/flag shortlist with ready-for-outreach handoff | done |

## Action 3 — knowledge-synthesizer (retro → observations)

Spawned `knowledge-synthesizer` against wave-10 deliverables + waves 7-9 archived observations + BUILD/VERIFY/CI principles. Output: 5 observations at `process/waves/wave-10/blocks/L/observations.md`. All reality-checked by head-learn against deliverable text (B-6 gate verdict, V-3 fast-fix, C-2 summary, V-1 karen) before dispositioning.

## Action 4 — Promotion candidates (Generalizable ∧ Falsifiable ∧ Cited)

| Obs | Candidate file | 2-wave gate | Promotion candidate? |
|---|---|---|---|
| OBS-W10-1 (re-run must preserve user decisions) | BUILD | NOT MET (FIRST-OBS) | No — carry-forward |
| OBS-W10-2 (in-tx read must use tx-scoped handle) | BUILD | **MET** (CONFIRMS-PRIOR OBS-W9-5) | **Yes** |
| OBS-W10-3 (design-vs-bundle capability boundary) | PRODUCT/DESIGN | NOT MET (FIRST-OBS) | No — carry-forward |
| OBS-W10-4 (shared-package blast-radius verify) | CI | NOT MET (FIRST-OBS) | No — carry-forward |
| OBS-W10-5 (parse-shape family, BUILD rule 5) | n/a (rule exists) | n/a | No — confirming firing only |

Exactly ONE observation clears the 2-wave gate: **OBS-W10-2**. First firing wave-9 OBS-W9-5 (audit-snapshot inconsistency, logged FIRST-OBSERVATION, carried forward with the exact watch condition now satisfied); second firing wave-10 CRIT-2 (handoff accepted-count guard read via `this.db` outside the transaction) — the B-6 gate verdict labels it verbatim "wave-9 CRIT-5 class re-firing." Escalated consequence (a gating guard read vs. an audit field). Gate MET.

## Action 5 — karen promotion vetting

Two karen reality-checks:

1. **Promotion-decision reality-check** (candidates A=cross-package-verify, B=design-conforms, C=re-run-preserves-decisions, D=parse-shape/F-1). Verdict: PROMOTE NONE of A-D — A/B/C all genuine FIRST-observations (2-wave gate NOT MET), D is a confirming firing of the already-promoted rule 5 with the OBS-W9-4 escalation trigger (fourth firing reaching production) NOT met, since F-1 was caught at V-1 not shipped broken to users. karen explicitly flagged the empty CI-PRINCIPLES file (candidate A's target) and candidate C's "second firing of the idempotent family" framing as snacking / gate-laundering attempts to resist. This vetting did NOT cover the tx-scoped-read candidate (an incomplete prompt from head-learn) — see head-learn correction below.
2. **Targeted vetting of OBS-W10-2 (BUILD rule 7 candidate).** Verdict: APPROVE after a falsifiability REWRITE. Confirmed 2-wave lineage MET against archive text; confirmed NO near-dup with BUILD rules 1-6 (rule 6 = guard PREDICATE; rule 7 = read HANDLE/snapshot — orthogonal, per OBS-W9-5's own boundary statement); widened the wording from "guards or audits the write" to "every read inside a runInTransaction block" so a plain escaping read cannot slip the rule on a technicality. Final 2-line form supplied, deterministically checkable (grep `this.db` inside `runInTransaction`).

**head-learn correction of record:** the first karen reality-check was scoped to candidates A-D and omitted the tx-scoped-read observation as a candidate. head-learn caught the gap (the knowledge-synthesizer had flagged OBS-W10-2 as CONFIRMS-PRIOR OBS-W9-5, and the B-6 gate verdict text confirms the re-firing verbatim), verified the wave-9 lineage in the archive, and ran the second targeted karen vetting before promoting. This is the "almost right but subtly bad" catch: "promote none" was the correct answer to an incomplete question; the correct answer to the complete question is "promote exactly one."

## Action 6 — Lint + promote

Candidate written to `process/waves/wave-10/blocks/L/candidates/BUILD-PRINCIPLES.md`. Deterministic linter (rule ≤120, why ≤100, no forbidden tokens, exactly 2 non-empty lines): **linter:OK** (rule line 113 chars, why line 100 chars). Appended as BUILD rule 7 under `## Rules`. Committed `bf37752`.

Promoted rule (verbatim):

```
7. Every read inside a runInTransaction block must use the tx-scoped repository handle, not the module-level one.
   Why: A module-level read runs off-snapshot, so guards and audit fields see pre-transaction state.
```

## Action 7 — Observation pipeline state

5 observations recorded. Carry-forward queue after wave-10: OBS-W10-1 (BUILD), OBS-W10-3 (PRODUCT/DESIGN), OBS-W10-4 (CI) — all FIRST-OBS, each promotable the wave it fires a confirmed second time; plus prior open OBS-W9-1, OBS-W9-3, OBS-W8-1 (CONFIRMED-AND-READY, promotable next free BUILD slot), OBS-W8-4, OBS-W8-5, OBS-W8-6. OBS-W10-5 recorded as a confirming firing of BUILD rule 5 (fourth wave, caught pre-production; OBS-W9-4 VERIFY-escalation trigger NOT met).

Soft signal for founder checkpoint: OBS-W10-4 (cross-package-verify) is a bounded process defect worth a pre-push habit even before it clears the 2-wave gate — no rule change, informational only.

## Deliverable footer

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "tasks: 47ed7ddd done, fb82d339 done, f74dce45 done (verified via SELECT)"
  - "observations: process/waves/wave-10/blocks/L/observations.md (5 observations)"
  - "principles promotions: 1 (BUILD rule 7) — commit bf37752"
tasks_marked_done: [47ed7ddd-f384-490c-9529-6143dd4701da, fb82d339-27dd-4c5d-9819-9bf72e3baa9b, f74dce45-a644-4ffc-a931-44383fcebe24]
tasks_skipped_with_reason: []
observations_emitted: 5
promotion_candidates: 1
karen_verdicts:
  - {candidate_id: OBS-W10-2, target_file: command-center/principles/BUILD-PRINCIPLES.md, verdict: APPROVE-AFTER-REWRITE}
  - {candidate_id: OBS-W10-1, target_file: BUILD, verdict: NOT-A-CANDIDATE-FIRST-OBSERVATION}
  - {candidate_id: OBS-W10-3, target_file: PRODUCT/DESIGN, verdict: NOT-A-CANDIDATE-FIRST-OBSERVATION}
  - {candidate_id: OBS-W10-4, target_file: CI, verdict: NOT-A-CANDIDATE-FIRST-OBSERVATION}
  - {candidate_id: OBS-W10-5, target_file: n/a, verdict: NOT-A-CANDIDATE-RULE-EXISTS}
linter_runs:
  - {candidate_id: OBS-W10-2, target_file: command-center/principles/BUILD-PRINCIPLES.md, attempt: 1, verdict: OK, rejection_code: ""}
candidates_dropped_by_linter: []
promotions_applied:
  - {file: command-center/principles/BUILD-PRINCIPLES.md, line: "rule 7", rule: "Every read inside a runInTransaction block must use the tx-scoped repository handle, not the module-level one."}
note: "M5 NOT complete (LLM-rationale bundle remains) — L-1 must NOT close M5. Milestone-delta judgment is L-1's, not L-2's."
```
