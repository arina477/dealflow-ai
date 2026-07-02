# Stage v9 — Per-Page Design Generation (Loop)

## Purpose
Generate a canonical mockup (`design/<page>.html`) for every page identified in v4. Each page uses DESIGN-SYSTEM.md tokens + module primitives and is approved by the founder before canonicalizing.

**Skip rule.** Backend-only / API-only / CLI / library projects skip this stage (per v7 skip classification).

## Prerequisites
- v8 complete (`design/DESIGN-SYSTEM.md` approved).
- v4 complete (`command-center/product/per-page-pd/` populated — one PD file per non-stub page).
- v7 complete (`design/direction.html` canonicalized).
- `/aidesigner` skill present.

## Actions

### 1. Build the queue + pick ordering — options-and-custom

Read every file under `command-center/product/per-page-pd/`. Build a queue, one page per non-stub PD file. Stub-marked pages from v4 step 1.5 are skipped.

Fire `AskUserQuestion`:

> "<N> pages to design. Pick the order:"
>
> 1. **Priority order (recommended)** — home / login / core-product first; admin / legal last. I'll surface the order before generating.
> 2. **Page-map order** — same order as `user-journey-map.md` lists them.
> 3. **Reverse priority** — admin / settings first (test the system on edge pages before front-door).
> 4. **One-at-a-time, you choose** — I ask you which to do next after each approval.
> 5. **Custom** — provide the order.

### 2. Per-page generation loop

For each page in the queue:

**2a. Build page brief** using `design/brief-template.md` (project-side template, also used by D-block per-wave Design briefs), pulling:
- Page name + route + audience from `<page>.md` PD file.
- Content sections, interactions, states from PD file.
- Related modules from `DESIGN-SYSTEM.md` (use the primitives — do NOT reinvent).
- Approved direction from `design/direction.html`.
- Tier 1 competitor equivalent-page screenshot references from `competitive-benchmarks/` (if applicable).

Write brief to: `process/session/onboarding/v9-<page>-brief.md`.

**2b. Invoke `/aidesigner`** with the brief. Output lands in `design/staging/<page>.html`.

**2c. Consistency check** — before presenting to founder, verify:
- Page uses module primitives from `DESIGN-SYSTEM.md` (no custom variants without flagging).
- Page respects the direction (color, type, spacing, shadow, motion).
- Responsive breakpoints are present.
- Empty / error / loading states are covered per the PD spec.

If inconsistencies, auto-refine before approval.

**2d. Founder approval — options-and-custom** via `AskUserQuestion`:

> "Design for `<page>`: `design/staging/<page>.html`. Pick:"
>
> 1. **Approve** — canonicalize to `design/<page>.html` and move to next page.
> 2. **Revise** — tell me what needs adjusting (specific section / state / interaction); I'll regenerate.
> 3. **Pick from prior attempts** — if we've iterated on this page, surface the last 3 staging files.
> 4. **Escalate** — this page needs a fundamental rethink; may affect direction (v7) or design system (v8). Pause v9.
> 5. **Custom** — describe what you want and I'll capture as refine prompt.

Loop:
- **Revise**: refine + back to 2d.
- **Pick from prior**: canonicalize the chosen prior staging file directly.
- **Escalate**: pause v9, fire one `AskUserQuestion` with options-and-custom (Revise direction (v7) / Revise system (v8) / Force-approve current / Custom). Resume v9 after upstream fix.
- **Approve**: canonicalize (step 2e).

Per-page iteration cap: 4 revises. After cap, force a `Pick from prior / Escalate / Custom override` poll — repeated failures on one page signal upstream inadequacy.

**2e. Canonicalize** the approved page:

```bash
git mv design/staging/<page>.html design/<page>.html
```

Annotate the PD file (`per-page-pd/<page>.md`) with a reference to the approved design path.

### 3. Loop until queue empty

Continue 2a–2e for every page. Long onboarding runs benefit from incremental commits:

```bash
git add design/<page>.html command-center/product/per-page-pd/<page>.md
git commit -m "chore(onboarding): v9 — <page> design approved"
```

### 4. Cross-page consistency audit

After all pages approved, spawn `ui-designer` (fresh context) via `Agent(subagent_type=ui-designer)` for a sweep:
- All pages consistently use module primitives.
- No two pages introduce conflicting variants of the same primitive.
- Navigation / header / footer patterns are identical across pages (reuse, don't rebuild).
- Responsive breakpoints work uniformly.

If drift detected, fire `AskUserQuestion` with options-and-custom (Regenerate drifting pages / Accept drift with rationale / Update DESIGN-SYSTEM and resync / Custom). After resolution, proceed.

### 5. Log decision

Append to `product-decisions.md`:

```markdown
### [<YYYY-QN>] Per-page designs complete
**Category**: Design
**Status**: Active
**Context**: v9 onboarding per-page design generation.
**Decision**: <N> pages designed + approved: <list page names>
**Artifacts**: `design/<page>.html` × N + `process/session/onboarding/v9-<page>-brief.md` × N
```

## Deliverable

- `design/<page>.html` × N — one per page in PD queue.
- `process/session/onboarding/v9-<page>-brief.md` × N — briefs preserved for audit.
- `command-center/product/per-page-pd/<page>.md` × N — annotated with approved-design path.
- `command-center/product/product-decisions.md` — v9 decision logged.

## Exit criteria

- Every non-stub page in `per-page-pd/` has a corresponding approved `design/<page>.html`.
- Cross-page consistency audit passed (no unresolved drift).
- Zero pages remain in `design/staging/`.

## Next

→ Return to `../onboarding-loop.md` → Stage v10 (planning).
