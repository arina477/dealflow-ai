# Design Brief Template (D-1)

Copy into `process/waves/wave-<N>/stages/D-1-brief/<feature>-brief.md` and fill every section. Every field is load-bearing — `/aidesigner` + both reviewers will check against it.

---

```markdown
# Design Brief — <feature name>

**Wave:** <N>
**Parent stage invoking:** P-0 / P-2 / B-block / V-2
**Blocking current wave:** yes / no
**Mode:** founder-review / default / automatic / degenerate (inherited from `process/session/.autonomous-session`)

## 1. What we need

One-line description of the page / component / icon / flow that doesn't yet exist in `design/`.

## 2. Where it lives

- **Route / file path:** e.g. `/settings/notifications` (new) or `<frontend-pkg>/src/components/ui/<x>.tsx`
- **Navigation entry:** where users reach this (from Settings tab bar? from notification bell dropdown? new sidebar item?)

## 3. Audience + state

- **Who sees it:** anonymous / buyer / seller / admin / <project-specific persona> (multi-select allowed)
- **States to design:** loading / loaded / empty / error / <feature-specific>

## 4. DESIGN-SYSTEM.md references (REQUIRED)

Cite every primitive from `design/DESIGN-SYSTEM.md` the generated design must consume. Copy exact section references. Minimum useful coverage:

- **Colors:** list tokens (e.g. `--brand-primary` for CTA, `--bg-card` for panel, `--pill-pending-bg` for status)
- **Typography:** which type-scale rows apply (H1 + H3 + Body-m + Label)
- **Spacing / radius:** exact values from DESIGN-SYSTEM.md § 3 / § 4
- **Shadows:** shadow tokens from DESIGN-SYSTEM.md § 5
- **Clip-path / shape:** if applicable
- **Icons:** icon library names expected (e.g. `BellIcon`, `ShieldCheckIcon`) — reference DESIGN-SYSTEM.md § 7 iconography
- **Components to reuse** from existing `design/` mockups: list specific component names

## 5. Responsive contract

Per-breakpoint behavior (per `design/DESIGN-SYSTEM.md` § Responsive):
- **Desktop full (2xl):** full layout
- **Desktop compact (xl):** <describe>
- **Tablet (lg):** <describe>
- **Mobile (degraded):** <describe minimum usable>

## 6. Interaction patterns

- Click / hover / focus states per interactive element
- Animation / transition expectations
- Keyboard accessibility (Tab order, Escape behavior, ARIA roles)
- Form validation UX (inline errors, submit states)

## 7. Data shape

- API endpoint(s) the design will consume (method + path + response schema shape)
- Empty / loading / error payloads the design handles

## 8. Prior art (match this visual language)

List 2-3 existing `design/*.html` mockups whose visual language the generated design must match. E.g.:
- Page header → match `<existing-page>.html:<line-range>`
- Card layout → match `<existing-page>.html:<line-range>`
- Empty state → match `<existing-page>.html:<line-range>`

## 9. Success criteria (APPROVE checklist)

The design is approved only when ALL of these hold:
- [ ] Uses exactly the DESIGN-SYSTEM.md tokens listed in § 4 (no new hex values, no invented tokens)
- [ ] Renders all states listed in § 3
- [ ] Responsive per § 5
- [ ] Matches prior-art visual language from § 8
- [ ] Interaction patterns per § 6 (or documented variation + justification)
- [ ] All icon references are real component names (not invented)
- [ ] <feature-specific criterion>

## 10. Non-goals

- <out-of-scope thing 1>
- <out-of-scope thing 2>

## 11. Reviewer briefing (D-3 review & adopt)

`/plan-design-review` should score these dimensions: visual hierarchy, spacing rhythm, brand coherence, edge-case handling.
`/ui-ux-pro-max` should verify: brief criteria match, UX flow sensibility, accessibility minimums.
```

---

## Authoring checklist

Before passing the brief to `/aidesigner` at D-2:
- [ ] Every `<placeholder>` replaced with concrete content
- [ ] § 4 cites at least 6 DESIGN-SYSTEM.md primitives (vague briefs produce vague output)
- [ ] § 8 names 2-3 prior-art mockups (prevents visual drift)
- [ ] § 9 has ≥5 checkboxes (more = better reviewer signal)
- [ ] Committed to `process/waves/wave-<N>/stages/D-1-brief/<feature>-brief.md`
