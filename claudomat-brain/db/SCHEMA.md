# Brain DB schema

Postgres tables the brain reads and writes. **This file describes the live DB shape as the brain sees it** — the DDL itself is owned and migrated by a sibling repo, but the brain doesn't see that repo. If columns drift between what's described here and what `psql \d+ tasks` shows, this file is wrong; update it. Every brain agent that touches the DB reads this file — keep it terse.

**Role**: `claudomat_brain`. **DSN env**: `CLAUDOMAT_DB_URL` (full Postgres URL with embedded credentials — studio injects at wave spawn; outside studio export manually per `claudomat-brain/hooks/db-readiness.sh` help text). **Privileges**: `SELECT, INSERT, UPDATE, DELETE` on `founder_bets`/`milestones`/`tasks`; on `waves` `SELECT` (all columns) + column-level `INSERT (milestone_id)` + column-level `UPDATE (status, milestone_id)`. Brain has zero access to studio-owned tables (`users`, `brains`, `projects`, `project_members`, `notifications`).

**Project scope (multi-tenant)**: the connection is welded to exactly one project by its DB role (the `claudomat_brain` / per-project role embedded in `CLAUDOMAT_DB_URL`). `founder_bets`/`milestones`/`waves`/`tasks` each carry a `project_id` with `DEFAULT request_project_id()`, and row-level security filters every read/write to that project — so brain SQL needs **no** `project_id`: inserts auto-scope, selects are already confined. Do NOT add `project_id` to brain SQL or try to set it (the role has no grant on it). On single-project databases (today's default) this is a no-op.

**FS still owns** (out of DB): `process/waves/wave-<N>/...` per-stage transcripts + checklist + block manifests; `process/session/.last-wave-completed.yaml`; `process/session/status-check.yaml`; `process/session/checkpoint-ledger.yaml`; `process/session/monitors/*`; `command-center/product/product-decisions.md`; `command-center/principles/*`. Rule: queryable state → DB; append-only logs + human-authored content → FS.

**Trigger**: `set_updated_at` BEFORE UPDATE fires on `founder_bets`/`milestones`/`tasks`. Brain MUST NOT pass `updated_at` in writes. `waves` has no `updated_at` — lifecycle markers (`started_at`/`ended_at`) are explicit.

**`description` is free-form prose**. All four tables carry a `description text` column. The brain never parses `key: value` lines from it — queries filter on real columns + FKs. Two structured carve-outs:

1. **MONITOR tasks** (`status='recurring'` AND `title LIKE 'MONITOR:%'`) — description holds a YAML payload (`success_condition`, `failure_condition`, `timeout_budget`, `poll_delay`, `poll_log`) per [`claudomat-brain/monitors/monitor-principles.md`](../monitors/monitor-principles.md). Polled by the orchestrator wake-time pass.
2. **Spec contracts** (P-2-authored primary tasks) — description opens with a fenced YAML block (`spec-id`, `wave_type`, `claimed_task_ids`, `acceptance-criteria`, `contracts`, `edge-cases`, `design_gap_flag`, `created-at`), a `---` separator, then prose body. P-0 short-circuit parses the YAML head when present.

Everything else in `description` is free prose. No `ILIKE`, no `regexp_match`, no `regexp_replace` on description content anywhere in the brain outside `claudomat-brain/monitors/`.

**Operation naming.** Stages cite DB operations by short English labels — `Task — next claimable` / `Task — claim` / `Task — show one` / `Task — by milestone` / `Task — add` / `Task — done` / `Task — cancel` / `Wave — open` / `Wave — close` / `Wave — current` / `Wave — backfill milestone` / `Bet — list live` / `Milestone — list todo` / `Milestone — transition` / `MONITOR — upsert (<platform>)` / `MONITOR — delete on resolution` / `MONITOR — bulk cancel (mode-exit)`, and similar. These are reading anchors only — labels for SQL the calling stage runs inline against the columns documented below. There is no separate recipe catalog. Derive shape from the table schemas, status enums, and FK relations.

---

## `founder_bets`

| col | type | notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | |
| `title` | `text` | short memorable bet name |
| `description` | `text` | prose with conventional sections: `## Statement` (the bet, in founder's voice), `## Why I believe` (rationale), `## Horizon` (H1/H2/H3), `## Confidence` (high/medium/low), `## Falsifier` (disconfirming signal). Sections are reading conventions, not parser-enforced — brain queries filter on columns, not heading regex |
| `status` | `text NOT NULL default 'live'` | soft enum `live`/`graduated`/`retired` (no CHECK) |
| `created_at`, `updated_at` | `timestamptz NOT NULL default now()` | trigger maintains `updated_at` |

**status semantics**: `live` active; `graduated` promoted to ≥1 milestone (which references this bet via `bet_id`); `retired` abandoned or superseded.

**writers**: roadmap-planning ritual writes new live bets (founder voice; under `degenerate` mode via `ceo-agent` after email approval); graduation runs as a transaction (status → `graduated` + milestone INSERT with `bet_id`); retirement is founder-direct (or ceo-agent under charter).

---

## `milestones`

| col | type | notes |
|---|---|---|
| `id` | `uuid PK` | canonical link target — child tasks reference via `tasks.milestone_id` |
| `title` | `text` | milestone theme name |
| `description` | `text` | prose with conventional sections: `## Horizon`, `## Class`, `## Tier`, `## Scope`, `## Success metric`, `## Bet source`, `## Why now`, `## References` (the last two are optional but recommended — `## Why now` carries the H1 urgency rationale for compliance deadlines, `## Bet source` is a prose anchor for the FK to `founder_bets.id`). Sections are reading conventions, not parser-enforced — brain queries filter on columns/FKs, not heading regex |
| `status` | `text NOT NULL default 'todo'` | CHECK `('todo','in_progress','blocked','done','cancelled')` |
| `bet_id` | `uuid → founder_bets(id) ON DELETE SET NULL` | optional link to the strategic bet served |
| `created_at`, `updated_at` | `timestamptz` | trigger maintains `updated_at` |

**status semantics**: `todo` planned (zero child tasks until promoted — decomposition fires per-wave once the milestone goes active); `in_progress` promoted by N-1 — current active milestone; `blocked` external hold (legal/compliance — rare); `done` all child tasks reached `status='done'` AND LLM-judged scope shipped (strict); `cancelled` killed by roadmap-planning ritual.

**writers**: roadmap-planning ritual (INSERT new `todo`; status flips on cancel/defer); milestone-decomposition ritual (per-wave; INSERTs one bundle of child tasks at a time under the active milestone); N-1 (`todo → in_progress` promotion; `in_progress → done` when all child tasks closed AND LLM-judged scope shipped).

---

## `tasks`

| col | type | notes |
|---|---|---|
| `id` | `uuid PK` | |
| `title` | `text` | short description; nullable — `id` is the only required field |
| `description` | `text` | free-form prose; two carve-outs per top section. Conventional (non-enforced) prose body sections at v10 INSERT-time: `## What` (one-sentence deliverable) / `## Why` (link to parent milestone's `## Why now` or `## Bet source`) / `## Acceptance` (observable outcomes). P-2 later wraps this body in a YAML head + `---` separator with the formal spec-contract |
| `status` | `text NOT NULL default 'todo'` | CHECK `('todo','in_progress','blocked','done','cancelled','recurring')` |
| `parent_task_id` | `uuid → tasks(id) ON DELETE SET NULL` | self-FK; defines **bundle** structure: seed has `parent_task_id IS NULL`, siblings carry the seed's id. N-2 reads a bundle (seed + siblings) as one wave's unit |
| `wave_id` | `uuid → waves(id) ON DELETE SET NULL` | wave that produced or claimed this task; operational provenance only |
| `milestone_id` | `uuid → milestones(id) ON DELETE SET NULL` | **canonical task → milestone link**; NULL = unassigned queue |
| `created_at`, `updated_at` | `timestamptz` | trigger maintains `updated_at` |

**status semantics**: `todo` initial (may be pre-authored — `milestone_id` set, `wave_id` NULL); `in_progress` claimed by B-0 (`wave_id` set); `blocked` waiting on dep or human; `done` shipped by L-2; `cancelled` dropped; `recurring` MONITOR / poll-style — gets DELETEd on resolution, never marked done.

**MONITOR derived state**: `status='recurring' AND title LIKE 'MONITOR:%'`. Description carries the YAML payload (carve-out 1).

**writers**: milestone-decomposition ritual (per-wave; INSERTs one bundle = 1 seed (`parent_task_id IS NULL`) + 0-N siblings (`parent_task_id = seed.id`) under the active milestone, `milestone_id` set, `wave_id` NULL); P-0 (UPDATE `milestone_id` when resolving an unassigned task to active milestone); P-1 (RESCOPE-AUTO-SPLIT: re-parent surplus siblings to NULL; RESCOPE-AUTO-MERGE: re-invokes decomposition with `expand-current-bundle` mode); P-2 (UPDATE primary task `description` to embed spec-contract YAML head); V-2 + D-3 (INSERT follow-up task rows — `milestone_id` set when overlap with active milestone, else NULL; `wave_id` = current wave; `parent_task_id` NULL); B-0 (claim — `status='in_progress'`, `wave_id` = new wave); L-2 (batch `status='done'` for `claimed_task_ids`); monitor templates (`recurring` INSERT with YAML payload).

---

## `waves`

One row per brain wave loop (P → [D] → B → C → T → V → L → N cycle). Brain owns it; Studio reads but never writes. Session-decoupled (no `session_id` column — operator-facing surface is sessions, brain-facing surface is waves, and they're independent).

| col | type | notes |
|---|---|---|
| `id` | `uuid PK default gen_random_uuid()` | brain captures via `INSERT ... RETURNING` |
| `wave_number` | `int NOT NULL UNIQUE` | auto-assigned by `set_wave_number()` BEFORE-INSERT trigger (= `MAX + 1`, global per project). Brain has no INSERT/UPDATE grant on this column. FS anchor — `process/waves/wave-<wave_number>/` |
| `milestone_id` | `uuid → milestones(id) ON DELETE SET NULL` | NULL = unassigned wave; backfilled by P-0 Action 2 when active milestone resolves |
| `status` | `wave_status NOT NULL default 'running'` | pgEnum `('running','ok','failed','aborted')`. Brain has no INSERT grant — default fires |
| `started_at` | `timestamptz NOT NULL default now()` | Brain has no INSERT grant — default fires |
| `ended_at` | `timestamptz` | auto-set by `set_wave_ended_at()` BEFORE-UPDATE trigger when status flips from `running` to terminal |

**no `updated_at`** — lifecycle markers are explicit. `description` column does not exist on `waves`.

**status semantics**: `running` INSERT default; `ok` clean N-3 close (default for every N-3 fire, including pause-loop emissions — the current wave still completed); `failed` and `aborted` reserved for future error paths — no stage writes them today, orphan `running` rows surface as visible artefacts for manual reconciliation.

**current-wave anchor**: `WHERE status = 'running' ORDER BY wave_number DESC LIMIT 1`. Brain's "one wave at a time" contract is what guarantees there's a single legitimate running row; `ORDER BY wave_number DESC LIMIT 1` is the tiebreaker if orphans linger (a crashed wave left `running`) — the newest row wins, since the `wave_number` trigger only ever assigns MAX+1, so the current wave's number always exceeds any orphan's. No FS sidecar carries the running wave's id between stages; every cross-stage reference re-queries via this anchor.

**NULL-fallback semantics.** When the anchor is used as a subquery (`wave_id = (SELECT id FROM waves WHERE status='running' ORDER BY wave_number DESC LIMIT 1)` in B-0 Action 1, D-3 Action 9, V-2 Action 4, plus P-0 Action 2's `WHERE id = (...)`), a NULL return (no `running` row) silently propagates: B-0 sets `tasks.wave_id = NULL`, D-3 / V-2 insert with `wave_id = NULL`, P-0 Action 2 UPDATE matches 0 rows. Per the `tasks` schema `wave_id` is nullable (`ON DELETE SET NULL`), so NULL is a valid value — outcome is silent provenance loss, not data corruption. The single-wave contract makes this unreachable under normal operation (P-0 0a opens the row before any of these stages can fire). N-3 Action 5a is the one site that explicitly detects 0-row via empty `RETURNING` and logs it, since it's the lifecycle-closing UPDATE where the gap would matter most.

**Privileges (`claudomat_brain` role)**:
- `SELECT` on all columns
- `INSERT (milestone_id)` — only this column
- `UPDATE (status, milestone_id)` — only these two

Attempting INSERT or UPDATE on any other column returns `permission denied for column <name>`.

**writers**: brain only.
- P-0 Action 0a: `INSERT INTO waves (milestone_id) VALUES (NULL) RETURNING id, wave_number, started_at` — opens the wave; trigger assigns `wave_number`.
- P-0 Action 2: `UPDATE waves SET milestone_id = $1 WHERE id = (SELECT id FROM waves WHERE status='running' ORDER BY wave_number DESC LIMIT 1)` — backfills milestone once roadmap alignment resolves; no-op if milestone stays NULL.
- N-3 Action 5a: `UPDATE waves SET status='ok' WHERE id = (SELECT id FROM waves WHERE status='running' ORDER BY wave_number DESC LIMIT 1)` — closes the wave; trigger sets `ended_at`.

---

## Relations

```
founder_bets ── milestones ─┬── waves ── tasks (wave_id, operational provenance)
                            └── tasks (milestone_id, canonical link)
                                tasks (parent_task_id, recursive — sibling/split)
```

All FKs are NULLABLE + `ON DELETE SET NULL`. Entities stand alone — a task can exist with no wave, a wave with no milestone, a task with no milestone (the unassigned queue). Deletions orphan rather than cascade. Brain MUST treat orphans (`tasks.milestone_id IS NULL` for `unassigned`, `tasks.wave_id IS NULL` for pre-authored or queued, etc.) as **valid states**, not loss conditions.
