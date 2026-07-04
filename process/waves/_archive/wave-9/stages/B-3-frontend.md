# Wave 9 — B-3 Frontend (/buyer-universe page)
nextjs-developer. Commit b3da6fc. Branch wave-9-buyer-universe.
## Files
apps/web/app/(app)/buyer-universe/{page.tsx (SSR, assertRole, fetch via apiBase internal), _components/BuyerUniverseClient.tsx} + next.config.ts (+/buyer-universe-data rewrites) + mandates/_components/MandateDetailClient.tsx (D6 Buyer-Engine anchor → link to /buyer-universe?mandateId=).
## Confirmations
- SSR-hydrated: server fetches /buyer-universe?mandateId= + /:id via apiBase (INTERNAL) — NO client page-route fetch (wave-8 lesson applied preemptively). Page route NOT rewritten (SSR page wins).
- All mutations (assemble/filter/include-exclude/enrich/gaps/submit) via apiFetch(rid) through /buyer-universe-data (non-page-colliding proxy).
- D6 anchor: Buyer-Engine placeholder → "Open Buyer Universe" link (/buyer-universe?mandateId=); Ranked/Pipeline stay deferred (M5).
- **M4/M5 BOUNDARY: NO score/rank/fit in the candidate table.** assemble/filter/review/enrich/gaps/submit only. (design's async "Enrichment Core" → synchronous enrich result.)
- assertRole analyst/advisor/admin; nav⊆RBAC; a11y.
## Verify: web typecheck clean; biome 0 net-new; 341 web tests (23 new + prior green).
## Deviation: D6 test updated (Buyer-Engine now a live link not a placeholder — necessary evolution).
```yaml
skipped: false
specialists_spawned: [nextjs-developer]
designs_consumed: [design/buyer-universe.html]
commit: b3da6fc
ssr_hydrated: true
m4_m5_boundary_no_score_rank_ui: true
