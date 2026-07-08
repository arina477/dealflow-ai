#!/bin/bash
set -e

# =============================================================================
# Twenty Self-Hosted: Bootstrap Provisioning via CLI (Path B — Fallback)
# =============================================================================
#
# This script provisions a fresh Twenty instance using the development CLI command.
# Used when Path A (GraphQL signUp) fails or IS_SIGN_UP_ENABLED cannot be set.
#
# Prerequisites:
#   - PostgreSQL is running and initialized with the migrations
#   - NODE_ENV=development (required for CLI key generation)
#   - Docker (to run a one-shot container)
#
# Usage:
#   export TWENTY_VERSION=0.32.0
#   export PG_DATABASE_URL=postgres://twenty_user:password@postgres:5432/twenty_db?sslmode=disable
#   export REDIS_URL=redis://redis:6379
#   export APP_SECRET=$(openssl rand -base64 32)
#   export ENCRYPTION_KEY=$(openssl rand -base64 32)
#   bash provision-via-cli.sh
#
# Output:
#   TWENTY_API_KEY=<jwt-token>  (stdout)
#
# =============================================================================

TWENTY_VERSION="${TWENTY_VERSION:-0.32.0}"
PG_DATABASE_URL="${PG_DATABASE_URL:-postgres://twenty_user:password@postgres:5432/twenty_db?sslmode=disable}"
REDIS_URL="${REDIS_URL:-redis://redis:6379}"
APP_SECRET="${APP_SECRET:-$(openssl rand -base64 32)}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-$(openssl rand -base64 32)}"

echo "[provision-via-cli] Provisioning Twenty instance via CLI (NODE_ENV=development)..." >&2

# Run the one-shot CLI command in a container
CLI_OUTPUT=$(docker run --rm \
  -e NODE_ENV=development \
  -e PG_DATABASE_URL="${PG_DATABASE_URL}" \
  -e REDIS_URL="${REDIS_URL}" \
  -e APP_SECRET="${APP_SECRET}" \
  -e ENCRYPTION_KEY="${ENCRYPTION_KEY}" \
  "twentyhq/twenty-server:${TWENTY_VERSION}" \
  npm run workspace:generate-api-key 2>&1 || true)

echo "[provision-via-cli] CLI output:" >&2
echo "$CLI_OUTPUT" >&2

# Extract TOKEN from CLI output
# Expected format: "TOKEN: eyJhbGc..." or similar
TWENTY_API_KEY=$(echo "$CLI_OUTPUT" | grep -oP '(?<=TOKEN:\s)\S+' | head -1 || true)

if [ -z "$TWENTY_API_KEY" ]; then
  echo "[provision-via-cli] ERROR: No token found in CLI output. Provisioning failed." >&2
  echo "PROVISION_FAILED" >&2
  exit 1
fi

echo "[provision-via-cli] API key token generated via CLI." >&2

# Output the API key to stdout
echo "TWENTY_API_KEY=${TWENTY_API_KEY}"

echo "[provision-via-cli] Provisioning complete. Set TWENTY_API_KEY in your Railway env." >&2
exit 0
