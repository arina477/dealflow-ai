# SuperTokens (supertokens-node) Reference

**Last verified:** 2026-07-02
**Official docs:** https://supertokens.com/docs (Node SDK: https://supertokens.com/docs/references/backend-sdks/node/introduction)
**GitHub:** https://github.com/supertokens/supertokens-node
**Installed version:** 24.0.2 (latest stable per `npm view supertokens-node version` on 2026-07-02; NOT yet installed — B-0 installs + verifies the resolved version matches this doc; if npm resolves a newer patch/minor at B-0, confirm no API drift against the surface below and bump this field)
**Install location:** `apps/api` (backend workspace only — the SDK is server-side; never imported by `apps/web` / the client bundle)
**Core image:** `registry.supertokens.io/supertokens/supertokens-postgresql` (self-hosted Core, own Postgres — Railway service `supertokens` per architecture/devops.md)

---

## Official API Surface
(from official SuperTokens Node docs + repo for the 24.x line)

### Self-hosted Core connection

SuperTokens has two parts: (1) the **Core** — a stateless Docker service (`supertokens/supertokens-postgresql`) backed by **its own Postgres**, and (2) the **backend SDK** (`supertokens-node`) embedded in the NestJS API. The SDK talks to the Core over HTTP.

- The **Core** reads its database connection from its own env var **`POSTGRESQL_CONNECTION_URI`** (Core-side, set on the `supertokens` Railway service). In this project the value is carried in `.env.example` / Railway as **`SUPERTOKENS_DATABASE_URL`** and mapped onto the Core service's `POSTGRESQL_CONNECTION_URI`. This Postgres is a **separate instance** from the app DB — it MUST NOT alias `DATABASE_URL` or `TEST_DATABASE_URL` (product decision #11).
- The **SDK** connects to the Core via `supertokens.init({ supertokens: { connectionURI, apiKey } })`, sourced from **`SUPERTOKENS_CONNECTION_URI`** (Railway private-network hostname, e.g. `http://supertokens.railway.internal:3567`) and **`SUPERTOKENS_API_KEY`** (Core API key; set both on the Core service and passed by the SDK).

### `supertokens.init(config)` — the single bootstrap call

```ts
import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';

supertokens.init({
  framework: 'express', // NestJS uses the Express platform adapter under the hood
  supertokens: {
    connectionURI: env.SUPERTOKENS_CONNECTION_URI,
    apiKey: env.SUPERTOKENS_API_KEY,
  },
  appInfo: {
    appName: 'DealFlow AI',
    apiDomain: env.INTERNAL_API_BASE_URL,   // NestJS public API origin
    websiteDomain: env.WEB_ORIGIN,          // Next.js origin (for cookie domain + CORS)
    apiBasePath: '/auth',                    // SuperTokens mounts its auto-routes under this base
    websiteBasePath: '/auth',
  },
  recipeList: [
    EmailPassword.init({ /* signUpFeature overrides — see invite-only below */ }),
    Session.init({ /* createNewSession override — see role claim below */ }),
  ],
});
```

Constructor options that matter this wave:
- `supertokens.connectionURI` / `supertokens.apiKey` — Core connection (fail-fast source, below).
- `appInfo.apiDomain` / `websiteDomain` — drive cookie `domain` + anti-CSRF + CORS. Must be the real origins in staging/prod (not localhost).
- `appInfo.apiBasePath` — SuperTokens auto-exposes recipe routes (e.g. `/auth/signin`, `/auth/signout`, `/auth/session/refresh`, `/auth/user/password/reset`) under this path. Our custom `/auth/invite`, `/auth/signup` (invite-bound), `/auth/me` sit alongside these; avoid path collisions with the SDK's reserved routes (see Gotchas).
- `EmailPassword.init` + `Session.init` — the only two recipes this wave.

### EmailPassword recipe — key methods (SDK, server-side)

- `EmailPassword.signUp(tenantId, email, password)` → creates a SuperTokens user (used inside our invite-bound signup, NOT via the public sign-up route which we disable).
- `EmailPassword.signIn(tenantId, email, password)` → verifies credentials; returns `{ status: 'OK' | 'WRONG_CREDENTIALS_ERROR', user }`.
- `EmailPassword.createResetPasswordToken(tenantId, userId, email)` → returns `{ status, token }` for the reset flow (we deliver the token stubbed/logged this slice; email provider is a later wave).
- `EmailPassword.consumePasswordResetToken(tenantId, token)` then `EmailPassword.updateEmailOrPassword({ recipeUserId, password })` → completes reset.
- `tenantId` = `'public'` for single-tenant MVP (multi-tenancy is H2+).

### Session recipe — key methods

- `Session.createNewSession(req, res, tenantId, recipeUserId, accessTokenPayload?, sessionDataInDatabase?)` → mints access + refresh tokens, sets cookies on `res`. **The `accessTokenPayload` argument is where the `role` claim is written** (see below).
- `Session.getSession(req, res, options?)` → verifies the session; returns a session object; `session.getAccessTokenPayload()` reads the `role` claim; `session.getUserId()` reads the SuperTokens user id.
- `session.revokeSession()` / `Session.revokeAllSessionsForUser(userId)` → logout / admin revoke.
- Refresh-token rotation with reuse detection is on by default in the Session recipe (a replayed rotated refresh token revokes the session family) — architecture/security.md relies on this.

### Adding the `role` claim to the access-token payload

Two supported approaches; **this project uses the `createNewSession` override** (does not adopt the UserRoles recipe this wave — role lives on the app-DB `users` row and is mirrored into the claim):

```ts
Session.init({
  override: {
    functions: (original) => ({
      ...original,
      createNewSession: async (input) => {
        // look up the app-DB users row by supertokens_user_id → role name
        const role = await resolveRoleForSupertokensUser(input.userId);
        input.accessTokenPayload = { ...input.accessTokenPayload, role };
        return original.createNewSession(input);
      },
    }),
  },
});
```

The claim is then read via `session.getAccessTokenPayload().role`. Per architecture/security.md the DB `users.role` is authoritative and the claim is re-verified server-side on authorization decisions — but **this wave only lands the claim + a guard PRIMITIVE that can read it; per-route RBAC enforcement is deferred** (spec block-2 guardrail).

### NestJS integration pattern

- **Middleware:** SuperTokens ships an Express `middleware()` (`supertokens-node/framework/express`) that must be mounted to serve the auto-routes and populate the session. In NestJS (Express platform) it is applied via a `configure(consumer)` `NestModule` hook or as global middleware in `main.ts` after `app.use(...)`.
- **CORS:** must allow credentials + the SuperTokens headers/`Access-Control-Allow-Headers` from `supertokens.getAllCORSHeaders()`, with `origin` = the Next.js `websiteDomain` and `credentials: true`.
- **Error filter:** SuperTokens throws an `Error` the express `errorHandler()` catches; in NestJS wrap it with an exception filter or mount `errorHandler()` last so SuperTokens session errors map to 401 rather than 500.
- **Guard primitive:** a NestJS guard (e.g. `SessionGuard`) calls `Session.getSession(req, res)` → 401 on no/invalid session; a companion `RolesGuard`-style primitive reads `session.getAccessTokenPayload().role`. This wave builds the primitive and leaves it un-applied to routes (available, not enforced).

### Invite-only binding (project-designed; not a built-in SuperTokens feature)

SuperTokens has no native "invite" concept — invite-only is enforced in **our** code:
1. Public sign-up is **disabled** by overriding the EmailPassword `signUpPOST` API to always reject (or by not mounting it and only exposing our `/auth/signup`), so the SDK's default open sign-up route cannot create accounts.
2. Our `POST /auth/invite` creates an `invites` row (crypto-random `token`, hashed at rest, `role_id`, `expiry`, `invited_by`).
3. Our `POST /auth/signup {inviteToken, password}` validates the invite (exists, unexpired, unconsumed) **inside a transaction**, then: `EmailPassword.signUp('public', inviteEmail, password)` → INSERT `users` row mapping `supertokens_user_id` 1:1 → mark invite `consumed_at` → `Session.createNewSession(...)` with the invite's role in the claim. Concurrent consumption is resolved by a `UNIQUE`/`consumed_at IS NULL` guard + row lock so exactly one signup wins.

### Runtime literals (strings the SDK owns at runtime)

| Category | What SuperTokens owns | Value / note (verify at B-0 against installed 24.x) |
|---|---|---|
| Env var names (+ legacy) | SDK does NOT read env directly — connection is passed programmatically via `init()`. **Core** reads `POSTGRESQL_CONNECTION_URI` + `API_KEYS`. Project env names (`SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY`, `SUPERTOKENS_DATABASE_URL`) are OURS, mapped in bootstrap/Railway. | Core: `POSTGRESQL_CONNECTION_URI`, `API_KEYS`. No legacy aliases in 24.x. |
| Cookie names | Session cookies the SDK emits in frontend cookie mode | `sAccessToken`, `sRefreshToken`, `sAntiCsrf` (anti-CSRF token). Front-token header `st-access-token` / `st-refresh-token` in header mode (we use cookie mode). |
| Cookie prefixes / attributes | Applied under HTTPS / config | `Secure` + `SameSite` auto-set from `apiDomain`/`websiteDomain` + `cookieSecure`; `httpOnly` on session cookies. `__Host-`/`__Secure-` not applied by default. |
| HTTP headers | Headers the SDK sets/requires at the session boundary | `anti-csrf` (request header for anti-CSRF), `front-token`, `rid` (recipe id, e.g. `session`/`emailpassword`), `fdi-version`. CORS must allow these via `getAllCORSHeaders()`. |
| JWT/JWE claims | Claims in the access-token payload | Standard: `sub`, `exp`, `iat`, `iss`, `sessionHandle`, `refreshTokenHash1`, `parentRefreshTokenHash1`, `antiCsrfToken`, `tId` (tenant). **Custom: `role`** (added by our `createNewSession` override). |
| Default ports / paths / callbacks | Core port + SDK auto-routes | Core default port **3567**. SDK auto-routes under `apiBasePath` (`/auth`): `POST /auth/signin`, `POST /auth/signout`, `POST /auth/session/refresh`, `POST /auth/user/password/reset/token`, `POST /auth/user/password/reset`, `GET /auth/signup/email/exists`, etc. |
| Error codes / classes | Statuses returned by recipe functions callers match on | `OK`, `WRONG_CREDENTIALS_ERROR` (signIn), `EMAIL_ALREADY_EXISTS_ERROR` (signUp), `RESET_PASSWORD_INVALID_TOKEN_ERROR` (consume reset), `UNAUTHORISED` / `TRY_REFRESH_TOKEN` (session). `Session.Error` thrown for session failures. |
| Log line formats | Core + SDK logs | Core logs to stdout (structured-ish); SDK debug logs gated by `SUPERTOKENS_DEBUG=1`. No format other systems parse in this project — N/A for our log pipeline (pino owns app logs). |
| Version negotiation strings | FDI / CDI version handshake | SDK sends `fdi-version` / `cdi-version` headers negotiated against the Core; a Core/SDK major mismatch fails at boot. Pin Core image major to match `supertokens-node` 24.x's supported CDI range (verify at B-0). |

---

## Platform Compatibility
(verified against this project's deploy target — Railway — + Node 22/24 server runtime + Next.js 15 client)

### Railway (deploy target)
- **Core service:** run the official `supertokens/supertokens-postgresql` Docker image as a Railway service (`supertokens`), on the **private network only** (never a public domain). `SUPERTOKENS_CONNECTION_URI` = the `.railway.internal` hostname + port 3567. The exact private hostname is assigned at project provisioning (devops R-5) — placeholder in `.env.example` until C-2.
- **Own Postgres:** a **second** Railway Postgres instance for the Core (`SUPERTOKENS_DATABASE_URL` → Core `POSTGRESQL_CONNECTION_URI`); distinct from the app `postgres` service. Never aliased to `DATABASE_URL` (#11) — enforced by the boot env schema.
- **API service (`api`, NestJS):** `supertokens-node` runs here; reaches the Core over the private network. Public API + Next.js are the only internet-exposed services (TLS).

### Node server runtime (apps/api)
- `supertokens-node` is a server-only Node package (uses Node crypto/http). Compatible with Node 22 LTS (devops.md) / Node 24 (wave-1 baseline). Node 24 has no known 24.x SDK incompatibility — confirm at B-0.
- Must be imported only in `apps/api` server code; NEVER in `apps/web` client components (would leak `SUPERTOKENS_API_KEY` intent + is server-only).

### Next.js 15 client (apps/web)
- The frontend uses **no SuperTokens client SDK** this wave — the three auth pages post directly to our NestJS `/auth/*` endpoints and rely on the `httpOnly` session cookies the API sets. (SuperTokens' `supertokens-web-js` / `supertokens-auth-react` are NOT adopted; keeps the client bundle free of auth SDK + secrets, satisfying "no secrets in client bundle".) Cookie-based session means the browser sends `sAccessToken` automatically; `fetch` must use `credentials: 'include'`.

---

## Known Gotchas
(from official docs + GitHub issues — general, not our integration)

1. **Reserved auto-routes under `apiBasePath`.** SuperTokens claims routes under `/auth` (signin, signout, session/refresh, password reset). A custom controller mapped to a colliding path is shadowed by the SDK middleware (mounted first) or vice-versa. Our custom `/auth/invite`, `/auth/signup`, `/auth/me`, `/auth/logout` must not collide with reserved paths; if a collision risk exists, either use a distinct sub-path or override the specific SDK API instead of adding a parallel route.
2. **Middleware order.** The SuperTokens Express `middleware()` must run BEFORE route handlers, and `errorHandler()` must be mounted LAST, or session errors surface as 500s. In NestJS this ordering is easy to get wrong with global pipes/filters — wire explicitly.
3. **CORS + credentials.** Missing `getAllCORSHeaders()` in `Access-Control-Allow-Headers`, or `credentials: false`, silently breaks cookie sessions from the Next.js origin (looks like "always 401"). `websiteDomain` must exactly match the browser origin.
4. **`apiDomain`/`websiteDomain` on localhost vs prod.** Cookie `SameSite`/`Secure` derive from these; a localhost value in staging/prod breaks cookies. The boot env schema should reject non-private/public-`http` connection URIs in staging/prod (devops.md convention).
5. **Anti-CSRF applies to state-changing verbs.** State changes must be POST/PUT/PATCH/DELETE with the anti-CSRF token; a GET mutation is unprotected and will be flagged at T-8.
6. **Core/SDK version handshake (CDI/FDI).** A Core image major that doesn't support the SDK's CDI range fails at boot. Pin the Core image to a major compatible with `supertokens-node@24.x`.
7. **Own Postgres, not shared.** Pointing the Core at the app DB (aliasing `DATABASE_URL`) "works" in dev and silently violates isolation invariant #11 — the boot schema must assert the two URLs differ.

---

## Documentation Links
- Getting Started (Node, self-hosted): https://supertokens.com/docs/quickstart/introduction
- EmailPassword recipe: https://supertokens.com/docs/emailpassword/introduction
- Session recipe: https://supertokens.com/docs/session/introduction
- Adding custom claims to the access token: https://supertokens.com/docs/session/claims/access-token-payload
- Self-hosting the Core (Docker + Postgres): https://supertokens.com/docs/deployment/self-host-supertokens
- Disabling sign-up / overriding APIs (invite-only): https://supertokens.com/docs/references/backend-sdks/function-overrides
- Node API reference: https://supertokens.com/docs/references/backend-sdks/node/introduction
- GitHub issues (Node SDK): https://github.com/supertokens/supertokens-node/issues

---

## Integration-Specific Findings
(added during/after implementation — what WE learned)

### Our adapter patterns
_(to be filled at L-1 after B-block — invite→signup transaction binding, createNewSession role-claim override, NestJS middleware wiring quirks)_

### Env var configuration on our platforms

**Railway (provisioned at wave-2 C-2):**
- **Core service `supertokens-core`** (id `80790c7f-cb81-4b7f-b248-c4da0789ffb1`),
  image `registry.supertokens.io/supertokens/supertokens-postgresql:11.4.5`,
  **private-only** (no public domain), private hostname `supertokens-core.railway.internal:3567`.
  - `POSTGRESQL_CONNECTION_URI` → the Core's own Postgres (below).
  - `API_KEYS` → generated (`openssl rand -base64 32`); matches the api's `SUPERTOKENS_API_KEY`.
  - `PORT` = `3567`.
- **Core Postgres `supertokens-db`** (id `acf6eb46-f758-4254-b10c-32d1eacf3868`),
  image `postgres:16-alpine` + persistent volume, private hostname
  `supertokens-db.railway.internal:5432`, database `supertokens`. **Separate
  instance from the app `postgres`** — never aliases `DATABASE_URL` (#11). The
  api's boot no-alias assertion was verified live: app DB is
  `postgres.railway.internal/railway`, Core DB is `supertokens-db.railway.internal/supertokens`.
- **api service `dealflow-api`** env (values in Railway only, never committed):
  - `SUPERTOKENS_CONNECTION_URI` = `http://supertokens-core.railway.internal:3567`
  - `SUPERTOKENS_API_KEY` = the generated Core key
  - `SUPERTOKENS_DATABASE_URL` = the Core Postgres private conn string (distinct from `DATABASE_URL`)
  - `INTERNAL_API_BASE_URL` = api public URL (`appInfo.apiDomain`)
  - `WEB_ORIGIN` = web public URL (CORS + cookie domain / `appInfo.websiteDomain`)

**CDI/version pin (verified):** installed `supertokens-node@24.0.2` declares
`cdiSupported: ["5.4"]` (`node_modules/supertokens-node/lib/build/version.js`).
Core image line 11.x supports CDI 5.4 → `11.4.5` (newest stable non-canary) is
compatible; no boot-time CDI handshake mismatch.

_Note: the wave-2 auth backend did not go fully live at first C-2 — the api
crash-looped at NestJS boot on a DI defect (`import type { AuthRepository }`
erasing the DI paramtype under `emitDecoratorMetadata`; see Known Gotchas → NestJS
DI value-import requirement). Infra + migration + web are live; api goes live after
the value-import fix ships. The Core/DB provisioning above is durable across the
re-run._

### Bugs we hit and how we solved them
_(to be filled at L-1)_

### What differed from the official docs
_(to be filled at L-1)_
