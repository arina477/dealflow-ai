# C-2 — Deploy & verify (wave-29 records-view / deal-activity browse)

**Block:** C (CI/CD) · **Stage:** C-2 · **Mode:** automatic · **Gate:** head-ci-cd
**Deployed commit:** `8526999f0cc34da68aad945b9ab2a4dbee4fe892` (C-1 green tip)

## Scope

BOTH bundles changed → deploy BOTH services. **NO migration** (schema unchanged; deal-activity browse reads existing pipeline/mandate tables). No-op preDeploy. Verified: `git diff origin/main...HEAD | grep -iE 'migrat|drizzle|\.sql'` → empty.

## Railway credential

Project-scoped deploy token via `APP_RAILWAY_TOKEN` → `Project-Access-Token` header (never Bearer, never `me{}`). Project `ce095f75-1f3d-4af9-939e-fe8532541475` (`app-arina-5ywq3s`), env `production` `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`. Deploy-scoped probe returned `data.project != null`, no errors → credential usable.

## Step 1 — Rollback ARMED (pre-deploy known-good captured before any mutation)

Previous known-good deployment IDs @ `775cd67` (wave-28 ship), cached locally:

| Service | Service ID | Pre-deploy known-good dep ID | Commit |
|---|---|---|---|
| api | dcdb4ab4-abc3-4983-ae73-43512ce2c7e6 | **f081fb2e-f0d0-4d74-a86b-19d63ab47ca3** | 775cd67 |
| web | 06b07f19-9146-4da0-b589-0d6d81ec1576 | **1367c668-8ad6-4065-934a-b6ef5571601b** | 775cd67 |

Rollback path: `serviceInstanceDeployV2(serviceId, environmentId, commitSha:775cd67)` or `deploymentRedeploy(id:<known-good>)`. Armed throughout the window.

## Step 2 — Deploy BOTH (serviceInstanceDeployV2) + health-mirage guard

- **GIT_SHA refresh (mirage guard):** api `GIT_SHA` var upserted `775cd67` → `8526999` via `variableUpsert` BEFORE deploy, so `/health` reports the new hash (not stale).
- **api** deploy `2140579d-69c2-4baa-b337-9b7af6f6bac8` → **SUCCESS**; `meta.commitHash=8526999` (correct).
- **web** first deploy `124f2342` (serviceInstanceDeployV2 without commitSha) → SUCCESS BUT `meta.commitHash=775cd67` — **STALE**. `serviceInstanceDeployV2` with no `commitSha` redeployed the service's currently-pinned commit, NOT `main` HEAD. Caught by checking `meta.commitHash` against the reviewed SHA (Phantom-Skip / commit-metadata staleness guard) — web root 307 was identical old-or-new, so status alone would have masked it.
- **web** corrected: `serviceInstanceDeployV2(..., commitSha:8526999)` → deploy `a3b357f1-5d10-4608-89c4-b0904e0a892f` → **SUCCESS**; `meta.commitHash=8526999` (correct — tree carries the scope/tab UI).

## Step 3 — Prod healthy at the NEW hash (own-domain probes, no mirage)

- **api** `GET https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"8526999…"}` — version == deployed hash, stable over 3 reads, own domain (NOT global-routed), `db:ok` = live Postgres. No health mirage.
- **web** `https://dealflow-web-production-a4f7.up.railway.app/` → **307** (auth-guard redirect; Next.js has no /health).
- **web** `/compliance/audit-log` → **307** (RBAC-gated page carrying the new deal-activity scope/tab; auth-guard redirect).

## Step 4 — Smoke: deal-activity browse

- **Perimeter (unauthed):** `GET /compliance/records/deal-activity` (api) → **401**. Perimeter holds.
- **Authed leg (compliance/admin→200 paginated own-firm rows; advisor→403):** NO live authed prod creds available — `project.yaml: test_users.local_dev` is `[]` and `command-center/testing/test-accounts.md` persona rows are unpopulated placeholders. Per **CI-e2e-authoritative-policy**, the authed RBAC + isolation behavior is proven by CI this wave: DA-RBAC-1/2 (compliance/admin succeed), DA-RBAC-3/4 (advisor/analyst → ForbiddenException/403), DA-ISO-1/2 (firm A/B cross-tenant zero-leak) all RAN against real Postgres and PASSED (see C-1). Attempting prod-authed smoke with absent creds would produce a false BLOCKED (the file explicitly warns against dev-seed creds vs prod auth). Live unauthed-401 perimeter + CI-e2e is the authoritative disposition.

## Step 5 — Regression (prior waves hold)

- api `db:ok` + boot success ⇒ wave-27 export, wave-28 retention, and the rate-limiter/boot-guards paths intact (any boot-guard trip would fail `/health`).
- api `/compliance/audit-log` (wave-27/28 area) unauthed → **401** (route alive, perimeter holds).
- web `/login` → **200** (app boots; rate-limiter not tripping boot).

## Step 6 — Canary disposition

`canary_status: skipped` — 0 external users (< 1000 DAU `canary_threshold_dau`). The careful sequenced full deploy with own-domain health + commit-pin verification + perimeter smoke served as the gate. New browse route + UI scope/tab shipped; no real-user blast radius.

## Chronology

- api GIT_SHA upsert + api/web deploy triggered ~09:22Z; api SUCCESS ~09:24Z, web(stale) SUCCESS ~09:23Z.
- web stale detected; corrected web deploy `a3b357f1` triggered; SUCCESS ~09:2?Z (build ~101s).
- Prod verified at new hash 8526999 immediately after each SUCCESS.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway api: deployment 2140579d-69c2-4baa-b337-9b7af6f6bac8 SUCCESS, meta.commitHash=8526999"
  - "railway web: deployment a3b357f1-5d10-4608-89c4-b0904e0a892f SUCCESS, meta.commitHash=8526999 (after stale-775cd67 correction via commitSha-pinned redeploy)"
  - "https://dealflow-api-production-66d4.up.railway.app/health: 200 {status:ok,db:ok,version:8526999} — version==deployed hash, own domain, stable 3 reads (no mirage)"
  - "https://dealflow-web-production-a4f7.up.railway.app/: 307; /compliance/audit-log: 307 (RBAC-gated scope/tab page)"
  - "SMOKE unauthed GET /compliance/records/deal-activity: 401 (perimeter); authed leg → CI-e2e-authoritative (DA-RBAC/DA-ISO ran+passed, no live prod creds)"
  - "REGRESSION: api /compliance/audit-log 401 + web /login 200 + db:ok — prior-wave export/retention/rate-limiter hold"
deploy_targets:
  - {platform: railway, service: dealflow-api, id: "dcdb4ab4-abc3-4983-ae73-43512ce2c7e6", deployment_id: "2140579d-69c2-4baa-b337-9b7af6f6bac8", state: SUCCESS, commit: "8526999f0cc34da68aad945b9ab2a4dbee4fe892", url: "https://dealflow-api-production-66d4.up.railway.app", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-08T09:28:00Z"}
  - {platform: railway, service: dealflow-web, id: "06b07f19-9146-4da0-b589-0d6d81ec1576", deployment_id: "a3b357f1-5d10-4608-89c4-b0904e0a892f", state: SUCCESS, commit: "8526999f0cc34da68aad945b9ab2a4dbee4fe892", url: "https://dealflow-web-production-a4f7.up.railway.app", health_url: "https://dealflow-web-production-a4f7.up.railway.app/", verified_at: "2026-07-08T09:28:00Z"}
rollback_armed:
  api:  {known_good_deployment_id: "f081fb2e-f0d0-4d74-a86b-19d63ab47ca3", commit: "775cd67e7c910dff76409c7ac9e7b7cc823662f3"}
  web:  {known_good_deployment_id: "1367c668-8ad6-4065-934a-b6ef5571601b", commit: "775cd67e7c910dff76409c7ac9e7b7cc823662f3"}
migration: none                       # schema unchanged (read-only browse); no Drizzle migration in diff
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "0 external users (< 1000 canary_threshold_dau); careful sequenced full deploy + own-domain health + commit-pin + perimeter smoke is the gate."
canary_window: {start: "", duration_minutes: 0}
canary_monitor_id: ""
canary_alerts: []
note: >
  BOTH services live @ 8526999 (SUCCESS, commit-verified). Caught + corrected a stale-web deploy
  (serviceInstanceDeployV2 without commitSha redeployed pinned 775cd67, not HEAD) by verifying
  meta.commitHash against the reviewed SHA — NOT trusting SUCCESS status alone. No migration. Rollback
  armed to 775cd67 throughout. Authed smoke deferred to CI-e2e-authoritative (no live prod creds).

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Every C-2 stage-exit check ticks from concrete deployed-state artifacts. Both api + web are live at the
    exact reviewed commit 8526999 (meta.commitHash verified on both, NOT inferred from SUCCESS status — which
    is precisely how the stale-web deploy on 775cd67 was caught and corrected via a commitSha-pinned redeploy).
    The api /health probe returns 200 {status:ok, db:ok, version==8526999} on its OWN domain, stable across
    reads — the health-mirage guard passed after refreshing GIT_SHA before deploy. Rollback was armed to the
    known-good 775cd67 deployment IDs (cached locally) BEFORE any deploy mutation. No Drizzle migration exists
    (read-only wave — additive-only trivially satisfied; no destructive-lock risk). Deploy used a
    commit-pinned immutable-artifact mutation (serviceInstanceDeployV2), not in-place mutation. Perimeter smoke
    (unauthed 401) holds; the authed RBAC/isolation contract is CI-e2e-authoritative (DA-RBAC advisor/analyst
    403 + DA-ISO cross-firm zero-leak ran+passed against real Postgres this wave) since no live prod credentials
    exist. Prior-wave regression (export/retention/rate-limiter) holds via db:ok + live routes. Canary correctly
    skipped below the 1000-DAU threshold with the sequenced full deploy as the gate.
  next_action: PROCEED_TO_T-block
```
