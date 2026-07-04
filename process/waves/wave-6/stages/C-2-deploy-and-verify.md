# C-2 — Deploy & verify (wave 6 — deal-sourcing data spine)

**Stage:** C-2 (CI/CD block, deploy-and-verify incl. canary)
**Head:** head-ci-cd (fresh spawn, gates C-block)
**Target commit:** `5f33c7ce280bbac9835b611f07eb9cfe5bce48c3` (`5f33c7c`, main tip)
**Outcome:** **FAIL** — new `dealflow-api` build crash-loops on boot (NestJS DI wiring defect). Deploy did NOT ship. Routed to B-block per Iron Law.

---

## Correction of the prior C-2 record (FALSE-NEGATIVE cleared)

The previous C-2 write claimed an infra-readiness hard stop ("RAILWAY_TOKEN absent"). **That was a false-negative.** The credential IS present under env var `APP_RAILWAY_TOKEN` (36 chars); the prior attempt read the empty `RAILWAY_TOKEN` and blocked without falling back. This run:

- Mapped `RAILWAY_TOKEN="$APP_RAILWAY_TOKEN"` from `~/.config/claudomat/runtime.env`.
- **Verified the token is usable** with a deploy-scoped GraphQL probe (`Project-Access-Token` header, `project(id:)` query): returned `data.project` with all 5 services and `errors: null`. Token authenticates. Action 0 credential gate: **PRESENT**.

The C-2 FAIL below is NOT a credential problem. It is a wave-6 application code defect surfaced only at real runtime boot.

---

## Action 0 — Railway credential (PRESENT)

- Env: `APP_RAILWAY_TOKEN` len 36 → mapped to `RAILWAY_TOKEN`.
- Project `ce095f75-…` (`app-arina-5ywq3s`), env `production` `0e84f0b6-…` (single env; not created).
- Services: `dealflow-api` `dcdb4ab4-…`, `dealflow-web` `06b07f19-…`, `postgres` `43bbb393-…`, plus `supertokens-core` / `supertokens-db` (auth).
- Deploy-scoped probe exit 0 (`.data.project != null and (.errors|not)`).

## Action 1/2 — Deploy trigger + verification

**Pre-deploy state (rollback path armed BEFORE mutating):**
- api previous known-good: deployment `e0d2c2e6-e5a7-4115-8a12-a247c2d9f7bb` — SUCCESS @ `13e55ef`.
- web previous known-good: deployment `59dd897f-f962-4bb0-a4a5-3aa57856a849` — SUCCESS @ `13e55ef`.
- Both services were serving `13e55ef` — i.e. wave-6 `5f33c7c` was NOT previously deployed.

**Service topology (verified via GraphQL, not assumed):**
- api `preDeployCommand`: `pnpm --filter @dealflow/api exec drizzle-kit migrate` (migration 0004 applies as a preDeploy one-shot BEFORE the container serves traffic — correct expand-only sequencing).
- api `startCommand`: `node apps/api/dist/main.js`. Source: GitHub repo `arina477/dealflow-ai`.

**Deploy triggered at the EXACT SHA** (not "latest") via `serviceInstanceDeployV2(serviceId, environmentId, commitSha:"5f33c7ce…")`:
- api deploy id: `274764d8-ce98-46f5-8816-62200f978019`
- web deploy id: `4af724f1-b86a-4934-99ca-0f576662a879`

**Poll result (30s cadence, bounded):**
- web: BUILDING → DEPLOYING → **SUCCESS** @ ~122s.
- api: BUILDING → DEPLOYING (~270s in DEPLOYING, crash-looping) → **FAILED** @ ~394s.

## Migration 0004 — static verification (additive-only PASS; NOT applied live)

Static analysis of `apps/api/src/db/migrations/0004_wandering_harry_osborn.sql` (journal-registered idx 4):
- **Additive-only.** All `CREATE TYPE` / `CREATE TABLE` / `ADD CONSTRAINT` / `CREATE INDEX`. Zero `DROP TABLE` / `DROP COLUMN` / destructive DDL. Passes the zero-downtime additive-only gate.
- All 7 target tables defined: `companies`, `company_provenance`, `contact_provenance`, `contacts`, `data_source_connections`, `dedupe_candidates`, `raw_companies`.
- Both hand-appended partial-unique indexes present: `companies_normalized_domain_partial_unique` (canonical-per-domain backstop) + `dedupe_candidates_raw_matched_pending_unique` (re-sync no-pile-up backstop). Both target brand-new tables → no lock on live traffic.
- **NOT confirmed applied against live Postgres** — the api container never booted, so the preDeploy migration result cannot be asserted as applied-and-verified. Migration correctness is a static PASS only; live application is UNVERIFIED and must be re-checked on the fixed redeploy.

## Root-cause classification (Iron Law: classify + route, do NOT fix)

**Failure:** `dealflow-api` `274764d8` FAILED — crash-loop on boot, NOT a build error, NOT a migration error, NOT infra.

**Deployment log (verbatim key line):**
> `UnknownDependenciesException: Nest can't resolve dependencies of the SourcingService (SourcingRepository, ?, Function, Function). Please make sure that the argument Function at index [1] is available in the SourcingModule module.`

The app reached `AppModule dependencies initialized` then threw on `SourcingService` instantiation and exited (`process 1` died → FAILED).

**Root cause (source-confirmed):** `apps/api/src/modules/sourcing/sourcing.service.ts` imports its DI-resolved constructor dependencies with `import type`:
```
import type { AuditService }    from '../audit/audit.service';    // index [2]
import type { AuthRepository }  from '../auth/auth.repository';   // index [3]
import type { IngestionService } from './ingestion.service';     // index [1]
```
`import type` is **elided from the compiled JS**, so NestJS reflect-metadata for those params degrades to the generic `Function` token → the container cannot resolve the providers (`SourcingModule` DOES list them as providers, so the module wiring is correct; the defect is purely the type-only import stripping runtime metadata). Index [0] `SourcingRepository` resolves because the module already value-imports it with a `biome-ignore … useImportType` escape hatch — the same fix pattern the other three deps need.

**Why CI was green but boot failed:** unit/integration tests use the Nest testing module / mocks and the build's `tsc` type-check does not exercise runtime reflect-metadata emission for these injected classes. This is a classic "green CI, broken boot" that only a real deploy + boot probe catches — exactly the false-green C-2 exists to stop.

**Triage tag:** `debugging` (runtime NestJS DI exception on boot), domain `backend`. Fix is a B-block change: `import type` → `import` for the three DI-resolved classes in `sourcing.service.ts` (mirror the `SourcingRepository` value-import + `biome-ignore useImportType` pattern). Orchestrator routes via `/investigate` → backend specialist; commit + push; then re-run C-2.

## Health probe — production state (Health Check Mirage avoided)

- Live api `/health` → HTTP 200 `{"status":"ok","db":"ok","version":"13e55ef"}` — **the OLD good build**, NOT `5f33c7c`. Verifying `version` (not merely the 200) is what catches the mirage: the global domain answers, but the new build is dead and Railway kept routing to the last-good `e0d2c2e6`.
- Live web root → HTTP 307 (auth redirect, normal).

**No active outage:** production continues on the previous known-good api (`13e55ef`). The FAILED new deployment took no traffic — the rollback path is effectively already the live state; no rollback mutation needed. Wave-6 data-spine code is simply NOT live.

## LIVE dedupe verification — NOT RUN

All Action-2 LIVE checks (seed fixture connection, sync, cross-source→1-canonical + 2 provenance, contact_provenance, ambiguous→dedupe_candidate, idempotent re-sync, audited dedupe-resolve, RBAC, regression) are **not executed** — the api serving wave-6 code never booted. No fabricated results. These must run on the fixed redeploy.

## Canary

`canary_status: skipped` — 0 DAU (< 1000 threshold) AND deploy did not succeed. No temp DB proxy was created (verification never reached the seeding step); nothing to clean up.

---

```yaml
ci_stage_verdict: FAIL
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway credential PRESENT: deploy-scoped project(id:) probe returned data.project + errors:null (token=APP_RAILWAY_TOKEN, 36 chars)"
  - "web deploy 4af724f1-b86a-4934-99ca-0f576662a879: status SUCCESS @ 5f33c7c"
  - "api deploy 274764d8-ce98-46f5-8816-62200f978019: status FAILED @ 5f33c7c (crash-loop on boot)"
  - "api deploymentLogs: NestJS UnknownDependenciesException — SourcingService dep index [1] unresolved (Function token)"
  - "live api /health: 200 {status:ok, db:ok, version:13e55ef} — OLD build still serving; 5f33c7c NOT live"
  - "root cause: import type on IngestionService/AuditService/AuthRepository in sourcing.service.ts strips NestJS runtime metadata"
  - "migration 0004: static additive-only PASS (7 tables + 2 partial-unique idx); NOT applied live (api never booted)"
deploy_targets:
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 5f33c7c, deploy_id: 4af724f1-b86a-4934-99ca-0f576662a879}
  - {platform: railway, service: dealflow-api, state: FAILED,  commit: 5f33c7c, deploy_id: 274764d8-ce98-46f5-8816-62200f978019, health_version_live: 13e55ef}
rollback_path:
  api_known_good_deploy_id: e0d2c2e6-e5a7-4115-8a12-a247c2d9f7bb   # SUCCESS @ 13e55ef — currently live
  web_known_good_deploy_id: 59dd897f-f962-4bb0-a4a5-3aa57856a849   # SUCCESS @ 13e55ef
  note: "api FAILED took no traffic; prev good already live. No rollback mutation needed."
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000) AND deploy did not succeed; no canary."
canary_alerts: []
routing:
  iron_law: "classify + route; head-ci-cd does NOT fix directly"
  triage_tag: debugging
  domain: backend
  fix_owner: "B-block backend specialist via /investigate"
  fix_summary: "import type -> import for IngestionService, AuditService, AuthRepository in apps/api/src/modules/sourcing/sourcing.service.ts (mirror SourcingRepository value-import + biome-ignore useImportType)"
  re_run: "C-2 re-runs after fix committed + pushed to main"
note: >
  Prior C-2 'no RAILWAY_TOKEN' BLOCK was a FALSE-NEGATIVE — token present under APP_RAILWAY_TOKEN
  and verified usable. Real blocker is a wave-6 code defect: dealflow-api crash-loops on boot with a
  NestJS UnknownDependenciesException in SourcingService. web deployed clean. Production still serves
  the previous good api (13e55ef); no outage; wave-6 code NOT live. Deploy did NOT ship.

head_signoff:
  verdict: REJECTED
  stage: C-2
  reviewers: {}
  failed_checks:
    - "api boots clean / health-check probe verifies the EXACT deployed hash (live version is 13e55ef, deploy FAILED)"
    - "MONITOR success_condition (Railway status SUCCESS) — api returned FAILED, not SUCCESS"
    - "migration 0004 applied + verified against live Postgres (api never booted; static-only)"
    - "LIVE cross-source dedupe payoff — not run (api serving wave-6 code never booted)"
    - "audited dedupe-resolve, RBAC, regression — not run"
  passed_checks:
    - "Railway credential present + deploy-scoped-verified (prior false-negative cleared)"
    - "rollback path armed (prev known-good deploy IDs cached before mutation)"
    - "deploy targeted the EXACT env ID + EXACT commit SHA (serviceInstanceDeployV2 commitSha)"
    - "migration 0004 additive-only (no destructive DDL) — static gate PASS"
    - "health probe verified deployed HASH (version=13e55ef), not just global-domain 200 — Health Check Mirage avoided"
    - "deploymentLogs captured + root-caused; classified debugging/backend; routed per Iron Law (not fixed directly)"
  rationale: >
    dealflow-api FAILED to boot at 5f33c7c — a NestJS DI wiring defect (import type strips runtime
    reflect-metadata for SourcingService's IngestionService/AuditService/AuthRepository deps). The new
    build never served traffic; production remains on the previous good api (13e55ef), verified by the
    /health version field (not merely a 200). No fabricated green: the LIVE dedupe payoff was NOT run
    because the code under test never booted. Root cause is a B-block code defect, not infra and not the
    (present, verified) Railway credential.
  next_action: REWORK_B_BLOCK
```
