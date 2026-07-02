# P-0 — Frame

> **Block:** P (Product), 1st of 8 in wave loop: **`P`** ` → [D] → B → C → T → V → L → N`.
> **Stages:** **P-0** → P-1 → P-2 → P-3 → P-4 (gate). Advance on stage exit: P-1.
> **Pattern:** gate-only. head-product spawned at P-4 for verdict; reference card on demand at `~/.claude/agents/head-product.md`.
> **Dispatcher** (skip rules, gate semantics, exit handoff): `claudomat-brain/blocks/product/product.md`.

## Purpose

Block-entry stage. Avoid redoing work; align wave with roadmap; short-circuit P-2..P-3 if next-claimable task already carries a spec contract; then prevent "right code for the wrong problem" by spawning independent reviewers (problem-framer + ceo-reviewer + conditional mvp-thinner) before any sizing or spec work.

## Prerequisites
- Wave topic identified (from `Task — next claimable` recipe, founder ask, or N-2 seed)
- `process/session/.last-wave-completed.yaml` read (or recognized absent on greenfield install)
- Task description available (`tasks.description` content from `Task — show one` recipe, or user message)

## Actions

### Action 0 — Block entry: open wave row + seed review-artifacts manifest

<!-- head-product card may be consulted on demand at ~/.claude/agents/head-product.md -->

**0a. Open the wave row.**

Brain's `waves` GRANT is `INSERT (milestone_id)` only — every other column is trigger- or default-managed. Open the wave via the `Wave — open` recipe in [`claudomat-brain/db/SCHEMA.md`](../../../db/SCHEMA.md):

```sql
INSERT INTO waves (milestone_id) VALUES (NULL)
RETURNING id, wave_number, started_at;
```

The `set_wave_number()` BEFORE-INSERT trigger assigns `wave_number = MAX + 1` globally per project; `status` defaults to `'running'`; `started_at` defaults to `now()`.

Capture `wave_number` from RETURNING as `<N>` — used immediately by 0b (FS dir) and 0c (manifest header). Note `id` in the P-0 deliverable for traceability (FS dir ↔ DB row correlation); subsequent stages never carry it across — they re-resolve via the `Wave — current` recipe (`WHERE status='running' ORDER BY wave_number DESC LIMIT 1`).

If INSERT fails with `permission denied for column <name>` (SQLSTATE `42501`) or any other rule-13 unrecoverable infra error (`28xxx` auth, connection-refused, DNS-fail, TLS-handshake-fail), treat it as the rule-13 `source: wave-query` infra-readiness failure: do not retry, do not migrate, do not provision — follow rule 13's response flow (under autonomous modes write `STATUS: BLOCKED` to `process/session/status-check.yaml` with `pause_evidence.trigger: d-hard-stop-verdict` + `measurement.shape: infra-readiness` + `sqlstate: 42501` + `failing_sql:` + `captured_query_error:`; under founder-review / default, escalate to founder). The fix is upstream — studio-side GRANT migration. Trigger races aren't possible under brain's single-wave-at-a-time contract; a `wave_number` UNIQUE violation here means an external writer touched the table or brain's serialization broke — abort and report.

**0b. Create the wave directory and seed the checklist.**

`<N>` is the `wave_number` from 0a's RETURNING.

```bash
mkdir -p process/waves/wave-<N>/blocks/{P,D,B,C,T,V,L,N}
mkdir -p process/waves/wave-<N>/stages
```

Seed `process/waves/wave-<N>/checklist.md` from the template in `claudomat-brain/DISPATCHER.md` § "Stage completion ledger". FS transcripts live under `process/waves/wave-<N>/`; lifecycle state (status, timings) lives in the DB row. They share `<N>` (= `wave_number`) as the human-readable key, but the DB row is canonical — FS dirs are derived artefacts.

**0c. Seed the P-block review-artifacts manifest.**

Write `process/waves/wave-<N>/blocks/P/review-artifacts.md` using the schema below. Updated at every P-stage exit; consumed at P-4 Action 1 by the fresh head-product sub-agent.

```markdown
# Wave <N> — P-block review artifacts

**Block:** P (Product)
**Wave topic:** <one line>
**Block exit gate:** P-4
**Status:** in-progress

## Stage deliverables

| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| P-0 | process/waves/wave-<N>/stages/P-0-frame.md | in-progress | seeded at P-0 Action 0; covers discovery + reframe |
| P-1 | process/waves/wave-<N>/stages/P-1-decompose.md | pending | |
| P-2 | process/waves/wave-<N>/stages/P-2-spec.md | pending | (may be skipped on `valid` short-circuit) |
| P-3 | process/waves/wave-<N>/stages/P-3-plan.md | pending | (approach + plan) |
| P-4 | process/waves/wave-<N>/stages/P-4-gemini-review.md | pending | (Phase 2 reviewer output) |

## Block-specific context

- **Wave topic:** <one line>
- **Spec-contract short-circuit verdict:** <pending — to be set at P-0 Action 3>
- **Roadmap milestone:** <pending — to be set at P-0 Action 2>
- **design_gap_flag:** <unset — to be set at P-1>
- **claimed_task_ids:** <pending — to be set at P-2>
- **Tier-3 product decisions resolved this wave:** <list, or "none">
- **Autonomous mode active during P-block:** <founder-review | default | automatic | degenerate>

## Open escalations carried into gate

<list, or "none">

## Gate verdict log

<appended by fresh head-product spawn at P-4 Action 1; one entry per attempt>
```

### Action 1 — Prior-work query
Full-text search `command-center/product/product-decisions.md` + prior-wave `process/waves/wave-<N>/checklist.md` for prior waves touching the same surface:
- Prior wave covers same scope and is current → cite it; reduce P-4 review scope to delta.
- Nothing relevant → continue.

### Action 2 — Roadmap alignment

Query the active and planned milestones from the DB to confirm the wave fits one:

```sql
SELECT id, title, description FROM milestones WHERE status = 'in_progress';
SELECT id, title, description FROM milestones WHERE status = 'todo' ORDER BY created_at;
```

Query live `founder_bets` rows for ambition baseline. Read `command-center/product/product-decisions.md` on FS for prior decisions that constrain scope.

If the next-claimable task has `milestone_id IS NULL` (came off the unassigned queue), attempt to map it to an `in_progress` or `todo` milestone now (LLM judges fit by reading each milestone's `## Scope` prose):

```sql
UPDATE tasks SET milestone_id = $1 WHERE id = $2;
```

Leave `milestone_id IS NULL` if no clear match — valid terminal state surfaced by N-1 triggers and the daily checkpoint.

Once the task's milestone is resolved (either pre-set or newly assigned here), backfill the wave row's `milestone_id` via the `Wave — backfill milestone` recipe:

```sql
UPDATE waves SET milestone_id = $1
WHERE id = (
  SELECT id FROM waves
  WHERE status = 'running'
  ORDER BY wave_number DESC
  LIMIT 1
);
```

If the task stays unassigned, `waves.milestone_id` stays NULL — valid terminal state.

### Action 3 — Spec-contract short-circuit check

Read the next-claimable task's `description`. If it opens with a fenced YAML block followed by `---` (the spec-contract carve-out per [`claudomat-brain/db/SCHEMA.md`](../../../db/SCHEMA.md)), parse the YAML head. Required keys: `spec-id`, `wave_type`, `claimed_task_ids`, `acceptance-criteria`, `contracts`, `edge-cases`, `created-at`.

| Verdict | Effect |
|---|---|
| `valid` | YAML head parses + `created-at` is recent + every `claimed_task_ids` entry resolves to an existing task. Skip P-2 (spec). P-3 still runs; verify it's not stale. |
| `stale` | YAML head parses but `created-at` is older than a project-level freshness threshold, OR `claimed_task_ids` references cancelled/done rows. Run full P-1..P-3 fresh (after Action 5 reframe). |
| `incomplete` | YAML head parses but a required key is missing OR malformed. Run P-2 to fill gaps; reuse approach + plan in P-3 if still valid. |
| `no-prior-spec` | No fenced YAML head at all (or only prose). Full P-1..P-3 run. |

Record the verdict in the deliverable. Action 5 (reframe) and P-1 always run regardless.

### Action 4 — Autonomous product decision

LLM-judged read of the seed task's description prose for Tier-3 product-decision signals (money / security / major UX trade-offs). When such a signal is present:

- Tier 1-2 (research-resolvable) → resolve with the relevant specialist (data-researcher / market-researcher / competitive-analyst) per `claudomat-brain/management/<mode>-mode.md`.
- Tier 3 → route per active mode. Under `degenerate`, ceo-agent decides within charter; otherwise queue for the founder via the daily checkpoint (orchestrator records the deferral in `process/session/checkpoint-ledger.yaml`).

Resolved decisions are appended to `command-center/product/product-decisions.md` and recorded in the manifest's "Block-specific context" section. No structured DB write.

### Action 5 — Spawn reframe reviewers in parallel

In a single orchestrator message, spawn the following independent reviewers (each runs with fresh context against the task description + this stage's discovery output):

**`problem-framer`** — symptom-vs-cause + antipatterns red-team. Applies the antipatterns catalog (`command-center/principles/PRODUCT-PRINCIPLES.md` § Antipatterns) and emits one of: `PROCEED`, `REFRAME`, `RESCOPE-AUTO-SPLIT` (deferred to P-1), `ESCALATE`. Symptom-vs-cause check is mandatory. **Always spawned.**

**`ceo-reviewer`** — strategic-value + ambition lens. Answers "is this the right thing to build, and ambitious enough?" Catches "fixing a real bug that doesn't matter" and "shipping a 3/10 when a 9/10 was achievable." **Always spawned.**

**`mvp-thinner`** — AC-level thinness lens. Output: AC-level re-shaping proposals + sibling task seeds. Verdicts: `THIN` / `OK` / `OVER-CUT`. **Spawned ONLY when the active milestone's `## Class` prose section reads `product-feature`** (LLM judgment from milestone description; the active milestone is fetched in Action 2). Skipped on `platform-foundation` and `product-polish`. Card: `~/.claude/agents/mvp-thinner.md`.

All reviewers run with same input (task description + Action 1–4 outputs). No cross-visibility until merge.

### Action 6 — Merge reframe verdicts

| problem-framer | ceo-reviewer | mvp-thinner (when present) | Effect |
|---|---|---|---|
| PROCEED | PROCEED | OK or n/a | continue to P-1 |
| PROCEED | PROCEED | THIN | head-product reviews `mvp-thinner`'s proposed sibling split. If accepted: orchestrator INSERTs the proposed sibling `tasks` rows (`milestone_id = <active>`, `wave_id = NULL`, `parent_task_id = <seed>`, prose description per the mvp-thinner verdict); current wave's spec contract narrows to remaining mvp-critical ACs. Continue to P-1. If rejected: head-product logs reasoning to deliverable's "Reframe" section and continues to P-1 with original framing. |
| REFRAME | * | * | rewrite the task framing per problem-framer; re-spawn all reviewers |
| * | (rejects ambition) | * | head-product arbitrates: lift ambition or accept and proceed (see § Mediation precedence below) |
| RESCOPE-AUTO-SPLIT | * | * | continue to P-1 (P-1 owns the split protocol) |
| ESCALATE | * | * | route to founder / ceo-agent per active mode |
| * | * | OVER-CUT | head-product reviews; if `mvp-thinner` is correct that the wave is already too thin to be valuable, head-product may invite expansion to a coherent slice; otherwise dismissed and PROCEED |

All-PROCEED / OK → orchestrator still reads every verdict; may intervene if a heuristic fires.

### Mediation precedence (ceo-reviewer vs. mvp-thinner)

When `ceo-reviewer` proposes `SCOPE-EXPANSION` or `SELECTIVE-EXPANSION` AND `mvp-thinner` returns `THIN` on the same wave, `head-product` mediates by reading the active milestone's prose + current child-task counts:

- `mvp-thinner` wins ties when the active milestone still has open child tasks that the milestone's `## Scope` prose flags as mvp-critical (LLM judgment: read the milestone's `## Scope` and per-task descriptions; count `status IN ('todo','in_progress')` rows still aligned with mvp-critical scope).
- `ceo-reviewer` wins ties when every mvp-critical scope item is covered by a `status='done'` child task.

`head-product` records the chosen precedence in the deliverable's "Reframe" section.

## Deliverable

`process/waves/wave-<N>/stages/P-0-frame.md` — single file with two sections:

**Discover section:**
- `wave_db_id: <uuid>` — captured from Action 0a's `INSERT ... RETURNING id`; recorded here for FS-dir ↔ DB-row traceability (no other stage consumes it)
- Prior-work citation (or "none")
- Roadmap milestone the wave maps to (or "unassigned")
- Spec-contract short-circuit verdict (`valid` / `stale` / `incomplete` / `no-prior-spec`)
- Product-decision resolutions (if any)

**Reframe section:**
- Original task framing
- `problem-framer` verdict + reasoning
- `ceo-reviewer` verdict + reasoning
- `mvp-thinner` verdict + reasoning (when spawned — only on `product-feature` waves)
- Mediation outcome (when `ceo-reviewer` + `mvp-thinner` disagree — which precedence applied + why)
- Sibling task IDs created (when `mvp-thinner` THIN was accepted and ACs were split out)
- Disposition (PROCEED / REFRAMED / ESCALATED)
- Final framing the rest of P-block will use

Also created at Action 0: `process/waves/wave-<N>/checklist.md` (from DISPATCHER's template) and `process/waves/wave-<N>/blocks/P/review-artifacts.md` (from the schema above).

## Exit criteria
- Discovery actions completed (prior-work query, roadmap alignment, short-circuit, product decisions).
- Reframe reviewers all returned a verdict; disposition recorded.
- `process/waves/wave-<N>/blocks/P/review-artifacts.md` updated with P-0 results.
- `process/waves/wave-<N>/checklist.md` P-0 box ticked.

## Next
→ `P-1 Decompose` (`stages/P-1-decompose.md`)
