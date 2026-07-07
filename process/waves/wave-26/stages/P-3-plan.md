# Wave 26 — P-3 Plan (single-spec: M10 FINAL-hardening RLS connection-split ACs)
## Approach — document the contract + standing deploy-AC + mechanize the checkable portion
### Action 1 — Deliverables
1. **Doc the contract** in command-center/dev/architecture/devops.md (new section "RLS connection-split & role-privilege deploy contract"): the runtime/owner split (DATABASE_URL=dealflow_app NOSUPERUSER NOBYPASSRLS runtime vs MIGRATE_DATABASE_URL=owner preDeploy), the PATH-safe preDeployCommand form (why bash -lc wrappers reset PATH → pnpm-not-found; the working bare form), coupled-rollback (revert deployment AND runtime DATABASE_URL→owner; the hazard: old code lacks [RLS-GUARD]/GUC handling).
2. **Standing deploy-AC checklist** (in devops.md or a linked deploy-checklist): for any future migration touching role privileges/GRANTs/RLS — [ ] both DB URLs set + distinct; [ ] runtime role NOBYPASSRLS (enforced by [RLS-GUARD]); [ ] preDeployCommand PATH-safe; [ ] rollback plan reverts BOTH deployment + runtime URL.
3. **Mechanize the checkable half** (BUILD #11):
   - DOCUMENT the EXISTING [RLS-GUARD] startup check (apps/api — the fail-closed assertion the runtime role is NOT superuser/bypassrls) as the MECHANICAL anchor of the runtime-role AC. Verify it exists + strengthen its message/coverage if thin.
   - ADD a lightweight preflight assertion (a startup or a migrate-time check) that MIGRATE_DATABASE_URL (or the owner URL) is set + DISTINCT from DATABASE_URL when running migrations that touch role privileges — OR, if that's not cleanly separable, a startup log/assert that the two are distinct when both are set. Keep it small + no ci.yml change (PAT-blocked).
### Action 2-4 — Data model: none. API: none. Deps: none. No LLM/SDK/secret. NO ci.yml change (GAP-3 deferred — PAT lacks Workflows:write).
## Plan (by B-stage)
**B-0 Schema:** SKIP (no schema).
**B-1/B-2** (backend-developer — has the RLS/[RLS-GUARD]/deploy context): author the devops.md contract section + the standing deploy-AC checklist + verify/document the [RLS-GUARD] anchor + add the 2-URLs-distinct preflight assertion (+ a test for the preflight if it's code). Accurately reflect the REAL C-2 deploy contract (the 2 URLs, the PATH gotcha, coupled-rollback).
**B-3 Frontend:** SKIP (no UI).
**B-4/B-5/B-6:** head-builder polices: the contract is ACCURATE (matches the real deploy), the ACs are CONCRETE/checkable (not process-theater), the [RLS-GUARD] anchor is real, the preflight (if added) works + is tested, GAP-3 correctly deferred, NO recordkeeping-scope-creep.
### Action 6 — Specialist: backend-developer. Serial.
### Action 8 — Self-consistency CLEAN.
```yaml
deps_new: []
schema_change: false
new_secret: false
new_sdk: false
ci_yml_change: false   # GAP-3 deferred (PAT lacks Workflows:write)
specialists: [backend-developer]
compliance_invariants: [runtime-role-NOBYPASSRLS-enforced-by-RLS-GUARD, 2-db-urls-distinct-preflight, coupled-rollback-AC, path-safe-predeploy-AC]
hard_boundaries: "docs/devops hardening ONLY — document the REAL RLS connection-split deploy contract accurately (from the C-2 evidence) + a CONCRETE standing deploy-AC + mechanize the checkable half ([RLS-GUARD] anchor + 2-URLs-distinct preflight); NO ci.yml change (GAP-3 deferred, PAT-blocked); NO recordkeeping-vertical scope (founder-reserved); NO product code/schema"
design_gap_flag: false
self_consistency: clean
```
