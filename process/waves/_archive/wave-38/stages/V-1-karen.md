# V-1 Karen — Source-Claim Verification (wave-38, DealFlow AI)

**Scope:** Independently verify wave-38's load-bearing claims against the ACTUAL repo tree and DEPLOYED prod state. The reconciliation doc (`C-2-deploy-and-verify.md`) is treated as a set of CLAIMS to check, not as truth.

**Verdict: APPROVE**

All five claims confirmed TRUE against independent evidence. The load-bearing claim (migrations applied on prod via the fixed mechanism, not manually) is proven cryptographically — every migration file's SHA256 hash is recorded in prod's `__drizzle_migrations` table at the corrected journal timestamp. No dangling `runMigrationsOnBoot` references remain in shipped code. The deployment serving prod is the merge commit, confirmed via Railway GraphQL commitHash.

---

## Findings

### Claim 1 — Journal timestamps strictly ascending — CONFIRMED TRUE
Evidence: `apps/api/src/db/migrations/meta/_journal.json`
- L132-135 idx 18 `0018_outreach_activity` `when: 1784332800000`
- L138-142 idx 19 `0019_rate_limit_hits` `when: 1784419200000`
- L145-149 idx 20 `0020_retention_policy` `when: 1784505600000`
- L152-156 idx 21 `0021_self_serve_firm_bootstrap` `when: 1784592000000`

All four values strictly ascending, and each is greater than idx 17 (`1784246400000`). Matches the spec's expected values exactly. The drift described in the root cause is resolved.

### Claim 2 — migrate-on-boot removed — CONFIRMED TRUE
Evidence: repo-wide grep for `runMigrationsOnBoot`
- Zero hits in `apps/api/src/` (both `--include=*.ts` scoped and full-tree scans).
- Only occurrences are in the docs file `process/waves/wave-38/stages/C-2-deploy-and-verify.md:19,29,34` (describing the removal). No dangling references in shipped code.
- `apps/api/src/main.ts` has NO `runMigrationsOnBoot` import or call; its only migrate-related lines are comments (L34-38, 43, 46) documenting that migrations run via the Railway preDeploy command, plus the correct `assertNonSuperuserConnection` wiring.
- `apps/api/src/db/index.ts` exports only `pool`, `db`, `checkDbHealth`, `assertNonSuperuserConnection`, `assertUrlsDistinct` — no migration runner.
- `git show --stat e79f944` confirms the commit REMOVED 73 lines from `db/index.ts` and reworked `main.ts` (17 lines). Antipattern "dangling reference to removed function" — CLEARED.

### Claim 3 — Deploy serves the merge commit — CONFIRMED TRUE
Evidence: `git` + Railway GraphQL (host `backboard.railway.com/graphql/v2`, `Project-Access-Token` header)
- HEAD of `main` = `e79f944d2c1b19db65a42b5495c816062ef037db` (`git rev-parse HEAD`).
- Railway deployment `bd65486e-5964-4913-8a34-46e251ddffa0`: `status: SUCCESS`, `meta.commitHash: e79f944d2c1b19db65a42b5495c816062ef037db`, service dealflow-api, env production, `createdAt 2026-07-09T19:24:45Z`. It is the LATEST deployment on the service (deployments list: `bd65486e SUCCESS e79f944` > `865f628e FAILED 6442470` > `67eeb1f8 REMOVED`).
- The prior FAILED deploy `865f628e` carried commit `6442470` (the migrate-on-boot merge) — corroborating the reconciliation's account of the failed 865f628e deploy and Railway keeping the prior SUCCESS serving (no outage).
- preDeployCommand confirmed in deploy meta: `DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm --filter @dealflow/api exec drizzle-kit migrate` — the single source of truth for prod migrations, as claimed.
- Health `GET https://dealflow-api-production-66d4.up.railway.app/health` → HTTP 200, body `{"status":"ok","db":"ok","version":"a6ad02cb..."}`.

**Note (non-blocking discrepancy):** the health payload's `version` field reports `a6ad02cb2d613291da7b62f48df2a4d64b08aeef`, which is a wave-30 commit and an ANCESTOR of `e79f944` — NOT the deployed SHA. I confirmed via Railway GraphQL that the actual running deploy is `e79f944` (commitHash in deploy meta is authoritative; the running image digest is `sha256:0a88d75...` for the e79f944 build). The `version` string is therefore a stale build-time/hardcoded value in the app, not the true deployed commit. This does NOT contradict Claim 3 (Railway commitHash is ground truth), but the health endpoint's `version` field is misleading and should be wired to the real build SHA in a follow-up. Flagging so it is not later mistaken for a rollback.

### Claim 4 — Migration actually applied on prod (LOAD-BEARING) — CONFIRMED TRUE
Evidence: direct prod Postgres query (node `pg`, `ssl:false`, via `DATABASE_PUBLIC_URL` from the Postgres service `43bbb393…`)
- `to_regclass('public.rate_limit_hits')` → `rate_limit_hits` (table EXISTS).
- `create_firm_workspace` present in `pg_proc`: args `p_supertokens_user_id text, p_email text, p_firm_name text`, `prosecdef = true` (SECURITY DEFINER) — matches the 0021 SQL exactly.
- `drizzle.__drizzle_migrations` has 22 rows. The four most-recent recorded `(id, created_at)`:
  - id 22, `created_at 1784592000000`
  - id 21, `created_at 1784505600000`
  - id 20, `created_at 1784419200000`
  - id 19, `created_at 1784332800000`

  These `created_at` values equal the CORRECTED journal `when` values for 0018–0021 exactly.

**Mechanism proof (antipattern "claimed applied but actually manual" — CLEARED):** I did not stop at object existence. I cross-checked each recorded drizzle hash against the SHA256 of the actual migration SQL files on disk:
  - file `0018_outreach_activity.sql` sha `fd41f53e…` = drizzle id 19 hash
  - file `0019_rate_limit_hits.sql` sha `7a083b52…` = drizzle id 20 hash
  - file `0020_retention_policy.sql` sha `3885e3df…` = drizzle id 21 hash
  - file `0021_self_serve_firm_bootstrap.sql` sha `87a399c3…` = drizzle id 22 hash

  Every migration file's content hash is present in prod's migrations table at the corrected timestamp (drizzle `id` is a 1-based apply counter, off-by-one from the 0-based file index; `created_at` equals the file's journal `when`). This is cryptographic proof that drizzle-kit migrate applied the REAL 0019/0020/0021 SQL files from the fixed journal — the mechanism works, not merely that the objects happen to exist. The wave-37 manual application of 0021 has been superseded by a properly-journaled, hash-recorded apply.

### Claim 5 — Migration SQL files exist — CONFIRMED TRUE
Evidence: `apps/api/src/db/migrations/`
- `0019_rate_limit_hits.sql` (3504 bytes): `CREATE TABLE "rate_limit_hits"` at L51; grant to `dealflow_app` at L65.
- `0021_self_serve_firm_bootstrap.sql` (5364 bytes): `CREATE OR REPLACE FUNCTION create_firm_workspace(` at L55, `SECURITY DEFINER` at L62, `SET search_path = ''` documented at L23, `GRANT EXECUTE … TO dealflow_app` at L111. Companion `.down.sql` present.
- `0020_retention_policy.sql` and `0018_outreach_activity.sql` also present and journaled.

---

## Antipattern catalog sweep
- **"Applied but actually manual" (explicit watch):** CLEARED via hash cross-check above — drizzle records match real file content at corrected timestamps.
- **Dangling `runMigrationsOnBoot`:** CLEARED — zero refs in `apps/api/src/`.
- **Ghost-Green (green report / nothing applied):** CLEARED — the FAILED deploy `865f628e` is visible in the deploy history (fail-loud worked), and the SUCCESS deploy's migrations are hash-verified on prod.
- **Spec-vs-deployed drift:** deployed commitHash = HEAD of main = e79f944. Only drift found is the cosmetic health `version` string (flagged, non-blocking).
- **Health-check mirage:** health 200 + `db:ok` corroborated by an independent direct DB connection, not relied upon alone.

## Non-blocking follow-up (does not gate APPROVE)
1. Health endpoint `version` field reports a stale wave-30 SHA (`a6ad02cb`) instead of the deployed commit; wire it to the real build SHA so it cannot be misread as a rollback.
