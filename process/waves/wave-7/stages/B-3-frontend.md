# Wave 7 — B-3 Frontend (sourcing-workspace page)
nextjs-developer. Commit `f8073e1`. Branch wave-7-sourcing-workspace.
## Files
apps/web/app/(app)/sourcing/{page.tsx (REPLACES the redirect stub — server, assertRole analyst, SSR connections+companies), _lib/workspace-types.ts, _components/{WorkspaceClient,SearchBar,SourceFacet,ResultsMatrix,DetailDrawer,SyncTrigger,AddConnectionForm}.tsx} + next.config.ts (+/sourcing/connections rewrites).
## Confirmations
- /sourcing = workspace (replaces redirect) per design/sourcing-workspace.html: connectors row + search + source facet + results matrix + detail drawer. Keep /sourcing/companies deep screen (hand-off).
- **Search over canonical universe** (GET /sourcing/companies filtered — server-side). **≥2-source facet** (SourceFacet renders per-connection from GET /sourcing/connections companyCount).
- **AC-BADGE:** source badges from REAL connection.displayName (NOT literal PitchBook/Crunchbase mock names).
- **AC-CTA:** Review-Import CTA + drawer footer → /sourcing/companies (wave-6 dedupe review queue); NO in-page dedupe modal (deferred b9141490).
- **AC-SEED enabler:** AddConnectionForm → apiFetch POST /sourcing/connections {providerKey:fixture} → refreshes connectors (analyst gets ≥2 fixture connections → ≥2-source view real, not empty).
- SyncTrigger → apiFetch POST /sourcing/connections/:id/sync (wave-6 reuse) → SyncSummary → refresh.
- RBAC: /sourcing analyst-only (assertRole); apiFetch(rid) mutations; /sourcing/connections afterFiles proxy (page not hijacked). a11y (fieldset, aria, Escape/backdrop drawer).
## Verify
web typecheck clean; biome 0 err (app/); web tests 214 (170 wave-3..6 + 44 new: RBAC, workspace render, search, ≥2-source facet, sync-trigger, connection-create, Review-Import→companies).
## Note (non-blocking, consistent w/ journey persona)
/sourcing page = analyst-only (roleRoutes); connection API = analyst/admin. Admin manages via API; page is analyst's (journey row 12 = An). Same intentional page-vs-endpoint pattern as wave-4 /compliance.
```yaml
skipped: false
specialists_spawned: [nextjs-developer]
designs_consumed: [design/sourcing-workspace.html, DESIGN-SYSTEM §10]
commit: f8073e1
simplify_applied: true
deviations: ["/sourcing analyst-only per roleRoutes (page); connection API analyst/admin — intentional"]
