# DevOps Architecture

## Summary

DealFlow AI runs on Railway (bring-your-own account) with GitHub Actions as the CI layer. The monorepo is managed with Turborepo + pnpm. There are no custom Kubernetes clusters or container registries — Railway handles container build, push, and deploy automatically from GitHub pushes. Secrets never leave the Railway environment variable store. All background processing is handled by a dedicated worker service inside Railway, sharing the private network with the API service. Observability is structured-log-first, collected via Railway's built-in log drain until volume justifies an external sink.

---

## Inventory

### Environments

| Environment | Purpose | Trigger |
|---|---|---|
| `dev` | Local developer machines; `.env.local` files seeded from `.env.example`; Railway private network services not reachable — use `railway run` or tunnel for DB/SuperTokens | Manual |
| `staging` | Full-stack deploy on Railway; mirrors prod service topology; used for QA, E2E, and compliance smoke tests before every production promotion | PR merge to `main` (or manual trigger) |
| `prod` | Live environment on founder's Railway account; Railway private network enforced; no direct SSH/exec access | Tag push `v*.*.*` or manual Railway redeploy |

PR branches get ephemeral preview environments on Railway (web service only, pointing at staging API) — see Conventions below.

### Railway Services

| Service | Runtime | Notes |
|---|---|---|
| `api` | NestJS (Node 22 LTS, Docker) | REST + WebSocket gateway; internal port 3001; Railway private network; `PORT` env var injected by Railway |
| `web` | Next.js 15 (Node 22 LTS, Docker) | App Router; internal port 3000; public-facing Railway domain; `NEXT_PUBLIC_API_URL` points at `api` private hostname |
| `postgres` | Railway-managed PostgreSQL | Used by `api`, `supertokens`, and `worker`; credentials injected via Railway service variables |
| `supertokens` | SuperTokens Core (Docker, official image) | Auth service on Railway private network; `api` talks to it via `SUPERTOKENS_CONNECTION_URI`; its own Postgres connection string |
| `worker` | NestJS worker entrypoint (same monorepo, separate Dockerfile target) | Runs all background queues (see Background Jobs below); no public port; Railway private network only |

### Background Jobs (worker service)

| Job | Trigger | Notes |
|---|---|---|
| `sourcing-sync` | Scheduled (cron) + manual kick | Ingests target companies from external data-source APIs; idempotent upserts |
| `enrichment-queue` | Queue consumer (Redis-backed) | Fills decision-maker contacts; rate-limited per provider |
| `outreach-send-queue` | Queue consumer | Sends personalized emails via transactional email provider; respects compliance gate before send |
| `email-event-webhook-processor` | HTTP webhook receiver in `api` → internal queue | Processes opens/clicks/replies/bounces from email provider; writes to audit log |
| `audit-integrity-verification` | Scheduled (nightly) | Re-hashes audit log chain segments to detect tampering; alerts on mismatch |

Queue technology (Redis-backed BullMQ or equivalent) is evaluated at v6 SDK branch when load is understood; the worker service shell is scaffolded now with the queue adapter behind an interface so the concrete driver is swappable.

### CI Jobs (GitHub Actions)

| Job | Runs on | Notes |
|---|---|---|
| `lint` | `ubuntu-latest` | Biome lint + format check across all workspaces |
| `typecheck` | `ubuntu-latest` | `tsc --noEmit` per workspace via Turborepo |
| `test-unit` | `ubuntu-latest` | Vitest unit + Supertest integration; in-memory Postgres via testcontainers or pg-mem |
| `test-e2e` | `ubuntu-latest` | Playwright MCP swarm against staging deploy; blocked until Chrome binary resolved (see Risk below) |
| `build` | `ubuntu-latest` | `turbo build` — verifies all packages compile; produces Docker images |
| `deploy-staging` | `ubuntu-latest` | Pushes to Railway staging via GraphQL API on merge to `main` |
| `deploy-prod` | `ubuntu-latest` | Pushes to Railway prod via GraphQL API on `v*.*.*` tag |

All jobs run in parallel where there are no data dependencies (`lint`, `typecheck`, `test-unit`, `build` fan out simultaneously). `deploy-staging` gates on all four passing. `deploy-prod` gates on `deploy-staging` completing successfully for the same SHA.

### Observability

| Concern | Tooling | Notes |
|---|---|---|
| Structured logs | `pino` (NestJS default) → Railway log drain | JSON lines; `traceId` + `requestId` propagated in async context; log drain export configured when volume exceeds Railway retention window |
| Metrics | Railway built-in (CPU/mem/replica count) for infrastructure; application-level metrics deferred to v6 when SLO targets are set | |
| Distributed tracing | Deferred; interface stubs added to API so `@opentelemetry/sdk-node` can be wired in without refactor | |
| Error tracking | Deferred; `onUncaughtException` + `onUnhandledRejection` log to structured output until a Sentry DSN is configured | |
| Uptime | Railway health-check endpoint (`GET /health`) on `api` and `web`; Railway restarts on failure | |
| Audit-log integrity alerts | `audit-integrity-verification` job writes structured alert log entry on chain mismatch; log-drain alert rule targets that entry | |

---

## Conventions

### GitHub Actions job template

Every job follows this header contract:

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10          # hard cap on every job; adjust per job below
    permissions:
      contents: read             # least-privilege default; expand only when needed
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
```

Timeout budgets by job type:

| Job | `timeout-minutes` |
|---|---|
| `lint` | 10 |
| `typecheck` | 15 |
| `test-unit` | 20 |
| `test-e2e` | 30 |
| `build` | 20 |
| `deploy-staging` | 15 |
| `deploy-prod` | 15 |

`permissions: contents: read` is the default for all jobs. Jobs that write to GitHub (e.g., PR comments, deployment status) add only the specific scope required (`pull-requests: write`, `deployments: write`) and no others.

### Parallel CI fan-out

```yaml
# .github/workflows/ci.yml (shape — not the full file)
jobs:
  lint:       { ... }
  typecheck:  { ... }
  test-unit:  { ... }
  build:      { ... }

  deploy-staging:
    needs: [lint, typecheck, test-unit, build]
    if: github.ref == 'refs/heads/main'
    ...

  test-e2e:
    needs: [deploy-staging]
    ...

  deploy-prod:
    needs: [test-e2e]
    if: startsWith(github.ref, 'refs/tags/v')
    ...
```

### PR preview environments

Railway supports environment-per-PR via its "Preview Environments" feature. Configuration:

- Preview environments are enabled on the `web` service only; `api` and `postgres` are shared from staging to keep cost bounded.
- Preview `NEXT_PUBLIC_API_URL` points at the staging `api` service.
- Railway auto-tears-down the preview environment when the PR is closed or merged.
- The GitHub Actions workflow posts the preview URL as a PR comment using `actions/github-script` with `pull-requests: write` permission (that job runs in isolation; no code-access permissions beyond `contents: read`).

### Turborepo remote cache

Turborepo remote cache is enabled with a `TURBO_TOKEN` + `TURBO_TEAM` stored as GitHub Actions secrets. Cache hits skip redundant builds across PRs on the same branch. The cache backend is Turborepo's hosted service (default); switch to self-hosted Turborepo Remote Cache on Railway if data-residency requirements emerge.

### Dockerfile strategy

Two Dockerfiles (or one multi-stage Dockerfile with named targets):

- `api` target: `node:22-alpine` base; copies only `apps/api/` workspace output + shared packages; non-root user `node`; `EXPOSE 3001`
- `web` target: `node:22-alpine` base; copies only `apps/web/` workspace output + shared packages; non-root user `node`; `EXPOSE 3000`
- `worker` target: same base as `api`; different entrypoint (`node dist/worker/main.js`); no exposed port

All images built with `--platform linux/amd64` to match Railway's runner. Images are not pushed to an external registry — Railway builds from source on each deploy triggered via the GraphQL API.

---

## Reusability Principles

1. **Shared CI step definitions.** Extract `pnpm install --frozen-lockfile` + node/pnpm setup into a composite action at `.github/actions/setup-node/action.yml`. Every job calls it once; version bumps happen in one place.

2. **Turborepo task graph as the source of truth.** CI jobs do not manually enumerate which packages to lint/test/build. They run `turbo <task>` and let the task graph prune unchanged packages. This means adding a new workspace requires zero CI changes.

3. **Environment variable naming convention.** All Railway service variables follow the pattern `<SCOPE>_<RESOURCE>_<ATTRIBUTE>` (e.g., `SUPERTOKENS_CONNECTION_URI`, `EMAIL_PROVIDER_API_KEY`, `POSTGRES_URL`). Public Next.js vars are prefixed `NEXT_PUBLIC_`. This convention is enforced by a lint rule in the `@dealflow/shared` env-schema module (Zod-parsed at startup; missing required vars crash fast with a clear message, not a silent undefined).

4. **Health-check contract.** Every Railway service that accepts HTTP traffic exposes `GET /health` returning `{ status: "ok", version: "<git-sha>" }` with HTTP 200. Railway health checks target this path. The same endpoint is used by the staging smoke test in `deploy-staging` before marking the deployment complete.

5. **Worker queue interface.** The background job queue adapter is defined as an interface (`IQueueAdapter`) in `@dealflow/shared`. The concrete BullMQ (or equivalent) implementation is injected via NestJS DI. This means switching queue backends (or adding a second one) requires only a new adapter module, not rewriting job handlers.

6. **Secrets never in CI logs.** All Railway tokens, API keys, and DB URLs are stored as GitHub Actions encrypted secrets. Jobs reference them via `${{ secrets.RAILWAY_TOKEN }}`. `set -e` is the default shell flag; no `echo` of secret values in any step.

---

## Cross-References

- **Railway deployment monitors:** `claudomat-brain/monitors/` — every deploy task must declare a `MONITOR:` task with `success_condition`, `failure_condition`, and `timeout_budget` per `claudomat-brain/monitors/monitor-principles.md`. The Railway-specific template lives at `claudomat-brain/monitors/railway.md` (to be authored when the first deploy wave fires).
- **Secrets management:** All credentials (Railway token, email provider key, LLM API key, data-source API keys, Postgres URL) are stored as Railway environment variables per service. GitHub Actions stores only the tokens required to trigger Railway deployments. No secrets are committed. `.env.example` contains only placeholder labels and comments, never values. Enforced by `claudomat doctor`.
- **C-2 deploy credential collection:** Railway token and project/environment IDs are collected at deploy time per C-2 Action 0. The devops pipeline assumes these are available as `RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_STAGING`, `RAILWAY_ENVIRONMENT_PROD` in GitHub Actions secrets before the first `deploy-staging` run. The C-2 stage is the collection gate — do not hard-code or pre-populate these.
- **Architecture library:** `command-center/dev/architecture/_library.md` (index of all architecture branches authored for this project).

---

## Stack-Specific Decisions

### Railway via GraphQL API, not CLI

Railway's official CLI (`railway up`) is not used in CI. The Railway GraphQL API (`https://backboard.railway.app/graphql/v2`) is called directly in deploy jobs. Rationale:

- The CLI is interactive-first and has historically had breaking changes on minor versions.
- The GraphQL API is stable, versioned, and easily pinned.
- Deploy mutations return a deployment ID that CI can poll for status, enabling the health-check gate.

The deploy job shape:

```yaml
- name: Trigger Railway deploy
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
  run: |
    DEPLOY_ID=$(curl -s -X POST https://backboard.railway.app/graphql/v2 \
      -H "Authorization: Bearer $RAILWAY_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"query":"mutation { deploymentRedeploy(id: \"${{ env.SERVICE_DEPLOYMENT_ID }}\") { id status } }"}' \
      | jq -r '.data.deploymentRedeploy.id')
    echo "DEPLOY_ID=$DEPLOY_ID" >> $GITHUB_ENV

- name: Poll deploy status
  run: |
    for i in $(seq 1 30); do
      STATUS=$(curl -s -X POST https://backboard.railway.app/graphql/v2 \
        -H "Authorization: Bearer $RAILWAY_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"query\":\"{ deployment(id: \\\"$DEPLOY_ID\\\") { status } }\"}" \
        | jq -r '.data.deployment.status')
      [ "$STATUS" = "SUCCESS" ] && exit 0
      [ "$STATUS" = "FAILED" ] && exit 1
      sleep 10
    done
    exit 1
```

Exact GraphQL mutation names and field shapes must be verified against the Railway API reference at the time of first deploy wave authoring — mutation names in the snippet above are illustrative.

### Postgres migrations in CI

Two distinct migration contexts exist; they must not be conflated:

**Prod preDeploy migration (Railway):** Drizzle migrations (`drizzle-kit migrate`) run as a Railway `preDeployCommand` on the `api` service — they execute *before* Railway routes any traffic to the new image. A migration failure aborts the deploy and keeps the current deployment serving. The migration role is the **owner** credential supplied via `MIGRATE_DATABASE_URL` (not the runtime `DATABASE_URL`). The working preDeployCommand form is:
```
DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm --filter @dealflow/api exec drizzle-kit migrate
```
See [RLS connection-split & role-privilege deploy contract](#rls-connection-split--role-privilege-deploy-contract) below for the full role-split rationale, the PATH-safe form, and the coupled-rollback procedure.

**CI test-DB migration (GitHub Actions):** Integration and e2e test suites that require a real Postgres database call `ensureMigrated()` (test helper at `apps/api/test/_helpers/ensure-migrated.ts`) against `TEST_DATABASE_URL` — the ephemeral CI test DB, connected as the superuser for the throwaway container. This flow is entirely separate from the prod preDeploy path; the test DB is ephemeral and superuser credentials never touch prod.

### RLS connection-split & role-privilege deploy contract

**Context:** Migration 0016 introduced a non-superuser Postgres role `dealflow_app` with `NOSUPERUSER NOBYPASSRLS`. The deploy contract splits the database connection into two distinct URLs — one for the running app, one for preDeploy migrations — to enforce least privilege and guarantee FORCE ROW LEVEL SECURITY is always active.

#### The role split

| Variable | Role | Privileges | When used |
|---|---|---|---|
| `DATABASE_URL` | `dealflow_app` | `NOSUPERUSER`, `NOBYPASSRLS`, limited GRANTs | App runtime (every request) |
| `MIGRATE_DATABASE_URL` | owner (`postgres`) | superuser / full DDL rights | Railway `preDeployCommand` only — never the running app |

The runtime `dealflow_app` role cannot issue DDL, GRANT, or CREATE/ALTER POLICY statements. The owner role carries full privileges and is used exclusively at migration time. They must always be set to distinct connection strings.

#### PATH-safe preDeployCommand form

The Railway api service carries this `preDeployCommand`:
```
DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm --filter @dealflow/api exec drizzle-kit migrate
```

**The gotcha (wave-17, api deploy #1 FAILED):** An earlier form used a login-shell wrapper (`bash -lc "..."`) to expand environment variables. Railway's login-shell initialisation reset `PATH`, dropping the pnpm shim directory — `pnpm: command not found` — and the api deploy failed. The fix is the bare env-prefix form above: no shell wrapper, no PATH reset. The override `DATABASE_URL="$MIGRATE_DATABASE_URL"` is expanded by Railway's own shell in the preDeployCommand context, and pnpm remains on `PATH`.

Do not wrap the preDeployCommand in `bash -lc`, `bash -c`, or any login-shell invocation.

#### [RLS-GUARD] — mechanical anchor for the runtime-role AC

`assertNonSuperuserConnection()` in `apps/api/src/db/index.ts` is the load-bearing runtime check. At every bootstrap it queries:

```sql
SELECT current_setting('is_superuser') AS is_superuser,
       (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS has_bypassrls
```

If `is_superuser = 'on'` OR `rolbypassrls = true`, it throws and the process exits before serving any request. A successful boot — evidenced by `/health` returning `{"db":"ok"}` — is a positive proof that `DATABASE_URL` is the dealflow_app role and FORCE RLS is active. The check is wired in `main.ts` bootstrap before any tenant DB access and is skipped only in unit-test mode (no DB connection needed for unit tests).

**MG1 (binding):** The predicate logic (`is_superuser === 'on'` OR `rolbypassrls`) and the fail-closed throw are load-bearing security. They must not be altered. Only the doc comment and error message text may be updated.

#### 2-URLs-distinct preflight — `assertUrlsDistinct()`

`assertUrlsDistinct()` in `apps/api/src/db/index.ts` is a synchronous startup check that runs *before* any DB connection is opened (wired in `main.ts` bootstrap, before `assertNonSuperuserConnection()`).

- When `MIGRATE_DATABASE_URL` is **not set** (local dev, unit tests, any env with only `DATABASE_URL`) → **no-op**.
- When both are set and **equal** → throws `[RLS-GUARD] DATABASE_URL and MIGRATE_DATABASE_URL are identical` — fast, explicit diagnosis before a DB connection is even attempted.
- When both are set and **distinct** → no-op (correct configuration).

Unit tests for the preflight live at `apps/api/src/db/url-distinct-preflight.spec.ts` (PREFLIGHT-1/2/3).

#### Coupled-rollback procedure

Rolling back a deployment that changed role privileges (GRANTs, RLS policies, role creation) MUST revert BOTH the deployment AND the runtime `DATABASE_URL` if the target (older) code lacks the `[RLS-GUARD]`/`dealflow_app` expectations.

**Hazard:** A code-only rollback (reverting the deployment but leaving `DATABASE_URL=dealflow_app`) runs old code against the new non-superuser role. Old code that was written for the owner/superuser connection (before migration 0016) may fail to read data, issue forbidden DDL, or misbehave silently — breakage that is not a schema defect and cannot be fixed by a DB downgrade.

**Procedure:**
1. `deploymentRollback` (or `serviceInstanceDeployV2` with the known-good commit SHA) for the `api` service, and `web` if affected.
2. Set the runtime `DATABASE_URL` back to the owner URL (whose value is preserved in `MIGRATE_DATABASE_URL`).
3. Migrations are additive-only (expand-phase only; no destructive drops); no DB downgrade is required.

#### Standing deploy-AC checklist

Apply this checklist for any future migration that touches role privileges, GRANTs, or RLS policies:

- [ ] Both `DATABASE_URL` and `MIGRATE_DATABASE_URL` are set **and distinct** in the Railway api service environment (`assertUrlsDistinct()` preflight verifies this at boot).
- [ ] The runtime role (`DATABASE_URL`) is `NOSUPERUSER NOBYPASSRLS` — verified mechanically by `[RLS-GUARD]` (`assertNonSuperuserConnection()`); a successful `GET /health` with `db:ok` is the positive proof.
- [ ] `preDeployCommand` uses the bare env-prefix form — no `bash -lc` or login-shell wrapper that would reset `PATH`.
- [ ] Rollback plan is captured BEFORE mutation (known-good deployment ID + known-good commit SHA) and the plan accounts for reverting BOTH the deployment AND the runtime `DATABASE_URL` to the owner URL if the target commit predates the `[RLS-GUARD]`/`dealflow_app` expectations.

#### GAP-3 — deferred: dedicated non-superuser CI DB role

The GitHub Actions CI test suite (`test-unit` job) runs e2e/integration tests against `TEST_DATABASE_URL`, which currently connects as the superuser for the ephemeral CI container. A least-privilege CI role (non-superuser, non-BYPASSRLS) mirroring the `dealflow_app` prod role would close the test/prod role-privilege gap and allow integration tests to run as the runtime role.

This work requires a `ci.yml` change (adding the role-creation step and wiring the new `TEST_DATABASE_URL` credential). It is deferred: the PAT available to the orchestrator lacks `Workflows:write` permission, making a `ci.yml` commit blocked. Track as a follow-up CI hardening task when a `Workflows:write`-scoped PAT is provisioned.

### SuperTokens on Railway private network

SuperTokens Core is reachable by the `api` service only via Railway's private network hostname (e.g., `supertokens.railway.internal:3567`). It is never exposed on a public Railway domain. The `SUPERTOKENS_CONNECTION_URI` env var is set to the private hostname. This is enforced at app startup by the Zod env schema — the value must not begin with `http://` on a public domain in staging or prod.

### Monorepo deploy scoping

Railway deploys are scoped per service using Railway's "watch paths" feature. The `api` service watches `apps/api/`, `packages/`. The `web` service watches `apps/web/`, `packages/`. The `worker` service watches `apps/api/` (shared source), `packages/`. This prevents a docs-only or design-only commit from triggering unnecessary rebuilds.

### Deploy-time credential collection per C-2 Action 0

The C-2 deploy stage is the single collection point for Railway tokens and project/environment IDs. Before any deploy wave runs, the orchestrator follows C-2 Action 0 to collect and store these in GitHub Actions secrets. Until C-2 Action 0 has been completed for an environment, `deploy-staging` and `deploy-prod` jobs are skipped (not failed) via a `if: secrets.RAILWAY_TOKEN != ''` guard. This prevents phantom failures in early development waves where infrastructure is not yet provisioned.

---

## Risk / Open Items

| # | Item | Severity | Resolution path |
|---|---|---|---|
| R-1 | **Playwright / Chrome browser binary not installed in current environment.** E2E tests (`test-e2e` CI job) and all Playwright MCP swarm calls will fail at the binary-resolution step. This blocks the T-5 Layout and T-6 E2E test stages for every UI wave. Must be resolved host-side (installing Chromium + Playwright system deps on the `ubuntu-latest` runner, or using `mcr.microsoft.com/playwright` as the CI runner image) before the first UI wave's T-5 stage is entered. | High | Host-side fix before first UI wave; tracked as a prerequisite gate on T-5 entry |
| R-2 | **Queue technology not yet selected.** BullMQ + Redis is the assumed default but not confirmed. Redis adds a sixth Railway service. Evaluate at v6 SDK branch when job throughput estimates exist. Low-traffic alternative: pg-boss (Postgres-native queue) avoids Redis entirely. | Medium | Decide at v6 SDK branch; worker service interface is queue-adapter-agnostic |
| R-3 | **Railway GraphQL API mutation names are illustrative.** The deploy job snippet uses mutation names that must be verified against Railway's current API schema before the first deploy wave. A Railway API schema snapshot should be fetched and stored at `command-center/dev/SDK-Docs/Railway/railway-api.md` per `external-sdk-integration-rules.md` before C-2. | Medium | Author Railway SDK doc at C-2 stage; fetch live schema at that time |
| R-4 | **Turborepo remote cache token not yet provisioned.** `TURBO_TOKEN` + `TURBO_TEAM` must be created in Vercel/Turborepo and added to GitHub Actions secrets before remote cache is active. Without it, every CI run does a full rebuild. Non-blocking for correctness; blocking for CI performance at scale. | Low | Provision at project bootstrap (first CI wave) |
| R-5 | **SuperTokens private-network hostname not known until Railway project is provisioned.** The exact private hostname (`.railway.internal` suffix) is assigned by Railway at service creation. `SUPERTOKENS_CONNECTION_URI` cannot be set in `.env.example` with a real value until the Railway project exists. Placeholder value in `.env.example` must clearly indicate this. | Low | Resolved at C-2 Action 0 when Railway project is provisioned |
| R-6 | **Drizzle migration job timing.** Migrations run as a Railway `preDeployCommand` (before traffic is routed) — a slow migration delays the deploy but does not expose a mixed-schema window. Railway health-check start period may need tuning if migration + boot time exceeds the default. | Low | Tune at first deploy wave; document in Railway service config |
| R-7 | **CI test DB runs as superuser (GAP-3 — deferred).** The `test-unit` CI job's `TEST_DATABASE_URL` connects as the superuser for the ephemeral container. A dedicated non-superuser CI role mirroring `dealflow_app` would close the test/prod role-privilege gap. Blocked on a `Workflows:write`-scoped PAT for `ci.yml` changes. See [GAP-3 deferred note](#gap-3--deferred-dedicated-non-superuser-ci-db-role) in the RLS contract section. | Medium | Provision `Workflows:write` PAT and author the CI role-creation step |
