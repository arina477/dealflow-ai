# Wave 24 — P-2 Spec (pointer)
**Source of truth:** seed fd8f2860 tasks.description + this scoped contract. single-spec. design_gap false, D-skip.
**claimed_task_ids:** [fd8f2860]
## AC (M10 compliance-hardening — standing populated-migration AC):
1. **Standing AC documented:** any migration touching audit_log_entries or any WORM/append-only/hash-chained table MUST ship a populated-DB migration test (seed rows → migrate → assert applies + verifyChain ok + invariants). Empty-CI-DB testing insufficient (wave-17 C-2 HOLD rationale cited).
2. **Reusable populated-DB migration test template/helper** generalized from audit-migration-populated-db.e2e (AMP-1..5) — copy-able, NOT a framework/DSL.
3. **MECHANICAL enforcement (load-bearing — "not prose"):** a lightweight CI check that flags a WORM/audit-touching migration lacking its populated-DB test → FAILS; with a SELF-TEST proving it fault-kills (untested WORM migration → check fails; tested → passes). Must PASS on the current tree (0014/0018 audit-touching migrations already have their populated-DB tests). Enforcement point named explicitly.
## Load-bearing: the AC is MECHANICALLY enforced (a real fault-killing CI check, not toothless prose — the wave-21 process-theater guard); the template is copy-able not over-abstracted; the check is green on the current tree. FLAGS: M10 recordkeeping-decomposition due 1-2 waves; M10 _TBD metric poll (founder).
