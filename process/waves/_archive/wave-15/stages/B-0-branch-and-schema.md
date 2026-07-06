# Wave 15 — B-0 Branch & schema
- Branch wave-15-m7-admin. Claimed 4 tasks.
- Migration 0013 (additive, JOURNALED): users.deactivated_at + workspace_settings table + data_source_connections.encrypted_credentials. Authored at B-1 (with the schema changes).
- CREDENTIALS_ENC_KEY: self-generated (rule 6), NOT committed. No local .env present → the PROD key is generated + set in the Railway env at C-2 (head-ci-cd variableUpsert); CI tests + local use a TEST key (mirror the AUDIT_LOG_HMAC_KEY test pattern — a known test key in the test env / ci.yml). .env.example placeholder added.
- M3 sourcing.ts "no secret column" assertion → reconcile (encrypted_credentials coexists with env-var provider_key).
```yaml
schema_skipped: false
migrations: [0013 (users.deactivated_at + workspace_settings + data_source_connections.encrypted_credentials)]
new_secret: CREDENTIALS_ENC_KEY (self-gen, not committed; prod→C-2, test→test-key)
