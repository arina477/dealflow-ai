# C-2 — Deploy & verify (RE-RUN #2, deploy+verify only; infra already provisioned)

> Wave 2 (auth backbone). C-block, stage C-2. head-ci-cd gating.
> Prior C-2 pass provisioned all infra (supertokens-core + isolated supertokens-db, api env wired,
> Drizzle 0001 applied). This re-run is deploy-api-on-fix + auth-smoke ONLY.

## Summary — verdict at a glance

**`ci_stage_verdict: FAIL`** — the api boot fix (`4e09807`) cleared the original DI defect but the fresh
deploy **crash-looped on a NEW, distinct NestJS lifecycle-ordering bug**. The auth smoke suite (the key
verification this stage exists to run) **could not execute** because the api never booted. Per the Iron
Law this is classified and RETURNED to the B-block; head-ci-cd does NOT blind-fix `main.ts`.

**No production outage.** Railway's `/health` healthcheck refused to route traffic to the crash-looping
deployment `9772b283`; the previous api deploy (`077009a2`, commit `4cad0179`) remained live and served
`/health` 200 throughout. Rollback path was armed but never needed (old deploy stayed live).

## Deploy attempt — evidence

| Field | Value |
|---|---|
| Target commit | `4e0980740108d3cf7f5feecd1a9111690296c653` (PR #3 boot fix + DI-boot regression test) |
| Remote main HEAD | `4e09807` (verified via `git ls-remote origin refs/heads/main` — deploy provenance confirmed) |
| GIT_SHA env var | updated to `4e09807` via single-var `variableUpsert` (non-destructive; other vars untouched) |
| Deploy trigger | `serviceInstanceDeployV2(serviceId, environmentId, commitSha=4e09807)` |
| New deployment ID | `9772b283-2614-48f1-a41c-eb77d3a852b7` |
| Deployment commit (verified) | `4e0980740108d3cf7f5feecd1a9111690296c653` (NOT stale `4cad0179`, NOT failed `6966a18` — provenance verified) |
| Environment ID | `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (production; matches founder-supplied `0e84f0b6…`) |
| Poll trajectory | BUILDING (0–135s) → DEPLOYING (180–451s) → **FAILED (497s)** |
| Final status | `FAILED` |

## Rollback path (armed, not needed)

- Last-known-good deployment cached BEFORE trigger: **`077009a2-bd34-495f-a042-b936079c3e72`** (status
  SUCCESS, commit `4cad0179`) — this is the currently-live api deploy.
- Railway healthcheck kept `077009a2` serving traffic; the crash-looping `9772b283` never received
  production traffic. Health Check Mirage AVOIDED: live `/health` still reports old `4cad0179`, correctly
  telling us the new code is NOT live.

## Root-cause diagnosis (from deploymentLogs of 9772b283)

The DI fix WORKED — the module graph now initializes cleanly (`AuthModule dependencies initialized`),
which never happened pre-fix. A DIFFERENT fatal error now fires at bootstrap:

```
[Nest] Starting Nest application...
[InstanceLoader] AppModule dependencies initialized
[InstanceLoader] HealthModule dependencies initialized
[InstanceLoader] AuthModule dependencies initialized
error Fatal: failed to boot API Error: Initialisation not done. Did you forget to call the SuperTokens.init function?
    at SuperTokens.getInstanceOrThrowError (.../supertokens-node/lib/build/supertokens.js:497:15)
    at SuperTokensWrapper.getAllCORSHeaders (.../supertokens-node/lib/build/index.js:63:38)
    at bootstrap (/app/apps/api/dist/main.js:30:72)
```

(This crash loops every ~1s — container restart storm — hence Railway marks the deploy FAILED and never
routes to it.)

**Root cause — NestJS lifecycle-ordering bug in `apps/api/src/main.ts`:**

- `main.ts:32` calls `supertokens.getAllCORSHeaders()` inside `bootstrap()`, immediately after
  `NestFactory.create(AppModule)` and BEFORE `app.listen()`.
- `SuperTokens.init()` is invoked from `AuthModule.onModuleInit()` (`auth.module.ts` → `initSupertokens()`
  → `supertokens.config.ts:56`).
- **`NestFactory.create()` does NOT run `onModuleInit` lifecycle hooks** — those fire on `app.init()`,
  which happens implicitly inside `app.listen()`. So at line 32, `onModuleInit` has not yet run,
  `SuperTokens.init()` has not executed, and `getAllCORSHeaders()` throws "Initialisation not done."

This is a genuine **code defect** (initialization ordering), not an infra/env issue:
- `SuperTokens.init()` exists and is correctly wired (`supertokens.config.ts:56`).
- Env is correct — `loadSupertokensEnv()`'s no-alias assertion passed (app reached Nest bootstrap;
  Core connection URI/API key/isolated DB URL all present and validated).
- The migration re-ran idempotently and succeeded ("migrations applied successfully!").

## Classification & routing (Iron Law: classify + RETURN, do NOT blind-fix)

| Field | Value |
|---|---|
| class | code-defect |
| triage_tag | `debugging` (runtime exception — NestJS lifecycle ordering; sibling of the prior `dependencies` DI defect) |
| domain | backend (`apps/api`) |
| fix route | B-block re-entry → C-1 re-run (fix commit + CI + merge) → C-2 re-run (#3: deploy+verify api) |
| owning specialist for fix | backend-developer / nestjs-developer (B-2), NOT head-ci-cd |
| suggested minimal fix (advisory, for B-block — NOT applied here) | Ensure `SuperTokens.init()` runs before `getAllCORSHeaders()` in `main.ts`. Options: (a) call `initSupertokens(...)` directly in `main.ts` before `enableCors` (mirror the resolver wiring); (b) `await app.init()` before line 32 so `onModuleInit` fires, then call `getAllCORSHeaders()`; (c) move CORS/middleware setup into an `onApplicationBootstrap` phase after lifecycle hooks run. Keep the role-claim resolver binding intact. |

## Auth smoke against LIVE Core — NOT RUN (blocked by boot failure)

The key verification this re-run exists to perform could NOT execute — the api on `4e09807` never booted,
so there is no `4e09807` endpoint to exercise. The old live deploy (`4cad0179`) predates the auth module
wiring against live Core and is not a valid target for these assertions. Deferred to the NEXT C-2 re-run
(#3) once the boot fix lands.

| Endpoint | Planned assertion | Status |
|---|---|---|
| GET /health | 200 `{status:ok,db:ok,version:4e09807}` | NOT RUN — new deploy crash-looped; live /health still reports stale `4cad0179` |
| POST /auth/invite | capture invite token (advisor role) | NOT RUN |
| POST /auth/signup (valid token) | 2xx + session cookie + role claim | NOT RUN |
| GET /auth/me (session cookie) | 200 `{userId,email,role:advisor}` | NOT RUN |
| POST /auth/signup (bogus token) | 4xx (invite-only enforced) | NOT RUN |
| POST /auth/reset/request | 202 (no enumeration) | NOT RUN |

## Live-state probes (evidence captured this run)

```
GET https://dealflow-api-production-66d4.up.railway.app/health
  -> 200 {"status":"ok","db":"ok","version":"4cad0179de58cc6fe6b11b36cb2e1496aedea4bf"}
     (OLD deploy 077009a2 still live; confirms new fixed code is NOT serving)

web https://dealflow-web-production-a4f7.up.railway.app
  /               -> 200
  /login          -> 404   <-- SECONDARY FINDING (see below)
  /dashboard      -> 404
  /accept-invite  -> 404
  /reset-password -> 404
  latest web deployment: SUCCESS on commit 4cad0179 (STALE — predates B-3 auth screens)
```

## Secondary finding — web is serving STALE code (auth screens 404)

`dealflow-web` latest SUCCESS deploy is on commit **`4cad0179`**, which predates the B-3 auth-screens work
(login / accept-invite / reset-password / dashboard). All four auth routes return **404**; only `/` (200)
exists. The "web already SUCCESS/live" state note referred to this stale pre-auth deploy. web has NOT been
redeployed onto `4e09807` (or any commit carrying the auth screens). This must be redeployed alongside the
api in the next C-2 re-run so the auth flow is end-to-end reachable. Flagged for B/C follow-up; NOT an
outage (the pages simply don't exist yet on the live web build).

## Core isolation (reconfirmed — durable from prior C-2)

- `supertokens-core` (80790c7f-cb81-4b7f-b248-c4da0789ffb1) — image supertokens-postgresql:11.4.5,
  private-only, CDI 5.4 (compatible with supertokens-node@24.0.2). Running.
- `supertokens-db` (acf6eb46-f758-4254-b10c-32d1eacf3868) — Core's OWN Postgres, isolated from app
  postgres. `SUPERTOKENS_DATABASE_URL !== DATABASE_URL` no-alias assertion in `loadSupertokensEnv()`
  passed at boot (the app reached Nest bootstrap before failing, proving env validation succeeded).
- app `postgres` (43bbb393) — migration 0001 re-applied idempotently this run ("migrations applied
  successfully!"). Additive-only; no destructive DDL.

## Canary

```yaml
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); pre-launch. Moot — deploy FAILED, no new instances to canary."
```

---

```yaml
ci_stage_verdict: FAIL
armed_verification_failed: false      # not a MONITOR-task deferral; inline-poll reached terminal FAILED
verdict_source: railway
deploy_commit: 4e0980740108d3cf7f5feecd1a9111690296c653
deploy_target: dealflow-api (dcdb4ab4-abc3-4983-ae73-43512ce2c7e6)
deployment_id: 9772b283-2614-48f1-a41c-eb77d3a852b7
deployment_status: FAILED
rollback_target_cached: 077009a2-bd34-495f-a042-b936079c3e72   # last-known-good, commit 4cad0179 (still live)
production_outage: false
verdict_evidence:
  - "railway dealflow-api: deployment 9772b283 on commit 4e09807 -> FAILED (crash loop) after 497s"
  - "deploymentLogs: 'Error: Initialisation not done. Did you forget to call the SuperTokens.init function?' at getAllCORSHeaders / main.ts:30"
  - "root cause: main.ts calls supertokens.getAllCORSHeaders() before onModuleInit runs SuperTokens.init() (NestFactory.create does not fire lifecycle hooks)"
  - "DI fix (4e09807) CONFIRMED working: 'AuthModule dependencies initialized' now succeeds (never did pre-fix)"
  - "live /health still reports 4cad0179 (old deploy 077009a2 kept live by healthcheck; no outage)"
  - "auth smoke NOT RUN — api never booted on 4e09807"
  - "SECONDARY: dealflow-web live on stale 4cad0179; /login /dashboard /accept-invite /reset-password all 404 (predates B-3 auth screens)"
classification:
  class: code-defect
  triage_tag: debugging
  domain: backend
  file: apps/api/src/main.ts
  fix_route: "B-block re-entry (main.ts init-ordering fix) -> C-1 re-run (fix commit+CI+merge) -> C-2 re-run #3 (deploy api + deploy web on auth commit + run auth smoke)"
canary_status: skipped
canary_skip_reason: "0 DAU < 1000; moot on FAILED deploy"

head_signoff:
  verdict: ESCALATE
  stage: C-2
  reviewers: {}
  failed_checks:
    - "Drizzle migration executed before app routed traffic — migration OK, but app never booted"
    - "Production health-check probe verifies HTTP 200 of the NEWLY deployed container hash — FAILED: new deploy 9772b283 crash-looped; /health only reports the stale 4cad0179 container"
    - "Schema validation confirms live Postgres matches the deployed NestJS artifact — UNVERIFIABLE: artifact never booted"
    - "Post-deploy monitor verifies new deploy BOOTS and /health version == 4e09807 — FAILED: version still 4cad0179"
    - "Auth smoke (invite->signup->me->bogus-invite->reset) against live Core — NOT RUN: api never booted on 4e09807"
  rationale: >-
    The boot fix (4e09807) correctly resolved the original DI UnknownDependenciesException — the module
    graph now initializes cleanly — but the fresh deploy exposed a NEW, distinct NestJS lifecycle-ordering
    defect: main.ts calls supertokens.getAllCORSHeaders() before onModuleInit fires SuperTokens.init(),
    because NestFactory.create() does not run lifecycle hooks. The api crash-loops; the auth smoke suite
    (this stage's core verification) could not run. Per the Iron Law this is a code defect classified and
    RETURNED to the B-block (tag: debugging, domain: backend, file: main.ts) — head-ci-cd does not
    blind-fix application code. No production outage: Railway's healthcheck kept the prior good deploy
    (077009a2 / 4cad0179) live and refused to route to the crash loop; rollback armed but not needed. A
    green verdict here would be a fabricated PASS on a non-booting artifact — refused. Secondary defect:
    web is live on stale 4cad0179 and 404s on all auth screens (predates B-3); must be redeployed in the
    next C-2 pass. Verdict ESCALATE (hard stop): a fresh code fix must land via B->C-1 before C-2 can
    re-run a THIRD time.
  next_action: REWORK_B-block
```
