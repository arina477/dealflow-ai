# Wave 2 — T-5 E2E (Pattern A — FINAL, post cross-origin session fix)

**This run supersedes all prior runs (4/6 pass, 2 FAILED on cross-origin session bug).
The FINDING-2 cross-origin session fix is confirmed live and all 6 scenarios now pass.**

Browser: chromium-1208 (Playwright-bundled headless shell) via
`~/.local/share/pw-compat/` compatibility shim (rev-1228 symlinks → rev-1208 binaries).
Playwright version: 1.61.1. Tests: `apps/web/e2e/auth.spec.ts` (6 specs).
Run date: 2026-07-03. Branch: main @ bc558f7+.

---

## Run summary

```
6 tests | 6 PASSED | 0 FAILED | chromium 1208 | 0 retries needed | ~8.7s total
```

---

## Per-scenario verdicts

| id | scenario | verdict | evidence |
|---|---|---|---|
| e2e-1 | login success: filled form → /dashboard | **PASS** | Form filled, POST /auth/signin (via web /auth/* proxy) returned session cookie, URL navigated to /dashboard |
| e2e-2 | login failure: wrong creds → error, no redirect | **PASS** | `role="alert"` appeared (<10s), URL stayed /login, submit re-enabled |
| e2e-3 | accept-invite happy path: set-password form → /dashboard | **PASS** | POST /auth/signup completed, session cookie set first-party, URL navigated to /dashboard |
| e2e-4 | accept-invite invalid (bogus token): error state shown | **PASS** | Form renders; submit shows `role="alert"` inline error; URL stays /accept-invite |
| e2e-5 | accept-invite missing token: error rendered without form | **PASS** | "Invite Link Invalid" heading visible; no set-password button present |
| e2e-6 | reset-password request: check-email ack shown | **PASS** | "Check your email" heading visible; URL stayed /reset-password; "Back to sign in" link present |

---

## Cross-origin session fix confirmed

Pre-run verification (curl before Playwright):

```
OPTIONS /auth/signin (web proxy) → HTTP/2 204
  access-control-allow-credentials: true
  access-control-allow-headers: content-type,rid,fdi-version,anti-csrf,authorization,st-auth-mode
  access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE
  access-control-allow-origin: https://dealflow-web-production-a4f7.up.railway.app
```

The web app now proxies `/auth/*` same-origin to the API. SuperTokens uses cookie
transfer. POST web/auth/signup → 201 + Set-Cookie sAccessToken HttpOnly Secure
SameSite=Lax. The browser stores the session, navigates to /dashboard, and the
Next.js server component reads the cookie → /auth/me 200 → dashboard renders.

**FINDING-1** (CORS / middleware ordering, fixed at cc893d8): SuperTokens middleware
and CORS now registered before app.init() — OPTIONS preflights return 204 with correct
access-control-* headers instead of 404.

**FINDING-2** (cross-origin session, fixed + deployed before this run): web proxy for
/auth/* now transfers cookies as first-party on the web origin so Next.js server
components can read the session from cookies().

---

## Prior runs (superseded)

### Run 2 — 2026-04-06 (4/6 pass — SUPERSEDED)

```
6 tests | 4 PASSED | 2 FAILED | chromium 1208 | 1 retry | ~70s total
```

| id | scenario | verdict |
|---|---|---|
| e2e-1 | login success | **FAIL** — FINDING-1: OPTIONS preflight 404, CORS TypeError |
| e2e-2 | login failure | PASS |
| e2e-3 | accept-invite happy path | **FAIL** — FINDING-2: session set as headers not Set-Cookie, dashboard bounced to /login |
| e2e-4 | accept-invite invalid token | PASS |
| e2e-5 | accept-invite missing token | PASS |
| e2e-6 | reset-password request | PASS |

---

## Spec changes

None. Existing `apps/web/e2e/auth.spec.ts` ran unchanged. No commit required.

---

## Test patterns confirmed working

- `getByLabel(text, { exact: true })` required on pages with multiple password fields
- `getByRole('alert')` robust assertion for inline error states
- `request` fixture in `beforeAll` correctly mints invites server-side (bypasses CORS)
- `Date.now()` suffix creates non-colliding test email accounts per run

---

## Files

- `apps/web/playwright.config.ts` — Playwright config (headless, chromium, baseURL)
- `apps/web/e2e/auth.spec.ts` — 6 E2E specs for login/accept-invite/reset
- `apps/web/package.json` — `@playwright/test 1.61.1` devDep + `test:e2e` script
- `~/.local/share/pw-compat/` — host shim: rev-1228 symlinks → rev-1208 binaries

## Chromium version

chromium-1208 (`~/.cache/ms-playwright/chromium_headless_shell-1208/`).

```yaml
test_pattern: active
skipped: false
testers_spawned: 1
browser: chromium-1208
scenarios_pass: 6
scenarios_fail: 0
findings: []
```
