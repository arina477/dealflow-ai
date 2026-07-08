#!/bin/bash
set -e

# =============================================================================
# Twenty Self-Hosted: Bootstrap Provisioning via GraphQL (Path A)
# =============================================================================
#
# This script provisions a fresh Twenty instance for headless API access:
# 1. Creates the first admin user via signUp (requires IS_SIGN_UP_ENABLED=true)
# 2. Signs in to get a session token
# 3. Creates an API key via createApiKey mutation
# 4. Generates the API key token (JWT) via generateApiKeyToken mutation
# 5. Exports TWENTY_API_KEY (the presentable JWT)
#
# Prerequisites:
#   - Twenty server is running and healthy
#   - IS_SIGN_UP_ENABLED=true (to allow programmatic signup)
#   - curl, jq installed
#
# Usage:
#   export TWENTY_BASE_URL=https://crm.example.com
#   export ADMIN_EMAIL=admin@dealflow.local
#   export ADMIN_PASSWORD=strong-temp-password-here
#   bash provision-via-signup.sh
#
# Output:
#   TWENTY_API_KEY=<jwt-token>  (stdout)
#
# =============================================================================

TWENTY_BASE_URL="${TWENTY_BASE_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@dealflow.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(openssl rand -base64 12)}"
ADMIN_FIRST_NAME="${ADMIN_FIRST_NAME:-Admin}"
ADMIN_LAST_NAME="${ADMIN_LAST_NAME:-User}"
API_KEY_NAME="${API_KEY_NAME:-DealFlow Sourcing}"

echo "[provision-via-signup] Bootstrapping Twenty instance at ${TWENTY_BASE_URL}" >&2
echo "[provision-via-signup] Admin email: ${ADMIN_EMAIL}" >&2

# Step 1: Sign up the first admin user
echo "[provision-via-signup] Step 1: Creating admin user..." >&2
SIGNUP_RESPONSE=$(curl -s -X POST "${TWENTY_BASE_URL}/graphql" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"mutation { signUp(email: \\\"${ADMIN_EMAIL}\\\", password: \\\"${ADMIN_PASSWORD}\\\", firstName: \\\"${ADMIN_FIRST_NAME}\\\", lastName: \\\"${ADMIN_LAST_NAME}\\\") { user { id email } } }\"
  }")

SIGNUP_ERROR=$(echo "$SIGNUP_RESPONSE" | jq -r '.errors[0].message // empty')
if [ -n "$SIGNUP_ERROR" ]; then
  echo "[provision-via-signup] ERROR during signup: $SIGNUP_ERROR" >&2
  echo "PROVISION_FAILED" >&2
  exit 1
fi

echo "[provision-via-signup] Admin user created." >&2

# Step 2: Sign in to get a session token
echo "[provision-via-signup] Step 2: Signing in..." >&2
SIGNIN_RESPONSE=$(curl -s -X POST "${TWENTY_BASE_URL}/graphql" \
  -H "Content-Type: application/json" \
  -d "{
    \"query\": \"mutation { signIn(email: \\\"${ADMIN_EMAIL}\\\", password: \\\"${ADMIN_PASSWORD}\\\") { user { id email } tokens { accessToken } } }\"
  }")

SESSION_TOKEN=$(echo "$SIGNIN_RESPONSE" | jq -r '.data.signIn.tokens.accessToken // empty')
if [ -z "$SESSION_TOKEN" ]; then
  SIGNIN_ERROR=$(echo "$SIGNIN_RESPONSE" | jq -r '.errors[0].message // "unknown error"')
  echo "[provision-via-signup] ERROR during signin: $SIGNIN_ERROR" >&2
  echo "PROVISION_FAILED" >&2
  exit 1
fi

echo "[provision-via-signup] Session token obtained." >&2

# Step 3: Create an API key
echo "[provision-via-signup] Step 3: Creating API key record..." >&2
CREATE_KEY_RESPONSE=$(curl -s -X POST "${TWENTY_BASE_URL}/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -d "{
    \"query\": \"mutation { createApiKey(name: \\\"${API_KEY_NAME}\\\") { apiKey { id name } } }\"
  }")

API_KEY_ID=$(echo "$CREATE_KEY_RESPONSE" | jq -r '.data.createApiKey.apiKey.id // empty')
if [ -z "$API_KEY_ID" ]; then
  CREATE_KEY_ERROR=$(echo "$CREATE_KEY_RESPONSE" | jq -r '.errors[0].message // "unknown error"')
  echo "[provision-via-signup] ERROR creating API key: $CREATE_KEY_ERROR" >&2
  echo "PROVISION_FAILED" >&2
  exit 1
fi

echo "[provision-via-signup] API key created (ID: ${API_KEY_ID})." >&2

# Step 4: Generate the API key token (JWT)
echo "[provision-via-signup] Step 4: Generating API key token..." >&2
GENERATE_TOKEN_RESPONSE=$(curl -s -X POST "${TWENTY_BASE_URL}/graphql" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${SESSION_TOKEN}" \
  -d "{
    \"query\": \"mutation { generateApiKeyToken(apiKeyId: \\\"${API_KEY_ID}\\\") { token } }\"
  }")

TWENTY_API_KEY=$(echo "$GENERATE_TOKEN_RESPONSE" | jq -r '.data.generateApiKeyToken.token // empty')
if [ -z "$TWENTY_API_KEY" ]; then
  GEN_ERROR=$(echo "$GENERATE_TOKEN_RESPONSE" | jq -r '.errors[0].message // "unknown error"')
  echo "[provision-via-signup] ERROR generating token: $GEN_ERROR" >&2
  echo "PROVISION_FAILED" >&2
  exit 1
fi

echo "[provision-via-signup] API key token generated successfully." >&2

# Output the API key to stdout
echo "TWENTY_API_KEY=${TWENTY_API_KEY}"

# Log success
echo "[provision-via-signup] Provisioning complete. Set TWENTY_API_KEY in your Railway env." >&2
exit 0
