# Wave 3 — B-1 Contracts
Shared RBAC contract authored in @dealflow/shared (typescript-pro) — the single source of truth for nav + @Roles enforcement. Commit `75711f8`.
- **File:** packages/shared/src/rbac.ts (+ barrel). Pure TS/Zod, no framework imports.
- **Exports:** roleRoutes (SoT: route→allowedRoles + navItem), navItemsForRole, rolesForRoute, canAccess, isPublicRoute (/auth/*, /health), ALL_NAV_ITEMS, types.
- **nav⊆RBAC by construction:** navItemsForRole filters roleRoutes by the same allowedRoles array referenced per route — no drift possible.
- **Matrix:** verbatim from the P-4 pinned addendum (18 route patterns, completeness-tested). No deviation.
- **Tests:** 92 (per-role nav sets, canAccess allow+deny, /mandates/:id pattern matching, isPublicRoute, nav⊆RBAC all 4 roles). shared typecheck + test clean.
```yaml
skipped: false
contracts_authored: [packages/shared/src/rbac.ts, packages/shared/src/index.ts]
sdk_regenerated: false
deviations: []
commit: 75711f8
```
