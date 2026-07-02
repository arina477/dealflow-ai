# V-1 Karen — Wave 1 (DealFlow AI walking skeleton) — Source-Claim Reality Check

**Verdict: APPROVE**
**Scope:** Load-bearing claims verified TRUE against the DEPLOYED state (not the diff). Source-claim verification only; spec-semantics is jenny's lane.
**Merge commit under review:** `4cad0179de58cc6fe6b11b36cb2e1496aedea4bf` (main, public).
**Method:** Every finding cross-checks a claim location against independent evidence — live HTTP probe, `git show`/`git grep` against the merge tree, or direct DB query.

---

## Findings (each: claim → evidence)

### F1 — File existence on the merge tree — CONFIRMED
- **Claim:** P-3-plan.md:33-48 enumerates root scaffold, packages/shared, apps/api (db/health/main/app.module/e2e), apps/web (layout/page/tests).
- **Evidence:** `git ls-tree -r 4cad0179` shows every claimed path present: root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `biome.json`; `packages/shared/src/{health.ts,env.ts,index.ts,health.test.ts}`; `apps/api/src/db/{schema.ts,index.ts}` + `apps/api/src/db/migrations/0000_small_xorn.sql` + meta/journal, `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/health/{module,controller,service,service.spec}.ts`, `apps/api/test/health.e2e-spec.ts`; `apps/web/app/{layout.tsx,page.tsx,globals.css,page.test.tsx}`.
- **Verdict:** TRUE. No claimed-but-missing files.

### F2 — Export existence (shared Zod + service/controller + env fn) — CONFIRMED
- **Claim:** P-2 spec contracts.types / P-3:37 — `@dealflow/shared` exports `HealthResponse` Zod + env parse fn.
- **Evidence:** `packages/shared/src/index.ts` exports `parseEnv` (value), `HealthResponse` (type), `healthResponseSchema` (value). `health.ts` defines the exact `z.object({status:enum[ok,degraded], db:enum[ok,down], version:string})` matching the spec contract verbatim. `env.ts` exports a real `parseEnv` doing `safeParse` with a fail-fast throw. `health.service.ts`/`health.controller.ts`/`health.module.ts` all export their classes; `HealthModule` wired into `AppModule.imports`.
- **Verdict:** TRUE. Not stubs — controller maps degraded→503 via `HttpException(SERVICE_UNAVAILABLE)`.

### F3 — Route registration + live 200 — CONFIRMED (deployed-state probe)
- **Claim:** P-3:9,21 — `GET /health` registered, returns `200 {status,db,version}`.
- **Evidence:** Live probe `GET https://dealflow-api-production-66d4.up.railway.app/health` → **HTTP 200**, body `{"status":"ok","db":"ok","version":"4cad0179de58cc6fe6b11b36cb2e1496aedea4bf"}`. Route source confirmed: `@Controller('health') @Get()` in health.controller.ts.
- **Verdict:** TRUE. Real HTTP round-trip against the deployed container, not inferred from tests.

### F4 — Migration applied in the deployed DB — CONFIRMED (with evidence-chain caveat noted)
- **Claim:** C-2:44-48,91 — migration `0000_small_xorn.sql` (`CREATE TABLE app_meta`) applied via api `preDeployCommand` (`drizzle-kit migrate`) before traffic; `migration_applied: true`.
- **Evidence:** Live `/health` returns `db:ok`. Source (`db/index.ts checkDbHealth`) proves `db:ok` = a successful `SELECT 1` round-trip against the deployed app's Postgres → the app's DB is reachable and the connection string is wired. Migration file is present and additive-only (`CREATE TABLE`, no DROP/ALTER). C-2 records the `preDeployCommand` as `drizzle-kit migrate` run one-shot before traffic; deploy status SUCCESS for all three services.
- **Caveat (documented, not blocking):** `SELECT 1` does NOT itself touch `app_meta`, so `db:ok` proves *connectivity*, not that `app_meta` exists. I could not independently query the *deployed app's* DB: `CLAUDOMAT_DB_URL` resolves to the **claudomat control-plane DB** (tables `founder_bets/milestones/tasks/waves/users/sessions/...`, host `railway`), NOT DealFlow's app Postgres — so `SELECT to_regclass('public.app_meta')` correctly returned null there (wrong database, expected). The migration-applied claim rests on: (a) deploy SUCCESS with the preDeploy migrate step, (b) additive-only DDL, (c) `db:ok`. That chain is credible and consistent; the prompt itself directs treating `db:ok` as the migration-applied proxy. Flagged so T-block/jenny can add a positive `app_meta` assertion against the app DB if they hold app-DB credentials.
- **Verdict:** TRUE within available evidence. Not done-theater — the migration file, deploy config, and live db:ok are mutually consistent.

### F5 — Deploy-hash match (deployed == merge commit) — CONFIRMED
- **Claim:** C-2:21-25,89-90 — both app services' `commitHash` == merge commit; `/health version` == `4cad0179…`.
- **Evidence:** Live `/health` `version` field = `4cad0179de58cc6fe6b11b36cb2e1496aedea4bf` — byte-for-byte the merge commit. Source: `health.service.ts` reads `process.env.GIT_SHA`; C-2 sets `GIT_SHA=4cad0179…` on the api service. No Ghost Green: the version served is the exact reviewed SHA, not `dev` (the fallback) or a stale hash.
- **Verdict:** TRUE.

### F6 — Env vars wired (DATABASE_URL, NEXT_PUBLIC_API_URL) — CONFIRMED
- **Claim:** C-2:33,41 — `DATABASE_URL=${{postgres.DATABASE_URL}}` on api; `NEXT_PUBLIC_API_URL` baked into web at build.
- **Evidence:** DATABASE_URL wiring proven live by `db:ok` (the app performed a real query, so the conn string is present and valid — value not leaked). NEXT_PUBLIC_API_URL: live web root renders the health card with **Status ok / API ok / Database ok / Version 4cad0179…** — the web server-component fetched the api `/health` end-to-end, which is only possible if the api base URL is baked in. Source `page.tsx` reads `process.env.NEXT_PUBLIC_API_URL`.
- **Verdict:** TRUE. End-to-end web→api wiring live.

### F7 — Cross-app shared-contract consumption — CONFIRMED (this is the load-bearing skeleton claim)
- **Claim:** P-2 AC#11 / P-3:37 — `@dealflow/shared` Zod imported by BOTH apps.
- **Evidence:** `git grep @dealflow/shared 4cad0179`: **apps/api** imports it in `db/index.ts`, `health.controller.ts`, `health.service.ts`, `main.ts`, `health.service.spec.ts`, `test/health.e2e-spec.ts`; **apps/web** imports `HealthResponse` + `healthResponseSchema` in `app/page.tsx` (and `transpilePackages:['@dealflow/shared']` in next.config.ts). Both `package.json` declare `"@dealflow/shared":"workspace:*"`.
- **Verdict:** TRUE. The shared-contract wiring — the entire point of the skeleton — is real and bidirectional.

### F8 — Antipattern catalog (decorative tests / claimed-but-fake / silent drift) — CLEAN
- **Decorative tests?** NO. `health.service.spec.ts` asserts both branches (ok/degraded), the GIT_SHA-absent `dev` fallback, and schema-validates results — real assertions, not `expect(true).toBe(true)`. `health.test.ts` includes negative cases (rejects bad status, rejects missing version). Substantive.
- **Claimed-but-fake greens?** NO. C-1 provenance: CI run `28595065716` tested SHA `feeb7ad…` == PR#1 head; squash produced merge commit `4cad0179…` (normal squash provenance, not a mismatch). Five required checks green (audit/lint/typecheck/test/build), audit fix (multer `>=2.2.0`) verified present on merged main.
- **Logged deviations real + documented?** YES — all 5 are documented in review-artifacts.md:30, not silent:
  1. **zod v3 pin** (@anatine peer dep) — documented.
  2. **Tailwind v4 plugin** — documented.
  3. **Node 24** — documented; matches Railpack auto-detect (C-2:35).
  4. **Migration dir `src/db/migrations`** (vs plan's `apps/api/drizzle/`) — documented as "architecture-canonical". NOTE: B-0.md:14 and P-3:17,34 still reference the old `apps/api/drizzle/0000_init.sql` path; the shipped file is `src/db/migrations/0000_small_xorn.sql`. This is a stale-doc-reference cosmetic inconsistency, NOT drift — the deviation is logged and the actual file exists and is applied.
  5. **Consume shared via built dist** (not source alias) at runtime — documented. Minor observation: vitest configs (`apps/api/vitest.config.ts`, `apps/web/vitest.config.ts`) alias `@dealflow/shared` → `packages/shared/src/index.ts` (source), so tests resolve source while runtime resolves dist. Legitimate + common; noted for completeness, not a defect.
- **Deferred-but-undocumented work?** NO. `packages/db` deferral to M2 is explicitly recorded (P-3:73); compliance/audit-log correctly scoped OUT (P-2 notes); canary skip justified (0 DAU). All deferrals documented.

---

## Summary
Every load-bearing wave-1 claim is TRUE in the deployed state. The skeleton actually works end-to-end: live api `/health` 200 with `db:ok` + exact merge-SHA version; live web renders that health card via a real cross-service fetch; the shared Zod contract is genuinely consumed by both apps; CI provenance is clean; deploy hash matches; all deviations are documented, not silent drift. Tests are substantive, not decorative.

**One non-blocking follow-up for T-block/jenny:** add a positive assertion that `app_meta` exists in the *deployed app* DB (Karen could not reach it — `CLAUDOMAT_DB_URL` is the control-plane DB, not DealFlow's). Current migration-applied evidence is a credible chain (deploy SUCCESS + preDeploy migrate + additive DDL + live db:ok) but is indirect on the specific table's existence.

**Verdict: APPROVE** — no Critical/High findings. One Low documentation inconsistency (stale migration-path references in P-3/B-0) and one Low evidence-chain caveat (indirect app_meta proof), neither blocking.
