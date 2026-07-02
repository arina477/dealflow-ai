# D-3 — Review & adopt

> **Block:** D (Design), 2nd of 8 in wave loop: `P → ` **`[D]`** ` → B → C → T → V → L → N`. Conditional on `design_gap_flag: true` from P-1.
> **Stages:** D-1 → D-2 → **D-3 (gate)**. Advance on stage exit: Block exit per dispatcher.
> **Pattern:** gate-only. head-designer spawned HERE for verdict; reference card on demand at `~/.claude/agents/head-designer.md`.
> **Dispatcher** (skip rules, gate semantics, exit handoff): `claudomat-brain/blocks/design/design.md`.

## Purpose

Block-exit gate for Design + canonicalization. Three phases:

1. **Phase 1.** Dual-reviewer pass: `/plan-design-review` + `/ui-ux-pro-max` in parallel against every staging design. Both must APPROVE; otherwise route back to D-2 refine within iteration cap.
2. **Phase 2.** Spawn fresh head-designer sub-agent for independent verdict on D-block deliverables per the gate-verdict schema.
3. **Phase 3.** On Phase 2 = `APPROVED`: canonicalize approved staging designs into `design/`, update user-journey map, conditionally extend `design/DESIGN-SYSTEM.md`.

D-3 is the only stage authorized to mutate `design/*.html` (outside `staging/`) and `DESIGN-SYSTEM.md`.

## Prerequisites

- D-2 exited with iteration logs APPROVED for every gap.
- `process/waves/wave-<N>/blocks/D/review-artifacts.md` updated through D-2.
- READ `design/review-gate.md` (full reviewer roster, output format, anti-patterns).
- READ `command-center/artifacts/user-journey-map.md` if any gap adds new route or screen.
- READ `design/DESIGN-SYSTEM.md` if any approved design appears to introduce new tokens.
- VERIFY `/plan-design-review` and `/ui-ux-pro-max` skills available per `claudomat-brain/setup-tools/install.md` (slash-skills, not sub-agents — AGENTS.md check does not apply). Either missing → install per `install.md`; reviewer substitution forbidden mid-wave.

---

## Actions

### Action 0 — Spawn dual reviewers in parallel (Phase 1)

Per gap, spawn both in same orchestrator message so they run concurrently:

- **`/plan-design-review`** — design critique with per-dimension 0–10 scoring + "what would make each a 10".
  Inputs: staging HTML path, brief path, `design/DESIGN-SYSTEM.md`.
  Output: `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-plan-design-review.md`.

- **`/ui-ux-pro-max`** — requirement + UX best-practice + token audit.
  Inputs: staging HTML path, brief path, `design/DESIGN-SYSTEM.md`, Phosphor icon reference.
  Output: `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-ui-ux-pro-max.md`.

Both reviewers MUST run with no shared context. Each Agent call's prompt passes ONLY the brief path, staging path, `design/DESIGN-SYSTEM.md` path, and the reviewer's own instructions. Prompts MUST NOT reference the other reviewer or any prior reviewer history.

### Action 1 — Verdict format check

Each reviewer output must contain exactly one verdict from: **APPROVE** / **REVISE** / **REJECT**, plus enumerated concrete concerns cited against brief §X or `DESIGN-SYSTEM.md` §Y. Vibes-only feedback or missing verdict → re-run that reviewer with stricter prompt.

### Action 2 — Reconcile per the matrix

Apply block dispatcher's reconciliation matrix:

| Reviewer A | Reviewer B | Action |
|---|---|---|
| APPROVE | APPROVE | → Action 4 (Phase 2 head-designer spawn) |
| APPROVE | REVISE | Aggregate B's concerns → D-2 refine |
| REVISE | APPROVE | Aggregate A's concerns → D-2 refine |
| REVISE | REVISE | Aggregate both → D-2 refine |
| APPROVE | REJECT | Reject wins → D-2 refine or cap-escalate |
| REJECT | APPROVE | Reject wins → D-2 refine or cap-escalate |
| REJECT | REJECT | Aggregate both → D-2 major refine OR cap-escalate |

Orchestrator does NOT arbitrate. Reviewers independent; matrix deterministic.

Write `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-reconciliation.md` recording matrix outcome and next destination (Phase 2 / D-2 / escalation).

### Action 3 — Iteration cap check (Phase 1)

Gap heading back to D-2 would exceed 3 D-2 → D-3 cycles → do NOT loop. Escalate per block dispatcher's mode-aware 3-cap matrix.

---

### Action 4 — Spawn fresh head-designer for gate review (Phase 2)

Only fires when every gap's reviewer pair returned APPROVE / APPROVE in Action 2 (or was deferred via 3-cap to `bug-design`).

Invoke `head-designer` via Agent tool. Pass:

- `process/waves/wave-<N>/blocks/D/review-artifacts.md` (the manifest)
- All deliverable files the manifest points at (D-1 briefs, D-2 variants + iterations, Action 0–2 reviewer outputs + reconciliations)
- This stage file (carries verdict schema)

Direct sub-agent to write verdict to `process/waves/wave-<N>/blocks/D/gate-verdict.md` per schema below.

### Gate-verdict schema (Phase 2)

```markdown
# Wave <N> — D-3 Verdict

**Reviewer:** head-designer (fresh spawn, agentId <id>)
**Reviewed against:** process/waves/wave-<N>/blocks/D/review-artifacts.md
**Attempt:** <N>  (1 = first gate, 2+ = post-rework)

## Verdict
APPROVED | REWORK | ESCALATE

## Rationale
<one paragraph in plain language; explicitly cite which gaps clear the bar and which do not>

## Rework instructions  (only if REWORK)

### Stages requiring rework (per gap)
- <feature> @ <stage-id>: <one-line scope>

### Per stage

#### <stage-id> for <feature>
- **What's wrong:** <specific failure>
- **Heuristic fired:** <named head-designer heuristic, e.g. H-D-07: invented hex outside DESIGN-SYSTEM.md tokens>
- **What "good" looks like:** <concrete success criteria, citing brief §X or DESIGN-SYSTEM.md §Y>
- **Re-do instructions:** <ordered, executable steps a non-design-expert can follow — exact /aidesigner refine prompts when relevant>

(repeat per affected stage / feature)

### Cascade

D-block cascade rules (apply where the rework stage is the trigger):

| Trigger stage | Stages that must re-run downstream (per affected gap) |
|---|---|
| D-1 brief | D-2 (regenerate variants from updated brief), D-3 |
| D-2 variants / iterate | D-3 (re-review the refined staging) |
| D-3 dual-reviewer pass | (terminal — only itself, but matrix outcome may force D-2 refine within iteration cap) |

- **Stages that must re-run after the above:** <list per gap, or "none">
- **Stages that stay untouched:** <list>

## Escalation  (only if ESCALATE)
- **Reason:** <e.g. iteration cap hit on a gap that fresh head-designer judges still mis-approached, charter conflict, structural gap>
- **Routing target:** <founder | BOARD | ceo-agent — per mode flag in process/session/.autonomous-session>
- **What's needed to unblock:** <specific>

## Footer
- verdict_complete: true | false
- rework_attempt_cap_remaining: <3 - N>
```

---

### Action 5 — Branch on Phase 2 verdict

Read `process/waves/wave-<N>/blocks/D/gate-verdict.md`. Then:

| Verdict | Action |
|---|---|
| `APPROVED` | Proceed to Action 6 (canonicalization). |
| `REWORK` | Execute verdict's "Rework instructions". Verdict carries the expertise. On completion, re-enter the indicated stage (D-1 / D-2) or re-run Phase 1 reviewers. |
| `ESCALATE` | Route per mode flag in `process/session/.autonomous-session`: `founder-review` / `default` → founder; `automatic` → BOARD (`process/session/updates/board-digest-<DATE>.md`); `degenerate` → ceo-agent (`process/session/updates/ceo-digest-<DATE>.md`). Pause loop until resolved. |

`rework_attempt_cap_remaining == 0` after REWORK → force-escalate per mode flag instead of looping.

---

### Action 6 — Canonicalize each approved gap (Phase 3)

Per gap exiting Phase 1 with both reviewers APPROVE AND Phase 2 verdict APPROVED:

1. `git mv design/staging/<feature>.html design/<feature>.html`
2. Annotate `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-adopt.md` with canonical path and both reviewer verdicts.
3. Commit: `docs(design): D-3 adopt — <feature> for wave-<N>`

---

### Action 7 — Update user-journey-map.md (conditional)

Canonicalized design introduces new route, screen, or user flow not in `command-center/artifacts/user-journey-map.md`:

1. Add entry per file's existing schema.
2. Commit: `docs(journey): D-3 — register <feature> for wave-<N>`

No new routes/screens → skip and record skip in deliverable.

---

### Action 8 — DESIGN-SYSTEM.md token additions (conditional)

D-3 is the only mid-wave entry point for new design tokens. Extend `design/DESIGN-SYSTEM.md` only when approved design introduces a token absent from the file (new shadow class, new clip-path variant, new color role) AND the token is reusable beyond this feature.

**Procedure:**

1. Identify candidate tokens by diffing approved design against `design/DESIGN-SYSTEM.md`.
2. Phase 2 head-designer verdict's rationale section MUST explicitly bless the addition (verdict text names the token + reusability rationale). Gate-verdict didn't bless a token → do NOT add. Open a follow-up task (Action 9) for the next wave.
3. Append new token(s) to appropriate `DESIGN-SYSTEM.md` section with short descriptor + wave reference.
4. Commit: `docs(design-system): D-3 — add <token-names> for wave-<N>`

**Do NOT add:** one-off feature-specific values, invented values reviewers missed (those should have been REWORK), duplicates of existing tokens under different names.

---

### Action 9 — Archive cap-escalation artifacts (conditional)

Per gap that hit 3-cap and resolved via deferral to a follow-up task:

1. Move all 3 staging attempts to `design/staging/_archive/wave-<N>-<feature>/`.
2. INSERT a plain `tasks` row — same shape as V-2 Action 4 (see [`claudomat-brain/blocks/verify/stages/V-2-triage.md`](../../verify/stages/V-2-triage.md)):
   ```sql
   INSERT INTO tasks (title, description, status, milestone_id, wave_id, parent_task_id)
   VALUES (
     <one-line gap title>,
     <prose: escalation reasoning + reference to the 3 staging attempts archived in step 1 + observed vs intended + suggested next step>,
     'todo',
     <active_milestone_id when gap's surface overlaps milestone's ## Scope; else NULL>,
     (SELECT id FROM waves WHERE status = 'running' ORDER BY wave_number DESC LIMIT 1),  -- `Wave — current`
     NULL                                  -- top-level; becomes a candidate seed for a future wave's bundle
   );
   ```
   Description is prose only. No tags, no severity, no urgency — the LLM judges priority at P-0/N-1 by reading the prose.
3. Record deferral in `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-escalation.md`.

---

### Action 10 — Verify staging is clean

After canonicalizations + archives, `design/staging/` must contain no pending approvals for this wave. Leftover `design/staging/<feature>.html` = D-3 defect → re-run Action 6 or 9.

---

## Deliverable

Per gap:
- `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-plan-design-review.md` — reviewer A output (independent).
- `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-ui-ux-pro-max.md` — reviewer B output.
- `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-reconciliation.md` — Phase 1 matrix outcome.
- `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-adopt.md` — canonical path, journey-map delta, DESIGN-SYSTEM.md delta (if any), YAML footer:

```yaml
adoption_complete: true
canonical_path: design/<feature>.html
design_system_tokens_added: []   # list of token names if Action 8 fired, else empty
journey_map_updated: false       # true if Action 7 fired
```

Plus block-exit handoff state appended to `process/waves/wave-<N>/blocks/D/review-artifacts.md` "Status" field:

```yaml
design_block_status:    complete
gaps_resolved:          [list]
gaps_deferred:          [list]
design_system_updates:  [list of tokens]
canonicalized_at:       <iso8601>
```

## Exit criteria

- Every gap reconciled via Phase 1 matrix.
- Phase 2 head-designer verdict = APPROVED.
- Every Phase-1-APPROVE gap canonicalized + committed.
- Every cap-escalated gap archived + `bug-design` tagged.
- `design/staging/` contains no wave-<N> pending files.
- `process/waves/wave-<N>/blocks/D/review-artifacts.md` "Status" updated to `gate-passed`.
- `process/waves/wave-<N>/checklist.md` D-3 row checked.

## Next

→ `claudomat-brain/DISPATCHER.md` → next block is **B** (Build) — `read claudomat-brain/blocks/build/build.md`.

Cross-wave learnings surfaced during the block go to L-2 via the observation pipeline, not directly into `command-center/principles/DESIGN-PRINCIPLES.md`.
