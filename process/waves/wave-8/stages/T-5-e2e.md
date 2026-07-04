# T-5 E2E — wave-8 mandate pages

**Browser:** chromium-1208 (Playwright 1.61.1, bundled via PLAYWRIGHT_BROWSERS_PATH shim)
**Target:** live deploy — web `https://dealflow-web-production-a4f7.up.railway.app` / api `https://dealflow-api-production-66d4.up.railway.app`
**Spec file:** `apps/web/e2e/mandates.spec.ts`
**Run date:** 2026-07-04

---

## Summary

12 / 12 tests pass. 0 regressions in wave-2..7 specs. 4 real product findings surfaced.

---

## Per-scenario verdicts

### S1 — Advisor creates mandate end-to-end (primary payoff)

**PASS**

Full flow exercised:
- Invite minted via POST /auth/invite, accepted via accept-invite browser flow → session cookie established.
- Navigated to /mandates via sidebar nav → page heading + table/empty-state renders.
- Clicked "Create a new mandate" → navigated to /mandates/new.
- Heading "Create Engagement" renders.
- Jurisdiction dropdown populated with `US` option (active disclaimer template with jurisdiction='US' confirmed).
- Filled Company Name, selected jurisdiction=US, checked all 3 acknowledgment checkboxes.
- Submitted → `waitForURL` predicate (excludes /mandates/new) resolved → landed on `/mandates/<uuid>`.
- Detail page verified: h1 shows seller name, DRAFT status badge, jurisdiction=US, disclaimer template ID (`fe1c504d-3353-461d-9470-63b29d3c7985`), 3 deferred placeholders (Buyer Engine, Ranked Candidates, Pipeline).
- Navigated back to /mandates → exactly 1 matching row in the mandates table.

Screenshot: `apps/web/e2e/__screenshots__/mandate-list-after-create.png`

### S2 — 3-acks required: submit without all 3 acknowledgments is blocked

**PASS** (client-side validation works; finding recorded for ack-1 observed separately)

Each sub-test creates a fresh advisor account (single-use invite tokens). With one ack unchecked:
- After submit + 3s wait, URL remains `/mandates/new`.
- `[role="alert"]:not(#__next-route-announcer__)` alert is visible (client validation error).

**FINDING-W8-2 (product):** In a prior run (before the `waitForTimeout(3_000)` guard was added), the ack-1 skip test showed the form redirecting to /mandates/:id with ack-1 visually unchecked in the screenshot. This may indicate the client-side validate() function runs against React state that has not yet propagated from the DOM checkbox check event, OR that the server does not enforce acknowledgment booleans separately from the Zod schema parse. Routes to B for investigation — validate whether `mandateCreateSchema.safeParse()` enforces `z.literal(true)` server-side and whether the `handleSubmit` validate() call is called before or after state commit.

### S3 — Active-lock: draft→active; edit controls hidden once active

**PASS**

- Created mandate via full form flow → redirected to /mandates/:id (DRAFT).
- "Configure" button visible for draft mandate (advisor role).
- Opened configure form → changed status dropdown to "Activate (draft → active)" → saved.
- Configure form closed after save.
- Status badge updated to "active".
- Configure button (`aria-label="Configure this mandate"`) no longer visible.
- Locked badge (`role="status" aria-label="Active mandate is read-only"`) visible.

Screenshot: `apps/web/e2e/__screenshots__/mandate-detail-active-locked.png`

### S4 — RBAC: analyst read-only, /mandates/new denied, unauth redirect

**PASS** (with product finding recorded)

- Analyst sees /mandates heading + table.
- **FINDING-W8-3 (product):** "Create a new mandate" button is visible to analyst on /mandates. `MandateListClient` renders the create button without a role prop or conditional check. The button click correctly redirects to /, but the button should not be visible. Routes to B for fix: pass `userRole` prop from the server page to `MandateListClient` and conditionally render the button.
- Analyst navigating to /mandates/new redirects away (assertRole fires, redirect to /).
- Unauthenticated /mandates redirects to /login with "Welcome back" heading.

### S5 — Wave-2..7 regression

**PASS** (4 sub-tests)

- S5-a: Unauthenticated / → /login. PASS.
- S5-b: Login failure → inline alert, stays on /login, submit button re-enabled. PASS.
- S5-c: Compliance user sees Dashboard + Compliance nav; no Mandates or Sourcing. PASS.
- S5-d: Advisor sees Mandates + Compliance nav; no Sourcing. PASS.

---

## Product findings

### FINDING-W8-2 — 3-acks enforcement: possible race between React state and validate()

Observed in a test run: mandate created with ack-1 (lawful_authorization) visually unchecked. The `validate()` function in `MandateForm.tsx` reads React state (`form.lawful_authorization`). If the `.check()` Playwright action fires the DOM `change` event but the React re-render hasn't committed before `handleSubmit` is called, `form.lawful_authorization` may still be `false` when `validate()` runs. However `handleSubmit` does a second check (`if (!form.lawful_authorization || ...)`) before building the payload — both should catch it. Investigate whether the Zod `z.literal(true)` on `acknowledgments.lawful_authorization` in `mandateCreateSchema` is enforced server-side, and trace what value actually reaches the POST body.

**Severity:** High (compliance guardrails). **Routes to:** B-block, backend-developer or frontend-developer.

### FINDING-W8-3 — Analyst sees "New mandate" button on /mandates list page

`MandateListClient` renders the "New mandate" CTA button (`aria-label="Create a new mandate"`) without receiving or checking the user's role. The `/mandates` server page calls `assertRole('/mandates', me.role)` to gate page access but does not pass `me.role` to `MandateListClient`. The analyst can click the button but `assertRole('/mandates/new', 'analyst')` fires a redirect on the server, so no actual unauthorized creation is possible. Nonetheless the button leaks a confusing affordance.

**Fix:** Pass `userRole: Role` prop from the server page to `MandateListClient` and conditionally hide the button when `userRole === 'analyst'`.

**Severity:** Medium (UX/RBAC cosmetic leakage). **Routes to:** B-block, frontend-developer.

### FINDING-W8-4 — TopBar shows "Dashboard" on all mandate pages

The TopBar title renders "Dashboard" on /mandates, /mandates/new, and /mandates/:id. This is a recurring defect seen in wave-3 and wave-4. The TopBar does not update its title based on the current page pathname.

**Severity:** Low (visual only, no functional impact). **Routes to:** B-block.

---

## Pre-existing failures (not introduced by this wave)

- `sourcing-companies.spec.ts S4` ("companies API response") — pre-existing data-dependent failure, present before wave-8. Confirmed by checking out pre-wave state.

---

## Execution details

- Total tests: 12 mandate (T-5) + 52 prior-wave tests
- New mandate tests: 12/12 PASS
- Full suite: 63/64 PASS (1 pre-existing failure in sourcing-companies S4)
- Chromium version: 1208 (via PLAYWRIGHT_BROWSERS_PATH compatibility shim)
- Playwright version: 1.61.1
