# Tools Architecture

## Summary

DealFlow AI uses a pnpm-managed Turborepo monorepo with TypeScript strict mode throughout. Biome replaces ESLint + Prettier as a single-binary lint/format tool. Vitest covers unit and integration testing for all packages. Turborepo's task graph provides incremental, cached builds across apps and packages. GitHub Actions enforces lint, typecheck, test, and build gates on every PR and push to main.

---

## Inventory

### Language

- **TypeScript** — strict mode (`"strict": true`) across all packages and apps. Minimum TypeScript version: 5.4.
- **Node.js** — LTS (v22.x). Pinned in `.nvmrc` and `engines` field in root `package.json`. Railway build environment matches via `NIXPACKS_NODE_VERSION`.

### Package manager

- **pnpm** — version pinned in `packageManager` field (`pnpm@9.x`). Workspace layout declared in `pnpm-workspace.yaml`:
  ```
  packages:
    - 'apps/*'
    - 'packages/*'
  ```
- Lockfile (`pnpm-lock.yaml`) committed and used for all CI installs (`pnpm install --frozen-lockfile`).

### Build — Turborepo

- **Turborepo** (`turbo@^2`) orchestrates the task graph across workspaces.
- Pipeline tasks defined in `turbo.json`:
  - `build` — depends on upstream `^build`; outputs `dist/**`, `.next/**`
  - `lint` — no upstream dependency; outputs none (cache on source hash)
  - `typecheck` — no upstream dependency; outputs none
  - `test` — no upstream dependency; outputs `coverage/**`
- Remote caching: Vercel Remote Cache (or self-hosted Turborepo server) optional for CI speedup; local cache always on.
- Each app/package declares its own `turbo.json` overrides only when task shape differs from root.

### Lint / format — Biome

- **Biome** single tool (`@biomejs/biome@^1`) replaces ESLint + Prettier.
- One config file at repo root: `biome.json`. Apps and packages inherit root config; overrides via `extends` only where justified.
- Enforced checks: lint rules (recommended set + import ordering), formatter (2-space indent, single quotes, trailing commas ES5).
- CI runs `biome check --apply-unsafe` in check-only mode (`--no-errors-on-unmatched`); any violation fails the lint gate.
- Pre-commit: `biome check` via a local lint-staged hook (optional developer convenience, not CI-enforced separately).

### TypeScript strictness

`tsconfig.base.json` at repo root enables:

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "forceConsistentCasingInFileNames": true,
  "isolatedModules": true
}
```

Each app and package extends `@dealflow/config/tsconfig.base.json`. No app or package may downgrade `strict` or disable the above flags.

### Test runner — Vitest

- **Vitest** (`vitest@^2`) for unit and integration tests across all packages and the NestJS backend.
- React Testing Library (`@testing-library/react`) for frontend component tests inside `apps/web`.
- Supertest for NestJS HTTP integration tests inside `apps/api`.
- Coverage via `@vitest/coverage-v8`; threshold enforced in `vitest.config.ts` (`branches: 70, lines: 80`).
- Test files: `**/*.test.ts`, `**/*.spec.ts`, `**/*.test.tsx`.
- Playwright MCP handles live E2E swarm tests (separate from Vitest; not part of the unit/integration gate).

### CI gates (GitHub Actions)

All gates run in parallel jobs on every PR and `push` to `main`:

| Job | Command | Fail condition |
|---|---|---|
| lint | `pnpm turbo lint` | Any Biome lint or format error |
| typecheck | `pnpm turbo typecheck` | Any TypeScript error |
| test | `pnpm turbo test -- --coverage` | Any test failure or coverage below threshold |
| build | `pnpm turbo build` | Any compilation or build error |

- `timeout-minutes: 15` on each job.
- `permissions: contents: read` minimum; no write permissions except the deploy job.
- `pnpm install --frozen-lockfile` on every run; no lockfile mutation in CI.

---

## Conventions

### Monorepo package layout

```
apps/
  web/          ← Next.js 15 App Router frontend
  api/          ← NestJS backend
packages/
  shared/       ← @dealflow/shared: Zod schemas, shared types, DTOs
  ui/           ← @dealflow/ui: shadcn/ui component library (shared React components)
  config/       ← @dealflow/config: tsconfig.base.json, vitest.config.base.ts, biome.json re-export
```

- Each package has its own `package.json` with `name`, `version`, `exports`, and `types` fields.
- Internal imports use the package name (e.g. `import { DealSchema } from '@dealflow/shared'`), resolved via pnpm workspace protocol (`"@dealflow/shared": "workspace:*"`).
- No cross-app imports. `apps/web` and `apps/api` import only from `packages/*`, never from each other.

### Biome configuration (`biome.json`)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.x/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5"
    }
  }
}
```

Extends pattern for per-package overrides:
```json
{ "extends": ["../../biome.json"] }
```

### tsconfig strict settings

All packages extend `packages/config/tsconfig.base.json`. App-level `tsconfig.json` adds only `paths`, `baseUrl`, and framework-specific options (e.g. `jsx: "preserve"` for Next.js). Loosening any strict flag requires a recorded stack decision in `stack-decisions.md`.

### Turborepo caching

- `outputs` for `build` tasks include `dist/**` and framework-specific build artifacts (`.next/**` for web, `dist/**` for api).
- `inputs` default to all source files; `package.json` and `tsconfig.json` changes invalidate cache.
- Cache is stored locally in `.turbo/` (gitignored) and optionally in remote cache for CI.

---

## Reusability principles

### `@dealflow/shared`

- Single source of truth for all cross-boundary data shapes: Zod schemas define request/response contracts, entity shapes, and enum values.
- NestJS uses `@anatine/zod-nestjs` to bridge Zod schemas to class-validator DTOs — no duplicate schema authoring.
- Next.js uses the same Zod schemas for client-side form validation (React Hook Form + Zod resolver).
- Any shape used by more than one app lives here, not in the app.

### `@dealflow/ui`

- shadcn/ui component library extracted into a shared package so both `apps/web` and any future app consume the same component tree.
- Components are unstyled primitives + Tailwind composition; no app-specific logic.
- Storybook (optional, deferred) can be added here without touching app code.

### `@dealflow/config`

- Shared tooling configuration: `tsconfig.base.json`, `vitest.config.base.ts`, and a Biome config re-export.
- Keeps tooling version pinned in one place; all packages bump together via this package.

---

## Cross-references

- **DevOps / CI** (`devops.md`) — consumes these gates as required checks on Railway deploy and GitHub Actions PR workflows. The four gate jobs (lint, typecheck, test, build) must pass before any deploy job runs.
- **Services / modules** (`modules.md`) — `apps/api` and `apps/web` both consume `@dealflow/shared` schemas; module boundary design relies on the shared package layout described here.
- **Security** (`security.md`) — CI pipeline adds a fifth gate (dependency audit via `pnpm audit --audit-level=high`) alongside the four gates above.
- **Databases** (`databases.md`) — Drizzle ORM schema types are generated into `packages/shared` so both the API and any CLI/migration tooling share the same type-safe table definitions.

---

## Stack-specific decisions

| Decision | Choice | Rationale |
|---|---|---|
| Single lint+format tool | Biome over ESLint + Prettier | Eliminates config conflicts between formatter and linter; single binary is faster in CI; no plugin ecosystem fragmentation for a greenfield project |
| pnpm over npm/yarn | pnpm | Strict hoisting prevents phantom dependency bugs; workspace protocol is first-class; faster installs with content-addressable store |
| Turborepo over Nx | Turborepo | Lower config surface; Vercel remote cache integration; sufficient for a two-app monorepo without custom executors |
| `noUncheckedIndexedAccess` | Enabled | Array/map access returns `T \| undefined`; prevents the most common class of runtime null errors in data-heavy apps |
| `isolatedModules` | Enabled | Required for esbuild/SWC compatibility; catches re-export-type patterns early |
| Vitest over Jest | Vitest | Native ESM support; no Babel transform needed; compatible with NestJS and Next.js without separate transform configs |
| Coverage via v8 | `@vitest/coverage-v8` over Istanbul | Node-native; no instrumentation overhead; accurate branch coverage |

---

## Risk / open items

| Item | Risk level | Notes |
|---|---|---|
| `@anatine/zod-nestjs` maintenance | Medium | Package is community-maintained; if it falls behind NestJS major versions, the bridge may need to be replaced with a manual `ZodValidationPipe`. Monitor at each NestJS major bump. |
| Turborepo remote cache setup | Low | Local cache is sufficient for a small team; remote cache is a speedup, not a correctness requirement. Defer until CI time exceeds 10 min. |
| Biome rule coverage gaps | Low | Biome's rule set is still smaller than ESLint's ecosystem. Known gap: complex accessibility rules (`jsx-a11y` equivalents). Revisit if a11y audit surfaces issues. |
| pnpm hoisting and NestJS DI | Low | NestJS DI relies on reflect-metadata; ensure `shamefully-hoist=false` (pnpm default) does not break decorator metadata by pinning `reflect-metadata` in the api package directly. |
| Node version drift between local and CI | Low | Pin Node version in both `.nvmrc` and GitHub Actions `node-version` matrix to prevent silent behavior differences. |
| Coverage threshold enforcement | Medium | 70/80 thresholds are starting points; raise to 80/90 once test suite matures past v2. Track in `stack-decisions.md` when raised. |
