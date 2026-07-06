# Wave 18 — P-1 Decompose (multi-spec: M9 advisor-insights analytics, 3 blocks)

## Maximum-rubric estimates (err-high) — NO SPLIT
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | >60 | ~15-25 (analytics service + repository [4 workspace-scoped metric queries] + shared analytics Zod + API controller/module + /insights page + components + real-DB + negative-read tests) | no |
| New primitives | >60 | ~8-12 (aggregation service, 4 metric-family queries, analytics API endpoint(s), dashboard page + metric-card components) | no |
| Net LOC | >5,000 | ~2,600-3,000 | no |
| Stage-4 working set | >350K | under | no |
→ no threshold trips.

## wave_type + minimum floor
- claimed_task_ids.length = 3 → **wave_type: multi-spec**
- multi-spec floor: net LOC >2,500 OR length >=6. **~2,600-3,000 LOC → floor MET by the LOC arm** (4 metric families [mandate throughput, outreach response rates, advisor productivity, match disposition] each a workspace-scoped aggregation + shaping; the shared-Zod RBAC API; the /insights Next dashboard w/ empty-states; real-DB workspace-scoped tests + the post-M8 cross-firm negative-read proof). Keeping all 4 families (P-0 disposition, THIN-split rejected) is what holds the wave above floor — thinning to 2 risked RESCOPE-AUTO-MERGE.
- **Verdict: PROCEED.**

## Bundle (claimed_task_ids = 3)
- SEED a5ba8068 — read-only analytics aggregation service (4 metric families, workspace-scoped via getDb + the app.workspace_id GUC — RLS-honoring)
- 9e05828b — shared-Zod-typed analytics API endpoint(s), RBAC-scoped read
- 4b014689 — /insights advisor analytics dashboard page (Next.js 15)

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []   # /insights is a read-only metric dashboard composable from the shipped design system (zinc/emerald cards + tables + AppShell + lucide) — no net-new visual paradigm; consistent with the wave-15/16 admin-page precedent (mockup-less but pattern-reused → false). ceo-reviewer's no-charts-lib/no-real-time constraint keeps it to simple metric cards. B-3 design-gap fallback re-enters D-1 if a genuine gap surfaces mid-build.
```

## Self-consistency
CLEAN. Every task → mvp-critical vertical (aggregation→API→dashboard). LOAD-BEARING (from P-0): workspace-scoped-aggregation (getDb + app.workspace_id GUC — NOT the prose's app.current_workspace_id), cross-firm-negative-read-proof (T-8 — analytics of firm A never include firm B), empty-state-div-by-zero-safe, RBAC-scoped-read, perf-cache-carries-workspace_id-if-added, no-gold-plating (no real-time/charts-lib/export). design_gap_flag false. _TBD metric = founder-poll before M9 close (not a build hard-stop).

```yaml
verdict: PROCEED
wave_type: multi-spec
claimed_task_ids: [a5ba8068-2e1b-48ea-83d9-6da739a41e2b, 9e05828b-38dd-475c-9f82-cd5ac4565fff, 4b014689-8e12-4560-95c9-5b0ae4d2f4fc]
floor_merge_attempt: 0
design_gap_flag: false
security_scope_note: "post-M8 isolation — analytics MUST be workspace-scoped; cross-firm-negative-read is load-bearing (T-8). Not auth/payment-scope-tightened, but the isolation-respect is a hard invariant."
