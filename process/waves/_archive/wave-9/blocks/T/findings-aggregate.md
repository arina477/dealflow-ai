# Wave 9 — T-block findings aggregate

| # | stage | sev | scope | description | route |
|---|---|---|---|---|---|
| W9-2 | T-5 | false-positive | /buyer-universe-data | claimed POST→404; live probe shows 401 (proxy reaches API), C-2 DOM-verified the flow, S1-b PASSED — deploy-propagation/harness artifact, NOT a bug | cleared (no B route) |
| TopBar | T-5/T-6 | low | TopBar title | Dashboard on /buyer-universe (recurring x-invoke-path, 7+ screens) → polish | non-blocking carry-forward |
| perf | T-7 | info | assemble | unbounded assemble (all M3 companies one-txn) → bound before real-provider scale | backlog (performance-engineer) |
**Totals:** 0 critical, 0 real blocking. buyer-universe assemble→filter→enrich→submit + idempotency + SSR-hydration + submit-guard + no-rank + RBAC + audited LIVE-proven (C-2 first-try). B-6 7 CRIT all fixed pre-deploy.
