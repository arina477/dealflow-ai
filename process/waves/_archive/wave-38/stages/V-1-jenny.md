# V-1 — jenny (semantic spec verification, wave-38 vs DEPLOYED prod)

**Task:** `7f4d150b` — FIX: prod migrations do not auto-apply on deploy (0021 + rate_limit_hits missing)
**Lens:** semantic — does deployed behavior satisfy the spec contract's INTENT (durability of the migrate mechanism), not just the two known-missing objects.

## VERDICT: APPROVE

The fix root-causes the actual mechanism failure (journal-timestamp drift + a broken dist-path migrate-on-boot) and restores durable auto-apply via the Railway preDeploy `drizzle-kit migrate` against the source migrations dir. The two missing objects exist on prod, the drizzle journal now records them as applied at corrected ascending timestamps, rate-limiting is off the in-process fallback, and the deploy is SUCCESS + healthy. The NEXT migration (0022+) will apply automatically — the mechanism, not a one-off, is fixed.

---

## Findings (each: criterion → deployed evidence)

### F1 — Criterion 1 (root cause, not blind-patched): SATISFIED
The fix names a concrete two-part mechanism failure, not a symptom workaround:
- **Journal drift:** `apps/api/src/db/migrations/meta/_journal.json` had 0019/0020/0021 with `when` values earlier than 0018, so `drizzle-kit migrate` treated them as already-past and silently skipped them. Verified fixed — journal is now **strictly ascending** across all 22 entries (0018=1784332800000 < 0019=1784419200000 < 0020=1784505600000 < 0021=1784592000000).
- **Broken migrate-on-boot:** the initial `runMigrationsOnBoot()` pointed at `dist/db/migrations`, which the nest/tsc build does not populate → `Can't find meta/_journal.json` → boot abort. Removed in `e79f944`; `grep runMigrationsOnBoot src/` returns NONE. `main.ts` documents migrations now run solely via preDeploy.

### F2 — Criterion 2 (DURABLE auto-apply going forward): SATISFIED — this is the core semantic check
This is where a "only patched the two objects" fix would REJECT. It does not — the mechanism is genuinely fixed:
- **preDeploy is configured on the ACTIVE deployment** (Railway service manifest, deploy `bd65486e`, api svc `dcdb4ab4`):
  `DATABASE_URL="$MIGRATE_DATABASE_URL" pnpm --filter @dealflow/api exec drizzle-kit migrate`
  Runs with the owner role, before the container serves; `restartPolicyType: ON_FAILURE` + preDeploy non-zero-exit fails the deploy → fail-loud preserved.
- **Source path is correct, not the broken dist path:** `apps/api/drizzle.config.ts` sets `out: './src/db/migrations'`. `drizzle-kit migrate` therefore reads the journal from the source tree (present in the deployed image), sidestepping the empty-`dist/` defect entirely.
- **Ordered journal + drizzle table agree:** prod `drizzle.__drizzle_migrations` has **22 rows** = 22 journal entries; the newest three `created_at` = 1784592000000 / 1784505600000 / 1784419200000, i.e. the CORRECTED ascending timestamps. That these landed in the drizzle table at the journal `when` values proves they were applied by `drizzle-kit migrate` (a manual psql apply would not populate the drizzle table with journal timestamps).
- **Conclusion:** the next migration 0022 will be generated with a `when` greater than 0021's and applied automatically on the next deploy. Durability intent met.

### F3 — Criterion 3 (the two objects exist on prod): SATISFIED (direct query)
- `to_regclass('public.rate_limit_hits')` → `rate_limit_hits` (EXISTS).
- `create_firm_workspace` signature → `(p_supertokens_user_id text, p_email text, p_firm_name text)` — matches the spec's `(text,text,text)`.

### F4 — Criterion 4 (RateLimitMiddleware no longer degraded): SATISFIED
- `rate_limit_hits` row count = **1** on prod → the middleware's Postgres-backed counter path (`rate-limit.middleware.ts` → `rateLimitHits` pgTable, INSERT…ON CONFLICT) is live and writing. A relation-missing error would force the in-process fallback and leave the table empty; the row is positive evidence the relation-missing error is gone.

### F5 — Criterion 5 (no self-inflicted outage; deploy SUCCESS + healthy): SATISFIED
- Active api deployment `bd65486e` status **SUCCESS**, commitHash `e79f944` (the fix commit) — authoritative per Railway deploy meta.
- `GET /health` → `200 {"status":"ok","db":"ok", ...}`.
- The one FAILED intermediate deploy (`865f628e`, the migrate-on-boot attempt) did not cause an outage — Railway kept the prior SUCCESS serving (correct fail-loud behavior).

---

## Spec-gap note (non-blocking) — delivered mechanism vs spec wording
The spec's Problem text attributes the failure to "the migrate mechanism in `main.ts`" and references `MIGRATE_DATABASE_URL` as if migrate-on-boot were the intended path. The delivered fix instead makes **preDeploy** the single source of truth and REMOVES the runtime migrate path. This is a **spec gap (spec wording slightly wrong), not spec drift (code wrong)** — and the delivered mechanism is strictly better: migrations run once per deploy with the owner role before traffic, rather than on every boot of every replica with runtime privileges. `MIGRATE_DATABASE_URL` is still the owner connection string, now consumed by preDeploy rather than by `main.ts`. No action required; recording so the spec's stale "on-boot" framing is not mistaken for a missing deliverable.

## Minor observation (non-blocking, no impact on verdict)
`GET /health` reports `version: a6ad02c…`, which does NOT equal the deployed commit `e79f944`. The authoritative Railway deploy meta (commitHash `e79f944`, imageDigest present, status SUCCESS) confirms the correct code is serving, so this is a health-endpoint version-string quirk (build-arg/stale VERSION source), not a wrong-artifact deploy. Flagging for hygiene only — the version field is not load-bearing for any wave-38 criterion.

---
**Evidence sources:** prod DB direct query via `DATABASE_PUBLIC_URL` (node pg, ssl:false); Railway GraphQL deployment meta (svc `dcdb4ab4`, deploy `bd65486e`); `apps/api/src/db/migrations/meta/_journal.json`; `apps/api/drizzle.config.ts`; `apps/api/src/main.ts`; `apps/api/src/db/index.ts`; `apps/api/src/modules/auth/rate-limit.middleware.ts`; `apps/api/src/db/schema/rate-limit-hits.ts`; `GET /health`.
