# Wave 16 — P-1 Decompose

## Maximum-rubric estimates (err-high) — NO SPLIT
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | >60 | ~18-28 (mandate-service + create-path, workspace read, admin nav, invite service, reactivate endpoint+UI, config typed-boundary + migration, admin-activity page+endpoint, + tests) | no |
| New primitives | >60 | ~7-9 (cascade consumer, reactivate endpoint, config validator/typed-boundary, admin-activity read endpoint + page, invite-dedup logic, nav item) | no |
| Net LOC | >5,000 | ~1,475-1,550 | no |
| Stage-4 working set | >350K | well under | no |
→ no threshold trips.

## wave_type + minimum floor
- claimed_task_ids.length = 6 (after expand) → **wave_type: multi-spec**
- multi-spec floor: net LOC >2,500 OR claimed_task_ids.length >= 6.
- **Initial bundle = 5 specs / ~1,200 LOC → floor UNMET → RESCOPE-AUTO-MERGE.**
- Fired expand-current-bundle decomposition (automatic → milestone-decomposer inline, floor_merge_attempt=1): authored ONE buildable M7 sibling (admin-activity view, ~275 LOC) → **6 specs → floor MET by the ≥6-specs arm** (LOC arm still under 2,500; OR-logic satisfied by count).
- **Verdict: PROCEED-AFTER-MERGE.**

## Bundle (claimed_task_ids = 6)
- SEED 904a3c25 — Wire firm default-compliance-profile cascade into mandate creation (mvp-critical spine; e2e inherits-default proof)
- 6f1a96da — Admin nav / link to /admin/integrations
- c54db02d — Invite duplicate/existing-user handling (409/idempotent; covers already-registered AND already-pending)
- 042cf4e6 — Reactivate/undo for soft-deactivated users (+ non-deferrable prod-cleanup: restore advisor1, WORM-safe purge of 3 KAREN-V1-SENTINEL records)
- 2560fecc — Guard config JSONB against raw secrets (typed-boundary framing per problem-framer, not a runtime scanner)
- 8bb0a22f — Admin activity view: read-only /admin/activity page + endpoint (filters existing audit log to the 6 admin actions; additive, no schema change)

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []   # /admin/activity reuses the wave-13 /compliance/audit-log table pattern + wave-15 admin-table page template; reactivate = button on existing /admin/users; nav = existing AppShell pattern; cascade/invite-dedup/config-guard are backend. No net-new visual paradigm.
```

## Self-consistency
CLEAN. Every P-0-carried item maps to a task. LOAD-BEARING: cascade-inherits-firm-default (e2e test mandatory), invite-dedup-both-cases, config-typed-boundary, admin-activity-reads-immutable-log-only. floor_merge_attempt: 1. security-scope? invite/user-reactivate touch user-creation/deactivation → security-adjacent but lighter than wave-15 (no new credential/auth primitive); P-4 will judge security-scope-tightened applicability.

```yaml
verdict: PROCEED-AFTER-MERGE
wave_type: multi-spec
claimed_task_ids: [904a3c25-ab46-4050-8122-d998e5a6f2a1, 6f1a96da-d96f-4bdc-b572-5255b493653c, c54db02d-c531-4292-a246-6ba984166ce9, 042cf4e6-5d3f-42ad-8c06-3c67404ab8e1, 2560fecc-bb12-483d-8f63-a801db6c71b1, 8bb0a22f-66a4-4b37-8cbb-dae7ad637767]
floor_merge_attempt: 1
design_gap_flag: false
```
