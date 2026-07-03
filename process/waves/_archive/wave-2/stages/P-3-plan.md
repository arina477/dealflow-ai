# Wave 2 — P-3 Plan

**Wave:** 2 · **Milestone:** M1 Foundation (`2c79236a`, in_progress) · **wave_db_id:** `6d382ddb-36b0-44df-bcdf-a4076d4f0529`
**Slice:** auth vertical (DB+SDK → API → UI). **wave_type:** multi-spec (3 blocks). **design_gap_flag:** false (auth mockups exist; D-block skips).
**claimed_task_ids:** `e15f71dd` (seed: SuperTokens + data model) · `e1c0e81e` (auth API) · `af6cbc59` (auth screens).
**Security-scope:** auth / user-creation / sessions / cookies → P-4 security-scope tightened gate + T-8 (non-skip).

---

## APPROACH SECTION

### Action 1 — Architecture deltas

#### Δ1. Auth module boundary (NEW) — `apps/api/src/modules/auth/`
First real domain module; introduces the `src/modules/<name>/` layout from `_library.md` §2 (wave-1 had only `src/health/`). Owns SuperTokens init, invite-only signup, session, reset, and the role-guard primitive. Encapsulated via NestJS `@Module()`; no other module imports its repository.
- **What's new:** `AuthModule` (controller + service + repository + guards + supertokens config) + a `SupertokensModule`/provider that runs `supertokens.init()` once at boot.
- **Alternatives + trade-off:**
  - *Adopt `supertokens-auth-react` / `supertokens-web-js` on the client (SDK-managed UI + session)* — rejected: pulls an auth SDK (and its config) into the client bundle, fights the custom design-system auth pages that already exist in `design/`, and widens the "no secrets in client bundle" surface. We keep the client as plain `fetch` against our `/auth/*` endpoints + `httpOnly` cookies.
  - *Adopt the SuperTokens `UserRoles` recipe for role storage* — rejected this wave: `_library.md`/security.md make the app-DB `users.role` authoritative with the claim as a re-verified cache; a third recipe duplicates the source of truth and adds Core round-trips. We write the role into the claim via a `createNewSession` override and keep the canonical role in Postgres.
  - *Chosen:* self-hosted Core + `supertokens-node` server-side only; role as a custom access-token claim sourced from our `users` row.
- **Failure-domain impact:** crosses a service boundary (API ↔ SuperTokens Core over Railway private network). Core unreachability is a **fail-fast at boot** condition (AC: no silent-broken start). Signup/invite consumption spans two systems (Core user + app-DB `users` row) → must be transactional/compensating (see Δ4).

#### Δ2. SuperTokens Core as a separate Railway service on its own Postgres (NEW infra; provisioned at C-2)
Core runs as the `supertokens` Railway service (official Docker image) with a **second** Railway Postgres. The SDK reaches it via `SUPERTOKENS_CONNECTION_URI` (private `.railway.internal:3567`) + `SUPERTOKENS_API_KEY`; the Core's DB is `SUPERTOKENS_DATABASE_URL` → Core `POSTGRESQL_CONNECTION_URI`.
- **Alternatives + trade-off:** *managed IdP (Auth0/Clerk)* — rejected in onboarding (#11): keeps deal/contact + auth data inside the founder's own Railway account (bring-your-own hosting), matching an M&A advisor's confidentiality posture; *shared app Postgres for the Core* — rejected (#11 invariant: Core Postgres MUST NOT alias `DATABASE_URL`/`TEST_DATABASE_URL`).
- **Failure-domain impact:** the actual `.railway.internal` hostname is unknown until provisioning (devops R-5) → placeholder in `.env.example`, resolved at C-2. This wave wires the SDK + boot-time env assertion; it does NOT provision Railway (that is C-2). Local dev runs the Core via Docker Compose or `railway run`.

#### Δ3. Session-claim flow + role-guard PRIMITIVE (built, NOT enforced)
`Session.createNewSession` override injects `role` (resolved from the app-DB `users` row) into the access-token payload. A `SessionGuard` (401 on missing/invalid session) + a `RolesGuard`-shaped primitive that can *read* `session.getAccessTokenPayload().role` are built and unit-tested, but **applied to no route this wave** — per-route RBAC enforcement is a deferred M1 slice (spec block-2 guardrail; problem-framer P-0 reframe). Cookies are `httpOnly`/`Secure`/`SameSite` with SuperTokens anti-CSRF (security.md).
- **Alternatives + trade-off:** *enforce RBAC now on `/auth/me` and future routes* — explicitly rejected: P-0 scoped enforcement out; landing the claim + a reusable guard primitive de-risks M2 SoD without gold-plating. *Store role only in the claim (no DB column)* — rejected: security.md requires DB-authoritative role re-verified server-side.
- **Failure-domain impact:** changes what a session token carries (adds `role`), but adds NO permission check on existing routes this wave. Refresh must preserve the claim (edge-case: refresh re-runs the override so `role` survives rotation).

#### Δ4. Invite-only binding (project-designed; SuperTokens has no native invite)
Public sign-up is disabled (override the EmailPassword `signUpPOST` to reject / do not mount it); the only account-creation path is `POST /auth/signup {inviteToken,password}`, which validates an `invites` row and then creates the Core user + app `users` row in one transaction, marking the invite consumed.
- **Alternatives + trade-off:** *use SuperTokens' passwordless magic-link as the invite* — rejected: heavier recipe, changes the credential model (no password set), and the design mockups are password-set pages; *invite = pre-created disabled Core user* — viable but couples invite lifecycle to Core state; we keep invite state in our own `invites` table (queryable, expiry/consumed columns, audited later) and create the Core user only at consumption.
- **Failure-domain impact:** two-system write (Core `signUp` + app `users` INSERT + invite `consumed_at`) must be atomic/compensating; concurrent consumption of one invite must yield exactly one success (row lock + `consumed_at IS NULL` guard). No user-enumeration on reset/login responses.

#### Δ5. Drizzle schema layout transition (flat → per-module) + `drizzle.config.ts` repoint
Wave-1 has a single `apps/api/src/db/schema.ts` and `drizzle.config.ts` `schema: './src/db/schema.ts'`. `_library.md` §4 architects `apps/api/src/db/schema/<module>.ts` + `index.ts` re-export. This wave makes that transition: introduce `src/db/schema/` with `users-roles.ts`, move `app_meta` into the new layout (or keep it re-exported), add `index.ts`, and repoint `drizzle.config.ts` `schema` at the directory/index.
- **Alternatives + trade-off:** *keep everything in flat `schema.ts`* — rejected: `_library.md` mandates per-module files and M2+ adds ~12 module schemas; transitioning now (with only `app_meta` + auth tables) is the cheapest moment. *Introduce `packages/db` (`@dealflow/db`) now* — deferred (wave-1 P-3 phase-2 note explicitly defers `packages/db` to the M2 DB wave when `test-seed.ts` + audit-log land); schema stays under `apps/api/src/db/`.
- **Failure-domain impact:** migration tooling config change; the additive migration must be generated after the repoint so drizzle-kit sees all tables.

### Action 2 — Data model (additive Drizzle migration + down-migration)

New tables under `apps/api/src/db/schema/users-roles.ts` (module `users_roles` per `_library.md` §4). Additive only — **no DROP/ALTER-DROP on existing objects** (`app_meta` untouched). PKs `id UUID DEFAULT gen_random_uuid()`; `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`; snake_case plural tables.

| Table | Columns | Constraints / Indexes |
|---|---|---|
| `roles` | `id UUID PK`, `name TEXT NOT NULL`, `created_at` | `UNIQUE(name)`; `name` constrained to `{advisor, analyst, compliance, admin}` (pg CHECK or drizzle enum-backed); **seeded with exactly 4 rows in-migration** |
| `users` | `id UUID PK`, `supertokens_user_id TEXT NOT NULL`, `email TEXT NOT NULL`, `role_id UUID NOT NULL`, `created_at` | `UNIQUE(supertokens_user_id)`, `UNIQUE(email)` (case-insensitive: store lowercased or `UNIQUE(lower(email))`); `role_id` **FK → roles(id)** `ON DELETE RESTRICT`; index on `supertokens_user_id` (lookup path for the claim override) |
| `invites` | `id UUID PK`, `token TEXT NOT NULL`, `email TEXT NOT NULL`, `invited_by UUID`, `role_id UUID NOT NULL`, `expiry TIMESTAMPTZ NOT NULL`, `consumed_at TIMESTAMPTZ NULL`, `created_at` | `UNIQUE(token)` (token stored hashed at rest per security.md); `invited_by` **FK → users(id)** `ON DELETE SET NULL` (nullable — first admin invite may pre-date any user; see note); `role_id` **FK → roles(id)** `ON DELETE RESTRICT`; partial index `(token) WHERE consumed_at IS NULL` supports the concurrent-consumption guard |

- **Role enum representation:** a 4-value pg enum (`role_name`) OR a CHECK constraint on `roles.name`; either satisfies "invite role not in the 4-role set → rejected at creation" at the DB layer plus a Zod enum at the API boundary. Chosen: `roles` table is the source of truth; `role_id` FK from `users`/`invites`; API validates the role name against the Zod enum before insert (defense-in-depth).
- **Migration strategy:** offline, additive, forward migration + matching **down-migration** that DROPs only the three new tables + enum (reverses cleanly, no touch to `app_meta`). Idempotent re-run tracked by drizzle-kit `_journal.json`. Seed of the 4 roles is embedded in the forward migration (raw SQL `INSERT ... ON CONFLICT (name) DO NOTHING`) so all 4 exist from first migration.
- **`invited_by` nullability note:** made nullable + `ON DELETE SET NULL` so the bootstrap/first invite (before any admin `users` row exists) is representable; admin-only enforcement on `/auth/invite` is a later slice (this wave: endpoint creates the row).
- **Index changes:** as listed (unique constraints + the partial index for consumption); no changes to existing `app_meta`.

### Action 3 — API contracts (concrete; spec block-2)

Auth model legend: **anon** (no session), **authed** (valid session), **guard-primitive-available** (guard exists, not applied). All state-changing endpoints POST + anti-CSRF (SuperTokens). Request/response shapes are Zod schemas in `@dealflow/shared/src/auth.ts`, bridged to NestJS DTOs via `@anatine/zod-nestjs`.

| Method + Path | Request (Zod) | Success | Errors | Auth model | Idempotency / notes |
|---|---|---|---|---|---|
| `POST /auth/invite` | `{ email, role: enum(advisor\|analyst\|compliance\|admin) }` | `201 { token, expiry }` | `400` invalid role/email (Zod); `422` role not in set | anon this wave (admin-only deferred) | non-idempotent (new invite row per call); token crypto-random |
| `POST /auth/signup` | `{ inviteToken, password }` | `201` + `Set-Cookie` session (role claim); body `{ userId, email, role }` | `4xx` invalid/expired/consumed invite → **no account created**; `400` weak password (Zod policy) | anon | transactional: Core `signUp` + `users` INSERT + invite `consumed_at`; concurrent → exactly one 201, others `4xx` |
| `GET /auth/me` | — | `200 { userId, email, role }` | `401` unauthenticated | authed (via `Session.getSession`) | idempotent read; role read from claim |
| `POST /auth/reset/request` | `{ email }` | `202` **always** | (no 404/enumeration) | anon | **no user-enumeration**: same 202 for existing + non-existent email; reset token delivery stubbed/logged this slice |
| `POST /auth/reset/confirm` | `{ token, password }` | `200` | `4xx` invalid/expired token; `400` weak password | anon | consumes SuperTokens reset token → `updateEmailOrPassword` |
| `POST /auth/logout` | — | `200` session revoked | `401` if no session | authed | subsequent authed request → `401` (session-family revoked) |

- **No-user-enumeration invariants (security.md + spec):** `reset/request` returns identical `202` regardless of account existence; login/signup failures return generic errors (no unknown-email vs wrong-password distinction). Enforced in the service layer, asserted at T-8.
- **Session-refresh:** SuperTokens auto-route `POST /auth/session/refresh` (SDK-owned) issues a new access token; the `createNewSession`/refresh override re-attaches the `role` claim (edge-case AC).

### Action 4 — Dependency list

| Dep | Version pin | Why this / not alt | Runtime + bundle cost | License |
|---|---|---|---|---|
| `supertokens-node` | **`24.0.2`** (latest stable, confirmed `npm view` 2026-07-02; B-0 re-verifies resolved version against the SDK doc surface) | Self-hosted, JWT+refresh, private-net, own Postgres (#11); managed IdP rejected in onboarding | **server-only** (`apps/api`); NEVER in client bundle → zero web-bundle cost | Apache-2.0 (compatible) |
| SuperTokens Core Docker image | `supertokens/supertokens-postgresql` (major pinned to match SDK 24.x CDI range; verify at B-0/C-2) | Required Core for the self-hosted SDK; Postgres-backed image matches our stack | Railway service (infra, not npm); provisioned C-2 | Apache-2.0 |

Already-present deps reused (no new install): `drizzle-orm`/`drizzle-kit`/`pg` (schema+migration), `zod`+`@anatine/zod-nestjs` (contracts+DTOs), `@nestjs/*` (module), `next`/`react` (screens), `vitest`/`supertest`/`@testing-library/react`/`@playwright/test` (tests). No new client-side dep (screens use plain `fetch`).

### Action 4b — SDK pre-build checklist results (SuperTokens)

Per `claudomat-brain/rules/external-sdk-integration-rules.md`. Full SDK doc: **`command-center/dev/SDK-Docs/SuperTokens/supertokens.md`** (registry updated; auto-linked into all 3 task descriptions).

- **Installed reality:** `supertokens-node` NOT yet in any workspace `package.json`; `npm view supertokens-node version` → **`24.0.2`** (network available, confirmed — NOT a from-knowledge guess). B-0 installs `supertokens-node@24.0.2` into `apps/api` and confirms the resolved version matches the doc; if npm resolves newer, confirm no API-surface drift and bump the doc's "Installed version".
- **Self-hosted Core connection:** SDK ← `SUPERTOKENS_CONNECTION_URI` (private `.railway.internal:3567`) + `SUPERTOKENS_API_KEY`, passed programmatically to `supertokens.init({ supertokens: { connectionURI, apiKey } })`. Core ← its own `SUPERTOKENS_DATABASE_URL` mapped to Core's `POSTGRESQL_CONNECTION_URI`; **distinct from `DATABASE_URL`/`TEST_DATABASE_URL`** — boot env schema asserts inequality.
- **init:** `supertokens.init({ framework:'express', appInfo{apiBasePath:'/auth', apiDomain, websiteDomain}, recipeList:[EmailPassword.init(), Session.init()] })`.
- **Role claim:** custom `role` written into the access-token payload via `Session.init({ override.functions.createNewSession })` (resolve role from app-DB `users` row); read via `session.getAccessTokenPayload().role`. UserRoles recipe NOT adopted.
- **NestJS integration:** SuperTokens Express `middleware()` mounted before handlers; `errorHandler()` mounted last (else session errors → 500); CORS allows `getAllCORSHeaders()` + `credentials:true` for the Next.js origin; guard primitive calls `Session.getSession` (401) and reads the claim — un-applied to routes this wave.
- **Invite-only binding:** public sign-up disabled (override `signUpPOST` to reject / do not mount it); the only creation path is `POST /auth/signup {inviteToken,password}` → validate invite (exists/unexpired/unconsumed, row-locked) → `EmailPassword.signUp` → app `users` INSERT (1:1 `supertokens_user_id`) → invite `consumed_at` → `createNewSession` with role claim, all in one transaction.
- **Runtime literals audited** (SDK doc table filled): cookie names `sAccessToken`/`sRefreshToken`/`sAntiCsrf`; headers `anti-csrf`/`front-token`/`rid`/`fdi-version`; claim `role` (custom) + standard session claims; Core port `3567`; SDK auto-routes reserved under `/auth`; statuses `WRONG_CREDENTIALS_ERROR`/`RESET_PASSWORD_INVALID_TOKEN_ERROR`/`UNAUTHORISED`/`TRY_REFRESH_TOKEN`; env names are ours (mapped) — Core reads `POSTGRESQL_CONNECTION_URI`/`API_KEYS`. **Reserved-route collision** (custom `/auth/signup` etc. vs SDK auto-routes) flagged as the top B-time gotcha.

---

## PLAN SECTION

### Action 5 — File-level steps (grouped by B-stage)

Specialist tags validated against `command-center/AGENTS.md` in Action 6. Notation: paths relative to repo root.

#### B-1 Schema (Drizzle migration + models + config repoint)
| Path | Op | Change | Specialist | Order |
|---|---|---|---|---|
| `apps/api/src/db/schema/users-roles.ts` | create | Drizzle `roles`/`users`/`invites` tables + FKs + unique/partial indexes + role enum | postgres-pro | S1 (first) |
| `apps/api/src/db/schema/app-meta.ts` | create | move `app_meta` into per-module layout (additive; no data loss — same table) | postgres-pro | S1 (with above) |
| `apps/api/src/db/schema/index.ts` | create | re-export all schema modules (`app-meta`, `users-roles`) | postgres-pro | S2 (after S1) |
| `apps/api/src/db/schema.ts` | modify | re-export from `./schema/index` (keep import path stable for `db/index.ts`) OR delete + repoint importers | postgres-pro | S2 |
| `apps/api/drizzle.config.ts` | modify | `schema: './src/db/schema/index.ts'` (or `./src/db/schema`) | postgres-pro | S2 |
| `apps/api/src/db/migrations/0001_*.sql` | create (generated) | additive forward migration: create 3 tables + enum + seed 4 roles (`INSERT ON CONFLICT DO NOTHING`); no DROP/ALTER-DROP | postgres-pro | S3 (after config repoint; `pnpm db:generate`) |
| `apps/api/src/db/migrations/0001_*.down.sql` (or documented reverse) | create | down-migration: DROP the 3 new tables + enum only; leaves `app_meta` intact | postgres-pro | S3 |
| `apps/api/src/db/migrations/meta/*` | modify (generated) | drizzle journal/snapshot for 0001 | postgres-pro | S3 |

#### B-2 Contracts (shared Zod)
| Path | Op | Change | Specialist | Order |
|---|---|---|---|---|
| `packages/shared/src/auth.ts` | create | Zod: `roleEnum`, `inviteRequest`, `inviteResponse`, `signupRequest`, `signupResponse`, `meResponse`, `resetRequest`, `resetConfirm` (+ `.strict()`) | typescript-pro | parallel with B-1 |
| `packages/shared/src/index.ts` | modify | re-export the auth schemas + types | typescript-pro | after `auth.ts` |

#### B-3 Backend (NestJS auth module + SuperTokens + guard primitive)
| Path | Op | Change | Specialist | Order |
|---|---|---|---|---|
| `apps/api/src/modules/auth/supertokens.config.ts` | create | `supertokens.init()` — EmailPassword+Session recipes, appInfo, Core connection, `createNewSession` role-claim override, public-signup disabled | security-engineer | after B-1+B-2 |
| `apps/api/src/modules/auth/auth.repository.ts` | create | Drizzle queries: create/validate/consume invite (row-lock), create user (1:1 supertokens_user_id), resolve role by supertokens_user_id | postgres-pro | after B-1 |
| `apps/api/src/modules/auth/auth.service.ts` | create | invite create, invite-bound signup (transactional 2-system write + compensating), me, reset request/confirm (no-enumeration), logout | backend-developer | after repository + supertokens.config |
| `apps/api/src/modules/auth/auth.controller.ts` | create | 6 endpoints per Action 3; DTOs via `createZodDto` from `@dealflow/shared` | backend-developer | after service |
| `apps/api/src/modules/auth/guards/session.guard.ts` | create | 401 on missing/invalid session (`Session.getSession`) | security-engineer | after supertokens.config |
| `apps/api/src/modules/auth/guards/roles.guard.ts` | create | role-claim reader PRIMITIVE + `@Roles()` decorator — **built, applied to no route** | security-engineer | after session.guard |
| `apps/api/src/modules/auth/auth.module.ts` | create | `@Module()` wiring controller/service/repository/guards + supertokens provider | backend-developer | after above |

#### B-4 Frontend (3 Next.js auth pages)
| Path | Op | Change | Specialist | Order |
|---|---|---|---|---|
| `apps/web/app/login/page.tsx` | create | login page per `design/login.html`; posts `/auth/signin` (SDK route) or `/auth/login`; `fetch` `credentials:'include'`; inline generic error; already-authed → redirect | nextjs-developer | after B-2 (imports shared Zod); parallel with B-3 |
| `apps/web/app/accept-invite/page.tsx` | create | accept-invite per `design/accept-invite.html`; reads token from URL; valid → set-password form → `/auth/signup` → signed-in; invalid/expired → error state | nextjs-developer | after B-2 |
| `apps/web/app/reset-password/page.tsx` | create | reset-password per `design/reset-password.html`; request + set-new-password wired to `/auth/reset/*` | nextjs-developer | after B-2 |
| `apps/web/app/(auth)/_components/*` (form field, error, focus-ring) | create | shared design-system form components (label assoc, `aria-invalid`, `aria-describedby`, focus-ring) reused across the 3 pages | nextjs-developer | before/with pages |

#### B-5 Wiring (env, middleware mount, migration run, tests)
| Path | Op | Change | Specialist | Order |
|---|---|---|---|---|
| `apps/api/src/main.ts` | modify | mount SuperTokens `middleware()` before handlers + `errorHandler()` last; CORS `getAllCORSHeaders()`+`credentials`; extend boot env schema (see below) | security-engineer | after B-3 |
| `packages/shared/src/env.ts` OR boot schema in `main.ts` | modify | add `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY`, `SUPERTOKENS_DATABASE_URL`, `WEB_ORIGIN`; **assert `SUPERTOKENS_DATABASE_URL !== DATABASE_URL` and `!== TEST_DATABASE_URL`**; fail-fast if Core URI unreachable at boot | security-engineer | after B-3 |
| `.env.example` | modify | reconcile SUPERTOKENS_* (already present) + add `WEB_ORIGIN` placeholder if missing; comment private-net + separate-Postgres invariant | devops-engineer | B-5 |
| `docker-compose.yml` (local dev) OR `command-center/dev/...` note | create/modify | local SuperTokens Core + its Postgres for dev/integration (Railway provisioning is C-2) | devops-engineer | B-5 |
| `apps/api/src/modules/auth/__tests__/auth.service.unit.test.ts` | create | invite validation (expired/consumed/bad-role), no-enumeration, transactional signup, claim attach | test-automator | after B-3 |
| `apps/api/test/auth.integration.test.ts` (Supertest + real `TEST_DATABASE_URL` + Core) | create | signup/me/reset/logout happy+edge; concurrent invite consumption; migration up/down applies; role seed present | test-automator | after B-5 wiring |
| `apps/web/app/login/page.test.tsx` (+ accept-invite, reset) | create | RTL component tests: render, aria wiring, inline error | test-automator | after B-4 |
| `apps/web/tests/e2e/auth.spec.ts` | create | Playwright: login ok/fail, accept-invite happy, reset happy — **requires host Chrome (task fa23349a)**; degrade to HTTP/component smoke + record gap if absent | test-automator | after B-4+B-5 (T-5, Chrome-gated) |

### Action 6 — Specialist routing (validated against `command-center/AGENTS.md`)

| Specialist | In AGENTS.md? | Role here |
|---|---|---|
| `postgres-pro` | ✓ (per-stack executor, line 91 roster) | Drizzle schema, migration + down-migration, repository queries |
| `typescript-pro` | ✓ (per-stack executor) | shared Zod auth contracts |
| `security-engineer` | ✓ (project-specific executor) | SuperTokens init, guards, boot env assertions, middleware — **auth/session/secrets wave routes to security-engineer** per AGENTS routing |
| `backend-developer` | ✓ (universal executor) | auth service + controller + module wiring |
| `nextjs-developer` | ✓ (per-stack executor roster) | 3 Next.js auth pages + shared form components |
| `test-automator` | ✓ (project-specific executor) | unit/integration/component/E2E tests |
| `devops-engineer` | ✓ (project-specific executor) | `.env.example` reconcile + local Core compose |

All present. No missing specialist → no agent-creator invocation needed. Routing note: SuperTokens config + guards + boot assertions go to **security-engineer** (auth/session/secrets domain) rather than generic backend-developer, per AGENTS.md routing ("auth/payments/session waves").

### Action 7 — Parallelization map

- **Serial spine:** B-1 schema (`users-roles.ts` → `index.ts` + config repoint → generate migration) must complete before repository/integration.
- **Parallel batch A (after nothing / after root already exists):** B-1 Schema (postgres-pro) ‖ B-2 Contracts (typescript-pro). Independent files, no overlap.
- **Parallel batch B (after A):** B-3 Backend (security-engineer + backend-developer + postgres-pro on `auth/` files) ‖ B-4 Frontend (nextjs-developer on `apps/web/app/*`). Backend and frontend touch disjoint trees; frontend only imports `@dealflow/shared` (done in A).
  - *Within B-3 serial sub-chain:* `supertokens.config.ts` + `auth.repository.ts` → `auth.service.ts` → `auth.controller.ts`; `session.guard.ts` → `roles.guard.ts`; then `auth.module.ts` (needs all).
- **Serial tail (B-5):** `main.ts` middleware + env assertions (security-engineer) after B-3; then tests (test-automator) after backend+frontend; E2E last (Chrome-gated).
- **No file appears in two parallel batches** (verified in Action 8 sweep #3).

### Action 8 — Self-consistency sweep

1. **Every AC (all 3 blocks) → ≥1 step:**
   - *Block 1 (e15f71dd):* Core on own Postgres ≠ DATABASE_URL → B-5 env assertion + Δ2; SDK init EmailPassword+Session at boot + fail-fast → `supertokens.config.ts` + `main.ts` boot schema; additive migration + down-migration, no destructive DDL → B-1 `0001_*.sql` + `.down.sql`; 4 roles seeded → B-1 migration seed; invites columns → B-1 `users-roles.ts`; valid-invite → users row 1:1 supertokens_user_id → `auth.repository.ts`+`auth.service.ts`; session JWT carries role claim → `createNewSession` override; invite-only (no valid invite → rejected) → `auth.service.ts` + disabled public sign-up. ✓
   - *Block 2 (e1c0e81e):* signup 2xx+session+claim / invalid→4xx → `auth.controller.ts`+`auth.service.ts`; GET /me 200|401 → controller + `session.guard`; reset request 202-always + confirm valid/invalid → `auth.service.ts` (no-enumeration); logout invalidates → `auth.service.ts` (`revokeSession`); role-guard PRIMITIVE exists but not route-enforced → `roles.guard.ts` (built, unapplied — Δ3). ✓
   - *Block 3 (af6cbc59):* login/accept-invite/reset render per design + wired + inline error → B-4 pages; shared Zod + design-system form components (aria) → `_components/*` + `packages/shared/src/auth.ts`; Playwright E2E (login ok/fail, invite, reset) → `auth.spec.ts` (Chrome-gated, degrade+record); no secrets in client bundle → Δ1/Δ3 (SDK server-only, plain `fetch`) + verified at T-1/T-8. ✓
   - *Edge cases mapped:* expired/consumed/bad-role invite → repository+service+DB constraint; Core unreachable at boot → boot fail-fast; migration re-run idempotent + down reverses → B-1; reset non-existent email same 202 / login generic → service; concurrent invite consumption exactly-one → repository row-lock + partial index; refresh preserves claim → override; invalid-invite deep-link error state / already-authed redirect / keyboard+aria → B-4 pages; Chrome-absent E2E degrade → `auth.spec.ts`. ✓
2. **Every file-level step has a specialist.** ✓ (Action 5 tables + Action 6 validation)
3. **No file in multiple parallel batches.** ✓ (backend `apps/api/src/modules/auth/*` and `apps/api/src/db/*` vs frontend `apps/web/app/*` vs shared `packages/shared/*` are disjoint; `main.ts` is serial-tail only)
4. **`design_gap_flag` referenced:** **false** — all 3 auth screens have canonical mockups (`design/login.html`, `design/accept-invite.html`, `design/reset-password.html`, confirmed present) + DESIGN-SYSTEM auth-page contract; D-block skips.
5. **Architecture deltas carry explicit alternative trade-offs.** ✓ (Δ1 web-SDK vs plain-fetch + UserRoles-recipe vs claim-override; Δ2 managed-IdP vs self-host + shared vs separate Postgres; Δ3 enforce-now vs primitive-only; Δ4 magic-link vs password-set + Core-user-as-invite vs own invites table; Δ5 flat vs per-module + packages/db deferral)
6. **Data + API contracts concrete — no TBD.** ✓ (3 tables with columns/FKs/uniques/indexes; 6 endpoints with req/resp/status/auth-model)
7. **New deps justified + licensed.** ✓ (`supertokens-node@24.0.2` Apache-2.0, server-only; Core image Apache-2.0)
8. **SDK pre-build checklist complete.** ✓ (Action 4b; SDK doc written + registry updated + auto-linked to 3 tasks; version network-confirmed 24.0.2)

**Contradictions reconciled:** none outstanding. One carried flag: `.env.example` uses `AUDIT_LOG_HMAC_KEY` vs `_library.md` `AUDIT_HMAC_KEY` — **out of scope this wave** (audit-log is M2); not touched here, noted for the M2 audit wave.

**Open escalation carried to P-4/T-5:** Playwright host-Chrome (task fa23349a) is critical-path for the auth-screens E2E; if absent at T-5 the E2E degrades to HTTP/component smoke and the gap is recorded (blocking-severity for a real UI wave per spec block-3 edge case).
