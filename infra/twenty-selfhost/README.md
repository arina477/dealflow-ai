# Twenty Self-Hosted Deployment

This directory contains the infrastructure templates, provisioning scripts, and documentation for deploying Twenty CRM as a self-hosted instance on DealFlow AI's infrastructure (Railway).

## Quick Start

### 1. Deploy the Stack

```bash
cd infra/twenty-selfhost
cp .env.example .env
# Edit .env with your values (see .env.example for details)
# Set all secrets via environment variables or Railway platform vars

docker-compose up -d
```

### 2. Wait for Services to be Healthy

```bash
docker-compose ps
# Confirm: postgres, redis, twenty-server, twenty-worker all "healthy"
# Check logs: docker-compose logs -f twenty-server
```

### 3. Generate Secrets (Orchestrator)

If not already set, generate strong secrets:

```bash
# Generate APP_SECRET, ENCRYPTION_KEY, POSTGRES_PASSWORD
openssl rand -base64 32  # Run 3 times for 3 secrets
```

Set these in your `.env` or Railway platform environment variables. **Never commit them.**

### 4. Bootstrap the Instance (Provision API Key)

Two paths are available; the first successful one is used.

#### Path A: GraphQL Signup (Preferred)

```bash
# Set IS_SIGN_UP_ENABLED=true in .env temporarily
export TWENTY_BASE_URL=https://crm.dealflow.local  # or your instance URL
export ADMIN_EMAIL=admin@dealflow.local
export ADMIN_PASSWORD=strong-temp-password  # Or let the script generate one
bash provision-via-signup.sh
# Output: TWENTY_API_KEY=<jwt-token>
# Copy this token and add to Railway env vars
```

Then **revert IS_SIGN_UP_ENABLED to false** in your deployment config.

#### Path B: CLI (Fallback)

```bash
export TWENTY_VERSION=0.32.0
export PG_DATABASE_URL=postgres://twenty_user:password@postgres:5432/twenty_db?sslmode=disable
export REDIS_URL=redis://redis:6379
export APP_SECRET=$(openssl rand -base64 32)  # From step 3
export ENCRYPTION_KEY=$(openssl rand -base64 32)  # From step 3
bash provision-via-cli.sh
# Output: TWENTY_API_KEY=<jwt-token>
# Copy this token and add to Railway env vars
```

#### Manual Fallback (One-Time)

If both scripts fail:

1. Navigate to your Twenty instance URL (e.g., `https://crm.dealflow.local`).
2. Sign up for the first admin account via the web UI.
3. Log in.
4. Go to **Settings → Developers → API Keys**.
5. Click **Create API Key**.
6. Copy the generated JWT token.
7. Set it as `TWENTY_API_KEY` in your DealFlow API service env vars (Railway).

### 5. Seed Sample Data

```bash
export TWENTY_BASE_URL=https://crm.dealflow.local
export TWENTY_API_KEY=<jwt-token-from-step-4>
bash seed-sample-data.sh
```

This creates sample companies and contacts for testing.

### 6. Activate DealFlow Sourcing Adapter

Set these environment variables on your DealFlow API service (Railway):

```
TWENTY_BASE_URL=https://crm.dealflow.local  (or your instance URL; must be HTTPS)
TWENTY_API_KEY=<jwt-token-from-step-4>
```

The wave-31 `twenty.adapter.ts` will now read companies from your self-hosted instance.

### 7. Verify Live Data Flow

Test the DealFlow sourcing endpoint:

```bash
curl -X GET https://api.dealflow.local/sourcing/companies \
  -H "Authorization: Bearer <dealflow-api-token>"
```

You should see the sample companies seeded in step 5 flowing through the DealFlow API.

---

## File Structure

```
infra/twenty-selfhost/
├── docker-compose.yml              # Full stack (postgres, redis, server, worker)
├── init-pgvector.sql               # PostgreSQL pgvector extension setup
├── .env.example                    # Template for secrets (DO NOT commit .env)
├── provision-via-signup.sh          # Path A: GraphQL bootstrap (preferred)
├── provision-via-cli.sh             # Path B: CLI bootstrap (fallback)
├── seed-sample-data.sh              # Seed sample companies/contacts
└── README.md                        # This file
```

---

## Environment Variables

All variables are in `.env.example`. Key ones:

| Var | Required | Source | Example |
|---|---|---|---|
| `NODE_ENV` | Yes | Manual | `production` |
| `APP_SECRET` | Yes | Orchestrator (openssl rand -base64 32) | `aBc...` |
| `ENCRYPTION_KEY` | Yes | Orchestrator (openssl rand -base64 32) | `xYz...` |
| `POSTGRES_USER` | Yes | Manual | `twenty_user` |
| `POSTGRES_PASSWORD` | Yes | Orchestrator (openssl rand -base64 32) | `PqR...` |
| `SERVER_URL` | Yes | Manual (HTTPS) | `https://crm.example.com` |
| `FRONT_BASE_URL` | Yes | Manual (HTTPS) | `https://crm.example.com` |
| `IS_SIGN_UP_ENABLED` | Only for bootstrap | Manual | `true` (then revert to `false`) |
| `STORAGE_TYPE` | Yes | Manual | `s3` |
| `AWS_S3_REGION` | Yes | Manual or Account-issued | `auto` (Cloudflare R2) |
| `AWS_S3_BUCKET` | Yes | Manual or Account-issued | `dealflow-twenty-uploads` |
| `AWS_ACCESS_KEY_ID` | Yes | Account-issued | (from Cloudflare R2 or AWS) |
| `AWS_SECRET_ACCESS_KEY` | Yes | Account-issued | (from Cloudflare R2 or AWS) |
| `AWS_S3_ENDPOINT` | Yes | Account-issued | `https://xxxx.r2.cloudflarestorage.com` |

**Secrets:** `APP_SECRET`, `ENCRYPTION_KEY`, `POSTGRES_PASSWORD`, `AWS_SECRET_ACCESS_KEY` are never committed. Generate via `openssl rand -base64 32` or account providers, and set in:
- Local dev: `.env` file (gitignored)
- Railway: environment variables (not in code)

---

## Object Storage Setup

### Cloudflare R2 (Recommended)

1. Log in to Cloudflare dashboard.
2. Create an R2 bucket (e.g., `dealflow-twenty-uploads`).
3. Generate an R2 API token (read+write scope).
4. Set env vars:
   ```
   STORAGE_TYPE=s3
   AWS_S3_REGION=auto
   AWS_S3_BUCKET=dealflow-twenty-uploads
   AWS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   AWS_ACCESS_KEY_ID=<R2 token ID>
   AWS_SECRET_ACCESS_KEY=<R2 token secret>
   ```

### MinIO (Self-Hosted)

MinIO can be added as an additional service to docker-compose.yml if full self-hosting is required. See the main deployment docs for the MinIO service definition and configuration.

---

## Health Checks

Monitor service health:

```bash
# All services
docker-compose ps

# Logs
docker-compose logs -f twenty-server
docker-compose logs -f twenty-worker
docker-compose logs -f postgres

# Manual health check
curl http://localhost:3000/health
```

---

## Troubleshooting

### Issue: "Cannot connect to Postgres"

- Verify `PG_DATABASE_URL` format: `postgres://user:password@host:port/dbname?sslmode=disable`
- Check Postgres is running: `docker-compose ps postgres` (should be "healthy")
- Check logs: `docker-compose logs postgres`

### Issue: "API key provisioning failed"

- **Path A failure (GraphQL):** Confirm `IS_SIGN_UP_ENABLED=true` and the server is fully booted.
- **Path B failure (CLI):** Confirm `NODE_ENV=development` and Postgres schema is initialized.
- **Fallback:** Use the manual UI-based approach (one-time signup via Twenty login page).

### Issue: "TWENTY_BASE_URL must be HTTPS"

The DealFlow adapter enforces HTTPS (misconfig guard). For local dev:
- Use `mkcert` to generate a self-signed cert and proxy traffic via HTTPS.
- Or use ngrok for HTTPS tunneling during testing.

### Issue: "Storage (S3) requests failing"

- Verify S3 credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`).
- Verify bucket name and endpoint (e.g., Cloudflare R2 endpoint format: `https://<account-id>.r2.cloudflarestorage.com`).
- Check S3 bucket exists and credentials have read+write scope.

---

## Security Considerations

1. **Secrets**: Never commit `.env`, passwords, or API keys. Use platform-level env vars (Railway, etc.).
2. **HTTPS**: Always use HTTPS for production (`SERVER_URL`, `FRONT_BASE_URL`). The adapter enforces this.
3. **Network**: Twenty admin UI is private (only accessible behind the firewall by default). Expose only the API endpoint.
4. **Database**: `POSTGRES_PASSWORD` is a strong random secret. Don't reuse across instances.
5. **Object Storage**: R2/S3 credentials are account-issued. Rotate them regularly.

---

## Production Deployment (Railway)

When deploying to Railway:

1. **Create a PostgreSQL add-on** (or use external Postgres). Set `PG_DATABASE_URL` to the connection string.
2. **Create a Redis add-on** (or external). Set `REDIS_URL`.
3. **Create an R2 bucket** (or use existing S3). Set S3 env vars.
4. **Deploy the docker-compose stack** (or use Railway services individually).
5. **Run provisioning scripts** to bootstrap the instance and generate `TWENTY_API_KEY`.
6. **Set `TWENTY_BASE_URL` and `TWENTY_API_KEY` on the DealFlow API service** to enable sourcing.

---

## References

- **Twenty Docs**: https://docs.twenty.com/self-hosting
- **Twenty API Docs**: https://docs.twenty.com/api-reference/overview
- **PostgreSQL + pgvector**: https://github.com/pgvector/pgvector
- **Cloudflare R2**: https://developers.cloudflare.com/r2/
- **DealFlow Sourcing Adapter**: `apps/api/src/modules/sourcing/adapters/twenty.adapter.ts`

---

## Support & Escalation

If provisioning or live integration fails:

1. Check logs and troubleshooting section above.
2. Ensure all secrets are set correctly (especially `TWENTY_BASE_URL` as HTTPS).
3. If both bootstrap paths fail → **Escalate to head-builder** for manual instance initialization.

The one-time manual founder step (create first admin via Twenty UI) is an acceptable fallback and does not block further work — it's a one-time instance initialization, not a per-run manual step.
