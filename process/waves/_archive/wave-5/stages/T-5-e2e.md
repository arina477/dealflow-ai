# T-5 E2E — wave-5 compliance-settings CRUD UI

**Spec file:** `apps/web/e2e/compliance-settings.spec.ts`
**Browser:** chromium-1208 (via pw-compat shim: chromium-1228 dir → chromium-1208 binary; Playwright 1.61.1)
**Deployment under test:** 13e55ef — `https://dealflow-web-production-a4f7.up.railway.app`
**API:** `https://dealflow-api-production-66d4.up.railway.app`
**Run date:** 2026-07-03 (re-run after CSRF fix)

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

### S2 — Create works in-browser (C-2 FK fix proof): PASS

**Test:** `S2: suppression entry create in-browser — C-2 FK fix + same-origin proxy proof`

**Status: PASS — confirmed in-browser after CSRF fix (main @ 13e55ef)**

**Fix shipped (13e55ef):**
- `apps/web/app/(app)/_lib/apiFetch.ts` — new wrapper injects `rid: 'anti-csrf'` header on every mutation. SuperTokens switched from `antiCsrf: VIA_TOKEN` to `antiCsrf: VIA_CUSTOM_HEADER` on the API side.
- Every state-changing fetch in the web client (including the suppression POST) now calls `apiFetch()` which injects the required header, satisfying SuperTokens VIA_CUSTOM_HEADER verification.

**Observed behavior (re-run 2026-07-03):**
- Compliance user session established correctly (lands on `/`).
- `/compliance/settings` page loaded; Suppression Matrix section rendered.
- "Add Entry" button opened modal (`role="dialog" aria-label="Add Suppression Entry"`).
- Match Type selected: `email`; Email Address filled with labeled test value `t5rerun-<ts>@example.test`.
- Form submitted via "Append Entry" button.
- **POST /compliance/suppression returned 201** — `rid: anti-csrf` header satisfied SuperTokens VIA_CUSTOM_HEADER check; session cookie forwarded correctly via same-origin proxy.
- Response body contained `id`, `value` (lowercased), `matchType: "email"`, `createdAt`.
- Modal closed after successful submission.
- **New entry appeared in the Suppression Matrix list** within the section — visible on the page without reload.

**C-2 FK fix proof result:** CONFIRMED — 201 proves both the CSRF fix (header present → session verified) and the C-2 FK fix (actor_id resolved from session → no DB FK violation). The FK constraint that caused the original C-2 failure is satisfied end-to-end.

**Verdict: PASS — POST /compliance/suppression → 201 in real browser; entry appears in list**

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
| S2: Create works in-browser (C-2-FK-fix proof) | PASS | POST /compliance/suppression → 201; `rid: anti-csrf` header via apiFetch fix @ 13e55ef; entry appears in list |
| S3a: Advisor denied "Rules" nav + direct nav | PASS | RBAC enforced |
| S3b: Unauthenticated /compliance/settings → /login | PASS | RBAC enforced |
| S4: Wave-3/4 regression (login failure) | PASS | Inline error, no redirect |

**Overall: 5/5 PASS — all scenarios green (re-run 2026-07-03 @ 13e55ef)**

---

## Existing spec regression (wave-3/4 specs)

All prior E2E specs remained green across this run (full suite executed 2026-07-03 @ 13e55ef):

| Spec | Tests | Result |
|---|---|---|
| auth.spec.ts (wave-2) | 6 | 6 PASS |
| rbac-appshell.spec.ts (wave-3) | 7 | 7 PASS |
| audit-log.spec.ts (wave-4) | 7 | 7 PASS |
| compliance-settings.spec.ts (wave-5) | 5 | 5 PASS |
| t6-layout.spec.ts (wave-5) | 4 | 4 PASS |
| t6-appshell-layout.spec.ts (wave-5) | 2 | 2 PASS |
| t6-audit-log-layout.spec.ts (wave-5) | 1 | 1 PASS |
| t6-compliance-settings-layout.spec.ts (wave-5) | 1 | 1 PASS |

**Full suite: 33/33 PASS — no regressions introduced.**

---

## Findings

### FINDING-W5-1 (RESOLVED — 13e55ef)

**Symptom (original):** POST /compliance/suppression returned 401 for an authenticated compliance user.

**Root cause (confirmed):** SuperTokens was configured with `antiCsrf: VIA_TOKEN` on the API, but the web client was not sending the required `rid` header on mutations. After the anti-CSRF mode was switched to `VIA_CUSTOM_HEADER` on the API and the `apiFetch` wrapper was introduced to inject `rid: 'anti-csrf'` on every mutation, the 401 is eliminated.

**Resolution (13e55ef):**
- API: `antiCsrf` switched from `VIA_TOKEN` to `VIA_CUSTOM_HEADER` in `apps/api/src/modules/auth/supertokens.config.ts`.
- Web: `apps/web/app/(app)/_lib/apiFetch.ts` wrapper created; all client-side mutation calls updated to use `apiFetch()` which injects `rid: 'anti-csrf'` automatically.

**Verification:** S2 re-run 2026-07-03 — POST /compliance/suppression → 201 in real Chromium browser; new entry appears in the suppression list. FINDING resolved, no further action required.
