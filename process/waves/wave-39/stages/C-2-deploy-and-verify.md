# C-2 — Deploy & verify (wave-39: admin role transfer + self-demote)

**Stage:** C-2 (deploy-and-verify, incl. conditional canary)
**Status:** NOT DEPLOYED — CI is RED on the merge commit. No deploy triggered.

## Why no deploy was triggered

C-2 deploys the merge commit `225114e4ddb1032485caeea93b88e96e04dc3bf8` to Railway (api + web),
pinned to that SHA. The precondition for deploy is a **green** CI verdict on that SHA. CI run
**29051054374** on `225114e` concluded **FAILURE** (the `test` job failed — independently verified
via `gh run view`, see C-1 deliverable). Deploying a merge commit whose test suite is red would ship
known-broken bits to production and fabricate a green C-2 verdict — exactly the catastrophic action
this stage exists to prevent (CI-PRINCIPLES; anti-Ghost-Green). **No `serviceInstanceDeployV2`
mutation was issued for either service. No health probe, no smoke, no canary was run** — there is
nothing valid to verify.

## Pre-flight facts verified (before the deploy was refused)

- Railway credential usable: deploy-scoped GraphQL probe with `Project-Access-Token: $APP_RAILWAY_TOKEN`
  returned `data.project` (project `app-arina-5ywq3s`, id `ce095f75-1f3d-4af9-939e-fe8532541475`), no `errors`.
- Both target services confirmed present in the project:
  - **dealflow-api** — `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6`
  - **dealflow-web** — `06b07f19-9146-4da0-b589-0d6d81ec1576`
- Deploy would have been env `production` (`0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`), pinned to `225114e`.

So the deploy lane is READY (credential + services + pin target all in hand). The **only** blocker is
the red CI on the merge SHA — an upstream code/CI defect, not an infra-readiness gap.

## Deploy plan (recorded for resume — executes once CI is green on the merge SHA)

- Targets: dealflow-api + dealflow-web, env production, `serviceInstanceDeployV2` **pinned to the
  green merge SHA** (bare redeploy would ship the stale pinned commit — CI-PRINCIPLES rule 4).
- api preDeploy `drizzle-kit migrate` → expected no-op (no new migration this wave); confirm no error.
- Verify (prove, don't trust green): api `GET /health`→200 + deploy `commitHash`==merge SHA (deploy meta
  authoritative; `/health.version` known-stale, CI-PRINCIPLES rule 1); web health/homepage→200 +
  commitHash==merge SHA; smoke `POST /admin/users/:id/transfer-admin` unauth → 401/403 (route registered,
  not 404), no privilege mutation on prod data.
- Canary: real users < 1000 → `canary_status: skipped` (< canary_threshold_dau 1000); deploy verification
  still runs.

---

```yaml
ci_stage_verdict: FAIL                # deploy refused — CI RED on the merge commit (test job failed)
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "CI run 29051054374 on merge SHA 225114e concluded FAILURE (test job) — verified via gh run view"
  - "no deploy mutation issued for either service; no health/smoke/canary run (nothing valid to verify)"
  - "Railway credential + both service ids + pin target verified READY — sole blocker is the red CI"
deploy_targets: []                     # none deployed — deploy refused on red CI
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "real users < 1000 (< canary_threshold_dau 1000); moot — no deploy occurred"
canary_window:
  start: null
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
blocker_class: ci-infrastructure
blocker_detail: >
  CI test job fails on the exact merge SHA (225114e): ci.yml test job runs pnpm test without building
  @dealflow/shared first, so transfer-admin.spec.ts T-8a/b/c/d throw 'Cannot find module
  @dealflow/shared/dist/index.js'. Deploy refused until CI is green on the merge SHA. Fix routed to a
  specialist per the Iron Law (a ci.yml build-order change) — head-ci-cd does NOT fix or debug-by-deploy.
note: >
  No deploy. The deploy lane is fully ready (Railway token usable, both service ids resolved, pin target
  225114e in hand), but CI is RED on the merge commit, so shipping it would fabricate a green. head-ci-cd
  refuses. On resume — once the CI build-order defect is fixed and CI is green on the (possibly new) merge
  SHA — C-2 executes the deploy plan above (both services pinned to the green SHA) with prove-don't-trust
  verification and canary=skipped (sub-threshold DAU).
```
