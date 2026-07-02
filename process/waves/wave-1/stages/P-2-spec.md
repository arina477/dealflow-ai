# Wave 1 — P-2 Spec (pointer)

**Source of truth:** the spec contract lives in `tasks.description` of the primary task
`e83584db-6387-4567-916c-aacba5c5dede` (YAML head + `---` + prose). This file is a convenience copy.

- **wave_type:** single-spec
- **claimed_task_ids:** [e83584db-6387-4567-916c-aacba5c5dede] (seed only; no siblings)
- **design_gap_flag:** false

## Acceptance criteria (copy)
1. `pnpm install --frozen-lockfile` clean on fresh checkout.
2. `pnpm dev` starts API + web without crashing.
3. GET /health → 200 {status:ok, db:ok, version} when Postgres reachable.
4. GET /health → 503 {status:degraded, db:down} when Postgres unreachable (never 200 on DB failure).
5. Web renders a placeholder landing page + surfaces API health.
6. `pnpm lint` (Biome) exits 0.
7. `pnpm typecheck` (tsc strict) exits 0 across packages.
8. `pnpm build` (turbo) exits 0 for api + web + shared.
9. `pnpm db:migrate` applies the first migration cleanly to a fresh DB (idempotent on re-run).
10. `pnpm test` passes a /health integration test against REAL Postgres (not mocked).
11. @dealflow/shared exports the HealthResponse Zod schema, imported by BOTH apps.
12. CI green on main (credential-gated on GitHub token; C-block routes token gap as infra-readiness hard-stop).
13. Deployed to Railway dev with reachable /health (credential-gated at C-2; sequenced independently).

Full contracts + edge cases: see the task row's YAML head.
