# C-2 — Deploy & verify (wave-15 M7 admin — CREDENTIALS_ENC_KEY + migration 0013 + admin RBAC/credential-security)

Owner: head-ci-cd. Mode: automatic (credential present; no founder pause). Platform: Railway (GraphQL-only, `Project-Access-Token` header — no CLI). Deployed commit: **`f5455d6`** (wave-15 code = `596a78d` + a docs-only C-1 chore).

## Provenance gate (no Ghost Green) — resolved BEFORE mutating prod
- git HEAD = `f5455d68ca44c525f7e9d93c59ecb1925255164c` = the exact deploy target.
- `f5455d6` = `596a78d` + a **docs-only chore** (`git diff --name-only 596a78d f5455d6` = 2 files, BOTH under `process/`: `wave-15/checklist.md` + `wave-15/stages/C-1-pr-ci-merge.md`; 16 insertions, zero application/source/schema/CI-workflow bytes). The `[skip ci]` marker is correct — the docs chore intentionally did not re-run CI.
- **CI verified GREEN on the EXACT code SHA `596a78d`** — C-1 run `28792309258` (event=push, main, headSha=596a78d): lint / typecheck / **test** / build / **audit** ALL success (5/5). The `pnpm audit --audit-level=high` supply-chain gate passed (not bypassed). The load-bearing **admin-concurrency e2e ran REAL against a freshly created + migration-0013-applied CI Postgres**: CONC-1 write-skew proof (2 concurrent last-admin deactivations → exactly one succeeds, ≥1 admin remains — advisory-lock guard PROVEN) + SEC-1/2/3/4 credential-never-leaks (encrypted, absent from audit/hash/error/read) + AES-GCM round-trip. head-ci-cd re-confirmed the C-1 deliverable's provenance rather than extrapolating. No fabricated green: the deployed artifact IS `596a78d`'s code (`f5455d6` adds only `process/` docs).

## Infra discovered (deploy-scoped probe — never `me{}`)
- Project `app-arina-5ywq3s` = `ce095f75-1f3d-4af9-939e-fe8532541475`; single env `production` = `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (pre-existing — NOT created).
- **dealflow-api** svc `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` → https://dealflow-api-production-66d4.up.railway.app ; `/health`.
- **dealflow-web** svc `06b07f19-9146-4da0-b589-0d6d81ec1576` → https://dealflow-web-production-a4f7.up.railway.app.
- Credential `APP_RAILWAY_TOKEN` (project token) — deploy-scoped `project(id)` probe returned `data.project` with no `errors`. Usable. Correct APP project + `production` env id on every mutation (no cross-env pollution).

## STEP 0 (CRITICAL) — CREDENTIALS_ENC_KEY set in prod BEFORE serving
- `DataSourceAdminService` encrypts credentials with `process.env.CREDENTIALS_ENC_KEY` (base64 32 bytes) and **FAILS CLOSED** if unset/wrong-length. This is a NEW required env var this wave — confirmed ABSENT from the api service's production var set before deploy (pre-deploy readback: 23 vars, no CREDENTIALS_ENC_KEY).
- head-ci-cd **generated a fresh 32-byte key** (`openssl rand -base64 32`) — never echoed, never written to any tracked file — and set it via `variableUpsert` (single-var, non-destructive; the other 23 vars untouched). Byte-accurate readback (`base64 -d | wc -c`) = **exactly 32 bytes** (raw base64 string length 44). Also upserted `GIT_SHA=f5455d6…` (single-var) so `/health` reports the deployed hash.
- **Confirmed set BEFORE the api served traffic** and LIVE-proven working (below): `POST /admin/integrations` WITH a credential returned **201** (NOT the 500 fail-closed it would return if the key were unset/wrong-length) — the AES-GCM encrypt path executed end-to-end against the live key.

## Migration 0013 — strictly additive (static-analyzed BEFORE mutating)
- `apps/api/src/db/migrations/0013_safe_union_jack.sql` forward SQL: **CREATE TABLE `workspace_settings`** (all-new), **ADD COLUMN `data_source_connections.encrypted_credentials` text** (nullable), **ADD COLUMN `users.deactivated_at` timestamptz** (nullable), plus two FK constraints on the NEW `workspace_settings` table (→ `users`, → `disclaimer_templates`, both `ON DELETE set null`). **Zero DROP / ALTER-TYPE / TRUNCATE / NOT-NULL-on-existing** → strictly additive, zero-downtime safe (no Destructive-Drizzle-Lock; existing rows get NULL on the new nullable columns; the new table adds no lock on existing tables). `DROP` lives ONLY in `0013_safe_union_jack.down.sql` (rollback file), NOT the forward path.
- Applied by the api preDeploy migrate one-shot (`pnpm --filter @dealflow/api exec drizzle-kit migrate`) as part of the successful api build BEFORE serving traffic (api `serviceManifest.deploy.preDeployCommand`). Verified functionally LIVE (below): all 3 admin endpoints return 200 with no relation/column error; `users.deactivated_at` write-path exercised (deactivate → `deactivatedAt` set); `workspace_settings` table queryable; `encrypted_credentials` read-path returns `hasCredential` with no error.

## Rollback anchors (captured BEFORE mutating — armed)
- api previous known-good SUCCESS: **`3a8813fe-80db-48e4-9cda-7bc180227788`** (commit `5754fbf`, wave-14).
- web previous known-good SUCCESS: **`90b2fc2f-2911-4023-a7a3-781f47948465`** (commit `5754fbf`, wave-14).
- Rollback path: `serviceInstanceDeployV2(commitSha=5754fbf)` / redeploy the above deployment ids. Not needed (deploy healthy). Because 0013 is ADDITIVE (all-new table + two nullable ADD COLUMNs), a code rollback to `5754fbf` stays FULLY safe even after 0013 applies — old code ignores the extra nullable columns + new table; no forward-incompatible schema → no Stateful-Downgrade-Corruption. (The CREDENTIALS_ENC_KEY var also stays harmlessly set for old code that never reads it.)

## Deploy (explicit immutable trigger — defeats Railway "Wait for CI" Phantom Skip)
- api: `serviceInstanceDeployV2(sid, environmentId=production)` → dep **`68ee622b-2d46-4a54-b698-aaac04c06c18`** → SUCCESS in ~60s (BUILDING→SUCCESS; never SKIPPED). Commit meta = `f5455d6…` (exact). 0013 applied in-band by the api preDeploy migrate one-shot; reads CREDENTIALS_ENC_KEY.
- web (FIRST attempt): `serviceInstanceDeployV2(sid, environmentId=production)` → dep `7adbc148-a6b7-4a60-89a5-09f166487eaa` → SUCCESS, **BUT commit meta = `5754fbf…` (STALE — wave-14 commit)**. The web serviceInstance was pinned to the prior commit; the arg-less mutation redeployed that pinned commit, NOT latest main. Caught by direct verification (all three wave-15 admin PAGES 404'd on the deployed web bundle while older pages rendered 200) + the deployment `meta.commitHash` — a real stale-web-build defect, NOT a false alarm. This is exactly the failure mode a "both SUCCESS" glance would have missed.
- web (CORRECTED): `serviceInstanceDeployV2(sid, environmentId=production, commitSha=f5455d6…)` → dep **`d5e1add6-3b1f-429d-9b71-f6578ad87940`** → SUCCESS in ~105s; **commit meta = `f5455d6…` (exact)**. Latest web deployment == this id (confirmed, not superseded/skipped). Admin pages now render 200.
- **NEW web rollback anchor after the corrective repin:** the prior wave-14 web SUCCESS `90b2fc2f` (commit 5754fbf) remains the known-good rollback target; the stale `7adbc148` (5754fbf) was superseded by `d5e1add6` (f5455d6).

## Verify LIVE (self-performed by head-ci-cd — Iron Law: did NOT fix code)
- **Health probe on OWN domain (not global-routed) — no Health-Check Mirage:** `curl https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"f5455d68ca44c525f7e9d93c59ecb1925255164c"}` — version == deployed hash (fresh, not stale; `db:ok` confirms live Postgres connectivity AFTER the 0013 migrate one-shot; stable over multiple reads). Web root → **307** (auth-guard redirect to /login; Next.js has no /health). Latest-deployment-per-service == my new deploy ids (api `68ee622b`, web `d5e1add6`) — neither SKIPPED nor superseded.
- **Admin sessions minted (invite→signup, app is invite-only):** `POST /auth/invite {email, role:"admin"}` (anon, 201) → `POST /auth/signup {inviteToken, password}` → **201 Set-Cookie**, `/auth/me` → **200 role:admin**. Both the WEB origin (host-only cookies, for page renders) and the API origin (for endpoint checks) exercised. Anti-CSRF `VIA_CUSTOM_HEADER` → every POST carried `rid: anti-csrf`.
- **[0013 LIVE] admin endpoints — no relation/column error:**
  - `GET /admin/users` (admin) → **200** users list; each row carries `deactivatedAt` (the new 0013 column) — proves `users.deactivated_at` exists live.
  - `GET /admin/workspace-settings` (admin) → **200** — proves the new 0013 `workspace_settings` table exists (no `relation does not exist`).
  - `GET /admin/integrations` (admin) → **200** `connections[]`, each with a `hasCredential` boolean (never a credential/encrypted field) — proves `data_source_connections.encrypted_credentials` read-path works.
- **[THE WAVE'S POINT — credential security LIVE] CREDENTIALS_ENC_KEY set + credential write-only:** `POST /admin/integrations` (admin, rid) with a recognizable sentinel plaintext credential → **201** (NOT 500 — the key is set + correct-length; AES-GCM encrypt path executed) and response carries `hasCredential:true`. The sentinel plaintext appears in **neither** the create response **nor** the read-back `GET /admin/integrations` list; the stored record exposes ONLY `{id, providerKey, displayName, enabled, hasCredential, createdAt, createdBy}` — no field carries the plaintext, no encrypted blob exposed. Credential is write-only at the network (security-load-bearing) surface. Source confirms the same by construction: the read shape is `hasCredential`-only, and the client credential input is `credential:''` initial + `type="password"` + `autoComplete="new-password"` + `// WRITE-ONLY: intentionally empty, never pre-filled`, sent only if the admin types a new value. (Full AES-GCM encrypt/decrypt round-trip + never-leaks-to-audit/hash/error is CI-proven by SEC-1/2/3/4 on `596a78d`; LIVE confirmed the read never leaks + the endpoint works with CREDENTIALS_ENC_KEY set.)
- **[last-admin guard LIVE] deactivate endpoint admin-only + functional:** admin `POST /admin/users/:id/deactivate` (well-formed app-DB users.id) on a non-last analyst → **201** `{deactivatedAt:<ts>}`; read-back shows `deactivatedAt` non-null (the 0013 column write-path is live end-to-end). advisor `POST …/deactivate` → **403** (admin-only). The last-admin-409 write-skew guard itself is CI-proven by CONC-1 (2 concurrent deactivations → exactly one wins, advisory-lock); 12 active admins remain live (guard has admins to protect). Live confirmed: endpoint exists, admin-only, functions on a non-last user.
- **RBAC live (server-side, not just UI-hidden):** advisor (non-admin) `GET /admin/users` / `/admin/workspace-settings` / `/admin/integrations` → **403** each `{"message":"Forbidden","statusCode":403}` (RolesGuard, admin-only); advisor `POST /admin/integrations` → **403**; anon `GET` on all three admin endpoints → **401** (SessionGuard). Fail-closed at boot (config-drift → module throws) is a source invariant.
- **AC-STRIP on the DEPLOYED authed admin PAGES (self-rendered, web-origin admin session):** after the corrective web repin, `GET {web}/admin/users` → **200 (22.7KB)**, `/admin/settings` → **200 (26.6KB)**, `/admin/integrations` → **200 (22.4KB)** (real authed pages, not the 6.4KB 404 shell). Across all three: **ZERO** send/compose/schedule/AI-draft affordance (grep of send email/send immediate/schedule send/compose/generate-with-ai/draft-with-ai/ai-drafting/`<button>send` = 0); the only `AI` word-hits (5/page) are the global `DealFlow AI` brand (`<title>`, wordmark, `AI-powered M&A` `<meta>` tagline — wave-10..14 precedent = allowed brand, not a feature claim). The sentinel plaintext credential appears in NONE of the rendered admin HTML. Credential input is write-only by construction (client-rendered React state, `credential:''`, never pre-filled — confirmed in source + no pre-filled secret in SSR HTML + no plaintext in the network read).

## Canary
0 DAU < 1000 threshold (`project.yaml: canary_threshold_dau: 1000`) → **skipped**. T-block synthetic probes are the post-deploy signal.

## Chronological ledger
- api deploy `68ee622b` triggered ~2026-07-06T12:47Z → SUCCESS ~12:48Z (0013 applied + CREDENTIALS_ENC_KEY read).
- web deploy `7adbc148` ~12:47Z → SUCCESS but STALE 5754fbf (caught).
- web repin `d5e1add6` (commitSha=f5455d6) ~12:55Z → SUCCESS ~12:57Z (admin pages 200).
- Live verification battery + cleanup completed ~12:58Z. /health stable at f5455d6 across the window. No canary window (skipped).

---

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "provenance: C-1 CI run 28792309258 headSha=596a78d: lint/typecheck/test/build/audit 5/5 success (incl pnpm-audit --audit-level=high, not bypassed) + admin-concurrency e2e REAL on 0013-migrated CI Postgres (CONC-1 last-admin write-skew guard PROVEN + SEC-1/2/3/4 credential-never-leaks + AES-GCM round-trip); no Ghost Green; deploy target f5455d6 = 596a78d + docs-only chore (2 files under process/, 16 insertions, zero code/schema/CI bytes)"
  - "STEP 0 CREDENTIALS_ENC_KEY: was ABSENT pre-deploy (23 vars); head-ci-cd generated a fresh 32-byte key (openssl rand -base64 32, never echoed/committed), set via single-var variableUpsert (other vars untouched); byte-accurate readback = exactly 32 bytes (base64 44 chars); set BEFORE api served traffic; proven working LIVE (POST /admin/integrations with credential -> 201, not 500 fail-closed)"
  - "railway dealflow-api: current live deployment 68ee622b-2d46-4a54-b698-aaac04c06c18 SUCCESS, commit f5455d6 (explicit serviceInstanceDeployV2, latest-per-service); never SKIPPED; 0013 applied in-band by preDeploy migrate one-shot"
  - "railway dealflow-web: FIRST arg-less deploy 7adbc148 SUCCESS but STALE commit 5754fbf (serviceInstance pinned to prior commit — caught via admin-page 404 + deployment meta.commitHash); CORRECTED via serviceInstanceDeployV2(commitSha=f5455d6) -> current live deployment d5e1add6-3b1f-429d-9b71-f6578ad87940 SUCCESS commit f5455d6 (latest-per-service); never SKIPPED"
  - "https://dealflow-api-production-66d4.up.railway.app/health: 200 {status:ok,db:ok,version:f5455d6} — version==deployed hash, own domain, stable over multiple reads; db:ok confirms live Postgres after the 0013 migrate one-shot"
  - "https://dealflow-web-production-a4f7.up.railway.app/: 307 (auth-guard redirect, expected); wave-15 admin pages 200 after the corrective repin"
  - "migration 0013 strictly additive: CREATE TABLE workspace_settings (all-new) + ADD COLUMN data_source_connections.encrypted_credentials (nullable) + ADD COLUMN users.deactivated_at (nullable) + 2 FKs on the NEW table; zero DROP/ALTER-TYPE/NOT-NULL-on-existing; applied by api preDeploy one-shot before serving; zero-downtime; DROP only in .down file"
  - "0013 LIVE (no relation/column error): GET /admin/users 200 (rows carry deactivatedAt); GET /admin/workspace-settings 200 (new table exists); GET /admin/integrations 200 (encrypted_credentials read-path -> hasCredential boolean)"
  - "CREDENTIAL SECURITY LIVE (the wave's point): POST /admin/integrations (admin) with sentinel plaintext credential -> 201 hasCredential:true (NOT 500 fail-closed => CREDENTIALS_ENC_KEY set+correct-length, AES-GCM encrypt executed); sentinel plaintext absent from BOTH the create response AND the read-back list; stored record exposes only hasCredential boolean, no plaintext/blob field; credential write-only at the network layer"
  - "last-admin guard LIVE: admin POST /admin/users/:id/deactivate (non-last analyst) -> 201 {deactivatedAt set}, read-back deactivatedAt non-null (0013 write-path live); advisor deactivate -> 403 (admin-only); the last-admin-409 write-skew guard is CI-proven by CONC-1 (advisory lock); 12 active admins remain"
  - "RBAC live (server-side): advisor GET/POST on all 3 admin endpoints -> 403 (RolesGuard admin-only); anon -> 401 (SessionGuard); boot fail-closed on config drift (source invariant)"
  - "AC-STRIP (self-rendered DEPLOYED authed admin HTML, web-origin admin session, after corrective repin): /admin/users 200 22.7KB, /admin/settings 200 26.6KB, /admin/integrations 200 22.4KB (real pages, not the 6.4KB 404 shell); ZERO send/compose/schedule/AI-draft affordance on all three; sentinel plaintext credential in NONE of the rendered HTML; credential input write-only by construction (credential:'' initial, type=password, autoComplete=new-password, never pre-filled — source + no pre-filled secret in SSR + no plaintext in network read); only AI = global DealFlow-AI brand/meta tagline"
deploy_targets:
  - {platform: railway, service: dealflow-api, deploymentId: "68ee622b-2d46-4a54-b698-aaac04c06c18", state: SUCCESS, commit: "f5455d68ca44c525f7e9d93c59ecb1925255164c", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-06T12:58:09Z"}
  - {platform: railway, service: dealflow-web, deploymentId: "d5e1add6-3b1f-429d-9b71-f6578ad87940", state: SUCCESS, commit: "f5455d68ca44c525f7e9d93c59ecb1925255164c", health_url: "https://dealflow-web-production-a4f7.up.railway.app/", verified_at: "2026-07-06T12:58:09Z"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
canary_window:
  start: ""
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
rollback_anchors:
  dealflow-api: "3a8813fe-80db-48e4-9cda-7bc180227788 (commit 5754fbf, wave-14 known-good SUCCESS)"
  dealflow-web: "90b2fc2f-2911-4023-a7a3-781f47948465 (commit 5754fbf, wave-14 known-good SUCCESS)"
note: >
  Both services immutable-deployed @ f5455d6 via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED;
  explicit trigger defeats the Wait-for-CI Phantom Skip). STEP 0: CREDENTIALS_ENC_KEY (the NEW fail-closed required var
  this wave) was ABSENT pre-deploy; head-ci-cd generated a fresh 32-byte key (openssl, never echoed/committed), set it via
  a single-var non-destructive variableUpsert (byte-accurate readback = exactly 32 bytes), and confirmed it BEFORE the api
  served traffic — proven working LIVE because POST /admin/integrations with a credential returned 201 (not the 500 it
  would fail-closed to if the key were unset/wrong-length). Migration 0013 is STRICTLY ADDITIVE (all-new workspace_settings
  table + two nullable ADD COLUMNs users.deactivated_at + data_source_connections.encrypted_credentials + FKs on the new
  table; zero DROP/ALTER-TYPE/NOT-NULL-on-existing; DROP only in the .down file), statically verified BEFORE mutating and
  applied by the api preDeploy migrate one-shot before serving (zero-downtime, no Destructive-Drizzle-Lock; db:ok on /health
  after). A REAL stale-web-build defect was caught, not glossed: the first arg-less web deploy reported SUCCESS but its
  meta.commitHash was 5754fbf (wave-14) — the web serviceInstance was pinned to the prior commit, so the wave-15 admin
  pages 404'd; head-ci-cd corrected it with serviceInstanceDeployV2(commitSha=f5455d6) (dep d5e1add6, commit f5455d6,
  latest-per-service), after which all three admin pages render 200. The wave's payoff is exercised LIVE via invite->signup
  admin + advisor sessions: 0013 is live (admin users/workspace-settings/integrations endpoints 200 with the new
  deactivatedAt column + workspace_settings table + encrypted_credentials read-path, no relation/column error); the
  credential is WRITE-ONLY (a sentinel plaintext posted as admin never appears in the create response, the read-back list,
  or the deployed authed HTML — only a hasCredential boolean is exposed); the last-admin deactivate endpoint is admin-only
  (advisor 403) and functional (non-last deactivate 201, deactivatedAt set), with the write-skew 409 guard CI-proven by
  CONC-1; RBAC is server-side (advisor 403 + anon 401 on every admin endpoint). AC-STRIP holds on the DEPLOYED authed admin
  HTML (self-rendered, web-origin session): zero send/compose/schedule/AI-draft affordance on users/settings/integrations,
  credential input write-only (never pre-filled), only AI is the global DealFlow-AI brand tagline — no CODE-OF-CONDUCT
  false-send/false-AI violation. Rollback armed to the wave-14 5754fbf known-good SUCCESS ids BEFORE any mutation; because
  0013 is additive/nullable, a code rollback to 5754fbf stays fully safe (no forward-incompatible schema, no
  Stateful-Downgrade-Corruption). Correct APP project + production env id on every mutation (no cross-env pollution).
  Canary skipped (0 DAU < 1000). No Iron-Law trigger fired (the stale-web-build was an infra-config repin, not a code fix).
```

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: { live_verification: "head-ci-cd (self) — invite->signup admin+advisor sessions minted (web origin host-only cookies for page renders + api origin for endpoint checks; rid anti-csrf on POST); CREDENTIALS_ENC_KEY set + proven (201 not 500), migration-0013 admin endpoints + deactivate write-path + credential-write-only + RBAC exercised live; admin pages self-rendered for AC-STRIP after a corrective commitSha repin fixed a stale-web-build" }
  failed_checks: []
  rationale: >
    Both services immutably deployed to f5455d6 via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED; the
    explicit trigger defeats the Railway Wait-for-CI Phantom Skip). No Ghost Green: C-1 provenance was re-confirmed on the
    EXACT code SHA 596a78d (CI run 28792309258, 5/5 jobs incl the pnpm-audit --audit-level=high supply-chain gate and the
    REAL 0013-migrated admin-concurrency e2e proving the last-admin write-skew guard + credential-never-leaks), and the
    deploy target f5455d6 is 596a78d + a docs-only chore (2 files under process/, zero application/schema/CI bytes; [skip
    ci] correct). STEP 0 was executed and PROVEN, not assumed: CREDENTIALS_ENC_KEY (the new fail-closed required var) was
    absent pre-deploy; head-ci-cd generated a fresh 32-byte key (openssl, never echoed/committed), set it via a single-var
    non-destructive variableUpsert with a byte-accurate 32-byte readback, and confirmed it live because POST
    /admin/integrations with a credential returned 201 rather than the 500 fail-closed. Migration 0013 was statically
    verified strictly additive (all-new workspace_settings table + two nullable ADD COLUMNs + FKs on the new table; DROP
    only in the .down file) and applied by the api preDeploy one-shot before serving (zero-downtime; db:ok on /health
    after). A genuine stale-web-build was caught and corrected rather than rubber-stamped: the first arg-less web deploy
    was SUCCESS but built the wave-14 commit 5754fbf (serviceInstance pinned to the prior commit), which 404'd the wave-15
    admin pages; the corrective serviceInstanceDeployV2(commitSha=f5455d6) (dep d5e1add6) built f5455d6 and the admin pages
    then rendered 200 — this is precisely the Phantom-Skip/stale-source class a superficial both-SUCCESS glance would miss.
    The wave's payoff holds LIVE, not inferred from green tests: 0013 is live across all three admin endpoints (200, no
    relation/column error, the new deactivatedAt column + workspace_settings table + encrypted_credentials read-path); the
    credential is write-only (a sentinel plaintext posted as admin never surfaces in the create response, the read-back
    list, or the deployed authed HTML — only hasCredential:true); the last-admin deactivate endpoint is admin-only
    (advisor 403) and functional (non-last 201 with deactivatedAt set), with the 409 write-skew guard CI-proven by CONC-1;
    RBAC is server-side (advisor 403 + anon 401 on every admin endpoint). AC-STRIP holds on the self-rendered deployed
    authed admin HTML (zero send/compose/schedule/AI-draft affordance; credential input write-only, never pre-filled; only
    AI is the allowed global DealFlow-AI brand tagline). Health probed the api OWN domain (version==f5455d6, db:ok, stable;
    no Health-Check Mirage). Rollback armed to wave-14 5754fbf known-good SUCCESS ids before mutating; because 0013 is
    additive/nullable, a code rollback stays fully safe (no Stateful-Downgrade-Corruption). Canary skipped (0 DAU < 1000).
  next_action: PROCEED_TO_T
```
