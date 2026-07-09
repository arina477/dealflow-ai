# C-2 — Deploy & verify (wave-39: admin role transfer + self-demote)

**Stage:** C-2 (deploy-and-verify, incl. conditional canary)
**Status:** NOT REACHED — blocked upstream at C-1.

## Why not reached
C-2 deploys the **merge commit** to Railway (api + web), pinned to the squash-merge SHA. C-1
could not create or merge the PR (fine-grained PAT lacks Pull requests: write), so no merge commit
exists. Deploying a non-merged branch tip would violate the "deploy the merged commit" contract and
the pin-to-merge-SHA rule (CI-PRINCIPLES rule 4). No deploy was triggered.

## Deploy plan (recorded for resume — executes once C-1 produces a merge commit)
- Targets: **dealflow-api** (service `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6`) and
  **dealflow-web** (service `06b07f19-9146-4da0-b589-0d6d81ec1576`), env `production`
  (env id `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`), project id `$APP_RAILWAY_PROJECT_ID`.
- Railway GraphQL, `Project-Access-Token: $APP_RAILWAY_TOKEN`, mutation `serviceInstanceDeployV2`
  **pinned to the squash-merge commit SHA** (bare redeploy would ship the stale pinned commit).
- api preDeploy runs `drizzle-kit migrate` (no new migration this wave → expected no-op; confirm no error).
- Verify (prove, don't trust green):
  - api `GET /health` → 200; Railway deploy `commitHash` == squash-merge SHA (deploy meta authoritative;
    `/health.version` string is known-stale per CI-PRINCIPLES rule 1).
  - web health/homepage → 200.
  - Smoke `POST /admin/users/:id/transfer-admin` → 401/403 unauth (proves route registered, not 404);
    no privilege mutation on prod data.
- Canary: real users < 1000 → `canary_status: skipped` (below `canary_threshold_dau`); synthetic
  deploy verification still runs.

---

```yaml
ci_stage_verdict: HOLD                # NOT REACHED — upstream C-1 blocked; no merge commit to deploy
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "C-1 HOLD (PR-create blocked by PAT scope); no merge commit exists to deploy"
deploy_targets: []
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "real users < 1000 (< canary_threshold_dau 1000); deploy verification would run, canary would not — but deploy itself is blocked upstream"
canary_window:
  start: null
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
note: >
  Not reached. C-2 requires the C-1 merge commit; C-1 is blocked by insufficient GitHub token scope.
  On resume, C-1 opens+merges the PR, then C-2 executes the deploy plan above (both services pinned to
  the squash-merge SHA) with the prove-don't-trust verification and canary=skipped (sub-threshold DAU).
```
