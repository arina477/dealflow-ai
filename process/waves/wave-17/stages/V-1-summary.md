# Wave 17 — V-1 summary
Both reviewers APPROVE against deployed 591b3f8. Both honestly disclosed the verification-surface limit (reachable DB = brain control-plane, NOT the prod app DB on Railway private networking; DB-internal state rests on C-2 captured evidence + deployed source + live API behavior — NOT fabricated re-query).
## Karen (source-claim) — APPROVE, 7/7 confirmed, 0 REJECT
CRUX proven: [RLS-GUARD] (index.ts:51-75) is genuinely fail-closed → main.ts process.exit(1) on superuser → a healthy /health @591b3f8 IS proof the runtime is non-superuser dealflow_app. All files/migrations(0014-0017 journaled 0013→0017)/interceptor(set_config)/roles.guard(resolveRoleRlsExempt) present. RBAC 401 unauth (registered, not 403-for-all). audit ok:true 328. CI non-vacuous (SET ROLE dealflow_app + ISO-2 positive control). No claimed-but-fake/vacuous-green.
## jenny (semantic-spec) — APPROVE, 0 drift / 5 gap
All 4 blocks + P-4 F1-F4 rework deployed; "no cross-firm visibility" genuinely enforced by deny-by-default FORCE RLS on request-scoped GUC (not app-layer). Doesn't over-block the existing firm (reads 50 rows, ok:true 328). 5 gaps → next-wave P-2 (mostly H3-latent, inert for one pilot firm).
```yaml
karen_verdict: APPROVE
karen_findings_count: 7
jenny_verdict: APPROVE
jenny_findings_count: 5
spec_drift_count: 0
spec_gap_count: 5
findings: [GAP-1 RESET-''-not-NULL(handled by NULLIF), GAP-2 write-path-default-workspace(H3 latent), GAP-3 CI-SET-ROLE-vs-native, GAP-4 populated-migration-standing-AC, GAP-5 connection-split-deploy-AC]
```
