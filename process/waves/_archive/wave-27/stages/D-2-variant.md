# Wave 27 — D-2 Design Variant: Recordkeeping Export page

**Deliverable:** `design/staging/recordkeeping-export.html`
**Route:** `/compliance/export`
**RBAC:** compliance + admin only (advisor/analyst: no nav entry + 403 on direct hit)
**Brief consumed:** `process/waves/wave-27/stages/D-1-brief.md`
**Design system consumed:** `design/DESIGN-SYSTEM.md` (v9, zinc/emerald palette, lucide-react, 4px grid)
**Existing page patterns matched:** `/compliance/audit-log` (page.tsx + ExportPanel + IntegrityBadge) + `/compliance/settings` (page.tsx header/card pattern)

---

## Layout

Single-column, `max-width: 720px`, inside the canonical AppShell (`w-256 zinc-900 sidebar` + `h-64 sticky topbar`). The page content sits in a scrollable main area with `padding: 32px`. This matches the audit-log and settings page geometry exactly — not a new shell.

**Structure (top to bottom):**
1. Breadcrumb in topbar: `Compliance / Export records`
2. Page header: H2 "Export records" (20px/600) + body-m subtitle
3. Single card: "Configure export" (card-header with `file-down` lucide icon)
4. Inside card: scope picker → format picker → date range → bounds note → Export CTA
5. Result panel (below card, same column): integrity band + metadata + download link
6. Truncation warning (inside result panel, below metadata, when applicable)

No two-column split, no modal, no drawer — a clean form-and-result flow. The result panel appears after the CTA fires and is not pre-rendered idle, keeping the page uncluttered at rest.

---

## States shown in the mockup (stacked for design review)

| State | Visual treatment |
|---|---|
| **Idle** | Form card with default selections (Both scope, CSV format, empty dates); Export CTA enabled in emerald |
| **Generating** | CTA disabled (`aria-busy="true"`, `aria-disabled="true"`), spinner in button; result area shows skeleton rows + spinner header with `role="status"` `aria-live="polite"` |
| **Success — integrity verified** | Emerald integrity band (ShieldCheck icon + "Integrity verified" text + hash-chain sub-label); 3-column meta grid (rows, range, format); emerald download link |
| **Success — truncated** | Same emerald integrity band; amber truncation warning (`role="alert"`, AlertTriangle icon + count copy "50,000 of 183,492 rows"); download link present but labeled partial |
| **Empty** | Neutral panel with FileText icon + "No records in this range" + guidance copy; no download affordance |
| **Error** | Danger inline panel (`role="alert"`, AlertTriangle icon, plain-language error text, Retry button) |

---

## Design-system tokens used

### Color
- `--zinc-25` (`#FCFCFD`) — app background
- `--zinc-50` (`#F9FAFB`) — card header bg, bounds note bg, muted fills
- `--zinc-100` (`#F3F4F6`) — segmented control tray bg
- `--zinc-200` (`#E5E7EB`) — all borders (`--border`)
- `--zinc-300` (`#D1D5DB`) — strong border on date inputs (`--border-strong`)
- `--zinc-400–700` — label text, placeholder, secondary text, body text hierarchy
- `--zinc-800` (`#1F2937`) — headings, card titles (`--text-primary`)
- `--zinc-900` (`#111827`) — sidebar bg (`--bg-sidebar`)
- `--emerald-50` (`#ECFDF5`) — integrity band bg, download link bg, success result bg
- `--emerald-100` (`#D1FAE5`) — integrity icon circle bg, integrity band border, download link border
- `--emerald-600` (`#10B981`) — primary CTA bg (`--primary`), sidebar active indicator, card-header icon, logo mark
- `--emerald-700` (`#047857`) — CTA hover (`--primary-hover`), integrity label text
- `--status-warn` (`#D97706`) — truncation warning icon, amber row count
- `--status-warn-bg` (`#FFFBEB`) — truncation warning band bg
- `--status-warn-border` (`#FDE68A`) — truncation warning border
- `--status-danger` (`#DC2626`) — error panel icon + retry button
- `--status-danger-bg` (`#FEF2F2`) — error panel bg
- `--focus-ring` (`rgba(16,185,129,0.40)`) — all interactive focus rings

### Typography
- H2 page title: 20px / 28 / 600 (matches audit-log + settings header)
- Body-m subtitle: 14px / 20 / 400, `--text-muted`
- Card title: 14px / 20 / 600 (H3 per design system)
- Label (UPPERCASE eyebrow): 12px / 16 / 600, `letter-spacing: 0.04em`
- Body-s dense: 13px / 18 / 400 (segmented controls, form hints)
- Tabular-nums on row counts, all numeric metadata

### Spacing (4px grid)
- Page padding: 32px
- Card header: 14px/20px vertical, 20px horizontal
- Card body gap: 20px between fields
- Field label → control gap: 6px
- Date row column gap: 12px
- Integrity band: 14px/20px
- Result body: 16px/20px
- Bounds note: 10px/12px
- Segmented control tray padding: 3px; button padding: 7px/16px

### Shape
- Cards, buttons: `--radius-md` (8px)
- Inputs, small panels: `--radius-sm` (6px)
- Segmented control tray: `--radius-md` (8px)
- Integrity icon circle, warn icon circle: `border-radius: 50%`
- Status pills, nav badge: `--radius-pill` (9999px)

### Elevation
- Cards: `--shadow-xs` + 1px `--border` (borders-first per DESIGN-SYSTEM §5)
- No heavy drop shadows

### Icons (lucide-react, outline, 1.5px stroke, real names only)
- `file-down` — card header
- `download` — CTA button + download link
- `shield-check` — integrity verified band + sidebar Compliance item
- `alert-triangle` — truncation warning + error panel
- `info` — bounds note
- `loader` — spinner (generating state)
- `file-text` — empty state
- `layout-dashboard`, `briefcase`, `database`, `users`, `settings` — sidebar nav (matching §10 canonical set)
- `network` — logomark
- `search`, `bell` — topbar actions

---

## Accessibility treatment

### Segmented controls (scope + format pickers)
- Container: `role="group"` + `aria-labelledby` pointing to the visible field label
- Each button: `role="radio"` + `aria-checked="true/false"`
- Arrow-key navigation implemented in the JS scaffold: ArrowRight/Left/Up/Down moves focus; Enter/Space selects
- Focus ring: 2px solid `--emerald-600`, offset 2px

### Date inputs
- Each `<input type="date">` has a corresponding `<label>` via `for`/`id` pairing
- Both inputs share `aria-describedby="date-hint"` pointing at the bounds note
- Disabled state during generating: `disabled` attribute (not `aria-disabled`) for true form control disablement

### Integrity indicator
- NOT color-only: ShieldCheck icon (visible shape) + "Integrity verified" text (visible label) + sub-label describing mechanism
- Emerald band is the visual differentiator; the text makes it machine-readable
- Container has `role="status"` with an off-screen `<span>` for screen-reader announcement on state arrival

### Truncation warning
- `role="alert"` + `aria-live="assertive"` — announces immediately when truncation state renders
- AlertTriangle icon (shape) + "Partial export" heading text + count copy — NOT color-only (amber is a redundant cue, not the sole signal)

### Export CTA loading state
- `aria-busy="true"` + `aria-disabled="true"` + updated `aria-label="Generating export, please wait"` — communicates the async state to assistive technology
- Spinner is `aria-hidden="true"` (decorative)

### Result panel transition
- Container: `aria-live="polite"` + `aria-atomic="true"` — announces the full result block when it populates after generating
- Error panel: `role="alert"` + `aria-live="assertive"` for urgent compliance failure surface

### General
- All icon SVGs: `aria-hidden="true"` — decorative; text labels carry the semantic meaning
- Skip-link (production implementation): `<a href="#main-content">` should be added at shell level
- Focus order: natural DOM order throughout (no tab-index manipulation)
- Keyboard trap: none (no modals on this page)
- `prefers-reduced-motion`: all CSS transitions and spinner/shimmer animations disabled via media query

---

## Compliance-first emphasis: integrity + truncation

**Integrity band** is the primary differentiator of this export over a plain CSV dump. Design decisions made to reinforce it:
- Full-width emerald band at the top of the result panel — the first thing the eye lands on after export completes
- Circular icon container (32px, emerald-100 bg) gives the ShieldCheck visual weight proportional to its importance
- Sub-label "HMAC-SHA256 hash chain intact" is visible, not hidden in a tooltip — the mechanism is readable, building trust with compliance-savvy users
- The band appears even in the truncated state, making it clear the integrity claim covers exactly the rows in the file (not the full dataset)

**Truncation warning** is the compliance-honesty signal. Design decisions:
- `role="alert"` — never silent; screen readers announce it immediately
- Amber band with AlertTriangle icon — visually distinct from the emerald integrity band; the contrast is intentional (good = emerald, partial = amber)
- Copy is explicit: "50,000 of 183,492 rows" — never a vague "truncated"; gives the user the full picture so they can decide whether to narrow and re-export
- The download link remains available below the warning — blocking the download would be paternalistic; the warning is an honest disclosure, not a blocker
- The truncated row count in the metadata grid is rendered in `--status-warn` amber — reinforcing the warning without adding a separate element

**Result: a LIGHT posture** — no certification wizard, no attestation step, no multi-screen flow. One card, one CTA, one result panel. The compliance value is in the output artifact and its honest presentation, not in ceremony.

---

## Shell matching

Verified against existing pages:

| Element | This page | audit-log/page.tsx | settings/page.tsx |
|---|---|---|---|
| Page title size | 20px/600 | 20px/600 | 22px/600 |
| Subtitle color | `#6b7280` (--text-muted) | `#6b7280` | `#6b7280` |
| Card header bg | `--zinc-50` | `--zinc-50` (ExportPanel) | per section component |
| Card header border | 1px `--border` | 1px `#e5e7eb` | per section component |
| Card body padding | 24px | 20px | per section component |
| Input border | `--border-strong` (zinc-300) | `#d1d5db` | — |
| Focus ring | `0 0 0 3px rgba(16,185,129,0.4)` | `0 0 0 2px rgb(16 185 129 / 0.4)` | — |
| CTA bg | `#10B981` hover `#047857` | `#10b981` hover `#047857` | — |
| Max-width | 720px | 900px (wider — includes table) | 1200px (includes suppression matrix) |
| Shell (sidebar + topbar) | canonical §10 | canonical §10 | canonical §10 |

Minor divergence: `max-width: 720px` (narrower than audit-log's 900px) because this is a form-and-result page with no data table; the narrower width improves readability and puts the form controls at a comfortable line length.

---

## Out of scope (confirmed per D-1 brief)

- Retention configuration
- Records view / audit log table (covered by `/compliance/audit-log`)
- Certification / attestation wizard UI
- Mandate-scoped UUID filter (present in ExportPanel but excluded from this standalone page — the export page is firm-wide; mandate scoping is the audit-log panel's responsibility)
- Dark mode (deferred, light is canonical per DESIGN-SYSTEM §1)
