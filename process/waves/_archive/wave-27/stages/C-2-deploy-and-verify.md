# C-2 — Deploy & verify (wave-27 M10 recordkeeping EXPORTS)

**Gate owner:** head-ci-cd (spawn-pattern, C-block). **Mode:** automatic.
**Deployed commit:** `ff29cf44bcf78557c8a86bbe291d778f3afb500d` (= C-1 green main tip).
**Both bundles changed → BOTH services deployed** (api: export controller extension; web: new /compliance/export page). **No migration** (schema unchanged).

## Railway topology (discovered, not assumed)

- Project `app-arina-5ywq3s` = `ce095f75-1f3d-4af9-939e-fe8532541475`; environment (production) = `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`.
- **dealflow-api** service = `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6`, domain `dealflow-api-production-66d4.up.railway.app`.
- **dealflow-web** service = `06b07f19-9146-4da0-b589-0d6d81ec1576`, domain `dealflow-web-production-a4f7.up.railway.app`.
- postgres / supertokens-core / supertokens-db services present — NOT touched (no schema change).
- Credential: `APP_RAILWAY_TOKEN` (project-scoped, `Project-Access-Token` header). Deploy-scoped probe succeeded; never used `me{}`.

## Rollback armed (BEFORE any deploy mutation)

Pre-deploy known-good SUCCESS deployments captured for immediate `serviceInstanceDeployV2`/redeploy rollback:
- **api rollback target:** deployment `470f6f3d-76fc-4a30-988e-4dcde61ba1c7` @ commit `0825370` (wave-26 deploy).
- **web rollback target:** deployment `8a63a649-7097-403d-a2d0-3f76bcacb62c` @ commit `6c22919`.

## Deploy ledger

| Service | mutation | new deploymentId | built commit | status | notes |
|---|---|---|---|---|---|
| dealflow-api | serviceInstanceDeployV2 | `56d29463-4072-427e-bdbe-91677ccad61b` | ff29cf4 | SUCCESS | old `470f6f3d` REMOVED (immutable swap); drizzle migrate ran one-shot pre-deploy (no-op, schema unchanged) |
| dealflow-web | serviceInstanceDeployV2 | `5333187c-56b3-470d-b9c5-b10fed833d88` | ff29cf4 | SUCCESS | latest web deploy |
| dealflow-api (redeploy) | serviceInstanceDeployV2 | `2bf5175f-54f9-4036-a29b-3f6877f28434` | ff29cf4 | SUCCESS | **GIT_SHA-refresh redeploy** — see health-mirage below |

Both terminal SUCCESS (NOT SKIPPED — deployed explicitly via GraphQL mutation, so the Railway "Wait-for-CI" phantom-skip failure mode does not apply).

## Health-mirage caught & resolved (CI-PRINCIPLES rule 1)

First api deploy `56d29463` (commit ff29cf4) reported SUCCESS and the old container was REMOVED, but `/health` still returned `version: 0825370`. Diagnosis: `health.service.ts:9` reads `version = process.env.GIT_SHA`, a MANUALLY-set static service variable that Railway does NOT auto-update per deploy (it only sets its own `RAILWAY_GIT_COMMIT_SHA`). The NEW code was genuinely live (deployment `meta.commitHash = ff29cf4`, old deploy REMOVED, migrate ran, db:ok) — only the reported version string lagged. Remediation: `variableUpsert GIT_SHA -> ff29cf4` (targeted, non-destructive), then redeployed api (`2bf5175f`). Post-redeploy `/health` → `version: ff29cf4`. **Probed hash == live deployment commit == main tip == CI-green hash.** No mirage.

## Verify prod healthy at the NEW hash

- **api /health** → HTTP 200 `{"status":"ok","db":"ok","version":"ff29cf44bcf78557c8a86bbe291d778f3afb500d"}` — version == new sha; db:ok (DB reachable, schema intact). 3 consecutive 200s → stable, not crash-looping.
- **web /** → HTTP 307 (redirect to login — healthy). **web /compliance/export** → HTTP 307 (RBAC-gated, redirects unauthed — the NEW page route is live and protected).
- web live deploy `5333187c` @ commitHash ff29cf4, is the LATEST web deployment.

## Export smoke (workspace-scoped security proof)

Live **authed** firm-admin/compliance smoke is NOT feasible: `command-center/testing/test-accounts.md` is an unpopulated template and `project.yaml: test_users.local_dev[]` is empty — no prod-fixture credentials exist. Per the CI-e2e-authoritative-policy, feasible prod smoke performed + CI SEC-8 e2e relied upon:
- **Prod auth-gate smoke:** `POST /compliance/audit-log/export` (unauthed) → **HTTP 401**. The endpoint exists at the exact route the security tests exercise (`@Controller('compliance')` + `@Post('audit-log/export')`) and is NOT publicly exposed — no records leak to an unauthenticated caller. RBAC gate proven at the perimeter.
- **Workspace-scoped isolation proof = CI SEC-8 e2e (authoritative):** the C-1 CI run (ff29cf4, run 28899963332) RAN + PASSED the SEC-8 cross-tenant isolation e2e 17/17 as `dealflow_app` — firm A export = 0 firm B rows (both/deal/audit scopes), no rls-exempt path, X-Export-Manifest truncated:true/false, CSV-injection escaping, firmLocalOrdinal. This is the definitive workspace-scoped + cross-firm proof; the authed advisor/analyst→403 RBAC path is covered there too.

## Regression

- **wave-25 rate-limiter + wave-26 boot-guards HOLD:** the app booting to a serving 200 /health with db:ok proves the startup guards passed (a failing guard crash-loops boot). Old api container REMOVED, new one stable.
- **Redis/BullMQ:** no distinct /health probe; successful boot to serving state is the queue-connect signal (a failed Redis/Bull connection at boot crash-loops — not observed).

## Canary disposition

`canary_status: skipped` — real-user DAU (0 external users) is below `canary_threshold_dau: 1000`. This is a new user-facing page + export, so a **careful full deploy with health + workspace-scoped smoke as the gate** was used (per the wave-27 canary note): both services deployed to the same immutable commit, health verified at the new hash, export perimeter smoked, boot-guards + schema confirmed. Blast radius = 0 external users. Synthetic probes (T-block) are the post-deploy signal.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway curl
verdict_evidence:
  - "dealflow-api: serviceInstanceDeployV2 -> deployment 2bf5175f SUCCESS, commit ff29cf4 (post GIT_SHA-refresh redeploy)"
  - "dealflow-web: serviceInstanceDeployV2 -> deployment 5333187c SUCCESS, commit ff29cf4, is LATEST"
  - "api /health: 200 {status:ok, db:ok, version:ff29cf44bcf78557c8a86bbe291d778f3afb500d} == live deploy commit (health-mirage resolved via GIT_SHA upsert + redeploy)"
  - "web / -> 307, web /compliance/export -> 307 (RBAC-gated new page live)"
  - "prod auth-gate smoke: POST /compliance/audit-log/export unauthed -> 401 (endpoint exists, not publicly exposed)"
  - "workspace-scoped isolation proof = CI SEC-8 e2e 17/17 ran+passed on ff29cf4 (run 28899963332) — CI-e2e-authoritative-policy"
  - "no migration (0 .sql/migration files changed d1ca492..ff29cf4); drizzle migrate ran one-shot pre-deploy no-op; schema unchanged (additive-safe trivially)"
  - "rollback armed: api->470f6f3d@0825370, web->8a63a649@6c22919"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: ff29cf44bcf78557c8a86bbe291d778f3afb500d, deployment_id: 2bf5175f-54f9-4036-a29b-3f6877f28434, verified_at: "2026-07-07T21:41:11Z", health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: ff29cf44bcf78557c8a86bbe291d778f3afb500d, deployment_id: 5333187c-56b3-470d-b9c5-b10fed833d88, verified_at: "2026-07-07T21:41:11Z", health_url: "https://dealflow-web-production-a4f7.up.railway.app/"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU 0 < threshold 1000; careful full deploy with health + workspace-scoped smoke as the gate; blast radius 0 external users; T-block synthetic probes are the post-deploy signal."
rollback_armed:
  api:  {deployment_id: 470f6f3d-76fc-4a30-988e-4dcde61ba1c7, commit: 082537011dc6bb16795929cacd4d7d7605ac0ddb}
  web:  {deployment_id: 8a63a649-7097-403d-a2d0-3f76bcacb62c, commit: 6c229197f4dfb12352e766e1754502a9f76b51e9}
deploy_window:
  start: "2026-07-07T21:33:00Z"
  api_success_at: "2026-07-07T21:35:00Z (redeploy 2bf5175f)"
  web_success_at: "2026-07-07T21:35:20Z"
  verified_at: "2026-07-07T21:41:11Z"
note: "Both services immutably deployed to ff29cf4 (fresh containers, old api REMOVED — no in-place mutation). Health-mirage on api /health version caught (stale GIT_SHA static var) and resolved by upsert+redeploy; probed hash now == live deployment commit. No prod-fixture creds for a live authed export smoke — perimeter 401 gate verified + CI SEC-8 isolation e2e (17/17) is the authoritative workspace-scoped proof. No fabricated green."

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Every C-2 stage-exit checkbox ticks from concrete, current artifacts. Rollback was armed with the
    exact previous known-good deployment IDs for BOTH services before any deploy mutation. Both bundles
    deployed to the same immutable commit ff29cf4 via serviceInstanceDeployV2 (fresh containers, old api
    REMOVED — no in-place mutation, no phantom SKIP since the deploy was triggered explicitly, not via
    Railway's Wait-for-CI webhook). The health-mirage the wave briefed me to watch DID occur — api /health
    reported the stale 0825370 version after a SUCCESS deploy — and I refused to rubber-stamp it: I traced
    it to a static GIT_SHA service var, upserted it to ff29cf4, redeployed, and re-verified that the probed
    /health version now equals the live deployment commit == main tip == CI-green hash. db:ok confirms DB
    reachability with the schema intact; zero migration files changed this wave so the additive-only /
    schema-safety criterion holds trivially and the one-shot drizzle migrate ran pre-routing as a no-op.
    The workspace-scoped export security proof is honored: no prod-fixture credentials exist for a live
    authed smoke, so per the CI-e2e-authoritative-policy I rely on the SEC-8 cross-tenant isolation e2e
    (17/17 ran+passed on this exact hash) plus a prod-perimeter smoke proving the export endpoint 401s
    unauthenticated callers. Canary correctly skipped (0 DAU < 1000) with health + smoke as the gate.
    Nothing here is inferred from stale data.
  next_action: PROCEED_TO_T
```
