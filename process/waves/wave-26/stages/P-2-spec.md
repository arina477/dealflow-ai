# Wave 26 — P-2 Spec (pointer)
**Source of truth:** seed 1a1c5855 tasks.description + this contract. single-spec. design_gap false, D-skip.
**claimed_task_ids:** [1a1c5855]
## AC (M10 FINAL-hardening — RLS connection-split deploy contract):
1. **devops.md documents the contract:** runtime dealflow_app (NOSUPERUSER NOBYPASSRLS) vs owner MIGRATE_DATABASE_URL (preDeploy); the PATH-safe preDeployCommand form (the bash -lc PATH-reset gotcha); coupled-rollback (revert deployment AND runtime DATABASE_URL→owner; the old-code-lacks-RLS-GUARD hazard). ACCURATE to the real C-2 deploy.
2. **A CONCRETE standing deploy-AC checklist** for future role-privilege migrations (2-URLs-distinct, runtime-NOBYPASSRLS, PATH-safe-preDeploy, coupled-rollback) — checkable, not vague prose (BUILD #11 / wave-21 anti-theater).
3. **Mechanize the checkable half:** document the EXISTING [RLS-GUARD] startup fail-closed check as the mechanical anchor of runtime-role-NOBYPASSRLS + add a small 2-URLs-distinct preflight assertion (tested if code). NO ci.yml change (GAP-3 deferred).
## Load-bearing: ACCURATE contract (from real deploy evidence) + CONCRETE/checkable ACs (not theater) + the [RLS-GUARD] mechanical anchor is real + the preflight works. STAY OUT of recordkeeping scope (founder-reserved; wave-27 pause). FLAGS: wave-27 enforced founder-pause; M9+M10 _TBD polls.
