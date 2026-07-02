# Stage v8 — Design System: Build DESIGN-SYSTEM.md (Gated on v6b lock)

## Purpose
Produce the canonical `design/DESIGN-SYSTEM.md` with all tokens + reusable module primitives. Source both B-block implementers (Stage B-2 / B-3) and future designs (D-block, v9) consume.

**Skip rule.** Backend-only / API-only / CLI / library projects skip this stage (per v7 skip classification).

## Prerequisites
- **v6b complete** with `command-center/dev/module-list.md` carrying `status: locked` — **HARD GATE**.
- v7 complete (`design/direction.html` exists).
- READ `design/DESIGN-SYSTEM.md` scaffold (project-side, shipped at `claudomat init`).
- READ `design/review-gate.md` (D-3 review & adopt rubric — same discipline applies).
- `/aidesigner` skill present.

## Actions

### 1. Verify v6b gate (HARD STOP if absent)

Read `command-center/dev/module-list.md` front-matter. If `status: locked` is absent or any other value, STOP — v6b is incomplete. Return to v6b.

### 2. Extract direction tokens from `design/direction.html`

Parse approved `design/direction.html` to extract:
- Color palette (primitive colors + semantic mappings — e.g., `--primary`, `--success`, `--muted`).
- Typography (families + scale).
- Spacing scale.
- Shadows + elevation.
- Border radii + clip-paths.
- Motion / transition timing + easing.
- Iconography style notes.

Write extracted tokens into `design/DESIGN-SYSTEM.md` scaffold sections 1–7.

### 3. Build module primitive coverage list — options-and-custom

From locked `module-list.md` MVP modules + standard UI primitives needed by any product, build a candidate primitive list:

- Button (primary / secondary / ghost / destructive variants + sizes)
- Input (text / email / password / textarea / select)
- Card (base / interactive / with-media)
- Modal / Dialog
- Toast / Snackbar
- Table
- Navigation (header / sidebar / breadcrumb)
- Empty / Error / Loading skeleton states
- Form (field group + validation patterns)
- Badge / Tag / Pill
- Avatar
- Tooltip / Popover

Plus project-specific primitives implied by `module-list.md` (e.g., for a marketplace: ListingCard, RatingStars, CartDrawer).

Fire `AskUserQuestion`:

> "I drafted <N> primitives to generate (<K> standard + <M> project-specific). Pick:"
>
> 1. **Approve as-is** — generate all <N>.
> 2. **Trim** — drop some I don't need yet; tell me which.
> 3. **Add** — append more primitives; tell me which.
> 4. **Custom** — describe the primitive set you want.

### 4. Invoke `/aidesigner` with the module inventory

Pass to `/aidesigner`:
- Populated tokens from step 2.
- Approved primitive list from step 3.
- `design/direction.html` as style reference.
- Relevant per-page PD files from `command-center/product/per-page-pd/` that use these modules.

Prompt: generate the "Component primitives" section — one HTML block per primitive showing visual anatomy + the tokens it consumes.

Each module primitive section includes:
- Visual anatomy (HTML snippet rendered against the direction).
- Tokens it consumes.
- States (default / hover / active / disabled / loading / error).
- Accessibility notes (ARIA, keyboard, focus).
- Usage guidance ("Use for X, not for Y").

### 5. Founder approval loop — options-and-custom

Present `design/DESIGN-SYSTEM.md` via `AskUserQuestion`:

> "Design system built: `design/DESIGN-SYSTEM.md` (<N> tokens, <M> primitives). Pick:"
>
> 1. **Approve** — commit as canonical; v9 per-page designs will consume these tokens + primitives.
> 2. **Revise specific sections** — tell me which (a token, a primitive variant, a state). Cheaper than full rebuild.
> 3. **Reject — fundamental issue** — requires rebuild from scratch (back to step 4 with new prompt).
> 4. **Custom** — describe what's wrong and I'll target the regeneration.

Loop:
- **Revise**: targeted regeneration of specific sections.
- **Reject**: back to step 4 with new prompt.
- **Approve**: commit.

Iteration cap: 5 revise rounds. After cap, force `Approve current state / Pick from prior / Escalate for manual rebuild`.

### 6. Commit + log decision

Optional incremental commit:

```bash
git add design/DESIGN-SYSTEM.md
git commit -m "chore(onboarding): v8 design system approved"
```

Append to `product-decisions.md`:

```markdown
### [<YYYY-QN>] Design system built + approved
**Category**: Design
**Status**: Active
**Context**: v8 onboarding design system generation.
**Decision**: DESIGN-SYSTEM.md populated with <N> color tokens, <N> type tokens, <M> module primitives.
**Rationale**: Aligned to approved direction (v7) + locked module list (v6b).
**Artifacts**: `design/DESIGN-SYSTEM.md`
```

## Deliverable

- `design/DESIGN-SYSTEM.md` — fully populated (tokens + module primitives + states + accessibility).
- `command-center/product/product-decisions.md` — v8 decision logged.

## Exit criteria

- Every module in `module-list.md` § MVP has a corresponding primitive section in DESIGN-SYSTEM.md (or is explicitly excluded with rationale).
- Every primitive has all relevant states documented (default + ≥2 interactive states).
- Founder explicitly chose **Approve**.
- File references (colors, tokens, modules) resolve consistently throughout.

## Next

→ Return to `../onboarding-loop.md` → Stage v9 (page-designs).
