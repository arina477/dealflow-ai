# Wave 2 — B-0 Branch & schema

- **Branch:** wave-2-auth-backbone (from main @ 4cad017…).
- **Task claim:** e15f71dd + e1c0e81e + af6cbc59 flipped `todo → in_progress`, wave_id attached to wave 2. RETURNING matched 3/3 — no missing ids.
- **Env:** SUPERTOKENS_CONNECTION_URI / SUPERTOKENS_API_KEY / SUPERTOKENS_DATABASE_URL / SESSION_SECRET already placeholdered in .env.example (onboarding v6b). Local dev SESSION_SECRET generated via `openssl rand -base64 32` (not committed). SuperTokens Core connection provisioned at C-2 (Railway). Boot-time assertion (SUPERTOKENS_DATABASE_URL ≠ DATABASE_URL/TEST_DATABASE_URL) lands in B-2 wiring per P-3.
- **Deps:** `supertokens-node@24.0.2` installed into apps/api (resolved version confirmed 24.0.2). Committed `757bc92` (chore(deps)).
- **Schema:** additive auth data model authored by postgres-pro. Per-module schema layout introduced (apps/api/src/db/schema/{app-meta.ts,users-roles.ts,index.ts}); app_meta moved (no DDL change). Migration `0001_serious_junta.sql` + `.down.sql`.
  - `roles(id, name unique, created_at)` — seeded advisor/analyst/compliance/admin (idempotent ON CONFLICT).
  - `users(id, supertokens_user_id unique, email unique, role_id FK→roles RESTRICT, created_at)` + idx on supertokens_user_id.
  - `invites(id, token unique, email, invited_by FK→users SET NULL nullable, role_id FK→roles RESTRICT, expiry, consumed_at nullable, created_at)` + partial unique idx on (token) WHERE consumed_at IS NULL.
  - Additive-only (grep DROP/ALTER-DROP → CLEAN; app_meta untouched). Down drops only the 3 new tables in FK order. drizzle-kit generate + tsc --noEmit clean. Apply deferred to C-2 pre-deploy (Railway DB not reachable from build env; wave-1 pattern). Committed `f3681f8`.

```yaml
branch: wave-2-auth-backbone
deps_added: [supertokens-node@24.0.2]
env_vars_added: []          # SUPERTOKENS_*/SESSION_SECRET already in .env.example (v6b)
schema_skipped: false
migrations: [apps/api/src/db/migrations/0001_serious_junta.sql, apps/api/src/db/migrations/0001_serious_junta.down.sql]
orm_models_changed: [apps/api/src/db/schema/users-roles.ts, apps/api/src/db/schema/app-meta.ts, apps/api/src/db/schema/index.ts]
backfill_ran: false
deviations: []
commits: [757bc92 (deps), f3681f8 (schema)]
apply_deferred_to: C-2 pre-deploy
```
