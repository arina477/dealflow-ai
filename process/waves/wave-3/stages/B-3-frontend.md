# Wave 3 — B-3 Frontend (AppShell + dashboard + role-aware nav)
Implemented by nextjs-developer. Branch wave-3-appshell-rbac. Commit `144642f`.
## Files
apps/web/app/(app)/{layout.tsx (server auth-guard, renders AppShell once, unauth→/login), page.tsx (dashboard at /, role-aware), _components/{AppShell,Sidebar,TopBar,NavItem}.tsx (§10), _lib/assertRole.ts (canAccess from rbac.ts)} + tests. Modified: login/accept-invite success redirect →/; dashboard/page.tsx → redirect('/'); DELETED wave-1 app/page.tsx (superseded).
## Confirmations
- AppShell built ONCE via (app) route-group layout (no per-page chrome). §10 exact (zinc/emerald, lucide-react, Sidebar w-64 zinc-900 + emerald logomark, TopBar h-16).
- Dashboard at `/` (canonical, authed; unauth→/login). Login→/.
- Nav from navItemsForRole(role) ONLY (no hardcoded). Per-role sets verified: advisor{Dashboard,Mandates,Compliance}, analyst{Dashboard,Mandates,Sourcing}, compliance{Dashboard,Compliance}, admin{Dashboard,Team,Settings}.
- Web route-protection assertRole via shared canAccess (rbac.ts single source).
## Verify
web typecheck 0; biome apps/web 0 err (1 pre-existing e2e warning); web tests 62/62.
## Deviations
Server-component pathname via next/headers + me re-fetch in page (App Router constraints — layout can't pass props to page); wave-1 page.tsx deleted (route conflict resolution). All reasonable.
```yaml
skipped: false
specialists_spawned: [nextjs-developer]
designs_consumed: [DESIGN-SYSTEM §10, design/dashboard.html]
commit: 144642f
simplify_applied: true
