# T-5 E2E — wave-5 compliance-settings CRUD UI

**Spec file:** `apps/web/e2e/compliance-settings.spec.ts`
**Browser:** chromium-1208 (via pw-compat shim: chromium-1228 dir → chromium-1208 binary; Playwright 1.61.1)
**Deployment under test:** ce97423 — `https://dealflow-web-production-a4f7.up.railway.app`
**API:** `https://dealflow-api-production-66d4.up.railway.app`
**Run date:** 2026-07-03

---

## Per-scenario verdicts

### S1 — Compliance user sees the settings UI: PASS

**Test:** `S1: compliance user — "Rules" nav item + /compliance/settings renders all 3 sections`

Evidence:
- Invite minted via POST /auth/invite (compliance role); accept-invite browser flow establishes real session cookie.
- Post-invite navigation lands on `/` (not `/login`) — session cookie set correctly.
- Sidebar (role="navigation" aria-label="Main navigation") contains "Rules" nav item (NAV_COMPLIANCE_SETTINGS, icon=sliders, route=/compliance/settings).
- Clicking "Rules" nav link navigates to `/compliance/settings` within 15s.
- Page heading "Compliance Rules Engine" (h2) visible.
- Section 1: `<section aria-label="Approval and gating policy">` renders with heading "Approval & Gating Policy".
- Section 2: `<section aria-label="Suppression matrix">` renders with heading "Suppression Matrix".
- Section 3: `<section aria-label="Jurisdiction templates">` renders with heading "Jurisdiction Templates".

**Verdict: PASS** — the settings UI is fully accessible to the compliance role.

---

### S2 — Create works in-browser (C-2 FK fix proof): FAIL — REAL PRODUCT BUG

**Test:** `S2: suppression entry create in-browser — C-2 FK fix + same-origin proxy proof`

**Status: FAIL (both attempts, retried once)**

**Observed behavior:**
- Compliance user session established correctly (lands on `/`).
- `/compliance/settings` page loaded and suppression matrix section rendered.
- "Add Entry" button opened the modal correctly (`role="dialog" aria-label="Add Suppression Entry"`).
- Match Type selected: `email`; Email Address filled: `t5-test-<ts>@example.test`.
- Form submitted via "Append Entry" button.
- **POST /compliance/suppression returned 401** `{"message":"Unauthorized","statusCode":401}`.
- The component's catch branch showed inline `role="alert"`: `"Failed to add entry (401): {"message":"Unauthorized","statusCode":401}"`.
- Modal remained open showing the error; no entry was created.

**Root cause diagnosis (Iron Law — classified, not fixed):**
The same-origin proxy (next.config.ts `afterFiles: [{ source: '/compliance/suppression', destination: ... }]`) routes the POST through the Next.js rewrite to the API. The session cookie IS present (the user is authenticated on the web origin — the compliance/settings page SSR succeeded, confirming the session). The 401 on the POST means one of:
  1. The CORS/session cookie forwarding via the afterFiles rewrite is not sending the `st-access-token` cookie on the POST to the internal API, OR
  2. The SuperTokens session middleware on the NestJS side is rejecting the POST request — the rewrite may be stripping the `cookie` header or sending to a URL pattern the session middleware does not cover for mutations, OR
  3. The wave-4/5 CORS / SuperTokens middleware ordering issue (similar to FINDING-1 in wave-2 auth.spec.ts) is present specifically for POST on the suppression route.

**Classification:** Product bug — same-origin proxy does not forward the session cookie on POST /compliance/suppression mutations. Routed to B (Backend/Infrastructure fix) per Iron Law. Do NOT workaround in the spec.

**Ticket note for B-block:** "POST /compliance/suppression returns 401 for an authenticated compliance user via the same-origin proxy. The session cookie is present (SSR of /compliance/settings succeeds). The proxy rewrite in next.config.ts afterFiles must be verified to forward cookie headers on POST/PATCH/DELETE mutations. Wave-4's GET /compliance/audit-log/verify worked because it is a GET — the cookie forwarding issue may be specific to mutating methods or to how SuperTokens session verification processes the proxied request."

**C-2 FK fix proof result:** INCONCLUSIVE — the 401 fires before the FK constraint check at the DB layer. The FK fix introduced in C-2 cannot be verified until the 401 upstream issue is resolved. This S2 test provides the harness to re-run that verification once the proxy/auth issue is fixed.

**Verdict: FAIL (real product bug, not a test bug)**

---

### S3 — RBAC: PASS (both sub-scenarios)

**S3a — advisor denied:**
- Advisor user's sidebar does NOT contain "Rules" nav item.
- Advisor DOES see "Dashboard" and "Compliance" (correct per rbac.ts matrix).
- Direct GET `/compliance/settings` as advisor: `assertRole()` redirects to `/` (not on /compliance/settings after waitForURL).

**S3b — unauthenticated denied:**
- Fresh context (no cookies): `/compliance/settings` redirects to `/login`.
- "Welcome back" heading visible after redirect.

**Verdict: PASS** — RBAC is correctly enforced: compliance-only page, advisor denied, unauthenticated denied.

---

### S4 — Wave-3/4 regression: PASS

- Wrong credentials → inline `role="alert"` appears within 12s.
- Page stays on `/login` (no redirect on failure).
- Submit button re-enabled after failed attempt.

**Verdict: PASS** — wave-3/4 regression green.

---

## Summary

| Scenario | Verdict | Notes |
|---|---|---|
| S1: Compliance user sees settings UI | PASS | All 3 sections render; sidebar "Rules" nav works |
| S2: Create works in-browser (C-2-FK-fix proof) | FAIL (real product bug) | POST /compliance/suppression → 401; proxy not forwarding session cookie on mutations |
| S3a: Advisor denied "Rules" nav + direct nav | PASS | RBAC enforced |
| S3b: Unauthenticated /compliance/settings → /login | PASS | RBAC enforced |
| S4: Wave-3/4 regression (login failure) | PASS | Inline error, no redirect |

**Overall: 4/5 PASS, 1/5 FAIL (real product bug — route to B)**

---

## Existing spec regression (wave-3/4 specs)

All prior E2E specs remained green across this run:

| Spec | Tests | Result |
|---|---|---|
| auth.spec.ts (wave-2) | 6 | 6 PASS |
| rbac-appshell.spec.ts (wave-3) | 7 | 7 PASS |
| audit-log.spec.ts (wave-4) | 7 | 7 PASS |

**No regressions introduced.**

---

## Findings

### FINDING-W5-1 (real product bug — route to B)

**Symptom:** POST /compliance/suppression returns 401 for an authenticated compliance user (session established via accept-invite flow, landing on / confirmed).

**Evidence:**
- HTTP status: 401
- Response body: `{"message":"Unauthorized","statusCode":401}`
- UI error: modal inline `role="alert"` shows `"Failed to add entry (401)..."`
- Page snapshot shows form filled, session active (sidebar shows compliance email + role)

**Classification:** Backend / Proxy bug. The same-origin proxy (next.config.ts `afterFiles`) is not correctly forwarding the session cookie for POST mutations to /compliance/suppression (and likely /compliance/rules, /compliance/disclaimers by extension). GET requests work (SSR of /compliance/settings page succeeds with the same cookie). Likely cause: SuperTokens session verification on the NestJS side rejects the proxied POST due to missing or malformed cookie header.

**Action:** Route to B per Iron Law (symptom → proxy/auth domain → backend-developer / devops-engineer). Do not workaround in the test spec; the spec is correct and will pass once the proxy cookie-forwarding issue is fixed.
