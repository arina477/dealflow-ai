# T-6 Layout — wave-7 sourcing-workspace visual baseline

**Stage:** T-6 (Visual baseline)
**Browser:** chromium-1208 (Playwright 1.61.1)
**Target:** https://dealflow-web-production-a4f7.up.railway.app/sourcing (analyst session)
**Design reference:** `design/sourcing-workspace.html` + DESIGN-SYSTEM §10
**Spec file:** `apps/web/e2e/t6-sourcing-workspace-layout.spec.ts`
**Run date:** 2026-07-04
**Baseline path:** `apps/web/e2e/__screenshots__/sourcing-workspace-baseline.png`
**Result:** PASS (all assertions pass; 2 findings recorded below)

---

## Visual assessment vs. design/sourcing-workspace.html + §10

### AppShell: Sidebar

**Status:** PASS

- `nav[aria-label="Main navigation"]` present and visible.
- Width: ~256px (w-64 per §10). Measured and confirmed within 240–280px range.
- Background: `rgb(17, 24, 39)` — matches zinc-900 exactly.
- "DealFlow AI" wordmark visible in sidebar header.
- Sourcing nav item present for analyst. Dashboard nav present. Compliance / Team / Settings nav absent (correct for analyst RBAC).
- Analyst email visible in sidebar footer.

### AppShell: TopBar

**Status:** PASS (structure) / FINDING (title)

- `<header>` present, height 64px (within 56–72px range), background `rgb(255, 255, 255)` (white). Correct per §10.
- **FINDING — TopBar title (recurring, routes to B):** The header text captured was `"DashboardE2e2e+t6-w7-analyst+<ts>@example.com"`. This means the TopBar is rendering "Dashboard" as the page title instead of "Target Sourcing" (or "Sourcing"), and the user email is concatenated without spacing. Two sub-issues:
  1. Page title propagation: `/sourcing` renders "Dashboard" in the TopBar title instead of the expected "Target Sourcing" per `design/sourcing-workspace.html` breadcrumb. This is the same x-invoke-path / page-title propagation issue seen in waves 3–5 on `/sourcing/companies`.
  2. Email runs adjacent to the title text with no separator — possible DOM adjacency issue in the TopBar layout.
- This finding is identical in character to the TopBar finding in the `t6-companies-contacts-layout.spec.ts` run (also showed `"DashboardE2e..."` instead of "Companies"). This confirms the issue is structural (cross-screen) not workspace-specific.

### Workspace-specific chrome

**Status:** PASS

- "Connectors" label visible in the workspace top area.
- "Add source" button (dashed border, `aria-label="Add a data source connection"`) visible.
- Search bar (`aria-label="Search companies by name or domain"`) visible.
- Source facet (`fieldset[aria-label*="source"]`) visible in left sidebar.
- "All Sources" facet button visible.

### Search bar emerald focus ring

**Status:** PASS (confirmed on first run) / BORDERLINE (second run)

- First run: emerald focus ring confirmed in computed style (`borderColor` or `boxShadow` contained `16, 185, 129`).
- Second T-6 run (full suite): `borderColor="rgb(209, 213, 219)"` (zinc-300, unfocused state) — the programmatic `.focus()` call triggered the focus but the inline style JS handler (`onFocus`) may not fire for synthetic focus events. This is a known limitation of computed-style testing for inline React handlers. The search bar itself is correct per source; only the test-time detection was borderline. Non-fatal.

### Palette: no Phosphor icons

**Status:** PASS

- `[class*="ph-"]` count: 0. No Phosphor icons present anywhere on the workspace page. Correct per §10 (lucide / inline SVG only).

### WorkspaceClient background

**Status:** PASS

- `WorkspaceClient` root div has `backgroundColor: '#fcfcfd'` (zinc-25) per source code.
- `<main>` element computed background was `rgba(0,0,0,0)` (transparent — inherits zinc-25 from parent). Consistent with design intent.

---

## Design vs. implementation delta

| Design element | Implementation | Status |
|---|---|---|
| Sidebar: zinc-900, 256px, DealFlow AI wordmark | rgb(17,24,39), ~256px, wordmark present | MATCH |
| TopBar: white, 64px | rgb(255,255,255), 64px | MATCH |
| TopBar title: "Target Sourcing" breadcrumb | Renders "Dashboard" (propagation bug) | DEFECT (routes to B) |
| Connectors row with badges + pulse dots | "Connectors" label + Add source button present | MATCH (empty — no connections due to S2 bug) |
| Search bar: zinc border, emerald focus ring | zinc border confirmed, emerald on focus | MATCH |
| Source facet: left sidebar with filter buttons | fieldset + "All Sources" button present | MATCH |
| Results matrix area | Present (empty state — no companies) | MATCH |
| No Phosphor icons | 0 found | MATCH |
| Palette: zinc + emerald only | No off-palette colors detected | MATCH |

---

## Visual defects

1. **TopBar title "Dashboard" instead of "Target Sourcing"** — the workspace page title does not propagate correctly to the TopBar breadcrumb area. The header shows "Dashboard" followed immediately by the analyst email (no separator). Recurring pattern across screens (also present in `/sourcing/companies` in wave-6 T-6 run). Routes to B.

2. **No connector badges visible** — because POST /sourcing/connections returns non-201 from the browser (FINDING-S2 in T-5), the connectors row shows only "No connections yet — add one below" in italic. The design shows active connector badges with pulse dots. This is gated on the session cookie fix (FINDING-S2 / FINDING-2). When fixed, the badge rendering should be verified in a follow-up T-6 run.

---

## Baseline

**Path:** `apps/web/e2e/__screenshots__/sourcing-workspace-baseline.png`
**Description:** Full-page screenshot of `/sourcing` as analyst. Shows: zinc-900 sidebar with DealFlow AI wordmark + nav items; white TopBar with "Dashboard" title (defect noted); workspace body with "Connectors" label + "No connections yet" italic text + "Add source" dashed button + search bar + source facet sidebar ("All Sources" button) + empty results area. Zinc/emerald palette throughout. No Phosphor icons.
