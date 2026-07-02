# Stage v5 — Stack Selection: Baseline Default + Override Path

## Purpose
Make the single tech-stack decision that v6 architecture branches assume as a given. The stack is a **technical default** (always-on rule 17 in `CLAUDE.md`): when nothing in the project signals otherwise, claudomat applies the baseline **silently** and moves on — no founder poll. The override path runs only when v0 docs or an explicit founder request name a stack preference or constraint (mobile app, ML pipeline, Rails monolith, Python data tooling, "must be on Python", "we already have Postgres", etc.).

## Prerequisites
- v0–v4 complete (product shape is clear).
- READ `command-center/principles/BUILD-PRINCIPLES.md` (project-side baseline conventions; if empty scaffold, claudomat baseline below applies).

## Actions

### 1. The claudomat baseline

The default for typescript/react web apps:

```markdown
## Proposed stack (claudomat baseline)

**Monorepo:** Turborepo + pnpm
**Backend:** NestJS (Node.js + TypeScript strict)
**Frontend:** Next.js 15 (App Router, React 19) + Tailwind + shadcn/ui
**Shared contracts:** Zod schemas in `@<project>/shared`, bridged to NestJS DTOs via `@anatine/zod-nestjs`
**Database:** PostgreSQL (Railway-managed) + Drizzle ORM
**Realtime:** Socket.IO namespaces (if v3 feature-list requires)
**Auth:** SuperTokens (self-hosted on Railway — SuperTokens Core + Postgres via 1-click template; Node/Python/Go SDK; JWT + refresh tokens over Railway's private network)
**Payments:** Stripe (Checkout + Connect for marketplace payouts)
**Storage:** Railway Buckets (S3-compatible object storage, Tigris-backed)
**Hosting:** Railway — **bring-your-own** (the founder's own Railway account; nothing is pre-provisioned for the brain). API + Web + Postgres run there — Web as its own Railway service reaching the API over Railway's private network; PR preview environments via Railway. The Railway **credential is collected at deploy time** (C-2 Action 0), not at onboarding — when the brain first deploys with no token in hand it pauses and asks the founder to create their account and paste an API token, then provisions the project / database / public domain itself.
**CI/CD:** GitHub Actions (lint + typecheck + test + build, parallel jobs, `timeout-minutes` + `permissions: contents: read` on every job)
**Lint/format:** Biome (single tool — no ESLint + Prettier split)
**Testing:** Vitest (unit + integration) + Supertest (HTTP) + React Testing Library (components) + Playwright MCP (live E2E swarm)
**Secrets:** platform env vars only — never committed

**Not in the baseline — add later, only when the project actually needs it** (advanced / opt-in; don't scaffold up front, don't propose before a real need appears):
- **Redis** (cache / queues / rate-limit store) — add when real load or background-job volume requires it; default to Railway-managed Redis when you do.
- **Sentry** (or equivalent error tracking / observability) — add when you need production error visibility.
- **Resend** (or equivalent transactional email) — add when the product sends user-facing email.
```

### 2. Scan for an explicit stack signal

The stack is applied silently UNLESS the founder has already expressed a preference or constraint. Before deciding, scan for a signal across:

- **v0 docs** — `process/session/onboarding/docs-input/*.md` (verbatim founder input).
- **v1 vision / v3 scope** — the `founder_bets` rows and product-scope notes (e.g., "data pipeline", "iOS app", "internal CLI").
- **Explicit founder request** — anything the founder said in this session naming a language, framework, database, or host.

A signal is any of: a named technology ("Python/Django", "we already run Postgres", "deploy on AWS"), a project category that doesn't fit the default web baseline (ML pipeline, native mobile, CLI/library, data tooling), or a hard constraint (existing infra to reuse, compliance-driven hosting region). Record what you found in working memory — "no signal" is the common case.

### 3. Default path — no signal → apply baseline silently

If Action 2 found NO stack signal (the common case): do NOT poll. Write `command-center/dev/stack-decisions.md`:

```markdown
# Stack Decisions

## Selected: claudomat baseline (applied <YYYY-MM-DD>)

[baseline block from Action 1]

## Rationale
Applied as the default technical stack — no founder stack preference surfaced in v0 docs or requests. v6 architecture branches assume these choices. The founder can switch any piece later by saying so.
```

Then announce ONE plain-language line (per rule 16 — no stack jargon beyond the headline names), for example:

> "I've set the project up on our standard, well-supported stack (Railway + Postgres + Next.js). If you'd rather build on something specific, just say so and I'll switch."

This is an announcement, not a question — do NOT block. Proceed to Action 5, then v6.

### 4. Override path — signal present (or founder asks) → poll + resolve

Run this ONLY when Action 2 found a stack signal, or the founder explicitly asked to choose the stack. The founder has taste/constraint in play, so surface it via `AskUserQuestion` — options-and-custom, seeded by the signal you found (lead with the option that matches it):

> "Proposed stack above. Pick:"
>
> 1. **Accept baseline** — use as-is; proceed to architecture (v6).
> 2. **Partial override** — keep baseline but swap specific pieces; tell me which (e.g., 'Postgres → SQLite', 'Railway → AWS', 'SuperTokens → Clerk', 'Tailwind → Panda CSS').
> 3. **Full override (different category)** — this isn't the right shape for my project. Pick the category and I'll propose a fitted baseline:
>    - **Python data / ML pipeline**: FastAPI + Polars + DuckDB + Modal
>    - **Rails monolith**: Rails 8 + Hotwire + Postgres + Sidekiq
>    - **Native mobile**: Expo + React Native + TypeScript + Supabase
>    - **CLI / library**: Rust + Cargo + criterion benches
>    - **Other** — tell me the category and I'll research a fitted baseline.
> 4. **Custom** — describe your stack from scratch and I'll capture it; I'll cross-impact-check before locking.

Resolve per the chosen option:

**4a. Accept baseline** — write `command-center/dev/stack-decisions.md` as in Action 3 (note "founder-confirmed" in the rationale). Proceed.

**4b. Partial override** — for EACH override the founder provided:
- Record: what changed, from-what, to-what, rationale.
- Cross-impact check: does this override cascade? (e.g., Postgres → SQLite breaks Drizzle migration patterns; SuperTokens → a managed provider like Clerk drops the self-hosted Core service and rewires the v6 Security branch; Tailwind → Panda CSS requires v8 Design System token export to switch generators.)
- If cross-impact is material, fire a focused `AskUserQuestion` with options-and-custom (e.g., "SQLite means no Postgres-specific features — pick: Accept loss / Restore Postgres / Custom hybrid").

Write `stack-decisions.md` with the final resolved stack (baseline ± overrides + cascading update list).

**4c. Full override — fitted-baseline path** — pick the named alternative (or research a custom category). For non-listed categories, spawn research via `Agent(subagent_type=research-analyst)` + WebSearch. Agent surfaces: stack proposal + ecosystem maturity + LLM-tool support + DevOps story + cost estimate + cascading doc updates required. Founder confirms via `AskUserQuestion` (Approve / Refine / Reject / Custom). Write `stack-decisions.md` with the alternative stack + cascading-update action list.

**4d. Custom** — capture verbatim, restate as a concrete proposal, run cross-impact check (4b) and confirm via `Confirm / Refine / Cancel` before locking.

### 5. Log as product decision

Silent to the founder does NOT mean unrecorded — the default path logs the decision too. Append to `command-center/product/product-decisions.md`:

```markdown
### [<YYYY-QN>] Tech stack selected
**Category**: Architecture
**Status**: Active
**Context**: v5 onboarding stack selection.
**Decision**: <baseline (applied as default) | baseline (founder-confirmed) | partial-override | full-override | custom — summary>
**Rationale**: <no stack signal — applied default | founder preference / signal that triggered the override>
**Alternatives considered**: <baseline + alternatives the founder raised, if any>
**Cascading updates**: <files requiring edit at v6 / v6b / v8 — none on the default path>
```

## Deliverable

- `command-center/dev/stack-decisions.md` — locked stack (baseline default / founder override / custom).
- `command-center/product/product-decisions.md` — updated with the stack-selection entry (logged on every path, including the silent default).
- (Default path) one plain-language announcement line to the founder — not a question.

## Exit criteria

- Stack is locked; v6 branches know what to assume.
- Default path: baseline applied silently, announced in one line, and logged.
- Override path: founder's stack preference resolved; if override / custom, the cascading doc-update list is captured (updates happen in v6 / v6b, not here).

## Next

→ Return to `../onboarding-loop.md` → Stage v6 (architecture).
