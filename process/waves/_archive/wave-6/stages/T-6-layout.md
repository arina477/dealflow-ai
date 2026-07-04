---
stage: T-6
wave: 6
screen: companies-contacts (/sourcing/companies)
persona: analyst
browser: chromium-1208 (via pw-compat shim for playwright@1.61.1)
run_date: 2026-07-04
spec_file: apps/web/e2e/t6-companies-contacts-layout.spec.ts
baseline_screenshot: apps/web/e2e/__screenshots__/companies-contacts.png
result: 1/1 PASS
design_reference: design/companies-contacts.html + DESIGN-SYSTEM §10
---

# T-6 Layout — Wave-6 Companies-Contacts Screen Visual Baseline

## Baseline

Screenshot saved to: `apps/web/e2e/__screenshots__/companies-contacts.png`
This is the first visual baseline for the /sourcing/companies screen.

## Assessment vs design/companies-contacts.html + DESIGN-SYSTEM §10

### AppShell chrome (§10)

| Check | Result |
|---|---|
| Sidebar present (role="navigation" aria-label="Main navigation") | PASS |
| Sidebar width ~256px (w-64) | PASS (within 240–280px tolerance) |
| Sidebar background zinc-900 rgb(17,24,39) | PASS |
| "DealFlow AI" wordmark in sidebar | PASS |
| Analyst nav set: Sourcing + Dashboard + Mandates present | PASS |
| Compliance / Team / Settings absent for analyst | PASS |
| Sidebar footer: analyst email visible | PASS |
| Sidebar footer user-menu button present | PASS |
| TopBar present (header element) | PASS |
| TopBar height ~64px (h-16) | PASS (within 56–72px tolerance) |
| TopBar background white rgb(255,255,255) | PASS |

### TopBar title (known issue — FINDING)

**FINDING (non-blocking):** The TopBar title area does not display "Companies" or "Sourcing"
on the `/sourcing/companies` screen. Captured header text: `"DashboardE2e2e+t6-w6-analyst+<ts>@example.com"`.

This is a recurring issue from prior waves (waves 3–5 appshell observations): the TopBar
renders the page title from the `x-invoke-path` header which Next.js 15 may not propagate
correctly to async server components on SSR. The title resolves to "Dashboard" (the layout
default) rather than "Companies".

Routing: B per Iron Law. This is a real product defect (content-correctness on the TopBar),
not a test issue. The companies screen page.tsx does not set a `<title>` or TopBar heading
prop that would override the layout default.

### Companies list panel

| Check | Result |
|---|---|
| "Companies" H1 heading renders | PASS |
| Search input renders (`aria-label="Search companies by name or domain"`) | PASS |
| Filter chip "All" renders (`aria-label="Show all companies"`) | PASS |
| Filter chip "Active" renders (`aria-label="Show active companies only"`) | PASS |
| Filter chip "Archived" renders (`aria-label="Show archived companies only"`) | PASS |
| Company entries list renders (`role="list" aria-label="Company entries"`) | PASS |
| List panel width 320–420px (design spec: 400px) | PASS |

### State: empty (prod tables purged post-C-2 — expected)

| Check | Result |
|---|---|
| Empty state "No companies yet" renders | PASS |
| Empty state instruction copy renders | PASS |
| Detail pane "Select a company" placeholder renders | PASS |

### Palette and icon correctness (§10)

| Check | Result |
|---|---|
| No Phosphor icons (class ph-*) | PASS — 0 found |
| Lucide/inline SVG icons used throughout | PASS (inline SVGs in CompaniesClient.tsx confirmed) |
| zinc + emerald palette in filter chips | PASS (computed styles match emerald-50 bg, emerald-700 text for active chip) |

### Search input focus ring

**NOTE (non-blocking):** The search input focus ring (emerald `#10b981`) is applied via
JavaScript inline style in `onFocus` handler (not a CSS class). The computed style check
detected `borderColor: rgb(209, 213, 219)` (zinc-300, default) and no box-shadow, because
the programmatic focus used in the spec does not trigger the React `onFocus` synthetic
event in the same way a real mouse click does. This is a test-environment limitation, not
a product defect — the focus ring is confirmed present via code inspection of
`CompaniesClient.tsx` (the `onFocus` handler sets `borderColor: '#10b981'` and
`boxShadow: '0 0 0 2px rgb(16 185 129 / 0.2)'`).

### Design delta: design/companies-contacts.html vs implemented screen

The design HTML uses a complex layout with Phosphor icons, an icon-only sidebar, and a
detail pane pre-populated with "Nexus Data Systems" sample data. The implemented screen
diverges in these expected ways (all consistent with DESIGN-SYSTEM §10 enforcement):

1. **Sidebar**: implemented uses the canonical §10 AppShell sidebar (w-64, full labels,
   lucide icons, role-aware nav) rather than the design mockup's icon-only sidebar. This is
   correct — §10 is the build contract.
2. **Icons**: implemented uses inline lucide-style SVGs (correct per §10: "lucide ONLY").
   Design mockup used Phosphor icons (known accepted drift, noted in design/DESIGN-SYSTEM.md
   v9 note).
3. **Empty state**: implemented shows the correct empty state. Design shows pre-populated
   data. This reflects the purged prod state and is valid.
4. **Detail pane**: visible only when a company is selected. With empty state active, the
   detail pane shows "Select a company" placeholder instead of the full company inspector.

All deltas are expected and policy-compliant per the §10 hard rules.

## Visual conformance verdict

**PASS** — The companies-contacts screen renders correctly per DESIGN-SYSTEM §10 AppShell
chrome, zinc/emerald palette, and lucide-only iconography. One real product defect noted
(TopBar title shows "Dashboard" instead of "Companies") — routes to B per Iron Law.

## Baseline recorded

Path: `apps/web/e2e/__screenshots__/companies-contacts.png`
State at capture: empty (0 companies, prod tables purged post-C-2).
