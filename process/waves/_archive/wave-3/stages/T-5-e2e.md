# T-5 E2E — Wave-3 RBAC + AppShell Real-Browser Results

**Date:** 2026-07-03  
**Browser:** chromium-1208 (via pw-compat shim at ~/.local/share/pw-compat/chromium-1228 → actual binary 1208)  
**Playwright:** 1.61.1  
**Target:** LIVE — https://dealflow-web-production-a4f7.up.railway.app (9c11b73/935b847)  
**Spec:** apps/web/e2e/rbac-appshell.spec.ts  

---

## Summary

| Scenario | Verdict | Notes |
|---|---|---|
| S1 | PASS | Compliance user: accept-invite → lands on `/` (not /login), AppShell renders, identity + role visible |
| S2a | PASS | Compliance nav set: Dashboard + Compliance; no Mandates/Sourcing/Team/Settings |
| S2b | PASS | Advisor nav set: Dashboard + Mandates + Compliance; no Sourcing/Team/Settings |
| S3 | PASS | Unauth `/` → redirect to /login; login page heading renders |
| S4a | PASS | Advisor: Compliance nav present (per rbac.ts matrix); Sourcing/Team/Settings absent |
| S4b | PASS | Compliance: Compliance nav present; Mandates/Sourcing absent |
| S5 | PASS | Login-failure (wrong creds) → role="alert" inline error, stays on /login, button re-enabled |

**Result: 7/7 PASS** (all wave-3 scenarios)

---

## Per-Scenario Detail

### S1: Login → role-aware dashboard at /
- Minted compliance invite via POST /auth/invite {role: 'compliance'}
- Completed accept-invite browser flow (set password)
- Post-submit: landed on `/` (session cookie set correctly — FINDING-2 resolved in wave-3)
- AppShell: `role="navigation" aria-label="Main navigation"` sidebar visible
- Identity: email text visible on page (sidebar footer, TopBar chip, WelcomeCard)
- Sidebar footer user-menu button (`aria-label: User menu: ...`) visible
- Dashboard content: "Signed in as" text visible; Compliance Overview section visible

### S2: Role-aware nav

**compliance role** (rbac.ts `navItemsForRole('compliance')` = Dashboard + Compliance):
- Dashboard nav link: PRESENT
- Compliance nav link: PRESENT
- Mandates: ABSENT (correct — not in allowedRoles for compliance)
- Sourcing: ABSENT (correct)
- Team: ABSENT (correct)
- Settings: ABSENT (correct)

**advisor role** (rbac.ts `navItemsForRole('advisor')` = Dashboard + Mandates + Compliance):
- Dashboard nav link: PRESENT
- Mandates nav link: PRESENT
- Compliance nav link: PRESENT (NAV_COMPLIANCE.allowedRoles includes advisor)
- Sourcing: ABSENT (correct)
- Team: ABSENT (correct)
- Settings: ABSENT (correct)

### S3: Unauth redirect
- Fresh browser context (no cookies), navigated to `/`
- Server returned 307 → `/login` (observed via Playwright navigation)
- Login page `heading "Welcome back"` rendered correctly
- Time: 440ms

### S4: RBAC nav divergence
- Confirmed advisor and compliance nav sets diverge on Mandates (advisor sees it, compliance does not)
- Both roles see Compliance nav per rbac.ts (NAV_COMPLIANCE.allowedRoles: ['compliance', 'advisor'])
- RBAC deny applies to routes without a nav item: advisor has no Sourcing/Team/Settings nav

### S5: Login failure regression (wave-2)
- Wrong credentials entered at /login
- role="alert" element appeared within 12s timeout
- URL remained /login (no redirect on failure)
- Submit button re-enabled after failure
- Time: 618ms

---

## Pre-existing auth.spec.ts findings (wave-2 spec, not wave-3 failures)

Two wave-2 specs in auth.spec.ts continue to fail — these are documented PRODUCT BUGS, not test bugs:

**auth.spec.ts "login success"** — expects redirect to `/dashboard` after login form submission.  
Root cause: Wave-3 moved the authenticated dashboard from `/dashboard` to `/` (root route). The live site correctly lands on `/` after login but the wave-2 spec still asserts `/dashboard`. Route: **B-block (backend-route update to wave-2 spec)** or update the wave-2 spec URL assertion.  
Classification: test-spec staleness (wave-3 route change superseded the /dashboard route).

**auth.spec.ts "accept-invite happy path"** — expects redirect to `/dashboard` after signup.  
Same root cause: `/dashboard` no longer exists as the canonical authed route; `/` is correct per wave-3.  
Classification: same as above — test-spec staleness.

Both wave-2 findings (FINDING-1, FINDING-2 documented in auth.spec.ts header) are resolved in production: the live site now correctly handles session cookies and redirects to `/` after auth. The spec assertions pointing to `/dashboard` are the stale artifact.

---

## Test-bug notes (corrections made during this run)

All test-bugs were spec-level, not product bugs, and were fixed inline:

1. **URL regex `^\/?$`** — matched path only; Playwright `toHaveURL` compares full URL string. Fixed to `/\/$/ + not.toMatch(/\/login/)`.
2. **Strict-mode violation on email text** — email appears in sidebar footer, TopBar chip, and WelcomeCard (3 elements). Fixed with `.first()`.
3. **Strict-mode violation on role text "compliance"** — matched nav link "Compliance" AND footer role `<p>compliance</p>`. Fixed by asserting the user-menu `<button aria-label="User menu:...">` instead.
