# Wave 23 — B-2-backend
seller-intent.scorer (PURE deterministic — NO Date.now() inside [grep-asserted], NO LLM/SDK; SI2 pinned WINDOW_DAYS=30/DIRECTION_EPSILON=5 + boundary tests; SI1 no-tieBreak asserted) + service (getDb workspace-scoped, fail-closed if GUC null, SI3 referenceInstant=max-event-ts + empty/single-event tests, read-only no-audit) + RBAC controller + module. Commit 8c27c7c. Cross-firm e2e (seller-intent-isolation): REAL SellerIntentService via workspaceAls.run as dealflow_app, SIT-1 WS_A excludes WS_B, SIT-3 fault-killing (no-ALS THROWS fail-closed). 26/26 unit. Deviations: none.
```yaml
skipped: false
deviations: []
```
