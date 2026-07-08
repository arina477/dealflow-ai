# Twenty Self-Hosting Deployment Reference

**Last verified:** 2026-07-08
**Official docs:** https://docs.twenty.com/self-hosting (self-hosting guide)
**GitHub:** https://github.com/twentyhq/twenty (Docker Compose examples + server source)
**Installed version:** 0.32.0 (Twenty's own versioning; pinned per deployment)
**Architecture:** NestJS-based server; containerized microservices + managed database

---

## Overview

Twenty is an open-source CRM. The **self-hosted stack** consists of:

1. **twenty-server** (NestJS REST/GraphQL API) — the core backend service
2. **twenty-worker** (job processor) — async task runner (email, webhooks, cron)
3. **PostgreSQL 16** (with pgvector extension) — persistent data store + embeddings
4. **Redis** (in-memory cache) — session store, rate-limit counters, caching
5. **Object Storage (S3-compatible)** — file uploads (avatars, attachments, exports)

All five services are containerized via Docker. Networking is private (backend-only; admin UI not exposed public by default). The server is fronted by TLS termination (Railway or external reverse proxy).

---

## Service Topology & Docker Images

### Pinned Images

```yaml
services:
  twenty-server:
    image: twentycrm/twenty:0.32.0
    build_context: packages/twenty-server
    runtime: Node.js 18+ (NestJS)

  twenty-worker:
    image: twentycrm/twenty:0.32.0
    # Same image as server; runs a different entrypoint (job worker, not HTTP server)
    runtime: Node.js 18+ (NestJS)

  postgres:
    image: postgres:16-alpine
    extensions: pgvector (required for AI embeddings)

  redis:
    image: redis:7-alpine
    config: default (no persistence; in-memory only)

  # S3-compatible object storage (choose one per deployment)
  # Option A: Railway's built-in Postgres volume (not ideal for S3, defer)
  # Option B: Cloudflare R2 (S3-compatible, HTTP API)
  # Option C: MinIO (self-hosted S3 clone, containerized)
  # Option D: AWS S3 direct (external managed service)
```

**Recommendation for wave-32:** Use **Cloudflare R2** (S3-compatible, no self-hosted storage service needed) or **MinIO** container if full self-hosting is required. The adapter + provisioning scripts support both.

---

## Environment Variables (Required)

The `twenty-server` and `twenty-worker` services require the following env vars. All are set on the Railway service or in the docker-compose file (via env_file or inline).

### Core Configuration

| Var | Value | Example | Notes |
|---|---|---|---|
| `NODE_ENV` | `"production"` (live) or `"development"` (for CLI bootstrap only) | `production` | Required for both server + worker |
| `APP_SECRET` | 32+ byte random string (base64 or hex) | `$(openssl rand -base64 32)` | Signing key for JWTs; orchestrator-generated, **NEVER** hardcoded |
| `ENCRYPTION_KEY` | 32+ byte random string (same as APP_SECRET or different) | `$(openssl rand -base64 32)` | Encryption key for at-rest fields; orchestrator-generated |

### Database (PostgreSQL)

| Var | Value | Example | Notes |
|---|---|---|---|
| `PG_DATABASE_URL` | Full Postgres connection string (includes pgvector ext) | `postgres://twenty_user:PASS@postgres:5432/twenty_db?sslmode=disable` | Orchestrator-generated; points to internal Postgres container or managed instance. Schema includes pgvector UUIDs. |
| `DATABASE_HOST` | Hostname / IP | `postgres` (Docker internal) | Used by some legacy Twenty versions (check installed version) |
| `DATABASE_PORT` | Port number | `5432` | Default PostgreSQL port |
| `DATABASE_USER` | Username | `twenty_user` | Orchestrator-generated |
| `DATABASE_PASSWORD` | Password | (random, base64) | Orchestrator-generated, never committed |
| `DATABASE_NAME` | DB name | `twenty_db` | Orchestrator-generated or pre-provisioned |

### Redis Cache

| Var | Value | Example | Notes |
|---|---|---|---|
| `REDIS_URL` | Redis connection string | `redis://redis:6379` (Docker internal) or `redis://localhost:6379` (local dev) | Orchestrator-generated; internal Docker hostname |

### S3 Object Storage

| Var | Value | Example | Notes |
|---|---|---|---|
| `STORAGE_TYPE` | `"s3"` | `"s3"` | Required; activates S3 backend |
| `AWS_S3_REGION` | AWS region (or custom for MinIO) | `"us-east-1"` (Cloudflare R2 uses this alias) | Orchestrator-generated |
| `AWS_S3_BUCKET` | Bucket name | `"dealflow-twenty-uploads"` | Orchestrator-generated; pre-created in S3 |
| `AWS_ACCESS_KEY_ID` | Access key (orchestrator-generated for MinIO; account-issued for R2/AWS) | `(secret)` | Orchestrator-generated (MinIO) or founder-supplied (account provider) |
| `AWS_SECRET_ACCESS_KEY` | Secret key (orchestrator-generated for MinIO; account-issued for R2/AWS) | `(secret)` | Orchestrator-generated (MinIO) or founder-supplied (account provider) |
| `AWS_S3_ENDPOINT` | Custom endpoint (for MinIO or R2) | `https://minio:9000` (MinIO) or `https://{account-id}.r2.cloudflarestorage.com` (R2) | MinIO uses internal Docker hostname; R2 uses Cloudflare endpoint |

### Server URLs (for frontend + API gateway)

| Var | Value | Example | Notes |
|---|---|---|---|
| `SERVER_URL` | HTTPS URL of the Twenty server (external, TLS-terminated) | `https://crm.dealflow.local` or `https://crm-instance.railway.app` | Must be **HTTPS**. This is the base URL the frontend and API clients use. |
| `FRONT_BASE_URL` | HTTPS URL of the frontend (served by the same or different host) | `https://crm-front.dealflow.local` or `https://crm-front-instance.railway.app` | Must be **HTTPS**. If Twenty serves both, can be the same as `SERVER_URL` |

### Account Creation & Initial Bootstrap

| Var | Value | Example | Notes |
|---|---|---|---|
| `IS_SIGN_UP_ENABLED` | `"true"` or `"false"` | `"true"` (for bootstrap spike only) | **For bootstrap ONLY:** set to `"true"` to allow programmatic signup via GraphQL. After provisioning, set to `"false"` to disable open signup. |

### Optional: Custom Domain

| Var | Value | Example | Notes |
|---|---|---|---|
| `CORS_ORIGIN` | Comma-separated list of allowed origins | `"https://crm.example.com,https://crm-front.example.com"` | CORS headers. Default: `SERVER_URL` + `FRONT_BASE_URL` |

---

## Database Schema & pgvector Extension

Twenty requires PostgreSQL **16+** with the **pgvector** extension for AI embeddings.

### Initialization Steps

1. **Create the database (or use Postgres service to auto-create):**
   ```sql
   CREATE DATABASE twenty_db;
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Create a schema user (if not Postgres superuser):**
   ```sql
   CREATE USER twenty_user WITH PASSWORD 'orchestrator-generated-secret';
   GRANT ALL PRIVILEGES ON DATABASE twenty_db TO twenty_user;
   ```

3. **Run migrations:** Twenty's server image includes a migration entrypoint. On first start, it auto-runs migrations against `PG_DATABASE_URL`.

### Docker-Compose Postgres Service

```yaml
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: twenty_db
    POSTGRES_USER: twenty_user
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # Orchestrator env var
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./init-pgvector.sql:/docker-entrypoint-initdb.d/init-pgvector.sql
  healthcheck:
    test: ["CMD", "pg_isready", "-U", "twenty_user", "-d", "twenty_db"]
    interval: 5s
    timeout: 5s
    retries: 5
  networks:
    - twenty

volumes:
  postgres_data:
    driver: local

networks:
  twenty:
    driver: bridge
```

**init-pgvector.sql:**
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

---

## Redis Configuration

Twenty uses Redis for:
- Session storage (JWT tokens)
- Rate-limit counters
- Cache (optional, but recommended for performance)

### Docker-Compose Redis Service

```yaml
redis:
  image: redis:7-alpine
  command: redis-server --appendonly no
  healthcheck:
    test: ["CMD", "redis-cli", "PING"]
    interval: 5s
    timeout: 5s
    retries: 5
  networks:
    - twenty
```

**No persistent data:** Redis is ephemeral (sessions are re-established on restart).

---

## Object Storage (S3-Compatible)

### Option A: Cloudflare R2 (Recommended for wave-32)

Cloudflare R2 is S3-compatible, managed, and requires minimal setup:

1. **Create an R2 bucket** via Cloudflare dashboard (e.g., `dealflow-twenty-uploads`).
2. **Generate API credentials** (R2 API token) with read+write scope.
3. **Set env vars:**
   ```
   STORAGE_TYPE=s3
   AWS_S3_REGION=auto
   AWS_ACCESS_KEY_ID=<R2 token ID>
   AWS_SECRET_ACCESS_KEY=<R2 token secret>
   AWS_S3_BUCKET=dealflow-twenty-uploads
   AWS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   ```

### Option B: MinIO (Self-Hosted S3 Clone)

If full self-hosting is required, MinIO provides S3-compatible object storage in a container:

```yaml
minio:
  image: minio/minio:latest
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}  # Orchestrator env var (strong!)
  ports:
    - "9000:9000"   # S3 API
    - "9001:9001"   # Web console (not exposed public)
  command: minio server /data
  volumes:
    - minio_data:/data
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - twenty

volumes:
  minio_data:
```

**Set env vars for MinIO:**
```
STORAGE_TYPE=s3
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=${MINIO_PASSWORD}
AWS_S3_BUCKET=dealflow-twenty-uploads
AWS_S3_ENDPOINT=http://minio:9000  # Internal Docker DNS
```

**Note:** MinIO must be created + bucket pre-seeded at startup (use `mc` CLI or a provisioning script).

---

## API Key Provisioning — JWT Token Architecture

**Critical:** Twenty API keys are **asymmetric-signed JWTs**, NOT opaque tokens. The key architecture is:

### How API Keys Work in Twenty

1. **Private Key Storage:** Twenty stores a private key (ED25519 or RSA, env: `APP_SECRET`-derived) in its own `jwtKeyManager` DB tables.
2. **Key Creation:** GraphQL mutations `createApiKey` + `generateApiKeyToken` are called by an authenticated admin.
   - `createApiKey` creates a DB row with a name, workspace ID, and expiry.
   - `generateApiKeyToken` signs a JWT (claims: `jti=api_key_id`, `workspaceId`, `sub`, `exp`) with the private key.
3. **Token Format:** The returned JWT is the **presentable API key** — a base64url-encoded string like `eyJhbGc...`.
4. **Auth Flow:** Twenty server validates requests by verifying the JWT signature against its public key.

### Implications for Provisioning

- **Direct DB insert will NOT work.** Inserting an `apiKey` row without a corresponding JWT signature creates an unusable key.
- **Only path: GraphQL mutations + programmatic signing.**
- **Bootstrap is necessary:** The GraphQL endpoints require an authenticated session (a workspace + admin user).

---

## Bootstrap Process — Two Paths (SPIKE PRIORITY)

### Path A: IS_SIGN_UP_ENABLED=true + GraphQL (Recommended)

**Prerequisite:** Deploy the server with `IS_SIGN_UP_ENABLED=true`.

**Spike sequence (in a provisioning container or local script):**

```bash
# 1. Sign up the first admin user (programmatic)
curl -X POST https://<TWENTY_BASE_URL>/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { signUp(email: \"admin@dealflow.local\", password: \"temp-strong-password\", firstName: \"Admin\", lastName: \"User\") { user { id email } } }"
  }'

# 2. Sign in to get a session token
RESPONSE=$(curl -X POST https://<TWENTY_BASE_URL>/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { signIn(email: \"admin@dealflow.local\", password: \"temp-strong-password\") { user { id email } tokens { accessToken } } }"
  }')

SESSION_TOKEN=$(echo $RESPONSE | jq -r '.data.signIn.tokens.accessToken')

# 3. Create an API key (authorized with session token)
curl -X POST https://<TWENTY_BASE_URL>/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{
    "query": "mutation { createApiKey(name: \"DealFlow Sourcing\") { apiKey { id } } }"
  }'

# 4. Generate the token (get the JWT)
curl -X POST https://<TWENTY_BASE_URL>/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{
    "query": "mutation { generateApiKeyToken(apiKeyId: \"<id-from-step-3>\") { token } }"
  }' | jq -r '.data.generateApiKeyToken.token'
# ↑ This token is TWENTY_API_KEY
```

**Success:** The returned JWT is stored as `TWENTY_API_KEY` (env var, never committed).

### Path B: NODE_ENV=development + CLI (Fallback)

**Prerequisite:** Twenty includes a CLI command for development mode.

**Spike sequence (one-shot container):**

```bash
docker run \
  -e NODE_ENV=development \
  -e DATABASE_URL=<PG_DATABASE_URL> \
  -e REDIS_URL=<REDIS_URL> \
  -e APP_SECRET=<APP_SECRET> \
  twentycrm/twenty:0.32.0 \
  npm run workspace:generate-api-key

# Output:
# TOKEN: eyJhbGc...
```

**Success:** The output `TOKEN: <jwt>` is stored as `TWENTY_API_KEY`.

### Path A vs Path B

| Path | Requires | When to Use | Failure Mode |
|---|---|---|---|
| A (GraphQL) | `IS_SIGN_UP_ENABLED=true` for first admin signup | **Preferred.** Works once signup is complete. | Signup fails → cannot create admin session → cannot create key. **Fallback to Path B or manual init.** |
| B (CLI) | `NODE_ENV=development` container run | **Fallback.** Self-contained; no HTTP round-trips. | CLI returns empty token → indicates a jwtKeyManager issue in the DB schema. **Escalate to head-builder.** |

### Fallback: One-Time Manual Bootstrap

If both paths fail, the **only workaround** is a one-time manual step:

1. **Navigate to Twenty's admin UI** (e.g., `https://crm.dealflow.local/login`).
2. **Create the first admin user** via the Twenty signup page.
3. **Log in.**
4. **Generate an API key** via Settings → Developers → API Keys → Create.
5. **Copy the JWT token** and set it as `TWENTY_API_KEY` in the DealFlow API env.

**This is a one-time instance initialization step** — after the first admin is created, all downstream provisioning is headless.

---

## Full Docker-Compose Example

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: twenty_db
      POSTGRES_USER: twenty_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-pgvector.sql:/docker-entrypoint-initdb.d/init-pgvector.sql
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "twenty_user", "-d", "twenty_db"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - twenty

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly no
    healthcheck:
      test: ["CMD", "redis-cli", "PING"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - twenty

  twenty-server:
    image: twentycrm/twenty:0.32.0
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      APP_SECRET: ${APP_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      PG_DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/twenty_db?sslmode=disable
      REDIS_URL: redis://redis:6379
      SERVER_URL: ${SERVER_URL}
      FRONT_BASE_URL: ${FRONT_BASE_URL}
      IS_SIGN_UP_ENABLED: ${IS_SIGN_UP_ENABLED:-false}
      STORAGE_TYPE: ${STORAGE_TYPE:-s3}
      AWS_S3_REGION: ${AWS_S3_REGION}
      AWS_S3_BUCKET: ${AWS_S3_BUCKET}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_S3_ENDPOINT: ${AWS_S3_ENDPOINT}
    ports:
      - "3000:3000"  # API + REST endpoints
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - twenty

  twenty-worker:
    image: twentycrm/twenty:0.32.0
    command: yarn worker:prod
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      APP_SECRET: ${APP_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      PG_DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/twenty_db?sslmode=disable
      REDIS_URL: redis://redis:6379
      STORAGE_TYPE: ${STORAGE_TYPE:-s3}
      AWS_S3_REGION: ${AWS_S3_REGION}
      AWS_S3_BUCKET: ${AWS_S3_BUCKET}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
      AWS_S3_ENDPOINT: ${AWS_S3_ENDPOINT}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      twenty-server:
        condition: service_started
    networks:
      - twenty

volumes:
  postgres_data:

networks:
  twenty:
    driver: bridge
```

---

## Resource Requirements

### Minimum Recommended (Production)

| Service | CPU | Memory | Storage |
|---|---|---|---|
| twenty-server | 1 CPU | 1 GB | N/A (stateless) |
| twenty-worker | 0.5 CPU | 512 MB | N/A (stateless) |
| postgres | 1 CPU | 2 GB | 50 GB (depends on company count; 1K companies ≈ 5-10 GB) |
| redis | 0.25 CPU | 256 MB | 10 GB (ephemeral sessions) |
| S3/MinIO | 0.5 CPU | 512 MB | 100 GB+ (file uploads) |

**Total:** ~3 CPU, 4.5 GB RAM, ~200 GB storage (for 10K+ company records).

---

## Environment File Template

Create `.env` or set Railway env vars:

```bash
# === Core ===
NODE_ENV=production
APP_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# === PostgreSQL ===
POSTGRES_USER=twenty_user
POSTGRES_PASSWORD=$(openssl rand -base64 32)

# === URLs ===
SERVER_URL=https://crm.dealflow.local
FRONT_BASE_URL=https://crm.dealflow.local

# === Bootstrap (set to true only for initial provisioning spike) ===
IS_SIGN_UP_ENABLED=false

# === S3 (Cloudflare R2) ===
STORAGE_TYPE=s3
AWS_S3_REGION=auto
AWS_S3_BUCKET=dealflow-twenty-uploads
AWS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<R2-token-id>
AWS_SECRET_ACCESS_KEY=<R2-token-secret>
```

**Never commit this file. Use platform-specific env var injection (Railway, Docker Secrets, etc.).**

---

## API Key Literals (Runtime)

| Literal | Value | Source |
|---|---|---|
| Authorization header | `Authorization: Bearer <TWENTY_API_KEY>` | JWT token from bootstrap |
| GraphQL mutation (create key) | `createApiKey(name: String!)` | Twenty server resolver |
| GraphQL mutation (generate token) | `generateApiKeyToken(apiKeyId: ID!)` | Twenty server resolver |
| CLI command (dev only) | `npm run workspace:generate-api-key` | `packages/twenty-server/package.json` scripts |
| REST endpoint base | `<TWENTY_BASE_URL>/rest/` | All REST calls prefix with `/rest/` |
| REST endpoint (companies) | `GET /rest/companies?limit=60&depth=2&starting_after=<cursor>` | Used by wave-31 adapter (unchanged) |

---

## Integration-Specific Findings (Wave 32)

### Provisioning Spike Scripts

Two provisioning flows are tested during the wave-32 deploy:

1. **provision-via-signup.sh** — Path A (GraphQL signUp/signIn/createApiKey)
2. **provision-via-cli.sh** — Path B (NODE_ENV=development workspace:generate-api-key)

Both print `TWENTY_API_KEY=<token>` on success. The first successful path is used; the other is logged as "skipped."

### Secrets Generation (Orchestrator)

- `APP_SECRET`: `openssl rand -base64 32`
- `ENCRYPTION_KEY`: `openssl rand -base64 32`
- `POSTGRES_PASSWORD`: `openssl rand -base64 32`
- S3 credentials: account-issued (Cloudflare R2 or AWS) or orchestrator-generated (MinIO)

**Never hardcoded. Never committed.**

### TLS / HTTPS Enforcement

The adapter (wave-31 twenty.adapter.ts:394) validates `TWENTY_BASE_URL.protocol === 'https:'`. Any http:// URL triggers a silent `[]` return.

For local development: use a self-signed certificate or a local HTTPS proxy (e.g., `mkcert`, `ngrok`).

### Database Migrations

Twenty's server image auto-runs migrations on startup. No manual migration step needed.

### Backward Compatibility

Version 0.32.0 is pinned for this wave. Future upgrades require re-researching this doc.

---

## Documentation Links

- **Official Self-Hosting Guide:** https://docs.twenty.com/self-hosting
- **API Reference (REST):** https://docs.twenty.com/api-reference/overview
- **GraphQL Schema:** https://docs.twenty.com/graphql-api
- **GitHub:** https://github.com/twentyhq/twenty
- **Docker Hub:** https://hub.docker.com/r/twentycrm/twenty
- **pgvector Docs:** https://github.com/pgvector/pgvector
- **Cloudflare R2 Docs:** https://developers.cloudflare.com/r2/
