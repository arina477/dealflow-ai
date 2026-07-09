# C-2 — Deploy & verify (wave-39: admin role transfer + self-demote)

**Stage:** C-2 (deploy-and-verify, incl. conditional canary)
**Status:** DEPLOYED + VERIFIED. Both services live at the green merge commit.

## The fabricated-green catch (why the deploy commit is e437b52, not 225114e)

The handoff asserted CI passed on merge `225114e`. Independent `gh run view` verification proved run
29051054374 concluded **FAILURE** (test job red: `transfer-admin.spec.ts` T-8a/b/c/d threw
`Cannot find module @dealflow/shared/dist/index.js` — the CI `test` task never built the shared package
first). head-ci-cd **refused to deploy the red commit** and routed the CI defect to `devops-engineer`
(Iron Law). The specialist authored a config-only fix (`turbo.json`: `test` gains `dependsOn: ["^build"]`),
which was committed as **`e437b52355e257a2ef7daad2f4001f48fa5ac191`** on main. CI re-ran on `e437b52`
(run **29051546609**) and concluded **success — all 5 jobs green, including test**. `e437b52` is the new
green merge SHA and the deploy target. No green was fabricated; the deploy is on a verified-green commit.

## Deploy — Railway, pinned to e437b52 (both services)

`serviceInstanceDeployV2` pinned to the green commit (CI-PRINCIPLES rule 4: pin, never bare-redeploy),
env `production` (`0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`):

| Service | Service ID | Deployment ID | Status |
|---|---|---|---|
| dealflow-api | `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` | `7a12c3c3-1304-4b15-9bfb-885766de3d8c` | SUCCESS |
| dealflow-web | `06b07f19-9146-4da0-b589-0d6d81ec1576` | `2d605a9f-4015-4ebd-babe-a15c2a5869d1` | SUCCESS |

Both reached SUCCESS in ~2.5 min (BUILDING → SUCCESS), polled by exact deployment id (no stale-monitor
context). The api SUCCESS confirms its `drizzle-kit migrate` preDeploy ran without error — **no-op as
expected** (no new migration this wave; a migrate error would have failed the deploy).

**Rollback path armed** before mutating (previous known-good SUCCESS deployments captured):
- api rollback target: `bd65486e-5964-4913-8a34-46e251ddffa0` (commit `e79f944`)
- web rollback target: `e5aabc42-5a6c-4432-aa39-741b2508e568` (commit `47a5bcd`)

## Verify live — prove it, don't trust the green deploy

- **api commit provenance (authoritative):** Railway deploy `meta.commitHash` for `7a12c3c3` = `e437b52` ✓ (== green merge SHA).
- **web commit provenance (authoritative):** Railway deploy `meta.commitHash` for `2d605a9f` = `e437b52` ✓.
- **api `GET /health` → 200** `{"status":"ok","db":"ok","version":"a6ad02c..."}`. The `/health.version`
  string reads `a6ad02c` (≠ e437b52) — the **known-stale env-var version** (CI-PRINCIPLES rule 1);
  correctly NOT relied upon. Provenance comes from the deploy `commitHash` above. 200 + `db:ok` = live + DB-connected.
- **web homepage `/` → 307 → `/login` → 200** (`<title>DealFlow AI</title>`, 10KB rendered login page);
  direct `/login` → 200. Healthy live app, not a crash-loop mirage behind the redirect.
- **transfer-admin route smoke:** `POST /admin/users/<uuid>/transfer-admin` unauth → **401 Unauthorized**
  `{"message":"Unauthorized","statusCode":401}`. Route is **REGISTERED** (a 404 would mean not-deployed);
  the new wave-39 surface is live on prod. No privilege mutation performed on prod data.

## Canary — skipped (sub-threshold traffic)

Real users < 1000 < `canary_threshold_dau` (1000) → `canary_status: skipped`. Below threshold the
noise/signal ratio makes real-user telemetry unreliable; the synthetic deploy verification above is the
post-deploy signal. Deploy verification ran in full regardless.

---

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "CI re-run 29051546609 on e437b52: conclusion=success, all 5 jobs green (incl. previously-red test)"
  - "dealflow-api: deployment 7a12c3c3-1304-4b15-9bfb-885766de3d8c status=SUCCESS, commitHash=e437b52 (== green merge SHA)"
  - "dealflow-web: deployment 2d605a9f-4015-4ebd-babe-a15c2a5869d1 status=SUCCESS, commitHash=e437b52"
  - "api GET /health: 200 {status:ok, db:ok}; /health.version=a6ad02c known-stale, NOT used for provenance (rule 1)"
  - "web /: 307 -> /login 200 (DealFlow AI login renders); /login direct 200 — no crash-loop"
  - "smoke POST /admin/users/:id/transfer-admin unauth -> 401 (route REGISTERED, not 404); no prod mutation"
  - "api drizzle-kit migrate preDeploy: no-op (no new migration), deploy SUCCESS confirms no migrate error"
  - "rollback armed: api bd65486e (e79f944), web e5aabc42 (47a5bcd)"
deploy_targets:
  - {platform: railway, service: dealflow-api, service_id: dcdb4ab4-abc3-4983-ae73-43512ce2c7e6, deployment_id: 7a12c3c3-1304-4b15-9bfb-885766de3d8c, state: SUCCESS, commit: e437b52355e257a2ef7daad2f4001f48fa5ac191, health_url: "https://dealflow-api-production-66d4.up.railway.app/health", health: 200}
  - {platform: railway, service: dealflow-web, service_id: 06b07f19-9146-4da0-b589-0d6d81ec1576, deployment_id: 2d605a9f-4015-4ebd-babe-a15c2a5869d1, state: SUCCESS, commit: e437b52355e257a2ef7daad2f4001f48fa5ac191, health_url: "https://dealflow-web-production-a4f7.up.railway.app/", health: 200}
async_monitor_id: ""                   # not needed — both deploys resolved terminal inline (~2.5 min, < 10-min cap)
canary_status: skipped
canary_skip_reason: "real users < 1000 (< canary_threshold_dau 1000); synthetic deploy verification is the post-deploy signal."
canary_window:
  start: null
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
rollback_targets:
  api: bd65486e-5964-4913-8a34-46e251ddffa0   # commit e79f944
  web: e5aabc42-5a6c-4432-aa39-741b2508e568   # commit 47a5bcd
deployed_at: "2026-07-09T21:xx:00Z"
note: >
  Both services live at the verified-green merge commit e437b52 (which supersedes the red 225114e after
  the CI build-order fix). Provenance proven via authoritative Railway deploy commitHash (not the stale
  /health.version). Health 200 both services, transfer-admin route registered (401 unauth), migrate no-op
  clean, rollback armed, canary skipped (sub-threshold DAU). No fabricated green: the deploy was refused on
  the red 225114e and only proceeded after CI genuinely passed on e437b52.
```
