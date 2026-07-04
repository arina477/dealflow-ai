# Wave 8 — P-2 Spec (pointer)
**Source of truth:** multi-spec contract in `tasks.description` of seed **ba0edebf** (3 self-contained blocks). DB wins.
**wave_type:** multi-spec. **design_gap_flag:** false. **claimed_task_ids:** [ba0edebf (spine), c070ca23 (list), 50227055 (detail)].
## AC summary
- **ba0edebf (spine):** mandate-new create form persists a configured sell-side mandate (seller/target profile + buyer criteria + compliance profile); POST /mandates (advisor/admin, one-txn 3 tables, audited last-in-txn, actor=app users.id); PATCH configure; compliance CAPTURED not enforced (M6 later); 3 tables justified (queryable for builder + M6).
- **c070ca23 (list):** /mandates list page (advisor/admin/analyst) + status filter; GET /mandates; empty-state; read-schema accepts real API serialization (wave-7 lesson).
- **50227055 (detail):** /mandates/:id detail (profile+criteria+compliance+status); GET /mandates/:id SSR-hydrated (no page-route-collision client fetch — wave-7 lesson); advisor/admin edit (PATCH, audited), analyst read-only.
## Reuse: M1 RolesGuard, M2 AuditService + compliance tables, M3 canonical fields. Deferred: buyer-universe builder (later M4 bundle).
