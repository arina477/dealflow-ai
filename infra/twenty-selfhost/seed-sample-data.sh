#!/bin/bash
set -e

# =============================================================================
# Twenty Self-Hosted: Seed Sample Data
# =============================================================================
#
# Inserts sample companies and contacts into Twenty via REST API.
# Used for testing the sourcing adapter integration.
#
# Prerequisites:
#   - Twenty server is running and healthy
#   - TWENTY_API_KEY is set (JWT token from provisioning)
#   - curl, jq installed
#
# Usage:
#   export TWENTY_BASE_URL=https://crm.example.com
#   export TWENTY_API_KEY=<jwt-token-from-provisioning>
#   bash seed-sample-data.sh
#
# Output:
#   Logs created company/contact IDs to stderr
#
# =============================================================================

TWENTY_BASE_URL="${TWENTY_BASE_URL:-http://localhost:3000}"
TWENTY_API_KEY="${TWENTY_API_KEY}"

if [ -z "$TWENTY_API_KEY" ]; then
  echo "[seed] ERROR: TWENTY_API_KEY not set. Run provisioning first." >&2
  exit 1
fi

echo "[seed] Seeding sample data into Twenty at ${TWENTY_BASE_URL}" >&2

# Function to create a company
create_company() {
  local name=$1
  local domain=$2

  echo "[seed] Creating company: $name" >&2

  COMPANY_RESPONSE=$(curl -s -X POST "${TWENTY_BASE_URL}/rest/companies" \
    -H "Authorization: Bearer ${TWENTY_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${name}\",
      \"domainName\": {
        \"primaryLinkUrl\": \"https://${domain}\"
      }
    }")

  COMPANY_ID=$(echo "$COMPANY_RESPONSE" | jq -r '.data.id // empty')

  if [ -z "$COMPANY_ID" ]; then
    ERROR=$(echo "$COMPANY_RESPONSE" | jq -r '.error // "unknown error"')
    echo "[seed] WARNING: Failed to create company '${name}': ${ERROR}" >&2
    return 1
  fi

  echo "[seed] Company created: ${name} (ID: ${COMPANY_ID})" >&2
  echo "$COMPANY_ID"
}

# Function to create a person (contact)
create_person() {
  local company_id=$1
  local first_name=$2
  local last_name=$3
  local email=$4
  local job_title=$5

  echo "[seed] Creating contact: ${first_name} ${last_name} (${email})" >&2

  PERSON_RESPONSE=$(curl -s -X POST "${TWENTY_BASE_URL}/rest/people" \
    -H "Authorization: Bearer ${TWENTY_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{
      \"firstName\": \"${first_name}\",
      \"lastName\": \"${last_name}\",
      \"emails\": {
        \"primaryEmail\": \"${email}\"
      },
      \"jobTitle\": \"${job_title}\",
      \"companyId\": \"${company_id}\"
    }")

  PERSON_ID=$(echo "$PERSON_RESPONSE" | jq -r '.data.id // empty')

  if [ -z "$PERSON_ID" ]; then
    ERROR=$(echo "$PERSON_RESPONSE" | jq -r '.error // "unknown error"')
    echo "[seed] WARNING: Failed to create contact '${first_name} ${last_name}': ${ERROR}" >&2
    return 1
  fi

  echo "[seed] Contact created: ${first_name} ${last_name} (ID: ${PERSON_ID})" >&2
  echo "$PERSON_ID"
}

# Seed sample companies and contacts
echo "[seed] Starting data seed..." >&2

# Company 1: Acme Corp
ACME_ID=$(create_company "Acme Corp" "acme.com")
if [ -n "$ACME_ID" ]; then
  create_person "$ACME_ID" "John" "Smith" "john.smith@acme.com" "CEO"
  create_person "$ACME_ID" "Jane" "Doe" "jane.doe@acme.com" "CFO"
fi

# Company 2: Tech Innovations Inc
TECH_ID=$(create_company "Tech Innovations Inc" "techinnovations.io")
if [ -n "$TECH_ID" ]; then
  create_person "$TECH_ID" "Bob" "Johnson" "bob.johnson@techinnovations.io" "CTO"
fi

# Company 3: Global Solutions Ltd
GLOBAL_ID=$(create_company "Global Solutions Ltd" "globalsolutions.com")
if [ -n "$GLOBAL_ID" ]; then
  create_person "$GLOBAL_ID" "Alice" "Williams" "alice.williams@globalsolutions.com" "VP Sales"
  create_person "$GLOBAL_ID" "Charlie" "Brown" "charlie.brown@globalsolutions.com" "COO"
fi

echo "[seed] Data seeding complete." >&2
exit 0
