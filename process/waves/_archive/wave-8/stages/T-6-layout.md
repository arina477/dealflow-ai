# T-6 Visual Baseline — wave-8 mandate pages

**Browser:** chromium-1208 (Playwright 1.61.1)
**Target:** live deploy — web `https://dealflow-web-production-a4f7.up.railway.app`
**Spec file:** `apps/web/e2e/t6-mandates-layout.spec.ts`
**Design references:** `design/mandates-list.html`, `design/mandate-new.html`, `design/mandate-detail.html`, `design/DESIGN-SYSTEM.md §10`
**Run date:** 2026-07-04

---

## Summary

3 / 3 baseline tests pass. Baselines established for all three mandate pages. 2 visual defects noted.

---

## Baseline screenshots

| Page | File | Verdict |
|---|---|---|
| /mandates (list) | `apps/web/e2e/__screenshots__/t6-mandate-list.png` | PASS — renders per mandates-list.html |
| /mandates/new (create form) | `apps/web/e2e/__screenshots__/t6-mandate-new.png` | PASS — 3 sections + jurisdiction dropdown + 3 acks |
| /mandates/:id (detail, advisor) | `apps/web/e2e/__screenshots__/t6-mandate-detail.png` | PASS — seller name, status, compliance, deferred placeholders |

---

## Per-page visual assessment

### T-6-1: /mandates list page

**PASS**

- AppShell chrome: sidebar zinc-900 (#111827) width 240-280px. PASS.
- TopBar header: white background, height 60-72px. PASS.
- DealFlow AI wordmark in sidebar. PASS.
- Mandates nav link visible for advisor. PASS.
- H1 "Mandates" heading present. PASS.
- "Manage active engagements..." description text present. PASS.
- "New mandate" CTA button present (emerald primary action). PASS.
- Status filter segmented control (All/Draft/Active) visible. PASS.
- Mandates table with MANDATE/SELLER, DEAL TYPE, STATUS, CREATED columns renders. PASS (many rows visible from E2E test runs).
- No Phosphor icons. PASS.
- Palette: zinc + emerald. The emerald active status badges and "New mandate" button are emerald-600.

**Visual defect noted:**
- Content area computed background color is `rgba(0, 0, 0, 0)` (transparent), not zinc-25 (#fcfcfd). Non-fatal — the AppShell outer div sets `backgroundColor: '#fcfcfd'` but the `#main-content` element parent resolves to transparent. The visual result is correct (the AppShell background shows through), but the DOM computed value diverges from the design spec.

**TopBar title:** Shows "Dashboard" on /mandates. See FINDING-W8-4.

### T-6-2: /mandates/new create form

**PASS**

- AppShell chrome: sidebar zinc-900, TopBar white. PASS.
- H1 "Create Engagement". PASS.
- Breadcrumb "Mandates / New Mandate". PASS.
- Section 1 "Seller & Target Profile" with: Company Name input, Industry/Sector select, Seller Geography tag input, Company Size radio pills (< $10M / $10M–$50M / $50M–$250M / $250M–$1B / $1B+), Deal Type select, Executive Snippet textarea. PASS.
- Section 2 "Buyer Universe Criteria" with: Buyer Industry, Buyer Geography, Buyer Size Band, Buyer Deal Type. PASS.
- Section 3 "Compliance Guardrails" with: captured-not-enforced amber notice, Legal Jurisdiction dropdown, Suppression List tag input, Required Acknowledgments fieldset with 3 checkboxes. PASS.
- Jurisdiction dropdown shows "Select jurisdiction..." placeholder, populated with US option. PASS.
- 3 acks unchecked by default. PASS.
- "Create Mandate" submit button with emerald-600 background. PASS.
- "Cancel" secondary button present. PASS.
- No Phosphor icons. PASS.

**Visual assessment vs design/mandate-new.html:**
- Layout matches: 3 numbered SectionCard sections, form fields match design spec.
- Size band radio pills render correctly (visual selection highlight in emerald when selected).
- The compliance amber notice banner ("Compliance information captured here") renders per design.

**TopBar title:** Shows "Dashboard" on /mandates/new. See FINDING-W8-4.

### T-6-3: /mandates/:id detail page (advisor, draft mandate)

**PASS**

- AppShell chrome: sidebar zinc-900, TopBar white. PASS.
- H1: seller name in zinc-900 (#111827), 24px bold. PASS.
- Status badge: "DRAFT" with zinc pill (text-transform uppercase). PASS.
- "Created Jul 4, 2026" date present. PASS.
- "Configure" button visible (advisor, draft mandate). PASS.
- SELLER & TARGET PROFILE section: Company, Industry, Regions, Size Band, Deal Type DetailRow grid. PASS.
- BUYER UNIVERSE CRITERIA section: Industry, Geography, Size Band, Deal Type DetailRow grid. PASS.
- COMPLIANCE PROFILE section: shield icon, "Captured for the compliance gate" subline, Jurisdiction=US, Disclaimer Template ID (`fe1c504d-3353-461d-9470-63b29d3c7985` in monospace), Suppression Scope, 3 Acknowledgments with emerald checkmarks. PASS.
- AI SOURCING CANVAS section (D6): 3 deferred placeholders — Buyer Engine, Ranked Candidates, Pipeline — each with a styled card, icon, title, and description. PASS.
- No Phosphor icons. PASS.
- Disclaimer template ID is non-empty (server-side derivation from jurisdiction=US worked). PASS.

**Visual defect noted:**
- TopBar shows "Dashboard" on /mandates/:id. Recurring defect from prior waves.

---

## Visual defects

### VD-1 — TopBar title shows "Dashboard" on all mandate pages (FINDING-W8-4)

TopBar renders "Dashboard" as its title text on /mandates, /mandates/new, and /mandates/:id. The design intent (per design/mandates-list.html, design/mandate-new.html, design/mandate-detail.html) is for the TopBar to show the current page name. This is a recurring defect from waves 3 and 4.

**Impact:** Visual-only; no functional impact.
**Severity:** Low. Routes to B-block.

### VD-2 — Content area background computed as transparent on /mandates

The `#main-content` element's computed `backgroundColor` is `rgba(0, 0, 0, 0)`. The AppShell outer wrapper sets `backgroundColor: '#fcfcfd'` (zinc-25), which shows through visually and matches the design. However the computed value on the direct parent of the main content area is transparent, not zinc-25. The visual result is correct.

**Impact:** Non-functional. Background color is correct visually.
**Severity:** Very low.

---

## Palette conformance

- Sidebar: zinc-900 (`rgb(17, 24, 39)`). PASS.
- Status badges: emerald (`rgb(16, 185, 129)`) for active, zinc for draft. PASS.
- Primary CTA buttons: emerald-600. PASS.
- No indigo / sky / purple / rose / orange observed. PASS.
- No Phosphor icons on any page. PASS.
- Lucide icons observed: Briefcase (Mandates nav), ShieldCheck (Compliance nav), LayoutDashboard (Dashboard nav), lock icon (Configure/Locked), edit icon (Configure button). PASS.

---

## Execution details

- Tests: 3/3 PASS
- Chromium: 1208 (Playwright 1.61.1)
- Screenshots saved to `apps/web/e2e/__screenshots__/` (t6-mandate-list.png, t6-mandate-new.png, t6-mandate-detail.png)
