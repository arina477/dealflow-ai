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
