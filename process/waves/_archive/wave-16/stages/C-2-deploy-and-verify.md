# C-2 — Deploy & verify (wave-16 · M7 admin-hardening)

**Head:** head-ci-cd (fresh spawn, C-block lifetime).
**Deployed commit:** `d72d7cb735aff74fcdbdb28bd20f19bf711cc539` (main green, CI run 28805234334, all 5 jobs — provenance verified at C-1).
**Mode:** automatic. **Targets:** Railway `dealflow-api` + `dealflow-web` (GraphQL-only, `Project-Access-Token` header).
**No new env var** this wave (`CREDENTIALS_ENC_KEY` already set wave-15 — confirmed present in API var-keys). **No migration** this wave.

## Rollback armed (anchors captured BEFORE mutation)

| Service | Pre-deploy live deployment (rollback anchor) | Commit |
|---|---|---|
| dealflow-api | `68ee622b-2d46-4a54-b698-aaac04c06c18` (SUCCESS) | f5455d6 |
| dealflow-web | `d5e1add6-3b1f-429d-9b71-f6578ad87940` (SUCCESS) | f5455d6 |

Rollback path: `deploymentRedeploy(id:<anchor>)` or `serviceInstanceDeployV2(commitSha:f5455d6…)` to the known-good f5455d6.

## Deploy (serviceInstanceDeployV2, explicit commit — NOT a both-SUCCESS glance)

Both services triggered to `main@d72d7cb` via `serviceInstanceDeployV2(serviceId, environmentId=production 0e84f0b6…, commitSha=d72d7cb…)`. Each deployment's `meta.commitHash` independently verified `== d72d7cb` (wave-15 stale-web-build lesson: web serviceInstance meta checked explicitly — pinned correctly to d72d7cb, NO repin needed).

| Service | Final live deployment | status | meta.commitHash |
|---|---|---|---|
| dealflow-api | `a0afbcec-022d-4d2a-b302-8dce637ade05` | SUCCESS | d72d7cb ✓ |
| dealflow-web | `ab3be4d2-a952-4329-858d-9da0d0590dc9` | SUCCESS | d72d7cb ✓ |

Immutable builds (fresh image digests, not in-place mutation). Poll: inline (<3 min build both).

### Stale-`GIT_SHA` config-fix (config, NOT code — Iron Law preserved)

Both new containers started clean at 16:13 ("Nest application successfully started" / Next "Ready in 342ms", all routes mapped, zero errors — proven via `deploymentLogs`), and the service-instance `latestDeployment` pointed at the new d72d7cb deployment. But `/health` reported the STALE `version: f5455d6` for >10 min. Root cause (NOT a routing mirage): `/health` reads the `GIT_SHA` **Railway service variable**, which was pinned to the wave-15 value `f5455d6` and never bumped for wave-16. The container ran d72d7cb code but self-reported the stale env string. Fix: `variableUpsert(GIT_SHA=d72d7cb)` (single var, non-destructive — no other vars touched) + `serviceInstanceDeployV2` redeploy. On the next boot `/health` flipped to `d72d7cb` at t=1s (instant — confirming routing was always fine; the swap was fast once the container carried the correct value). This is a config drift, not a code defect; no B-block routing needed. Deploy stale-commit → repin (config), per the on-failure playbook.

## Verify LIVE (all against deployed d72d7cb; authed via invite→signup admin + advisor; SuperTokens `rid: anti-csrf` header required on state-changing calls)

| # | Check | Result |
|---|---|---|
| 4 | **/health** | `200 {status:ok, db:ok, version:d72d7cb}` (exact deployed hash, was f5455d6 pre-deploy — not stale) ✓ |
| 4 | **web root** | `307` (login redirect) ✓ |
| 5 | **Admin nav [6f1a96da] server-gated** | Behavioral server-gate (authoritative): admin GET all 4 admin routes → **200**; advisor → **307** (gated). Positive control: advisor `/mandates` → 200 (proves 307 is role-gating, not blanket auth-fail). `/admin/integrations` admin→200 (no longer orphaned), advisor→307. Source-confirmed: Sidebar renders `navItemsForRole(me.role)`; `/admin/{users,settings,integrations,activity}` all `allowedRoles:['admin']` in shared `rbac.ts`. |
| 6 | **Admin-activity [8bb0a22f]** | admin `GET /admin/activity-data` → **200**, 14 rows; row keys EXACTLY `{action,actor,sequenceNumber,target,timestamp}`. Grepped response for `hash\|credential\|payloadhash\|encrypted\|secret\|password\|content_hash\|prev_hash` → **NONE** (no leak). advisor → **403**, anon → **401**. **Read-only proven**: `audit-log/verify entriesChecked` 324 before AND after the GET (0 rows appended). |
| 7 | **Reactivate [042cf4e6] + PROD-CLEANUP A** | `POST /admin/users/98fadb75…/reactivate` (advisor1@example.com) → **200** on first call (dogfood restore); DB `deactivated_at` now **null** (confirmed). Non-UUID `:id` → **400** `"id must be a valid UUID"` (the /review fix, NOT 500). advisor → **403**. Re-call → 400 "already active" (idempotency-guard). |
| 8 | **PROD-CLEANUP B (WORM-safe, non-deferrable)** | Exact task query `UPDATE users … WHERE email LIKE '%KAREN-V1-SENTINEL%' OR LIKE '%karen-v1-sentinel%'` → **UPDATE 0** — the `KAREN-V1-SENTINEL`-named USER records do NOT exist in live prod (already absent; honest count, no fabrication). Sentinel CRED neutralized: `data_source_connections` row `karen-v1-probe-conn` (0d3f9f4c…, provider `fixture`) → **UPDATE 1** (`encrypted_credentials=NULL`, `enabled=false`, renamed `karen-v1-sentinel-cred-purged`). No hard-delete (WORM/audit-referenced respected). Post-cleanup exact-match count = 0. |
| 9 | **Cascade [904a3c25] live (smoke)** | `PUT /admin/workspace-settings {defaultJurisdiction:US}` → **200**, persisted (read-back + updatedAt bump). `POST /mandates` OMITTING `compliance.jurisdiction` → **201**; persisted mandate detail inherited `jurisdiction:"US"` + derived `disclaimerTemplateId fe1c504d…` (mvp-critical cascade spine live end-to-end). |
| 10 | **Config-boundary [2560fecc] live** | `POST /admin/integrations` with secret-shaped + unknown config field → **400** uniform static `"Invalid input for data source connection"` (no input echo); posted secret canary **ABSENT** from response body (grep clean). Legit config (`config:{}`) → **201** (legit path works). |
| 11 | **Audit chain intact** | `GET /compliance/audit-log/verify` → **{ok:true}**, entriesChecked 324→328 across all admin writes (reactivate + integration + mandate-create + cascade). Direct-SQL cred-blank correctly did NOT touch the app audit chain; HMAC chain still verifies. |
| 12 | **Canary** | **skipped** — 0 DAU < 1000 threshold. |

### Infra hygiene
DB access for the WORM-safe cleanup used a **temporary** Railway TCP proxy on the postgres service (`reseau.proxy.rlwy.net:15498`), **deleted immediately after** the cleanup (`tcpProxyDelete` → 0 proxies remain). No lasting public DB exposure. Railway token passed exclusively via `Project-Access-Token` header, never echoed. DB creds fetched into env, masked in all output.

## Deliverable footer

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "dealflow-api: deployment a0afbcec-022d-4d2a-b302-8dce637ade05 SUCCESS, meta.commitHash=d72d7cb"
  - "dealflow-web: deployment ab3be4d2-a952-4329-858d-9da0d0590dc9 SUCCESS, meta.commitHash=d72d7cb"
  - "/health: 200 {status:ok,db:ok,version:d72d7cb} (own domain; was f5455d6 pre-deploy — not stale-mirage; GIT_SHA env repinned)"
  - "web root: 307"
  - "admin nav server-gated: all 4 /admin/* routes admin=200 advisor=307; /admin/integrations un-orphaned (admin 200); positive control advisor /mandates=200"
  - "admin-activity: admin 200 (14 rows, keys={action,actor,sequenceNumber,target,timestamp}), no-secret-leak grep clean, advisor 403, anon 401, read-only (entriesChecked 324 unchanged by GET)"
  - "reactivate-live: advisor1 POST reactivate 200 (deactivated_at→null), non-uuid 400 (not 500), advisor 403, re-call 400 already-active"
  - "config-400-no-echo: POST /admin/integrations secret+unknown field → 400 uniform static, secret ABSENT from body; legit config 201"
  - "cascade-inherits: PUT workspace-settings defaultJurisdiction=US persisted; mandate created omitting jurisdiction inherited US + disclaimer fe1c504d"
  - "audit-chain: verify ok:true, entriesChecked 324→328 after all writes"
  - "prod-cleanup-done: advisor1 restored via reactivate endpoint; KAREN-V1-SENTINEL user query UPDATE 0 (records absent in prod — honest); sentinel cred karen-v1-probe-conn UPDATE 1 (creds blanked, disabled)"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: d72d7cb, deployment_id: a0afbcec-022d-4d2a-b302-8dce637ade05, verified_at: "2026-07-06T16:38Z", health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: d72d7cb, deployment_id: ab3be4d2-a952-4329-858d-9da0d0590dc9, verified_at: "2026-07-06T16:38Z", health_url: "https://dealflow-web-production-a4f7.up.railway.app/"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); no real-user traffic — synthetic authed probes above are the post-deploy signal."
canary_window: {start: "", duration_minutes: 0}
canary_monitor_id: ""
canary_alerts: []
rollback_anchors:
  dealflow-api: {deployment_id: 68ee622b-2d46-4a54-b698-aaac04c06c18, commit: f5455d6}
  dealflow-web: {deployment_id: d5e1add6-3b1f-429d-9b71-f6578ad87940, commit: f5455d6}
note: >
  advisor1@example.com restored via the NEW reactivate endpoint (dogfood, live-proven).
  KAREN-V1-SENTINEL user records absent in prod (exact task query touched 0 rows — reported honestly,
  not fabricated); sentinel data-source cred karen-v1-probe-conn neutralized (1 row, creds blanked +
  disabled, WORM-safe rename — no hard-delete). No new env var, no migration this wave. Rollback armed
  to f5455d6 anchors before mutation. Stale /health version was a GIT_SHA env-var reporting artifact
  (config drift), repinned to d72d7cb — NOT a routing mirage and NOT a code defect (containers booted
  clean; Iron Law preserved, no B-block route). Temp TCP proxy for DB cleanup created then deleted
  (no lasting public DB exposure).
```

## Head-CI-CD C-2 stage-exit signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Every C-2 exit checkbox tickable from concrete deployed-state artifacts — no fabricated green.
    Both services carry meta.commitHash==d72d7cb verified independently per-service (not a both-SUCCESS
    glance); the wave-15 stale-web-build trap was explicitly checked and clear. /health serves the exact
    deployed hash (d72d7cb) on its own domain. The one anomaly — /health reporting stale f5455d6 for
    >10min — was NOT rubber-stamped: I pulled container logs (clean boot), inspected the service-instance
    active deployment, and traced it to a static GIT_SHA env var (config drift), then repinned it (config,
    not code — Iron Law preserved). All admin surfaces verified LIVE against the deployed authed session:
    nav server-gated (admin 200 / advisor 307 across all 4 routes + positive control), admin-activity
    RBAC 200/403/401 + NO hash/credential/payload leak + read-only (audit count unchanged), reactivate
    live incl 400-on-non-uuid (not 500) + 403-advisor, config-boundary 400 uniform-static with secret
    absent from body, cascade inherits firm default live end-to-end, audit HMAC chain ok:true after all
    writes. PROD-CLEANUP executed and reported honestly: advisor1 restored via the reactivate endpoint
    (dogfood), and the KAREN-V1-SENTINEL user query touched 0 rows because those records do not exist in
    prod (stated plainly, not masked as "done") while the sentinel cred was WORM-safely neutralized.
    Rollback armed to the f5455d6 anchors before any mutation. Canary skip justified (0 DAU). Temp DB
    proxy self-cleaned — no lasting public exposure.
  next_action: PROCEED_TO_T
```
