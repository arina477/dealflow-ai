# Wave 26 — B-2 Backend (M10 FINAL-hardening: RLS connection-split deploy contract)

**Specialist:** backend-developer · **Task:** 1a1c5855 · **Branch:** wave-26-rls-connection-split-docs

---

## Summary

Three deliverables implemented (+ MG1/MG2):

### Part 1 — RLS connection-split & role-privilege deploy contract (devops.md)

New section added to `command-center/dev/architecture/devops.md` under "Stack-Specific Decisions":

- **Role split:** runtime `DATABASE_URL=dealflow_app` (NOSUPERUSER NOBYPASSRLS — FORCE RLS enforced, [RLS-GUARD] fails-closed if superuser/bypassrls is ever used) vs `MIGRATE_DATABASE_URL=owner` (preDeploy DDL/GRANT/RLS-policy migrations only).
- **PATH-safe preDeployCommand:** documents the wave-17 api deploy #1 failure — the `bash -lc` wrapper reset PATH → `pnpm: command not found`. The working form is the bare env-prefix: `DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm --filter @dealflow/api exec drizzle-kit migrate`.
- **Coupled-rollback:** rolling back a deployment that changed role privileges MUST revert BOTH the deployment AND the runtime `DATABASE_URL` → owner if the target (older) code lacks [RLS-GUARD]/dealflow_app expectations. Hazard, procedure, and the additive-only migration note all documented.

### Part 2 (MG2) — Stale §"Postgres migrations in CI" corrected

The stale text claimed migrations use "the same POSTGRES_URL Railway injects into the api service" and described a "one-shot Railway job triggered after a successful deploy." Both were wrong. Corrected to:
- Prod preDeploy migration runs as a Railway `preDeployCommand` (before traffic is routed), using `MIGRATE_DATABASE_URL=owner` — not the runtime URL.
- CI test-DB migration (`ensureMigrated()` against `TEST_DATABASE_URL`) is documented separately as the distinct ephemeral-container flow.
- The section now cross-references the new contract section.
- devops.md is internally consistent.

### Part 3 — Standing deploy-AC checklist + mechanize the checkable half

**Standing deploy-AC checklist** (in devops.md § "RLS connection-split & role-privilege deploy contract"):

- [ ] Both DB URLs set + distinct (`assertUrlsDistinct()` verifies at boot)
- [ ] Runtime role NOBYPASSRLS (enforced by [RLS-GUARD] — `assertNonSuperuserConnection()`; `GET /health` db:ok is the positive proof)
- [ ] preDeployCommand PATH-safe (bare env-prefix, no login-shell wrapper)
- [ ] Rollback plan reverts BOTH deployment AND runtime `DATABASE_URL` → owner if target commit predates [RLS-GUARD]/dealflow_app

**MG1 — [RLS-GUARD] doc/message only (logic UNCHANGED):**

`assertNonSuperuserConnection()` in `apps/api/src/db/index.ts` (lines 51–79 pre-wave, adjusted post-edit) — the predicates `is_superuser === 'on'` and `row.has_bypassrls`, and the fail-closed throw — are untouched. Only the JSDoc comment was updated to reference the 2-URL contract and the new devops.md section. The error messages were updated to say "dealflow_app role URL" (clarifying) and to add the devops.md cross-reference alongside the existing migration 0016 reference. Predicate logic and throw behavior: UNCHANGED.

**2-URLs-distinct preflight — `assertUrlsDistinct()`:**

New exported function added to `apps/api/src/db/index.ts`. Synchronous (no DB connection required). Logic:
- `MIGRATE_DATABASE_URL` not set → no-op (local dev / test / preDeploy-only context).
- `DATABASE_URL === MIGRATE_DATABASE_URL` → throws `[RLS-GUARD] DATABASE_URL and MIGRATE_DATABASE_URL are identical`.
- Distinct → no-op (correct configuration).

Wired in `apps/api/src/main.ts` bootstrap, before `assertNonSuperuserConnection()`, under `NODE_ENV !== 'test'` guard (consistent with existing pattern; also a genuine no-op in test mode since `MIGRATE_DATABASE_URL` is absent from the vitest env set).

**Unit test:** `apps/api/src/db/url-distinct-preflight.spec.ts` — 3 cases:
- PREFLIGHT-1: `MIGRATE_DATABASE_URL` absent → no throw (graceful no-op).
- PREFLIGHT-2: Both set + equal → throws `[RLS-GUARD]` + `identical`.
- PREFLIGHT-3: Both set + distinct → no throw.
All 3 pass. Full suite: 986 passed, 95 skipped (pre-existing e2e skips on `TEST_DATABASE_URL`). Zero regressions.

### GAP-3 — Deferred (no ci.yml change)

The CI test-DB role (non-superuser mirror of `dealflow_app` in the GitHub Actions `test-unit` job) is documented in devops.md under § "GAP-3 — deferred" and in the Risk/Open Items table as R-7. No `ci.yml` change was made. Reason: PAT lacks `Workflows:write` permission.

---

## Verification

- `pnpm -w typecheck` → 4 successful, 4 total. Clean.
- `pnpm -w lint` → 3 successful, 3 total. Exit 0 (pre-existing warnings/infos — no new errors).
- `pnpm --filter @dealflow/api exec vitest run` → 986 passed, 95 skipped. Preflight tests PREFLIGHT-1/2/3 all green.

## Deviations

None. All three parts delivered per spec:
- MG1 satisfied: `assertNonSuperuserConnection` predicate logic and fail-closed throw are UNCHANGED; only doc/message updated.
- MG2 satisfied: stale §"Postgres migrations in CI" corrected and internally consistent with the contract section.
- GAP-3 correctly deferred: no ci.yml change.
- No ci.yml touched.
- No product code or schema changed.
