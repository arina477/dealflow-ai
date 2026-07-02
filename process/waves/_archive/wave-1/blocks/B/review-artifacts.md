# Wave 1 — B-block review artifacts

**Block:** B (Build)
**Wave topic:** Project scaffold + walking skeleton + CI (M1 Foundation slice 1)
**Block exit gate:** B-6
**Status:** gate-passed

## Stage deliverables

| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| B-0 | process/waves/wave-1/stages/B-0-branch-and-schema.md | done | branch + task claim; schema authored as Drizzle code in-block |
| B-1 | (shared package src) | done | HealthResponse + parseEnv; 4/4 tests green |
| B-2 | (apps/api src) | done | Drizzle app_meta+migration; NestJS /health 200/503 |
| B-3 | (apps/web src) | done | Next 15 page fetch+validate /health |
| B-4 | process/waves/wave-1/stages/B-4-wiring.md | done | workspace typecheck+lint+build green |
| B-5 | process/waves/wave-1/stages/B-5-verify.md | done | all green; live 503 smoke; 2 boot defects fixed |
| B-6 | process/waves/wave-1/stages/B-6-review.md | gate-passed | head-builder APPROVED; /review PASS (no crit/high) |

## Block-specific context

- **Spec contract:** `tasks` row e83584db-6387-4567-916c-aacba5c5dede (DB); spec at process/waves/wave-1/stages/P-2-spec.md
- **Branch name:** wave-1-walking-skeleton
- **claimed_task_ids:** [e83584db-6387-4567-916c-aacba5c5dede]
- **New deps added this wave:** entire stack (turbo/pnpm workspace, @nestjs/*, next@15, react@19, drizzle-orm/drizzle-kit/pg, zod/@anatine/zod-nestjs, biome, vitest/supertest/RTL) — installed as scaffold materializes package.json
- **New env vars added this wave:** DATABASE_URL (+ TEST_DATABASE_URL for the integration test, distinct per _library R-17) — already in .env.example
- **Schema changes this wave:** app_meta(key text pk, value text) baseline + first Drizzle migration (authored in-block by postgres-pro under apps/api/src/db/ + apps/api/drizzle/)
- **B-1 fast-path approved:** false (B-1 authors real contracts — not a no-op)
- **Files implemented (cumulative):** root scaffold; packages/shared (health,env,index,tests); apps/api (db schema+migration+client, main, app.module, health module, tests, vitest.config); apps/web (layout, globals.css, page, page.test, vitest config); ci.yml test-DB step; .env.example (NEXT_PUBLIC_API_URL, TEST_DATABASE_URL)
- **Deviations from plan logged this block:** zod pinned v3 (@anatine peer); Tailwind v4 plugin; Node 24; migration dir src/db/migrations (architecture-canonical); consume shared via built dist (not source alias); removed unused ValidationPipe

## Open escalations carried into gate

- GitHub token invalid → surfaces at C-1 (not B). Playwright Chrome absent → T-5/T-6 (no UI features to E2E this wave).

## Gate verdict log

<appended by fresh head-builder spawn at B-6 Action 1>
