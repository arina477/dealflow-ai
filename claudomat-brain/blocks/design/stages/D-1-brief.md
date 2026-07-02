# D-1 — Brief

> **Block:** D (Design), 2nd of 8 in wave loop: `P → ` **`[D]`** ` → B → C → T → V → L → N`. Conditional on `design_gap_flag: true` from P-1.
> **Stages:** **D-1** → D-2 → D-3 (gate). Advance on stage exit: D-2.
> **Pattern:** gate-only. head-designer spawned at D-3 for verdict; reference card on demand at `~/.claude/agents/head-designer.md`.
> **Dispatcher** (skip rules, gate semantics, exit handoff): `claudomat-brain/blocks/design/design.md`.

## Purpose

Consolidate every design gap blocking the wave; author one structured brief per gap. Brief is load-bearing input to D-2 and rubric reference for D-4. Vague brief → vague design → vague review.

## Prerequisites

- P-4 Gate exited with `design_gap_flag: true` (or absent — see block dispatcher's absent-flag policy).
- READ `design/brief-template.md`.
- READ `design/DESIGN-SYSTEM.md`.
- READ `command-center/principles/DESIGN-PRINCIPLES.md` if it exists.

## Actions

### Action 0 — Block entry: seed review-artifacts manifest

<!-- head-designer card may be consulted on demand at ~/.claude/agents/head-designer.md -->

**0b. Seed the D-block review-artifacts manifest.**

Write `process/waves/wave-<N>/blocks/D/review-artifacts.md` using this schema:

```markdown
# Wave <N> — D-block review artifacts

**Block:** D (Design)
**Wave topic:** <one line>
**Block exit gate:** D-3
**Status:** in-progress

## Stage deliverables

| Stage | Deliverable file(s) | Status | Notes |
|---|---|---|---|
| D-1 | process/waves/wave-<N>/stages/D-1-brief/<feature>-brief.md (per gap) | in-progress | seeded at D-1 Action 0 |
| D-2 | process/waves/wave-<N>/stages/D-2-variants/<feature>-variants.md + D-2-variants/<feature>-iterate.md (per gap) | pending | variants generation + bounded iteration loop |
| D-3 | process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-{plan-design-review,ui-ux-pro-max,reconciliation,adopt}.md (per gap) | pending | dual-reviewer gate + canonicalization |

## Block-specific context

- **Wave topic:** <one line>
- **design_gap_flag:** <carried from P-1 — `true` triggered this block>
- **Gaps inventoried:** <list, populated at D-1 Action 1>
- **Gaps deferred to bug-design tag:** <list, or "none">
- **3-cap escalations during block:** <list, or "none">
- **DESIGN-SYSTEM.md token additions proposed:** <list, or "none">

## Open escalations carried into gate

<list, or "none">

## Gate verdict log

<appended by fresh head-designer spawn at D-3 Action 1; one entry per attempt>
```

### Action 1 — Audit (gap consolidation + own grep)

Build authoritative gap list by consolidating:

1. **P-1 Decompose flagged gaps** — read `process/waves/wave-<N>/stages/P-1-decompose.md` for explicit design gaps named in spec contract.
2. **Plan-referenced gaps** — read `process/waves/wave-<N>/stages/P-3-plan.md` and grep `design/` for every page / component / icon / flow the plan references. Referenced but absent → gap.
3. **Prior-wave deferred gaps** — query the `tasks` table via the `Task — by tag` recipe in [`claudomat-brain/db/SCHEMA.md`](../../../db/SCHEMA.md) for `bug-design` tagged tasks claimed by this wave's spec contract.

Output: gap list with one-line scope per gap. Update manifest's "Gaps inventoried" field.

**Zero gaps after audit.** Audit finds no real gaps (P-1 wrong about flag) → record in deliverable, set `design_block_status: skipped-on-empty-audit` in manifest, exit block directly to B. Log false-positive flag for retro.

### Action 2 — Brief each gap

For each gap, fill `design/brief-template.md` end-to-end. Required fields:

- §1 What we need (one-line description)
- §2 Where it lives (route / file path / nav entry)
- §3 Audience + states (loading, loaded, empty, error)
- §4 **DESIGN-SYSTEM.md references** — minimum 6 primitives cited (colors, typography, spacing, shadows, clip-path, icons, components)
- §5 Responsive contract per breakpoint
- §6 Interaction patterns
- §7 Data shape
- §8 Prior art (2–3 existing `design/*.html` mockups whose visual language to match)
- §9 Success criteria (≥5 checkboxes)
- §10 Non-goals
- §11 Reviewer briefing

Briefs commit to `process/waves/wave-<N>/stages/D-1-brief/<feature>-brief.md`.

### Action 3 — Mask-mode self-check per brief

- Every `<placeholder>` replaced.
- §4 cites ≥6 DESIGN-SYSTEM.md primitives.
- §8 names 2–3 prior-art mockups.
- §9 has ≥5 checkboxes.

HOLD → re-author addressing cited reason. Loop until PASS.

## Deliverable

Per gap: `process/waves/wave-<N>/stages/D-1-brief/<feature>-brief.md` — full brief per `design/brief-template.md` plus YAML footer:

```yaml
mask_mode_signoff: PASS               # or HOLD
signoff_note: ""
```

If audit found zero gaps: single `process/waves/wave-<N>/stages/D-1-brief/_audit.md` recording empty-audit verdict + footer.

Also: update `process/waves/wave-<N>/blocks/D/review-artifacts.md` — mark D-1 row `done`, populate "Gaps inventoried".

## Exit criteria

- Every gap from Action 1 has brief carrying `mask_mode_signoff: PASS`, OR audit was empty and block exits.
- `process/waves/wave-<N>/blocks/D/review-artifacts.md` updated with D-1 results.
- `process/waves/wave-<N>/checklist.md` D-1 row checked.

## Next

→ `claudomat-brain/blocks/design/design.md` → D-2 (or block exit on empty-audit).
