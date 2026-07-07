# N-2 — Seed (wave-24 → seeds wave-25)

head-next gated APPROVED.

## Action 1 — Pick the seed

Seed predicate (`parent_task_id IS NULL, wave_id IS NULL, status='todo', milestone_id=033f97e0, ORDER BY created_at LIMIT 1`) → **`6fe232e3-c639-4f6c-ad66-2889df8d9717`** "Auth hardening: rate-limiting, input validation, logout anti-CSRF" (created 2026-07-03, oldest of the 2 candidates).

## Action 2 — Load siblings

`SELECT ... WHERE parent_task_id=6fe232e3 AND status='todo' AND wave_id IS NULL` → **0 rows**. Single-task bundle. `bundled_sibling_ids = []`.

## Action 3 — Validate the bundle

Re-confirmed against DB this turn: `6fe232e3` → status=`todo`, `wave_id` NULL, `milestone_id=033f97e0`, `parent_task_id` NULL. All checks PASS. Validation: **pass**.

## Gate notes (head-next)

- NOT a Horizontal-Layer bundle (single self-contained hardening task, structurally identical to wave-24). Vertical-slice requirement satisfied vacuously.
- No ghost dependencies (git tree clean, nothing unmerged). No Dependency-Deadlock (no siblings → no temporal ordering).
- Placebo-Productivity check PASS: auth/CSRF/rate-limit hardening is genuine Leverage on a compliance-first M&A product, and it is the OLDEST candidate (no easy-task cherry-pick).
- Touches auth / CSRF / rate-limits → downstream **T-8 Security stage + P-4 security-scope-tightened gate** flagged for wave-25 P-block.
- Static-test-spec-first + data-destructive rollback obligations (rate-limit storage may be touched) → enforce at wave-25 P-2/P-3 (downstream, not N-2 blockers).

## Action 5 — claimed_task_ids

`claimed_task_ids = [6fe232e3-c639-4f6c-ad66-2889df8d9717]`.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 6fe232e3-c639-4f6c-ad66-2889df8d9717"
  - "bundled siblings: 0"
  - "validation: pass"
seed_task_id: 6fe232e3-c639-4f6c-ad66-2889df8d9717
seed_task_title: "Auth hardening: rate-limiting, input validation, logout anti-CSRF"
bundled_sibling_ids: []
claimed_task_ids: [6fe232e3-c639-4f6c-ad66-2889df8d9717]
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
queue_exhausted: false
validation_failed: false
note: "Single-task hardening wave (like wave-24). Downstream: T-8 + P-4 security-scope gate flagged (auth/CSRF/rate-limits)."
head_signoff:
  verdict: APPROVED
  stage: N-2-seed
  reviewers: {}
  failed_checks: []
  rationale: "Oldest legal seed per predicate; single-task bundle validated against DB (todo, wave_id NULL, milestone M10, parent NULL). Not horizontal-layer, no ghost deps, no deadlock. Placebo-Productivity check passes — genuine auth-hardening Leverage + oldest candidate."
  next_action: PROCEED_TO_N-3
```
