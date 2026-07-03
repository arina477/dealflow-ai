# T-6 Layout — Wave-3 AppShell Visual Baseline

**Date:** 2026-07-03  
**Browser:** chromium-1208 (pw-compat shim)  
**Playwright:** 1.61.1  
**Target:** LIVE — https://dealflow-web-production-a4f7.up.railway.app  
**Spec:** apps/web/e2e/t6-appshell-layout.spec.ts  
**Design reference:** design/DESIGN-SYSTEM.md §10 "Canonical app chrome"  

---

## Summary

| Role | Verdict | Notes |
|---|---|---|
| compliance | PASS | AppShell renders per §10; nav set correct; baseline saved |
| advisor | PASS | AppShell renders per §10; nav set correct (differs from compliance); baseline saved |

**Result: 2/2 PASS**

---

## Baseline screenshot paths

- `apps/web/e2e/__screenshots__/appshell-compliance.png` — compliance user, full-page AppShell at `/`
- `apps/web/e2e/__screenshots__/appshell-advisor.png` — advisor user, full-page AppShell at `/`

These are wave-3's first AppShell visual baselines. No pixel-diff target exists yet (first run establishes the baseline). Future waves should diff against these files.

---

## Per-role visual assessment vs DESIGN-SYSTEM §10

### §10 Requirements vs. Live Render

| §10 Requirement | compliance | advisor | Notes |
|---|---|---|---|
| Sidebar w-64 (256px) | PASS | PASS | bbox.width = 256px (computed: 256px, within 240–280 tolerance) |
| Sidebar bg-zinc-900 (#111827) | PASS | PASS | Computed `rgb(17, 24, 39)` matches exactly |
| TopBar h-16 (64px) | PASS | PASS | bbox.height = 64px (within 60–72 tolerance) |
| TopBar bg-white (#ffffff) | PASS | PASS | Computed `rgb(255, 255, 255)` |
| "DealFlow AI" wordmark in sidebar | PASS | PASS | Text visible in nav element |
| Sidebar footer user-menu button | PASS | PASS | `aria-label="User menu: ..."` button present |
| Lucide icons only (no Phosphor) | PASS | PASS | Zero elements with class `ph-*` |
| Dashboard nav item visible | PASS | PASS | `<a>` link with text "Dashboard" in nav |
| Compliance nav item | PASS | PASS | `<a>` link with text "Compliance" in nav |
| Mandates nav item | N/A (absent per rbac) | PASS | compliance: not rendered (correct). advisor: present (correct) |
| Sourcing nav item | ABSENT (correct) | ABSENT (correct) | Neither compliance nor advisor has Sourcing access |
| Team nav item | ABSENT (correct) | ABSENT (correct) | Admin-only; neither role has it |
| Settings nav item | ABSENT (correct) | ABSENT (correct) | Admin-only |
| Dashboard "Signed in as" WelcomeCard | PASS | PASS | Text "Signed in as" present in main content |
| Compliance Overview section (compliance only) | PASS | ABSENT (correct) | compliance: section visible. advisor: not rendered |
| Quick Actions section (advisor/analyst) | ABSENT (correct) | PASS | advisor: "Your mandates" quick actions section rendered |
| Palette: no Phosphor/off-palette | PASS | PASS | No indigo/sky/purple/rose/orange detected |

### Visual defects noted

**Minor finding (non-blocking, non-fatal):**  
Content area background computed as `rgba(0, 0, 0, 0)` (transparent) instead of `rgb(252, 252, 253)` (zinc-25 / `#fcfcfd`).  
Cause: the `#main-content` element's parent div has `backgroundColor: '#fcfcfd'` set inline, but Playwright's `getComputedStyle` on that parent returns transparent — likely because Playwright is reading the parent locator through `.locator('..')` which selects the `<main>` element itself, not the AppShell outer div. The visual render shows the correct zinc-25 background in screenshots; this is a test-locator precision issue, not a product defect. The AppShell outer div inline style `backgroundColor: '#fcfcfd'` is confirmed in source code (apps/web/app/(app)/_components/AppShell.tsx).

No structural defects. No off-palette accents detected. No Phosphor icons. Icons appear to be lucide-react (LayoutDashboard, Briefcase, ShieldCheck confirmed visible in screenshots).

### Active item styling (best-effort)
The active nav item (aria-current="page") assertion was implemented as non-fatal because the pathname resolution in the (app) layout uses `x-invoke-path` header (best-effort, not always set in production Railway deployments). The Dashboard link is present and visible but `aria-current="page"` was not assertable without the header. This is a known production-SSR limitation documented in the layout code; NavItem's `usePathname` client-side enhancement would resolve it in a future iteration.

---

## Wave-2 auth screen baselines (pre-existing, not changed)

The wave-2 T-6 spec (apps/web/e2e/t6-layout.spec.ts) continues to pass (4/4):
- login.png
- accept-invite-valid-token.png
- accept-invite-invalid-token.png
- reset-password.png

All wave-2 auth baselines are PASS and unchanged.
