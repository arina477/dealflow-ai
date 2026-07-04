# Wave 7 — V-3 Fast-fix (the empty-despite-data / broken-render chain)
V-1 jenny REJECT (workspace empty) triggered the fast-fix. Live re-verification (head-ci-cd, real post-hydration chromium DOM) uncovered a 5-sibling chain — each masked by the previous, all in the "web SSR/client render of the real API shape" family. ALL fixed + LIVE-verified.

| # | fix commit | defect | root cause | live proof |
|---|---|---|---|---|
| 1 | 3e2042f | workspace renders empty | SSR WorkspaceCompany `z.string().datetime()` rejects PG-wire timestamp → list dropped; + client search fetched the HTML page route | workspace renders + in-memory search (0 fetches) |
| 2 | e3dd9b7 | deep-screen /sourcing/companies empty (+ /compliance/settings latent) | shared companySchema (+contact/connection/provenance/dedupe, +4 compliance-rules) `.datetime()` rejects PG-wire | compliance-settings renders |
| 3 | 2ae3e06 | deep-screen still empty | companySchema `.strict()` rejected the API's `connectionIds` field (added in B-6) → unrecognized_keys | deep-list renders 4 rows |
| 4 | 798fae1 | detail /sourcing/companies/:id 500 | Server→Client function-prop (`onCandidateResolved`) illegal in Next App Router | detail 200 (no 500) |
| 5 | e4debc6 | detail "Network error" | client `apiFetch('/sourcing/companies/:id')` served the Next page HTML (no rewrite; path IS a page) → JSON parse throws | detail renders content (contacts/provenance tabs) |

**Final live state (e4debc6, head-ci-cd APPROVED):** all 4 surfaces render in live post-hydration DOM — workspace (4 rows + in-memory filter), deep-list (4 rows), DETAIL (heading + contacts + provenance/dedupe tabs, no Network error), compliance-settings. Regression: create 201/dup 409/bad-key 400/login 200/health e4debc6; audit chain ok (entriesChecked 57). Canary skip (0 DAU).
**Class lesson (→ L-2 candidate):** every sibling was a web SSR/client parse or fetch that unit tests (mock ISO timestamps, mock shapes omitting connectionIds, no real serialization boundary) passed but real-data live rendering failed. The guard is post-hydration live-DOM verification against the REAL API shape — which caught all 5.
```yaml
fast_fix_verdict: RESOLVED
fix_commits: [3e2042f, e3dd9b7, 2ae3e06, 798fae1, e4debc6]
attempts: 5
retry_cap_ok: true   # each a distinct root cause, not a repeated failed fix — convergent not looping
all_surfaces_render_live: true
deploy: e4debc6
