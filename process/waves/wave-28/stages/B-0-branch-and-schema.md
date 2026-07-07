# Wave 28 — B-0 Branch & schema
Branch wave-28-retention-policy. 4 tasks (d3cc1337 migration + b7786c5b contracts + ed4945e0 service/API + ce75c6c6 UI). Schema: ONE additive migration (workspace_retention_policy — MUTABLE, explicit ENABLE+FORCE RLS + workspace_isolation policy [USING-only] + dealflow_app GRANT [SEC-B]). Journaled (schema def + drizzle-kit generate). NOT WORM → wave-24 populated-migration AC N/A. D-block DONE (D-3 APPROVED).
```yaml
branch: wave-28-retention-policy
schema_skipped: false
migration: workspace_retention_policy (additive, RLS-scoped, journaled)
```
