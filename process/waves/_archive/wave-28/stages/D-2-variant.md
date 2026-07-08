# D-2 Variant — Retention-Settings UI
## Wave 28 · Design block · Adopted mockup: `design/staging/retention-settings.html`

---

## 1. Layout

**Shell:** identical to `design/staging/recordkeeping-export.html` — zinc-900 sidebar (256 px), sticky white top bar (64 px), zinc-25 page background, page scroll area with 32 px gutter. No chrome invented; reuses the shared AppShell contract (DESIGN-SYSTEM §10).

**Page column:** `max-width: 640 px`, left-aligned — narrow single-column settings posture matching the export page pattern. Not a dashboard grid.

**Vertical stack (top to bottom):**
1. Page heading block (title + subtitle)
2. Settings card (card-header + card-body: years field → provenance → save row)
3. Cutoff-surfacing panel (muted zinc, read-only)

**Spacing:** 4 px base unit throughout. 28 px gap between heading and card. 16 px gap between card and cutoff panel. 20 px between fields inside card-body. 24 px card body padding. All on the 4 px grid.

---

## 2. Component anatomy

### Page heading
- H1 "Records retention" — 20 px / 28 / 600 / zinc-800 / `letter-spacing: -0.01em` (matches export page h1 exactly)
- Subtitle — 14 px / 20 / 400 / zinc-500: "Set how long your firm's records are kept."

### Settings card
**Card structure:** surface bg (#fff) + 1 px zinc-200 border + radius-md (8 px) + shadow-xs. Card-header: zinc-50 bg + bottom border, 14 px icon (`clock` lucide, emerald-600) + "Retention window" H3 label. Matches export page card-header token-for-token.

**Retention field**

| Element | Spec |
|---|---|
| Label | 12 px / 600 / `letter-spacing: 0.04em` / uppercase / zinc-700 — "Retention period (1–30 years)" |
| Input | `<input type="number">`, 80 px wide, 20 px / 600 / tabular-nums, centered, radius-sm, zinc-300 border, focus → emerald-600 border + 3 px focus-ring `rgba(16,185,129,.40)` |
| Stepper buttons | 32 × 32 px, radius-sm, zinc-200 border, zinc-500 icon (`minus` / `plus`), hover → zinc-50 bg + zinc-300 border |
| Years unit label | 14 px / 500 / zinc-500 / `aria-hidden="true"` |
| Default value | 7 (maps to 2,555 days server-side) |
| Bounds | min=1, max=30 (enforced in HTML attr + JS + server) |

**Provenance line**
12 px / zinc-500: "Last updated by **{name}** on {date}". Reads from `updated_by` / `updated_at` API fields. Muted, non-interactive.

**Save row**
- Primary CTA button: `btn-primary` — emerald-600 bg, white text, 14 px / 600, radius-md, 10 px 20 px padding, full-row label "Save". One primary button only (DESIGN-SYSTEM §10 one-primary-CTA rule).
- Saved pill: inline beside Save button, emerald-50 bg + emerald-100 border + emerald-700 text, `check` icon, "Saved". Fades in on success, fades out after 3 s. `role="status" aria-live="polite" aria-atomic="true"`.
- Audit note: 12 px / zinc-500, `shield-check` lucide icon (emerald-600), "This change is recorded in your audit log." Always visible below the Save button row — not conditional on state. This is a load-bearing trust signal (WORM/compliance-first, D-1 §Compliance-first emphasis).

### Cutoff-surfacing panel (READ-ONLY)

A muted zinc card: zinc-50 bg + zinc-200 border + radius-md + 16 px 20 px padding. Two-column layout: 32 px icon circle (zinc-100 bg + zinc-200 border, zinc-500 `calendar-clock` lucide icon) + body text column.

| Element | Spec |
|---|---|
| Eyebrow | 11 px / 600 / 0.05em / uppercase / zinc-400 — "Retention cutoff" |
| Read-only badge | zinc-100 bg + zinc-200 border + radius-pill, 11 px / zinc-500, `lock` lucide icon 9 px — "Read-only". Adjacent to eyebrow. |
| Statement | 14 px / 500 / zinc-700 — "Under your **{N}-year** policy, records dated before **{cutoff-date}** are eligible for deletion." Cutoff date is zinc-800 / 600 / tabular-nums. |
| Note | 12 px / zinc-500 — "Records are preserved. Deletion is not performed automatically — this policy determines the eligibility window only." |
| Interactive affordances | None. No button, no link, no edit control. |

**Cutoff date derivation (client-preview):** `new Date(today.getFullYear() - N, today.getMonth(), today.getDate())`, formatted as "Month D, YYYY". Server authoritative value is `today - retention_period_days`.

**No purge control:** There is no delete, purge, or "clean up" affordance anywhere on this page. The cutoff panel is explicitly informational. This is non-negotiable (D-1 §Out of scope; WORM emphasis).

---

## 3. States

| State | Visual treatment | Accessibility |
|---|---|---|
| **Loading** | Card and cutoff panel show 3 skeleton shimmer bars (zinc-100 → zinc-50 gradient, `rk-shimmer` animation). `aria-busy="true"` on cutoff panel. | `aria-live="polite"` region updates when content arrives. `prefers-reduced-motion` disables shimmer. |
| **Idle** | Form at rest, current value populated, Save button enabled, no validation message, no saved pill. | Default focus order: label → input → decrement → increment → Save. |
| **Saving** | Save button: disabled, `aria-busy="true"`, `aria-label="Saving, please wait"`, spinner icon replaces Save icon, label "Saving…". Stepper buttons disabled. Input disabled. | Screen reader announces via `aria-busy` on button. |
| **Saved** | Saving state resolves. Button re-enables. Saved pill fades in (`role="status" aria-live="polite"`), auto-hides after 3 s. Provenance line updates to current user + today. | `aria-live="polite"` on pill. No focus jump. |
| **Error** | Persistent inline danger alert (`role="alert" aria-live="assertive"`) above Save row. `alert-triangle` lucide icon (red-600) + title "Could not save retention policy" + body text + Retry button. Save button remains enabled (user can retry directly). | `role="alert"` surfaces immediately to screen readers. Not auto-dismissed. |
| **Invalid** | Input: `border-color: red-600`, `aria-invalid="true"`, `aria-describedby` pointing to error div. Inline error message: `alert-circle` icon + "Enter a value between 1 and 30." (`role="alert" aria-live="assertive"`). Save button disabled. Stepper buttons disabled. Cutoff panel shows placeholder "Enter a valid retention period above to preview the cutoff date." | Error tied to input via `aria-describedby`. Not color-only: icon + text. |

---

## 4. Tokens used

All tokens consumed directly from DESIGN-SYSTEM.md §1–§6. No new tokens invented.

**Colors:**
- `--zinc-25` — page background
- `--zinc-50` — card-header bg, muted-fill, cutoff panel bg, skeleton base
- `--zinc-100` — icon circle bg, skeleton, stepper hover
- `--zinc-200` — borders, dividers, icon circle border, cutoff panel border
- `--zinc-300` — input border (default), stepper border
- `--zinc-400` — muted icon, cutoff eyebrow text, placeholder
- `--zinc-500` — secondary text, labels, provenance, audit note, years unit
- `--zinc-700` — field label text, input text, cutoff statement body
- `--zinc-800` — page title, card title, cutoff date
- `--zinc-900` — sidebar bg, strongest text
- `--emerald-50` — saved pill bg, audit-note icon tint
- `--emerald-100` — saved pill border
- `--emerald-600` — card-header icon, Save button bg, focus ring base, audit-note ShieldCheck icon
- `--emerald-700` — Save button hover, saved pill text, saved pill icon
- `--status-danger` (#DC2626) — invalid border, error icon, error text
- `--status-danger-bg` (#FEF2F2) — error alert bg
- `--status-danger-border` (#FECACA) — error alert border

**Typography:**
- H1: 20 px / 28 / 600 / zinc-800 (page title)
- H2/H3: 14 px / 20 / 600 / zinc-800 (card header title)
- Label: 12 px / 16 / 600 / 0.04em / uppercase / zinc-700
- Body-m: 14 px / 20 / 400 (subtitle, cutoff statement)
- Body-s: 12 px / 16–18 (provenance, audit note, cutoff note, error text)
- Input value: 20 px / 600 / tabular-nums (years input)
- Cutoff date: 14 px / 600 / tabular-nums / zinc-800

**Shape:** radius-sm (6 px) — input, stepper, error panel; radius-md (8 px) — card, Save button, inline alert; radius-pill (9999 px) — read-only badge, saved pill.

**Elevation:** shadow-xs (`0 1px 2px rgb(16 24 40 / 0.05)`) on card. No shadow on cutoff panel (border-first, DESIGN-SYSTEM §5).

**Motion:** interactive transitions 150 ms (hover/focus state changes). Shimmer 1.5 s linear. Spinner 0.9 s linear. All disabled under `prefers-reduced-motion`. `--anim-ease: cubic-bezier(0.16, 1, 0.3, 1)` not applied to micro-interactions (reserved for page-level reveals per DS §6).

---

## 5. Accessibility

- `<label for="retention-years">` associated with input — not placeholder-only.
- `aria-describedby="years-error years-hint"` on the years input — both the error and the screen-reader hint are linked.
- `aria-invalid="true/false"` toggled on the input in sync with validation state.
- `aria-live="assertive"` on the validation error div (`role="alert"`).
- `aria-live="polite"` + `aria-atomic="true"` on the saved pill (`role="status"`).
- `aria-busy="true"` on Save button during saving state.
- `aria-label` on Save button overridden to "Saving, please wait" during saving state.
- `aria-live="assertive"` + `role="alert"` on server-error inline alert.
- `role="note"` on cutoff panel — non-interactive, informational.
- `aria-label="Retention cutoff — read-only informational panel"` on cutoff panel.
- All icons `aria-hidden="true"` (decorative); text carries semantics.
- Focus-visible: 2 px emerald-600 outline, 2 px offset on all interactive controls.
- Stepper buttons and Save button disabled states use both `disabled` attr and `aria-disabled="true"`.
- No color-only signal: invalid = red border + icon + text; error = icon + text + title; saved = icon + text.
- `prefers-reduced-motion`: shimmer and spinner animations suppressed.
- Keyboard: Tab traverses label → input → decrement stepper → increment stepper → Save; stepper buttons are standard `<button>` elements (no roving tabindex needed for a pair).

---

## 6. Compliance-first / WORM emphasis

Two load-bearing design decisions that must survive into implementation unchanged:

**Audit note (trust signal):** The line "This change is recorded in your audit log." with the `shield-check` icon is always rendered below the Save button, in every state (idle, saving, saved, error). It is not conditional and must not be removed or made optional. Its purpose: to reinforce that retention-policy changes are themselves compliance-recordable events, matching the WORM posture of the platform.

**No purge control:** There is no button, link, or affordance anywhere on this page that initiates deletion of records. The cutoff panel is structurally informational. The "eligible for deletion" language is a policy statement, not a trigger. The "Records are preserved. Deletion is not performed automatically" note in the cutoff panel is also non-negotiable — it disambiguates the read-only nature of this panel for any user who might misread "eligible" as "will be deleted."

---

## 7. Shell consistency with existing compliance pages

The mockup reuses the identical shell as `design/staging/recordkeeping-export.html`:
- Same sidebar (zinc-900, 256 px, `network` logomark, emerald-600 active left rail, identical nav item set and order per DESIGN-SYSTEM §10)
- Same top bar (64 px, white, sticky, zinc-200 border-bottom, breadcrumb left + icon-btn + divider + avatar right)
- Same page scroll area padding (32 px)
- Same card structure (zinc-50 card-header, zinc-200 border, radius-md, shadow-xs, 14 px header title)
- Same max-width column (640 px for narrow settings; export page is also 720 px — this is intentionally tighter for a single-control form)
- Same heading style (20 px / 600 / zinc-800 / `letter-spacing: -0.01em`, 4 px gap to subtitle)

Compliance nav item is marked active (`aria-current="page"`) in this mockup. In the real app this is handled by `<AppShell>` via route matching.

---

## 8. Out of scope (explicit exclusions)

- Records-view (any table of individual records)
- Purge / delete UI of any form
- Certification / sign-off flow
- Any analytics / reporting on the retention policy
- Dark mode (deferred — light is canonical per DESIGN-SYSTEM §1)
- Mobile polish (desktop-first internal tool; no breakage, no polish)
