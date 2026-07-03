# T-6 Layout — wave-5 compliance-settings visual baseline

**Spec file:** `apps/web/e2e/t6-compliance-settings-layout.spec.ts`
**Baseline screenshot:** `apps/web/e2e/__screenshots__/compliance-settings.png`
**Assessment sources:** `design/compliance-settings.html` + DESIGN-SYSTEM §10
**Browser:** chromium-1208 (Playwright 1.61.1)
**Run date:** 2026-07-03
**Verdict: PASS with 3 visual notes**

---

## Assessment — render vs. design

### AppShell chrome (§10)

| Token | Expected | Observed | Result |
|---|---|---|---|
| Sidebar width | ~256px (w-64) | Bounding box 240–280px asserted and passed | PASS |
| Sidebar bg | `rgb(17, 24, 39)` (zinc-900) | Computed style asserted as `rgb(17, 24, 39)` | PASS |
| Sidebar wordmark | "DealFlow AI" text + icon | Visible: emerald-colored icon + "DealFlow AI" wordmark | PASS |
| TopBar height | ~64px (h-16) | Bounding box 60–72px asserted and passed | PASS |
| TopBar bg | `rgb(255, 255, 255)` (white) | Computed style asserted as `rgb(255, 255, 255)` | PASS |
| Compliance user nav items | Dashboard, Compliance, Audit Log, Rules | All 4 visible in sidebar | PASS |
| Sidebar footer | User email + role | `e2e+t6-settings+...@example.com` + "Compliance" label visible | PASS |

### Page layout vs. design/compliance-settings.html

**The design specifies:**
- Page heading: "Compliance Rules Engine" (h1/h2, text-2xl, zinc-900)
- Subtitle: "Manage suppression logic, jurisdictional disclaimers, and send-time approval policies."
- Section 1: "Approval & Gating Policy" (full-width card, emerald shield icon, radio group for 3 policy modes)
- Section 2: "Suppression Matrix" (left bento column, table or empty state, Add Entry CTA)
- Section 3: "Jurisdiction Templates" (right bento column, jurisdiction select + editor)

**Observed in screenshot:**

Section 1 — Approval & Gating Policy:
- Heading "Approval & Gating Policy" visible with "0 rules" count badge.
- "Add Rule" CTA button present, emerald bg, correct position.
- Empty state renders: shield icon (muted zinc) + "No rules configured" + subtitle.
- Design showed a 3-radio-card policy selector (No Gating / Threshold Trigger / Absolute Gating). The live implementation uses a rule-list/CRUD approach instead of radio cards.

Section 2 — Suppression Matrix:
- Heading "Suppression Matrix" visible with "0 entries" count badge.
- "Add Entry" button: emerald bg, correct position (header right).
- Empty state: file-list icon + "No entries found" + "Add entities to start blocking outreach." + "Add First Entry" ghost button.
- Bento grid layout: left ~2/3 column, correct.

Section 3 — Jurisdiction Templates:
- Heading "Jurisdiction Templates" visible with "Auto-sync" green pill badge.
- "New Jurisdiction" ghost button visible (zinc border, white bg, dark text — not emerald primary; correct for secondary action per §8).
- Empty state: document icon + "No disclaimer templates yet. Add a jurisdiction to get started."
- Bento grid: right ~1/3 column, correct.

### Palette assessment

| Check | Expected | Observed | Result |
|---|---|---|---|
| Primary CTA bg | emerald-600 (#10b981) | "Add Rule" + "Add Entry" buttons: emerald bg confirmed by computed style assertion | PASS |
| Section card bg | white (#ffffff) | All 3 sections: computed style asserted as rgb(255,255,255) | PASS |
| No Phosphor icons | 0 ph-* elements | Count assertion: 0 | PASS |
| Zinc/emerald palette only | No indigo/sky/purple/rose/orange | No off-palette colors visible in screenshot | PASS |

### Lucide icon check

| Icon | Location | Observed | Expected (design + §7) |
|---|---|---|---|
| Logo/network icon | Sidebar header | Emerald icon visible (custom SVG — matches emerald-600 logomark) | PASS |
| Shield icon | Sidebar Compliance link | Visible | PASS |
| Scroll icon | Sidebar Audit Log link | Visible | PASS |
| Sliders icon | Sidebar Rules link | Visible (NAV_COMPLIANCE_SETTINGS icon: 'sliders') | PASS |
| Shield-check icon | Approval & Gating section icon | Emerald icon visible in section header | PASS |
| + icon | Add Rule / Add Entry buttons | Plus-icon SVG inline | PASS |

No Phosphor icons (ph-* class) detected. All icons are lucide inline SVG per §10.

---

## Visual notes (non-blocking)

### V-NOTE-1: Approval & Gating section — implementation diverges from design radio-card pattern

**Design (compliance-settings.html):** Three radio-card policy choices: "No Gating" / "Threshold Trigger" / "Absolute Gating" with per-option parameter sub-forms.

**Live implementation:** CRUD rule list (add/toggle/delete individual rules of type approval_required, blocklist_check, etc.). Empty state: "No rules configured / Add a rule to start gating outreach campaigns."

**Assessment:** The live UI is a more general-purpose rules CRUD panel vs. the design's opinionated 3-option radio UI. This is a product-level design decision (the wave-5 spec chose a CRUD approach). Not a visual regression — the section matches the §10 surface contract (white bg, zinc border, emerald CTA, lucide icons). Decision recorded; no defect.

### V-NOTE-2: TopBar breadcrumb shows "Dashboard" not "Compliance Settings"

**Observed:** TopBar heading reads "Dashboard" — not a breadcrumb for the current page "Compliance Settings."

**Design (compliance-settings.html):** TopBar breadcrumb: "Governance / Compliance Settings".

**Assessment:** The TopBar is implemented as a shared AppShell component that shows the active page title from the route. The `/compliance/settings` route may not be passing a page title to the TopBar, causing it to fall back to the default "Dashboard" label. This is a minor cosmetic gap — the content area correctly shows "Compliance Rules Engine" heading. No functionality is impacted. Route to B for a one-line fix (set page title for the settings route).

**Severity:** Low. Visual defect, not a functional or security defect.

### V-NOTE-3: "Add First Entry" ghost button in Suppression empty state

**Observed:** Suppression Matrix empty state shows two buttons: "Add Entry" (emerald, in header) and "Add First Entry" (ghost, in empty state body). The design shows only one CTA.

**Assessment:** This is an intentional UX pattern (primary CTA in header + secondary empty-state prompt). The ghost button styling (`BTN_GHOST`: white bg, zinc border, zinc text) matches §8 "secondary" button pattern. Not a defect.

---

## Summary

**T-6 PASS** — `/compliance/settings` renders per §10 chrome contract and aligns with the design's 3-section structure. All computed style assertions passed (sidebar zinc-900, TopBar white, section cards white, CTA emerald-600). No off-palette colors, no Phosphor icons.

3 visual notes, all non-blocking:
- V-NOTE-1: Approval section uses rule-CRUD vs design's radio-card UX (product decision).
- V-NOTE-2: TopBar shows "Dashboard" instead of "Compliance Settings" breadcrumb (minor cosmetic gap — route to B).
- V-NOTE-3: Double empty-state CTA in Suppression Matrix (intentional UX pattern, not a defect).

**Baseline path:** `apps/web/e2e/__screenshots__/compliance-settings.png`
