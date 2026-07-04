# Wave 6 — B-0 Branch & schema
- **Branch:** wave-6-deal-sourcing (from main @ 9cea8bf).
- **Task claim:** ff378a95 + 0241222b + db274731 + f5771d13 → in_progress, wave_id=wave 6. 4/4.
- **Deps:** none new (fixture JSON adapter; no CSV parser; real provider SDKs deferred to later M3 bundle).
- **Schema:** YES — additive migration 0004 (7 tables + normalized_domain partial-unique) authored @ B-2 by postgres-pro. No existing table touched; reversible down. databases.md reconciled at P-4.
- **Env:** none new (provider creds env-only per provider_key; fixture adapter needs none).
```yaml
branch: wave-6-deal-sourcing
deps_added: []
env_vars_added: []
schema_skipped: false
migrations: [0004_deal_sourcing_spine (7 tables, authored @ B-2)]
deviations: []
```
