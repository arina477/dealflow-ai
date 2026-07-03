# Wave 5 — B-0 Branch & schema
- **Branch:** wave-5-compliance-gate (from main @ 984d565).
- **Task claim:** 0595a835 + 95adac6c + 034463b1 + 34cb1d18 → in_progress, wave_id=wave 5. 4/4.
- **Deps:** none new (node:crypto for content hash).
- **Schema:** YES — additive migration 0003 (4 mutable config tables + Drizzle schema) authored @ B-2 by postgres-pro. NO immutability trigger (config tables, audited-on-change; distinct from immutable audit_log). No existing table touched; reversible down.
- **Env:** none new.
```yaml
branch: wave-5-compliance-gate
deps_added: []
env_vars_added: []
schema_skipped: false
migrations: [0003_compliance_rules_engine (authored @ B-2)]
deviations: []
```
