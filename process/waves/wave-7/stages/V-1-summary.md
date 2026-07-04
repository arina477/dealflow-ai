# Wave 7 — V-1 Summary (orchestrator)
Independent reviews vs LIVE (deploy 0fe63de).
## Karen (source-claim) — APPROVE (22 findings TRUE, 0 blocking)
Files real; B-6/C-2 fixes real in code (connectionIds returned, providerKey→400, err.cause.code→409, 0005 journal when>0004); actor-id + audit; /sourcing is the workspace; live create 201/dup 409/bad-key 400; 0005 applied; reuse.
## jenny (spec-semantic) — REJECT (2 DRIFT Critical + 1 GAP)
The workspace renders "No companies found" LIVE despite 4 canonical companies existing (M3 metric computable at the API but NOT VIEWABLE in the product):
- **DRIFT-1 (Critical):** SSR WorkspaceCompany `z.string().datetime()` REJECTS the API's PG-wire timestamp ("2026-07-04 04:30:08.014852+00" — space/+00/µs, not ISO T/Z) → the Zod parse fails → silently DROPS the whole company list. (The wave-4 created_at PG-wire-format class re-firing in the web SSR layer — unit tests used mock ISO timestamps.)
- **DRIFT-2 (Critical):** client search/facet fetch the HTML PAGE route (/sourcing/companies) not the JSON API → get HTML not data.
AC-SEED/AC-BADGE/AC-CTA/sync-reuse/honest-split MATCH; the failure is the workspace list not rendering.
## Combined: jenny REJECT (blocking) — the workspace is non-functional (empty list). → V-2 fast-fix queue.
```yaml
karen_verdict: APPROVE
jenny_verdict: REJECT
spec_drift_count: 2
findings:
  - {severity: critical, blocking: true, item: "SSR timestamp z.datetime() rejects PG-wire format → company list dropped (wave-4 class re-fire, web SSR)"}
  - {severity: critical, blocking: true, item: "client search/facet fetch HTML page route not the JSON API"}
```
