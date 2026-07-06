# C-2 — Deploy & verify (wave-17, M8 pilot-partner data-isolation)

**Stage:** C-2 (deploy-and-verify, incl. canary) · **Block:** C (CI/CD) · **Gate:** head-ci-cd
**Re-entry:** RESUMED after the prior correct HOLD (2026-07-06) that caught the audit-backfill-vs-WORM-trigger defect. That defect is FIXED and merged GREEN on main. This run deploys the fix.
**Target commit:** `591b3f8bb5877db0357b629f3e88c53bb2a36843` (main HEAD)
**Deploy time:** 2026-07-06T21:44Z (api build) → api SUCCESS ~21:47Z · web SUCCESS ~21:45Z

---

## Provenance (no Ghost Green)

- **CI green on the EXACT deployed SHA.** `gh run list --commit 591b3f8…` → run **28824525244**, workflow `CI`, `conclusion: success`, `headSha: 591b3f8…` (all 5 jobs). The two intermediate migration-fix commits `58c1498` and `dfcda74` were RED; only the final `591b3f8` (which added AMP-4 per-row hash-exclusion assertion) is green — verdict was NOT extrapolated from the older C-1 `ec9e480` run.
- **Deployed commit verified per-service** (not a both-SUCCESS glance): each Railway deployment's `meta.commitHash == 591b3f8…`.
- **Populated-DB migration proof (AMP-1..5):** `apps/api/test/audit-migration-populated-db.e2e-spec.ts` proves 0014 applies against seeded HMAC-chained audit rows without the WORM collision; AMP-5 is fault-killing (removing the trigger-disable wrap would fail on populated prod). This is the suite that closed the empty-CI-vs-populated-prod gap.

## The CRUX — prod API connects as non-superuser `dealflow_app` (isolation enforced)

**PROVEN LIVE.** The api booted SUCCESS at 591b3f8 with `DATABASE_URL` authenticating as `dealflow_app`. Because `assertNonSuperuserConnection()` (apps/api/src/db/index.ts, wired into main.ts bootstrap line 32, `NODE_ENV=production` so NOT skipped) throws → process.exit(1) on any superuser/BYPASSRLS connection, **a successful boot + `/health db:ok` is a positive proof that `[RLS-GUARD]` PASSED and the runtime is non-superuser**. Confirmed independently at the DB: `dealflow_app` → `is_superuser=off`, `bypassrls=false`; as `dealflow_app` with no workspace GUC, `audit_log_entries`/`mandates` return 0 rows (FORCE RLS deny-by-default working, not an error).

---

## 2-phase deploy — what was done

### Rollback anchors (captured BEFORE any mutation)
| Service | Known-good deployment ID (pre-deploy) | Commit |
|---|---|---|
| dealflow-api | `a0afbcec-022d-4d2a-b302-8dce637ade05` | d72d7cb7 |
| dealflow-web | `ab3be4d2-a952-4329-858d-9da0d0590dc9` | d72d7cb7 |

### Migrations 0014(fixed)+0015+0016+0017 applied AS OWNER on populated prod
- Applied via `drizzle-kit migrate` as owner (postgres) through a **temporary** Railway TCP proxy (`hayabusa.proxy.rlwy.net:20281`, proxy id `c0c58b95…`), **deleted immediately after** (verified `tcpProxies: []`). Owner credential scratch shredded post-run.
- Journal advanced **0013 → 0017** (18 total migration rows; +4 for 0014-0017).
- Post-migration owner assertions (all PASS):
  - `workspaces` table exists ✓
  - **27** tables carry `workspace_id` ✓
  - `audit_log_entries`: total **328**, `null_ws=0`, all 328 = default workspace `a1b2c3d4-0000-4000-8000-000000000001` ✓ (WORM-safe DISABLE/UPDATE/ENABLE backfill)
  - 3 SECURITY DEFINER fns present: `resolve_user_workspace`, `resolve_invite`, `read_audit_chain_rls_exempt` ✓
  - FORCE RLS on `audit_log_entries` + **27** tenant tables forced ✓
  - **verifyChain ok:true after backfill** — audit hash-chain contiguity: 328 rows, genesis correct, **0 chain breaks** (prev_hash == prior entry_hash), confirming `workspace_id` is HMAC-excluded and the backfill did not alter any `entry_hash`.

### dealflow_app password + connection split
- Password generated (`openssl rand -base64 32`) — **never echoed, never committed**; `ALTER ROLE dealflow_app WITH LOGIN PASSWORD …` as owner. Confirmed `login=true`, `NOSUPERUSER`, `NOBYPASSRLS`.
- **DATABASE_URL / MIGRATE_DATABASE_URL split (documented):**
  - `MIGRATE_DATABASE_URL` = **owner** (`postgres@postgres.railway.internal`) — used by preDeploy.
  - Runtime `DATABASE_URL` = **`dealflow_app@postgres.railway.internal`** (same host/db, generated password) — used by the app process.
  - `preDeployCommand` = `DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm --filter @dealflow/api exec drizzle-kit migrate` (bare form; env-prefix override, no bash wrapper — the initial `bash -lc` wrapper reset PATH and dropped the pnpm shim → api deploy #1 FAILED `pnpm: command not found`; fixed to the bare form; no code change to drizzle.config.ts). This keeps preDeploy on owner (future migrations need DDL) and runtime on the non-superuser role.

### Deploy both services to 591b3f8 (explicit commit)
- `serviceInstanceDeployV2(commitSha: 591b3f8…)` for each service; `GIT_SHA` bumped so `/health` reports the deployed hash.
- **api deploy #1 `19262a4f…` FAILED** — root cause captured from logs: preDeploy `bash -lc` PATH reset (`pnpm: command not found`); NOT a code/RLS/migration defect. Fixed preDeploy (bare env-prefix form), redeployed.
- **api deploy #2 `f3b96634-b3bf-4364-9c0d-f035e37ba28c` → SUCCESS @ 591b3f8** (commit-verified).
- **web `cdc512b3-50a1-4885-bb10-bbcda04572ea` → SUCCESS @ 591b3f8** (commit-verified; repin not needed — deployed the explicit target commit).

---

## Live verification (against the exact deployed hash)

- **api `/health`** (own-domain): HTTP **200** `{"status":"ok","db":"ok","version":"591b3f8bb5877db0357b629f3e88c53bb2a36843"}` — version == deployed commit (not stale; was d72d7cb7 pre-deploy). **App BOOTED ⇒ [RLS-GUARD] PASSED ⇒ non-superuser runtime.**
- **web** (own-domain): HTTP **307** (auth redirect, expected).
- **Isolation LIVE (not bricked)** — authed compliance user via invite→signup (`resolve_invite` bootstrap; new user in the pilot workspace `a1b2c3d4…`):
  - **POSITIVE READ:** `GET /compliance/audit-log` → HTTP **200**, **50 rows** (seqNo 279–328) — proves `dealflow_app` GRANTs + request-scoped `app.workspace_id` GUC propagation + `resolve_user_workspace` all work live. NOT 0-row-bricked.
  - **RBAC works (not 403-for-all):** `GET /compliance/audit-log/verify` → HTTP **200** for the compliance role (unauth negative control = 401). The RLS-exempt RBAC-guard fix is live.
  - **AUDIT CHAIN:** `GET /compliance/audit-log/verify` → HTTP 200 `{"ok":true,"entriesChecked":328}` — global hash-chain walk via `read_audit_chain_rls_exempt` under `dealflow_app`; the prod 328-row chain survived the workspace_id backfill.
- Test invite mis-seed (plaintext token vs the app's `SHA256(token)` lookup, auth.service.ts:292) was a HARNESS defect — correctly diagnosed, re-seeded with the hashed token, resolved; NOT a deploy defect (the app correctly 400'd the invalid invite).

## Canary
Skipped — 0 DAU < 1000 `canary_threshold_dau`. Synthetic live probes above are the post-deploy signal.

## Coupled rollback (ARMED)
If rollback is needed, revert BOTH the deployment AND the runtime `DATABASE_URL` — old code (d72d7cb7) has no `[RLS-GUARD]`/`dealflow_app` expectations, so a code-only rollback with a dealflow_app runtime URL could misbehave:
1. `deploymentRollback`/redeploy api → `a0afbcec…`, web → `ab3be4d2…` (both d72d7cb7).
2. Set runtime `DATABASE_URL` back to the **owner** URL (value preserved in `MIGRATE_DATABASE_URL`).
Migrations are additive-only (expand phase) + HMAC-safe, so old code remains schema-compatible; no DB downgrade required.

## Security hygiene
Temporary TCP proxy deleted (prod Postgres not publicly exposed; `tcpProxies: []`). dealflow_app password lives only in Railway's encrypted `DATABASE_URL` var — never committed, never echoed. Owner-credential scratch shredded. No secret files staged for commit.

---

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "CI: run 28824525244 success on exact deployed SHA 591b3f8 (5/5 jobs; intermediate 58c1498/dfcda74 were RED — no Ghost Green)"
  - "railway dealflow-api: deployment f3b96634-b3bf-4364-9c0d-f035e37ba28c SUCCESS, meta.commitHash==591b3f8 (deploy #1 19262a4f FAILED on preDeploy PATH bug, fixed + redeployed)"
  - "railway dealflow-web: deployment cdc512b3-50a1-4885-bb10-bbcda04572ea SUCCESS, meta.commitHash==591b3f8"
  - "migrations 0014-0017 applied AS OWNER on populated prod (journal 0013->0017); 27 tables workspace_id; FORCE RLS on 27 tables; 328 audit rows backfilled to default workspace"
  - "verifyChain ok:true after backfill — 328 rows, 0 chain breaks (workspace_id HMAC-excluded)"
  - "dealflow_app role: login=true NOSUPERUSER NOBYPASSRLS; runtime DATABASE_URL=dealflow_app, preDeploy MIGRATE_DATABASE_URL=owner"
  - "api /health: 200 {status:ok,db:ok,version:591b3f8} own-domain (== deployed hash) => [RLS-GUARD] PASSED => non-superuser runtime"
  - "isolation live (authed compliance user, pilot workspace): GET /compliance/audit-log 200 w/ 50 rows (not 0-bricked); RBAC verify 200 (not 403); audit verify {ok:true,entriesChecked:328}"
  - "web /: 307 (auth redirect)"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 591b3f8bb5877db0357b629f3e88c53bb2a36843, deployment_id: f3b96634-b3bf-4364-9c0d-f035e37ba28c, verified_at: "2026-07-06T21:48:00Z", health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 591b3f8bb5877db0357b629f3e88c53bb2a36843, deployment_id: cdc512b3-50a1-4885-bb10-bbcda04572ea, verified_at: "2026-07-06T21:48:00Z", health_url: "https://dealflow-web-production-a4f7.up.railway.app/"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); live synthetic probes are the post-deploy signal."
canary_window: {}
canary_monitor_id: ""
canary_alerts: []
rollback:
  coupled: true
  api_known_good: a0afbcec-022d-4d2a-b302-8dce637ade05
  web_known_good: ab3be4d2-a952-4329-858d-9da0d0590dc9
  note: "revert BOTH deployment AND runtime DATABASE_URL->owner (owner value preserved in MIGRATE_DATABASE_URL); additive-only migrations, no DB downgrade needed."
connection_split:
  runtime_DATABASE_URL: "dealflow_app@postgres.railway.internal (non-superuser, generated pw in Railway encrypted var)"
  migrate_MIGRATE_DATABASE_URL: "postgres (owner)@postgres.railway.internal"
  preDeployCommand: "DATABASE_URL=\"$MIGRATE_DATABASE_URL\" pnpm --filter @dealflow/api exec drizzle-kit migrate"
note: "Resumed after prior correct HOLD (WORM-trigger defect, now fixed+merged). No fabricated green; api deploy #1 FAILED (preDeploy PATH) captured+fixed, not glossed. Crux proven live: non-superuser dealflow_app runtime with FORCE RLS enforced, reads work (not bricked), audit chain ok:true."

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers:
    deployment-engineer: "Railway owner-migrate + connection-split + coupled deploy (execution)"
    backend-developer: "live authed isolation E2E (positive-read + RBAC + audit-verify)"
  failed_checks: []
  rationale: >-
    Every C-2 stage-exit checkbox is ticked from concrete deployed-state artifacts, not inference.
    CI is green on the EXACT deployed SHA 591b3f8 (intermediate migration-fix commits were RED — the
    green was verified per-SHA, not extrapolated). Both services deployed SUCCESS with per-service
    commitHash==591b3f8 (Railway not SKIPPED, verified not glanced; the wave-15 stale-web lesson honored).
    Migrations 0014-0017 applied AS OWNER on the populated prod DB; the WORM-safe DISABLE/UPDATE/ENABLE
    backfill landed all 328 audit rows into the default workspace and verifyChain is ok:true afterward
    (0 chain breaks — workspace_id HMAC-excluded). The CRUX is proven live: the api boots as the
    non-superuser NOBYPASSRLS dealflow_app role (a superuser boot would fail-closed at [RLS-GUARD] and
    /health would be down), FORCE RLS is enforced, and an authed compliance user reads workspace rows
    (200, 50 rows — not 0-row-bricked), is not 403'd on its allowed route, and audit verify returns
    {ok:true,entriesChecked:328}. The one deploy FAILED (api #1, preDeploy PATH bug) was captured from
    logs, root-caused to a C-block config error (my bash -lc wrapper, no code defect), fixed, and
    redeployed to SUCCESS — not glossed as a green. Coupled rollback is armed (deployment + DATABASE_URL),
    migrations are additive-only, the temporary prod-Postgres proxy is deleted, and no secret was echoed
    or committed. No fabricated green.
  next_action: PROCEED_TO_T
```
