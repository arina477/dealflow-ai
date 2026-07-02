# Wave 1 — B-5 Verify

- **typecheck** (`pnpm -w typecheck`): exit 0 (api + web).
- **lint** (`pnpm -w lint`, Biome): exit 0 (3/3).
- **build** (`pnpm -w build`): exit 0 — shared→dist, api→dist/main.js (flat), web (next build).
- **unit/component tests** (`pnpm -w test`): shared 4/4, api 4/4 (+1 e2e skipped locally), web 6/6. exit 0.
- **dev-server smoke (live):** booted apps/api/dist/main.js with an unreachable DATABASE_URL → `GET /health` returned **HTTP 503 {status:"degraded",db:"down",version:"smoke"}** — verifies AC#4 (never 200 on DB failure) + boot + HealthResponse shape live.
- **200 path + migration apply:** covered by the api e2e integration test (Supertest + real Postgres) which SKIPS locally (no Postgres server in this sandbox — client-only, no Docker) and RUNS in CI's postgres:18 service + against Railway. Not a permanent gap.

## Defects found + fixed at B-5 (routed to backend-developer per Iron Law)
1. Global class-validator ValidationPipe crashed boot (class-validator not installed; API is Zod-based) → removed the unused pipe.
2. Nested dist entry (dist/apps/api/src/main.js) from rootDir removal → consume @dealflow/shared from built dist + restore rootDir → flat dist/main.js.
3. Pool hung on unreachable DB → connectionTimeoutMillis=3000 (fast-fail 503).

## Infra gates (documented, not code defects)
- Local sandbox has no Postgres server (client-only) + no Docker → real-DB integration test + migration-apply run in CI / Railway, not here.
- GitHub token invalid → C-1 PR/CI hard-stop (next block).
