# D-3 Review & Adopt — Wave 27: firm-admin recordkeeping EXPORT page

**Stage:** D-3 (block-exit gate)
**Artifact under review:** `design/staging/recordkeeping-export.html` (D-2 variant)
**Route:** `/compliance/export` · **RBAC:** compliance + admin only
**Gate agent:** head-designer (fresh spawn)
**Verdict:** **APPROVED** — adopted for B-3 build.

---

## Stage-entry

```json
{
  "agent": "head-designer",
  "stage": "D-3",
  "status": "gating",
  "block_state": { "design_gap_flag": "recordkeeping-export", "adopted_designs": [], "reviewer_verdicts": {}, "escalation_log": [] }
}
```

---

## Gate checklist (7 dimensions from the D-3 charge)

### 1. Design-system token discipline — PASS
- **Palette:** zinc/emerald + the 3 authorized status tokens (`--status-warn` amber `#D97706`, `--status-danger` red `#DC2626`) only. Zero indigo/sky/purple/rose/orange. Verified against DESIGN-SYSTEM §1.
- **Emerald primitives** (`#ECFDF5` / `#D1FAE5` / `#10B981` / `#047857`) map 1:1 to `--emerald-50/100/600/700`.
- **Derived text shades** `#059669` (integrity sub), `#92400E`/`#78350F` (truncation copy), `#991B1B`/`#B91C1C` (error copy) are NOT primitive tokens BUT are the exact shades the **already-shipped, prior-gate-approved** `IntegrityBadge.tsx` uses for the identical integrity/amber/danger text roles. Established derived-shade precedent, not drift. B-3 should consume the same values.
- **Icons:** all provenance-commented lucide names (`file-down`, `download`, `shield-check`, `alert-triangle`, `info`, `loader`, `file-text`, sidebar set, `network`). Hand-coded inline SVG matches the house convention — shipped `ExportPanel.tsx`/`IntegrityBadge.tsx` use byte-identical inline lucide path data. B-3 renders via `lucide-react` per §10 code rule.
- **4px grid:** all padding/margin on the scale (32/24/20/16/14/12/10/8/6/3px). No arbitrary/fractional values.
- **One primary CTA:** exactly one emerald `.btn-primary` ("Export") per view; download link and retry are correctly subordinated (outline/ghost tint, not primary emerald fill).

### 2. Shell consistency — PASS
- Canonical AppShell: `w-256` (256px) zinc-900 sidebar with the exact §10 nav set + order (Dashboard/Mandates/Sourcing/Compliance[badge] · Team/Settings), emerald active left-rail on Compliance, network logomark, user footer. `h-64` (64px) white sticky topbar with breadcrumb + search + bell.
- Breadcrumb `Compliance / Export records` correctly places the page UNDER the Compliance area (not a new top-level item) per §10.
- Card header bg `--zinc-50`, 1px `--border`, `--shadow-xs`, H2 20px/600 title — matches `audit-log/page.tsx` geometry. `max-width: 720px` (vs 900px audit-log) is a justified narrowing (form-and-result, no data table). Not a divergent layout.

### 3. Accessibility (WCAG 2.2) — PASS
- **Keyboard:** segmented controls implement arrow-key roving focus + Enter/Space select; all controls are real `<button>`/`<input>`; natural DOM focus order; NO modal → no keyboard trap possible on this page.
- **Focus-visible:** `:focus-visible` 2px emerald outline (offset 2px) on nav/seg/download/retry; 3px `--focus-ring` box-shadow on inputs + primary CTA. Never `outline:none` without a replacement ring.
- **Not color-only:** integrity band = ShieldCheck icon + "Integrity verified" text + mechanism sub-label. Truncation = AlertTriangle icon + "Partial export" heading + "50,000 of 183,492 rows" count copy. Amber/emerald are redundant cues. PASS on the SC 1.4.1 mandate.
- **ARIA — segmented controls:** `role="group"` + `aria-labelledby` on container; `role="radio"` + `aria-checked` per button. (Minor B-3 note below.)
- **ARIA — result status:** generating panel `role="status"` `aria-live="polite"`; success `aria-live="polite"` `aria-atomic`; truncation `role="alert"` `aria-live="assertive"`; error `role="alert"` `aria-live="assertive"`. Correct urgency mapping.
- **Labeled controls:** both date inputs `<label for>`-paired + shared `aria-describedby="date-hint"`; CTA `aria-label` swaps to "Generating export, please wait" + `aria-busy` on load.
- **prefers-reduced-motion:** spinner + shimmer + all transitions disabled via media query.

### 4. Compliance-first emphasis (the differentiator) — PASS
- **Integrity indicator prominent + trustworthy:** full-width emerald band at the TOP of the result panel (first fixation after export), 32px circular ShieldCheck, visible "HMAC-SHA256 hash chain intact" mechanism sub-label (not hidden in a tooltip). This reads as a verifiable export, not a plain dump. Matches the `IntegrityBadge` semantic contract.
- **Truncation warning honest + visible:** `role="alert"`, distinct amber band, explicit "50,000 of 183,492 rows" (never a vague "truncated" or a silent partial "complete" file), and the honesty clarifier "The integrity indicator above covers only the rows in this file." The integrity band persists in the truncated state, correctly scoping the claim to the file's rows. This is the compliance-honesty signal, correctly emphasized. Download remains available (honest disclosure, not paternalistic block).

### 5. One-primary-CTA hierarchy + states — PASS
- Single emerald primary CTA. All six required states present + visually distinct: idle / generating (disabled+spinner+skeleton) / success-verified / success-truncated / empty ("No records in this range" + guidance) / error (plain-language + Retry). No Happy-Path Mirage.

### 6. LIGHT posture — PASS
- One card, one CTA, one result panel. No certification wizard, no attestation step, no multi-screen progress flow, no signature/ceremony. Compliance value lives in the artifact + its honest presentation. Honors the founder's light steer.

### 7. Scope — PASS
- Export ONLY. No retention config, no records-view/audit-table, no mandate-scoped filter, no attestation UI. Out-of-scope items explicitly enumerated + excluded. No scope creep. M10 later-vertical boundaries respected.

---

## Anti-pattern sweep

| Pattern | Result |
|---|---|
| Happy-Path Mirage | CLEAR — all 6 states covered |
| Token Drift & Invention | CLEAR — derived text shades match shipped precedent |
| Chrome Violation | CLEAR — canonical AppShell, Frame untouched |
| Dismissible Compliance Alerts | CLEAR — truncation/error are persistent inline `role="alert"`, no auto-dismiss toast |
| Mutable Audit Trails | N/A — export page, no CRUD affordance |
| Dashboard Cacophony | CLEAR — one primary CTA |
| Proportional Finance Numerals | CLEAR — `tabular-nums` on all row counts + numeric metadata |
| Keyboard Trap | CLEAR — no modal on page |
| Invisible Focus States | CLEAR — documented focus rings on every interactive element |
| Icon Fragmentation | CLEAR — lucide-only, matches shipped house convention |
| RBAC Blindness | ADDRESSED at spec level (compliance+admin only, advisor/analyst 403); the page renders only for permitted roles — no restricted-role in-page degradation needed for a role-gated route |
| Redundant Entry Fatigue | N/A — single-step form |
| Non-compliant Drag-and-Drop | N/A — no DnD |
| Inconsistent Component Variants | CLEAR — composes card/button/input/segmented primitives; extends `ExportPanel`/`IntegrityBadge` conventions |

---

## Non-blocking notes for B-3 (nextjs-developer) — polish, NOT rework

1. **Segmented control ARIA idiom:** the mockup mixes `role="radio"` + `aria-checked` (radiogroup idiom) with an `aria-pressed` CSS selector (toggle idiom). In `lucide-react`/shadcn build, standardize on ONE: use `role="radiogroup"` on the container + `role="radio"` + `aria-checked` per option (drop the `aria-pressed` selector), OR a native `<fieldset>`+radio. Pick radiogroup for the mutually-exclusive scope/format pickers. Cosmetic in the mockup; must be clean in code.
2. **Skip-link:** the D-2 spec correctly notes `<a href="#main-content">` belongs at AppShell level (production). Confirm the shared `<AppShell>` already provides it; do not re-add per-page.
3. **Derived text shades:** consume `#059669` / `#92400E` / `#78350F` / `#991B1B` / `#B91C1C` from the shared integrity/alert helpers rather than re-hardcoding, so drift can't creep across pages.
4. **Result panel is post-CTA only** (not pre-rendered idle) per the D-2 layout intent — keep the page uncluttered at rest.

None of these block adoption; the design faithfully extends the AppShell chrome contract and the shipped compliance conventions.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: D-3
  reviewers: {}   # no specialist re-delegation required; artifact + shipped-precedent were sufficient to gate every checkbox
  failed_checks: []
  rationale: >
    The recordkeeping-export mockup passes all seven D-3 dimensions. Token discipline is clean
    (zinc/emerald + 3 status tokens, 4px grid, lucide-only, one emerald primary CTA); the derived
    text shades and inline-SVG icon convention match the already-gate-approved ExportPanel.tsx /
    IntegrityBadge.tsx precedent, so they are established convention rather than drift. Shell is the
    canonical AppShell (§10 sidebar+topbar, Compliance sub-nav placement, 720px form column).
    Accessibility meets WCAG 2.2: keyboard-operable roving segmented controls, no keyboard trap
    (no modal), visible focus rings everywhere, correctly-scoped aria-live/role=status/role=alert,
    labeled date inputs, prefers-reduced-motion, and — critically — the integrity badge AND truncation
    warning are icon+text (never color-only). The compliance differentiator is correctly emphasized:
    the HMAC-SHA256 integrity band is prominent and mechanism-legible, and the truncation warning is
    honest and visible ("50,000 of 183,492 rows", integrity scoped to the file's rows) — never a silent
    partial "complete" file. Posture is light (one card / one CTA / one result panel, no attestation
    ceremony), scope is export-only with M10 verticals correctly excluded, and all six states are
    covered. Four non-blocking B-3 polish notes recorded (standardize segmented-control ARIA idiom,
    AppShell skip-link, shared derived-shade helpers, post-CTA result panel) — none gate adoption.
  next_action: PROCEED_TO_B  # design adopted; B-3 nextjs-developer builds to design/staging/recordkeeping-export.html
```

---

## DESIGN-PRINCIPLES lineage (block-exit note)

Rejected/avoided approaches for this surface, for cross-wave memory:
- **Rejected:** blocking the download on truncation. Chosen: honest disclosure + available download (paternalistic gating fails the compliance-honesty goal without helping the user).
- **Rejected:** hiding the HMAC mechanism in a tooltip. Chosen: visible sub-label — mechanism legibility builds trust with compliance-savvy users and is cheap.
- **Trade-off:** 720px column (narrower than audit-log's 900px) accepted because this is a form-and-result page with no table; readability > shell-width uniformity.
- **Reasoning:** persisting the emerald integrity band INTO the truncated state (rather than swapping it for a warning-only band) is deliberate — it keeps the "integrity verified over exactly these rows" claim visually anchored, which the amber warning then honestly bounds.

(No new numbered principle promoted this wave — the above is descriptive lineage, not a `DESIGN-PRINCIPLES.md` rule append; L-2 owns any promotion under the Contract-for-new-rules format.)
