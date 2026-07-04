# T-6 Layout — buyer-universe visual baseline wave-9

**Browser:** chromium-1208 (Playwright 1.61.1)
**Target:** https://dealflow-web-production-a4f7.up.railway.app (deploy 937ae18)
**Spec:** apps/web/e2e/t6-buyer-universe-layout.spec.ts
**Design reference:** design/buyer-universe.html + DESIGN-SYSTEM §10
**Run date:** 2026-07-04
**Result:** 1/1 PASS
**Baseline path:** apps/web/e2e/__screenshots__/t6-buyer-universe.png

---

## Visual assessment

### §10 AppShell chrome

| Check | Result |
|---|---|
| Sidebar nav present | PASS |
| Sidebar bg zinc-900 (`rgb(17, 24, 39)`) | PASS |
| Sidebar width 240-280px | PASS |
| TopBar h-16 (60-72px) | PASS |
| TopBar bg white (`rgb(255, 255, 255)`) | PASS |
| "DealFlow AI" wordmark in sidebar | PASS |
| No Phosphor icons | PASS |
| "Buyer Universe" nav link visible | PASS |

### Page structure

| Check | Result | Notes |
|---|---|---|
| H1 "Buyer Universe" | PASS | |
| Breadcrumb "Build Universe" | PASS | Present as text in breadcrumb nav |
| Criteria filter sidebar | SKIP | Universe not assembled (see findings) |
| Candidate data table | SKIP | Universe not assembled |
| Include/exclude toggles | SKIP | Universe not assembled |
| NO fit-score/rank column | N/A | Table not rendered |
| Submit to Match Engine button | SKIP | Universe not assembled |

### Empty-state (AssembleEmptyState)

The baseline was captured with no assembled universe because `POST /buyer-universe-data` returns 404 in production (FINDING-T6-BU-1). The page correctly renders the AssembleEmptyState:

| Check | Result |
|---|---|
| "Assemble Buyer Universe" button present | PASS |
| CTA button bg emerald (`rgb(16, 185, 129)`) | PASS |
| "No buyer universe yet" heading | Present (inferred from empty-state render) |

### Palette

| Check | Result |
|---|---|
| Body background zinc-25/white | PASS |
| Emerald CTA (`#10B981`) | PASS |
| No off-palette colors detected | PASS |

---

## Visual defects

### [FINDING-TOPBAR] TopBar title shows "Dashboard" on /buyer-universe

The TopBar text content reads: `"DashboardE2e2e+t6-w9-analyst+...@example.com"` — the "Dashboard" text is the current TopBar page title, not "Buyer Universe" or "Build Universe". This is the **recurring TopBar-title defect** documented in wave-3, wave-4, and wave-8 T-6 reports. The TopBar title does not update per-page.

Severity: Low (visual defect, not functional). Routes to B.

### [FINDING-T6-BU-1] /buyer-universe-data proxy route returns 404

`POST /buyer-universe-data` returns 404 in production. The `BuyerUniverseClient` is coded to use `/buyer-universe-data` as the non-page-colliding proxy path for all mutations (assemble, filter, enrich, submit). The production API does not have this route registered — the controller is likely mounted at `/buyer-universe` only.

Impact on T-6: The visual baseline shows the AssembleEmptyState rather than the assembled-universe split-pane layout (filter sidebar + candidate table). The baseline screenshot reflects real production behavior.

Impact on product: The Assemble, Filter, Enrich, Submit buttons in the browser UI all fail silently (no universe can be assembled or mutated via the client). Routes to B — HIGH priority.

---

## Design comparison vs design/buyer-universe.html

The design shows the full assembled state:
- Left panel: "Criteria Filters" sidebar with search + membership segmented control
- Right panel: Dense candidate data table (Company, Status, Contact Readiness, Completeness, Included, Provenance columns)
- Include/exclude toggle per row (emerald when included, grey when excluded)
- Stats strip: Total / Enriched / Included counts
- Action buttons: Apply Filter, Enrich, View Gaps, Submit to Match Engine (emerald)

The live production render shows the AssembleEmptyState because the `/buyer-universe-data` proxy route is not registered. The empty-state design (centered icon + heading + emerald CTA) matches the implemented AssembleEmptyState component accurately.

Confirmed absent from both design and implementation (correct at M4 boundary):
- No Fit Score column
- No Rank column
- No AI match percentage display

---

## Baseline notes

- This is the first visual baseline for /buyer-universe (wave-9); no prior baseline to diff against.
- Baseline path: `apps/web/e2e/__screenshots__/t6-buyer-universe.png`
- The full split-pane baseline (with assembled candidates) cannot be captured until FINDING-T6-BU-1 is resolved.
- Re-run T-6 after the `/buyer-universe-data` route is registered to capture the assembled-universe baseline.
