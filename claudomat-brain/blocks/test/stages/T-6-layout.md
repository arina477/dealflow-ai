# T-6 — Layout

> **Block:** T (Test), 5th of 8 in wave loop: `P → [D] → B → C → ` **`T`** ` → V → L → N`.
> **Stages:** T-1 → T-2 → T-3 → T-4 → T-5 → **T-6** → T-7 → T-8 → T-9 (gate). Advance on stage exit: T-7.
> **Pattern:** gate-only. head-tester spawned at T-9 for verdict; reference card on demand at `~/.claude/agents/head-tester.md`.
> **Dispatcher** (skip rules, layered cascade, gate semantics, exit handoff): `claudomat-brain/blocks/test/test.md`.

## Purpose

Visual regression and layout diff against canonicalized designs and pre-deploy baselines. Catches the bug class T-5 misses: the page works, buttons click, but it looks wrong — broken spacing, font drift, missing icon, layout shift on load.

## Pattern

**B — Active-execution.**

## Prerequisites

- T-5 exited.
- READ `design/<feature>.html` for every UI surface this wave canonicalized at D-3.
- READ `design/DESIGN-SYSTEM.md` for the project's token reference.
- READ `command-center/testing/test-writing-principles.md` § Layout testing.

## Skip condition

Skip when `wave_type` does NOT include `ui` (backend-only / infra / docs). Deliverable records wave_type and skip reason.

## Actions

### Action 1 — Capture deployed-state screenshots

For every UI surface canonicalized at D-3 (`design/<feature>.html`), capture the live deployed page at multiple breakpoints (per `design/DESIGN-SYSTEM.md` responsive contract):

```
/browse <prod-url>/<route> --width 1440
/browse <prod-url>/<route> --width 1280
/browse <prod-url>/<route> --width 1024
```

Save each screenshot to `process/waves/wave-<N>/stages/T-6-layout/screens/<route>-<width>.png`.

### Action 2 — Diff against canonicalized design

For each screenshot, run a visual diff against the canonicalized `design/<feature>.html` rendered at the same width. Tools (project-specific, declared in `command-center/principles/test-layer-principles/T-6.md`): pixelmatch, ImageMagick `compare`, Playwright's built-in toMatchSnapshot, Chromatic, Percy, etc.

Diff threshold: per-project (declared in T-6 principles file). Default: any diff >5% area triggers a finding.

### Action 3 — Pre-deploy baseline diff (optional)

If pre-deploy baseline screenshots were captured at C-3 canary-phase arming (per `command-center/principles/test-layer-principles/T-6.md`), diff the deployed-state screenshots against baselines too. Catches regressions on pages the wave didn't intend to touch.

### Action 4 — Token compliance audit

For each new component the wave introduced, verify rendered styles consume `design/DESIGN-SYSTEM.md` tokens.

**Component selection.** Read `process/waves/wave-<N>/stages/B-3-frontend.md` § `files_implemented`. For each file, derive the primary selector(s):
- Class-based component → top-level `className` value (e.g., `.SessionRow`).
- Element-based component → semantic tag + scope (e.g., `main[data-route="/sessions"] > section.list > article`).
- Page route → `data-route` attribute or unique container.

If a file in `files_implemented` has no derivable primary selector (e.g., a hook or utility module), skip it.

**Probe each derived selector:**
```
/browse <prod-url>/<route> --evaluate "getComputedStyle(document.querySelector('<selector>')).color"
/browse <prod-url>/<route> --evaluate "getComputedStyle(document.querySelector('<selector>')).backgroundColor"
/browse <prod-url>/<route> --evaluate "getComputedStyle(document.querySelector('<selector>')).boxShadow"
/browse <prod-url>/<route> --evaluate "getComputedStyle(document.querySelector('<selector>')).borderRadius"
```

Compare returned values against the DESIGN-SYSTEM.md primitives. Invented hex values, off-token spacings, fabricated shadow stacks, or non-system border radii are findings.

### Action 5 — Triage diffs (Iron Law routing)

For each diff finding, classify:
- **Critical (broken layout, missing element, off-token color/spacing)** → re-enter B-3 frontend; if invented token, also flag for D-block re-evaluation at next UI wave.
- **Significant (visual shift, hierarchy change)** → V-2 Triage decides blocking vs `bug-design`.
- **Cosmetic (off-by-1px, anti-aliasing)** → suppress.

Re-enter B-3 fix cycle; re-run T-6 for affected surfaces. Cap: 3 cycles.

## Deliverable

`process/waves/wave-<N>/stages/T-6-layout.md` — records screenshot inventory, diff results, token audit, fix-up cycle log, plus YAML footer.

```yaml
test_pattern: active
skipped: false
surfaces_audited: [list]
breakpoints: [1440, 1280, 1024]
diffs:
  - {surface, breakpoint, diff_pct, verdict}
token_violations: []
fix_up_cycles: 0
findings:
  - {severity, surface, description}
```

## Exit criteria

- Every D-3 surface diffed at every required breakpoint.
- Token compliance audited for new components.
- Critical diffs resolved.
- `process/waves/wave-<N>/checklist.md` T-6 row checked.

## Next

→ `claudomat-brain/blocks/test/test.md` → T-7.
