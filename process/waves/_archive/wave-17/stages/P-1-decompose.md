# Wave 17 — P-1 Decompose (multi-spec: M8 pilot-partner data-isolation, 4 blocks)

## Maximum-rubric estimates (err-high) — NO SPLIT
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | >60 | ~25-40 (workspaces schema + migration 0014 [workspace_id x ~6-8 tenant tables + backfill] + RLS policies per table + request-scope interceptor/middleware + GUC propagation in every tenant repository + negative-read e2e over primary+audit+export surfaces) | no |
| New primitives | >60 | ~12-16 (workspaces table, workspace_id col x N, RLS policy x N, session-propagation interceptor, negative-read suite) | no |
| Net LOC | >5,000 | ~2,600-3,400 (RLS across all tenant tables + backfill + per-repo GUC propagation + adversarial cross-tenant test covering audit/exports per ceo-reviewer boundary correction) | no |
| Stage-4 working set | >350K | under | no |
→ no threshold trips (large security wave, but under all caps).

## wave_type + minimum floor
- claimed_task_ids.length = 4 → **wave_type: multi-spec**
- multi-spec floor: net LOC >2,500 OR length >=6. **LOC estimate ~2,600-3,400 ≥ 2,500 → floor MET by the LOC arm** (RLS across all tenant tables + backfill migration + request-scope GUC propagation touching every tenant repository + adversarial cross-tenant negative-read suite covering primary + audit_log + recordkeeping-export surfaces). NOT a thin wave.
- **Verdict: PROCEED.**

## Bundle (claimed_task_ids = 4)
- SEED 0db154ff — workspaces anchor + workspace_id scoping column across tenant tables (+ default-workspace backfill before NOT NULL — problem-framer C)
- e45ba68c — deny-by-default Postgres RLS scoped by workspace_id (+ FORCE ROW LEVEL SECURITY — problem-framer A; audit_log workspace_id hash-excluded + chain-verifier-safe — problem-framer B; audit_log + recordkeeping read surfaces IN the boundary — ceo-reviewer)
- 96026365 — propagate authed user's workspace into every request-scoped DB session (greenfield GUC / set_config per-request; RLS is useless without it)
- df2f3b2f — cross-tenant negative-read integration test (over the OWNER connection — problem-framer A false-green guard; covers primary + audit + export surfaces — ceo-reviewer)

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []   # backend/infra only — schema + RLS + request-scope middleware + adversarial test. Isolation is transparent (extends existing admin-workspace-settings; no NEW UI surface this wave). Workspace provisioning for the ONE pilot firm is admin/seed, not a new page.
```

## Self-consistency
CLEAN. Every task → mvp-critical (atomic isolation vertical per mvp-thinner). LOAD-BEARING: FORCE-RLS+owner-connection-negative-test (false-green guard), audit_log-hash-exclude+chain-verifier-ok, request-scope-GUC-propagation, backfill-before-NOT-NULL, deny-by-default, audit/export-surfaces-in-boundary. design_gap_flag false. SECURITY-SCOPE-TIGHTENED (multi-tenancy/RLS/auth) → P-4.

```yaml
verdict: PROCEED
wave_type: multi-spec
claimed_task_ids: [0db154ff-31f1-45c4-85cd-71d34d65c437, e45ba68c-80f3-475e-a240-54c23ea9ccb2, 96026365-77b2-4763-bf57-705fbf340ba8, df2f3b2f-6e7d-4f39-a6ab-7ca49020e967]
floor_merge_attempt: 0
design_gap_flag: false
security_scope_tightened: true
