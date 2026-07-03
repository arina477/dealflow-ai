# Wave 4 — B-0 Branch & schema
- **Branch:** wave-4-audit-log (from main @ 31df1d0).
- **Task claim:** ec1f279d + a8b2b5a2 + e6a4cbfe + 031d79fc → in_progress, wave_id=wave 4. 4/4.
- **Deps:** none new (node:crypto is Node stdlib; HMAC-SHA256 via createHmac).
- **Schema:** YES — additive migration 0002 (audit_log_entries table + INSERT/SELECT grant + BEFORE UPDATE/DELETE trigger) authored at B-2 by postgres-pro. No existing table touched; reversible down.
- **Env:** AUDIT_LOG_HMAC_KEY + AUDIT_LOG_HMAC_KEY_VERSION (already .env.example placeholders; real secret set at B-4/C via platform).
```yaml
branch: wave-4-audit-log
deps_added: []
env_vars_added: [AUDIT_LOG_HMAC_KEY, AUDIT_LOG_HMAC_KEY_VERSION]
schema_skipped: false
migrations: [0002_audit_log_entries (authored @ B-2)]
deviations: []
```
