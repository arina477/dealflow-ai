# /process/ — Canonical Path Mapping

Process artifacts live under `process/` in the consumer project. Every block dispatcher, stage file, head-X agent card, and the `claudomat init` scaffold reference this mapping.

The brain (`claudomat-brain/`) is **process-defining**. `process/` is **process-running**. Nothing process-running lives in `claudomat-brain/`; nothing process-defining lives in `process/`.

---

## Top-level structure

```
process/
  session/            ← cross-wave runtime state
  waves/              ← active wave state + _archive/
```

`session/` and `waves/` are the only top-level subdirectories. Do not invent siblings.

---

## Path grammar

Eleven rules. Every path under `process/` matches one. Named files that don't fit the grammar are listed in § Named files below.

| # | Rule | Owner / lifecycle |
|---|---|---|
| 1 | `process/session/.<flag>` | Runtime flags, gitignored, session-scoped (mode flag, capability sheet, loop pause marker, last-wave anchor). |
| 2 | `process/session/<state>.yaml` | Cross-wave runtime state, committed (status-check). |
| 3 | `process/session/updates/<file>` | Founder-facing audit + pending queues. All committed. Per-day digests use `<digest>-<YYYY-MM-DD>.md`. |
| 4 | `process/session/rituals/<ritual>-<YYYY-MM-DD>[-<phase>].md` | Per-fire ritual outputs (roadmap-planning, roadmap-integrity, trend-scan). |
| 5 | `process/session/onboarding/v<N>-<descriptor>.md` | Onboarding stage deliverables (one-time at install). |
| 6 | `process/session/monitors/monitor-<task-id>.log` | Async monitor logs. |
| 7 | `process/waves/wave-<N>/checklist.md` | Stage completion ledger (26 stages with D, 23 without); seeded at P-0 from DISPATCHER template. |
| 8 | `process/waves/wave-<N>/blocks/<X>/{review-artifacts,gate-verdict}.md` | Block-level aggregations. T-block also has `findings-aggregate.md`. |
| 9 | `process/waves/wave-<N>/stages/<X-N>-<descriptor>.md` | Single-file stage deliverable. Default. |
| 10 | `process/waves/wave-<N>/stages/<X-N>-<descriptor>/<feature>-<artifact>.<ext>` | Multi-file stage deliverable (per-feature, per-route, per-component). |
| 11 | `process/waves/wave-<N>/escalations/<class>-<slug>.md` | Wave-scoped escalations (`board-`, `ceo-review-<stage-id>`, `founder-deferral-<stage-id>`). Mirror into per-day session digests. |

**Block code `<X>`:** `P` / `D` / `B` / `C` / `T` / `V` / `L` / `N`.
**Stage id `<X-N>`:** block code + dash + sequence (e.g., `P-0`, `B-6`, `T-9`).
**`.dotfile` rule:** dot-prefixed = gitignored (runtime, regenerable). Non-dot = committed.

---

## Named files (exceptions or anchors)

### Session — runtime flags + state

| Path | Owner | Purpose |
|---|---|---|
| `process/session/.autonomous-session` | `claudomat-brain/management/mode-switching.md` | Mode flag (`founder-review` / `default` / `automatic` / `degenerate`). |
| `process/session/.capability-sheet.md` | `claudomat capabilities` | Discovery snapshot + drift report. Refreshed at session start. |
| `process/session/.last-wave-completed.yaml` | onboarding v13 / N-3 handoff | DISPATCHER step 0 anchor. `loop_state: ready \| install-pending \| paused`. |
| `process/session/.loop-paused.yaml` | N-3 (when pausing) | Pause marker. Replaces next-wave checklist. On a founder answer the worker pre-clears this (removes it + flips `STATUS: RUNNING`) before dispatching the resume turn — see `.loop-resume.yaml` below for the worker-clears-pause contract. |
| `process/session/.loop-resume.yaml` | Studio Brain Worker (when the founder answers a paused decision) | Resume mailbox — the structured founder choice that resolves a `.loop-paused.yaml` pause. **Worker is the SOLE writer; brain is the SOLE reader + deleter** (the brain never writes it). Dot-prefixed → gitignored, never synced. Schema: `schema_version: 1`, `resolved_at: <ISO8601>`, `resolved_by: founder`, `decision_id: <claudeSessionId>:paused`, `choice: {kind: milestone\|directive\|drain-queue, milestone_id: <uuid>\|null, label: <string>\|null, text: <string>\|null}`. Consumed at DISPATCHER step 0; resolved per the active mode file's § Resume protocol, which deletes BOTH this file and `.loop-paused.yaml`. **Worker-clears-pause contract:** on a founder answer the worker performs the documented manual resume on the founder's behalf — (1) writes this file (sole writer), (2) removes `.loop-paused.yaml`, (3) sets `status-check.yaml` `STATUS: RUNNING`, (4) dispatches the resume turn. So by the time the brain consumes this mailbox, `.loop-paused.yaml` may already be gone and `STATUS` may already be `RUNNING`; the brain's § Resume protocol consume MUST tolerate that pre-cleared state (delete `.loop-paused.yaml` best-effort / no-op if absent; re-writing `STATUS: RUNNING` is a no-op) and key off the presence of `.loop-resume.yaml`, never off `.loop-paused.yaml` still existing. |
| `process/session/.exit-warnings.log` | orchestrator (mode exit only) | Mode-exit MONITOR cleanup failure log. Written when the DB is unreachable during `MONITOR — bulk cancel` and rows can't be deleted at § Exit conditions. Founder cleans up manually on next mode entry. Read by founder via manual inspection. |
| `process/session/status-check.yaml` | automatic-mode / degenerate-mode | Tick state for `/loop` (`RUNNING` / `IDLE` / `BLOCKED` / `DONE`). |

### Session — updates (audit + pending queues, committed)

| Path | Owner |
|---|---|
| `process/session/updates/ceo-digest-<YYYY-MM-DD>.md` | ceo-agent (degenerate). One file per day. |
| `process/session/updates/board-digest-<YYYY-MM-DD>.md` | BOARD (automatic). One file per day. |
| `process/session/updates/ceo-charter-proposals.md` | ceo-agent. Append-only charter-amendment proposals. |
| `process/session/updates/ceo-deferrals.md` | ceo-agent. Decisions deferred past charter restriction. |
| `process/session/updates/pending.md` | mode router / N-2. General founder-action queue. |
| `process/session/updates/product-decisions-pending.md` | P-0. Tier-3 product decisions awaiting resolution. |
| `process/session/updates/morning-backlog.md` | daily-checkpoint ritual. Once-per-day batch. |
| `process/session/updates/.last-daily-checkpoint` | daily-checkpoint ritual. Timestamp marker. |

### Wave — onboarding completion marker

| Path | Owner |
|---|---|
| `process/session/onboarding/onboarding-complete-<YYYY-MM-DD>.md` | onboarding v13. Marks loop open. |

---

## /process/waves/_archive/

**Single-move archive at N-3.** L-2 does NOT archive; it writes its observations + deliverable in place.

```bash
# At N-3 Action 4, after all wave artifacts (including N-3 deliverable) are written:
git mv process/waves/wave-<N>/ process/waves/_archive/wave-<N>/
git commit -m "chore: N-3 archive wave-<N>"
```

The per-wave nested directory makes the entire wave a single subtree — one move suffices.

---

## What `claudomat init` creates

```
process/
  session/      # empty; populated by mode entry + capability scan
  waves/        # empty; wave-1/ created when first wave begins
```

`.gitignore` is appended with: `process/session/.autonomous-session`, `process/session/.capability-sheet.md`, `process/session/.loop-paused.yaml`, `process/session/.loop-resume.yaml`, `process/session/.last-wave-completed.yaml`, `process/session/.exit-warnings.log`.

---

## Block-dispatcher contract for review-artifacts and gate-verdict

Each block dispatcher's first stage and gate stage carry **inline templates** for the artifact they own. No fragment files. Schemas are tuned per-block in the stage file directly.

| Block | First-stage (review-artifacts inline) | Gate-stage (gate-verdict inline) |
|---|---|---|
| P | `claudomat-brain/blocks/product/stages/P-0-frame.md` | `claudomat-brain/blocks/product/stages/P-4-gate.md` |
| D | `claudomat-brain/blocks/design/stages/D-1-brief.md` | `claudomat-brain/blocks/design/stages/D-3-review-and-adopt.md` |
| B | `claudomat-brain/blocks/build/stages/B-0-branch-and-schema.md` | `claudomat-brain/blocks/build/stages/B-6-review.md` |
| C | `claudomat-brain/blocks/ci-cd/stages/C-1-pr-ci-merge.md` | `claudomat-brain/blocks/ci-cd/stages/C-2-deploy-and-verify.md` |
| T | `claudomat-brain/blocks/test/stages/T-1-static.md` | `claudomat-brain/blocks/test/stages/T-9-journey.md` |
| V | `claudomat-brain/blocks/verify/stages/V-1-reviews.md` | `claudomat-brain/blocks/verify/stages/V-3-fast-fix.md` |
| L | `claudomat-brain/blocks/learn/stages/L-1-docs.md` | `claudomat-brain/blocks/learn/stages/L-2-distill.md` |
| N | `claudomat-brain/blocks/next/stages/N-1-survey-and-triggers.md` | `claudomat-brain/blocks/next/stages/N-3-handoff.md` |

The first-stage file embeds the review-artifacts manifest schema and seeds `process/waves/wave-<N>/blocks/<X>/review-artifacts.md`.

The gate-stage file embeds the gate-verdict schema + per-block cascade rules. The orchestrator:

1. Spawns a fresh head-X sub-agent (Action 0) passing `process/waves/wave-<N>/blocks/<X>/review-artifacts.md` + the deliverable files it points at + this stage file.
2. The sub-agent writes verdict to `process/waves/wave-<N>/blocks/<X>/gate-verdict.md`.
3. Branches on verdict: APPROVED / REWORK (neutral-mode rework) / ESCALATE (per mode flag).
4. Caps retries at 3; force-escalate beyond.

---

## Brain ⇄ project boundary

Brain-owned, under `claudomat-brain/`, replaced wholesale by `claudomat sync`: DISPATCHER.md, blocks/, management/, monitors/, ROADMAP/, setup-tools/, agent-creator templates, process-paths.md.

Project-owned, under `process/`, never touched by `claudomat sync`. Generated and modified by the orchestrator and sub-agents during wave execution.

If state is *running process*, it goes in `process/`. If *process definition*, it goes in `claudomat-brain/`. No mixing.
