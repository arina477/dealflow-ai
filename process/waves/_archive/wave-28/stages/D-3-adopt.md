# D-3 Review & Adopt — Retention-Policy Settings UI
## Wave 28 · Design block · Gate: head-designer

**Adopted mockup:** `design/staging/retention-settings.html`
**Prior-stage signoff:** D-2 APPROVED (variant spec `process/waves/wave-28/stages/D-2-variant.md`)
**Build target:** B-3 (`nextjs-developer`) implements to this design.

---

## Verdict: **APPROVED**

The retention-settings mockup is adopted for build. It is a faithful, token-disciplined
extension of the shipped compliance shell, WCAG 2.2-clean, and — most importantly — it
honours the WORM/compliance boundary: it sets policy, it does not delete records, and it
carries no purge affordance anywhere.

---

## Gate checklist

### 1. Design-system token discipline — PASS
- Every hex resolves to a named DESIGN-SYSTEM §1 token or a legitimately-derived chrome/darker-on-tint shade. Full hex audit clean: zinc/emerald + the 5 status tokens ONLY. No indigo/sky/purple/rose/orange.
- `#6EE7B7` (emerald-300) appears ONLY as the active-sidebar nav text/icon — part of the canonical AppShell chrome contract (§10 "brighter emerald active item"), not an invented content accent. `#D97706` = `--status-warn` (nav pending badge). `#991B1B`/`#B91C1C` = darker red-on-tint for danger-alert text (standard §8 danger pairing).
- Icons: all inline SVG matching real lucide paths (network, shield-check, clock, calendar-clock, lock, save, check, minus, plus, alert-circle, alert-triangle, refresh-cw, chevron-right, bell + nav set). Zero Phosphor / Heroicons / hand-rolled icon sets.
- 4px spacing grid throughout (28/16/20/24 gaps; 32px page gutter). No arbitrary/fractional values.
- **ONE** emerald primary CTA (`Save`) per view. No competing equal-weight primaries. Stepper + retry are subordinated (secondary/ghost tokens).
- Financial/numeric values (`years-input`, `cutoff-date`) carry `font-variant-numeric: tabular-nums`.

### 2. Shell consistency — PASS
- Sidebar (zinc-900, 256px, `network` logomark, emerald active rail, exact §10 nav set + order), sticky white 64px topbar with breadcrumb, 32px page-scroll gutter, zinc-50 card-header + zinc-200 border + radius-md + shadow-xs card — all match the shipped `compliance/export` shell token-for-token.
- Page heading style (20px/28/600/zinc-800/`-0.01em` + 4px gap to subtitle) matches `export/page.tsx` exactly. `max-width` 640px (tighter single-control settings column) is an intentional, in-contract narrowing vs export's 720px. No new navigation paradigm; no chrome invented. Compliance nav item correctly `aria-current="page"`.

### 3. Accessibility (WCAG 2.2) — PASS
- Labeled input (`<label for="retention-years">`), not placeholder-only.
- `aria-describedby="years-error years-hint"`, `aria-invalid` toggled in sync with validation.
- `aria-live`: `polite` on loading region + saved pill (`role="status"`, `aria-atomic`); `assertive` + `role="alert"` on validation error and server-error alert.
- Focus-visible: 2px emerald outline + 2px offset on every interactive control (nav, stepper, input, Save, retry, demo bar).
- No color-only signal: invalid = red border + icon + text; error = icon + title + body; saved = icon + text; read-only = badge + lock icon + text.
- `prefers-reduced-motion` suppresses shimmer + spinner.
- Keyboard: standard `<button>`/`<input>` elements; logical Tab order (label → input → decrement → increment → Save). No traps, no pointer-only gestures, no destructive single-key shortcuts.

### 4. WORM / compliance-first emphasis (LOAD-BEARING) — PASS
- **Audit-recorded trust note present** in EVERY state (idle/saving/saved/error/invalid): "This change is recorded in your audit log." with the `shield-check` (ShieldCheck) icon, always rendered below Save — not conditional.
- **Cutoff panel is unambiguously READ-ONLY informational**: `role="note"`, `calendar-clock` icon, an explicit **"Read-only"** badge (lock icon), and the disambiguating note "Records are preserved. Deletion is not performed automatically — this policy determines the eligibility window only."
- **NO purge/delete/clean-up affordance anywhere** on the page. Confirmed across all 6 state sections and the JS — no button, link, or handler initiates deletion. "eligible for deletion" is policy language inside a `role="note"` panel, never a trigger. Compliance boundary intact.

### 5. One-primary-CTA + the 6 states — PASS
All six states present and covered: loading (skeleton shimmer + `aria-busy`), idle, saving (disabled + spinner + `aria-busy`), saved (pill, provenance updates), error (persistent inline danger alert + Retry, NOT auto-dismissed), invalid (red border + `aria-invalid` + inline message + Save disabled + cutoff placeholder). Single primary CTA holds across every state.

### 6. LIGHT posture — PASS
A clean single-column settings form (640px) — one control card + one read-only panel. Right-sized; not a heavyweight compliance console. No dashboard cacophony.

### 7. Scope — PASS
Retention settings ONLY. No records-view table, no purge UI, no certification/sign-off, no analytics. Out-of-scope exclusions honoured (D-1 §Out of scope). No scope creep.

---

## Build notes for B-3 (`nextjs-developer`)
- Implement inside the `(app)` route group so `AppShell` chrome is inherited from `app/(app)/layout.tsx` — do NOT re-render sidebar/topbar (matches `compliance/export/page.tsx` pattern).
- RBAC: admin + compliance ONLY; advisor/analyst → `assertRole` redirect + no nav entry (nav⊆RBAC invariant), same as export page.
- The state-preview demo bar (`.state-demo-bar` + `showState`) is mockup-only scaffolding — do NOT ship it.
- Audit note + no-purge boundary are non-negotiable invariants; carry into implementation unchanged. Retention-policy change must itself write an audit-log entry (the note is a promise the backend must keep).
- Cutoff date is server-authoritative (`today - retention_period_days`); the client JS derivation is a preview convenience only.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: D-3
  reviewers: {}
  failed_checks: []
  rationale: >
    The retention-settings mockup faithfully extends the shipped compliance/export
    AppShell shell with zero token drift (zinc/emerald + 5 status tokens only, all-lucide
    icons, 4px grid, one emerald primary CTA, tabular-nums numerics), full WCAG 2.2
    coverage (labeled input, aria-describedby/invalid/live, role=alert/note, focus-visible,
    no color-only signal, prefers-reduced-motion), all six states, and — load-bearing —
    an always-visible audit-recorded trust note plus a strictly READ-ONLY cutoff panel
    with NO purge/delete affordance anywhere, preserving the WORM compliance boundary.
    Light settings posture, in-scope, adopted for build.
  next_action: PROCEED_TO_B-3
```
