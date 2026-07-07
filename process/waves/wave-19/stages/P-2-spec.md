# Wave 19 — P-2 Spec (pointer)
**Source of truth:** seed task 5568ad44 tasks.description. wave_type multi-spec (4 blocks). design_gap_flag false.
**claimed_task_ids:** [5568ad44 (calibration seed), 69387b56 (contracts), e206a56a (API), 077974a2 (/insights section)]
## AC summary (M9 matching-feedback calibration)
1. **5568ad44 calibration service:** read-only over match_candidates — (a) overall accept-rate by fit_score band (does higher score → higher accept), (b) per-dimension acceptance-lift (sectorMatch/contactCompleteness/tieBreak); **EVERY query via getDb → app.workspace_id GUC + FORCE RLS (own-firm only, NO raw off-GUC)**; only decided (accepted/rejected) count toward rates, empty→null/n-a (no div-by-zero); READ-ONLY (no scorer-retrain, no LLM/ML).
2. **69387b56 contracts:** shared-Zod calibration shape (null-safe).
3. **e206a56a API:** GET match-feedback, shared-Zod, workspace-scoped, RBAC (advisor+admin 200 / analyst+compliance 403 / anon 401), read-only.
4. **077974a2 /insights section:** calibration cards/table on the existing /insights page; design-system reuse; NO charts-lib/real-time/export; empty-state graceful; RBAC-gated.
## Load-bearing: workspace-scoped-calibration-via-getDb | cross-firm-negative-read (T-8, REAL service not hollow — wave-18 lesson) | computable-over-real-columns | read-only-no-scorer-retrain | RBAC-scoped | no-gold-plating. _TBD metric = founder-poll before M9 close.
