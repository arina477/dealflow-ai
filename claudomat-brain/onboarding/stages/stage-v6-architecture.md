# Stage v6 — Architecture: 8 Parallel Branches

## Purpose
Produce the reusability-first architecture spec across 8 domain branches, each authored in parallel by a specialist agent. Branches converge in v6b for cross-check and integration into the unified library doc.

## Prerequisites
- v5 complete (`command-center/dev/stack-decisions.md` exists).
- v3 complete (feature-list + tools-modules-map drive branch scope).
- v4 complete (page-map tells us what surfaces need architectural support).
- READ `claudomat-brain/rules/sub-agent-invocation.md`.
- READ `command-center/AGENTS.md` for the executor agent cards (backend-developer, frontend-developer, database-administrator, devops-engineer, security-engineer, architect-reviewer, test-automator).
- READ `command-center/product/founder-stage.md` — `stage:` value governs the Security branch scope modulator in step 4.

## Actions

### 1. Branch agent assignment — options-and-custom

Default branch → agent mapping:

| Branch | Default agent(s) | Output file |
|---|---|---|
| **Modules / Reusable elements** | `backend-developer` + `frontend-developer` (collab) | `command-center/dev/architecture/modules.md` |
| **Services** | `backend-developer` | `command-center/dev/architecture/services.md` |
| **Databases** | `database-administrator` (or `backend-developer` if absent) | `command-center/dev/architecture/databases.md` |
| **SDKs (third-party integrations)** | `backend-developer` | `command-center/dev/architecture/sdks.md` |
| **Tools (dev tooling, linting, build)** | `devops-engineer` | `command-center/dev/architecture/tools.md` |
| **Security** | `security-engineer` + `architect-reviewer` (pair) | `command-center/dev/architecture/security.md` |
| **DevOps (deploy, CI, envs, observability)** | `devops-engineer` | `command-center/dev/architecture/devops.md` |
| **Test** | `test-automator` (or `qa-expert`) | `command-center/dev/architecture/test.md` |

Verify each named agent exists in `command-center/AGENTS.md`. If any are missing, fire `AskUserQuestion`:

> "Branch agents: <N> of 8 default agents are missing from `command-center/AGENTS.md`: <list>. Pick how to proceed:"
>
> 1. **Auto-substitute** — use the closest available agent (suggested: <list>) and note the swap in `product-decisions.md`.
> 2. **Generate via agent-creator** — invoke `claudomat-brain/setup-tools/agent-creator/agent-creator.md` for each missing executor (slower; full Gemini-Deep-Research pipeline per agent).
> 3. **Single-agent fallback** — use `backend-developer` for all branches (fastest; weakest specialization).
> 4. **Custom** — tell me which agents to use per branch.

### 2. Spawn 8 branch-author agents in parallel

Spawn all 8 in parallel (batch by context-window capacity — typically 4 at a time, two batches). Use `Agent(subagent_type=<agent>)` per branch.

### 3. Per-branch inputs

Each agent receives:

- `command-center/dev/stack-decisions.md` (locked stack).
- `command-center/product/feature-list.md` + `tools-modules-map.md`.
- `command-center/artifacts/user-journey-map.md`.
- Live founder bets via `Bet — list live` recipe (`claudomat-brain/db/SCHEMA.md`).
- `command-center/product/founder-stage.md`.
- Prior architecture branches already written (if batch 2, batch 1 outputs are visible).

### 4. Per-branch output spec

Each `command-center/dev/architecture/<branch>.md` contains:

```markdown
# <Branch name> Architecture

## Summary
<One-paragraph overview of how this branch is organized>

## Inventory
<Enumerated list of units in this branch — modules, services, tables, SDKs, tools, etc.>

## Conventions
<How units in this branch are structured / named / composed>

## Reusability principles
<How modules expose themselves for reuse across the product>

## Cross-references
<Which other branches' units this branch consumes/produces>

## Stack-specific decisions
<Any stack-dependent choices — e.g., "Drizzle schema per module" for databases branch>

## Risk / open items
<Unknowns that v6b integration or future waves need to resolve>
```

### Branch-specific scope (condensed)

- **Modules** — list every reusable module (auth, billing, notifications, search, admin, etc.) with clear in/out contracts. Label MVP vs H2.
- **Services** — backend service boundaries + inter-service communication patterns + API versioning policy.
- **Databases** — schema boundaries + migration policy + data retention + backup strategy. **Local-dev seed data:** specify the seed entry-point file path matching the chosen stack (e.g., Drizzle `src/db/seed.ts`, Django `fixtures/dev.json`, Rails `db/seeds.rb`, FastAPI `scripts/init_db.py`, raw SQL `db/seed.sql`). If the project will need seeded users / fixture records to validate `pnpm dev` end-to-end before T-5 hits prod, the agent generates the seed-entry-point file *during* the relevant B-block stage based on personas (v3) + module list (v6b) + auth provider (security branch) — DO NOT pre-author the actual seed content here, just declare the entry-point convention. If the project needs no seed data (CLI-only / API-only / library), explicitly note `seed_data: not-required` with rationale.
- **SDKs** — each third-party SDK: auth mechanism, rate limits, error handling pattern, cost model, migration path if deprecated. Cross-references `claudomat-brain/rules/external-sdk-integration-rules.md`.
- **Tools** — language version, linting (Biome config), build system (Turborepo), package manager (pnpm), typecheck strictness, CI gates.
- **Security** — scope depends on `founder-stage.md`:
  - **MVP mode** (`self-use-mvp`, `pilot-customer`): auth flow end-to-end + session management + secrets handling + input validation + basic RBAC. Defer threat model (STRIDE), residency matrix, consent architecture, M2M least-privilege, audit-log schema to H2 milestone work.
  - **Full mode** (`paying-customers`, `regulated-day-1`): everything in MVP mode PLUS threat model (STRIDE), rate limiting, CSRF, M2M credentials, audit logging, cross-border data handling, consent architecture.
  - Branch file's Risk section MUST note which items were deferred and cite `founder-stage.md` value.
- **DevOps** — environment strategy (dev/staging/prod), CI workflow (GitHub Actions jobs with `timeout-minutes` + least-privilege `permissions`), deploy platforms, secret management, observability stack. Cross-references the platform-specific monitor templates in `claudomat-brain/monitors/`.
- **Test** — framework stack (per v5), test-writing conventions (co-location, AAA, mock policies), coverage targets per package, live E2E policy (per `command-center/testing/test-writing-principles.md`).

### 5. Module list snapshot

After the Modules branch completes (or concurrent with it), produce: `command-center/dev/module-list.md`:

```markdown
# Module List (v6 snapshot)

## MVP modules
- **<module-name>** — <one-line purpose>
- ...

## H2 modules
- ...

## H3 modules (planned)
- ...

Last updated: <timestamp>, source: v6 Modules branch
status: draft  # v6b promotes to `locked` after integration
```

This is the gate input for v8 Design System; v6b will lock it.

## Deliverable

- `command-center/dev/architecture/modules.md`
- `command-center/dev/architecture/services.md`
- `command-center/dev/architecture/databases.md`
- `command-center/dev/architecture/sdks.md`
- `command-center/dev/architecture/tools.md`
- `command-center/dev/architecture/security.md`
- `command-center/dev/architecture/devops.md`
- `command-center/dev/architecture/test.md`
- `command-center/dev/module-list.md` (status: draft)

## Exit criteria

- All 8 branch files exist and follow the per-branch output spec.
- `module-list.md` snapshot written with `status: draft`.
- No branch left with TODOs in its Summary — open items go in the Risk section.
- (If v5 chose override / custom) cascading-update list is honored: branches reflect the actual stack, not the baseline.

## Next

→ Return to `../onboarding-loop.md` → Stage v6b (architecture-integrate).
