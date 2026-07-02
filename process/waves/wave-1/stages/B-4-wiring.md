# Wave 1 — B-4 Wiring
- Workspace-wide `pnpm -w typecheck`: 4/4 tasks green (api, web × build+typecheck graph).
- Workspace-wide `pnpm -w lint` (Biome via turbo): 3/3 green.
- Workspace-wide `pnpm -w build`: 3/3 green — @dealflow/shared (tsc→dist), @dealflow/api (nest build→dist), @dealflow/web (next build; `/` dynamic, health-fetch runtime-guarded).
- No B-2↔B-3 drift: web imports @dealflow/shared healthResponseSchema; api imports same; both typecheck against the one contract.
- Env wiring: DATABASE_URL (api), NEXT_PUBLIC_API_URL / INTERNAL_API_BASE_URL (web) present in .env.example.
