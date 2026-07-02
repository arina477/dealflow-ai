# D-2 — Variants

> **Block:** D (Design), 2nd of 8 in wave loop: `P → ` **`[D]`** ` → B → C → T → V → L → N`. Conditional on `design_gap_flag: true` from P-1.
> **Stages:** D-1 → **D-2** → D-3 (gate). Advance on stage exit: D-3.
> **Pattern:** gate-only. head-designer spawned at D-3 for verdict; reference card on demand at `~/.claude/agents/head-designer.md`.
> **Dispatcher** (skip rules, gate semantics, exit handoff): `claudomat-brain/blocks/design/design.md`.

## Purpose

Generate concrete HTML mockups per gap brief via `/aidesigner` (variants), then run a bounded iteration loop with mode-aware human checkpoint and refine cycles (cap 3 iterations per gap). Output lands in `design/staging/` so D-3 reviewers load real files, not specs. D-2 owns the back-edge from D-3's reviewer-rejection: REVISE / REJECT returns control here, deltas aggregate, `/aidesigner refine_design` re-runs against the same staging path.

## Prerequisites

- D-1 exited with at least one approved brief.
- READ each `process/waves/wave-<N>/stages/D-1-brief/<feature>-brief.md` for the gaps being generated.
- READ `design/DESIGN-SYSTEM.md` (passed to `/aidesigner` alongside the brief).
- READ `claudomat-brain/management/<mode>-mode.md` for active mode (`founder-review` / `default` / `automatic` / `degenerate`).
- VERIFY `/aidesigner` skill available per `claudomat-brain/setup-tools/install.md` (claudomat-bundled slash-skill that calls aidesigner.ai's REST API; not a sub-agent and not an MCP — AGENTS.md / .mcp.json checks do not apply). Missing → install per `install.md`; do not substitute another generator.

## Actions

### Action 1 — Generate variants per gap (first pass only)

Per gap, on the first D-2 entry (no D-3 backedge yet), invoke `/aidesigner` with:

- Full brief content (`process/waves/wave-<N>/stages/D-1-brief/<feature>-brief.md`).
- Full `design/DESIGN-SYSTEM.md` content.
- Explicit output target: `design/staging/<feature>.html`.

`/aidesigner` is the canonical generator. Consumes brief's §4 token references and §8 prior-art citations.

Independent gaps (no shared component class) → spawn `/aidesigner` calls in parallel. Shared components (e.g., two new pages both needing a new card primitive) → generate sequentially so the second matches the first.

### Action 2 — Commit staging

Each generated file commits to `design/staging/<feature>.html`. Commit message:

```
feat(design): D-2 staging — <feature> for wave-<N>
```

Staging files MUST be committed before D-3 so reviewers can load them by path.

### Action 3 — Mode-aware human checkpoint (first pass only)

**Fire when ALL hold:**
- Active mode is `founder-review` (no autonomous flag set).
- Generated design meaningfully extends visual language (new interaction pattern, never-before-seen component class, novel layout structure).

**Skip when ANY hold:**
- Active mode is `default`, `automatic`, or `degenerate` (log skip in deliverable).
- Trivial extension (missing icon, color-variant of existing pattern, copy of adjacent mockup with one field swap).

**On fire.** One `AskUserQuestion` showing brief + staging file path with three options:
1. Proceed to D-3 dual review.
2. Revise first (collect feedback, loop into Action 5).
3. Reject outright (move staging to archive, escalate per mode).

User's call gates next action.

### Action 4 — D-3 entry (no refinement needed)

First D-2 pass + (checkpoint approved OR skipped) → advance to D-3.

### Action 5 — Refinement loop (back-edge from D-3)

**First-pass D-2 (no D-3 backedge yet).** Create `process/waves/wave-<N>/stages/D-2-variants/<feature>-iterate.md` with `iteration_counter: 0`. Skip refine substeps. Advance to Action 6 then Action 4.

**Loop-back D-2 (entered from D-3 with REVISE / REJECT).** Per gap requiring refinement:

1. **Aggregate concerns** from both reviewer files (`process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-plan-design-review.md`, `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-ui-ux-pro-max.md`) into consolidated refine prompt. Each instruction actionable + measurable — cite brief §X or `DESIGN-SYSTEM.md` §Y, never "make it better".
2. **Invoke `/aidesigner refine_design`** against existing `design/staging/<feature>.html` with consolidated prompt. Use refine mode (delta), not full regenerate, so approved elements persist.
3. **Increment iteration counter** in `process/waves/wave-<N>/stages/D-2-variants/<feature>-iterate.md` (file exists from first-pass; counter starts at 0, +1 per refine).
4. **Cap check.** Incremented counter would exceed 3 → do NOT refine. Escalate per block dispatcher's mode-aware 3-cap matrix.

### Action 6 — Record iteration state

Per gap, append to `process/waves/wave-<N>/stages/D-2-variants/<feature>-iterate.md`:
- Iteration number (0 on first pass, then 1, 2, or 3 on refines).
- Consolidated refine prompt sent to `/aidesigner` (empty on iteration 0).
- Resulting staging path (overwrites `design/staging/<feature>.html` on refine).
- Checkpoint outcome (`fired-approved` / `fired-revised` / `fired-rejected` / `skipped-mode-<mode>` / `skipped-trivial`).

## Deliverable

Per gap:
- `design/staging/<feature>.html` — committed staging file.
- `process/waves/wave-<N>/stages/D-2-variants/<feature>-variants.md` — variant notes (path to staging file, one-line summary of generation approach, any `/aidesigner` warnings).
- `process/waves/wave-<N>/stages/D-2-variants/<feature>-iterate.md` — running log of all iterations + checkpoint outcomes.

Also: update `process/waves/wave-<N>/blocks/D/review-artifacts.md` — mark D-2 row `done`.

## Exit criteria

- Every gap from D-1 has a committed staging HTML file.
- Every gap has variant notes + iteration log.
- First-pass D-2: checkpoint fired-approved OR skipped per mode/triviality rule.
- Loop-back D-2: refinement applied OR cap hit and escalation initiated.
- `process/waves/wave-<N>/checklist.md` D-2 row checked.

## Next

- Normal flow → `claudomat-brain/blocks/design/design.md` → D-3.
- 3-cap escalation → block dispatcher's mode-aware escalation matrix; D-block exits via escalation outcome.
