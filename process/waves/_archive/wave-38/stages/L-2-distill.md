# Wave 38 — L-2 Distill

## Task done-marking
- `7f4d150b-409f-4936-a09f-12fe46d5b90c` (seed, sole claimed task) → `status='done'` (verified via RETURNING).
  Single-task bundle; no siblings.

## Observations (knowledge-synthesizer)
4 emitted → `process/waves/wave-38/blocks/L/observations.md`:
- **OBS-A (strong)** — Ghost-green journal drift: ordered-journal migrate tools skip out-of-order entries and exit 0. → promoted (see below).
- **OBS-B (warning)** — SQL-consuming tools must read `src/`, not `dist/` (build doesn't copy non-TS assets). Held for BUILD-PRINCIPLES second-wave confirmation.
- **OBS-C (warning, confirmatory)** — object existence ≠ tool applied; only applied-migrations hash-match is sufficient. Folded into OBS-A's rule (this supplied the 2nd-wave confirmation: wave-37 manual 0021 + wave-38 root cause).
- **OBS-D (informational)** — stale `/health` version already covered by CI-PRINCIPLES rule 1; tracked as task 26710959. No promotion.

## Promotion
1 promotion applied (OBS-A + OBS-C consolidated), CI-PRINCIPLES rule 5. 2-wave confirmation met.
karen: APPROVE (format clean, falsifiable, distinct from rules 1–4 — migration-application provenance vs deploy-artifact provenance). Linter: OK. Committed `3ab8e85`.

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "tasks: 7f4d150b done"
  - "observations: process/waves/wave-38/blocks/L/observations.md (4 observations)"
  - "principles promotions: 1 (CI-PRINCIPLES rule 5)"
tasks_marked_done: [7f4d150b-409f-4936-a09f-12fe46d5b90c]
tasks_skipped_with_reason: []
observations_emitted: 4
promotion_candidates: 1
karen_verdicts: [{candidate_id: OBS-A, target_file: CI-PRINCIPLES.md, verdict: APPROVE}]
linter_runs: [{candidate_id: OBS-A, target_file: CI-PRINCIPLES.md, attempt: 1, verdict: OK, rejection_code: ""}]
candidates_dropped_by_linter: []
promotions_applied: [{file: CI-PRINCIPLES.md, line: 141, rule: "5. Verify a migration applied by matching its file hash in the applied-migrations table, never by a green migrate exit."}]
note: "OBS-B held for BUILD-PRINCIPLES on second-wave confirmation; OBS-D tracked as task 26710959."
```
