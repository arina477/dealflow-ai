# Wave 26 — B-2 (RLS connection-split deploy contract)
Commit b663615. 3 parts + MG1/MG2:
1. **devops.md contract:** § "RLS connection-split & role-privilege deploy contract" — role split (DATABASE_URL=dealflow_app NOSUPERUSER NOBYPASSRLS runtime / MIGRATE_DATABASE_URL=owner preDeploy); PATH-safe preDeployCommand (bare env-prefix `DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm ... drizzle-kit migrate`; the bash -lc-PATH-reset→pnpm-not-found gotcha that failed deploy #1); coupled-rollback (revert deployment AND runtime DATABASE_URL→owner when target predates [RLS-GUARD]; additive-only migrations = no DB downgrade). ACCURATE to C-2.
2. **MG2 stale-§ corrected:** the "same POSTGRES_URL / one-shot job" text replaced with the accurate 2-context (prod preDeploy MIGRATE_DATABASE_URL=owner vs CI test-DB ensureMigrated against ephemeral TEST_DATABASE_URL). devops.md internally consistent.
3. **Standing deploy-AC checklist** (4 items) + **MG1 [RLS-GUARD] doc-only** (assertNonSuperuserConnection predicates [is_superuser=on OR has_bypassrls] + fail-closed throw UNCHANGED — only JSDoc + error-message wording + devops.md cross-ref) + **assertUrlsDistinct() preflight** (migrate-unset→no-op; both-set-equal→throws; distinct→ok; wired main.ts before assertNonSuperuserConnection under NODE_ENV!=test) + test (url-distinct-preflight.spec.ts PREFLIGHT-1/2/3). GAP-3 deferred (devops.md note + Risk R-7, NO ci.yml).
- typecheck 4/4, lint exit 0, 986 pass / 95 skip. Deviations: none. MG1 satisfied (logic frozen), MG2 satisfied.
```yaml
skipped: false
ci_yml_change: false
rls_guard_logic_unchanged: true (MG1)
stale_section_corrected: true (MG2)
preflight_added: assertUrlsDistinct (tested)
deviations: []
```
