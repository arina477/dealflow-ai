# Wave 16 — B-0 Branch & schema
Branch wave-16-admin-hardening from main. 6 tasks claimed (in_progress, wave_id=wave-16). Schema sub-actions SKIPPED per P-4 security rework: no migration this wave.
- Invite liveness → pg_advisory_xact_lock(hash(lower(email))) in-service (not a partial index — P-4 Finding 1); no invites DDL.
- Reactivate → existing users.deactivated_at (0013); no DDL.
- user-reactivate → additive value on the CLOSED shared Zod auditActionEnum (audit_log.action is text, not a PG enum); no ALTER TYPE.
- Config typed-boundary + admin-activity → validation/read-layer; no DDL.
No new deps, no new env var.
```yaml
branch: wave-16-admin-hardening
deps_added: []
env_vars_added: []
schema_skipped: true
migrations: []
orm_models_changed: []
backfill_ran: false
deviations: []
```
