# Wave 2 — T-5 E2E (Pattern A — ACTIVE, real-browser Playwright run)

**Supersedes the prior degraded run (Chrome absent). Playwright chromium-1208 is now
available and tests ran against the live production deployment.**

Browser: chromium-1208 (Playwright-bundled headless shell) via
`~/.local/share/pw-compat/` compatibility shim (rev-1228 symlinks → rev-1208 binaries).
Playwright version: 1.61.1. Tests: `apps/web/e2e/auth.spec.ts` (6 specs).

---

## Run summary

```
6 tests | 4 PASSED | 2 FAILED | chromium 1208 | 1 retry | ~70s total
```

---

## Per-scenario verdicts

| id | scenario | verdict | evidence |
|---|---|---|---|
| e2e-1 | login success: filled form → /dashboard | **FAIL (product bug FINDING-1)** | URL stayed /login; /auth/signin OPTIONS preflight returns 404 (NestJS middleware ordering bug) |
| e2e-2 | login failure: wrong creds → error, no redirect | **PASS** | `role="alert"` appeared (<10s), URL stayed /login, submit re-enabled; error text is "Unable to reach the server" (FINDING-1 side-effect) not intended "Invalid email or password" |
| e2e-3 | accept-invite happy path: set-password form → /dashboard | **FAIL (product bug FINDING-1/CORS)** | URL stayed /accept-invite; /auth/signup OPTIONS preflight also returns 404 (same CORS middleware ordering bug); browser fetch throws CORS error |
| e2e-4 | accept-invite invalid (bogus token): error state shown | **PASS** | Form renders (correct — client defers validation to server); submit shows `role="alert"` inline error; URL stays /accept-invite |
| e2e-5 | accept-invite missing token: error rendered without form | **PASS** | "Invite Link Invalid" heading visible; no set-password button present |
| e2e-6 | reset-password request: check-email ack shown | **PASS** | "Check your email" heading visible; URL stayed /reset-password; "Back to sign in" link present |

---

## Product findings (route to B — Iron Law, no fix applied here)

### FINDING-1 (CRITICAL) — CORS + SuperTokens middleware ordering bug in `apps/api/src/main.ts`

**Root cause:** `app.enableCors()` and `app.use(middleware())` (SuperTokens) are called
AFTER `await app.init()` in `main.ts`. Because `app.init()` registers the NestJS router
before these middleware are added, Express processes NestJS routes first. Any
`/auth/*` path that NestJS doesn't own (SuperTokens auto-routes: `/auth/signin`,
`/auth/signout`, `/auth/session/refresh`) hits NestJS's catch-all → **404**. Worse,
the CORS middleware never runs for OPTIONS preflight requests to ANY `/auth/*` path,
so the browser's cross-origin `fetch()` throws a CORS TypeError before a response
can be read.

**Affected flows:**
- `/auth/signin` (SuperTokens EmailPassword sign-in) → 404, browser fetch CORS-blocked
  → login page always shows "Unable to reach the server" (catch block), no login possible
- `/auth/signup` (custom route, 201) → OPTIONS preflight returns 404 (no CORS headers)
  → accept-invite form cannot complete cross-origin POST from browser
- `/auth/signout`, `/auth/session/refresh` similarly broken

**Evidence (curl):**
```
POST /auth/signin → HTTP/2 404
OPTIONS /auth/signin → HTTP/2 404 (no access-control-* headers)
OPTIONS /auth/signup → HTTP/2 404 (no access-control-* headers)
```

**Fix direction:** register SuperTokens middleware and enableCors BEFORE app.init(),
OR use NestJS module-level middleware consumer (configure(consumer)) which runs before
routes. Chicken-and-egg note: `supertokens.getAllCORSHeaders()` requires SuperTokens
to be init'd (runs inside `onModuleInit`). Solution: init SuperTokens separately
(outside NestJS DI) before creating the NestJS app; or split `getAllCORSHeaders()`
call from the middleware registration order.

**Exception:** `POST /auth/reset/request` appears to partially work because the
reset-password page swallows all errors in a catch block and always shows the
"check your email" ack (no-enumeration design). The actual HTTP request to
`/auth/reset/request` may also be CORS-blocked, but the UX is unaffected by design.

---

## Test patterns confirmed working

- `getByLabel(text, { exact: true })` required on pages with multiple password fields
  ("Password" and "Confirm password" labels — substring match catches both without exact)
- `getByRole('alert')` is the robust assertion for inline error states (avoids asserting
  specific copy that changes based on error path)
- `request` fixture in `beforeAll` correctly mints invites server-side (bypasses CORS)
- `Date.now()` suffix creates non-colliding test email accounts per run

---

## Files authored

- `apps/web/playwright.config.ts` — Playwright config (headless, chromium, baseURL)
- `apps/web/e2e/auth.spec.ts` — 6 E2E specs for login/accept-invite/reset
- `apps/web/package.json` — added `@playwright/test 1.61.1` devDep + `test:e2e` script
- `~/.local/share/pw-compat/` — one-time host setup: rev-1228 symlinks → rev-1208 binaries

## Chromium version

Playwright bundled chromium-1208 (`~/.cache/ms-playwright/chromium_headless_shell-1208/`).
The `test:e2e` script sets `PLAYWRIGHT_BROWSERS_PATH=$HOME/.local/share/pw-compat` to
satisfy playwright-core@1.61.1's rev-1228 expectation via symlink shim.

```yaml
test_pattern: active
skipped: false
testers_spawned: 1
browser: chromium-1208
scenarios_pass: 4
scenarios_fail: 2
findings:
  - severity: critical
    scenario: "login-success + accept-invite-happy-path"
    description: >
      CORS + SuperTokens middleware ordering bug: app.enableCors() and
      app.use(middleware()) called after app.init() routes NestJS ahead of
      CORS and SuperTokens interceptors. All cross-origin /auth/* OPTIONS
      preflights return 404 (no CORS headers). Browser fetch() throws
      CORS TypeError. Login and accept-invite flows cannot complete from
      the browser. Route to B.
```
