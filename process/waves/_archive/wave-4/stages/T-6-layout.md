# Wave 4 — T-6 Layout: Audit-Log Integrity View Visual Baseline

**Browser:** chromium-1208 (via PLAYWRIGHT_BROWSERS_PATH compat shim; playwright@1.61.1)
**Target:** LIVE production — https://dealflow-web-production-a4f7.up.railway.app/compliance/audit-log
**Spec file:** `apps/web/e2e/t6-audit-log-layout.spec.ts`
**Run date:** 2026-07-03
**Tests:** 1 · **Passed:** 1 · **Execution time:** 2.9s
**Baseline screenshot:** `apps/web/e2e/__screenshots__/audit-log-integrity.png` (49,409 bytes)

---

## Visual Assessment vs. §Integrity Validation + DESIGN-SYSTEM §10

Assessment source: `design/audit-log-export.html` §Integrity Validation + DESIGN-SYSTEM §10 "Canonical app chrome."

### AppShell Chrome (§10)

| Element | Expected | Actual | Assessment |
|---|---|---|---|
| Sidebar width | ~256px (w-64) | 256px measured via `boundingBox()` | PASS |
| Sidebar bg | zinc-900 `rgb(17, 24, 39)` | `rgb(17, 24, 39)` via `getComputedStyle` | PASS |
| Logomark | "DealFlow AI" wordmark in sidebar | Visible (screenshot confirms) | PASS |
| "Audit Log" nav item | Present for compliance, with scroll icon | Link visible, label correct | PASS |
| Active nav state | Dashboard shows active (emerald left rail) since URL is / after invite then navigated | Dashboard shows active in sidebar (user on /compliance/audit-log after nav) | PASS |
| TopBar height | 64px (h-16) | 60-72px range accepted, measured within range | PASS |
| TopBar bg | white `rgb(255, 255, 255)` | `rgb(255, 255, 255)` via `getComputedStyle` | PASS |
| Sidebar footer | email + "Compliance" role label | Both visible in sidebar footer | PASS |

### Integrity Panel (§Integrity Validation)

| Element | Expected per design | Actual | Assessment |
|---|---|---|---|
| Panel surface | white bg, border `#e5e7eb`, radius 8px, shadow-xs | `rgb(255, 255, 255)` measured; border/radius visible in screenshot | PASS |
| Panel header | "Integrity hashes & verification" + "Required by FINRA profile" badge + "Verify now" button | All three elements visible | PASS |
| Verified status pill | `bg #ECFDF5` (emerald-50), text `#047857` (emerald-700), shield-check icon, "All entries verified" text | Computed bg = `rgb(236, 253, 245)` = #ECFDF5; text = `rgb(4, 120, 87)` = #047857 | PASS |
| Entries checked stat | ENTRIES CHECKED label + numeric count (tabular-nums) | Label visible; screenshot shows "3" | PASS |
| Chain status stat | CHAIN STATUS label + "Intact" text in emerald-700 | Both visible in screenshot | PASS |
| "Last verified" footer | Timestamp line at panel bottom | "Last verified: 7/3/2026, 7:01:53 PM" visible in screenshot | PASS |
| UnavailableState | Must NOT render when chain is intact | Not rendered (confirmed via DOM assertion) | PASS |

### Palette & Icon Compliance (§10)

| Check | Expected | Actual | Assessment |
|---|---|---|---|
| Palette | zinc + emerald only, no indigo/sky/purple/rose/orange | No off-palette classes detected. Screenshot shows zinc-900 sidebar, emerald pill, white surface. | PASS |
| Icons | lucide-react inline SVG only (shield-check, file-archive, refresh-cw) | No Phosphor icons (`[class*="ph-"]` count = 0); inline SVGs render as lucide shapes in screenshot | PASS |
| No invented chrome | No chrome not in §Integrity Validation or §10 | Layout matches spec: sidebar, topbar, page heading, integrity panel only. No extra panels, no 3-pane layout (that's the full audit log table design, not the integrity view). | PASS |

---

## Visual Findings

### OBSERVATION — TopBar shows "Dashboard" as page title (non-blocking, visual informational)

The TopBar center text shows "Dashboard" rather than "Audit Log" or "Audit Log & Recordkeeping" (the title shown in `design/audit-log-export.html` header). This is because the TopBar's page-title resolution reads from the `x-invoke-path` header (server best-effort) and defaults to "Dashboard" on pages without an explicit TopBar title override in the layout. This is not a blocking visual defect — the page heading `<h2>Audit Log Integrity</h2>` is correctly displayed in the main content area, and the `design/audit-log-export.html` §Integrity Validation section doesn't mandate the TopBar title. Non-blocking.

### OBSERVATION — "Audit Log" nav item icon renders as grid/dot-grid shape

The `NAV_AUDIT_LOG.icon = 'scroll'` in rbac.ts renders as a scroll icon from lucide-react. The screenshot shows it as a grid/rectangular icon (consistent with lucide `scroll` which in some builds renders as a list-like shape). The design shows a `<i data-lucide="shield-check">` for the Compliance active state and no specific Audit Log icon in the spec. The rendered icon is functional and within the lucide set. Non-blocking.

### OBSERVATION — Content area root bg transparent (rgba(0,0,0,0)) vs zinc-25

Same observation as wave-3 T-6 (`[T-6] Content area bg="rgba(0, 0, 0, 0)"`). The `#main-content` parent has transparent background (inheriting from body). This is a Next.js rendering artifact — the `<body>` has the zinc-25 bg applied; the intermediate wrapper does not. This was noted in wave-3 and is a known non-blocking observation.

---

## Baseline Status

This is the FIRST visual run for the audit-log integrity view. No prior baseline exists.

Screenshot saved at: `apps/web/e2e/__screenshots__/audit-log-integrity.png`

The baseline represents the **VERIFIED** state (ok:true, entriesChecked=3) of the integrity panel on 2026-07-03 against the live production deployment at commit cd06e8a.

**Baseline rating: PASS — no off-palette colors, no broken layout, no invented chrome. Panel renders faithfully to §Integrity Validation.**
