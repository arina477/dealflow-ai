# L-1 — Docs

> **Block:** L (Learn), 7th of 8 in wave loop: `P → [D] → B → C → T → V → ` **`L`** ` → N`.
> **Stages:** **L-1** ∥ L-2. L-1 and L-2 run concurrently (per dispatcher § Parallelization). Block exits once both have exited.
> **Pattern:** spawn-pattern (headless). head-learn owns the block as a sub-agent; orchestrator coordinates.
> **Dispatcher** (skip rules, ≤1-rule-promotion-per-wave, exit handoff): `claudomat-brain/blocks/learn/learn.md`.

## Purpose

CHANGELOG entry, ROADMAP milestone delta, README touchups for user-facing changes. T-9 already regenerated `user-journey-map.md`; L-1 does NOT redo journey-map work.

## Prerequisites

- V-block exited with Karen + jenny APPROVE.
- READ `process/waves/wave-<N>/stages/P-2-spec.md` for the wave's user-facing claims.
- READ current milestone state from the DB (`SELECT … WHERE status='todo'` for the planned queue + `SELECT … WHERE status='in_progress'` for the active milestone; table shapes in [`claudomat-brain/db/SCHEMA.md`](../../../db/SCHEMA.md)).
- READ recent CHANGELOG entries (`git log -p CHANGELOG.md | head -80`) to match house style.

## Skip condition

L-1 stage does NOT skip. Sub-actions skip per their conditions below.

## Actions

### Action 0 — Spawn head-learn

Spawn head-learn via Agent tool, `subagent_type: head-learn`. Brief on claimed task IDs, V-block verdicts, milestone delta candidates, active mode. No subsequent action runs until ACK. Sub-agent (not orchestrator-mask) because L-block is lightweight + observation-driven. The `Agent(subagent_type=head-learn)` call appears on transcript — same activation proof as mask-load Reads in P/D/B/T/V.

### Action 1 — CHANGELOG entry

Append under the current unreleased / next-version section. Default format: keep-a-changelog (Added / Changed / Fixed / Removed / Deprecated / Security).

Wave content → CHANGELOG section:
- New feature from spec contract → **Added**
- Existing feature modified → **Changed**
- V-3 `bug-*` blocking finding fixed in this wave → **Fixed**
- Removed code / endpoint / route → **Removed**
- Future-removal warning → **Deprecated**
- Vulnerability that DID ship to users in a prior wave and is patched in this wave → **Security**

**Security section: shipped vulnerabilities patched after the fact only.** Preventive security in the same wave (rate-limit on a new endpoint, CSRF on a new auth flow) goes in **Added**/**Changed**.

Style: one line per change, declarative present-tense, user-facing language. Cite wave or PR when useful (`(#127)`).

**Length cap: headline paragraph + ≤5 bullets.** A CHANGELOG entry is a release-note, not a file-by-file inventory — `git log -p CHANGELOG.md | head -80` shows historical entries; some are over-detailed and predate this discipline. Match the terse ones, not the verbose ones. PR descriptions and commit messages carry the file-level detail.

### Action 2 — Milestone delta

Resolve the set of distinct milestones touched by this wave via the `tasks.milestone_id` FK on the claimed tasks:

```sql
SELECT DISTINCT m.id, m.title, m.status, m.description
FROM milestones m
JOIN tasks t ON t.milestone_id = m.id
WHERE t.id = ANY('{<claimed_task_ids>}'::uuid[])
  AND m.id IS NOT NULL;
```

For every such milestone:

1. L-2 already set the wave's claimed task rows to `status='done'`. L-1's job is to evaluate milestone-level progression based on the new state.
2. Check whether every child task under this milestone is now in a terminal status:

   ```sql
   SELECT
     count(*) FILTER (WHERE status='done') AS done_count,
     count(*) FILTER (WHERE status IN ('todo','in_progress','blocked')) AS open_count
   FROM tasks
   WHERE milestone_id = $milestone_id;
   ```

   If `open_count = 0` (every child task `done` or `cancelled`), transition the milestone via `UPDATE milestones SET status='done' WHERE id = $milestone_id` (shipped). Append the transition to `command-center/product/product-decisions.md` per `claudomat-brain/ROADMAP/roadmap-lifecycle.md` § State recording.
3. If open child tasks remain but count drops below project threshold, flag for next-wave roadmap-planning (recorded in deliverable; N-1 picks it up under reason `backlog-stockout`). Threshold lives in `command-center/principles/PRODUCT-PRINCIPLES.md` § Roadmap. Brain-level fallback when no project value declared: < 3 remaining open tasks per milestone.

**Skip when** no milestone progressed (e.g., wave's claimed tasks all had `milestone_id IS NULL`, i.e. came off the unassigned queue without a milestone assignment). Record skip in deliverable.

**Mode-aware judgment routing.** When the milestone delta requires a judgment call (is this milestone "really done" or just structurally complete?):

| Mode | Judgment-call path |
|---|---|
| `founder-review` | Defer to founder. Mark sub-action `l_stage_verdict: DEFERRED`; rest of L-1 proceeds. Founder picks up at next session start. |
| `default` | Defer to founder (strategic decision; hard-stop that still goes to founder under default). Same DEFERRED mechanic. |
| `automatic` | BOARD with decision-slug `L-1-roadmap-delta-wave-<N>` per `claudomat-brain/management/conflict-resolution.md`. Append to `process/session/updates/board-digest-<YYYY-MM-DD>.md`. Verdict applied; L-1 continues. |
| `degenerate` | **ceo-agent decides** within `claudomat-brain/management/ceo-blocklist.md` charter. Spawn ceo-agent with milestone state, V-block claimed task outcomes, candidate edit. ceo-agent picks "milestone done" / "milestone partial" / "milestone re-scoped," appends to `process/session/updates/ceo-digest-<YYYY-MM-DD>.md`, returns resolution. L-1 applies edit; no deferral. |

Mechanical milestone progress with no ambiguity runs under any mode without escalation.

### Action 3 — README touchups (conditional)

Skip when nothing user-facing changed. Otherwise:

- New CLI command / flag → README usage section.
- New env var → README env table.
- New install step → README quick-start.
- Breaking change → README upgrade note + version bump intent recorded.

Keep edits surgical. Detailed changes stay in CHANGELOG.

### Action 4 — Commit

Milestone progression writes commit to the DB inside Action 2 (no git commit needed). Action 4 commits the FS-side touchups only.

**Default: one batched commit (FS):**

```
docs: L-1 wave-<N> closeout (changelog, readme)
```

**Split commits** when a concern warrants its own review: README breaking-change note, CHANGELOG Security entry. Messages:
- `docs(changelog): L-1 add wave-<N> entry`
- `docs(readme): L-1 update <section> for wave-<N>` (when fired)

Push to `main` if project allows direct doc commits, otherwise via follow-up PR (see V-3 Action 1c).

## Deliverable

`process/waves/wave-<N>/stages/L-1-docs.md` — changelog line range, milestone deltas, README sections, commit SHAs, plus footer.

```yaml
l_stage_verdict: COMPLETE             # or DEFERRED if any sub-action deferred
verdict_evidence:
  - "CHANGELOG.md:<line-range>"
  - "milestones row UPDATE: <milestone-id>"   # if fired
  - "README.md commit: <sha>"          # if fired
changelog_entry_added: true
roadmap_milestones_progressed: [{milestone, before, after}]
roadmap_skip_reason: ""               # populated when Action 2 skipped
readme_sections_touched: []
note: ""
```

## Exit criteria

- CHANGELOG entry appended.
- Milestone rows progressed in the DB (or skip recorded with reason).
- README touched if user-facing changed (or skip recorded).
- Commits pushed.
- Deliverable carries `l_stage_verdict: COMPLETE` (or `DEFERRED` with documented sub-action holds).
- `process/waves/wave-<N>/checklist.md` L-1 row checked.

## Next

→ `claudomat-brain/blocks/learn/learn.md` → block exit (after L-2 also exits; per dispatcher § Parallelization).
