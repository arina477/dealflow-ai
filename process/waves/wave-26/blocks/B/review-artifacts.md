# Wave 26 — B-block review artifacts
**Wave topic:** M10 FINAL-hardening — document + AC the RLS connection-split deploy contract + mechanize the checkable half | **Block exit gate:** B-6 | **Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | (claim+branch) | done | schema SKIP; branch wave-26-rls-connection-split-docs |
| B-1/B-2 | stages/B-2-backend.md | pending | devops.md contract + correct-stale-§225-227 + standing-AC + [RLS-GUARD]-doc + 2-URLs-preflight+test |
| B-3 | — | SKIP | no UI |
| B-4/B-5/B-6 | ... | pending | |
## Deliverable (3 parts + MG1/MG2):
1. devops.md documents the RLS connection-split contract (runtime dealflow_app NOBYPASSRLS / owner MIGRATE_DATABASE_URL; PATH-safe preDeployCommand; coupled-rollback) ACCURATE to the real C-2 deploy.
2. A CONCRETE standing deploy-AC checklist for future role-privilege migrations (2-URLs-distinct, runtime-NOBYPASSRLS, PATH-safe, coupled-rollback).
3. Mechanize the checkable half: DOCUMENT the existing [RLS-GUARD] (assertNonSuperuserConnection) as the runtime-role anchor + ADD a 2-URLs-distinct preflight assertion (+ test).
## MG1 (BINDING): [RLS-GUARD] work is DOC/MESSAGE-only. assertNonSuperuserConnection logic (index.ts:51-92, throws on is_superuser=on OR rolbypassrls) is load-bearing security — B-6 REJECTS any change to the predicates or the fail-closed throw.
## MG2 (BINDING): CORRECT the stale devops.md §"Postgres migrations in CI" (~225-227) that claims "same POSTGRES_URL" — contradicts the real 2-URL split. Make devops.md internally consistent.
## GAP-3 DEFER: dedicated CI DB role → PAT lacks ci.yml Workflows:write → documented follow-up, NOT attempted. NO ci.yml change.
