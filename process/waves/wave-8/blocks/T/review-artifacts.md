# Wave 8 — T-block review artifacts
**Block:** T · **Wave topic:** mandate data spine + create/list/detail (M4 first bundle) · **Gate:** T-9 · **Status:** in-progress
| Stage | Deliverable | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | stages/T-1-static.md | ci-verified | done | typecheck+lint green |
| T-2 | stages/T-2-unit.md | ci-verified | done | 1115+ tests: one-txn/audit/actor-id/derive-disclaimer/3-acks/active-lock/DrizzleError/di-boot; 3 pages |
| T-3 | stages/T-3-contract.md | ci-verified | done | mandate Zod + rbac /mandates + audit actions; nav⊆RBAC |
| T-4 | stages/T-4-integration.md | ci-verified | done | mandate CRUD→DB (one-txn, audited); migrations 0006/0007; reuse M2 disclaimer FK; live C-2 |
| T-5 | stages/T-5-e2e.md | active | done | S1-S5 PASS; 63/64; W8-2(acks-confirm)/W8-3(hide-btn) findings |
| T-6 | stages/T-6-layout.md | active | done | 3 pages §10-conformant; TopBar→polish |
| T-7 | stages/T-7-perf.md | active | skipped | not heavy |
| T-8 | stages/T-8-security.md | active | done | FULL (compliance-adjacent): RBAC + audit + actor-id + one-txn + derive-disclaimer + 3-acks + active-lock + secret-grep |
| T-9 | stages/T-9-journey.md | active | pending | gate + journey regen |
- **wave_type:** multi-spec (backend + ui). T-8 FULL (compliance-profile + audit + RBAC). T-7 skip.
