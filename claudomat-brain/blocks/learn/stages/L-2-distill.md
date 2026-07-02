# L-2 — Distill

> **Block:** L (Learn), 7th of 8 in wave loop: `P → [D] → B → C → T → V → ` **`L`** ` → N`.
> **Stages:** L-1 ∥ **L-2**. L-1 and L-2 run concurrently (per dispatcher § Parallelization). Block exits once both have exited.
> **Pattern:** spawn-pattern (headless). head-learn owns the block as a sub-agent; orchestrator coordinates.
> **Dispatcher** (skip rules, ≤1-rule-promotion-per-wave, exit handoff): `claudomat-brain/blocks/learn/learn.md`.

## Purpose

Mark every `tasks` row this wave claimed as `done` (bookkeeping), then run cross-wave learning: spawn `knowledge-synthesizer` against wave deliverables; spawn `karen` to vet promotion candidates against the relevant principles file's "Contract for new rules"; promote 0 or 1 one-liner per principles file. Archival owned by **N-3**, not L-2.

## Prerequisites

- V-3 exited (V-block APPROVE — gate condition for entering the L-block; L-1 is concurrent, not a prerequisite).
- READ `claimed_task_ids` from the wave's primary task `description` (DB; canonical via the `Task — show one` recipe in [`claudomat-brain/db/SCHEMA.md`](../../../db/SCHEMA.md)). `process/waves/wave-<N>/stages/P-2-spec.md` is the FS convenience copy P-2 emits — DB wins on any discrepancy.
- READ each candidate principles file's "Contract for new rules" header before any append.

## Skip condition

L-2 stage does NOT skip. Promotion sub-action skips when observations don't pass karen's threshold (most waves emit observations but don't promote).

## Actions

### Action 1 — Mark every claimed task done

Close the full bundle (seed + siblings) in one batch. `claimed_task_ids` comes from the spec contract YAML head — the same list B-0 claimed at wave start:

```sql
UPDATE tasks
SET status = 'done'
WHERE id = ANY('{<seed-id>,<sibling-id-1>,...}'::uuid[])
  AND status IN ('todo','in_progress','blocked')
RETURNING id;
```

The status guard prevents flipping a `cancelled` or `recurring` row to `done` if a stale id is in the array. If the RETURNING row count is less than the set size, the missing id was already in a non-eligible status (retroactively cancelled mid-wave, already done, or a stale MONITOR id). Record in deliverable; do NOT retry.

Do NOT mark done a task not actually completed by this wave's deployed state. If V-2 inserted a follow-up task for partial completion, the parent bundle task may still be done — the follow-up is a separate row with `parent_task_id=NULL`, and V-2's deliverable is authoritative.

### Action 2 — Verify DB state

```sql
SELECT id, status
FROM tasks
WHERE id = ANY('{<task-id-1>,<task-id-2>,...}'::uuid[]);
```

Every row's `status` MUST be `'done'`. If any row reports a different status, orchestrator re-runs Action 1 for it (mechanical, no head agent).

### Action 3 — Spawn knowledge-synthesizer

Spawn `knowledge-synthesizer` (verify in `command-center/AGENTS.md`). Pass:
- Wave path: `process/waves/wave-<N>/`
- Prior `min(5, N-1)` waves' observations (`process/waves/_archive/wave-*/blocks/L/observations.md`). Wave 1 runs on current wave alone.
- Recent principles files (block-scoped + cross-wave)
- Output: `process/waves/wave-<N>/blocks/L/observations.md`

Output 0–6 observations; > 6 means overproduction — orchestrator prunes. Each observation cites: source artifacts, severity (informational / warning / strong), candidate principles file.

### Action 4 — Filter to promotion candidates

Observations meeting ALL three become **promotion candidates**:
1. **Generalizable** — applies beyond this single wave.
2. **Falsifiable** — concrete rule, not a vibe.
3. **Cited** — backed by specific evidence.

The rest stay in `observations.md` for future synthesis.

### Action 5 — Spawn karen for promotion vetting (conditional)

If 0 candidates, skip karen and Action 6 → Action 7.

If ≥ 1 candidate, spawn `karen` (same sub-agent V-1 uses, distinct prompt). Pass each candidate with citation, target principles file path (e.g., `command-center/principles/test-layer-principles/T-5.md`), and that file's "Contract for new rules" header (read first).

karen vets: format match (one-line rule + one-line `Why:`), no war stories, no wave refs, no `Context:`/`Cross-ref:` fields, sequential numbering. Returns APPROVE / REJECT per candidate.

### Action 6 — Lint, then promote (conditional)

Per principles file, take AT MOST ONE karen-APPROVED candidate. If multiple candidates target the same file, pick strongest by:

1. **Highest cross-wave generality count.**
2. **Severity** — `strong` beats `warning` beats `informational`.
3. **Tie-break on recency.**

Write the chosen candidate to `process/waves/wave-<N>/blocks/L/candidates/<file-stem>.md` in the strict 2-line format from the target file's "Contract for new rules":

```
N. <one-line rule>
   Why: <one-line causal explanation>
```

The candidate file is the lint target — append to the principles file only after lint PASS.

#### Run the deterministic linter

The linter enforces what the contract makes mechanically checkable. Karen catches semantic issues (falsifiability, war-story preamble); the linter catches format drift karen missed. Run on each candidate file:

```bash
CAND="process/waves/wave-<N>/blocks/L/candidates/<file-stem>.md"

# 1. Rule line ≤ 120 chars (rule line starts with "N. ")
awk '/^[0-9]+\. / && length($0) > 120 { print "rule line "NR" > 120 chars ("length($0)")"; exit 1 }' "$CAND" \
  || { echo "linter:rule>120"; exit 1; }

# 2. Why line ≤ 100 chars (why line is whitespace-indented + "Why:")
awk '/^[[:space:]]+Why:/ && length($0) > 100 { print "why line "NR" > 100 chars ("length($0)")"; exit 1 }' "$CAND" \
  || { echo "linter:why>100"; exit 1; }

# 3. Forbidden tokens (case-insensitive; word-boundaried where applicable)
grep -iEn '\b(we|our|the team)\b|during wave-|wave-[0-9]+|because[^.]*because|—|\([^)]{30,}\)' "$CAND" \
  && { echo "linter:forbidden-token"; exit 1; }

# 4. Exactly 2 non-empty lines
test "$(grep -cv '^[[:space:]]*$' "$CAND")" = "2" \
  || { echo "linter:not-2-lines"; exit 1; }

echo "linter:OK"
```

Capture stdout + the failing line number (when applicable) — that's the rewrite-prompt input for the cap-1 retry.

#### On linter REJECT — cap-1 karen rewrite

Re-spawn karen for this candidate ONLY (other candidates already linted are unaffected). Pass:
- The candidate file path.
- The linter's specific failure code (e.g., `linter:forbidden-token`) plus the matching line.
- The target file's "Contract for new rules" header (read fresh).
- Directive (verbatim): "Rewrite this candidate to fit the contract. Do NOT salvage prose. If you cannot fit the rule under the limits, return DROP."

Karen returns either a rewritten 2-line candidate (overwrite the candidate file) or `DROP`.

Re-run the linter on the rewrite. **No second rewrite** — second linter failure (or a karen `DROP`) drops the candidate:

- Append a note to `process/waves/wave-<N>/blocks/L/observations.md` under the originating observation: `promotion blocked by linter; candidate dropped at L-2 wave-<N> (reason: <linter:code>)`.
- Record the drop in the L-2 deliverable's `candidates_dropped_by_linter` array.
- Do NOT promote. Continue with remaining files' candidates.

#### On linter PASS — append and commit

Append the 2-line entry to the principles file under `## Rules` (preserving the contract format). Then:

```bash
git add command-center/principles/<file>.md process/waves/wave-<N>/blocks/L/candidates/<file-stem>.md
git commit -m "docs(principles): L-2 promote rule N to <file> from wave-<N>"
```

The candidate file is committed alongside the promotion as the audit trail (linter target preserved).

**At most one promotion per file per wave.** Cap is per-file, not per-wave — multiple files may each receive one.

### Action 7 — Record observation pipeline state

Observations always emit to `process/waves/wave-<N>/blocks/L/observations.md`, even with no promotions. Future L-2 reads cross-wave from `process/waves/_archive/wave-*/blocks/L/observations.md`.

Notable findings missing promotion threshold but feeling important may be flagged in the L-2 deliverable for founder's next-checkpoint review. Soft signal.

### Action 8 — Write the L-2 deliverable

Write `process/waves/wave-<N>/stages/L-2-distill.md` per schema below. No archive move at L-2 — N-3 owns archival.

## Deliverable

`process/waves/wave-<N>/stages/L-2-distill.md` — task-status outcomes, observation count, candidates, karen verdicts, promotions applied, plus footer.

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "tasks: <task-id-1> done, <task-id-2> done, ..."
  - "observations: process/waves/wave-<N>/blocks/L/observations.md (<n> observations)"
  - "principles promotions: <count> across <file-list>"
tasks_marked_done: [<task-id>, ...]
tasks_skipped_with_reason: []          # cancelled / non-done states
observations_emitted: <n>
promotion_candidates: <n>
karen_verdicts: [{candidate_id, target_file, verdict}]
linter_runs: [{candidate_id, target_file, attempt, verdict, rejection_code}]
candidates_dropped_by_linter: [{candidate_id, target_file, final_reason}]
promotions_applied: [{file, line, rule}]
note: ""
```

## Exit criteria

- Every `claimed_task_id` is `done` (or skip-with-reason recorded); Action 2 verification confirms each ID appears in the done list.
- knowledge-synthesizer ran with full input.
- Observations recorded in `process/waves/wave-<N>/blocks/L/observations.md`.
- Promotion candidates (if any) vetted by karen against contracts.
- Each karen-APPROVED candidate passed the deterministic linter (or was dropped after one cap-1 karen rewrite failed).
- At most one promotion per principles file applied.
- Promotion commits pushed (each carries its candidate file as audit trail).
- L-2 deliverable written; carries `l_stage_verdict: COMPLETE`.
- `process/waves/wave-<N>/checklist.md` L-2 row checked.

## Next

→ `claudomat-brain/DISPATCHER.md` → next block is **N** (Next) — `read claudomat-brain/blocks/next/next.md` (after L-1 also exits; per dispatcher § Parallelization).
