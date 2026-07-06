# Wave 18 — P-0 Frame

## Discover
- wave_db_id: 0f32f35c-2531-4d21-bb1b-970acb23f5df (wave_number 18, milestone M9)
- Prior-work: M8 data-isolation shipped LIVE @591b3f8 (BOARD closed M8→done). M9 promoted at wave-17 N-1. This is M9's analytics vertical (the CRM-adapter half is founder-gated, deferred).
- Roadmap milestone: M9 — Integrations & insight (in_progress, Class product-feature, Tier T4, H2). Success metric _TBD-by-founder ("advisors sync CRM + see response/throughput analytics").
- Spec-contract short-circuit: no-prior-spec (decomposer prose) → full P-1..P-3.
- Product decisions: the CRM DataSourceAdapter (task 345dfbc6) is a FOUNDER hard-stop (vendor spend + account API key) — correctly NOT seeded this wave; queued under M9, surfaced to founder digest. The _TBD quantitative metric is a founder-poll due before M9 CLOSES (ceo-reviewer) — NOT a build hard-stop; build against the qualitative "advisors see their throughput/response analytics on live data".

## Reframe
### Original framing
Analytics vertical: (seed) read-only aggregation service → 4 metric families (mandate throughput, outreach response rates, advisor productivity, match disposition), workspace-scoped; analytics API (shared-Zod, RBAC-scoped); /insights dashboard page.

### problem-framer — PROCEED
Read-only aggregation over ALREADY-SHIPPED FORCE-RLS tables via the GUC-bound getDb handle is the correct CAUSAL approach. VERIFIED all 4 metric-family tables + the match-disposition enum exist in the shipped schema; workspace-scoping is inherited automatically (aggregation over RLS-protected tables under the request GUC → per-firm analytics; no bypass path IF aggregation uses getDb not a raw off-GUC query). 4 non-blocking P-2/downstream flags:
- (1) P-2 MUST correct the GUC name: seed prose says `app.current_workspace_id`; the real GUC (workspace.interceptor.ts:126) is **`app.workspace_id`**.
- (2) T-8 MUST assert the cross-firm negative-read invariant (analytics of firm A never include firm B's data) — the load-bearing post-M8 regression guard.
- (3) P-2 cover empty-state (division-by-zero on 0 mandates/outreach) + RBAC-denied paths.
- (4) any perf-cache/materialized table MUST itself carry workspace_id + FORCE RLS (else a cache bypasses isolation).

### ceo-reviewer — PROCEED (HOLD-SCOPE)
The analytics-over-live-data vertical is the correct 9/10 movable M9 slice: felt advisor value NOW, zero founder credential/spend; the 4 families are the right ones to run a book (deal-stage conversion already covered by the pipeline facet); CRM-adapter + model-retrain legs correctly deferred; workspace-scoping central to every task. 2 guardrails: (a) treat the _TBD numeric metric as a founder-poll due before M9 closes, not before this wave builds; (b) HOLD read-only on-the-fly aggregation — NO real-time / charts-library / export gold-plating for a single pilot.

### mvp-thinner — THIN
Keep the 3-layer vertical + families (1) mandate-throughput + (2) outreach-response-rates (both named in the directional Success-metric "response/throughput"); proposed splitting (3) advisor-productivity + (4) match-disposition to siblings. FLAGGED: the split traces to the founder's directional prose + Scope, NOT a ratified quantitative bar — asks head-product to confirm-the-proxy or keep-all-4.

### Mediation (ceo-reviewer keep-4 vs mvp-thinner split-to-2) + Disposition: PROCEED, SPLIT REJECTED (keep all 4)
Per Action 6, the THIN sibling-split is REJECTED (orchestrator disposition, ratifiable at P-4 head-product):
- The founder success metric is _TBD/UNRATIFIED → thinning against an unnamed bar risks under-delivering (mvp-thinner itself flagged "keep all 4 if the founder bar leans on productivity/disposition").
- ceo-reviewer (the strategic-value lens) explicitly values ALL 4 families to "run a book".
- All 4 metric-family tables EXIST (problem-framer verified) → all 4 are buildable now over live data.
- 4 read-only on-the-fly aggregations is NOT the gold-plating ceo-reviewer warned against (that was real-time/charts-lib/export) — the incremental cost of 2 more aggregations is small; the honored HOLD-SCOPE is "no real-time/charts-lib/export", which this wave respects.
- Keeps the wave above the multi-spec floor (thinning to 2 families risked a RESCOPE-AUTO-MERGE at P-1).
Families 3+4 STAY IN-WAVE (not split to siblings). If P-4 head-product disagrees (e.g. wants to defer 3+4), it can narrow the spec then.

### Final framing → P-1
Analytics vertical, 3 claimed tasks, ALL 4 metric families. Fold in: problem-framer's 4 flags (GUC-name app.workspace_id, T-8 cross-firm-negative-read, empty-state/RBAC, perf-cache-RLS) + ceo-reviewer's guardrails (no gold-plating; _TBD metric = founder-poll-before-M9-close). design_gap: /insights is a NEW dashboard page → likely design_gap_flag TRUE (D-block) — P-1 confirms.

claimed_task_ids: [a5ba8068-2e1b-48ea-83d9-6da739a41e2b (seed), 9e05828b-38dd-475c-9f82-cd5ac4565fff, 4b014689-8e12-4560-95c9-5b0ae4d2f4fc]
