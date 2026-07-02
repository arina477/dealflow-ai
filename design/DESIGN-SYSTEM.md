# Design System — DealFlow AI

Canonical design tokens + component primitives. All `design/*.html` mockups and all frontend code consume from this file. Built v8 from the approved direction (`design/direction.html`) + locked module list (`command-center/dev/module-list.md`).

Visual references: `design/direction.html` (canonical direction, dashboard) and `design/staging/design-system.html` (primitives showcase).

Aesthetic: light-mode, restrained, credible "Linear/Stripe" feel for a regulated M&A data tool. Neutral zinc/grey scale + emerald accent. Subtle borders over heavy shadows. Tabular numerals for all financial/numeric data.

---

## 1. Color palette

### Primitive — neutral (zinc/grey scale)
| Token | Hex | Use |
|---|---|---|
| `--zinc-25` | `#FCFCFD` | app background (lightest) |
| `--zinc-50` | `#F9FAFB` | subtle panel / hover bg |
| `--zinc-100` | `#F3F4F6` | muted fill / table stripe |
| `--zinc-200` | `#E5E7EB` | default border / divider |
| `--zinc-300` | `#D1D5DB` | strong border / disabled border |
| `--zinc-400` | `#9CA3AF` | placeholder / muted icon |
| `--zinc-500` | `#6B7280` | secondary text / labels |
| `--zinc-600` | `#4B5563` | body text (secondary emphasis) |
| `--zinc-700` | `#374151` | body text (primary) |
| `--zinc-800` | `#1F2937` | headings |
| `--zinc-900` | `#111827` | strongest text / sidebar |
| `--zinc-950` | `#030712` | max-contrast / overlays |

### Primitive — accent (emerald)
| Token | Hex | Use |
|---|---|---|
| `--emerald-50` | `#ECFDF5` | success/positive bg tint |
| `--emerald-600` | `#10B981` | primary accent / positive / CTA |
| `--emerald-700` | `#047857` | accent hover / strong positive |

### Status colors (this product is status-heavy)
| Token | Base | Meaning |
|---|---|---|
| `--status-positive` | emerald-600 | replied / approved / verified / good-fit |
| `--status-info` | `#2563EB` (blue-600) | sent / contacted / in-progress |
| `--status-warn` | `#D97706` (amber-600) | pending / opened / needs-review |
| `--status-danger` | `#DC2626` (red-600) | bounced / rejected / failed compliance |
| `--status-neutral` | zinc-400 | shortlisted / draft / idle |

### Semantic mappings
- `--bg-app` = zinc-25 · `--bg-surface` = `#FFFFFF` · `--bg-muted` = zinc-50 · `--bg-sidebar` = zinc-900
- `--border` = zinc-200 · `--border-strong` = zinc-300
- `--text-primary` = zinc-800 · `--text-body` = zinc-700 · `--text-muted` = zinc-500 · `--text-on-dark` = zinc-50
- `--primary` = emerald-600 · `--primary-hover` = emerald-700 · `--focus-ring` = emerald-600 @ 40%

> Tokens are authored so a future **dark mode** maps by inverting the zinc scale + keeping emerald; deferred (light is canonical).

---

## 2. Typography

- **Families:** UI = `Inter, ui-sans-serif, system-ui, sans-serif`. Numeric/financial data = same family with `font-variant-numeric: tabular-nums` (REQUIRED for tables, fit scores, metrics, audit timestamps).
- **Scale:**
| Role | Size / line-height / weight | Notes |
|---|---|---|
| Display | 30px / 36 / 700 | big metrics (e.g. dashboard counts) |
| H1 | 24px / 32 / 600 | page title |
| H2 | 20px / 28 / 600 | section title |
| H3 | 16px / 24 / 600 | card title |
| Body-m | 14px / 20 / 400 | default body |
| Body-s | 13px / 18 / 400 | dense table cells |
| Label | 12px / 16 / 600, `letter-spacing: 0.04em`, UPPERCASE | section eyebrows / column labels |
| Mono-num | tabular-nums on Body-m/s | all financial figures |

---

## 3. Spacing scale
Base unit 4px. Scale: `0, 1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=48, 16=64`. Card padding default 16–24px; page gutter 24–32px; table row vertical padding 8–12px (dense).

---

## 4. Shape / clip-path / radius
- `--radius-sm` 6px (inputs, badges) · `--radius-md` 8px (buttons, cards) · `--radius-lg` 12px (modals, large cards) · `--radius-pill` 9999px (pills/avatars) · `--radius-full` 50% (avatar/dot).
- No decorative clip-paths — restraint is the brand.

---

## 5. Elevation / shadow
Borders-first; shadows are subtle.
- `--shadow-xs` `0 1px 2px rgb(16 24 40 / 0.05)` (cards, badges)
- `--shadow-sm` `0 1px 3px rgb(16 24 40 / 0.08)` (hover lift, dropdowns)
- `--shadow-md` `0 8px 24px rgb(16 24 40 / 0.12)` (modals, popovers)
- Default panels use a 1px `--border` instead of shadow.

---

## 6. Motion / transitions
- `--anim-speed` `0.6s` (page/section reveals) · interactive `150ms` (hover/focus) · `--anim-ease` `cubic-bezier(0.16, 1, 0.3, 1)`.
- Respect `prefers-reduced-motion` (disable non-essential transitions).

---

## 7. Iconography
- Library: **lucide-react** (outline, 1.5px stroke). Sizes 16/20/24. Color inherits `currentColor` (default `--text-muted`).
- Common: `LayoutDashboard`, `Briefcase` (mandates), `Sparkles`/`Target` (matches), `Send` (outreach), `ShieldCheck` (compliance), `GitBranch`/`Kanban` (pipeline), `Database` (sourcing), `Users`, `Settings`, `FileCheck` (audit), `AlertTriangle` (errors). Use real lucide names only — never invent.

---

## 8. Component primitives

Each primitive: consumed tokens · states · a11y · usage. Visual reference: `design/staging/design-system.html`.

### Standard
- **Button** — variants: primary (`--primary` bg, white text), secondary (surface bg + `--border`), ghost (transparent), destructive (`--status-danger`). Sizes sm/md/lg. States: default/hover(`--primary-hover`)/active/disabled(zinc-300)/loading(spinner). A11y: real `<button>`, visible `--focus-ring`, `aria-busy` when loading. Use primary for the single main action per view.
- **Input / Select / Textarea** — `--radius-sm`, `--border`, focus → `--focus-ring`. States: default/focus/disabled/error(`--status-danger` border + helper text). A11y: `<label>` association, `aria-invalid`, `aria-describedby` for errors.
- **Card** — surface bg + `--border` + `--radius-md` + `--shadow-xs`. Interactive variant adds hover `--shadow-sm`. Title = H3.
- **Modal / Drawer** — overlay zinc-950 @ 50%; panel `--radius-lg` + `--shadow-md`. A11y: focus-trap, `Esc` closes, `role="dialog"` + `aria-modal`, return focus on close.
- **Toast / inline alert** — variants info/positive/warn/danger using status colors + tinted bg. Toasts auto-dismiss (≥5s); compliance blocks are persistent inline alerts (do not auto-dismiss). A11y: `role="status"`/`role="alert"`.
- **Data Table** — sortable header (Label type, sort caret), zebra `--zinc-50` optional, row hover `--zinc-50`, dense padding. Numeric cells tabular-nums right-aligned. States: loading skeleton rows / empty / error. A11y: `<table>` semantics, sortable headers `aria-sort`.
- **Navigation** — left **sidebar** (`--bg-sidebar` zinc-900, `--text-on-dark`, emerald active indicator) + top bar (breadcrumb + search + user). Active item: emerald left-border + brighter text.
- **Badge / Tag / Pill** — `--radius-pill`, Label type. Color by status token. See StatusBadge below for the product set.
- **Tabs** — underline style; active = `--text-primary` + emerald underline; inactive = `--text-muted`. A11y: `role="tablist"`, arrow-key nav.
- **Avatar** — `--radius-full`, initials fallback on zinc-100.
- **Tooltip / Popover** — `--shadow-md`, small Body-s text; popover for richer content (e.g. match rationale). A11y: `aria-describedby` (tooltip), focus management (popover).
- **Empty / Loading / Error states** — empty: icon + one-line + primary CTA. Loading: skeleton blocks (zinc-100 shimmer). Error: `AlertTriangle` + message + retry. Every list/table/page must implement all three.

### DealFlow-specific
- **MatchCard / RankedMatchRow** — buyer firm + numeric **FitScore** + short "why ranked" rationale + accept/reject/flag actions. FitScore badge color-graded (≥80 emerald, 60–79 amber, <60 zinc). Rationale opens in a popover. Tokens: status colors, tabular-nums. Use on Matches & shortlist screen.
- **FitScore indicator** — 0–100, tabular-nums, color band per above; never invent precision beyond integer.
- **StatusBadge set** — outreach: Sent(info)/Opened(warn)/Replied(positive)/Bounced(danger); pipeline: Shortlisted(neutral)/Contacted(info)/Engaged(info)/Diligence(warn)/Offer(positive)/Closed(positive)/Withdrawn(neutral); compliance: Pending(warn)/Approved(positive)/Rejected(danger). One canonical color per state — never re-map.
- **ComplianceCheckPanel** — list of pre-send checks (disclaimer present, suppression honored, recordkeeping enabled) each pass(positive ✓)/fail(danger ✗ + reason). When any check fails, the panel disables the Send button and shows a persistent inline danger alert. Core compliance-wedge UI.
- **AuditLogRow** — immutable entry: timestamp (tabular-nums) · actor + role · action · subject · content-hash (truncated, copyable) · **integrity indicator** (emerald `ShieldCheck` "verified" / red if chain broken). Read-only; never an edit affordance.
- **MandateCard** — seller/target name + stage chip + mini-stats (buyers matched, outreach sent, compliance status). Interactive card → mandate detail.

---

## 9. Responsive
Desktop-first internal tool.
| Breakpoint | Width | Behavior |
|---|---|---|
| 2xl | ≥1536 | full layout, sidebar expanded |
| xl | 1280–1535 | **primary target** — full layout |
| lg | 1024–1279 | sidebar collapsible to icons; tables horizontal-scroll |
| md / sm | <1024 | **degraded** (secondary) — stacked cards, sidebar → drawer; not phone-first |

Mobile is intentionally low-priority (advisors work at desks); ensure no breakage, not polish.

---

## 10. Canonical app chrome (cross-page consistency contract)

Every authed page (everything except `login` / `accept-invite` / `reset-password`) MUST render the SAME shell. In B-block this is implemented ONCE as shared components (`<AppShell>` → `<Sidebar>` + `<TopBar>`), never re-built per page. The v9 mockups are per-page layout/content specs; this section is the authority for the shared chrome.

### Sidebar (left, `w-64`, `bg-zinc-900`, `text-zinc-50`)
- **Logomark:** emerald-600 rounded square with the lucide `network` icon + "DealFlow AI" wordmark. ONE logomark everywhere.
- **Items (this exact set + order):** group **Workspace** → Dashboard (`layout-dashboard`), Mandates (`briefcase`), Sourcing (`database`), Compliance (`shield-check`, with a pending-count badge); group **Config** → Team (`users`), Settings (`settings`).
- **Active item:** `bg-zinc-800` + emerald-600 left rail (`before:` bar) + `text-emerald-500` icon.
- **Footer:** user button (avatar initials + name + role).
- Compliance, Audit log, Suppression rules etc. live UNDER the Compliance section (sub-nav within the Compliance area), not as new top-level sidebar items.

### Top bar (`h-16`, white, sticky, `border-b border-zinc-200`)
- Breadcrumb / page title (left) · search + notifications + user (right).

### Auth pages
- No sidebar. Centered/split-screen card treatment; emerald-600 primary; Inter; no app chrome.

### Hard rules (enforced in code; mockups should follow but code is source of truth)
- **Icons: lucide ONLY** (`data-lucide` in mockups, `lucide-react` in code). Never Phosphor or hand-coded SVG icon sets.
- **Primary CTA: `bg-emerald-600 hover:bg-emerald-700`** — never zinc/dark as the primary color.
- **Palette: zinc + emerald + the 5 status tokens only.** No indigo / sky / purple / rose / orange.
- **Mono face** (`JetBrains Mono` or system `font-mono`) is permitted ONLY for cryptographic hashes (audit-log content-hash); documented here so it's not treated as drift.

> v9 note: the 20 onboarding mockups were generated page-independently and carry minor chrome drift (mixed icon libraries, per-page nav-label variation, a few off-palette accents). The egregious structural cases were regenerated against this canonical shell; remaining minor drift is accepted as directional — true consistency is enforced at build time by the shared `<AppShell>` + this contract. See product-decisions.md.
