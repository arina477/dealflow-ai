/**
 * T-5 E2E — wave-4 audit-log integrity view (real-browser, chromium-1208/1228 shim)
 *
 * Targets LIVE production deployment.
 *   web baseURL: https://dealflow-web-production-a4f7.up.railway.app
 *   api:         https://dealflow-api-production-66d4.up.railway.app
 *
 * Feature under test: /compliance/audit-log — Audit Log Integrity View (wave-4).
 *   - Integrity panel: verified/broken/unavailable states
 *   - "Verify now" button → same-origin proxy → /compliance/audit-log/verify
 *   - RBAC: compliance role only sees nav + page; advisor denied nav item;
 *     unauthenticated → /login
 *
 * B-6 fix under proof: same-origin proxy rewrite in next.config.ts afterFiles
 * maps /compliance/audit-log/verify → API (cookie sent as first-party).
 * The pre-fix behaviour was a cross-origin fetch failure → "unavailable" state.
 * This spec proves the fix: verify-now must stay on verified state (ok:true),
 * NOT fall to UnavailableState.
 *
 * Scenarios:
 *   S1. compliance user sees "Audit Log" nav item and lands on /compliance/audit-log
 *   S2. integrity view shows VERIFIED state (ok:true, entriesChecked, "All entries verified")
 *   S3. "Verify now" works: calls verify → stays verified (NOT unavailable) — B-6-fix proof
 *   S4. RBAC: advisor has no "Audit Log" nav; navigating directly → redirected (not /compliance/audit-log)
 *       unauthenticated /compliance/audit-log → /login
 *   S5. wave-3 regression: login-failure stays on /login (inline error)
 *
 * Test emails: fresh unique per run (e2e+<label>+<ts>@example.com).
 */

import path from 'node:path';
import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://dealflow-api-production-66d4.up.railway.app';
const WEB_ORIGIN = 'https://dealflow-web-production-a4f7.up.railway.app';
const TEST_PASSWORD = 'Str0ngPassw0rd!';

// Screenshot output directory — parallel to existing spec screenshots.
const SCREENSHOT_DIR = path.join(__dirname, '__screenshots__');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mint an invite via POST /auth/invite with a given role.
 * Returns the raw invite token string. Throws on non-2xx.
 */
async function mintInvite(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  email: string,
  role: string
): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/invite`, {
    headers: {
      'Content-Type': 'application/json',
      Origin: WEB_ORIGIN,
    },
    data: { email, role },
  });
  if (!res.ok()) {
    throw new Error(
      `mintInvite failed: ${res.status()} ${await res.text()} email=${email} role=${role}`
    );
  }
  const body = (await res.json()) as { token: string; expiry: string };
  return body.token;
}

/**
 * Complete the accept-invite flow in the browser to establish a real session cookie.
 * Navigate to /accept-invite?token=<token>, fill password, submit.
 * After the session is established the server redirects to /.
 *
 * Waits for post-submit navigation to settle (either / or /login).
 * Caller asserts the final URL.
 */
async function acceptInviteInBrowser(
  page: import('@playwright/test').Page,
  token: string,
  password: string = TEST_PASSWORD
): Promise<void> {
  await page.goto(`/accept-invite?token=${encodeURIComponent(token)}`);
  await expect(
    page.getByRole('heading', { name: 'Set up your account' }),
    'Accept-invite form must render with valid token'
  ).toBeVisible({ timeout: 15_000 });

  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Accept & create account' }).click();

  // Wait for post-submit navigation — either / (success) or /login (FINDING-2 regression).
  await page.waitForURL(/\/(login|)$/, { timeout: 20_000 });
}

/**
 * Returns visible nav link labels from the sidebar navigation.
 * The sidebar uses role="navigation" with aria-label="Main navigation".
 */
async function getNavLabels(page: import('@playwright/test').Page): Promise<string[]> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav, 'Sidebar nav must be present in authed shell').toBeVisible({ timeout: 10_000 });
  const links = nav.getByRole('link');
  const count = await links.count();
  const labels: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await links.nth(i).innerText();
    const trimmed = text.trim();
    if (trimmed) labels.push(trimmed);
  }
  return labels;
}

// ---------------------------------------------------------------------------
// S1: Compliance user — sees "Audit Log" nav + lands on /compliance/audit-log
// ---------------------------------------------------------------------------

test.describe('S1: compliance user — Audit Log nav visible + page accessible', () => {
  let complianceToken: string;
  let complianceEmail: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    complianceEmail = `e2e+w4-audit-s1+${ts}@example.com`;
    complianceToken = await mintInvite(request, complianceEmail, 'compliance');
  });

  test('compliance: sidebar shows "Audit Log" nav item; clicking lands on /compliance/audit-log', async ({
    page,
  }) => {
    // Arrange: establish compliance session via accept-invite.
    await acceptInviteInBrowser(page, complianceToken);
    await expect(page, 'Must land on / after invite acceptance').toHaveURL(/\/$/, {
      timeout: 5_000,
    });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

    // Assert: sidebar nav includes "Audit Log".
    const labels = await getNavLabels(page);
    expect(labels, 'compliance nav must contain "Audit Log"').toContain('Audit Log');

    // Act: click the "Audit Log" nav item.
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('link', { name: 'Audit Log' }).click();

    // Assert: lands on /compliance/audit-log.
    await expect(page, 'Click must navigate to /compliance/audit-log').toHaveURL(
      /\/compliance\/audit-log/,
      { timeout: 15_000 }
    );

    // Assert: page heading "Audit Log Integrity" is visible.
    await expect(
      page.getByRole('heading', { name: 'Audit Log Integrity' }),
      'Page heading "Audit Log Integrity" must be visible'
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// S2: Chain-verified state — integrity view shows ok:true ("All entries verified")
// ---------------------------------------------------------------------------

test.describe('S2: integrity view — VERIFIED state renders (ok:true)', () => {
  let complianceToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `e2e+w4-audit-s2+${ts}@example.com`;
    complianceToken = await mintInvite(request, email, 'compliance');
  });

  test('IntegrityPanel shows verified state: emerald status pill + entriesChecked visible', async ({
    page,
  }) => {
    // Arrange: establish compliance session.
    await acceptInviteInBrowser(page, complianceToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url()).not.toMatch(/\/login/);

    // Act: navigate directly to the audit-log page.
    await page.goto('/compliance/audit-log');
    await expect(page).toHaveURL(/\/compliance\/audit-log/, { timeout: 15_000 });

    // Assert: the integrity panel section renders.
    const integritySection = page.getByRole('region', { name: 'Chain integrity status' });
    await expect(
      integritySection,
      'IntegrityPanel section[aria-label="Chain integrity status"] must be visible'
    ).toBeVisible({ timeout: 10_000 });

    // Assert: "All entries verified" pill is visible (ok:true → VerifiedState).
    // The status pill carries role="status" and the text "All entries verified".
    // This is the definitive ok:true indicator — its presence proves the chain is intact.
    await expect(
      integritySection.getByRole('status', { name: /all entries verified/i }),
      '"All entries verified" status pill must be visible (ok:true → VerifiedState)'
    ).toBeVisible({ timeout: 10_000 });

    // Assert: "Entries checked" label is visible (entriesChecked in the dl).
    await expect(
      integritySection.getByText(/Entries checked/i),
      '"Entries checked" label must be present in VerifiedState'
    ).toBeVisible();

    // Assert: "Verify now" button is visible in the panel header.
    await expect(
      integritySection.getByRole('button', { name: /verify.*chain integrity/i }),
      '"Verify now" button must be present in the panel header'
    ).toBeVisible();

    // Assert: UnavailableState is NOT rendered (would only show if verify fails).
    await expect(
      integritySection.getByRole('status', { name: /integrity status unavailable/i }),
      'UnavailableState must NOT be shown when chain is intact'
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// S3: "Verify now" works — same-origin proxy fix (B-6 proof)
// ---------------------------------------------------------------------------

test.describe('S3: verify-now action — same-origin proxy works; stays verified (B-6-fix proof)', () => {
  let complianceToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `e2e+w4-audit-s3+${ts}@example.com`;
    complianceToken = await mintInvite(request, email, 'compliance');
  });

  test('clicking "Verify now" calls /compliance/audit-log/verify and panel stays/returns to verified; NOT unavailable', async ({
    page,
  }) => {
    // Arrange: compliance user session + audit-log page loaded.
    await acceptInviteInBrowser(page, complianceToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url()).not.toMatch(/\/login/);

    await page.goto('/compliance/audit-log');
    await expect(page).toHaveURL(/\/compliance\/audit-log/, { timeout: 15_000 });

    const integritySection = page.getByRole('region', { name: 'Chain integrity status' });
    await expect(integritySection).toBeVisible({ timeout: 10_000 });

    // Instrument: intercept XHR to /compliance/audit-log/verify to verify
    // the same-origin proxy is called correctly and returns ok:true.
    const verifyResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/compliance/audit-log/verify') && response.request().method() === 'GET',
      { timeout: 15_000 }
    );

    // Act: click "Verify now".
    const verifyButton = integritySection.getByRole('button', { name: /verify.*chain integrity/i });
    await expect(verifyButton, '"Verify now" button must be enabled before click').toBeEnabled();
    await verifyButton.click();

    // Assert (network): the request was made to /compliance/audit-log/verify
    // and the response was ok:true. This is the B-6-fix proof — before the fix,
    // the fetch was cross-origin (to the API directly) and failed with CORS/cookie
    // issues, causing "unavailable" state. The afterFiles proxy now serves it
    // same-origin, so the first-party cookie is sent and the response is ok.
    const verifyResponse = await verifyResponsePromise;
    expect(
      verifyResponse.status(),
      'Verify endpoint must return 200 via same-origin proxy'
    ).toBe(200);

    // Parse the response body to confirm ok:true.
    const verifyBody = (await verifyResponse.json()) as { ok: boolean; entriesChecked?: number };
    expect(
      verifyBody.ok,
      'Verify response ok must be true (intact chain); B-6-fix proof: same-origin cookie sent'
    ).toBe(true);

    // Assert (UI): After verify completes, the panel must show VERIFIED state.
    // The "All entries verified" pill must be present — NOT the "unavailable" state.
    // Wait for loading to complete (button returns to "Verify now" label).
    await expect(
      integritySection.getByRole('button', { name: 'Verify chain integrity now' }),
      'Button must return to "Verify chain integrity now" label after load completes'
    ).toBeEnabled({ timeout: 15_000 });

    await expect(
      integritySection.getByRole('status', { name: /all entries verified/i }),
      '"All entries verified" must remain visible after verify-now completes (NOT unavailable) — B-6-fix proof'
    ).toBeVisible({ timeout: 10_000 });

    // Assert (critical): UnavailableState must NOT be rendered.
    // This is the exact pre-fix failure mode: a cross-origin fetch would CORS-fail
    // and the catch block would setResult(null) → UnavailableState.
    await expect(
      integritySection.getByRole('status', { name: /integrity status unavailable/i }),
      'UnavailableState MUST NOT appear after verify-now — this would indicate the B-6 proxy fix is broken'
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// S4: RBAC — advisor no "Audit Log" nav; direct nav denied; unauth → /login
// ---------------------------------------------------------------------------

test.describe('S4a: RBAC — advisor has no "Audit Log" nav item', () => {
  let advisorToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `e2e+w4-audit-s4a+${ts}@example.com`;
    advisorToken = await mintInvite(request, email, 'advisor');
  });

  test('advisor: "Audit Log" nav item is absent in sidebar', async ({ page }) => {
    await acceptInviteInBrowser(page, advisorToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url()).not.toMatch(/\/login/);

    const labels = await getNavLabels(page);
    // Advisor DOES see Dashboard + Mandates + Compliance (per rbac.ts matrix).
    expect(labels, 'advisor must see Dashboard').toContain('Dashboard');
    expect(labels, 'advisor must see Compliance').toContain('Compliance');
    // Advisor must NOT see "Audit Log" — compliance-only nav item.
    expect(labels, 'advisor must NOT see "Audit Log" nav item').not.toContain('Audit Log');
  });
});

test.describe('S4b: RBAC — advisor navigating directly to /compliance/audit-log is denied', () => {
  let advisorToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `e2e+w4-audit-s4b+${ts}@example.com`;
    advisorToken = await mintInvite(request, email, 'advisor');
  });

  test('advisor: direct GET /compliance/audit-log redirects away (assertRole → redirect to /)', async ({
    page,
  }) => {
    // Establish advisor session.
    await acceptInviteInBrowser(page, advisorToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url()).not.toMatch(/\/login/);

    // Act: attempt direct navigation to the compliance audit-log page.
    await page.goto('/compliance/audit-log');

    // Assert: must NOT end up on /compliance/audit-log.
    // assertRole() redirects to '/' for unauthorised roles.
    // Wait for navigation to settle.
    await page.waitForURL(/\/(login|)$/, { timeout: 15_000 });
    expect(
      page.url(),
      'Advisor must NOT stay on /compliance/audit-log — assertRole must redirect'
    ).not.toMatch(/\/compliance\/audit-log/);
  });
});

test.describe('S4c: RBAC — unauthenticated /compliance/audit-log → /login', () => {
  test('unauthenticated hit on /compliance/audit-log redirects to /login', async ({ page }) => {
    // Fresh browser context — no session cookies.
    await page.goto('/compliance/audit-log');

    // The (app) layout checks /auth/me → 401 → redirect('/login').
    await expect(page, 'Unauthenticated /compliance/audit-log must redirect to /login').toHaveURL(
      /\/login/,
      { timeout: 15_000 }
    );

    // Login page must render (not a blank page or error).
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
      'Login page heading must be visible after unauth redirect'
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// S5: wave-3 regression — login-failure stays on /login (inline error)
// ---------------------------------------------------------------------------

test.describe('S5: wave-3 regression — login-failure still produces inline error', () => {
  test('wrong credentials show role="alert" and stay on /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    await page.getByLabel('Email address').fill('e2e+w4-regression-fail@example.com');
    await page.getByLabel('Password', { exact: true }).fill('WrongPassw0rd!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(
      page.getByRole('alert'),
      'Inline error alert must appear on wrong credentials (wave-3 regression)'
    ).toBeVisible({ timeout: 12_000 });

    await expect(page, 'Page must stay on /login after failed login').toHaveURL(/\/login/);

    await expect(
      page.getByRole('button', { name: /sign in/i }),
      'Submit button must be re-enabled after failed attempt'
    ).toBeEnabled();
  });
});
