# B-6 — Review

> **Block:** B (Build), 3rd of 8 in wave loop: `P → [D] → ` **`B`** ` → C → T → V → L → N`.
> **Stages:** B-0 → B-1 → B-2 → B-3 → B-4 → B-5 → **B-6 (gate)**. Advance on stage exit: Block exit per dispatcher.
> **Pattern:** gate-only. head-builder spawned HERE for verdict; reference card on demand at `~/.claude/agents/head-builder.md`.
> **Dispatcher** (skip rules, parallelization, gate semantics, exit handoff): `claudomat-brain/blocks/build/build.md`.

## Purpose

Block-exit gate for Build. Three phases:

1. **Phase 1.** Spawn a fresh head-builder sub-agent that issues an independent verdict on the B-block deliverables per the gate-verdict schema below.
2. **Phase 2.** Only on Phase 1 = `APPROVED`: production-bug check on the diff via `/review` skill. Catches contract mismatches, null access, missing error handling, and other production-bug patterns lint and typecheck miss.
3. **Same-branch fix-up loop** for `/review` critical/high findings.

REWORK from either phase loops back to the relevant B-stages.

## Prerequisites

- B-5 exited (lint, typecheck, unit, build, smoke all green).
- `process/waves/wave-<N>/blocks/B/review-artifacts.md` updated through B-5.
- READ `claudomat-brain/rules/skill-use.md` if it exists.

---

## Actions

### Action 0 — Spawn fresh head-builder for gate review (Phase 1)

Invoke `head-builder` via the Agent tool. Pass:

- `process/waves/wave-<N>/blocks/B/review-artifacts.md` (the manifest)
- All deliverable files the manifest points at (B-0 through B-5)
- This stage file (carries the verdict schema)

Direct the sub-agent to write the verdict to `process/waves/wave-<N>/blocks/B/gate-verdict.md` following the schema below.

### Gate-verdict schema (Phase 1)

```markdown
# Wave <N> — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId <id>)
**Reviewed against:** process/waves/wave-<N>/blocks/B/review-artifacts.md
**Attempt:** <N>  (1 = first gate, 2+ = post-rework)

## Verdict
APPROVED | REWORK | ESCALATE

## Rationale
<one paragraph in plain language; cite where the implementation passes or fails the spec contract>

## Rework instructions  (only if REWORK)

### Stages requiring rework
- <stage-id>: <one-line scope>

### Per stage

#### <stage-id>
- **What's wrong:** <specific failure>
- **Heuristic fired:** <named head-builder heuristic, e.g. H-B-09: contract drift between B-1 and B-3 — frontend types reference fields not in shared schema>
- **What "good" looks like:** <concrete success criteria; reference exact file paths or function signatures>
- **Re-do instructions:** <ordered, executable steps; name the specialist from AGENTS.md, not generic "fix it">

(repeat per affected stage)

### Cascade

B-block cascade rules (apply where the rework stage is the trigger):

| Trigger stage | Stages that must re-run downstream |
|---|---|
| B-0 branch & schema | B-1 (contracts derive from schema), B-2 (services consume schema), B-4 (typecheck), B-5 (full verify) |
| B-1 contracts | B-2 (backend uses contracts), B-3 (frontend uses contracts), B-4, B-5 |
| B-2 backend | B-3 (if frontend integration changed), B-4, B-5 |
| B-3 frontend | B-4 (route registration), B-5 |
| B-4 wiring | B-5 (re-verify) |
| B-5 verify | (terminal — only itself) |

- **Stages that must re-run after the above:** <list, or "none">
- **Stages that stay untouched:** <list>

## Escalation  (only if ESCALATE)
- **Reason:** <e.g. spec contract is unimplementable, structural gap that orchestrator cannot resolve, charter conflict>
- **Routing target:** <founder | BOARD | ceo-agent — per mode flag in process/session/.autonomous-session>
- **What's needed to unblock:** <specific>

## Footer
- verdict_complete: true | false
- rework_attempt_cap_remaining: <3 - N>
```

---

### Action 1 — Branch on Phase 1 verdict

| Verdict | Action |
|---|---|
| `APPROVED` | Proceed to Action 2 (`/review` skill). |
| `REWORK` | Execute the verdict's "Rework instructions". Iron Law still applies: route fixes through specialists per `command-center/AGENTS.md`. On completion, re-enter Action 0 (fresh spawn, attempt N+1). |
| `ESCALATE` | Route per mode flag in `process/session/.autonomous-session`. Pause loop until resolved. |

If `rework_attempt_cap_remaining == 0`, force-escalate.

---

### Action 2 — Invoke `/review` (Phase 2)

Run `/review` on the current branch's diff against `main`. The skill produces a structured report with categories: SQL safety, LLM trust boundary violations, conditional side effects, structural issues, contract mismatches.

Output: `process/waves/wave-<N>/stages/B-6-review-output.md` (the skill's full report).

---

### Action 3 — Triage `/review` findings

For each finding `/review` reports:

| Finding severity | Action |
|---|---|
| Critical (production bug, security, data loss) | Re-enter the originating B-stage to fix before push. |
| High (contract mismatch, null access, missing error handler) | Same — re-enter to fix. |
| Medium (style inconsistency, naming, code organization) | Document in the deliverable as accepted-debt or fix in same-branch if cheap. |
| Low (cosmetic, opinion) | Document as accepted-debt; do not fix. |

After fix-up, re-run **B-4** (always repo-wide — typecheck and route registration cannot be file-scoped) and **B-5** (full suite — lint, typecheck, unit, build, smoke) before returning to Action 5 re-review.

---

### Action 4 — Same-branch fix-up commits

Each fix lands as a separate commit on the wave branch:
- Message: `fix: B-6 review finding <short-slug> for wave-<N>`.
- Each fix is atomic and references the `/review` finding it addresses.

---

### Action 5 — Re-run `/review` if any fixes landed

If Action 3 triggered fixes, re-run `/review` against the updated diff. Repeat until `/review` returns no critical/high findings.

**Iteration cap: 3.** If 3 `/review`→fix cycles don't clear all critical/high findings, escalate per the active mode. Rare — usually means the wave's plan was structurally wrong; the cleaner action is to ESCALATE Phase 1 instead.

If Action 3–5 surfaced enough rework to invalidate the Phase 1 head-builder verdict (e.g., a critical contract-drift finding), spawn a fresh head-builder again at Action 0 with the updated state before declaring B-6 complete.

---

### Action 6 — Commit-discipline check (multi-spec waves only)

Skip entirely for `wave_type: single-spec`.

For `wave_type: multi-spec`:

1. Read `claimed_task_ids` from the spec contract.
2. Walk the wave-branch's commit history (post-B-0 branch creation, pre-B-6 fix-up commits).
3. For each commit:
   - Body cites a single `task_id` from `claimed_task_ids`.
   - File set in the diff overlaps only with files declared in that single spec block's contracts.
4. For each `task_id` in `claimed_task_ids`, verify at least one commit cites it.

| Outcome | Verdict |
|---|---|
| All commits cite exactly one `task_id`; every `task_id` has at least one commit | PASS — declare B-6 complete |
| One or more commits touch files across multiple spec blocks | REWORK — split the violating commits via `git rebase -i`; if contracts changed, re-run Actions 3–5 |
| One or more `task_id`s have no commit citing them | REWORK — re-enter the appropriate B-stage |
| Single commit cites multiple `task_id`s | REWORK — split required |

---

## Deliverable

`process/waves/wave-<N>/stages/B-6-review.md` — records both phases:

```yaml
phase1_head_builder_verdict: APPROVED
phase2_review_invocations: <N>
findings_critical: []                # empty after final pass
findings_high: []                    # empty after final pass
findings_medium_accepted: []
findings_low_accepted: []
fix_up_commits: []
final_verdict: APPROVE                # or ESCALATED
```

Plus block-exit handoff state appended to `process/waves/wave-<N>/blocks/B/review-artifacts.md` "Status" field:

```yaml
build_block_status:    complete
branch:                <branch-name>
stages_run:            [B-0, B-1, ..., B-6]
stages_skipped:        [list with reasons]
review_verdict:        APPROVE
deviations_logged:     [list]
last_commit_sha:       <sha>
ready_for_ci:          true
```

## Exit criteria

- Phase 1 head-builder verdict = APPROVED
- Phase 2 final `/review` pass returns no critical/high findings (or 3-cap escalation resolved)
- Fix-up commits all landed
- `process/waves/wave-<N>/blocks/B/review-artifacts.md` "Status" updated to `gate-passed`
- `process/waves/wave-<N>/checklist.md` B-6 row is checked

## Next

→ `claudomat-brain/DISPATCHER.md` → next block is **C** (CI/CD) — `read claudomat-brain/blocks/ci-cd/ci-cd.md`.
