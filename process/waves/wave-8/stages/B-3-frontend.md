# Wave 8 — B-3 Frontend (mandate 3 pages)
nextjs-developer. Commit c430bbd. Branch wave-8-mandate-spine.
## Files
apps/web/app/(app)/mandates/{page.tsx (list), new/page.tsx (create), [id]/page.tsx (detail SSR-hydrate), _components/{MandateListClient,MandateForm,MandateDetailClient,StatusFilter,DeferredPlaceholder}.tsx} + next.config.ts (/mandates rewrites) + _lib/apiFetch.ts (headers→plain Record fix).
## D1-D6 confirmed
- D2: jurisdiction dropdown only (disclaimer derived server-side, NO picker) + "captured for compliance gate, not enforced here" copy.
- D3: seller geo (multi-region tags) + size band (5-option radio).
- D4: suppression = text/tags input (NOT CSV dropzone).
- D5: 3 required ack checkboxes (aria-required + required; all 3 before POST).
- D6: Buyer Engine / Ranked Candidates / Pipeline as DeferredPlaceholder ("coming in a later step") — stable M4 mount points.
- SSR-hydrate (wave-7): detail server fetches via apiBase (internal), passes initialDetail prop; 0 client fetches to /mandates/:id (test-confirmed "2 server fetches: me+detail, no client fetch").
- assertRole; apiFetch(rid); read-schema z.string().
## Verify: web typecheck clean; biome 0 net-new; 304 web tests (55 new mandate + 249 prior green).
## Deviation: apiFetch headers → plain Record (impl fix for rid header; behavior identical).
```yaml
skipped: false
specialists_spawned: [nextjs-developer]
designs_consumed: [design/mandate-new.html, mandates-list.html, mandate-detail.html]
commit: c430bbd
ssr_hydrated_detail: true
d1_d6_implemented: true
