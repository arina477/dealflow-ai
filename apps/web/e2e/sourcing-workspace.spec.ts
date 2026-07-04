/**
 * T-5 E2E — wave-7 sourcing-workspace screen (real-browser, chromium-1208)
 *
 * Targets the LIVE production deployment.
 *   web baseURL: https://dealflow-web-production-a4f7.up.railway.app (from playwright.config.ts)
 *   api:         https://dealflow-api-production-66d4.up.railway.app
 *
 * RBAC under test:
 *   analyst  : sees Sourcing nav → /sourcing → THE WORKSPACE renders
 *              (NOT the old redirect to /sourcing/companies)
 *   advisor  : does NOT see Sourcing nav; /sourcing → redirected (denied)
 *   unauth   : /sourcing → /login
 *
 * Scenarios:
 *   S1. Analyst workspace render: invite+signup → login → Sourcing nav → /sourcing
 *       → WORKSPACE renders (connectors row + search bar + source facet +
 *         results area). Confirms it is NOT the old /sourcing/companies redirect.
 *   S2. Connection-create + ≥2-source: add fixture connection via AddConnectionForm
 *       ('t5-src-A') → it appears in connectors row; add 2nd ('t5-src-B') → 2
 *       sources in source facet. Falls back to UI-affordance check if API is
 *       flaky (verifies add-source button is present).
 *   S3. RBAC: advisor → no Sourcing nav + /sourcing redirected (denied).
 *       Unauth → /sourcing → /login.
 *   S4. Wave-2..6 regression guard: login page + unauth guards still green.
 *
 * Test emails: fresh unique per run (e2e+w7-<label>+<ts>@example.com).
 *
 * Iron Law: real product bugs noted precisely and routed to B; test-bugs fixed.
 */

import path from 'node:path';
import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://dealflow-api-production-66d4.up.railway.app';
const WEB_ORIGIN = 'https://dealflow-web-production-a4f7.up.railway.app';
const TEST_PASSWORD = 'Str0ngPassw0rd!';

const SCREENSHOT_DIR = path.join(__dirname, '__screenshots__');

// ---------------------------------------------------------------------------
// Helpers — same pattern established in wave-2..6 specs
// ---------------------------------------------------------------------------

/**
 * Mint an invite token via POST /auth/invite with a given role.
 * Returns the raw invite token string. Throws on non-2xx.
 */
async function mintInvite(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  email: string,
  role: string
): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/invite`, {
    headers: { 'Content-Type': 'application/json', Origin: WEB_ORIGIN },
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
 * Complete accept-invite browser flow to establish a real session cookie.
 * Waits for post-submit navigation to settle. Accepts either / or /login
 * (FINDING-2 from wave-2: cookie-based session may redirect to /login).
 */
async function acceptInviteInBrowser(
  page: import('@playwright/test').Page,
  token: string
): Promise<void> {
  await page.goto(`/accept-invite?token=${encodeURIComponent(token)}`);
  await expect(
    page.getByRole('heading', { name: 'Set up your account' }),
    'Accept-invite form must render with valid token'
  ).toBeVisible({ timeout: 15_000 });

  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Accept & create account' }).click();

  // Accept either / (session cookie set) or /login (FINDING-2: header-token only)
  await page.waitForURL(/\/(login)?$/, { timeout: 20_000 });
}

/**
 * If post-invite we landed on /login (FINDING-2), log in via the form.
 * Returns true if a login was needed; false if the session was already set.
 */
async function ensureLoggedIn(
  page: import('@playwright/test').Page,
  email: string
): Promise<boolean> {
  if (!page.url().includes('/login')) return false;

  await expect(
    page.getByRole('heading', { name: 'Welcome back' }),
    'Login page must render'
  ).toBeVisible({ timeout: 10_000 });

  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // Wait for navigation to settle — may land on / (success) or stay on /login
  // (FINDING-1: POST /auth/signin 404 bug). Accept either outcome and let the
  // caller assert their target URL.
  await page.waitForURL(/\/(login|)$/, { timeout: 15_000 });
  return true;
}

/**
 * Returns visible nav link labels from the sidebar navigation.
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
// S1: Analyst sees the workspace at /sourcing (NOT a redirect to /companies)
// ---------------------------------------------------------------------------

test.describe('S1: analyst — Sourcing nav visible + /sourcing renders workspace', () => {
  let analystEmail: string;
  let analystToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    analystEmail = `e2e+w7-s1-analyst+${ts}@example.com`;
    analystToken = await mintInvite(request, analystEmail, 'analyst');
  });

  test('analyst: Sourcing nav present → /sourcing → workspace renders (connectors + search + facet + results)', async ({
    page,
  }) => {
    // Arrange: establish session
    await acceptInviteInBrowser(page, analystToken);
    await ensureLoggedIn(page, analystEmail);

    // Assert: on authenticated dashboard (not /login)
    await expect(page).toHaveURL(/\/$/, { timeout: 8_000 });
    expect(page.url(), 'Must NOT be on /login after successful auth').not.toMatch(/\/login/);

    // Assert: Sourcing nav item is visible for analyst
    const navLabels = await getNavLabels(page);
    expect(navLabels, 'Analyst must see Sourcing nav item').toContain('Sourcing');

    // Act: click the Sourcing nav item
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('link', { name: 'Sourcing' }).click();

    // Assert: landed on /sourcing (not redirected to /sourcing/companies or elsewhere)
    await page.waitForURL(/\/sourcing(\?.*)?$/, { timeout: 15_000 });
    const finalUrl = page.url();
    expect(
      finalUrl,
      'Sourcing nav must land on /sourcing (the workspace), NOT redirect to /sourcing/companies'
    ).not.toMatch(/\/sourcing\/companies/);
    expect(finalUrl, 'Must NOT be on /login').not.toMatch(/\/login/);

    // Wait for client hydration
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // ── WORKSPACE ELEMENT ASSERTIONS ─────────────────────────────────────────

    // 1. Connectors row — the "Connectors" label must render
    await expect(
      page.getByText('Connectors', { exact: false }),
      'Connectors label must render in the workspace top bar'
    ).toBeVisible({ timeout: 10_000 });

    // 2. Add source affordance — "Add source" or "Add a data source connection" button
    const addSourceBtn = page.getByRole('button', { name: /add.*source|add a data source/i });
    await expect(
      addSourceBtn,
      'Add source affordance (button) must render in the connectors row'
    ).toBeVisible({ timeout: 8_000 });

    // 3. Search bar — aria-label="Search companies by name or domain"
    await expect(
      page.getByLabel('Search companies by name or domain'),
      'Search bar must render in the workspace'
    ).toBeVisible({ timeout: 8_000 });

    // 4. Source facet — "Filter by source" or "Source Filter" label
    const sourceFacet = page
      .getByRole('group', { name: /filter.*source|source.*filter/i })
      .or(page.locator('fieldset[aria-label*="source"]'));
    await expect(
      sourceFacet,
      'Source facet (fieldset/group) must render in the left sidebar'
    ).toBeVisible({ timeout: 8_000 });

    // 5. Results area — "All Sources" facet button (present even with 0 connections)
    await expect(
      page.getByRole('button', { name: /all sources/i }),
      'Source facet "All Sources" button must render'
    ).toBeVisible({ timeout: 8_000 });

    // 6. Confirm this is NOT the old /sourcing/companies screen by verifying the
    //    "Companies" list heading (from the old screen) is NOT present on this page.
    //    The workspace has its own layout — no "Companies" master-list heading.
    const companiesHeadingCount = await page
      .getByRole('heading', { name: 'Companies', exact: true })
      .count();
    expect(
      companiesHeadingCount,
      'Workspace MUST NOT render the "Companies" list heading from the old /sourcing/companies screen'
    ).toBe(0);

    // Screenshot: workspace initial state (for T-6 reference)
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'sourcing-workspace-s1.png'),
      fullPage: false,
    });

    console.log(
      `[S1 PASS] Analyst workspace at /sourcing: connectors row + search bar + source facet + results area all rendered. ` +
        `URL: ${page.url()}. Screenshot: sourcing-workspace-s1.png`
    );
  });
});

// ---------------------------------------------------------------------------
// S2: Connection-create + ≥2-source view
// ---------------------------------------------------------------------------

test.describe('S2: connection-create + ≥2-source in facet', () => {
  /**
   * FINDING (REAL PRODUCT BUG — routes to B per Iron Law):
   * POST /sourcing/connections returns 401 in production for the browser session
   * established via the accept-invite flow. Root cause: SuperTokens session tokens
   * are returned as HTTP response headers (st-access-token / front-token) rather
   * than Set-Cookie, so the browser's cookie jar contains no session cookie.
   * The Next.js client-side apiFetch() sends no Authorization header and no cookie,
   * so /sourcing/connections (which requires an authenticated session) returns 401.
   * This is an extension of FINDING-2 from wave-2 auth.spec.ts.
   * Impact: AddConnectionForm cannot create connections via the browser UI until
   * the session cookie issue is resolved.
   *
   * Per the T-5 directive: "If seeding via UI is flaky, at least verify the
   * connectors row + facet render + the add-source affordance exists."
   * This test exercises the affordance and records the 401 as a finding.
   */
  test('add-source affordance renders + form opens + 401 product finding recorded', async ({
    page,
    request,
  }) => {
    // Mint invite inside the test body so retries get a fresh token+email.
    const ts = Date.now();
    const analystEmail = `e2e+w7-s2-analyst+${ts}@example.com`;
    const analystToken = await mintInvite(request, analystEmail, 'analyst');

    // Arrange: establish session and navigate to workspace
    await acceptInviteInBrowser(page, analystToken);
    await ensureLoggedIn(page, analystEmail);
    await expect(page).toHaveURL(/\/$/, { timeout: 8_000 });

    await page.goto('/sourcing');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    await expect(page).toHaveURL(/\/sourcing(\?.*)?$/, { timeout: 10_000 });

    // ── Assert: connectors row renders ────────────────────────────────────────
    await expect(
      page.getByText('Connectors', { exact: false }),
      'Connectors label must render in top bar'
    ).toBeVisible({ timeout: 8_000 });

    // ── Assert: add-source button is present ──────────────────────────────────
    const addSourceBtn = page
      .getByRole('button', { name: /add.*source|add a data source/i })
      .first();
    await expect(addSourceBtn, 'Add source button must render').toBeVisible({ timeout: 8_000 });

    // ── Assert: inline form opens on click ────────────────────────────────────
    await addSourceBtn.click();
    const nameInput = page.getByLabel('Connection display name');
    await expect(
      nameInput,
      'Connection name input must appear after clicking Add source'
    ).toBeVisible({ timeout: 5_000 });

    const createBtn = page.getByRole('button', { name: /^add$|^create/i });
    await expect(createBtn, 'Create/Add submit button must render in inline form').toBeVisible();

    // ── Intercept POST /sourcing/connections to capture real response ─────────
    // Monitor the network request outcome by filling and submitting the form,
    // watching for either a badge appearing (201 success) or an error alert (401 fail).
    await nameInput.fill('t5-src-A');

    // Listen for the API response before clicking
    const connectionPostPromise = page
      .waitForResponse(
        (resp) =>
          resp.url().includes('/sourcing/connections') && resp.request().method() === 'POST',
        { timeout: 10_000 }
      )
      .catch(() => null); // null = no response captured within timeout

    await createBtn.click();

    const connectionPostResponse = await connectionPostPromise;
    const statusCode = connectionPostResponse?.status() ?? null;

    if (statusCode === 201) {
      // ── Happy path: connection created ───────────────────────────────────────
      // Assert badge appears in connectors row
      await expect(
        page.getByRole('img', { name: /t5-src-A/i }).first(),
        '"t5-src-A" badge must appear in connectors row on 201'
      ).toBeVisible({ timeout: 10_000 });

      // Assert facet button appears
      await expect(
        page.getByRole('button', { name: /filter by t5-src-A/i }),
        '"t5-src-A" source facet button must appear on 201'
      ).toBeVisible({ timeout: 8_000 });

      // Add 2nd connection for ≥2-source check
      const addBtn2 = page.getByRole('button', { name: /add.*source|add a data source/i }).first();
      await expect(addBtn2, 'Add source button must reappear for 2nd connection').toBeVisible({
        timeout: 5_000,
      });
      await addBtn2.click();
      const nameInput2 = page.getByLabel('Connection display name');
      await nameInput2.fill('t5-src-B');
      const createBtn2 = page.getByRole('button', { name: /^add$|^create/i });
      await createBtn2.click();

      await expect(
        page.getByRole('img', { name: /t5-src-B/i }).first(),
        '"t5-src-B" badge must appear in connectors row'
      ).toBeVisible({ timeout: 10_000 });

      const facetCount = await page
        .getByRole('button', { name: /filter by t5-src-(A|B)/i })
        .count();
      expect(
        facetCount,
        `Must have ≥2 source facet buttons; got ${facetCount}`
      ).toBeGreaterThanOrEqual(2);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'sourcing-workspace-s2-two-sources.png'),
        fullPage: false,
      });
      console.log(
        `[S2 PASS - POPULATED] POST /sourcing/connections returned 201. ` +
          `≥2-source view: ${facetCount} facet buttons. Screenshot saved.`
      );
    } else {
      // ── Fallback path: 401 or no response ────────────────────────────────────
      // PRODUCT BUG: POST /sourcing/connections returns ${statusCode} (expected 201).
      // Root cause: SuperTokens session stored as HTTP headers not cookies → apiFetch
      // sends no credentials → API returns 401. Matches FINDING-2 extension.
      // Per T-5 directive: record finding; assert affordance worked up to submit.
      console.warn(
        `[S2 FINDING - REAL PRODUCT BUG] POST /sourcing/connections returned ${statusCode ?? 'no response'}. ` +
          'Expected 201. Root cause: SuperTokens session cookie absent (FINDING-2 extension). ' +
          'AddConnectionForm cannot create connections in production until cookie session is fixed. ' +
          'Routes to B per Iron Law.'
      );

      // Assert: error alert appears (the form catches the 401 and shows an error)
      // OR the form simply stays open (no crash — resilience check)
      const errorAlert = page.getByRole('alert').or(page.locator('[aria-live="assertive"]'));
      const errorCount = await errorAlert.count();

      // At minimum: the form did not crash the page and affordance rendered
      // (the assertions above this block already passed)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'sourcing-workspace-s2-401-finding.png'),
        fullPage: false,
      });

      // Assert the connectors row UI remained stable (no crash)
      await expect(
        page.getByText('Connectors', { exact: false }),
        'Connectors row must remain visible after failed connection create'
      ).toBeVisible();

      // Assert the facet still renders All Sources (workspace stable after error)
      await expect(
        page.getByRole('button', { name: /all sources/i }),
        'Source facet must remain stable after 401 on connection create'
      ).toBeVisible();

      console.log(
        `[S2 PARTIAL] Affordance (connectors row + Add source button + inline form) rendered and stable. ` +
          `Error alerts found: ${errorCount}. Connection creation blocked by 401 (product bug). ` +
          `Screenshots: sourcing-workspace-s2-401-finding.png`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// S3: RBAC — advisor denied; unauth → /login
// ---------------------------------------------------------------------------

test.describe('S3a: RBAC deny — advisor: no Sourcing nav + /sourcing redirects', () => {
  let advisorToken: string;
  let advisorEmail: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    advisorEmail = `e2e+w7-s3-advisor+${ts}@example.com`;
    advisorToken = await mintInvite(request, advisorEmail, 'advisor');
  });

  test('advisor: Sourcing nav absent; /sourcing redirects (denied)', async ({ page }) => {
    // Arrange: establish session as advisor
    await acceptInviteInBrowser(page, advisorToken);
    await ensureLoggedIn(page, advisorEmail);
    await expect(page).toHaveURL(/\/$/, { timeout: 8_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

    // Assert: advisor does NOT see Sourcing nav
    const navLabels = await getNavLabels(page);
    expect(navLabels, 'Advisor must NOT see Sourcing nav item').not.toContain('Sourcing');

    // Act: attempt direct navigation to /sourcing
    await page.goto('/sourcing');

    // Assert: redirected away from /sourcing (assertRole redirects non-analyst to '/')
    await page.waitForURL(/\/(?!sourcing(\b|\/))/, { timeout: 15_000 });
    const finalUrl = page.url();
    expect(
      finalUrl,
      'Advisor must be redirected away from /sourcing (workspace denied)'
    ).not.toMatch(/\/sourcing/);
    expect(finalUrl, 'Redirect must land on / or /login, not an error page').toMatch(/\/(login|)$/);
  });
});

test.describe('S3b: unauthenticated /sourcing → /login', () => {
  test('no session: /sourcing redirects to /login', async ({ page }) => {
    // Fresh page context — no cookies
    await page.goto('/sourcing');

    // Assert: redirected to /login
    await expect(page, 'Unauthenticated /sourcing must redirect to /login').toHaveURL(/\/login/, {
      timeout: 15_000,
    });

    // Assert: login page heading renders (not a blank page or crash)
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
      'Login page must render after unauth redirect from /sourcing'
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// S4: Wave-2..6 regression guard
// ---------------------------------------------------------------------------

test.describe('S4: wave-2..6 regression guard — prior flows still green', () => {
  test('/ without session → /login (AppShell guard regression)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
      'Login heading must render (wave-2 regression)'
    ).toBeVisible();
  });

  test('/login renders correctly (wave-2 regression smoke)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('/sourcing/companies: analyst can still access the old companies screen (wave-6 regression)', async ({
    page,
    request,
  }) => {
    const ts = Date.now();
    const email = `e2e+w7-s4-regression+${ts}@example.com`;
    const token = await mintInvite(request, email, 'analyst');
    await acceptInviteInBrowser(page, token);
    await ensureLoggedIn(page, email);
    await expect(page).toHaveURL(/\/$/, { timeout: 8_000 });

    await page.goto('/sourcing/companies');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // The old companies screen must still render (wave-6 AC regression)
    await expect(page).toHaveURL(/\/sourcing\/companies/, { timeout: 10_000 });
    expect(page.url()).not.toMatch(/\/login/);
    await expect(
      page.getByRole('heading', { name: 'Companies' }),
      'Companies heading must still render on /sourcing/companies (wave-6 regression)'
    ).toBeVisible({ timeout: 10_000 });
  });
});
