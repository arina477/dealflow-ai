# L-2 — Distill (wave 6 — deal-sourcing data spine)

**Stage:** L-2 (Learn block; runs concurrent with L-1)
**Head:** head-learn (owns L-block; issues stage verdict)
**Mode:** automatic (STATUS: RUNNING; no pause trigger fired)

---

## Action 1/2 — Mark claimed tasks done + verify

All 4 claimed tasks were already `status='done'` on entry (V-block done-marking pre-satisfied). Verified in DB:

| task_id | status | role |
|---|---|---|
| ff378a95-b86c-4d26-89e3-6e6072381d44 | done | seed (connections + adapter + schema) |
| 0241222b-dda3-4606-bbc8-d15f5103a278 | done | sibling (ETL + on-demand sync) |
| db274731-bba9-4276-b092-a32538027bf6 | done | sibling (dedupe engine) |
| f5771d13-e3cf-4878-96fe-5d9056fa5944 | done | sibling (companies-contacts screen) |

All on milestone M3 (`b372bbf7`). No UPDATE needed; no skips.

## Action 3 — knowledge-synthesizer

Spawned `knowledge-synthesizer` against `process/waves/wave-6/` + prior archived observations (waves 1–5). Output **6 observations** to `process/waves/wave-6/blocks/L/observations.md`, cited + severity-ranked + cross-wave-lineage-reconciled.

| OBS | Title (abbreviated) | Candidate file | Severity | Confirmation |
|---|---|---|---|---|
| OBS-1 | `import type` erases DI token → NestJS boot crash | BUILD | warning | CONFIRMS-PRIOR (wave-2 OBS-4; 2nd firing) |
| OBS-2 | Non-TypeScript runtime assets must be declared in nest-cli.json assets | BUILD | warning | FIRST-OBSERVATION |
| OBS-3 | Adversarial /review finds false-positive merge CRITICALs the gate misses | VERIFY | strong | CONFIRMS-PRIOR (wave-3 OBS-1, wave-4 OBS-5; 3rd firing) |
| OBS-4 | False-negative infra hard-stop: check env var aliases before blocking | none | informational | FIRST-OBSERVATION |
| OBS-5 | P-4 gate catches schema divergence + invariant loss on data waves | none | informational | CONFIRMS-PRIOR (4th; no new principle) |
| OBS-6 | Drizzle hand-written migrations must be registered in _journal.json | BUILD | informational | FIRST-OBSERVATION |

## Action 4 — Filter to promotion candidates

Two observations pass generalizable + falsifiable + cited AND meet the 2-wave-confirmation gate:
- **OBS-1 → BUILD** (2nd firing; distinct mechanism from BUILD rules 1 & 2; deterministically CI-enforceable via the `sourcing.di-boot.spec.ts` `TestingModule.compile()` pattern).
- **OBS-3 → VERIFY** (3rd consecutive firing; strong; a VERIFY-block process-mandate is the correct genre for a verification-process principle, and it is checkable — the V-block record shows whether /review ran on the qualifying diff).

Deferred (FIRST-OBSERVATION, awaiting 2nd firing): OBS-2 (nest-cli.json assets — likely re-fires; watch next `readFileSync`-outside-src B-block), OBS-4 (env-alias hard-stop; informational operational note, no principles-file home), OBS-6 (drizzle journal registration; informational). OBS-5 has no promotion path (validates the P-4 gate's own brain spec).

## Action 5 — karen vetting

Spawned `karen` with both candidates + each target file's "Contract for new rules" header (read first).

- **Candidate 1 (BUILD rule 3):** APPROVE. Distinct from rule 2 (rule 2 = missing module export; candidate 1 = `import type` erasing the runtime token — different DI-boot sub-class). Falsifiable, generalizable, backed by a CI regression test.
- **Candidate 2 (VERIFY rule 2):** APPROVE on substance (right genre, checkable, 3-wave evidence); initial REJECT on format — Why line over the 100-char limit. karen also flagged that the synthesizer's self-reported char counts in observations.md (OBS-3: "rule 107 / Why 84") were STALE vs the actual candidate bytes.

## Action 6 — Lint, cap-1 rewrite, promote

First linter pass FAILED both on `linter:why>100` — the deterministic linter counts the Why line INCLUDING its 3-space indent, which karen's initial hand-count omitted (BUILD Why 108 w/ indent; VERIFY Why 119 w/ indent).

One permitted cap-1 karen rewrite issued for BOTH candidates with the exact constraint (Why ≤100 chars including the 3-space indent). Rewrites returned:

- BUILD rule 3 Why → `import type is erased at emit, so the DI token vanishes and NestJS bootstrap crashes.` (93 chars w/ indent)
- VERIFY rule 2 Why → `Head-builder gate reviews structure; adversarial review finds fail-open and hash CRITICALs.` (99 chars w/ indent)

Second linter pass: **`linter:OK` on both.**

Both promotions applied (per-file cap: 1 rule per file per wave; two different files, so both permitted):
- `command-center/principles/BUILD-PRINCIPLES.md` rule 3.
- `command-center/principles/VERIFY-PRINCIPLES.md` rule 2.

Candidate files preserved as audit trail at `process/waves/wave-6/blocks/L/candidates/`.

## Action 7 — Observation pipeline state

6 observations emitted to `process/waves/wave-6/blocks/L/observations.md`. 3 deferred FIRST-OBSERVATIONs retained there for future cross-wave synthesis. No soft-signal founder flag this wave.

---

## Deliverable footer

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "tasks: ff378a95 done, 0241222b done, db274731 done, f5771d13 done (all pre-satisfied; verified in DB)"
  - "observations: process/waves/wave-6/blocks/L/observations.md (6 observations)"
  - "principles promotions: 2 across [BUILD-PRINCIPLES.md rule 3, VERIFY-PRINCIPLES.md rule 2]"
tasks_marked_done: [ff378a95-b86c-4d26-89e3-6e6072381d44, 0241222b-dda3-4606-bbc8-d15f5103a278, db274731-bba9-4276-b092-a32538027bf6, f5771d13-e3cf-4878-96fe-5d9056fa5944]
tasks_skipped_with_reason: []
observations_emitted: 6
promotion_candidates: 2
karen_verdicts:
  - {candidate_id: OBS-1, target_file: BUILD-PRINCIPLES.md, verdict: APPROVE}
  - {candidate_id: OBS-3, target_file: VERIFY-PRINCIPLES.md, verdict: APPROVE-after-cap-1-rewrite}
linter_runs:
  - {candidate_id: OBS-1, target_file: BUILD-PRINCIPLES.md, attempt: 1, verdict: REJECT, rejection_code: "linter:why>100"}
  - {candidate_id: OBS-1, target_file: BUILD-PRINCIPLES.md, attempt: 2, verdict: OK, rejection_code: ""}
  - {candidate_id: OBS-3, target_file: VERIFY-PRINCIPLES.md, attempt: 1, verdict: REJECT, rejection_code: "linter:why>100"}
  - {candidate_id: OBS-3, target_file: VERIFY-PRINCIPLES.md, attempt: 2, verdict: OK, rejection_code: ""}
candidates_dropped_by_linter: []
promotions_applied:
  - {file: command-center/principles/BUILD-PRINCIPLES.md, line: "rule 3", rule: "Never use `import type` for a class that is constructor-injected into a NestJS provider."}
  - {file: command-center/principles/VERIFY-PRINCIPLES.md, line: "rule 2", rule: "Run adversarial /review on every B-block diff that builds an auth guard, integrity chain, or merge engine."}
note: "Two promotions this wave, one per file (per-file cap allows it; different files). Both required one cap-1 karen rewrite to bring the Why line under the 100-char linter limit (linter counts the 3-space indent; synthesizer + karen's initial hand-counts omitted it). Process flag recorded in observations for future L-2: re-measure candidate byte length at commit time, do not trust the parenthetical self-counts in observations.md."
```
