# Wave 18 — B-3 Frontend (task 4b014689)

## Files created / modified

**New files:**
- `apps/web/app/(app)/insights/page.tsx` — SSR page, force-dynamic, RBAC-gated
- `apps/web/app/(app)/insights/page.test.tsx` — 23 unit tests (jsdom, @testing-library/react)

**Modified files:**
- `apps/web/app/(app)/_components/NavItem.tsx` — added `bar-chart-2` → `BarChart2` to ICON_MAP
- `apps/web/app/(app)/admin/rbac-role-reverify.test.ts` — extended with wave-18 insights describe block (20 new assertions) + `/insights` + `/analytics` added to NON_ADMIN_ROLE_ROUTES
- `apps/web/next.config.ts` — added `/analytics` afterFiles rewrite → `${apiProxyTarget}/analytics`

## Design-system reuse

No new mockup required (design_gap_flag false per P-3). Reused:
- Zinc/emerald card primitives (zinc-50 bg, zinc-200 border, 8px radius, 20–24px padding) matching §3/§4 of DESIGN-SYSTEM.md
- Typography scale: H1 24px/600, H2 16px/600, Body-s 13px/18 for tables
- `fontVariantNumeric: 'tabular-nums'` on all numeric values (§2 DESIGN-SYSTEM requirement)
- Status colors: emerald-600 positive, red-600 danger, amber-600 warn, blue-600 info
- Pattern from `admin/activity/page.tsx`: apiBase(), cookieHeader(), fetchMe(), assertRole(), force-dynamic, cookie-forwarded fetch

## No gold-plating confirmation

- No charts library installed or imported
- No real-time / WebSocket / polling
- No export button or download affordance
- No new npm dependencies

## RBAC gate

`assertRole('/insights', me.role)` called after `fetchMe`. Allowed: advisor + admin (per NAV_INSIGHTS and roleRoutes entry in rbac.ts — already authored at B-1). analyst + compliance → `redirect('/')`. Unauthenticated → `redirect('/login')`.

## Empty / error states

- **All counts zero:** renders "No analytics data yet" with explanation (no metric cards rendered).
- **API error / schema mismatch / fetch throw:** renders `role="alert"` error banner ("Unable to load analytics data. Please try refreshing the page."). No white screen.
- **F2 null rates (total=0):** `fmtRate(null)` → `"n/a"` — never NaN, never divide-by-zero.

## F2 label correctness (karen metric-correction)

Labels in the page: "Compliance-gate pass rate" / "Blocked rate". The text "response rate" does not appear anywhere. Test explicitly asserts `screen.queryByText(/response rate/i)` is null.

## RBAC role-reverify extended

Added `describe('wave-18 insights page + analytics API')` block covering:
- `/insights` allows advisor + admin, denies analyst + compliance
- `/analytics` allows advisor + admin, denies analyst + compliance
- `navItemsForRole` includes/excludes Insights per role
- `rolesForRoute` returns correct role sets for both routes
- Promotion/demotion role-change scenarios

## Deviations

None. All ACs for task 4b014689 met. The spec's "apiFetch/rid" pattern is used for the SSR fetch (apiBase() + cookie header, same as all other pages); the `/analytics` proxy is in place for any future client-side re-fetch.
