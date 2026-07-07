# C-2 — Deploy & verify (wave-18 M9 advisor-insights analytics)

**Block:** C (CI/CD) · **Stage:** C-2 · **Mode:** automatic · **Head:** head-ci-cd
**Deploy target:** Railway (GraphQL only; `Project-Access-Token` header; no Railway CLI)
**This wave: NO migration, NO role-switch** — analytics is code-only over the existing schema;
the app already runs as the non-superuser `dealflow_app` (wave-17). Straightforward deploy+verify.

## Green tip deployed
`5c86cf5412dc21939ca3d3158d0203a08ce4d51a` (C-1 CI-green tip; run 28832010151 all 5 jobs green,
analytics-isolation e2e ran + passed 7/7 as dealflow_app).

## Rollback anchors (captured BEFORE deploying — last known-good, wave-17 commit 591b3f8b)
| Service | Domain | Pre-deploy known-good deploy ID | Commit |
|---|---|---|---|
| dealflow-api | dealflow-api-production-66d4 | `f3b96634-b3bf-4364-9c0d-f035e37ba28c` | 591b3f8b |
| dealflow-web | dealflow-web-production-a4f7 | `cdc512b3-50a1-4885-bb10-bbcda04572ea` | 591b3f8b |

Rollback path armed: code-only + additive this wave → a plain `serviceInstanceDeployV2(commitSha=591b3f8b)`
(or redeploy of the anchor deploy) is a safe, self-contained revert. NO coupled DATABASE_URL / schema
revert needed (no role-split or migration this wave).

## Deploy (serviceInstanceDeployV2 — explicit commitSha; verified meta.commitHash, not a glance)
Both triggered pinned to `5c86cf5`; each deployment's `meta.commitHash` verified == the tip (stale-web-build guard):
- api initial deploy `7402f432` → meta.commitHash 5c86cf5 ✓ → SUCCESS (inline poll ~2min).
- web deploy `bb7bcbde` → meta.commitHash 5c86cf5 ✓ → SUCCESS.

**Stale-GIT_SHA fix (brief-anticipated).** `/health.version` derives from `process.env.GIT_SHA`. Both
services had a stale `GIT_SHA=591b3f8b` service var → live /health first reported the OLD version even
though the new code (commit 5c86cf5) was the active deployment (old deploy `f3b96634` was REMOVED, new
was routed). Fixed via `variableUpsert GIT_SHA=5c86cf5` (non-destructive single-var) on both services +
redeploy. (A transient duplicate-deploy race on the api — the upsert auto-triggered a deploy that raced
the explicit redeploy; Railway kept the later `0e8744e7` SUCCESS and REMOVED the duplicate. Final state
clean.)

## Current live deployments (verified on tip)
| Service | Active deploy ID | Status | Commit | URL |
|---|---|---|---|---|
| dealflow-api | `0e8744e7-2f53-40aa-9ee2-28c47d3e6d01` | SUCCESS | 5c86cf5 | dealflow-api-production-66d4.up.railway.app |
| dealflow-web | `1b134701-5e30-4619-a46a-128252b7c07f` | SUCCESS | 5c86cf5 | dealflow-web-production-a4f7.up.railway.app |

## Live verification (against the exact deployed hash — Health-Check-Mirage guard)
- **api /health** → `200 {status:ok, db:ok, version:5c86cf5}`. version==deployed tip (new container serving,
  not stale) after GIT_SHA fix; probed 3× consecutively, stable — no crash-loop. `db:ok` ⇒ app connects
  as `dealflow_app` ⇒ [RLS-GUARD] passing.
- **web /** → 307, **web /insights** → 307 (login redirect; the /insights page IS registered on the new build).
- **Analytics + RBAC boundary (live, unauth):** anon GET `/analytics` → **401** (SessionGuard fail-closed);
  route is MOUNTED (401 not 404 ⇒ registered on the new build). anon web `/insights` → **307** (login redirect).
- **Regression smoke:** `/mandates /outreach /pipeline /analytics` all → 401 (mounted + guarded, no 404/500)
  — the analytics addition did not regress existing routes or break DI boot.
- **Audit chain unaffected (analytics is read-only, writes nothing):** `/compliance/audit-log/verify` → 401
  (auth gate, NOT 500 ⇒ audit module intact; the analytics deploy did not break the HMAC-SHA256 chain).

## Authed analytics (4 families / F2 gate-outcomes / 200-403-401) — where the proof lives
A LIVE authed advisor/admin GET `/analytics` → 200 with the 4 metric families (mandate throughput;
outreach gate-outcomes = gatePassRate/blockedRate, NOT response-rate; advisor productivity; match
disposition) requires a provisioned PROD advisor/admin session. This is a pre-first-prod-test wave:
`command-center/testing/test-accounts.md` is the unpopulated template, and dev-seed creds MUST NOT be
used against prod auth (silent auth failures). So the live 200-with-4-families read is deferred to
**T-5 E2E / T-8 Security** (which provision prod fixtures). The AUTHORITATIVE proof of the 4 families +
RBAC 200/403/401 + F2 gate-outcomes + cross-firm exclusion is the **C-1 CI suite** that ran green:
- `analytics-isolation.e2e-spec.ts` ✓ 7/7 as `dealflow_app` under FORCE RLS (cross-firm exclude + AMP-4
  fault-killing; the authoritative cross-firm scoping proof — a 2-firm live test is impossible with one
  prod workspace).
- `analytics.spec.ts` ✓ 15/15 (RBAC 403/401, empty-state graceful n/a rates, F2 gate-math).

Live-isolation best-effort: with one real prod workspace a 2-firm live test isn't possible; the app being
up with `db:ok` confirms it reads as `dealflow_app` (RLS-scoped, not 0-bricked/cross-firm). CI e2e is the
authoritative cross-firm proof.

## Env-var binding (missing-env crash guard)
Pre-deploy confirmed api service has all required vars bound: DATABASE_URL, MIGRATE_DATABASE_URL,
CREDENTIALS_ENC_KEY, AUDIT_LOG_HMAC_KEY(+VERSION), SUPERTOKENS_*, WEB_ORIGIN, INTERNAL_API_BASE_URL,
NODE_ENV, PORT. No new env var introduced this wave → no missing-env boot crash risk. (GIT_SHA updated
for observability, not a boot dependency — fallback is 'dev'.)

## Canary
Skipped — 0 DAU (< 1000 `canary_threshold_dau`). T-block synthetic probes are the post-deploy signal.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway dealflow-api: active deploy 0e8744e7 SUCCESS, commit 5c86cf5 (meta.commitHash verified == tip)"
  - "railway dealflow-web: active deploy 1b134701 SUCCESS, commit 5c86cf5 (meta.commitHash verified == tip)"
  - "api /health 200 {status:ok,db:ok,version:5c86cf5} — version==deployed hash (new container), db:ok=[RLS-GUARD] dealflow_app; stable over 3 probes"
  - "anon /analytics 401 (mounted, SessionGuard) + web /insights 307; regression smoke mandates/outreach/pipeline 401 not 404/500"
  - "audit /compliance/audit-log/verify 401 (not 500) — audit HMAC chain intact; analytics read-only"
  - "4-families/RBAC-200/F2-gate-outcomes/cross-firm proven authoritatively by C-1 CI (analytics-isolation e2e 7/7 as dealflow_app + analytics.spec 15/15); live-authed 200 deferred to T-5/T-8 (no prod fixtures this wave)"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 5c86cf5412dc21939ca3d3158d0203a08ce4d51a, deploy_id: 0e8744e7-2f53-40aa-9ee2-28c47d3e6d01, verified_at: 2026-07-07T00:20Z, health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 5c86cf5412dc21939ca3d3158d0203a08ce4d51a, deploy_id: 1b134701-5e30-4619-a46a-128252b7c07f, verified_at: 2026-07-07T00:21Z, health_url: "https://dealflow-web-production-a4f7.up.railway.app/insights"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
canary_window: {start: "", duration_minutes: 0}
canary_monitor_id: ""
canary_alerts: []
rollback_anchors:
  - {service: dealflow-api, known_good_deploy_id: f3b96634-b3bf-4364-9c0d-f035e37ba28c, commit: 591b3f8b}
  - {service: dealflow-web, known_good_deploy_id: cdc512b3-50a1-4885-bb10-bbcda04572ea, commit: 591b3f8b}
  rollback_kind: "code-only additive — plain deployment rollback safe; no coupled DATABASE_URL/schema revert (no role/migration this wave)"
note: "Both services live @5c86cf5, verified by meta.commitHash + /health version==tip. Stale GIT_SHA (591b3f8b) on both services fixed via variableUpsert + redeploy (brief-anticipated). No migration/role-switch this wave. Canary skipped (0 DAU). Live authed /analytics 200-with-4-families deferred to T-5/T-8 (no prod fixtures); CI analytics-isolation e2e (7/7 dealflow_app) is the authoritative cross-firm + 4-family + F2-gate-outcome proof."

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Both services (dealflow-api, dealflow-web) deployed to the C-1 green tip 5c86cf5 via
    serviceInstanceDeployV2 with explicit commitSha; each deployment's meta.commitHash verified == the
    tip (no stale web build). Both SUCCESS. Health probed against the exact deployed hash: api /health
    200 {status:ok, db:ok, version==5c86cf5} stable over 3 probes (new container serving, not a mirage;
    db:ok = app is dealflow_app, [RLS-GUARD] passing). Stale GIT_SHA on both services corrected +
    redeployed so the health version reflects reality. RBAC boundary live-verified (anon /analytics 401
    mounted, web /insights 307); regression smoke clean (core routes 401, no 404/500); audit verify 401
    not 500 (read-only analytics did not touch the HMAC chain). No migration + no role-switch this wave,
    so the destructive-migration and schema-safety gates are trivially satisfied (additive/code-only).
    Rollback armed with both pre-deploy known-good deploy IDs; code-only so a plain deployment rollback
    is self-contained. Canary skipped per 0-DAU threshold with synthetic-probe reasoning. The live
    authed 200-with-4-families read is deferred to T-5/T-8 (no prod fixtures this pre-first-prod-test
    wave); the authoritative 4-family + RBAC + F2-gate-outcomes + cross-firm proof is the C-1 CI
    analytics-isolation e2e (7/7 as dealflow_app under FORCE RLS) + analytics.spec (15/15), both green.
  next_action: PROCEED_TO_T_BLOCK
```
