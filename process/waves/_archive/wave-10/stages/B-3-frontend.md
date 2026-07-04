# Wave 10 — B-3 Frontend (/matches-shortlist page + AI-framing STRIP)
nextjs-developer. Commit 9eaaa71. Branch wave-10-match-spine.
## Files
apps/web/app/(app)/matches-shortlist/{page.tsx (SSR, assertRole, fetch via apiBase internal), _components/MatchesShortlistClient.tsx} + next.config.ts (+/matches-data rewrites, route-order 2-seg /candidates/:cid first) + mandates/_components/MandateDetailClient.tsx (D6 Ranked-Candidates anchor → /matches-shortlist?mandateId=).
## Confirmations
- **AI-framing STRIPPED (karen MANDATORY, CODE-OF-CONDUCT provenance):** ZERO AI/model/rationale-generated/similar-mandates/explainability-engine language. Score framed "rule-based fit score" + "Score breakdown" (deterministic score_breakdown). A no-AI-framing test asserts absence.
- SSR-hydrated: server fetches /matches?mandateId= + /:id via apiBase (INTERNAL); NO client fetch to the /matches-shortlist page route (wave-8/9 lesson). Page route NOT rewritten.
- Mutations (create-run/disposition/handoff) via apiFetch(rid) through /matches-data (non-page-colliding); parse responses with shared schema (BUILD rule 5).
- D6 anchor: Ranked-Candidates placeholder → live CTA /matches-shortlist?mandateId= (jenny flag 1); Pipeline stays deferred (M6).
- assertRole advisor/admin/analyst; nav⊆RBAC (NAV_MATCHES); a11y.
## Verify: web typecheck clean; biome 0 net-new; 371 web tests (24 new incl. no-AI-framing + /matches-data-proxy + D6-link).
```yaml
skipped: false
specialists_spawned: [nextjs-developer]
commit: 9eaaa71
ai_framing_stripped: true
ssr_hydrated: true
