# C-2 — Deploy & verify (wave 6 — deal-sourcing data spine) — RE-RUN #2

**Stage:** C-2 (CI/CD block, deploy-and-verify incl. canary)
**Head:** head-ci-cd (fresh spawn, gates C-block)
**Target commit:** `96179b051712f47a1254ae989ca239e26ec9eb15` (`96179b0`, main tip — the DI-fix merge)
**Outcome:** **FAIL (REJECTED)** — DI boot crash is FIXED (api now boots clean), migration 0004 applied live, but a NEW runtime defect surfaced: `POST /sourcing/connections/:id/sync` crashes HTTP 500 because the fixture JSON asset is missing from the compiled `dist/` (build-asset-copy gap). The LIVE dedupe payoff could NOT be exercised. Routed to B-block per Iron Law.

---

## What this re-run fixed vs. what it caught

**Prior C-2 (commit `5f33c7c`) FAIL — now RESOLVED:** the `SourcingService` `UnknownDependenciesException` (import-type-erases-DI-metadata) is gone. The redeploy at `96179b0` boots clean:
- Runtime log: `SourcingModule dependencies initialized` → `Nest application successfully started` → `API listening on port 3001`. NO `UnknownDependenciesException`.
- All 4 sourcing routes mapped live: `/sourcing/connections/:id/sync`, `/sourcing/companies`, `/sourcing/companies/:id`, `/sourcing/dedupe-candidates/:id/resolve`.

**This re-run's NEW catch — a second "green-CI, broken-runtime" defect:** the first real call to the sync ETL 500s because the fixture dataset asset is not in the deployed build output. This is exactly the false-green class C-2 exists to stop; it is a genuine REJECTION, not a test-setup error.

---

## Action 0 — Railway credential (PRESENT)

- `APP_RAILWAY_TOKEN` (36 chars) mapped to `RAILWAY_TOKEN`; deploy-scoped `project(id:)` probe returned `data.project` (5 services) + `errors:null`. Token authenticates. (Prior "no RAILWAY_TOKEN" false-negative stays cleared.)
- Project `ce095f75-…` (`app-arina-5ywq3s`), env `production` `0e84f0b6-…` (single env; not created).

## Action 1/2 — Deploy trigger + verification (SUCCESS)

**Rollback path armed BEFORE mutating (Rollback-Blind-Deploy guard):**
- api previous known-good deploy id cached: `e0d2c2e6-e5a7-4115-8a12-a247c2d9f7bb` (SUCCESS, prior build). The intervening `274764d8` was the prior-attempt FAILED DI-crash deploy — took no traffic.
- web previous known-good: `4af724f1-…` (SUCCESS).

**Service topology (verified via GraphQL, not assumed):**
- api `preDeployCommand`: `pnpm --filter @dealflow/api exec drizzle-kit migrate` — migration 0004 applies as a one-shot BEFORE the container serves traffic (correct expand-only sequencing; healthcheckTimeout 300s).
- api `startCommand`: `node apps/api/dist/main.js`. Source repo `arina477/dealflow-ai`, branch `main`.

**Deploy triggered at the EXACT SHA** via `serviceInstanceDeployV2(serviceId, environmentId, commitSha:"96179b0…")` (env ID = the founder-supplied production env, no cross-env pollution):
- api deploy id: `2fe554e3-aacb-47fc-8820-f568b8032d0c` → **SUCCESS** @ ~91s. `meta.commitHash = 96179b051712f47a1254ae989ca239e26ec9eb15`; fresh `imageDigest sha256:83f5877…`; `reason: deploy` (NOT SKIPPED).
- web deploy id: `6a4a384b-ca01-4693-915e-eeb4281546f1` → **SUCCESS** @ ~91s. `meta.commitHash = 96179b0…`.
- api re-deploy `3c3a9676-f04b-4122-b8cc-bacfa2d7a3a6` (SUCCESS) — issued to bind the corrected `GIT_SHA` env var (see health note). Prior-good rollback now `2fe554e3`.

**Wait-for-CI phantom-skip guard:** deploy triggered explicitly via GraphQL mutation with the verified SHA (not relying on Railway's opaque GitHub webhook); `meta.commitHash` confirms the exact hash shipped; status SUCCESS (not SKIPPED).

## Migration 0004 — APPLIED + verified against live Postgres

Verified over a temporary Railway TCP proxy on the postgres service (created + torn down this run):
- Drizzle journal `drizzle.__drizzle_migrations`: migrations applied through idx 5 (wave-6 sourcing migration is journal idx 4 `2c1ee91…`). Boot log also showed `[✓] migrations applied successfully!` during the preDeploy one-shot.
- **All 7 target tables present:** `companies`, `company_provenance`, `contact_provenance`, `contacts`, `data_source_connections`, `dedupe_candidates`, `raw_companies`.
- **Both partial-unique indexes present:** `companies_normalized_domain_partial_unique` (canonical-per-domain backstop) + `dedupe_candidates_raw_matched_pending_unique` (re-sync no-pile-up backstop).
- Migration is additive-only (static gate PASS in prior run); applied cleanly with no destructive DDL and no lock on live traffic (brand-new tables).

## Action 3 — Health probe (Health Check Mirage guard — deployed HASH verified)

- Initial live `/health` reported `version:13e55ef` (the OLD value) even after boot. **Did NOT rubber-stamp on this.** Investigated: `HealthService.check()` derives `version` from `process.env.GIT_SHA` — a Railway service variable, NOT the git SHA that `serviceInstanceDeployV2(commitSha)` deploys. The env var was a stale static value; it did not prove which build was live either way.
- **Definitive liveness proof (not the global-domain 200):** the new-only `/sourcing/*` routes return **401** (auth required), NOT 404 — these routes exist ONLY in `96179b0` (the old `13e55ef` build predates the entire sourcing module). Control: `/compliance/summary` → 401 (exists in both), a bogus route → 404. So the new build IS live and serving.
- **Env-var binding fix:** upserted `GIT_SHA=96179b0` on dealflow-api (single non-destructive `variableUpsert`) and redeployed. `/health` now returns `{"status":"ok","db":"ok","version":"96179b0"}` — truthful health reporting; version now matches the exact deployed hash.
- No active outage throughout — production stayed served the entire time.

## LIVE dedupe verification — **BLOCKED by sync 500 (NEW defect)**

Verification harness set up correctly (all real, no mocks):
- Fresh ANALYST provisioned live: `POST /auth/invite {role:analyst}` → token → `POST /auth/signup` → 201 + SuperTokens session cookies (`sAccessToken`/`sRefreshToken`, HttpOnly/Secure); `GET /auth/me` confirmed `role:analyst`.
- Seeded a `data_source_connection` (provider_key=`FIXTURE`, enabled) directly via the temp DB proxy (no HTTP create route exists — sync/list/resolve only). Connection id `a23e4f3e-…`.
- **Sync attempt:** `POST /sourcing/connections/a23e4f3e-…/sync` (analyst session + `rid: anti-csrf` header + web Origin) → **HTTP 500 `Internal server error`.**

**Root cause (log-confirmed, source-confirmed) — build-asset-copy defect:**
> `Error: FixtureDataSourceAdapter: failed to read fixture at "/app/apps/api/dist/modules/sourcing/fixtures/companies.fixture.json": Error: ENOENT: no such file or directory` — at `FixtureDataSourceAdapter.fetchCompanies (fixture.adapter.js:65)` via `IngestionService.sync (ingestion.service.js:110)`.

- `fixture.adapter.ts` reads `join(__dirname, '..', 'fixtures', 'companies.fixture.json')` → `dist/modules/sourcing/fixtures/companies.fixture.json` at runtime.
- Build is `nest build`; `apps/api/nest-cli.json` has NO `compilerOptions.assets` directive + `deleteOutDir:true`, so the non-TS `.json` fixture is never emitted to `dist/`.
- CI was green because vitest/ts-node resolve against `src/` (asset present there); only the compiled `dist/` deploy is missing it. Classic green-CI / broken-runtime — the exact false-green C-2 catches.
- **No partial/corrupt data:** the 500 aborted cleanly — all 6 sourcing tables have 0 rows (verified post-failure). Transactional hygiene intact.

**Downstream payoff NOT run (no fabricated results):** cross-source→1-canonical acme.com, 2 company_provenance + contact_provenance, ambiguous→dedupe_candidate, idempotent re-sync, audited dedupe-resolve, RBAC 200/403/401 on the mutating flows, regression — all deferred to the fixed redeploy. The sync ETL never produced a row.

## Root-cause classification + routing (Iron Law: classify + route, do NOT fix)

- **Triage tag:** `build` ("Build / bundling / packaging error" per `command-center/dev/triage-routing-table.md`) — NOT `debugging`; the logic is correct, the build OUTPUT is incomplete. Domain: backend/build.
- **Routed to `devops-engineer`** (build-config integrity, per delegation pattern #3). Fix authored + locally verified (NOT committed — the B-block drives PR→C-1→merge):
  - Add scoped `compilerOptions.assets` to `apps/api/nest-cli.json`:
    `{ "include": "modules/sourcing/fixtures/**/*.json", "outDir": "dist", "watchAssets": true }`.
  - Scoped glob (not `**/*.json`) deliberately avoids copying drizzle-kit `meta/*.json` migration snapshots into the image.
  - Post-`nest build` verification: `dist/modules/sourcing/fixtures/companies.fixture.json` (1290 bytes) now lands at the exact adapter-read path.
  - Specialist recommends the B-block also add a build-output regression assertion (test the compiled `dist/` asset presence, or construct the adapter against the `dist/` copy) to permanently close this class.
- **Next:** B-block commits the `nest-cli.json` fix (+ recommended regression assertion) → fresh PR → C-1 CI green → squash-merge to main → C-2 re-runs (re-deploy + full LIVE dedupe payoff).

## Canary

`canary_status: skipped` — 0 DAU (< 1000 threshold) AND the data-correctness payoff did not complete. No canary armed.

## Cleanup (temp infra removed)

- Seeded test `data_source_connection` deleted (0 `C2 Verify Fixture` rows remain).
- Temporary postgres TCP proxy `fbf033e1-…` (`hayabusa.proxy.rlwy.net:53466`) deleted; `tcpProxies` list now empty.
- Temp secret files (proxy conn string, cookie jar) scrubbed from `/tmp`. No secrets committed at any point.

---

```yaml
ci_stage_verdict: FAIL
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway credential PRESENT: deploy-scoped project(id:) probe returned data.project + errors:null (token=APP_RAILWAY_TOKEN)"
  - "api deploy 2fe554e3-…: SUCCESS @ 96179b0 (meta.commitHash=96179b051712f47a1254ae989ca239e26ec9eb15, imageDigest sha256:83f5877…, reason:deploy NOT SKIPPED)"
  - "web deploy 6a4a384b-…: SUCCESS @ 96179b0"
  - "api boot log: SourcingModule dependencies initialized → Nest application successfully started → API listening (DI crash FIXED, no UnknownDependenciesException)"
  - "migration 0004 APPLIED live: drizzle journal idx4 present; 7 target tables + 2 partial-unique indexes verified via temp DB proxy; preDeploy log '[✓] migrations applied successfully!'"
  - "liveness proof: new-only /sourcing/* routes return 401 (not 404); control /compliance/summary 401, bogus route 404 → 96179b0 IS live"
  - "GIT_SHA env upserted to 96179b0 + redeploy → /health now {status:ok,db:ok,version:96179b0} (truthful; deployed-hash verified, mirage avoided)"
  - "POST /sourcing/connections/:id/sync → HTTP 500: FixtureDataSourceAdapter ENOENT dist/modules/sourcing/fixtures/companies.fixture.json (build-asset-copy gap)"
  - "post-500 DB check: all 6 sourcing tables 0 rows — clean abort, no partial data"
deploy_targets:
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 96179b0, deploy_id: 6a4a384b-ca01-4693-915e-eeb4281546f1}
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 96179b0, deploy_id: 3c3a9676-f04b-4122-b8cc-bacfa2d7a3a6, health_version_live: 96179b0, boots_clean: true}
rollback_path:
  api_known_good_deploy_id: 2fe554e3-aacb-47fc-8820-f568b8032d0c   # SUCCESS @ 96179b0 (boots clean; prev-prev e0d2c2e6 also good)
  web_known_good_deploy_id: 4af724f1-b86a-4934-99ca-0f576662a879
  note: "api boots clean this run; no rollback needed. Cached before every mutation per Rollback-Blind-Deploy guard."
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000) AND data-correctness payoff did not complete; no canary."
canary_alerts: []
migration_0004:
  applied_live: true
  tables_verified: [companies, company_provenance, contact_provenance, contacts, data_source_connections, dedupe_candidates, raw_companies]
  partial_unique_indexes: [companies_normalized_domain_partial_unique, dedupe_candidates_raw_matched_pending_unique]
live_dedupe_payoff:
  run: false
  blocked_by: "sync 500 — fixture JSON asset missing from dist/ (build-asset-copy defect)"
  partial_data_written: false   # all 6 sourcing tables 0 rows post-failure (clean abort)
routing:
  iron_law: "classify + route; head-ci-cd does NOT fix directly"
  triage_tag: build
  domain: backend
  routed_to: devops-engineer
  fix_summary: "add compilerOptions.assets glob {include:'modules/sourcing/fixtures/**/*.json', outDir:'dist', watchAssets:true} to apps/api/nest-cli.json so nest build emits the fixture JSON into dist/ (locally verified: dist asset lands at adapter-read path)"
  fix_committed: false   # authored in working tree only; B-block drives PR -> C-1 -> merge
  regression_recommended: "add build-output assertion that dist/modules/sourcing/fixtures/companies.fixture.json is present post-build (close green-CI/broken-runtime class)"
  re_run: "C-2 re-runs after fix committed + merged to main"
cleanup:
  temp_tcp_proxy_deleted: fbf033e1-f63e-4ed2-a6e4-287c8419ac2a
  seeded_connection_deleted: a23e4f3e-91ff-440b-ac5e-3d25887518db
  temp_secret_files_scrubbed: true
note: >
  DI boot crash from the prior C-2 (5f33c7c) is FIXED — dealflow-api boots clean at 96179b0,
  migration 0004 applied live (7 tables + 2 partial-unique indexes verified), /health reports the
  exact deployed hash. But the LIVE dedupe payoff is blocked by a NEW build-asset-copy defect: the
  sync ETL 500s because companies.fixture.json is not emitted into the compiled dist/ (nest-cli.json
  lacks an assets directive). Classified 'build', routed to devops-engineer; fix authored + locally
  verified, NOT committed. B-block must commit -> fresh PR -> C-1 green -> merge, then C-2 re-runs.
  No fabricated green: the data-correctness payoff was NOT run because the code path crashes before
  writing any row (all sourcing tables 0 rows, clean abort).

head_signoff:
  verdict: REJECTED
  stage: C-2
  reviewers: {}
  failed_checks:
    - "LIVE cross-source dedupe payoff — NOT run (sync 500s: fixture JSON missing from dist/)"
    - "MONITOR/health success on the DATA path — sync ETL returns HTTP 500 on first real call"
    - "audited dedupe-resolve, idempotent re-sync, RBAC 403/401 on mutating flows, regression — not reachable (sync is the entry point and it fails)"
  passed_checks:
    - "DI boot crash FIXED — api boots clean (SourcingModule initialized; no UnknownDependenciesException)"
    - "deploy at EXACT env ID + EXACT commit SHA via serviceInstanceDeployV2(commitSha); meta.commitHash=96179b0; not SKIPPED"
    - "migration 0004 APPLIED + verified against live Postgres (7 tables + 2 partial-unique indexes); additive-only; preDeploy one-shot before traffic"
    - "health probe verified the deployed HASH (version=96179b0 after GIT_SHA bind) + liveness proven via new-only /sourcing routes (401 not 404) — Health Check Mirage avoided"
    - "rollback path armed (prev known-good deploy IDs cached before every mutation)"
    - "env-var binding fixed (GIT_SHA upserted so /health reports truthfully)"
    - "deploymentLogs captured + root-caused; classified 'build'/backend; routed to devops-engineer per Iron Law (NOT fixed directly; fix not merged)"
    - "no partial/corrupt data — sync 500 aborted cleanly (all sourcing tables 0 rows)"
    - "temp infra cleaned up (TCP proxy + seeded connection deleted; secret files scrubbed)"
  rationale: >
    The re-run confirmed the DI fix works — dealflow-api boots clean at 96179b0, migration 0004 is
    applied and verified live (7 tables + 2 partial-unique indexes), and /health reports the exact
    deployed hash. But C-2 cannot PASS: the core data-correctness payoff (cross-source dedupe) is
    unreachable because the sync ETL crashes HTTP 500 on its first real call. Root cause is a
    build-asset-copy defect — the fixture JSON the adapter reads at runtime is never emitted into the
    compiled dist/ (nest-cli.json lacks an assets directive). This is a second green-CI/broken-runtime
    defect, exactly the false-green C-2 exists to stop. No fabricated green: the dedupe payoff was NOT
    run because the code path fails before writing any row. Classified 'build', routed to
    devops-engineer; the fix is authored + locally verified but NOT committed — the B-block must ship
    it through a fresh PR + green CI + merge before C-2 re-runs.
  next_action: REWORK_B_BLOCK
```
