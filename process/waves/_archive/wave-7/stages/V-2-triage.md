# Wave 7 — V-2 Triage
jenny REJECT — 2 CRITICAL blocking (the workspace shows empty despite data). Karen APPROVE (code claims true — the bugs are runtime/product-render, not code-absent).
| # | source | sev | summary | bucket | disposition |
|---|---|---|---|---|---|
| 1 | jenny | critical | SSR WorkspaceCompany z.datetime() rejects PG-wire timestamp → list dropped | BLOCKING | fast-fix (V-3): accept PG-wire timestamp (z.string() / coerce / normalize — the wave-4 lesson) |
| 2 | jenny | critical | client search/facet fetch HTML page route not JSON API | BLOCKING | fast-fix (V-3): client search must hit the API (SSR-refetch via URL query OR a client-reachable proxied API path) |
| 3 | T-6 | low | TopBar title recurring | non-blocking | polish task |
| 4 | T-5 | test-bug | S2 unique-name (create live-proven C-2) | non-blocking | test-maintenance |
## Fast-fix queue (V-3): [timestamp-parse, client-search-API-path] — 2 blocking. Frontend fixes → nextjs-developer; needs CI + redeploy + live re-verify (jenny re-check the workspace shows companies).
```yaml
findings_blocking: [SSR-timestamp-parse, client-search-API-path]
fast_fix_queue: [{fix: SSR-timestamp, owner: nextjs-developer}, {fix: client-search-API, owner: nextjs-developer}]
b_block_re_entry_required: false
fast_fix_needs_redeploy: true
```
