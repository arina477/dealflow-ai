# Wave 14 — B-0 Branch & schema
- Branch wave-14-compliance-hardening. Claimed 3 tasks.
- Schema: migration 0012 (additive nullable mandate_id column on audit_log_entries — HASH-EXCLUDED, journal when>0011, .down). Authored at B-1 as part of the hash-safe gate change.
```yaml
schema_skipped: false
migrations: [0012_audit_mandate_id.sql]
hash_excluded_column: true
