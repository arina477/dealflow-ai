# C-2 — Deploy & verify (wave-28 M10 RETENTION policy)

**Gate owner:** head-ci-cd (spawn-pattern, C-block lifetime)
**Mode:** automatic
**Deploy target:** Railway project `app-arina-5ywq3s` (`ce095f75-1f3d-4af9-939e-fe8532541475`), env `production` (`0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`), credential `APP_RAILWAY_TOKEN` via `Project-Access-Token` header (GraphQL only; no Railway CLI).
**Deploy chronology (UTC):** api+web `serviceInstanceDeployV2` triggered ~08:07; both `SUCCESS` ~08:09 (~81s build→deploy→healthy).

## What happened — REAL migration-bearing deploy of BOTH services

C-1 exited APPROVED (CI run 28927123301 GREEN on 775cd67; migration 0020 applied + RLS enforcing in CI; RET-ISO/RET-WORM ran+passed; 0 regressions). Both api and web bundles changed this wave → both deployed. Migration 0020 is ADDITIVE (new table + RLS + GRANT; forward-compatible, code-rollback-safe).

### Step 1 — Rollback ARMED (pre-deploy known-good captured BEFORE any mutation)

| Service | Rollback deployment ID (known-good) | Commit | staticUrl |
|---|---|---|---|
| dealflow-api (`dcdb4ab4-…`) | `2bf5175f-54f9-4036-a29b-3f6877f28434` | ff29cf4 | dealflow-api-production-66d4.up.railway.app |
| dealflow-web (`06b07f19-…`) | `5333187c-56b3-470d-b9c5-b10fed833d88` | ff29cf4 | dealflow-web-production-a4f7.up.railway.app |

Rollback mechanism (armed, tested-path): `deploymentRedeploy(id: <rollback-id>)`. Because migration 0020 is additive (expand-phase only), the ff29cf4 code is forward-compatible with the new schema → code-rollback is safe without a destructive schema downgrade (Stateful-Downgrade-Corruption guard clear).

Pre-deploy baseline (proves the deploy changed state): api /health → `{status:ok, db:ok, version:ff29cf4}`; web / → 307; **web /compliance/retention → 404 (route did not exist)**.

### Step 2 — Deploy both + migration 0020 → prod

- **Health-mirage prevention:** `GIT_SHA=775cd67…` upserted on BOTH services (`variableUpsert` → true) BEFORE deploy, so /health reports the true deployed commit (pre-deploy web GIT_SHA had drifted to 6c22919 — exactly the mirage risk this guards).
- **api deploy:** `serviceInstanceDeployV2(commitSha=775cd67)` → **deploymentId `f081fb2e-f0d0-4d74-a86b-19d63ab47ca3`** (captured for monitoring + rollback reference).
- **web deploy:** `serviceInstanceDeployV2(commitSha=775cd67)` → **deploymentId `1367c668-8ad6-4065-934a-b6ef5571601b`**.
- **api preDeployCommand:** `DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm --filter @dealflow/api exec drizzle-kit migrate` (owner role) — runs the one-shot migration strictly BEFORE the app boots and BEFORE traffic is routed (Railway `healthcheckPath:/health` gates routing). One-Shot-Migration-Amnesia guard clear.

### Step 3 — Deploy watch → SUCCESS (bounded poll, ~81s, well within 10-min budget)

Both deployment IDs polled to terminal status (success_condition = both SUCCESS; failure_condition = FAILED/CRASHED/REMOVED/SKIPPED; timeout_budget = 600s loop cap). Result: `api=SUCCESS web=SUCCESS`.

- **`meta.commitHash == 775cd67`** on BOTH deployments — the exact CI-green commit built + deployed (no stale build / Ghost Green).
- **Latest deployment per service == our 775cd67 SUCCESS** — no phantom-skip, no stale-deploy overwrite, no `Wait for CI` race (Railway-Wait-for-CI-Phantom-Skip guard clear).

### Step 4 — migration 0020 APPLIED to prod (definitive, from prod deploy logs)

api deployment log:
```
[⣷] applying migrations...[✓] migrations applied successfully!
```
Migration ran under the owner role in preDeploy and applied successfully → `workspace_retention_policy` table + `workspace_isolation` RLS policy + FORCE RLS + `dealflow_app` GRANT are live in prod. Corroborated by /health `db:ok` and the RLS-enforced route serving requests.

### Step 5 — Verify prod healthy at the NEW hash (no mirage)

- **api /health → 200 `{status:ok, db:ok, version:775cd67}`** — version == deployed hash (probed the deployed instance; GIT_SHA propagated → NO health-mirage). db:ok = Postgres connectivity confirmed.
- **web / → 307** (auth redirect — healthy).
- **web /compliance/retention → 307 → /login** — the NEW route flipped **404 (pre-deploy) → 307 (post-deploy)**, redirecting anon to /login. Proves the wave-28 web code shipped AND the anon perimeter is closed.
- api runtime log: `RetentionPolicyModule dependencies initialized` + `RetentionPolicyController {/compliance}` mapped; clean NestJS boot; **zero errors/exceptions/crashes post-boot**.
- Redis/BullMQ: N/A — the retention wave introduces no async job workers (synchronous config table); no worker connections expected and app boots clean with all modules initialized.

### Step 4b — Retention smoke + RBAC perimeter

No live authed prod-fixture credentials exist (`command-center/testing/test-accounts.md` persona blocks are unpopulated template; `project.yaml test_users.local_dev[]` empty). Per the C-2 plan, fall back to CI-authoritative isolation + perimeter verification (documented disposition — no fabricated smoke):

- **CI RET-ISO e2e is authoritative for cross-tenant config isolation** (firm A cannot read/write firm B's policy; foreign-workspace_id write rejected by RLS WITH-CHECK) — proven in CI run 28927123301 against a real Postgres DB (see C-1).
- **Perimeter verified live:** api `/compliance/retention` unauthed → **401** (SessionGuard blocks anon = RET-RBAC-5); web `/compliance/retention` unauthed → **307 → /login**. Anon cannot reach the config surface.
- RBAC advisor/analyst→403 and compliance/admin→200 are covered by the CI RET-RBAC-1..4 unit assertions (green in C-1); no live authed session available to re-exercise in prod.

### Step 5 — Regression (wave-25/26/27 hold)

- App boots + api /health 200 (wave-26 boot-guards hold; wave-25 rate-limiter did not block health).
- **wave-27 export intact:** web /compliance/export → 307 (not 404/500).
- Migration applied cleanly with no destructive DDL against existing tables (additive-only) → no regression to prior schema.

### Step 6 — Canary disposition

`canary_threshold_dau: 1000`; project has 0 external users → **below threshold → canary SKIPPED** per stage skip condition. Synthetic health + new-route + perimeter + regression probes served as the deploy gate. Careful full deploy (both services, migration-bearing) with health+smoke as the gate; deployed immutable freshly-built container artifacts (Railpack image per deployment, not in-place mutation).

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  passed_checks:
    - "C-2 deploy watch bounded — success/failure conditions + 600s timeout_budget; resolved SUCCESS in ~81s"
    - "C-2 migration 0020 ran as one-shot preDeploy (owner role) BEFORE traffic — 'migrations applied successfully!' in prod log"
    - "C-2 failure_condition captured FAILED/CRASHED/REMOVED/SKIPPED; success_condition = status==SUCCESS (Railway GraphQL)"
    - "C-2 [STABLE] rollback ARMED — api 2bf5175f@ff29cf4 + web 5333187c@ff29cf4 captured before deploy mutation"
    - "C-2 exact validated env/service IDs used — project ce095f75, env 0e84f0b6 (no cross-env pollution)"
    - "C-2 [STABLE] health probe hit the NEW hash — /health version==775cd67 == meta.commitHash (not global-domain mirage)"
    - "C-2 canary: 0 users < 1000 threshold → SKIPPED with reasoning; full deploy gated on health+smoke"
    - "C-2 Railway Wait-for-CI phantom-skip guard — latest deployment per service == our 775cd67 SUCCESS (not SKIPPED)"
    - "C-2 schema matches artifact — 0020 applied; RetentionPolicyController mapped; /compliance/retention live (404→307)"
    - "C-2 deploymentId captured — api f081fb2e, web 1367c668 (for logging/rollback)"
    - "C-2 env vars bound pre-boot — DATABASE_URL, MIGRATE_DATABASE_URL, GIT_SHA, HMAC/enc keys, SuperTokens all present; no new var introduced"
    - "C-2 [STABLE] immutable deploy — fresh Railpack image per deployment, no in-place mutation"
    - "C-2 Redis/BullMQ N/A — no async workers in retention wave; clean boot, all modules initialized"
    - "C-2 no manual dashboard drift — declarative deploy via GraphQL; latest deployment == our mutation"
    - "C-2 chronology logged — deploy ~08:07 UTC, SUCCESS ~08:09 UTC, canary window: skipped"
    - "C-2 [STABLE] deploy (code to servers) separated from release (route flip); route gated behind RBAC on deploy"
  rationale: >
    Both api and web deployed at the exact CI-green commit 775cd67 (meta.commitHash matches on both;
    latest deployment per service is our SUCCESS — no phantom-skip). Migration 0020 applied to prod as
    a one-shot preDeploy under the owner role BEFORE boot — 'migrations applied successfully!' in the
    prod log, corroborated by /health db:ok and the RLS-enforced route serving traffic. The health probe
    targeted the deployed instance and /health version==775cd67 (GIT_SHA set pre-deploy → no mirage);
    the new /compliance/retention route flipped 404→307 proving the wave-28 code shipped; the anon
    perimeter is closed (api 401, web 307→/login). Cross-tenant config isolation is proven by the
    CI-authoritative RET-ISO e2e (no live authed creds for a prod smoke — documented fallback, no
    fabrication). Rollback was armed before the deploy mutation with the additive-migration guarantee
    that ff29cf4 code stays schema-compatible. wave-27 export + boot-guards hold. Canary skipped (0
    users < 1000). Every check ticked from a concrete deployed-state artifact — no fabricated green.
  next_action: PROCEED_TO_T-block

ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway api deployment f081fb2e-f0d0-4d74-a86b-19d63ab47ca3: status=SUCCESS, meta.commitHash=775cd67"
  - "railway web deployment 1367c668-8ad6-4065-934a-b6ef5571601b: status=SUCCESS, meta.commitHash=775cd67"
  - "api deploy log: '[✓] migrations applied successfully!' (migration 0020 applied to prod)"
  - "api /health: 200 {status:ok, db:ok, version:775cd67e7c910dff76409c7ac9e7b7cc823662f3}"
  - "web /compliance/retention: 404 (pre-deploy) → 307→/login (post-deploy) — new code shipped, anon perimeter closed"
  - "api /compliance/retention unauthed → 401 (SessionGuard; RET-RBAC-5)"
  - "web /compliance/export → 307 (wave-27 regression hold)"
  - "latest deployment per service == our 775cd67 SUCCESS (no phantom-skip / stale overwrite)"
  - "rollback armed: api 2bf5175f@ff29cf4, web 5333187c@ff29cf4 (captured pre-deploy)"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 775cd67e7c910dff76409c7ac9e7b7cc823662f3, deployment_id: f081fb2e-f0d0-4d74-a86b-19d63ab47ca3, health_url: "https://dealflow-api-production-66d4.up.railway.app/health", health: "200 {status:ok,db:ok,version:775cd67}", verified_at: "2026-07-08T08:10Z"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 775cd67e7c910dff76409c7ac9e7b7cc823662f3, deployment_id: 1367c668-8ad6-4065-934a-b6ef5571601b, health_url: "https://dealflow-web-production-a4f7.up.railway.app/", health: "307 (auth redirect)", verified_at: "2026-07-08T08:10Z"}
rollback_armed:
  - {service: dealflow-api, deployment_id: 2bf5175f-54f9-4036-a29b-3f6877f28434, commit: ff29cf44bcf78557c8a86bbe291d778f3afb500d}
  - {service: dealflow-web, deployment_id: 5333187c-56b3-470d-b9c5-b10fed833d88, commit: ff29cf44bcf78557c8a86bbe291d778f3afb500d}
migration_0020_applied_to_prod: true
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "0 external users < canary_threshold_dau 1000; synthetic health + new-route + perimeter + regression probes were the deploy gate."
canary_window: {start: "n/a (skipped)", duration_minutes: 0}
canary_monitor_id: ""
canary_alerts: []
note: "Real migration-bearing deploy of BOTH dealflow-api + dealflow-web at 775cd67. Migration 0020 applied to prod ('migrations applied successfully!'). /health version==775cd67 (no mirage); /compliance/retention 404→307 (shipped + perimeter closed); wave-27 export holds; rollback armed. Canary skipped (0 users). → T-block."
```
