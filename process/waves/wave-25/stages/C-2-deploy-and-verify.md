# C-2 — Deploy & verify (wave-25 M10 auth-hardening — REAL migration-bearing deploy)

**Block:** C (CI/CD) · **Stage:** C-2 · **Mode:** automatic · **Gate agent:** head-ci-cd
**Wave:** 25 — M10 auth-hardening (rate-limit middleware + migration `0019_rate_limit_hits` + trust-proxy + auth-path validation)
**Deployed commit (CI-green):** `987ebb42e48df759ca7b6b1872b48c54be5dd7fe` (run `28876707093`, 5/5 jobs green — see C-1 RESUME)

**Prod api:** https://dealflow-api-production-66d4.up.railway.app · **web:** https://dealflow-web-production-a4f7.up.railway.app
**Railway project:** `app-arina-5ywq3s` (`ce095f75-1f3d-4af9-939e-fe8532541475`) · **env:** `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`
**api service:** `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` · **web service:** `06b07f19-9146-4da0-b589-0d6d81ec1576`

This is a **REAL deploy** — the app bundle changed (rate-limit middleware, trust-proxy, auth validation) AND
a schema migration ships (0019). Not a no-op.

## Action 0 — Deploy credential (corrects prior "absent" note)
`APP_RAILWAY_TOKEN` + `APP_RAILWAY_PROJECT_ID` are **present** in env (the prior C-1 escalation note that the
Railway token was absent is superseded — the app-scoped token is present). Deploy-scoped GraphQL probe
`project(id){ services }` → `errors: null`, project + 5 services resolved. Credential **usable**. No founder pause.

## Action 1 — Migration mechanism (zero-downtime, verified before deploy)
The api serviceInstance carries a **`preDeployCommand`**:
`DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm --filter @dealflow/api exec drizzle-kit migrate`.
Railway runs this as a **one-shot BEFORE routing traffic** to the new image; a migration failure aborts the
deploy and the old deployment keeps serving. Migration `0019` is **additive-only** (CREATE TABLE + GRANT +
INDEX — no lock on existing tables) → zero-downtime safe. Migration role (`MIGRATE_DATABASE_URL`) is separate
from the app runtime role (`DATABASE_URL`) — least-privilege separation.

## Action 2 — Rollback path ARMED before mutation
Captured the pre-deploy live api deployment **before** any mutation:
- **Rollback anchor:** deployment `c37b7976-d890-4659-8114-33cffa300604`, `status: SUCCESS`, commit
  **`6c229197f4dfb12352e766e1754502a9f76b51e9`** (== `6c22919`, the founder-stated pre-deploy hash), createdAt `2026-07-07T10:17:08Z`.
- Rollback procedure if regression: `serviceInstanceDeployV2(serviceId=api, environmentId, commitSha=6c229197…)` (or redeploy 5d05a0b1 @987ebb4), and re-set `GIT_SHA` accordingly. Migration 0019 is additive/forward-compatible, so a code rollback does NOT require a schema downgrade (expand-and-contract — old code ignores the new table).
- Baseline pre-deploy health captured: api `/health` 200 `{status:ok, db:ok, version:6c229197…}`, web `/` 307.

## Action 3 — Deploy (Railway GraphQL, Project-Access-Token header, pinned commit)
- `serviceInstanceDeployV2(serviceId=dcdb4ab4…, environmentId=0e84f0b6…, commitSha=987ebb4)` →
  **deploymentId `5d05a0b1-f356-48f5-950d-7b902dc3f6df`** (immutable freshly-built container; commit pinned to the exact CI-green SHA, not "latest").
- **MONITOR** (success=`SUCCESS`; failure IN `FAILED,CRASHED,REMOVED,SKIPPED`; timeout_budget=900s; poll=20-45s):
  BUILDING → DEPLOYING → **`SUCCESS`**, `meta.commitHash=987ebb4`. `errors: null`. Not `SKIPPED` (no phantom-skip).

## Action 4 — Migration 0019 applied to prod (verified)
- Deployment logs: `applying migrations... [✓] migrations applied successfully!` + `Nest application successfully started` + `API listening on port 3001`. The preDeployCommand ran and succeeded (a failure would have aborted the deploy).
- **Functional proof** (see Action 6): a 429 on the **fail-OPEN** `/auth/reset/request` path can only be produced by a working DB-backed limiter — i.e. the `rate_limit_hits` table exists in prod ⇒ 0019 applied. (fail-open would *allow* on a DB/table error, so a 429 is unambiguous.)

## Action 4b — Health-version reconciliation (Health-Check-Mirage guard)
After deploy 5d05a0b1 SUCCESS, `/health` still reported `version:6c22919` for >4 min. Investigated rather
than accept a stale-domain 200:
- Railway control plane: new deployment `5d05a0b1 @987ebb4` is the sole `SUCCESS`; old `c37b7976 @6c22919` is `REMOVED` (torn down) → `/health` 200 is served by the NEW container.
- `/health` version = `process.env.GIT_SHA ?? 'dev'` (health.service.ts). `GIT_SHA` is a **service variable** last set to `6c22919` (wave-23 deploy); the direct GraphQL redeploy did not refresh it. The version field was **cosmetic-stale, not stale code** — Railway deployment meta authoritatively records the running build as `987ebb4`, and the rate-limiter (which only exists in the wave-25 tree) is live.
- Fix: `variableUpsert GIT_SHA=987ebb4 (skipDeploys)` then pinned redeploy `serviceInstanceDeployV2(commitSha=987ebb4)` → **deploymentId `88eb7a2c-2bd5-4257-8aa0-42527c2b6e7a`** → watched to **`SUCCESS`**. `/health` now reports the true deployed hash.

## Action 5 — Prod health against the NEW hash
- **api** `GET /health` → **HTTP 200** `{"status":"ok","db":"ok","version":"987ebb42e48df759ca7b6b1872b48c54be5dd7fe"}` — `db:ok` (schema consistent, 0019 applied), `version==987ebb4` equals the deployment's own recorded commit (the probed hash matches the live deployment — not a stale-domain false-200).
- **web** `GET /` → **HTTP 307** (auth redirect — healthy; web unchanged this backend-only wave).

## Action 6 — Rate-limit smoke (the security proof in prod)
Hit `/auth/reset/request` (short limit **5 / 60 s**) with a **fake email** (`nonexistent+…@example.invalid`) —
the limiter buckets **pre-lookup** and is keyed by email (SEC-4), so no real/pilot account is touched.
Run 1 (deploy 5d05a0b1): req 1-5 → HTTP 202, **req 6 → HTTP 429 + `Retry-After: 37`**, req 7 → 429; body `{"statusCode":429,"message":"Too many requests. Please try again later.","retryAfter":37}`.
Run 2 (final deploy 88eb7a2c, fresh email/bucket): req 1-5 → 202, **req 6 → 429 + Retry-After**.
→ Boundary enforced **exactly** at the 6th request; `Retry-After` present + correct. Because `reset/request` is
fail-OPEN, the 429 proves the DB limiter + `rate_limit_hits` table are live in prod. **Security proof achieved.**

## Action 7 — Redis / BullMQ
**N/A for this project** — no Redis service exists (`postgres`, `supertokens-core`, `supertokens-db`,
`dealflow-api`, `dealflow-web`). The rate limiter is Postgres-backed (`rate_limit_hits`), not Redis. `db:ok` on `/health` covers the datastore dependency.

## Action 8 — Canary disposition
- `canary_threshold_dau: 1000`; actual external users = **0** (invite-only, MVP pre-launch). No user base to split into a fractional canary.
- Disposition: **careful full deploy**, with the **prod health + rate-limit 429 smoke as the release gate**
  (deploy-vs-release separation: the code was verified live-in-prod via the fail-open 429 probe before declaring done). Blast radius = 0 external users; both a health probe and a functional security probe passed against the new hash. No rollback needed.

## Action 9 — Dashboard-drift / Wait-for-CI phantom-skip checks
- Deploy triggered explicitly via GraphQL `serviceInstanceDeployV2` (not relying on Railway's git-webhook "Wait for CI"), so no phantom-skip: the `SUCCESS` status on the exact `deploymentId` we hold is authoritative.
- serviceInstance config read live (startCommand / preDeployCommand / healthcheckPath) — matches declarative intent; no manual dashboard override detected. Deployment `SKIPPED` state explicitly checked-for in the monitor and not observed.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
deploy_action: real-deploy                # app bundle changed + migration 0019 shipped
verdict_source: railway graphql + curl
deployed_commit: 987ebb42e48df759ca7b6b1872b48c54be5dd7fe
deployment_ids: [5d05a0b1-f356-48f5-950d-7b902dc3f6df, 88eb7a2c-2bd5-4257-8aa0-42527c2b6e7a]  # 2nd refreshes GIT_SHA
migration_applied: true                   # preDeployCommand drizzle-kit migrate → "migrations applied successfully!"; functionally proven by fail-open 429
verdict_evidence:
  - "railway serviceInstanceDeployV2(api, commitSha=987ebb4) → deploymentId 5d05a0b1; MONITOR → status=SUCCESS, meta.commitHash=987ebb4, errors=null"
  - "deploy logs: 'migrations applied successfully!' + 'Nest application successfully started' + 'API listening on port 3001'"
  - "GIT_SHA refresh (variableUpsert skipDeploys) + pinned redeploy → deploymentId 88eb7a2c → status=SUCCESS"
  - "curl /health → 200 {status:ok, db:ok, version:987ebb42e48df759ca7b6b1872b48c54be5dd7fe} (version==live deployment commit — not stale-domain)"
  - "curl web / → 307 (auth redirect, healthy; backend-only wave)"
  - "rate-limit smoke /auth/reset/request (fail-open, 5/60s): req1-5=202, req6=429 Retry-After:37 body retryAfter:37; repeated on final deploy — proves rate_limit_hits table + middleware live in prod"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 987ebb42e48df759ca7b6b1872b48c54be5dd7fe, deployment_id: 88eb7a2c-2bd5-4257-8aa0-42527c2b6e7a, verified_at: "2026-07-07T15:25Z", redeployed: true, health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: unchanged, verified_at: "2026-07-07T15:25Z", redeployed: false, health_url: "https://dealflow-web-production-a4f7.up.railway.app/"}
async_monitor_id: ""
canary_status: full-deploy-gated          # 0 external users + invite-only → no fractional split; health + 429 smoke as release gate
canary_skip_reason: "0 DAU (below canary_threshold_dau=1000), invite-only pre-launch — no user base to split; prod health + fail-open rate-limit 429 smoke against the new hash serve as the release gate."
canary_window: {open: "2026-07-07T15:14Z", gate: "health-200 + reset/request 429 boundary + db:ok", duration_min: ~11}
canary_monitor_id: ""
canary_alerts: []
rollback_anchor: {deployment_id: c37b7976-d890-4659-8114-33cffa300604, commit: 6c229197f4dfb12352e766e1754502a9f76b51e9, captured_before_mutation: true, schema_safe: "0019 additive/forward-compatible — code rollback needs no schema downgrade"}
note: >
  Real migration-bearing auth-hardening deploy. Railway token present. Rollback armed (pre-deploy 6c22919)
  before mutating. Deployed pinned CI-green 987ebb4 via GraphQL serviceInstanceDeployV2; migration 0019 ran
  as the one-shot preDeployCommand BEFORE traffic routing ("migrations applied successfully!"). Health-check
  mirage investigated (stale GIT_SHA service var, not stale code) and reconciled with a GIT_SHA refresh +
  pinned redeploy; /health now returns version==987ebb4 db:ok. Security proof in prod: fail-open
  /auth/reset/request returns 429+Retry-After exactly at the 5/60s boundary ⇒ rate_limit_hits table +
  middleware live. Web 307 (backend-only wave). Canary = full deploy gated on health + 429 smoke (0 external
  users). Every claim is a live Railway GraphQL read or a live curl — no fabricated green.

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Real migration-bearing, auth-path deploy executed and verified against the exact deployed artifact. The
    Railway credential (APP_RAILWAY_TOKEN) is present and usable; a rollback anchor (pre-deploy 6c22919,
    deployment c37b7976) was captured before any mutation and is schema-safe because 0019 is additive/forward-
    compatible. The CI-green commit 987ebb4 was deployed pinned via serviceInstanceDeployV2 (immutable fresh
    container), and migration 0019 ran as a one-shot preDeployCommand strictly before traffic routing
    ("migrations applied successfully!"). A stale /health version was investigated (cosmetic GIT_SHA service
    var, not stale code — Railway meta records the running build as 987ebb4) and reconciled via a GIT_SHA
    refresh + pinned redeploy, so /health now reports version==987ebb4 with db:ok — the probed hash equals the
    live deployment's own commit, not a stale-domain false-200. The security proof is observed in prod: a
    fail-open /auth/reset/request returns 429 + Retry-After exactly at the 5/60s boundary, which is only
    possible if the rate_limit_hits table (0019) and the wave-25 middleware are live. Web is 307 (unchanged,
    backend-only). Canary is a health-and-429-gated full deploy given 0 external invite-only users. No claim
    is inferred from green tests or timing — every verdict traces to a live GraphQL read or curl.
  next_action: PROCEED_TO_T
```

## Exit criteria status
- Usable deploy credential in hand (APP_RAILWAY_TOKEN, deploy-scoped probe errors=null). ✔
- Rollback path armed + pre-deploy hash cached (6c22919 / c37b7976) BEFORE mutation. ✔
- Migration 0019 run as one-shot preDeployCommand before traffic; "migrations applied successfully!"; functionally proven by fail-open 429. ✔
- Deployment reached SUCCESS on the exact pinned commit (987ebb4); not SKIPPED; deploymentId retained. ✔
- Health endpoint 200 with version==NEW hash + db:ok (api); web 307. Health-mirage investigated + reconciled. ✔
- Rate-limit 429 + Retry-After smoke passed against the new hash (security proof). ✔
- Canary disposition recorded (full-deploy gated; 0 DAU). ✔
- Deliverable carries `ci_stage_verdict: PASS`. ✔
- Wave checklist C-2 row: **checked**.

## Next
→ DISPATCHER → next block is **T** (Test) — `read claudomat-brain/blocks/test/test.md`.
