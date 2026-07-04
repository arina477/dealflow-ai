# Wave 9 — P-2 Spec (pointer)
**Source of truth:** multi-spec contract in `tasks.description` of seed **92a8ff3f** (3 self-contained blocks). DB wins.
**wave_type:** multi-spec. **design_gap_flag:** false. **claimed_task_ids:** [92a8ff3f (spine), 394a60ba (page), c907731f (enrich/submit)].
## AC summary
- **92a8ff3f (spine):** buyer_universe (FK mandates) + buyer_universe_candidates (FK companies) schema (additive migration 0008) + BuyerUniverseService assemble (from M3 companies) + filter (by M4 criteria, per-candidate include/exclude provenance) + list; RBAC analyst-primary + audited + actor-id. NO scoring/ranking/LLM (M5).
- **394a60ba (page):** /buyer-universe page (assemble/filter/review candidates) mounting on the mandate-detail D6 anchor; SSR-hydrated; apiFetch rid.
- **c907731f (enrich/submit):** enrich included candidates from M3 contacts + flag gaps + submit-to-matching (ready-to-rank status handoff to M5); audited. NO ranking.
## Reuse: M3 companies/contacts (source), M4 criteria, M1 RBAC, M2 audit. M4/M5 boundary: assemble+filter+enrich+submit, NO rank. Completes M4.
