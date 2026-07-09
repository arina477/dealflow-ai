# Wave 38 — Build + Deploy + Verify (reconciliation)

> **Execution note.** Wave-38 was executed reactively during a prod-incident recovery (a
> compaction landed mid-wave while a broken deploy was in flight). The substantive work — root
> cause, fix, deploy, prod verification — was completed via specialist routing (deployment-engineer,
> Iron Law respected). This file reconciles the delivered work so V-block reviewers have concrete
> claims + evidence to verify against deployed state.

## Root cause (deployment-engineer)

Two chained defects:

1. **Ghost-Green journal drift.** `apps/api/src/db/migrations/meta/_journal.json` had 0019/0020/0021
   with `when` timestamps EARLIER than 0018. drizzle applies migrations in journal (`when`) order,
   so it treated 0019/0020/0021 as already-past and silently skipped them — the preDeploy reported
   success while applying nothing. This is why 0021 + `rate_limit_hits` never landed.

2. **Broken migrate-on-boot (introduced then removed this wave).** An initial fix added
   `runMigrationsOnBoot()` in `main.ts` pointing at `dist/db/migrations`. The nest/tsc build does
   NOT copy `.sql` + `meta/_journal.json` into `dist/`, so drizzle threw
   `Can't find meta/_journal.json file` → fail-loud → boot aborted → deploy `865f628e` FAILED.
   Railway correctly kept the prior SUCCESS deploy serving (no outage). This code path was then
   removed in favor of the configured Railway preDeploy command.

## Fix delivered

- **Commit `8b762bc`** — corrected `_journal.json` timestamps to ascending
  (0019=1784419200000, 0020=1784505600000, 0021=1784592000000, after 0018=1784332800000).
- **Commit `e79f944`** — removed `runMigrationsOnBoot()` from `apps/api/src/db/index.ts` + its
  import/call from `main.ts`. Migrations now apply solely via the Railway **preDeploy** command
  (`drizzle-kit migrate` against `src/db/migrations`, owner role, before the container starts).
  preDeploy fails the deploy on non-zero exit, preserving fail-loud safety without the runtime path.
- Local gate before redeploy: typecheck clean; api unit suite (1077) pass; `nest build` clean with
  no dangling `runMigrationsOnBoot` references.

## Deploy

- **Merge commit (HEAD of main):** `e79f944`
- **Deploy id:** `bd65486e-5964-4913-8a34-46e251ddffa0`  — status **SUCCESS**
- **Service:** dealflow-api (`dcdb4ab4-abc3-4983-ae73-43512ce2c7e6`), env `production`.
- **Health:** `GET https://dealflow-api-production-66d4.up.railway.app/health` → `200`
  `{"status":"ok","db":"ok"}`

## Prod verification (orchestrator, direct DB query as owner via public proxy)

Queried prod Postgres (`43bbb393…`) directly — evidence, not inference:

| Check | Result |
|---|---|
| `to_regclass('public.rate_limit_hits')` | `rate_limit_hits` (EXISTS) |
| `rate_limit_hits` row count | **1** (middleware actively writing — relation-missing error gone, positively) |
| `create_firm_workspace` signature | `create_firm_workspace(p_supertokens_user_id text, p_email text, p_firm_name text)` EXISTS |
| drizzle migrations table | 6 recent applied migrations recorded (incl. corrected 0019/0020/0021) |
| dealflow-api recent logs | no `relation "rate_limit_hits" does not exist`; clean startup |

Temporary proxy: none created (used existing `DATABASE_PUBLIC_URL`); nothing to tear down.

## Acceptance-criteria status

1. Root cause identified — ✅ (journal drift + dist-path migrate-on-boot).
2. Migrations reliably apply on deploy — ✅ (preDeploy, ordered journal).
3. `rate_limit_hits` + `create_firm_workspace` exist on prod — ✅ (direct query).
4. `RateLimitMiddleware` relation-missing error gone — ✅ (logs clean + table has rows).
5. Deploy SUCCESS + healthy — ✅ (bd65486e SUCCESS, health 200).
