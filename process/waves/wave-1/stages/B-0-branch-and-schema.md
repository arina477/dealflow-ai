# Wave 1 — B-0 Branch & schema

- **Branch:** wave-1-walking-skeleton (created from main).
- **Task claim:** e83584db-6387-4567-916c-aacba5c5dede flipped `todo → in_progress`, `wave_id` attached to wave 1 (c086d358…). RETURNING matched 1/1 requested — no missing ids.
- **Env:** DATABASE_URL already present in .env.example (v6b); TEST_DATABASE_URL to be added at B-5 for the integration test (distinct from DATABASE_URL per _library R-17). No new secrets to generate this wave (SuperTokens/email/etc. are later milestones).
- **Deps:** none installed yet at B-0 — greenfield has no package.json; the full dependency set is installed as the root scaffold materializes the workspace (first build spawn, B-0→B-1 boundary). Recorded so B-6 knows deps arrived via scaffold, not a pre-existing manifest.
- **Schema:** this wave has a trivial baseline (`app_meta(key text pk, value text)`) + first Drizzle migration. Authored as Drizzle code by postgres-pro during the build (there is no app to run drizzle-kit against until the scaffold exists); migration applied + verified against real Postgres at B-5.

```yaml
branch: wave-1-walking-skeleton
deps_added: []          # installed via scaffold spawn (no pre-existing package.json)
env_vars_added: [TEST_DATABASE_URL]   # added at B-5; DATABASE_URL already present
schema_skipped: false
migrations: [apps/api/drizzle/0000_init.sql]   # authored in-block
orm_models_changed: [apps/api/src/db/schema.ts]
backfill_ran: false
deviations:
  - "greenfield: dep install + drizzle-migrate deferred into the build spawns since no package.json/app exists at B-0 entry"
```
