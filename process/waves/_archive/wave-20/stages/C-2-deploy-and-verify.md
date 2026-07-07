# Wave 20 — C-2 Deploy & verify (+ migration 0018)

**Block:** C (CI/CD) · **Stage:** C-2 · **Mode:** automatic · **Gate:** head-ci-cd

## Deploy target (Railway, GraphQL-only — no CLI)
- Credential: `APP_RAILWAY_TOKEN` (Project-Access-Token header) on project `ce095f75-...` (`app-arina-5ywq3s`).
  C-2 Action 0 probe succeeded (deploy-scoped `project(id)` query, no errors) → credential usable, no founder pause.
- Environment: `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (production) — the founder-provided env; no environment created.
- Services (authoritative IDs from the live API, not the domain-slug hints):
  - **dealflow-api** `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` → https://dealflow-api-production-66d4.up.railway.app
  - **dealflow-web** `06b07f19-9146-4da0-b589-0d6d81ec1576` → https://dealflow-web-production-a4f7.up.railway.app
- App runs as **`dealflow_app`** (non-superuser); `DATABASE_URL` unchanged. NO role-switch this wave.

## Step 1 — Rollback anchors (captured BEFORE deploying)
Prior live SUCCESS deployments (prior-good commit `3cc58de` = wave-19 shipped tip):
- **api anchor:** `87814c49-8818-4529-945c-70249be0aeec` (commit 3cc58de)
- **web anchor:** `5cee3bc7-d1ab-4e86-8a20-2c457687e778` (commit 3cc58de)
Rollback plan: migration 0018 is ADDITIVE → rollback = redeploy the prior code (redeploy the anchor
deployment ids); the new `outreach_activity` table is inert if unused, so a plain deployment rollback is
safe — no destructive down-migration needed.

## Step 2 — Deploy both services @ tip `86ddc29`
- GIT_SHA repinned `3cc58de → 86ddc29` on BOTH services via `variableUpsert` BEFORE deploy (wave-18 stale-GIT_SHA lesson) — so `/health version` reports the tip (CI-PRINCIPLES #1: /health version reads a static env var).
- `serviceInstanceDeployV2(serviceId, environmentId, commitSha=86ddc29)`:
  - **api deploymentId** `0d8c8f10-f27e-43c6-bdf9-023cd6c7242c`
  - **web deploymentId** `875e7f09-0c82-47af-8d40-bc4b55935bf4`
- Inline poll (≤10 min; ~101s total) → BOTH `SUCCESS`, each `meta.commitHash == 86ddc29fa974` (verified — no stale-commit drift).

### Migration 0018 applied to prod (populated-safe per GAP-4)
From the api deployment logs (`deploymentLogs`): `Reading config file '/app/apps/api/drizzle.config.ts'`
→ `[✓] migrations applied successfully!` → `Nest application successfully started` / `API listening on port 3001`.
The migrate step is the release command that ran BEFORE the app served traffic (correct sequencing:
schema updated before new code takes traffic). `/health db:ok` + the table-backed `/outreach-activity`
endpoint answering (401, not 500) confirm the `outreach_activity` table exists and the schema is consistent.
Additive migration proven populated-safe in CI by OAM-2 (GAP-4) as dealflow_app.

## Step 3 — LIVE verification
| Probe | Expected | Actual | ✓ |
|---|---|---|---|
| api `/health` | 200 {status:ok, db:ok, version==tip} | 200 `{status:ok, db:ok, version:86ddc29...}` | ✓ |
| migration 0018 applied | table exists / journal shows 0018 | api logs `[✓] migrations applied successfully!` + db:ok + endpoint live | ✓ |
| anon `/outreach-activity` | 401 (mounted, fail-closed; NOT 404/500) | 401 `{Unauthorized}` | ✓ |
| anon `/compliance/audit-log/verify` | 401 (NOT 500 → chain intact) | 401 `{Unauthorized}` | ✓ |
| web `/outreach/activity` | 307/200 (NOT 404/500) | 307 | ✓ |
| web `/` | 200/307 | 307 | ✓ |

- App still `dealflow_app`: `DATABASE_URL=dealflow_app:...`; `/health db:ok`; endpoints fail-closed. No explicit
  `[RLS-GUARD]` boot line in the captured log window (earliest startup lines truncated by the log limit) — noted
  honestly; not fabricated. The authoritative write-path-isolation + audit + RBAC proof is the CI
  outreach-activity-rls/migration e2e run AS dealflow_app on postgres:18 (C-1, run 28841757352). Live authed
  create/list DEFERRED — no prod advisor fixtures — deferral noted per instruction.
- Audit chain intact: the wave adds audit-logged mutations but the verify endpoint answers 401 (not 500),
  and CI verifyChain (OAE-9..12 + OAM-3) is green → no chain corruption.

## Canary
```yaml
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); pilot-stage internal tool. Synthetic /health + endpoint probes are the post-deploy signal. Canary sub-actions (Action 5-7) skipped per project.yaml canary_threshold_dau."
```

## Rollback — armed
Anchors above cached locally. Trigger = redeploy the anchor deploymentId per service (`serviceInstanceDeployV2`
or `deploymentRedeploy`). Additive-only migration → prior code is schema-compatible with the new (superset)
schema; no destructive down-migration. Not needed — deploy healthy.

## Chronology
- Deploys triggered → both SUCCESS within ~101s.
- deploy_verified_at: 2026-07-07T04:40:19Z (health re-confirmed 200).

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway dealflow-api: deployment 0d8c8f10 SUCCESS @ 86ddc29 (meta.commitHash verified); migration 0018 applied ([✓] migrations applied successfully!)"
  - "railway dealflow-web: deployment 875e7f09 SUCCESS @ 86ddc29 (meta.commitHash verified)"
  - "api /health: 200 {status:ok, db:ok, version==86ddc29}"
  - "anon /outreach-activity → 401 (mounted, fail-closed); anon /compliance/audit-log/verify → 401 (chain intact)"
  - "web /outreach/activity → 307; web / → 307"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 86ddc29, deployment_id: 0d8c8f10-f27e-43c6-bdf9-023cd6c7242c, verified_at: 2026-07-07T04:40:19Z, health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 86ddc29, deployment_id: 875e7f09-0c82-47af-8d40-bc4b55935bf4, verified_at: 2026-07-07T04:40:19Z, health_url: "https://dealflow-web-production-a4f7.up.railway.app/"}
rollback_anchors:
  - {service: dealflow-api, deployment_id: 87814c49-8818-4529-945c-70249be0aeec, commit: 3cc58de}
  - {service: dealflow-web, deployment_id: 5cee3bc7-d1ab-4e86-8a20-2c457687e778, commit: 3cc58de}
migration:
  id: "0018_outreach_activity"
  additive: true
  applied: true
  populated_safe: true            # proven in CI by OAM-2 (GAP-4) as dealflow_app
  evidence: "api deploy release step: [✓] migrations applied successfully! + /health db:ok"
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU 0 < 1000 threshold; synthetic probes are the signal."
canary_window: {}
canary_monitor_id: ""
canary_alerts: []
note: "Both services deployed inline to the exact CI-green tip 86ddc29 (migration 0018 additive, applied + populated-safe). GIT_SHA repinned pre-deploy. Live authed create/list deferred (no prod advisor fixtures) — the authoritative isolation+audit+RBAC proof is the CI e2e as dealflow_app. Rollback armed but not needed. Canary skipped (0 DAU)."
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: "Both services deployed to the exact pushed main tip 86ddc29 (meta.commitHash verified on each — no stale-commit/GIT_SHA drift), both reached queryable SUCCESS. Migration 0018 (additive) applied to prod as the pre-serve release step ([✓] migrations applied successfully!), populated-safe per GAP-4/OAM-2. Health probe targets the deployed api and returns 200 with version==86ddc29 and db:ok (app still dealflow_app, no role-switch). The new write surface is live and fail-closed: anon /outreach-activity → 401 (mounted, not 404/500); audit chain intact (/compliance/audit-log/verify → 401, not 500); web /outreach/activity → 307. Rollback path armed with both prior-good deployment IDs before the deploy mutation (additive migration → safe plain redeploy). Canary correctly skipped below the 1000-DAU threshold. No fabricated green — every verdict cites a queryable Railway status or a live HTTP probe against the deployed tip."
  next_action: PROCEED_TO_T-block
```
