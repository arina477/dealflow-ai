# Wave 24 — P-3 Plan (single-spec: M10 standing populated-migration AC)
## Approach — 3 deliverables (standing AC + reusable template + MECHANICAL enforcement)
### Action 1 — Deliverables
1. **The STANDING AC (documented):** a testing-principle-adjacent requirement (command-center/testing/ or a migration-safety doc): "Any migration that INSERTs/UPDATEs/backfills or ALTERs audit_log_entries — or any WORM / append-only / hash-chained table — MUST ship a populated-DB migration test: seed representative real rows, run the migration, assert (a) it applies without error, (b) verifyChain ok:true, (c) row-count/content invariants hold. Empty-CI-DB testing is insufficient (the wave-17 C-2 HOLD: 0014's audit backfill collided with the WORM BEFORE-UPDATE trigger on 328 populated prod rows — the empty CI DB never exercised it)."
2. **A thin REUSABLE populated-DB migration test template/helper** generalized from apps/api/test/audit-migration-populated-db.e2e-spec.ts (AMP-1..5): a copy-able skeleton (seed-rows → apply-migration → assert-applies + verifyChain-ok) that a future migration test imports/adapts. NOT a framework/DSL — a documented template + a small shared helper (e.g. a `seedAndApplyMigration` / `assertChainIntactAfterMigration` util) if it factors cleanly.
3. **The MECHANICAL enforcement (the load-bearing "not-prose" requirement):** a lightweight CI check (a script run as part of the test/lint job, OR a fast vitest) that:
   - Scans the migration files (apps/api/src/db/migrations/*.sql) for DML/DDL touching audit_log_entries or the known WORM/append-only table set (a maintained allow-list of hash-chained/WORM tables).
   - For each such migration, asserts a corresponding populated-DB test EXISTS + covers it (heuristic: a test file referencing the migration id/name OR the audit-migration-populated-db suite updated in the same change; the specialist picks the most robust checkable signal — e.g. every audit/WORM-touching migration filename is listed in a `populated-migration-tested` registry the test enforces, keeping it deterministic not fuzzy).
   - FAILS (exit 1) if a WORM/audit-touching migration lacks its populated-DB test. Includes a self-test (a fixture migration touching a WORM table WITHOUT a test → the check fails; WITH → passes) so the check is itself fault-killing.
   - **Floor fallback** (if a fully-static check proves too heuristic): bind the standing AC as a mandatory B-0/P-4/B-6 gate obligation + the registry approach (a checked-in list of audit/WORM-touching migrations ↔ their tests, verified by a deterministic test). Prefer the mechanical check; document the enforcement point explicitly either way.
### Action 2-4 — Data model: none (existing audit_log_entries/WORM tables). API: none. Deps: none new. No LLM/SDK/secret.
## Plan (by B-stage)
**B-0 Schema:** SKIP (no schema).
**B-1/B-2** (backend-developer — has the audit-migration/WORM/verifyChain context): author (1) the standing-AC doc, (2) the reusable populated-DB migration test template/helper, (3) the mechanical CI check + its self-test. Wire the check into the CI test/lint job.
**B-3 Frontend:** SKIP (no UI).
**B-4/B-5:** typecheck/lint/build; the new check RUNS (self-test green) + doesn't false-fail on existing migrations (the existing audit-touching migrations 0014/0018 already have their populated-DB tests — the check must pass on the current tree).
**B-6:** head-builder gates: the AC is ENFORCED mechanically (the check is real + fault-killing via its self-test, not toothless prose), the template is copy-able (not a framework), the check passes on the current tree (0014/0018 covered) + fails on an untested WORM migration.
### Action 6 — Specialist: backend-developer. Parallelization: single deliverable.
### Action 8 — Self-consistency CLEAN.
```yaml
deps_new: []
schema_change: false
new_secret: false
new_sdk: false
specialists: [backend-developer]
reuse: [audit-migration-populated-db.e2e-spec AMP-1..5 (the template source), verifyChain, the migrations dir]
compliance_invariants: [populated-DB-migration-test-standing-AC, mechanically-enforced (CI check + self-test), verifyChain-ok-post-migration]
hard_boundaries: "process/testing-infra hardening ONLY — a standing AC + a COPY-ABLE template (not a framework/DSL) + a MECHANICAL CI check (not prose); the check must pass on the current tree (0014/0018 already tested) + fail on an untested WORM/audit migration (self-test fault-killing); NO product code/migration/UI, NO new dep"
design_gap_flag: false
d_block: skip
self_consistency: clean
```
