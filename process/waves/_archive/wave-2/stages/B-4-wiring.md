# Wave 2 — B-4 Wiring

Integration gate — no drift found; no B-2/B-3 re-entry needed.

- **Repo-wide typecheck** (`pnpm -r typecheck`): PASS across all 3 packages (@dealflow/shared, apps/api, apps/web). Server + client + shared agree on the auth contracts — no boundary drift.
- **Repo-wide build** (`pnpm -r build`): PASS. Next.js compiles all auth routes: /login (1.39kB), /accept-invite (1.91kB), /reset-password (2.4kB), /dashboard (server-rendered), / . NestJS builds.
- **Route registration:**
  - Frontend (file-system): apps/web/app/{login,accept-invite,reset-password,dashboard}/page.tsx all present + build-registered.
  - Backend: AuthModule imported in app.module.ts; SuperTokens Express middleware + errorHandler wired in main.ts before route handlers (serves SDK auth routes + the custom /auth controller).
- **Env wiring:** .env.example carries all 5 (SUPERTOKENS_CONNECTION_URI, SUPERTOKENS_API_KEY, SUPERTOKENS_DATABASE_URL, WEB_ORIGIN, NEXT_PUBLIC_API_URL). Boot-time non-alias assertion (B-2) guards SUPERTOKENS_DATABASE_URL.
- **Route-naming note (jenny P-4):** frontend uses `/accept-invite` (P-3 canonical); journey map's `/invite/:token` will be reconciled at T-9 journey regen. Recorded, non-blocking.

```yaml
typecheck_passed: true
build_passed: true
routes_registered: ["/login", "/accept-invite", "/reset-password", "/dashboard", "AuthModule + SuperTokens middleware (api)"]
env_vars_wired: [SUPERTOKENS_CONNECTION_URI, SUPERTOKENS_API_KEY, SUPERTOKENS_DATABASE_URL, WEB_ORIGIN, NEXT_PUBLIC_API_URL]
drift_defects: []
route_naming_reconcile_at: T-9
