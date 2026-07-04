# Wave 8 — P-block review artifacts
**Block:** P (Product) · **Wave topic:** Mandate data spine + create/configure sell-side mandate (M4 first bundle) · **Block exit gate:** P-4 · **Status:** gate-passed
## Stage deliverables
| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| P-0 | process/waves/wave-8/stages/P-0-frame.md | done | PROCEED — all 3 reframers aligned; no-prior-spec; designs exist |
| P-1 | process/waves/wave-8/stages/P-1-decompose.md | done | PROCEED, multi-spec (3 tasks); design_gap_flag FALSE (designs exist → D skips) |
| P-2 | process/waves/wave-8/stages/P-2-spec.md | done | multi-spec (3 self-contained blocks) in seed ba0edebf |
| P-3 | process/waves/wave-8/stages/P-3-plan.md | done | mandate module (3 tables 0006 + service one-txn + API + 3 pages); reuse M1/M2/M3; no new dep/SDK/secret |
| P-4 | process/waves/wave-8/blocks/P/gate-verdict.md | gate-passed | head-product APPROVED; karen+jenny APPROVE (jenny iter-2 after D1-D6); Gemini 429; 2 Phase-2 iterations |
## Block-specific context
- **Wave topic:** M4 mandate data spine + create/configure sell-side mandate (mandates + buyer_criteria + compliance_profile schema, MandateService one-txn, POST advisor-guarded + audited, mandate-new form). Seed ba0edebf + siblings c070ca23 (mandates-list) + 50227055 (mandate-detail).
- **Roadmap milestone:** M4 (c67b1610…, in_progress, product-feature, T2). wave.milestone_id backfilled. wave_db_id e8ce3899-4c1a-4250-b4bc-5c3a5b51dc07 (wave_number 8).
- **claimed_task_ids (bundle):** [ba0edebf (seed), c070ca23 (mandates-list), 50227055 (mandate-detail)] — confirm/split at P-1.
- **Spec-contract short-circuit verdict:** no-prior-spec (prose seed) → full P-1..P-3.
- **design_gap:** FALSE (P-1) — design/mandate-new.html + mandates-list.html + mandate-detail.html all exist → D-block SKIPS → next block B.
- **Reuse:** M1 RolesGuard (RBAC advisor), M2 AuditService.append (last-in-txn) + compliance_rules/disclaimer_templates/suppression_list tables (compliance-profile FKs), M3 canonical company fields (buyer criteria align to them for later filtering).
- **Compliance note:** compliance-profile is CAPTURED/STORED only here; enforcement is the M6 pre-send gate. But schema FK-references M2 compliance tables + every mutation audited → P-4 security-scope-tightened gate likely applies.
- **Autonomous mode active during P-block:** automatic.
## Open escalations carried into gate
- Founder vendor decision for the real DataSourceAdapter (345dfbc6, now under M9) — surfaced, non-blocking, does NOT gate wave 8.
## Gate verdict log
<appended by fresh head-product spawn at P-4 Action 1>
