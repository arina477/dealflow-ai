# Wave 19 — P-3 Plan (multi-spec: M9 matching-feedback calibration, 4 blocks)

## Approach
### Action 1 — Architecture deltas
- **MatchFeedbackService (new module or a feedback sub-service alongside modules/analytics) [seed 5568ad44].** Read-only calibration aggregation over match_candidates (disposition + fit_score + score_breakdown JSONB). Computes: (a) overall calibration — disposition rates bucketed by fit_score band (does a higher score → higher accept rate?); (b) per-score-dimension acceptance-lift (does sectorMatch / contactCompleteness / tieBreak track acceptance?). **EVERY query via getDb(this.db)** (workspace-scoped under the app.workspace_id GUC + FORCE RLS — the wave-18 pattern; a firm's calibration only over ITS matches; NO raw off-GUC query). READ-ONLY (no scorer-retrain, no write). *Alt:* an actual scorer-retrain loop — REJECTED (ML/founder-gated, deferred; matching.ts "NO LLM" boundary). Failure domain: read-only, reuses the M8/wave-18 isolation layer.
- **shared match-feedback contracts [69387b56].** shared-Zod calibration response shape.
- **RBAC match-feedback API [e206a56a].** GET /match-feedback (or /analytics/match-calibration): @Roles advisor+admin, shared-Zod shape, workspace-scoped, read-only (403 wrong role / 401 anon).
- **/insights calibration section [077974a2].** A section on the existing wave-18 /insights page: calibration cards/table (design-system, no charts-lib). Empty-state safe (few matches → n/a). RBAC-gated (part of /insights).

### Action 2 — Data model
NO schema change (reads existing match_candidates.disposition/fit_score/score_breakdown under RLS).

### Action 3 — API contracts
- GET /match-feedback (or /analytics/match-calibration): 200 shared-Zod calibration shape (workspace-scoped, RBAC) | 403 | 401. Read-only.
- Web /insights section consumes it via the existing /analytics-style proxy.

### Action 4 — Dependencies: NONE. No charts-lib. No SDK. No secret. NO LLM/ML.

## Plan (file-level, by B-stage)
**B-0 Schema** (backend-developer): SKIP (no schema; read aggregation over shipped match_candidates).
**B-1 Contracts** (backend-developer): shared match-feedback Zod (overall calibration + per-dimension lift shapes); rbac map (/match-feedback advisor+admin).
**B-2 Backend** (backend-developer): MatchFeedbackService + repo (workspace-scoped getDb correlation queries: fit_score-band × disposition rates + per-dimension lift over score_breakdown JSONB; empty-state-safe [n/a when no matches]); controller (@Roles advisor+admin); module registration; specs INCL the cross-firm negative-read e2e (real AnalyticsService-style: 2 workspaces, firm-A calibration excludes firm-B, as dealflow_app via workspaceAls.run — the wave-18 fault-killing pattern, NOT re-implemented SQL) + empty-state + RBAC unit tests.
**B-3 Frontend** (nextjs-developer): /insights calibration section (design-system cards/table) + the proxy + empty/error states; extend the RBAC test.
**B-4/B-5/B-6:** head-builder polices workspace-scoped-via-getDb (no raw off-GUC — cross-firm leak undoes M8/wave-18), the cross-firm negative-read e2e REAL (not hollow — the wave-18 B-6 lesson), computable-over-real-columns, read-only (no scorer-retrain), RBAC, no-gold-plating.

### Action 6 — Specialists: backend-developer (B-1/B-2), nextjs-developer (B-3). Both in AGENTS.md.
### Action 7 — Parallelization: B-0(skip) → B-1 → B-2 → B-3 (serial).
### Action 8 — Self-consistency: CLEAN. LOAD-BEARING: workspace-scoped-getDb-calibration, cross-firm-negative-read (T-8, REAL not hollow), computable-over-real-columns, read-only-no-scorer-retrain, RBAC-scoped, no-gold-plating. design_gap false.

```yaml
deps_new: []
schema_change: false
new_secret: false
new_sdk: false
specialists: [backend-developer, nextjs-developer]
reuse: [wave-18 analytics module + getDb/ALS + workspace GUC + FORCE RLS + the /insights page + design-system, M1 RolesGuard/@Roles, match_candidates shipped table]
compliance_invariants: [workspace-scoped-calibration-via-getDb, cross-firm-negative-read (T-8, REAL-service not hollow — wave-18 lesson), computable-over-real-columns, read-only-no-scorer-retrain, RBAC-scoped]
hard_boundaries: "read-only calibration DISPLAY over EXISTING match data; workspace-scoped (no cross-firm leak); NO scorer-retrain/ML/LLM (founder-gated); NO charts-lib/real-time/export; reuse only"
design_gap_flag: false
self_consistency: clean
```
