# Wave 25 — V-1 summary (security wave)
Both reviewers APPROVE against the LIVE deployed state (@987ebb4).
## Karen — APPROVE, 0 blocking
All deliverable files on main; the limiter is mechanical + LIVE (atomic UPSERT, trust-proxy=1, Express-before-SuperTokens). **INDEPENDENTLY re-confirmed the prod 429** (fresh nonexistent fake email: reqs 1-5→202, req 6→429 retryAfter:39 — proves the limiter fired against the live rate_limit_hits table + buckets pre-lookup). Health @987ebb4 ok. No secret; migration additive.
## jenny — APPROVE, 6/6 MATCH, 11/11 SEC delivered, 0 DRIFTS
Verified in SOURCE (not inferred): atomic ON CONFLICT...RETURNING (rate-limit.middleware.ts:280); Express app.use before SuperTokens middleware (main.ts:127<135); trust proxy=1 (main.ts:102); per-handler safeParse no-global-pipe (auth.controller.ts); journaled 0019. The 3 items + 4 HIGH + the 3 defect-fixes + 4 P2s all match spec. No auth-model regression. 2nd M10 hardening wave (not recordkeeping-claim); tripwire + _TBD flagged.
```yaml
karen_verdict: APPROVE
jenny_verdict: APPROVE
spec_drift_defects: 0
prod_429_independently_reconfirmed: true
findings: [F1-SEC3-no-forged-XFF-integration-probe, F2-SEC11-logout-401-config-only, F3/F4-cosmetic (T-8 test-thinness, non-blocking->V-2), 3-info (migration-timestamp, M10-recordkeeping-decomp->N+tripwire, Actions-billing-3x->founder)]
```
