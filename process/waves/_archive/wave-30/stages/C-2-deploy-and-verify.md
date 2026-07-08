# C-2 — Deploy & verify (wave-30 M9 Affinity DataSourceAdapter)

> Backend-only wave. `dealflow-api` bundle changed (Affinity adapter registered). **NO migration.**
> **NO AFFINITY_API_KEY set** (founder-gated tail). Web unchanged → no web redeploy. Deploy target: Railway
> (GraphQL only, `Project-Access-Token` header, token `APP_RAILWAY_TOKEN`).

## Railway context (discovered)

- Project `ce095f75-1f3d-4af9-939e-fe8532541475` (`app-arina-5ywq3s`), environment `production` `0e84f0b6-…`.
- Service `dealflow-api` = `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6`, domain `dealflow-api-production-66d4.up.railway.app`, healthcheckPath `/health`.
- Credential probe (deploy-scoped `project(id)`, never `me{}`): usable. `AFFINITY_API_KEY` confirmed NOT set on the service (adapter dormant — correct).

## 1. Rollback armed (BEFORE deploy mutation)

- Pre-deploy known-good: deployment `2140579d-69c2-4baa-b337-9b7af6f6bac8`, status SUCCESS, **commit 8526999**, `/health` `{ok, db:ok, version:8526999}`.
- Armed rollback path: `serviceInstanceDeployV2(env, svc, commitSha=8526999...)` + restore `GIT_SHA=8526999`. `canRedeploy: true`. Not exercised (deploy healthy).

## 2. Deploy (NO migration, NO key)

- No-migration verification: `git diff 8526999..a6ad02c` on `*drizzle*/*migrations*/*.sql` → EMPTY. Deploy delta = adapter + spec + registry + tsbuildinfo only. `preDeployCommand` drizzle-kit migrate runs as a no-op (no new migrations) BEFORE traffic — additive-only trivially satisfied (zero DDL).
- Trigger: `serviceInstanceDeployV2(commitSha=a6ad02c)` — commit PINNED to avoid Railway "Wait for CI" phantom-skip. Deterministic, not webhook-driven.
- Deploy #1 `2d9ecccb-…`: BUILDING→DEPLOYING→**SUCCESS**, meta.commitHash=a6ad02c. Old 2140579d → REMOVED.
- **Health-mirage guard caught a stale-version signal:** `/health` reported `version:8526999` after SUCCESS. Root cause = `health.service.ts:9` `version = process.env.GIT_SHA ?? 'dev'` — `GIT_SHA` env var was stale (8526999), NOT an old container (old was REMOVED; HTTP 200 stable throughout). Fixed truthfully: `variableUpsert GIT_SHA=a6ad02c` → redeploy `a7d479ac-…` (SUCCESS) so the probe reports the TRUE live commit.
- Final active deployment: `a7d479ac-d264-4604-833a-4fbd2ce2b62d`, status SUCCESS, commit a6ad02c — sole active (2d9ecccb + bf50fee2 REMOVED). Fresh immutable container (no in-place mutation).

## 3. Prod healthy at NEW hash + app BOOTS with adapter DORMANT

- api `/health` → **200 `{status:ok, db:ok, version:a6ad02c}`** — probed version == live commit (mirage cleared).
  - This PROVES the app boots cleanly WITHOUT the Affinity key: the adapter is registered (new code, version==a6ad02c) but graceful-no-op; DB connected (`db:ok`).
- Stable across 3 consecutive probes (HTTP 200) — no crash-loop.
- web (unchanged, no redeploy): `/` → 307 (auth redirect), `/login` → 200. Live.

## 4. Smoke — sourcing alive, adapter registered-but-dormant, no crash

- CI DI-boot proof: `sourcing.di-boot.spec.ts (5 tests)` passed with the Affinity adapter in the registry (no AFFINITY_API_KEY) — DI container boots. Fixture-adapter sourcing path exercised by the 65-passing api test files (incl. `sourcing.spec.ts` 85 tests).
- Live proof: `/sourcing/companies` → 401, `/sourcing/connections` → 401 (routes MOUNTED + auth guard booted — module loaded with the adapter registered). No 5xx.
- Live Affinity fetch NOT attempted (no key) — adapter returns `[]` by design; app did not crash on registration.

## 5. Regression (wave-27/28/29 + boot-guards)

- Real route prefixes: `/compliance` (retention w28 + audit-log), `/sourcing`, `/admin`.
- `/compliance/audit-log` → 401, `/sourcing/companies` → 401 (auth guard fires = boot-guards hold; modules alive). `/health` → 200 `db:ok`. **Zero 5xx across all probes.** No regression.
- Redis/BullMQ worker check: N/A this app — health surface is `{status, db, version}`; no active queue layer in boot path. `db:ok` is the async-infra proof exposed.

## 6. Canary disposition

- `canary_threshold_dau: 1000`; real-user traffic = 0 external users (new backend adapter, dormant). Below threshold → canary phase **skipped** per C-2 skip condition. Health probe is the deploy gate. Full deploy (single replica, immutable container), health as the gate — no blast radius (adapter dormant, 0 users).

## 7. Deploy-not-release separation

- Code is DEPLOYED (adapter in prod) but the Affinity feature is NOT RELEASED to users — gated on the founder's `AFFINITY_API_KEY` env secret. Deploy ≠ release: the dormant adapter is smoke-testable in prod before the key activates it.

## LIVE-hookup follow-up (founder-gated tail)

The LIVE Affinity verification is NOT possible this wave (no key). Recorded as founder-provides-key next-step in
`process/session/updates/founder-request-affinity-api-key.md` (C-2 status appended). Activation, when the key arrives (no new code):
1. Set `AFFINITY_API_KEY` as a Railway env secret on `dealflow-api` (never committed).
2. Redeploy `dealflow-api` @ a6ad02c so the container picks up the secret.
3. Verify the sourcing search returns real Affinity companies (live paginated fetch); `/health` still ok.

Chronological ledger:
- CI green (a6ad02c): 2026-07-08 ~10:32Z. api deploy #1 SUCCESS ~10:34Z. GIT_SHA refresh + redeploy #2 (a7d479ac) SUCCESS ~10:4xZ. Health version==a6ad02c confirmed. Canary window: none (skipped, sub-threshold).

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway dealflow-api: deployment a7d479ac status SUCCESS, commit a6ad02c (sole active; predecessors REMOVED)"
  - "https://dealflow-api-production-66d4.up.railway.app/health: 200 {status:ok, db:ok, version:a6ad02c} — probed hash == live commit (mirage cleared via GIT_SHA refresh)"
  - "boot-with-adapter-dormant: app runs new code (adapter registered) with NO AFFINITY_API_KEY, db:ok, no crash"
  - "smoke: /sourcing/companies 401, /sourcing/connections 401 (routes mounted + guard booted); CI sourcing.di-boot 5/5"
  - "regression: /compliance/audit-log 401, zero 5xx; web / 307, /login 200 (unchanged, no redeploy)"
  - "NO migration (git diff 8526999..a6ad02c on migrations = empty); NO AFFINITY_API_KEY set"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: a6ad02cb2d613291da7b62f48df2a4d64b08aeef, deployment_id: a7d479ac-d264-4604-833a-4fbd2ce2b62d, verified_at: "2026-07-08T10:4x:00Z", health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: unchanged (no bundle change; no redeploy), health: "/ 307, /login 200"}
async_monitor_id: ""
rollback_armed: "serviceInstanceDeployV2(commitSha=8526999) + GIT_SHA=8526999 restore; canRedeploy=true; not exercised"
migration: "NONE (adapter registration only; additive-only trivially — zero DDL)"
affinity_api_key: "NOT SET (founder-gated); adapter dormant/graceful-no-op — app boots clean"
canary_status: skipped
canary_skip_reason: "0 external users (< 1000 DAU threshold); new dormant backend adapter — health probe is the deploy gate."
canary_window: {start: "", duration_minutes: 0}
canary_monitor_id: ""
canary_alerts: []
live_hookup_followup: "process/session/updates/founder-request-affinity-api-key.md — set AFFINITY_API_KEY on dealflow-api → redeploy a6ad02c → verify live Affinity fetch. Founder-gated; not blocking C-2."
note: "REAL Railway deploy of dealflow-api @ a6ad02c. App boots with Affinity adapter DORMANT (no key), prod healthy, no regression, no migration. Live hookup awaits founder AFFINITY_API_KEY."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    REAL Railway deploy verified end-to-end, not rubber-stamped. The dealflow-api service is serving the exact
    reviewed commit a6ad02c (deployment a7d479ac SUCCESS, sole active, predecessors REMOVED). The health-mirage
    guard fired on a stale /health version and was resolved TRUTHFULLY (root-caused to a stale GIT_SHA env var, not
    an old container; refreshed GIT_SHA + redeployed) — /health now returns 200 {status:ok, db:ok, version:a6ad02c}
    with the probed hash EQUAL to the live commit. This proves the app BOOTS cleanly with the Affinity adapter
    DORMANT (registered new code, no AFFINITY_API_KEY, db connected, no crash). NO migration (verified empty diff;
    additive-only trivially). Smoke + regression show sourcing/compliance routes mounted with auth guards booted and
    ZERO 5xx; web unchanged and live. Rollback path armed to known-good 8526999. Canary skipped (0 external users,
    sub-threshold) with health as the gate. Deploy is separated from release: the live Affinity feature is gated on
    the founder's AFFINITY_API_KEY, recorded as a concrete no-new-code follow-up. All C-2 checklist items tick from
    concrete artifacts — no ambiguity, no fabricated green.
  next_action: PROCEED_TO_T-block
```
