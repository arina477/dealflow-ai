# Wave 1 — P-3 Plan

## Approach section

### Architecture deltas (net-new — greenfield)
- **Monorepo topology (NEW).** Turborepo + pnpm workspace: `apps/api` (NestJS), `apps/web` (Next.js 15), `packages/shared` (Zod contracts). Root `turbo.json` task graph (lint/typecheck/test/build), `pnpm-workspace.yaml`, shared `tsconfig.base.json`, `biome.json`.
  - *Alternative considered:* Nx (heavier, opinionated generators) — rejected for Turborepo's lighter footprint per stack-decisions.md; single-package (rejected — the product needs shared Zod contracts across api/web).
  - *Failure-domain:* none yet (single service each; no cross-service transactions).
- **API health module (NEW).** NestJS `HealthModule` exposing `GET /health` doing a real Drizzle `SELECT 1` round-trip; returns the shared `HealthResponse`.
  - *Alternative:* `@nestjs/terminus` — deferred (adds a dep for a one-endpoint skeleton; a hand-rolled 20-line check suffices now, revisit when more health indicators appear).
- **DB layer (NEW).** Drizzle client + `schema.ts` baseline + first migration. Health check via `SELECT 1`; a minimal `app_meta(key text pk, value text)` table exercises the migration+query path.
  - *Migration strategy:* offline, additive; idempotent re-run (drizzle-kit tracks applied migrations). No backfill.
- **Web (NEW).** Next.js 15 App Router; placeholder landing page that fetches `/health` and shows ok/degraded. Tailwind + the design tokens (not the full AppShell — that's a later M1 bundle).
- **Env validation (NEW).** Zod-validated env at boot in both apps (fail-fast on missing `DATABASE_URL` etc.).

### Data model
- `app_meta(key text primary key, value text)` — trivial baseline table (proves migrate + query). First Drizzle migration under `apps/api/drizzle/`.
- No indexes/FKs/constraints beyond the PK this wave. (Real domain tables — mandates, audit_log_entries, etc. — are M2+ waves.)

### API contracts (concrete)
- `GET /health` — no auth. Success `200 { status:"ok", db:"ok", version:string }`. DB-down `503 { status:"degraded", db:"down", version:string }`. Schema = `@dealflow/shared` `HealthResponse`.

### New deps (version-pinned at B-time to latest stable; rationale)
- `turbo`, `pnpm` (monorepo) · `@nestjs/*` + `reflect-metadata` + `rxjs` (API) · `next@15` + `react@19` (web) · `drizzle-orm` + `drizzle-kit` + `pg` (DB) · `zod` + `@anatine/zod-nestjs` (contracts) · `@biomejs/biome` (lint/format) · `vitest` + `supertest` + `@testing-library/react` (test). All per stack-decisions.md; licenses MIT/Apache-2.0 compatible. No new SDKs → external-sdk-integration-rules.md N/A this wave.

## Plan section

### File-level steps (grouped by B-stage)

**B-0 Branch & schema setup / B-1 Schema**
| Path | Op | Change | Specialist | Order |
|---|---|---|---|---|
| root: package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, biome.json | create | monorepo scaffold + task graph + lint/TS config | devops-engineer | first (blocks all) |
| apps/api/src/db/schema.ts, apps/api/src/db/index.ts, apps/api/drizzle.config.ts, apps/api/drizzle/0000_init.sql | create | Drizzle client + baseline schema (app_meta) + first migration | postgres-pro | after root |

**B-2 Contracts**
| packages/shared/{package.json,tsconfig.json,src/index.ts,src/health.ts} | create | @dealflow/shared: HealthResponse Zod + env schema | typescript-pro | after root; parallel with B-1 |

**B-3 Backend (NestJS API)**
| apps/api/{package.json,tsconfig.json,nest-cli.json,src/main.ts,src/app.module.ts} | create | NestJS bootstrap + Zod env validation (fail-fast) | backend-developer | after B-1+B-2 |
| apps/api/src/health/{health.module.ts,health.controller.ts,health.service.ts} | create | GET /health → SELECT 1 → HealthResponse (200/503) | backend-developer | after app.module |

**B-4 Frontend (Next.js web)**
| apps/web/{package.json,tsconfig.json,next.config.ts,tailwind config,app/layout.tsx,app/page.tsx,app/globals.css} | create | Next 15 App Router placeholder page fetching /health | nextjs-developer | after B-2 (imports shared); parallel with B-3 |

**B-5 Wiring**
| root .env.example (exists — reconcile), README quickstart, turbo pipeline env passthrough, health integration test wiring | modify/create | env passthrough, DATABASE_URL wiring, test scripts | devops-engineer + orchestrator | after B-3+B-4 |
| apps/api/test/health.e2e-spec.ts (Supertest+real Postgres), packages/shared unit test, apps/web health component test | create | tests for AC #3,#4,#10,#11 | test-automator | B-5 (after backend/web) |

### Specialist routing (validated against command-center/AGENTS.md)
devops-engineer ✓ · postgres-pro ✓ · typescript-pro ✓ · backend-developer ✓ · nextjs-developer ✓ · test-automator ✓ — all present in the catalog.

### Parallelization map
- Serial: root scaffold (devops-engineer) → everything else.
- Parallel batch A (after root): B-1 Drizzle (postgres-pro) ‖ B-2 shared (typescript-pro).
- Parallel batch B (after A): B-3 API (backend-developer) ‖ B-4 web (nextjs-developer).
- Serial tail: B-5 wiring + tests (devops-engineer / test-automator) after B-3+B-4.
- No file appears in two parallel batches.

### Self-consistency sweep
1. Every P-2 AC maps to ≥1 step: install/dev→root scaffold; /health 200/503→B-3 health module; web health→B-4; lint/typecheck/build→root config+B-5; db:migrate→B-1; test→B-5 tests; shared Zod→B-2; CI-green→existing ci.yml (C-block, credential-gated); Railway deploy→C-2 (credential-gated). ✓
2. Every step has a specialist. ✓
3. No file in multiple parallel batches. ✓
4. design_gap_flag: false (referenced). ✓
5. Architecture deltas carry explicit alternative trade-offs (Turborepo vs Nx; hand-rolled health vs terminus). ✓
6. Data + API contracts concrete (app_meta DDL; /health 200/503 shapes) — no TBD. ✓
7. New deps justified + license-checked. ✓
8. No new external SDK → pre-build checklist N/A. ✓

---

## Phase-2 review notes (address in B-block — non-blocking, from karen/jenny)
- **packages/db deferral (explicit):** for this skeleton the Drizzle schema/migration live under `apps/api/src/db/` + `apps/api/drizzle/`; the architected `packages/db` (`@dealflow/db`) home is DEFERRED to the M2 DB wave (when `test-seed.ts` + audit-log migration land). This is a recorded decision, not drift.
- **/health version = git SHA:** B-3 sources `version` from the build-time git SHA (env-injected), per _library §8, not an arbitrary string.
- **TEST_DATABASE_URL:** B-5 wires the integration test to a distinct `TEST_DATABASE_URL` that must never equal `DATABASE_URL` (_library R-17).
- **workspace_id "from day one":** applies to DOMAIN tables (M2+), NOT the skeleton's `app_meta` infra table — no action this wave.
