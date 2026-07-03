# Wave 5 — V-1 Summary (orchestrator)
Independent reviews vs LIVE (deploy 13e55ef). No shared context.
## Karen (source-claim) — APPROVE (8/8 PASS)
Files real; SoD=compliance-only + null-approver fail-closed (sod.evaluator); non-bypass gate (ctx-parse-first + all-evaluators + audit-in-tx); keyless SHA-256 content-hash; FK-safe actor via getUserWithRole (all 3 controllers); antiCsrf VIA_CUSTOM_HEADER + apiFetch rid. LIVE independently reproduced: without-rid 401 / with-rid 201 / advisor 403 / admin 201 / unauth 401 / config-audit 24→25 ok:true / disclaimer 1-active. deploy 13e55ef. Gate honestly scoped (M6 dep, no over-claim).
## jenny (spec-semantic) — APPROVE (0 drift, 0 gap)
4/4 blocks MATCH live: single non-bypassable gate (no-skip, fail-closed ctx-parse, all evaluators, verdict audited in-tx before return); SoD compliance-ONLY admin-excluded (sod/invalid-approver-role blocked live); keyless content-hash re-block; suppression hard-block; disclaimers enforced; compliance-only settings CRUD every mutation audited (chain 29→32→33 ok:true); RBAC fail-closed. Thin slice honest (gate/send/evaluate probes 404 → no false live-send claim).
## Combined: both APPROVE. Compliance enforcement (non-bypass gate + SoD compliance-only + every-decision-audited) LIVE + spec-conformant. No REJECT/critical/drift/gap.
```yaml
karen_verdict: APPROVE
jenny_verdict: APPROVE
spec_drift_count: 0
spec_gap_count: 0
findings:
  - {source: T-6, severity: low, item: "TopBar title on settings/audit-log (in AppShell-polish task)"}
  - {source: T-8, severity: low, item: "disclaimer substring plaintext-v1 (HTML enforcement M6)"}
```
