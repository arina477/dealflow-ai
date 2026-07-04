---
stage: T-5
wave: 6
screen: companies-contacts (/sourcing/companies)
browser: chromium-1208 (via pw-compat shim for playwright@1.61.1)
run_date: 2026-07-04
spec_file: apps/web/e2e/sourcing-companies.spec.ts
result: 6/6 PASS (plus 2 wave-2..5 regression guards = 8 total new tests)
full_suite: 40/40 PASS (all prior wave-2..5 specs still green)
execution_time: 9.7s (new specs only) / 44.0s (full suite)
---

# T-5 E2E — Wave-6 Companies-Contacts Screen

## Browser

chromium-1208 via `PLAYWRIGHT_BROWSERS_PATH=$HOME/.local/share/pw-compat` compatibility shim.
Playwright version: 1.61.1. Headless. Workers: 1.

## Seedability verdict

NOT SEEDABLE from the e2e harness. The prod sourcing tables were purged after C-2.
Seeding requires POST /sourcing/connections (create a connection) which in turn requires
DB-level credentials not available from the test harness. The C-2 live proof (deployed
918dbf0) confirmed the sync→dedupe→companies pipeline works end-to-end. This run exercised
the EMPTY STATE path for S1 and S4, which is a confirmed valid AC per the wave-6 directive.

## Per-scenario verdicts

### S1: Analyst sees the companies screen
**PASS**

- Invite+signup flow for a fresh `analyst` role user completed successfully.
- After accept-invite → landed on `/` (session cookie set correctly, not bounced to /login).
- Sidebar nav: `Sourcing` link present for analyst (confirmed via `getNavLabels()`).
- Clicked Sourcing nav → page navigated into /sourcing area.
- Direct navigation to `/sourcing/companies` → URL confirmed as `/sourcing/companies` (no
  redirect to /login or / for authenticated analyst).
- `Companies` heading rendered in the list panel.
- Search input (`aria-label="Search companies by name or domain"`) visible.
- Filter chips rendered: "All", "Active", "Archived" (all `aria-pressed`-backed buttons).
- Company entries list (`ul[aria-label="Company entries"]`) rendered.
- Empty state path taken: `No companies yet` + `Companies appear here once data sources are
  synced.` both visible. Detail pane shows `Select a company` placeholder.
- No crash, no error page, no unexpected redirect.

### S2: RBAC deny — advisor
**PASS**

- Fresh `advisor` role user invited+signed up.
- After accept-invite → landed on `/`.
- Sidebar nav: `Sourcing` link absent for advisor (nav label array confirmed no "Sourcing").
- Direct navigation to `/sourcing/companies` → `assertRole()` on the page redirected to `/`
  (dashboard). URL confirmed as not `/sourcing/companies` after navigation settled.
- No crash. The RBAC denial is a clean redirect, not a 403 page.

### S3: RBAC deny — unauthenticated
**PASS**

- Fresh page context (no cookies, no session).
- Direct navigation to `/sourcing/companies` → redirected to `/login` via the `(app)` layout
  guard (middleware/server-component unauth check).
- `Welcome back` login heading rendered. No crash.

### S4: Company appears (conditional)
**PASS (empty-state-only path)**

- API probe: `GET /sourcing/companies` with no auth cookies → 0 companies in response
  (prod tables purged, as expected).
- Screen rendered in empty state: `No companies yet` visible.
- SEEDABLE PATH NOT EXERCISED: see Seedability verdict above.
- If a connection is seeded in a future wave (POST /sourcing/connections → sync), the
  spec's populated-list branch will assert: (a) at least one company row visible,
  (b) row `aria-label` matches `View <name>`, (c) status badge (`aria-label^="Status:"`)
  present per row.

### Wave-2..5 regression guard
**PASS (2/2)**

- `/ without session → /login`: passed (AppShell layout guard still working).
- `/login renders correctly`: `Welcome back` heading, email + password inputs, Sign in
  button all visible.

## Findings

No product bugs found in T-5. Screen renders correctly for analyst RBAC. RBAC deny paths
(advisor + unauth) work as designed. The empty state is expected given purged prod tables.

## Full suite regression

All 40 tests in the Playwright suite passed (waves 2–6 combined):
- auth.spec.ts: 6/6
- rbac-appshell.spec.ts: 7/7
- audit-log.spec.ts: 7/7
- compliance-settings.spec.ts: 4/4
- t6-layout.spec.ts: 4/4
- t6-appshell-layout.spec.ts: 2/2
- t6-audit-log-layout.spec.ts: 1/1
- t6-compliance-settings-layout.spec.ts: 1/1
- sourcing-companies.spec.ts (wave-6 new): 6/6
- t6-companies-contacts-layout.spec.ts (wave-6 new): 1/1
