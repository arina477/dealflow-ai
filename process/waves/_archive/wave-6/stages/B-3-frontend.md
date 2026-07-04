# Wave 6 — B-3 Frontend (companies-contacts screen)
nextjs-developer. Commit `952207d`. Branch wave-6-deal-sourcing.
## Files
apps/web/app/(app)/sourcing/{page.tsx (→/sourcing/companies redirect), companies/page.tsx (server, assertRole analyst, SSR GET /sourcing/companies), companies/[id]/page.tsx (deep-link), companies/_components/{CompaniesClient,FilterBar,CompanyDetail(+DedupeCandidateCard)}.tsx} + next.config.ts (+/sourcing/* afterFiles rewrites).
## Confirmations
- Route /sourcing/companies (2-pane list+detail per design/companies-contacts.html): filter (name/domain/status/duplicates), detail tabs (Contacts w/ masked email + Provenance source badges + Dedupe Review). NO manual-create (design's +add stubbed/omitted — out of scope).
- **Clean actions:** dedupe-candidate merge/reject via apiFetch (rid:'anti-csrf' + first-party cookie — wave-5 CSRF fix); auto-selects Dedupe tab when pending.
- Same-origin /sourcing/* proxy (afterFiles: /sourcing/connections/:id/sync + /sourcing/dedupe-candidates/:id/resolve; PAGE /sourcing/companies NOT hijacked, page wins).
- RBAC: analyst sees page+Sourcing nav; advisor/compliance/admin(no-analyst)→redirect /; unauth→/login. nav⊆RBAC.
- §10 AppShell, zinc/emerald, lucide, a11y (fieldset/legend, aria, role=img badges, reject-confirm).
## Verify
web typecheck clean; biome 0 err (sourcing files); web tests 179 (139 wave-3/4/5 + 40 new: RBAC redirect, list render, filter, dedupe merge/reject, provenance badges).
```yaml
skipped: false
specialists_spawned: [nextjs-developer]
designs_consumed: [design/companies-contacts.html, DESIGN-SYSTEM §10]
commit: 952207d
simplify_applied: true
deviations: []
```
