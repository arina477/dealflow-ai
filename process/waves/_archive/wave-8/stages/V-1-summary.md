# Wave 8 — V-1 Summary (orchestrator)
Independent reviews vs LIVE (deploy 46642e7) + code (main @ e57be83).
## Karen (source-claim) — APPROVE (15 PASS, 3 ACCEPTABLE, 0 REJECT)
Files real; B-6/C-2/T fixes real in code (configure→MandateDetail; active-lock 409; disclaimer deterministic+ambiguity-409+0007 index; next.config de-collided /mandates-data; create flat-id; GET /mandates/jurisdictions; acks service !== true; hide-button); actor-id + audit + one-txn; live create/derive/acks-400/active-lock/RBAC/detail-SSR; migrations 0006+0007. 3 ACCEPTABLE = T-block fixes on main pending next deploy (normal path schema-guarded + C-2 verified acks→400).
## jenny (spec-semantic) — APPROVE (3 blocks MATCHES, 0 drift, 0 gap)
M4 first-half metric (create configured mandate) delivered live; buyer-universe correctly deferred (D6 placeholders); compliance CAPTURED-not-enforced consistent + no false-safety; disclaimer DERIVED (D2 no-picker, decision #8); M1/M2/M3 reuse genuine; D1-D6 all delivered live; detail SSR (not JSON).
## Combined: both APPROVE, 0 blocking. → V-2 (no fast-fix; redeploy latest main so deployed=verified) → V-3 close.
```yaml
karen_verdict: APPROVE
jenny_verdict: APPROVE
spec_drift_count: 0
blocking_findings: []
```
