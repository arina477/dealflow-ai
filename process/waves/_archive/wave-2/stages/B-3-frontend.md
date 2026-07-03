# Wave 2 — B-3 Frontend (auth screens)

Implemented by nextjs-developer. Branch wave-2-auth-backbone. Commit `cb6a6d3`.

## Pages + components (apps/web/app/)
- login/page.tsx (email+password → SuperTokens signin → /dashboard; generic error)
- accept-invite/page.tsx (?token= → set-password → POST /auth/signup; error state on missing/invalid token; Suspense-wrapped)
- reset-password/page.tsx (two-step: request→ack always shown; confirm via ?token=)
- dashboard/page.tsx (placeholder authed landing; server component reads GET /auth/me; 401→/login)
- (auth)/_components/: FormField (label assoc, aria-invalid/describedby, focus-ring), AuthCard (DESIGN-SYSTEM §10), SubmitButton (aria-busy), InlineAlert (role=alert, aria-live)

## Designs consumed
design/login.html, design/accept-invite.html, design/reset-password.html + DESIGN-SYSTEM §8 (inputs) + §10 (auth pages).

## Reconciliation notes applied (jenny P-4)
- SSO "Continue with Google" button — OMITTED (deferred M8/M11).
- "SOC 2 Type II" badge — REMOVED (compliance_regime=none; false claim per CODE-OF-CONDUCT).
- "Full Legal Name" field — OMITTED (no name column in users this wave; no implied persistence).

## No-user-enumeration in UI
Login: WRONG_CREDENTIALS + any non-OK → same "Invalid email or password." Reset: always shows check-email ack ("If an account exists..."). Accept-invite 4xx: generic (no expired/consumed/invalid distinction).

## Verify
`pnpm --filter @dealflow/web typecheck` → 0 (fixed exactOptionalPropertyTypes). 41 RTL component tests green across 4 suites (+@testing-library/user-event devDep). Playwright E2E deferred to T-5 (host Chrome absent).

```yaml
skipped: false
fast_path_active: false
specialists_spawned: [nextjs-developer]
files_implemented: [apps/web/app/login/page.tsx, apps/web/app/accept-invite/page.tsx, apps/web/app/reset-password/page.tsx, apps/web/app/dashboard/page.tsx, "apps/web/app/(auth)/_components/*"]
designs_consumed: [design/login.html, design/accept-invite.html, design/reset-password.html]
deviations:
  - {specialist: nextjs-developer, change: "login uses /auth/signin SuperTokens SDK route shape (formFields + rid header)", plan_said: "/auth/signin", why: "SDK auto-route contract", adjudication: accepted}
  - {specialist: nextjs-developer, change: "+@testing-library/user-event devDep", plan_said: "n/a", why: "RTL typed-input sim", adjudication: accepted}
  - {specialist: nextjs-developer, change: "omitted animated decorative right panel", plan_said: "login.html has it", why: "decorative only; DESIGN-SYSTEM §10 doesn't mandate it", adjudication: accepted}
simplify_applied: true
commit: cb6a6d3
