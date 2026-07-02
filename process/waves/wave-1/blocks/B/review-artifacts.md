# Wave 1 — B-block review artifacts

**Block:** B (Build)
**Wave topic:** Project scaffold + walking skeleton + CI (M1 Foundation slice 1)
**Block exit gate:** B-6
**Status:** in-progress

## Stage deliverables

| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| B-0 | process/waves/wave-1/stages/B-0-branch-and-schema.md | done | branch + task claim; schema authored as Drizzle code in-block |
| B-1 | process/waves/wave-1/stages/B-1-contracts.md | pending | @dealflow/shared HealthResponse + env Zod |
| B-2 | process/waves/wave-1/stages/B-2-backend.md | pending | NestJS API + /health module |
| B-3 | process/waves/wave-1/stages/B-3-frontend.md | pending | Next.js 15 placeholder + health surface |
| B-4 | process/waves/wave-1/stages/B-4-wiring.md | pending | e2e typecheck + env wiring |
| B-5 | process/waves/wave-1/stages/B-5-verify.md | pending | typecheck+lint+test+dev smoke; migrate vs real Postgres |
| B-6 | process/waves/wave-1/stages/B-6-review.md | pending | head-builder gate + /review |

## Block-specific context

- **Spec contract:** `tasks` row e83584db-6387-4567-916c-aacba5c5dede (DB); spec at process/waves/wave-1/stages/P-2-spec.md
- **Branch name:** wave-1-walking-skeleton
- **claimed_task_ids:** [e83584db-6387-4567-916c-aacba5c5dede]
- **New deps added this wave:** entire stack (turbo/pnpm workspace, @nestjs/*, next@15, react@19, drizzle-orm/drizzle-kit/pg, zod/@anatine/zod-nestjs, biome, vitest/supertest/RTL) — installed as scaffold materializes package.json
- **New env vars added this wave:** DATABASE_URL (+ TEST_DATABASE_URL for the integration test, distinct per _library R-17) — already in .env.example
- **Schema changes this wave:** app_meta(key text pk, value text) baseline + first Drizzle migration (authored in-block by postgres-pro under apps/api/src/db/ + apps/api/drizzle/)
- **B-1 fast-path approved:** false (B-1 authors real contracts — not a no-op)
- **Files implemented (cumulative):** <updated at B-2, B-3, B-4>
- **Deviations from plan logged this block:** none yet

## Open escalations carried into gate

- GitHub token invalid → surfaces at C-1 (not B). Playwright Chrome absent → T-5/T-6 (no UI features to E2E this wave).

## Gate verdict log

<appended by fresh head-builder spawn at B-6 Action 1>
