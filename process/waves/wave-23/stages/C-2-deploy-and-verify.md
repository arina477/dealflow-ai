# C-2 — Deploy & verify (wave-23 seller-intent)

## Summary

REAL app-code deploy of the wave-23 seller-intent vertical (deterministic scorer + workspace-
scoped `SellerIntentService` + repository + controller + module + `/seller-intent` API + `/insights`
UI + shared-Zod contracts). **NO migration this wave** — read-only scoring; app already runs as
non-superuser `dealflow_app`; DATABASE_URL unchanged. Both Railway services deployed to the exact
CI-green tip **`6c22919`** via `serviceInstanceDeployV2` (explicit `commitSha`), meta-verified, and
live-verified against the new containers.

Railway project `app-arina-5ywq3s` (`APP_RAILWAY_PROJECT_ID` `ce095f75-…`), single env `production`
(`0e84f0b6-…`). Token `APP_RAILWAY_TOKEN` (Project-Access-Token GraphQL; no Railway CLI).

## Action 0 — credential

`APP_RAILWAY_TOKEN` present + usable: deploy-scoped `project(id:)` probe returned `data.project`
with no `errors`. Services + env self-discovered via GraphQL (authoritative IDs, not the
task-shorthand suffixes — the domains confirm the mapping).

| Service | service_id | domain |
|---|---|---|
| dealflow-api | `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` | dealflow-api-production-66d4.up.railway.app |
| dealflow-web | `06b07f19-9146-4da0-b589-0d6d81ec1576` | dealflow-web-production-a4f7.up.railway.app |

## Action 1 — rollback anchors captured BEFORE deploy (armed)

Previous known-good live deployments (both @86ddc29, the prior C-block close), cached before any
mutation — plain deployment rollback path (code-only, NO migration → no schema downgrade risk):

| Service | rollback deployment_id | commit |
|---|---|---|
| dealflow-api | `0d8c8f10-f27e-43c6-bdf9-023cd6c7242c` | 86ddc29 (SUCCESS) |
| dealflow-web | `875e7f09-0c82-47af-8d40-bc4b55935bf4` | 86ddc29 (SUCCESS) |

Rollback = `serviceInstanceDeployV2` (or deployment rollback) to the anchor commit. No migration →
no forward-incompatible schema; a code-only rollback is seamless.

## Action 2 — deploy both services to the tip (GIT_SHA repinned)

Pre-deploy baseline (proves the deploy changed state — not a stale-domain mirage): both services'
`GIT_SHA` var == `86ddc29`; API `/health` version == `86ddc29`.

Repinned `GIT_SHA` → `6c22919` on both services (`variableUpsert: true`) BEFORE deploy (wave-18
stale-GIT_SHA lesson — `/health` version reads from GIT_SHA), then fired the deploy:

| Service | new deployment_id | status | meta.commitHash == tip |
|---|---|---|---|
| dealflow-api | `c37b7976-d890-4659-8114-33cffa300604` | SUCCESS | ✅ 6c22919 |
| dealflow-web | `8a63a649-7097-403d-a2d0-3f76bcacb62c` | SUCCESS | ✅ 6c22919 |

Both reached terminal SUCCESS in ~91s (inline poll; NOT SKIPPED, NOT FAILED/CRASHED). Prior
deployments now REMOVED — the new @6c22919 containers are the sole live version (no health-check
mirage / dual-live).

## Action 3 — live verification against the NEW containers

| Probe | Expected | Observed |
|---|---|---|
| API `/health` | 200 `{status:ok, db:ok, version==6c22919}` | **200** `{"status":"ok","db":"ok","version":"6c229197…"}` — version==tip (not stale 86ddc29) |
| API non-superuser | [RLS-GUARD] up (dealflow_app) | `db:ok` at deployed tip ⇒ boot-time RLS-GUARD passed (guard fails /health if superuser); Nest boot log: "Nest application successfully started" + "API listening on port 3001" |
| API `/seller-intent` anon | 401 (mounted, fail-closed; NOT 404/500) | **401** — new seller-intent API live + secured |
| API `/compliance/audit-log/verify` anon | 401 (not 500) | **401** — audit chain endpoint intact (read-only wave, chain undisturbed) |
| WEB `/insights` | 307/200 (NOT 404/500) | **307** — new /insights UI route live |
| WEB `/` | 307/200 | **307** |

**Live authed per-mandate seller-intent score DEFERRED** (no prod advisor fixtures) — honestly
noted per the wave-21 CI-authoritative policy. The authoritative cross-firm + determinism proof is
the CI `seller-intent-isolation.e2e-spec` (3 tests, SIT-1 real-service WS_A-includes/WS_B-absent
as dealflow_app) + `seller-intent.scorer.spec` (26 tests) — both RAN + GREEN in C-1's run
28858565829 (see C-1 deliverable). The anon-401 mount check confirms the endpoint is wired and
fail-closed in prod; the score logic itself is CI-verified.

## Action 5-7 — canary

Skipped: 0 DAU < `canary_threshold_dau` 1000 (`project.yaml`). T-block synthetic probes are the
post-deploy signal. Read-only wave, low blast radius.

## Rollback armed

Plain deployment rollback (code-only, no migration) to the anchors above is immediately triggerable
if a regression surfaces. No stateful downgrade risk (0 schema changes this wave).

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "dealflow-api: serviceInstanceDeployV2 @6c22919 -> deployment c37b7976-… status SUCCESS, meta.commitHash==6c229197… (match)"
  - "dealflow-web: serviceInstanceDeployV2 @6c22919 -> deployment 8a63a649-… status SUCCESS, meta.commitHash==6c229197… (match)"
  - "API /health 200 {status:ok,db:ok,version==6c229197…} — version==deployed tip, not stale 86ddc29; db:ok ⇒ RLS-GUARD passed (dealflow_app non-superuser)"
  - "API /seller-intent anon -> 401 (mounted, fail-closed; not 404/500) — new seller-intent API live"
  - "API /compliance/audit-log/verify anon -> 401 (not 500) — audit chain intact (read-only wave)"
  - "WEB /insights -> 307 (not 404/500) — new /insights UI route live; WEB / -> 307"
  - "prior deployments REMOVED — new @6c22919 sole live version (no health-check mirage)"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 6c229197f4dfb12352e766e1754502a9f76b51e9, deployment_id: c37b7976-d890-4659-8114-33cffa300604, verified_at: "2026-07-07T10:19:00Z", health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 6c229197f4dfb12352e766e1754502a9f76b51e9, deployment_id: 8a63a649-7097-403d-a2d0-3f76bcacb62c, verified_at: "2026-07-07T10:19:00Z", health_url: "https://dealflow-web-production-a4f7.up.railway.app/insights"}
rollback_anchors:
  - {service: dealflow-api, deployment_id: 0d8c8f10-f27e-43c6-bdf9-023cd6c7242c, commit: 86ddc29fa974e99128c436f5984910a152c77240}
  - {service: dealflow-web, deployment_id: 875e7f09-0c82-47af-8d40-bc4b55935bf4, commit: 86ddc29fa974e99128c436f5984910a152c77240}
migration_this_wave: false
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "0 DAU < canary_threshold_dau 1000; read-only wave, low blast radius. T-block synthetic probes are the post-deploy signal."
canary_window:
  start: null
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
note: "REAL app-code deploy (seller-intent vertical), NO migration. Both services deployed to CI-green tip 6c22919 (serviceInstanceDeployV2 explicit commitSha; GIT_SHA repinned to tip pre-deploy per wave-18 lesson), both terminal SUCCESS ~91s (not SKIPPED), meta.commitHash==tip on both. Live-verified against new containers: /health 200 version==tip db:ok (RLS-GUARD dealflow_app); /seller-intent anon 401 (mounted fail-closed); /insights 307; audit-log/verify anon 401 (chain intact). Rollback armed to @86ddc29 anchors (code-only, seamless — no schema downgrade). Canary skipped (0 DAU). Authed per-mandate score deferred (no prod advisor fixtures) — CI seller-intent-isolation e2e + scorer.spec are the authoritative determinism/cross-firm proof (wave-21 CI-authoritative policy). No fabricated green — deploy status, meta.commitHash, and /health version all queried live."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Both services deployed to the exact CI-green tip 6c22919 via serviceInstanceDeployV2 with an
    explicit commitSha; both reached terminal SUCCESS (not SKIPPED) with meta.commitHash verified
    equal to the tip on each — no stale/SKIPPED, no Ghost-deploy. Rollback anchors (both @86ddc29
    known-good) were captured BEFORE the deploy mutation and are immediately triggerable; because
    the wave applied NO migration (read-only scoring), a code-only rollback carries no schema-
    downgrade risk. The health probe targets the new deployment: API /health returns 200 with
    version==6c22919 (NOT the pre-deploy 86ddc29) and db:ok, so the boot-time RLS-GUARD passed and
    the runtime is the non-superuser dealflow_app; prior deployments are REMOVED, so there is no
    health-check mirage from old containers. The new /seller-intent API is mounted and fail-closed
    (anon 401, not 404/500), /insights is live (307), and the audit-log verify endpoint is intact
    (401 not 500). Canary skips correctly at 0 DAU below the 1000 threshold. Live authed per-mandate
    scoring is deferred for lack of prod advisor fixtures and honestly recorded — the authoritative
    determinism + cross-firm-isolation proof is the CI seller-intent-isolation e2e (SIT-1 real
    service) + scorer.spec, both green in C-1. No verdict was fabricated or extrapolated: deploy
    status, commitHash provenance, and the live /health version were each queried directly. C-block
    exits PASS.
  next_action: PROCEED_TO_T
```
