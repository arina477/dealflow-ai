# Wave 4 — T-5 E2E: Audit-Log Integrity View

**Browser:** chromium-1208 (via PLAYWRIGHT_BROWSERS_PATH compat shim; playwright@1.61.1)
**Target:** LIVE production — web https://dealflow-web-production-a4f7.up.railway.app · api https://dealflow-api-production-66d4.up.railway.app
**Spec file:** `apps/web/e2e/audit-log.spec.ts`
**Run date:** 2026-07-03
**Total tests:** 7 · **Passed:** 7 · **Failed:** 0 · **Execution time:** 11.4s

---

## Per-Scenario Verdicts

### S1: Compliance user — "Audit Log" nav visible + page accessible
**PASS**

- Compliance invite minted, session established via accept-invite browser flow.
- Landed on `/` (not `/login`) — confirms session cookie set correctly.
- Sidebar `nav[aria-label="Main navigation"]` collected labels → `"Audit Log"` present.
- Clicked "Audit Log" nav link → navigated to `/compliance/audit-log`.
- Page heading `<h2>Audit Log Integrity</h2>` visible within 10s.

---

### S2: Chain-verified state — IntegrityPanel shows ok:true
**PASS**

- Navigated to `/compliance/audit-log` with compliance session.
- `section[aria-label="Chain integrity status"]` (IntegrityPanel) visible.
- `role="status"` element with aria-label `/all entries verified/i` visible — this is the emerald pill rendered by `<VerifiedState>` when `result.ok === true`.
- "Entries checked" label visible in the `<dl>` stat group.
- "Verify now" button visible and enabled in the panel header.
- `role="status"` element with aria-label `/integrity status unavailable/i` NOT visible — UnavailableState correctly absent.
- Prod DB has **3 audit entries** (confirmed by T-6 screenshot showing ENTRIES CHECKED = 3). Chain intact: ok:true.

---

### S3: "Verify now" works — same-origin proxy confirms B-6 fix
**PASS — B-6-FIX CONFIRMED IN REAL BROWSER**

This is the critical scenario proving the B-6 fix (commit `19a298b`) works end-to-end.

**Mechanism under test:**
The pre-fix `IntegrityPanel` called `fetch('https://dealflow-api-production-66d4.up.railway.app/compliance/audit-log/verify')` — a cross-origin fetch. The browser's session cookie is `httpOnly` on the web origin; it cannot be sent cross-origin. The API returned 401 (no cookie) → `res.ok` false → `setResult(null)` → UnavailableState rendered. This was the B-6 bug.

**The fix:** `next.config.ts` adds an `afterFiles` rewrite: `source: '/compliance/audit-log/verify'` → `destination: ${apiProxyTarget}/compliance/audit-log/verify`. `IntegrityPanel` now calls `fetch('/compliance/audit-log/verify', ...)` — same-origin. The browser sends the session cookie automatically. The response proxies back through Next.js.

**Evidence captured:**
- `page.waitForResponse(url.includes('/compliance/audit-log/verify'))` intercepted the XHR.
- Response status: **200** (not 401/403).
- Response body: `{ ok: true, entriesChecked: 3 }` — API confirmed chain is intact with cookie sent.
- After verify completes, `role="status"[aria-label=/all entries verified/i]` remains visible.
- `role="status"[aria-label=/integrity status unavailable/i]` NOT visible — UnavailableState NOT rendered.

**Verdict: verify-now works in real browser via same-origin proxy. B-6 fix is proven functional.**

---

### S4a: RBAC — advisor has no "Audit Log" nav item
**PASS**

- Advisor user session established. Nav labels collected.
- "Dashboard" present, "Compliance" present (per rbac.ts: advisor is in NAV_COMPLIANCE.allowedRoles).
- "Audit Log" NOT present — NAV_AUDIT_LOG.allowedRoles = ['compliance'] only. Correct per spec.

---

### S4b: RBAC — advisor direct navigation to /compliance/audit-log denied
**PASS**

- Advisor with active session navigated directly to `/compliance/audit-log`.
- `assertRole('/compliance/audit-log', 'advisor')` → `canAccess('advisor', '/compliance/audit-log')` = false → `redirect('/')`.
- Final URL matched `/^https?:\/\/.*\/(login)?$/` — page did NOT stay on `/compliance/audit-log`.
- Confirmed: assertRole server-side redirect works; client-side nav suppression is not the only guard.

---

### S4c: RBAC — unauthenticated /compliance/audit-log → /login
**PASS**

- Fresh browser context (no cookies) → GET `/compliance/audit-log`.
- `(app)/layout.tsx` fetches `/auth/me` → 401 → `redirect('/login')`.
- Final URL: `/login`. Login page heading "Welcome back" visible.

---

### S5: Wave-3 regression — login-failure inline error
**PASS**

- Wrong credentials submitted on `/login`.
- `role="alert"` visible within 12s; page stayed on `/login`; submit button re-enabled.
- Wave-3 regression confirmed green.

---

## Pre-existing spec regression check

Ran `auth.spec.ts`, `rbac-appshell.spec.ts`, `t6-appshell-layout.spec.ts` alongside the new spec.

**14/15 tests pass. 1 pre-existing FAILURE in `auth.spec.ts`:**

- **Test:** `login success > fills login form and redirects to /`
- **Error:** `strict mode violation: getByText('<email>') resolved to 3 elements`
- **Classification: TEST-BUG (pre-existing in auth.spec.ts, NOT caused by this wave)**
- **Root cause:** `auth.spec.ts` line 130 uses `page.getByText(testEmail)` without `.first()`. The wave-3 AppShell fix (FINDING-2 resolved: session now sets cookie → user lands on `/` with AppShell rendered) causes the email to appear in 3 places: sidebar footer `<p>`, WelcomeCard `<span>`, and `<strong>`. The locator is now ambiguous. The test comment at line 124 states "When FINDING-1 is fixed, this assertion should pass" — the wave-3 fix did land; the locator needs `.first()` or a role-scoped query.
- **Route:** B (Iron Law — test-bug in pre-existing spec; orchestrator routes to B-block fix, not fixed here inline).
- **This wave's new spec is NOT affected.** All 7 new tests in `audit-log.spec.ts` pass.

---

## Findings Summary

| # | Type | Severity | Description | Disposition |
|---|---|---|---|---|
| 1 | Product-bug proof | n/a | B-6 verify-now same-origin proxy confirmed working in real browser | CONFIRMED FIXED (19a298b) |
| 2 | Test-bug | Low | `auth.spec.ts` line 130: `getByText(email)` strict-mode violation (3 elements) | Route to B for fix |

---

## Chromium version

`chromium-1208` (bundled via PLAYWRIGHT_BROWSERS_PATH=$HOME/.local/share/pw-compat compat shim mapping chromium-1228 dir names to 1208 binaries).
