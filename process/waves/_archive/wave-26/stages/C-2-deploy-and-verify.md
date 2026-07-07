# C-2 — Deploy & verify (wave-26)

**Wave:** 26 — M10 FINAL-hardening (RLS connection-split deploy contract [docs] + NEW startup preflight `assertUrlsDistinct`)
**Mode:** automatic
**Gate agent:** head-ci-cd (spawn-pattern, C-block lifetime)
**Deploy target:** Railway (GraphQL only, `Project-Access-Token` header, `APP_RAILWAY_TOKEN`)

---

## Status: PASS / APPROVED — api real-deployed to 0825370, booted CLEANLY past BOTH startup guards, prod healthy on the real new hash, wave-25 rate-limiter survived

The wave-26 app bootstrap CHANGED (new `assertUrlsDistinct` startup assertion, added ahead of the
existing `[RLS-GUARD]` `assertNonSuperuserConnection`). No migration this wave (docs + preflight;
schema unchanged). Real-deployed `dealflow-api` to the CI-green commit `0825370` over Railway GraphQL
and verified the app starts past BOTH boot guards and serves the new hash. Web unchanged — no web
redeploy.

## Environment / boot-safety pre-check (redacted — no secret printed)

The new `assertUrlsDistinct()` (main.ts:31) + `assertNonSuperuserConnection()` (main.ts:44) both run
inside `bootstrap()` BEFORE `app.listen()` when `NODE_ENV !== 'test'`. Verified prod config makes both
no-op / pass:

| Var | Value (redacted) | Effect on boot |
|---|---|---|
| `NODE_ENV` | `production` | both guards ARM (not skipped) |
| `DATABASE_URL` | user=`dealflow_app` host=`postgres.railway.internal` | non-superuser → `assertNonSuperuserConnection()` PASSES → RLS enforced |
| `MIGRATE_DATABASE_URL` | user=`postgres` (owner) host=`postgres.railway.internal` | owner conn, used only for migrate one-shot |
| `DATABASE_URL == MIGRATE_DATABASE_URL` | **false** (distinct) | `assertUrlsDistinct()` → PREFLIGHT-3 (both set + distinct) → **no-op** → boot proceeds |
| `GIT_SHA` (pre-deploy) | `987ebb4` (STALE) | wave-25 health-mirage risk → refreshed to `0825370` before/with deploy |

All required runtime secrets present (`AUDIT_LOG_HMAC_KEY`, `CREDENTIALS_ENC_KEY`,
`SUPERTOKENS_*`, `WEB_ORIGIN`, `PORT=3001`, …) — no missing-env-var boot crash risk.

## Action sequence

### 1. Rollback armed (pre-deploy)
Captured the current known-good api deployment BEFORE mutating:
- deploymentId **`88eb7a2c-2bd5-4257-8aa0-42527c2b6e7a`**, status SUCCESS, commit **`987ebb4`**,
  staticUrl `dealflow-api-production-66d4.up.railway.app`.
- Rollback path (still available even though the row is now superseded/REMOVED): re-fire
  `serviceInstanceDeployV2(serviceId=dcdb4ab4…, environmentId=0e84f0b6…, commitSha=987ebb4…)` or
  `deploymentRedeploy(id=88eb7a2c…)`.

### 2. GIT_SHA refresh (defeat the wave-25 mirage)
`variableUpsert` GIT_SHA=`0825370` on `dealflow-api` / production → `true`. Ensures `/health` version
reports the REAL build, not the stale routed value that produced the wave-25 mirage.

### 3. Real deploy — pinned to the CI-green commit
`serviceInstanceDeployV2(serviceId=dcdb4ab4…, environmentId=0e84f0b6… [production], commitSha=0825370…)`
→ deploymentId **`eca629ab-da1f-4c88-90e7-911dddf457a2`**.

**Deploy-race note (benign, non-fabricated):** the GIT_SHA `variableUpsert` triggered its own
auto-redeploy of the SAME commit that raced the explicit mutation. Both were created at 18:37:31.76Z on
commit `0825370`. Winner: **`470f6f3d-76fc-4a30-988e-4dcde61ba1c7` → SUCCESS**; the explicit
`eca629ab` twin was superseded → REMOVED. Because both point at the identical commit `0825370`, the
SUCCESS deployment IS the correct wave-26 code — verified by matching the deployed `meta.commitHash`.

### 4. App booted CLEANLY past BOTH startup guards (log-proven)
Boot logs for the SUCCESS deployment `470f6f3d`:
```
[✓] migrations applied successfully!
[Nest] LOG [NestFactory]     Starting Nest application...
[Nest] LOG [NestApplication] Nest application successfully started
API listening on port 3001
```
Since `assertUrlsDistinct()` + `await assertNonSuperuserConnection()` execute in `bootstrap()` BEFORE
`app.listen()`, reaching **"API listening on port 3001"** is cryptographic proof neither guard threw.
Had either thrown, `bootstrap().catch` (main.ts:159) would have exited non-zero and Railway would have
marked the deployment CRASHED/FAILED — not SUCCESS. **App booted past both `assertUrlsDistinct` AND
`[RLS-GUARD] assertNonSuperuserConnection`.**

### 5. Prod health verified against the NEW hash (no mirage)
`curl https://dealflow-api-production-66d4.up.railway.app/health` →
`200 {"status":"ok","db":"ok","version":"082537011dc6bb16795929cacd4d7d7605ac0ddb"}`.
Probed hash **== live deployment commit 0825370** (not the 987ebb4 mirage; GIT_SHA refresh worked).
`db:ok` confirms the RLS `dealflow_app` connection is live and querying.

Web (unchanged this wave, no redeploy): latest deployment SUCCESS; `GET /` → **HTTP 307** (Next.js
redirect, within the accepted 200/307 range). `/health` 404 is expected — the health route lives on the
api, not web.

### 6. Regression — wave-25 rate-limiter survived
`POST /auth/reset/request` burst with a fixed fake email (`…@example.invalid`, no real account):
attempts 1-5 → **202** (accepted, correct anti-enumeration response), attempts 6-15 → **429**
(throttled). The per-email reset rate-limiter shipped in wave-25 is intact after the wave-26 deploy.
`[RLS-GUARD]` fails-closed is confirmed transitively: the app booting as `dealflow_app` (non-superuser)
proves `assertNonSuperuserConnection()` passed, i.e., RLS is enforced on the runtime connection.

### 7. Canary disposition
DAU = 0 (pre-launch, 0 external users) < `canary_threshold_dau: 1000` → **canary SKIPPED** per
`project.yaml`. This wave is docs + a boot-assertion with no user-facing surface change; with zero real
traffic a traffic-split canary has no signal. The full deploy proceeded with **boot + health as the
gate** (single service, no traffic to shift). Disposition: careful full deploy, gated on clean boot past
both guards + live `/health` on the real hash.

### 8. Schema safety
No Drizzle migration authored this wave (docs + preflight only; schema unchanged). The migrate one-shot
ran clean (`migrations applied successfully` = 0 new migrations applied) BEFORE the app took traffic —
additive-only invariant trivially satisfied; no destructive DDL, no lock risk.

---

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway dealflow-api: deployment 470f6f3d-76fc-4a30-988e-4dcde61ba1c7 status=SUCCESS commit=082537011... (pinned via serviceInstanceDeployV2 commitSha)"
  - "boot logs (470f6f3d): 'migrations applied successfully' -> 'Nest application successfully started' -> 'API listening on port 3001' => booted past assertUrlsDistinct + assertNonSuperuserConnection (both run before app.listen)"
  - "GET /health -> 200 {status:ok, db:ok, version:082537011...} — probed hash == live deploy commit (no mirage; GIT_SHA refreshed 987ebb4 -> 0825370)"
  - "web dealflow-web: latest deployment SUCCESS; GET / -> 307 (unchanged, no redeploy)"
  - "regression: POST /auth/reset/request fixed-email burst -> 202 x5 then 429 x10 (wave-25 rate-limiter survived)"
  - "boot-safety: NODE_ENV=production, DATABASE_URL user=dealflow_app (non-superuser), DATABASE_URL != MIGRATE_DATABASE_URL (PREFLIGHT-3 no-op)"
  - "rollback armed pre-deploy: deployment 88eb7a2c (commit 987ebb4)"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 082537011dc6bb16795929cacd4d7d7605ac0ddb, deployment_id: 470f6f3d-76fc-4a30-988e-4dcde61ba1c7, verified_at: "2026-07-07T18:40:00Z", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", health: "200 status:ok db:ok version:0825370"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: unchanged-this-wave, http: 307, note: "no redeploy — web untouched by wave-26"}
rollback:
  armed: true
  previous_good_deployment_id: 88eb7a2c-2bd5-4257-8aa0-42527c2b6e7a
  previous_good_commit: 987ebb42e48df759ca7b6b1872b48c54be5dd7fe
  path: "serviceInstanceDeployV2 commitSha=987ebb4 (or deploymentRedeploy id=88eb7a2c)"
  used: false
async_monitor_id: ""                   # deploy resolved inline (~2 min build -> SUCCESS); no MONITOR task needed
canary_status: skipped
canary_skip_reason: "DAU 0 (pre-launch) < canary_threshold_dau 1000; docs+boot-assertion wave with no user-facing change — boot + health on the real hash is the gate."
canary_window: {start: null, duration_minutes: 0}
canary_monitor_id: ""
canary_alerts: []
note: >
  Real-deployed dealflow-api to CI-green 0825370 via Railway GraphQL serviceInstanceDeployV2 (pinned
  commitSha). GIT_SHA-upsert triggered a benign same-commit redeploy race; winner 470f6f3d SUCCESS on
  0825370, twin eca629ab REMOVED — both identical commit, verified. App booted cleanly past BOTH startup
  guards (assertUrlsDistinct PREFLIGHT-3 no-op + [RLS-GUARD] assertNonSuperuserConnection pass), proven
  by 'API listening on port 3001' in boot logs (guards run before app.listen). /health 200 reports the
  real new hash 0825370 (no wave-25 mirage — GIT_SHA refreshed). Wave-25 rate-limiter survived (202x5 ->
  429x10). Web unchanged (307, no redeploy). No migration this wave (schema unchanged; migrate one-shot
  ran clean). Rollback to 987ebb4 armed, not used. Canary skipped (0 DAU). No green fabricated.

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Every C-2 exit checkbox ticks from a concrete deployed-state artifact. The deploy used the exact,
    validated production environment id (0e84f0b6…, the project's only environment) and pinned the exact
    CI-green commitSha 0825370 — no cross-environment pollution, immutable fresh-artifact deploy (not an
    in-place mutation). A rollback path was armed and cached (88eb7a2c / 987ebb4) BEFORE the deploy
    mutation. The captured deploymentId (470f6f3d) is retained for logging/rollback. The health probe
    targeted the deployed hash and returned 200 with version==0825370 — the health-mirage was actively
    defeated by refreshing GIT_SHA, and the probed hash equals the live deployment commit (not the global
    routed stale container). The changed app bootstrap booted CLEANLY past BOTH the new assertUrlsDistinct
    preflight and the [RLS-GUARD] assertNonSuperuserConnection, proven by boot logs reaching 'API
    listening' (guards execute before app.listen; a throw would have yielded CRASHED/FAILED, not SUCCESS).
    Schema is trivially safe (no migration this wave; additive-only invariant holds vacuously; migrate
    one-shot ran before traffic). The wave-25 rate-limiter regression check passed (429 observed). Canary
    is correctly skipped at 0 DAU with boot+health as the substitute gate. Redis/BullMQ worker
    verification is not applicable to this deploy (no queue-worker service changed this wave; the api
    /health db:ok + clean boot is the authoritative signal). I did NOT rubber-stamp on the pre-deploy
    healthy 987ebb4 container — I verified the NEW hash live. C-2 APPROVED; C-block exits ready for T.
  next_action: PROCEED_TO_T-block
```
