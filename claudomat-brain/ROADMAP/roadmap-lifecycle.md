# Roadmap Lifecycle — Static Reference

This file is the **spec**; the `milestones`, `tasks`, and `founder_bets` tables in Postgres are the **data** (per [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md)). Roadmap-planning ritual is the single authoring path; this file documents the schema, status semantics, and edit permissions that every brain agent honours.

---

## Related rules (quick index)

| Trigger / topic | File |
|---|---|
| Roadmap-planning ritual (strategic; authors milestones in `status='todo'`, no child tasks) | [`claudomat-brain/ROADMAP/roadmap-planning-ritual.md`](roadmap-planning-ritual.md) |
| Milestone-decomposition ritual (operational; per-wave; authors one bundle of seed + 0-N siblings under active milestone) | [`claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md`](milestones/milestone-decomposition-ritual.md) |
| Daily Tier-3 + assignment checkpoint | `claudomat-brain/rules/daily-checkpoint.md` |
| Backlog stockout / replenishment | [`claudomat-brain/blocks/next/stages/N-1-survey-and-triggers.md`](../blocks/next/stages/N-1-survey-and-triggers.md) |
| P-0 Frame per-wave assignment | [`claudomat-brain/blocks/product/stages/P-0-frame.md`](../blocks/product/stages/P-0-frame.md) |
| V-2 Triage per-wave triage | [`claudomat-brain/blocks/verify/stages/V-2-triage.md`](../blocks/verify/stages/V-2-triage.md) |
| Tier 1 / 2 / 3 autonomy | `claudomat-brain/management/default-mode.md` |
| Automatic-mode / BOARD routing | `claudomat-brain/management/automatic-mode.md` |
| DB schema | [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md) |
| Filesystem companion data | `command-center/product/product-decisions.md` (append-only decision log, stays on FS); `command-center/artifacts/competitive-benchmarks/` (refresh evidence, stays on FS) |

---

## Milestone schema

Every milestone is a row in the `milestones` table. Column reference: [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md) § milestones. All required content lives in real columns; `description` is prose with conventional Markdown sections.

### Columns

| Column | Required | Notes |
|---|---|---|
| `id` | yes (auto) | `uuid` — canonical link target; child tasks reference via `tasks.milestone_id`. |
| `title` | yes (logical) | Theme name, e.g. `"M1 — Seller Trust Signals"`. Nullable in schema but ritual-required. |
| `status` | yes | One of `todo | in_progress | blocked | done | cancelled` (CHECK-enforced). |
| `bet_id` | optional | FK to `founder_bets`; NULL when no bet authored. |
| `created_at`, `updated_at` | auto | Trigger maintains `updated_at`. |

### Description prose — conventional sections

Free-form, but the roadmap-planning ritual writes these sections so other agents can find them by header:

- `## Horizon` — `H1` / `H2` / `H3` (single horizon).
- `## Class` — `platform-foundation` / `product-feature` / `product-polish`. Drives mvp-thinner spawn gate at P-0 and roadmap-planning tier weighting.
- `## Tier` — explicit `T1`..`T6` priority line (LLM-judged at planning, founder may override).
- `## Scope` — bullet list of UI surfaces / flows / features in scope. Abstract — not task titles.
- `## Success metric` — concrete, measurable, dated. `_TBD by founder_` acceptable while no child tasks exist.
- `## References` — bullet links to `product-decisions.md`, journey map nodes, competitive benchmarks, founder bets.
- `## Why now` — 1–2 sentence horizon rationale.
- `## Bet source` — `Competitive` / `Differentiation` / `Founder-bet` / `Trend`.

Optional sections: `## Depends on` (upstream milestones), `## Required by` (downstream consumers — required for `platform-foundation`), `## Deferred reason`, `## Cancelled reason`, `## Successor`.

These are read by LLM judgment, not by SQL. Drift between agents on exact wording is tolerated.

### Milestone class invariants

1. Class is set at creation in the `## Class` section. Reclassification = cancel + recreate; record in `product-decisions.md`.
2. `platform-foundation` milestones MUST declare `## Required by` consumers at creation. Roadmap-planning surfaces foundations with no live consumers (T6) for defer/cancel review.
3. `## Class` cannot read `_TBD_`. Roadmap-planning rejects new milestones missing this section.

---

## Task schema

Every task is a row in the `tasks` table. Column reference: [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md) § tasks. Everything load-bearing is a real column:

- **`milestone_id`** — canonical task → milestone link. NULL = unassigned queue. Survives milestone renames atomically (FK; no slug to sync).
- **`wave_id`** — wave that produced or claimed this task. NULL = pre-authored (waiting in the milestone's queue) or unclaimed.
- **`parent_task_id`** — sibling / sub-task relationship (P-1 splits, V-2 sub-findings).
- **`status`** — `todo` / `in_progress` / `blocked` / `done` / `cancelled` / `recurring`.

`description` is free-form prose. The only structured carve-outs are the MONITOR YAML payload and the P-2 spec-contract YAML head, both documented in [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md). The brain never `ILIKE`s description content.

### Bundle authoring (per-wave)

Roadmap-planning creates a milestone with **zero** child tasks. The decomposition ritual authors child tasks **one bundle at a time, per wave** — fired by N-1 when the active milestone's queue has no seed candidate and the LLM judges the milestone's `## Scope` not yet shipped.

```sql
-- Decomposition INSERTs one bundle per fire:
INSERT INTO tasks (title, description, status, milestone_id, wave_id, parent_task_id)
VALUES
  ($seed_title, $seed_desc, 'todo', $active_milestone_id, NULL, NULL),         -- seed
  ($sib_title, $sib_desc, 'todo', $active_milestone_id, NULL, $seed_id);       -- 0-N siblings
```

N-2 picks the seed (`parent_task_id IS NULL`, oldest `created_at`) + loads siblings (`parent_task_id = seed.id`). B-0 claims the whole bundle (sets `wave_id`, flips `status='in_progress'`). L-2 closes the whole bundle.

### Bug / follow-up tasks (V-2, D-3)

INSERTed during a wave with `wave_id` = current wave, `milestone_id` = active milestone when scope overlaps (else NULL → unassigned). Description carries source citation + impact in prose. No `tags: bug-*`, no `severity`, no `urgency` — discoverability is `WHERE milestone_id = $1 AND status='todo'`.

---

## The unassigned queue

Tasks with `milestone_id IS NULL` live in the `tasks` table with no milestone linkage. They never list under a specific milestone's child set.

### How tasks become unassigned

- **V-2 Triage** — bugs surfaced by Playwright swarm, reality check, 4xx scan whose affected files don't overlap any active milestone.
- **`competitive-analyst` proposals** — feature gaps from competitive scans.
- **`trend-analyst` surfacings** — market shifts.
- **Founder ad-hoc additions** — ideas inserted directly (Studio UI or CLI).
- **User feedback / support tickets** — if wired later.

**Exception:** if the orchestrator at B-block discovers a bug that **blocks the current wave**, it becomes a same-wave fast-fix (per V-3 Fast-fix). No queue touch.

### How unassigned is resolved

P-0 Frame of every subsequent wave walks the unassigned queue and assigns what it can to existing milestones via `UPDATE tasks SET milestone_id = <m>`. Daily checkpoint surfaces three buckets to the founder.

Tasks can stay `milestone_id = NULL` indefinitely. Valid terminal state.

### Viewing the queue

```sql
SELECT count(*) FROM tasks WHERE status='todo' AND milestone_id IS NULL;
```

Studio UI: filter view on the same predicate.

---

## Reference format rules

All cross-row references MUST resolve. Roadmap-planning ritual validates bi-directional integrity at Step 2.

### Task → milestone

The canonical link is `tasks.milestone_id` (FK). Renames touch only `milestones.title` and `milestones.description` — child tasks point by `id`, no slug to sync.

### Milestone → bet

`milestones.bet_id` FK is the canonical bet linkage. Prose `## References` may also name the bet for human readers; the FK is authoritative.

### Bi-directional integrity check (roadmap-planning ritual)

- For every milestone: report task counts by status via `SELECT count(*) FROM tasks WHERE milestone_id = $1 GROUP BY status`. Flag milestones with zero child tasks (cancel or demote candidate).
- For every task with `milestone_id IS NOT NULL`: confirm the milestone exists (FK guarantees, but report orphans surfaced via `ON DELETE SET NULL`).
- Any drift → surface in ritual output; resolve before closing ritual.

---

## Edit permissions

| Change type | Authorized writer |
|---|---|
| Milestone `status` flip (`todo` → `in_progress` → `done` etc.) | N-1 (promotion + closure detection) per state rules below; roadmap-planning (cancel / defer) |
| New milestone INSERT (`status='todo'`, no child tasks) | Roadmap-planning ritual only |
| Milestone description prose edit (scope, success metric, references) | Roadmap-planning ritual (`/plan-ceo-review` gate); inline `_TBD_` finalization allowed |
| Milestone rename (`title` edit) | Roadmap-planning ritual — single UPDATE on `milestones.title`; no task touches needed |
| Milestone cancel (`status='cancelled'`) | Roadmap-planning ritual only |
| INSERT bundle (1 seed + 0-N siblings via `parent_task_id`) under active milestone | Milestone-decomposition ritual only (per-wave; fired by N-1 when active queue has no seed candidate) |
| INSERT additional siblings under existing seed (P-1 MERGE expansion) | Decomposition ritual invoked by P-1 RESCOPE-AUTO-MERGE |
| Task `milestone_id` UPDATE (assign unassigned to active milestone) | P-0 Frame; daily-checkpoint (founder/ceo decision) |
| Task `status` flip (`todo` → `in_progress` via claim, etc.) | B-0 (claim — `in_progress`, `wave_id` set); L-2 (`done`); V-2/N-2 (`cancelled`/`blocked`) |
| Task description rewrite (prose) | Authoring stage only (P-2 for spec head; V-2/D-3 at creation; founder direct) |
| Spec-contract YAML head on a task | P-2 (authoring); P-0 (freshness check, read-only) |
| MONITOR task INSERT (`status='recurring'`, YAML body) | Monitor templates per [`monitor-principles.md`](../monitors/monitor-principles.md) |
| Founder direct override | Any time; log entry to `product-decisions.md` |

**Agents editing milestones/tasks outside these rules = plan defect flagged at V-2 Triage.**

---

## Milestone state transitions

Status enum is the **only** state. No derived substates. A `status='todo'` milestone may have zero child tasks (just authored by planning) or N child tasks (decomposition fired one or more times); both are the same state — `todo` means "not the active milestone yet."

### Transition diagram

```
   ┌────────────────────────┐
   │ status='todo'          │ ← roadmap-planning INSERTs new milestones here
   │   (may have 0 or N     │   (decomposition fires per-wave once promoted,
   │    child tasks)        │    so a 'todo' milestone usually has 0 children)
   └────┬───────────────────┘
        │ N-1 promotes the highest-tier 'todo' when active slot is empty
        ▼
   ┌────────────────────────┐
   │ status='in_progress'   │ ← active milestone; N-1 fires decomposition per-wave
   │                        │   when the active queue has no seed candidate AND
   │                        │   LLM judges scope not yet shipped
   └────┬───────────────────┘
        │ N-1 closes when all child tasks are terminal AND LLM judges
        │ scope shipped per the milestone's prose
        ▼
   ┌────────────────────────┐
   │ status='done'          │ ← shipped
   └────────────────────────┘

   Off-path:
   status='cancelled'   — abandoned milestone (roadmap-planning)
   status='blocked'     — external hold (legal, compliance)
```

### Invariants

1. At most one milestone in `status='in_progress'` at any time.
2. Promotion `todo → in_progress` requires the prior active milestone (if any) to have reached `status='done'` (or `cancelled`).
3. Closure `in_progress → done` requires ALL child tasks (`WHERE milestone_id = $1`) in terminal status (`done` or `cancelled`) AND LLM-judged scope-shipped per the milestone's `## Scope` + `## Success metric` prose. Strict.
4. `status` flips are atomic and the canonical signal.

### Stockout cascade

Single trigger: if no `todo` milestone exists at all, N-1 fires roadmap-planning (reason `milestone-stockout`). Roadmap-planning INSERTs new milestones in `status='todo'` (no child tasks). Decomposition is per-wave — N-1 fires it during the active milestone's life when the queue needs the next bundle (not as a "fill the milestone in advance" step).

Loop pauses if roadmap-planning cannot complete (e.g. founder absent under strict timing). Pause marker: `process/session/.loop-paused.yaml` per N-3 behavior.

## Bundles

A **bundle** is the unit N-2 hands to a wave: one **seed task** + 0-N **sibling tasks**. Bundle structure is the existing `tasks.parent_task_id` self-FK — no metadata flags, no separate column.

- **Seed** = task with `parent_task_id IS NULL`, `milestone_id = <active>`, `wave_id IS NULL`, `status='todo'`. N-2 picks the oldest such row.
- **Siblings** = `WHERE parent_task_id = $seed.id AND wave_id IS NULL AND status='todo'`. Empty list = single-task bundle. N-2 reads them all.
- **Claim** = B-0 runs `UPDATE tasks SET status='in_progress', wave_id=<new> WHERE id = ANY([seed.id, ...sibling.ids])` in one batch.
- **Close** = L-2 runs `UPDATE tasks SET status='done' WHERE id = ANY($claimed_task_ids)` for the same list.

Bundles are authored by the decomposition ritual (per-wave) and by P-1 RESCOPE-AUTO-SPLIT (when a wave splits mid-flight, surplus is re-parented and becomes future-wave seeds). V-2 and D-3 follow-ups always INSERT with `parent_task_id = NULL` (top-level — become candidate seeds for future waves).

### State recording

Every milestone state transition writes to two locations:

1. The `milestones.status` column.
2. `command-center/product/product-decisions.md` — append-only entry: `[YYYY-MM-DD] M<N>: <prior-status> → <new-status> (<trigger>)`.

The stage detecting the transition (N-1 for promotions / closures, roadmap-planning for cancel) writes both.

### State recording

Every milestone state transition writes to two locations:

1. The `milestones.status` column.
2. `command-center/product/product-decisions.md` — append-only entry: `[YYYY-MM-DD] M<N>: <prior-status> → <new-status> (<trigger>)`.

The stage detecting the transition (N-1 for promotions / closures, roadmap-planning for cancel) writes both.

### Inline edits

**Allowed at any time:** `milestones.status` flips per the 5 base values; `tasks.status` flips per claim / done / cancel / block; finalize `_TBD_` success metric in milestone description prose; `tasks.milestone_id` UPDATE during P-0 assignment.

**Not allowed inline:** add / remove milestones; rewrite milestone scope or class; bulk task rewrites. Routed through the roadmap-planning ritual.

---

## Anti-patterns

| # | Never | Why |
|---|---|---|
| 1 | Parse description content with `ILIKE` / `regexp_match` / `regexp_replace` outside `claudomat-brain/monitors/`. | Description is prose. Two structured carve-outs (MONITOR YAML, spec-contract YAML head) are YAML-parsed at the head, not key:value-grepped. |
| 2 | Inline material scope changes into an active milestone outside the planning ritual. | Skips `/plan-ceo-review` gate; compounds into untracked scope creep. |
| 3 | Promote a competitive-analyst proposal straight to `status='in_progress'`. | Every milestone enters `status='todo'` via roadmap-planning; N-1 owns the promotion step. |
| 4 | Mix themes in one milestone. | If scope grows cross-theme, split (M3 → M3 + M3.1) at the next planning ritual. |
| 5 | Edit `status='done'` milestone rows. | Author a new milestone instead. |
| 6 | INSERT bundle rows under a milestone outside the authorized writers. | Bundles (seed + siblings) come from the decomposition ritual (per-wave, fired by N-1) or P-1 RESCOPE-AUTO-MERGE expansion. Bug/follow-up rows from V-2/D-3 are different — they're current-wave artifacts with `wave_id` set and `parent_task_id = NULL`, and may have `milestone_id` NULL (unassigned) or matching the active milestone. |
| 7 | Flip `todo → in_progress` outside N-1. | N-1 owns slot semantics (≤1 active, prior must reach `done`). |
| 8 | Skip a milestone's closure check. | `done` requires every child task in terminal state. Any open task blocks — founder may `cancel` to defer. |
| 9 | Treat the unassigned queue as a backlog. | Unassigned is staged for the next P-0 walk; the real backlog is `status='todo'` milestones. |
| 10 | Set `tasks.status='done'` outside L-2 closure or explicit founder action. | Status transitions are wave-loop-driven. Manual flips break wave-counter integrity at N-3. |
