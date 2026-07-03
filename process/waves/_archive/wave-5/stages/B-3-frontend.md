# Wave 5 — B-3 Frontend (compliance-settings Rules Engine CRUD UI)
nextjs-developer. Commit `c7924bc`. Branch wave-5-compliance-gate.
## Files
apps/web/app/(app)/compliance/settings/{page.tsx (server, assertRole compliance-only, parallel SSR-fetch rules/suppression/disclaimers), _components/{ApprovalGatingSection,SuppressionMatrixSection,JurisdictionTemplatesSection}.tsx (client CRUD)} + NavItem.tsx (Sliders icon) + next.config.ts (6 afterFiles rewrites for CRUD API paths).
## Confirmations
- Route /compliance/settings (3 sections per design/compliance-settings.html: Approval & Gating Policy, Suppression Matrix, Jurisdiction Templates). §10 AppShell chrome, zinc/emerald, lucide.
- Same-origin CRUD proxy (afterFiles — /compliance/rules|suppression|disclaimers API-paths proxy first-party; /compliance/settings PAGE not hijacked, page wins). First-party cookie.
- RBAC: compliance sees page+nav; advisor/analyst/admin(no-compliance)→redirect /; unauth→/login. (Page ['compliance']; CRUD API ['compliance','admin'] — intentional asymmetry per journey row 17.)
- Disclaimer edit → PATCH (backend new-version); version badge shown. a11y: focus-trap modal, aria, delete-confirm.
## Verify
web typecheck clean; biome 0 err (touched); web tests 134 (95 wave-3/4 + 39 new: 3-section render, per-role redirect, create/delete/toggle interactions, validation).
```yaml
skipped: false
specialists_spawned: [nextjs-developer]
designs_consumed: [design/compliance-settings.html, DESIGN-SYSTEM §10]
commit: c7924bc
simplify_applied: true
deviations: []
```
