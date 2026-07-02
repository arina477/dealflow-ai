# Roadmap-Planning Ritual

Strategic ritual. Authors and re-evaluates milestones in the `milestones` table. Produces milestone rows with `status='todo'` and **zero child tasks**. Per-wave decomposition into bundles (seed + 0-N siblings) lives in [`claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md`](milestones/milestone-decomposition-ritual.md) and fires inline at N-1 Action 7 during the milestone's active life; this ritual does NOT INSERT child tasks.

Heavyweight. Typical duration: 60–90 minutes of agent work plus founder checkpoint. Not run per-wave.

---

## Mandatory cross-references

- **Schema, states, edit permissions:** `claudomat-brain/ROADMAP/roadmap-lifecycle.md`.
- **Operational counterpart:** [`claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md`](milestones/milestone-decomposition-ritual.md).
- **Sub-agent spawn discipline:** `claudomat-brain/rules/sub-agent-invocation.md`; agent cards at `~/.claude/agents/<agent>.md`.
- **Competitive intelligence methodology:** `claudomat-brain/management/default-mode.md` § Competitive intelligence — same Playwright-live-browsing mandate as P-0 Frame.
- **Skill use (for `/plan-ceo-review`):** `claudomat-brain/rules/skill-use.md`.
- **Canonical data:** `milestones`, `tasks`, and `founder_bets` tables in Postgres (per [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md)); `command-center/product/product-decisions.md` (append-only decision log, on FS); `command-center/artifacts/competitive-benchmarks/` (refresh evidence, on FS).

---

## Scope

**This ritual does:**

- Re-evaluate every milestone — KEEP / RETHEME / RESCOPE / DEFER / KILL / PROMOTE / DEMOTE.
- INSERT new milestones with `status='todo'` and zero child tasks.
- Order milestones logically by tier (LLM-judged at Step 3 reading milestone prose sections; not a stored column).
- Mark shipped milestones `status='done'` and cancelled ones `status='cancelled'`; their rows stay in the DB (no separate archive table).
- Audit `platform-foundation` consumer relationships (read milestone prose `## Required by` sections).

**This ritual does NOT:**

- INSERT any child tasks — bundles (seed + siblings) are authored per-wave by [`milestone-decomposition-ritual.md`](milestones/milestone-decomposition-ritual.md) when N-1 detects the active milestone needs the next wave's bundle.
- Flip milestone status `todo → in_progress` → N-1 promotion.
- Flip milestone status `in_progress → done` → N-1 detects when all child tasks are terminal AND scope is shipped.
- Resolve Tier 3 product decisions → `claudomat-brain/rules/daily-checkpoint.md`.
- Walk the unassigned queue → P-0 Frame per wave.
- Fix trivial metadata drift → inline corrections allowed at any time.

---

## Trigger reasons

N-1 Survey & triggers fires this ritual with one of:

| Reason | Condition |
|---|---|
| `milestone-stockout` | No `status='todo'` milestone exists at all — N-1 has nothing to promote next. The brain is out of plannable work. |
| `founder-direct` | Session-message invocation by the founder. |
| `degenerate-vote` | ceo-agent invocation under `degenerate` mode. |
| `board-vote` | BOARD invocation under `automatic` mode. |

All reasons drive a full milestone restructure pass — no per-task top-up mode (per-wave decomposition handles that during the active milestone's life).

---

## Tier order

Roadmap-planning orders milestones by these tiers, highest priority first. The order is **LLM-judged at Step 3** by reading each milestone's `## Tier`, `## Class`, `## Horizon`, and `## Required by` prose sections — not derived from a stored column.

```
T1: ## Class: product-feature   AND  mvp-critical scope
T2: ## Class: platform-foundation  AND  ## Required by ≥1 T1 milestone
T3: ## Class: product-feature   AND  nice-to-have scope
T4: ## Class: platform-foundation  AND  ## Required by ≥1 T3 milestone
T5: ## Class: product-polish
T6: ## Class: platform-foundation  AND  no live consumers (surfaced for defer/cancel)
```

Within each tier, sequence by:

1. `## Bet source` priority: `Founder-bet` > `Differentiation` > `Competitive` > `Trend`.
2. `## Required by` chain resolution depth (foundations consumed by sooner milestones place sooner).
3. Milestone number (lower wins).

T6 milestones MUST be surfaced for review at Step 4. Default action: defer or cancel. Auto-promotion forbidden — a foundation gains a tier only when an authored consumer milestone declares it in `## Required by`.

---

## The ritual — 6 steps

### Step 1 — Gather inputs

Three parallel passes plus founder-bet review.

**1a. Competitive sweep (`ui-comprehensive-tester` × 3, parallel, Playwright).**

Spawn one agent per competitor on dedicated Playwright instances:

- `playwright-3` → <competitor-1>
- `playwright-4` → <competitor-2>
- `playwright-5` → <competitor-3>

Scope: every active milestone's feature area, candidate themes from the `founder_bets` table, features referenced in unassigned tasks. Each agent MUST produce direct-observation evidence (screenshots + navigation notes).

Output: refreshed `command-center/artifacts/competitive-benchmarks/<feature>.md` files + updated `command-center/artifacts/competitive-benchmarks/INDEX.md` freshness timestamps.

**1b. Trend-forward scan (`trend-analyst`, single agent).**

Scope: project's sector inferred from `founder_bets` rows + active milestone themes; ~60–90 day window. Surface emerging patterns, regulatory shifts, platform moves, technology changes, category consolidation.

Output: `process/session/rituals/trend-scan-<YYYY-MM-DD>.md`.

**1c. Read live founder bets + (optionally) propose new bets.**

```sql
SELECT id, title, description FROM founder_bets WHERE status='live' ORDER BY created_at;
```

Cite live bets to Step 3 as milestone bet-source. Ritual proceeds with whatever bets currently exist — proposing new bets does not block.

If live bets are empty/thin OR strategic gaps surface that warrant new bets:

- ceo-agent (under `degenerate`) drafts proposed bets and emails founder with subject prefix `⚠ BET PROPOSAL`. Body: draft text, rationale, strategic gap addressed.
- Under `default` / `automatic` / `founder-review`: orchestrator surfaces "consider authoring N bets" to founder via standard founder-ask channel; no autonomous email.
- Proposal does not block ritual. Approved bets feed the next ritual run.

Direct INSERTs to `founder_bets` by agents other than ceo-agent (under `degenerate`) remain forbidden. All agents may SELECT.

**1d. Apply approved bet edits (ceo-agent under `degenerate` only).**

Once per ritual run, BEFORE ritual completion, ceo-agent performs a one-shot inbox sweep filtered by subject prefix `⚠ BET PROPOSAL`. Classify the most recent founder message per `claudomat-brain/management/communication/ceo-communication-rules.md § Bet proposal reply classification`:

- `APPROVE` → if reply contains inline edits, interpret and apply with edits; INSERT proposed text verbatim otherwise. Close thread; record the email thread reference in `process/session/updates/ceo-digest-<YYYY-MM-DD>.md`.
- `REJECT` → log to `process/session/updates/ceo-deferrals.md`. Close thread.
- `DISCUSSION` → ceo-agent replies in-thread with rationale or refined draft. Thread stays open. 24h cap timer resets on this message.
- 24h since ceo-agent's most recent message with no founder reply → original thread auto-classifies `DEFER` → log to `process/session/updates/ceo-deferrals.md`, close thread, spawn new `⚠ BET PROPOSAL` thread with refreshed content.

Retirement proposals follow the same flow with prefix `RETIRE: <bet slug>`.

This sweep runs only at Step 1d. Edits applied here are visible to the NEXT ritual run; the current ritual already evaluated against pre-1d bets at Step 3.

---

### Step 2 — Integrity check

Per `claudomat-brain/ROADMAP/roadmap-lifecycle.md` § Reference format rules. Bi-directional validation.

**milestones → tasks:** for every milestone row, aggregate child-task counts by status:

```sql
SELECT status, count(*) FROM tasks WHERE milestone_id = $1 GROUP BY status;
```

Flag:

- Milestones with `status='in_progress'` but zero open child tasks AND zero done child tasks (active milestone never received a bundle — likely a stuck N-1 trigger; investigate).
- Milestones with `status='done'` but still-open child tasks (closure invariant violation — escalate).

`status='todo'` with zero child tasks is the NORMAL state (decomposition is per-wave, not at planning time); not a defect.

**tasks → milestones:** FK guarantees referential integrity, but report `tasks.milestone_id` pointing at a `cancelled` milestone (tasks should be re-assigned or cancelled in the same gesture).

**Milestone renames** are trivial: a single `UPDATE milestones SET title = $1, description = $2 WHERE id = $3`. No task touches required — `tasks.milestone_id` is a UUID FK that survives renames atomically.

Output: `process/session/rituals/roadmap-integrity-<YYYY-MM-DD>.md`. Fix mechanical drift inline via DB UPDATEs. Surface semantic drift to Step 4.

---

### Step 3 — Strategic challenge (`/plan-ceo-review`)

Invoke `/plan-ceo-review` on the milestones snapshot (via `SELECT * FROM milestones ORDER BY created_at` + per-milestone child-task summaries) with the integrity report and fresh competitive/trend evidence in context. The skill challenges priorities, cuts scope, ranks by impact.

LLM judges tier ordering by reading each milestone's prose sections (`## Tier`, `## Class`, `## Horizon`, `## Required by`, `## Bet source`).

**Per-milestone disposition options:**

- `KEEP` — milestone stays as-is.
- `RETHEME` — same scope, different framing.
- `RESCOPE` — expand or contract.
- `DEFER` — keep `status='todo'`; add `## Deferred reason` section to description.
- `KILL` — cancel; bet source no longer holds.
- `PROMOTE` — move `## Horizon` forward (H2 → H1) if trust + capacity allow.
- `DEMOTE` — move `## Horizon` back (H1 → H2) if evidence weakened.

**New milestone proposals** from: (a) fresh founder bets, (b) competitive gaps with differentiation value, (c) trend-driven opportunities. Each carries proposed `## Class`, `## Tier`, `## Required by` (when platform-foundation), `## Bet source`, scope sketch, primary risk. Child-task seeds are NOT authored here — the decomposition ritual handles that once a milestone is approved.

Output: `process/session/rituals/roadmap-planning-<YYYY-MM-DD>-ceo-review.md`. Never auto-apply CEO recommendations — they're proposals for Step 4.

---

### Step 4 — Checkpoint (mode-aware)

**Under `founder-review` / `default` / `automatic`:**

Orchestrator presents CEO-review recommendations to the founder via `AskUserQuestion`, batched into one session. Include:

1. Per-milestone disposition with one-line CEO reasoning.
2. New milestone proposals with horizon, bet-source, scope sketch, primary risk, proposed tier.
3. Semantic drift from Step 2 — `status='in_progress'` milestones with zero open child tasks and zero done child tasks (active milestone never received a bundle — stuck N-1 trigger to investigate).
4. Vision / North Star changes — if founder approved any `founder_bets` INSERTs since the last ritual, confirm North Star matches.
5. T6 platform-foundation milestones with no live consumers — defer or cancel.

Founder answers. Any override replaces the CEO recommendation.

**Under `degenerate`:**

Spawn `ceo-agent` via `Agent(subagent_type=ceo-agent)` with the full packet (Step 2 integrity report + Step 3 CEO-review output). ceo-agent reads `command-center/management/ceo-blocklist.md` § 5 (pivot / roadmap-planning / product-kill authority). Default unlimited; explicit restrictions bind.

ceo-agent resolves all five bullets in one decision pass, appends entry to `process/session/updates/ceo-digest-<YYYY-MM-DD>.md` with per-milestone disposition + reasoning, returns approved state to orchestrator. Founder reviews retroactively via daily digest; overrides applied via rollback path (session halt + manual revert).

**Anti-pattern:** do NOT spawn implementers or modify any file before this checkpoint resolves (regardless of mode).

---

### Step 5 — Write outputs (atomic)

Once Step 4 approves, orchestrator executes all writes in one pass.

**5a. Apply milestone-level DB changes:**

- KEEP — no-op.
- RETHEME — `UPDATE milestones SET title = $1, description = $2 WHERE id = $3`. No task touches needed (FK is by `id`).
- RESCOPE — `UPDATE milestones SET description = $1 WHERE id = $2` (prose sections rewritten).
- DEFER — `UPDATE milestones SET description = description || E'\n\n## Deferred reason\n<reason>' WHERE id = $1`. `status` stays `'todo'`.
- KILL — `UPDATE milestones SET status = 'cancelled', description = description || E'\n\n## Cancelled reason\n<reason>' WHERE id = $1`.
- PROMOTE / DEMOTE — `UPDATE milestones SET description = <rewritten with new ## Horizon> WHERE id = $1`.
- Add new approved milestones via `INSERT INTO milestones (title, description, status, bet_id) VALUES ($1, $2, 'todo', $3) RETURNING id`. The new row is `status='todo'` with zero child tasks; decomposition ritual authors bundles per-wave once N-1 promotes this milestone to `in_progress`.
- Finalize any `_TBD_` success metrics founder resolved (UPDATE description prose).

**5b. Mark shipped/cancelled:**

`status='done'` and `status='cancelled'` rows stay in the `milestones` table indefinitely — no archive file. The rows ARE the historical record.

**5c. Append to `command-center/product/product-decisions.md`:**

One entry per material decision: new milestone, kill, promotion, North Star change, T6 disposition. Append-only log format. Each milestone state transition produced by this ritual MUST log here per `roadmap-lifecycle.md` § State recording.

**5d. Competitive benchmarks freshness:**

`command-center/artifacts/competitive-benchmarks/INDEX.md` reflects Step 1a updates.

**5e. Platform-foundation consumer audit:**

For every milestone with `## Class: platform-foundation` (LLM judgment from prose):

- Validate `## Required by` list. Each entry MUST point to a `todo` / `in_progress` `product-feature` milestone (not `done`, `cancelled`, or deferred).
- A foundation milestone with zero live consumers (T6) is surfaced at Step 4 with two options:
  1. **Defer** — add `## Deferred reason: no-live-consumers-yet` section.
  2. **Cancel** if foundation no longer makes sense.
- Ritual surfaces only; never auto-defers or auto-cancels.

---

### Step 6 — Commit

DB writes happen in transactions during Step 5 (atomic per milestone disposition). Step 6 commits only the FS artifacts:

```
docs(roadmap): planning ritual <YYYY-MM-DD> — <one-line summary>

- <disposition summary: N kept, N re-themed, N deferred, N cancelled, N new>

See: process/session/rituals/roadmap-planning-<YYYY-MM-DD>-ceo-review.md
```

Files staged in the commit:
- `command-center/product/product-decisions.md` (Step 5c appends).
- `command-center/artifacts/competitive-benchmarks/` (Step 1a / 5d updates).
- `process/session/rituals/*` (Step 2 / 3 outputs).

Do NOT split the DB transactions across human commits — DB writes commit themselves. The git commit captures the audit trail in `product-decisions.md` alongside the FS evidence.

---

## Deliverables

- `milestones` and `founder_bets` table rows — updated per Step 5a (DB).
- `command-center/product/product-decisions.md` — planning decisions appended (FS).
- `command-center/artifacts/competitive-benchmarks/` — refreshed benchmarks + INDEX (FS).
- `process/session/rituals/trend-scan-<YYYY-MM-DD>.md` — trend-analyst output (FS).
- `process/session/rituals/roadmap-integrity-<YYYY-MM-DD>.md` — Step 2 drift report (FS).
- `process/session/rituals/roadmap-planning-<YYYY-MM-DD>-ceo-review.md` — Step 3 CEO-review output (FS).
- One git commit — per Step 6 (FS artifacts only; DB writes commit themselves).

---

## Anti-patterns

| # | Never | Why |
|---|---|---|
| 1 | Skip the competitive sweep. | Stale evidence drifts milestones toward vanity. If nothing surfaced last week, reference existing benchmarks at Step 1a — but still validate staleness. |
| 2 | Skip the integrity check. | Silent drift compounds across rituals until the milestones + tasks tables become untrustworthy. |
| 3 | Auto-apply CEO recommendations. | Step 4 checkpoint is non-negotiable. CEO review produces proposals, not commitments. |
| 4 | INSERT child tasks under a milestone here. | All child tasks (bundles + V-2/D-3 follow-ups) come from elsewhere. This ritual produces milestones only — empty `status='todo'` rows. Decomposition fires per-wave during the milestone's active life. |
| 5 | Inline material scope changes into an active milestone mid-ritual. | Material changes go through Step 3 + Step 4. No bypass. |
| 6 | Let new milestones enter with `_TBD_` success metrics. | Metrics MUST be finalized before decomposition runs against the milestone — the decomposition ritual refuses milestones with `_TBD_` `## Success metric` / `## Scope`. Planning is the moment to lock them. |
| 7 | Promote a competitive-analyst proposal straight to `status='in_progress'`. | New milestones enter `status='todo'`. They pass through decomposition + N-1 promotion before becoming active. |
| 8 | Auto-promote a T6 platform-foundation. | Foundations gain tier only when an authored consumer declares them in `## Required by`. |
| 9 | Skip § Tier order at Step 5a or 5c. | Tier order is the single mechanism that pulls platform work as a dependency of product demand. |
