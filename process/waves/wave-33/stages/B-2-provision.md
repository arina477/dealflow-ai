# Wave 33 — B-2 Provision (self-host Twenty on Railway) — RECOVERY LOG
## Prior agent (deployment-engineer) died on its OWN 401 auth after creating+configuring+deploying all 5 services. Recovered in main loop.
## Service state after recovery assessment (project app-arina-5ywq3s, env production):
- twenty-redis (ced31849): deploy SUCCESS ✓ (volume /data)
- twenty-minio (831142e7): deploy SUCCESS ✓ (MINIO_ROOT_USER/PASSWORD, volume /data)
- twenty-db (f023141d): CRASHED → root cause from logs: initdb lost+found (mount point used directly). FIX: PGDATA=/var/lib/postgresql/data/pgdata subdirectory + redeploy. [applied]
- twenty-server (2bfa2925): FAILED (cascade — DB down; full env set: APP_SECRET/PG_DATABASE_URL/REDIS_URL/AWS_S3_*/SERVER_URL/IS_SIGN_UP_ENABLED/etc.)
- twenty-worker (eed14c7f): FAILED (cascade — DB down)
## Recovery sequence: (1) fix+redeploy twenty-db [PGDATA] → verify RUNNING + pgvector ext; (2) redeploy twenty-server → watch boot+migrations on public domain; (3) redeploy twenty-worker; (4) bootstrap API key; (5) seed; (6) wire dealflow-api; (7) live-verify. Secrets already set on services (never printed/committed).

## RECOVERY FINDINGS (main-loop diagnosis after subagent 401):
1. **twenty-db CRASHED** → initdb lost+found (mount-point-as-datadir). FIX: PGDATA=/var/lib/postgresql/data/pgdata → SUCCESS ✓.
2. **twenty-server FAILED (no logs)** → ROOT CAUSE: the wave-32 deploy-doc HALLUCINATED the image name (`twentyhq/twenty-server` / `twentyhq/twenty` — neither exists on Docker Hub). Twenty's REAL image (from the official docker-compose at github.com/twentyhq/twenty/packages/twenty-docker) = **`twentycrm/twenty`** (org twentycrm). FIX: set server+worker image → twentycrm/twenty:latest; worker startCommand → `yarn worker:prod`; health path = /healthz (not /health). Package files corrected to match.
3. Public domain created: twenty-server-production-aee3.up.railway.app; SERVER_URL+FRONT_BASE_URL reconciled.
4. Rapid successive redeploys/variableUpserts cancel each other (FAILED-no-logs) — trigger ONE deploy then wait.
## Corrected the committed wave-32 package (docker-compose.yml + twenty-selfhost.md): twentycrm/twenty image, /healthz, yarn worker:prod — so the durable deliverable is accurate.

## FINAL STATE — INFRA FULLY LIVE; API-key = one-time-manual (v2.19 boundary):
ALL 5 services deployed SUCCESS + healthy on Railway (project app-arina-5ywq3s):
- twenty-db (pgvector) ✓  twenty-redis ✓  twenty-minio ✓  twenty-worker ✓
- twenty-server ✓ LIVE at https://twenty-server-production-aee3.up.railway.app (/healthz=200, migrations complete, frontend serving, IS_SIGN_UP_ENABLED=true)
Issues fixed autonomously: PGDATA-subdir (initdb lost+found), image twentyhq→**twentycrm/twenty**, PG_DATABASE_URL password url-encoding (special-char port-parse bug), public https domain + SERVER_URL reconcile.
### API-key bootstrap BLOCKED (one-time-manual, per P-4 fallback): Twenty v2.19 has GraphQL introspection DISABLED in prod + no programmatic-signup surface reachable (core auth mutations not exposed at /graphql; no REST signup — only /oauth + /rest/apiKeys GET). Creating the FIRST admin is an inherent human/account action. → founder does a ONE-TIME signup at the live URL + generates an API key (Settings→APIs), pastes it; then seed+wire+verify are fully automated (no more code).
### Remaining automated steps (once key provided): seed sample companies (POST /rest/companies) → set TWENTY_BASE_URL(https://twenty-server-production-aee3.up.railway.app)+TWENTY_API_KEY on dealflow-api → redeploy → live-verify companies flow into /sourcing.

## STORAGE FIX (founder-reported signup crash, 2026-07-09):
Founder hit a real signup crash (only fires on a human signup): `TypeError: Cannot read properties of undefined (reading 'send') at S3Driver.writeFile ← uploadDefaultPackageFilesAndSetFileIds ← SignUpInNewWorkspace` — Twenty's S3/MinIO driver's client is undefined, crashes during workspace creation, rolls back signup ("Workspace not found").
FIX (per founder): switched STORAGE_TYPE=s3 → **local** on twenty-server + twenty-worker + added persistent Railway volumes at /app/.local-storage (server vol a4d12333, worker vol bc266a03) + STORAGE_LOCAL_PATH=/app/.local-storage. Redeployed both. Verifying signup ACTUALLY works via a headless-browser signup (Playwright) — not trusting a green deploy — then will attempt to generate the API key in-UI to complete fully.

## STORAGE PERMISSION FIX (2026-07-09, browser-verified debugging):
Verified via headless browser (playwright-core + cached chromium, since MCP chrome absent): signup email+password step works (no S3 crash after STORAGE_TYPE=local). BUT workspace creation then hit `EACCES: permission denied, mkdir '/app/.local-storage/...'` at LocalDriver.writeFile — the Railway volume mounts root-owned; Twenty runs non-root. FIX: RAILWAY_RUN_UID=0 (run container as root → can write the root-owned volume) on server+worker + redeploy. Verifying the full signup→workspace→API-key flow end-to-end via the browser (not trusting green deploys — per founder).
