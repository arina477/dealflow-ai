# V-1 Karen — Source-Claim Verification (Wave 2, auth backbone)

> Reality check of the wave's load-bearing CLAIMS against DEPLOYED state. Auth is LIVE.
> Source-claim verification only (jenny owns spec-semantics). Evidence = file on disk / live HTTP / DB.
> Deployed hash: `bc558f7`. api `https://dealflow-api-production-66d4.up.railway.app`,
> web `https://dealflow-web-production-a4f7.up.railway.app`. Probed 2026-07-03.

## VERDICT: **APPROVE**

Every load-bearing claim is TRUE in the deployed state, proven by live HTTP against `bc558f7`
(not extrapolated from green tests). The signature browser-bug fix — a first-party session cookie
on the web origin via the same-origin proxy — is demonstrably live: a fresh invite→signup through
the web-origin proxy returned `Set-Cookie: sAccessToken … HttpOnly; Secure; SameSite=Lax` with a JWT
`iss` of the web origin and `role=advisor`. Two cosmetic path/naming nits, zero material gaps.

---

## Findings (claim → evidence)

### F1 — Files exist — TRUE (2 cosmetic nits) — severity: Low
- **Claim:** auth module, db/schema, migration 0001, shared auth, 4 web pages + auth components, next.config.ts, e2e spec all present.
- **Evidence (on disk):** `apps/api/src/modules/auth/` has `supertokens.config.ts`, `supertokens.env.ts`, `auth.repository.ts`, `auth.service.ts`, `auth.controller.ts`, `auth.module.ts`, `dto.ts`, `guards/{roles.guard.ts,session.guard.ts}` (+ 5 spec files). `apps/api/src/db/schema/{users-roles.ts,app-meta.ts,index.ts}`. Migration `apps/api/src/db/migrations/0001_serious_junta.sql` (+ `.down.sql` + snapshot). `packages/shared/src/auth.ts`. `apps/web/app/{login,accept-invite,reset-password,dashboard}/page.tsx` + `(auth)/_components/{AuthCard,FormField,InlineAlert,SubmitButton}.tsx`. `apps/web/next.config.ts`. `apps/web/e2e/auth.spec.ts`.
- **Nits:** (a) prompt listed `dto` as a subdirectory — it's a single file `dto.ts` (DTOs present, just flat). (b) prompt listed `supertokens.env` — file is `supertokens.env.ts`. Both are naming/shape only; no missing artifact.

### F2 — Routes live — TRUE — severity: n/a (pass)
- `GET api/health` → `200 {"status":"ok","db":"ok","version":"bc558f7d4db08c447d13b661a8925ef7aa934138"}`.
- `POST api/auth/invite {email,role:advisor}` → **201** `{"token":"…","expiry":"2026-07-10T…"}` (repeated, stable 201).
- `POST web/auth/signin` bad creds → **HTTP 200** `{"status":"WRONG_CREDENTIALS_ERROR"}`, `content-type: application/json` — the same-origin proxy reaches SuperTokens; NOT a Next.js 404.
- `OPTIONS web/auth/signup` → **204** with `access-control-allow-origin: https://dealflow-web-production-a4f7.up.railway.app` + `access-control-allow-credentials: true` (preflight served through proxy).

### F3 — The two browser-bug fixes are present AND live — TRUE — severity: n/a (pass)
- **(a) main.ts ordering:** `apps/api/src/main.ts` calls `initSupertokens(...)` BEFORE `NestFactory.create()`, then `app.enableCors({ allowedHeaders: [...supertokens.getAllCORSHeaders()] })` and `app.use(middleware())` + `app.use(errorHandler())` all BEFORE `app.listen()` (which triggers `app.init()`). This resolves both the prior "Initialisation not done" boot crash and the "middleware after router" 404.
- **(b) supertokens.config.ts:** `apiDomain: env.WEB_ORIGIN`, `websiteDomain: env.WEB_ORIGIN`, `getTokenTransferMethod: () => 'cookie'`, `cookieSameSite: 'lax'` (`cookieSecure` auto-derives from WEB_ORIGIN https).
- **(c) next.config.ts:** `rewrites()` maps `source: '/auth/:path*'` → `${INTERNAL_API_BASE_URL ?? NEXT_PUBLIC_API_URL ?? localhost:3001}/auth/:path*`.
- **LIVE proof (the fix's whole point):** minted invite → `POST web/auth/signup` through the proxy → **201** `{"userId":"a1048d83-…","email":"karen-v1-…","role":"advisor"}` with `Set-Cookie: sAccessToken=…; Path=/; HttpOnly; Secure; SameSite=Lax` and `sRefreshToken=…; Path=/auth/session/refresh; HttpOnly; Secure; SameSite=Lax`. Cookie jar confirmed both cookies scoped to `dealflow-web-production-a4f7.up.railway.app`. Decoded `sAccessToken` JWT: `iss=https://dealflow-web-production-a4f7.up.railway.app/auth`, `role=advisor`, `tId=public` — proves `apiDomain=WEB_ORIGIN` in effect (first-party on the web origin, not header-only tokens).

### F4 — Migration ran — TRUE — severity: n/a (pass)
- Live invite→signup exercised `roles`/`users`/`invites` end-to-end (a role-bearing account was provisioned and a session minted), which is only possible if 0001 applied to the deployed app-DB.
- Migration seeds **exactly 4 roles**: `INSERT INTO "roles" ("name") VALUES ('advisor'),('analyst'),('compliance'),('admin')` — matches the spec AC (the signup returned `role:advisor`, resolved via the role FK).

### F5 — Env set — TRUE (inferred from live behavior, values not leaked) — severity: n/a (pass)
- `INTERNAL_API_BASE_URL` on web: the `/auth/*` proxy successfully reverse-proxies to the api (F2/F3) — the rewrite target is env-driven, so it must be set on the web service.
- `SUPERTOKENS_*` on api: api booted clean and `/auth/invite` + signup succeed against live Core — Core connection URI/API key present and valid.
- SuperTokens Postgres isolated: `SUPERTOKENS_DATABASE_URL != DATABASE_URL` no-alias boot assertion passed (C-2 re-run #5 boot log: "Nest application successfully started"; the app cannot boot if the assertion trips).

### F6 — Deploy hash + E2E — TRUE — severity: n/a (pass)
- `/health` version == `bc558f7` (exact deployed hash; no health-check mirage). Note repo main HEAD is `3a3c7ca` (T-block transcript housekeeping commits after `bc558f7`); `bc558f7` is the last code-bearing commit and is what's deployed — consistent, not stale.
- T-5 real-browser E2E: `6 tests | 6 PASSED | 0 FAILED` (chromium-1208, ~8.7s). Spot-check plausible and consistent with live probes: e2e-1 login→/dashboard, e2e-3 accept-invite→first-party cookie→/dashboard mirror exactly the signin/signup behavior I reproduced by hand. `apps/web/e2e/auth.spec.ts` contains 6 real, distinct `test.describe` scenarios (not decorative/duplicated).

### F7 — Antipattern catalog / honesty of the fix-cycles — TRUE (honestly recorded) — severity: n/a (pass)
- **Claimed-but-fake:** none found — every claim reproduced against live prod.
- **Decorative tests:** none — the 6 E2E scenarios assert distinct real outcomes (redirect, inline alert, no-enumeration ack, missing-token no-form).
- **Deferred-but-undocumented:** none material.
- **Deploy fix-cycles honestly recorded:** YES. `C-2-deploy-and-verify.md` openly documents re-run #2 as `ci_stage_verdict: FAIL` / `head_signoff: ESCALATE` with the full "Initialisation not done" crash-loop root cause and Iron-Law return-to-B — a failure is NOT hidden. `T-5-e2e.md` openly records Run 2 as 4/6 (FINDING-1 preflight 404, FINDING-2 header-not-cookie) SUPERSEDED by the 6/6 run. The painful cycles are surfaced, not buried.

---

## Bottom line
No fabricated greens, no non-booting artifact, no stale deploy. The cross-origin session fix is live and
correct on the web origin. Two Low-severity cosmetic path nits (F1) — not blockers. **APPROVE.**
