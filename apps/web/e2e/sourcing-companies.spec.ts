/**
 * T-5 E2E — wave-6 companies-contacts screen (real-browser, chromium)
 *
 * Targets the LIVE production deployment.
 *   web baseURL: https://dealflow-web-production-a4f7.up.railway.app (from playwright.config.ts)
 *   api:         https://dealflow-api-production-66d4.up.railway.app
 *
 * RBAC under test:
 *   analyst  : sees Sourcing nav → /sourcing/companies (this screen)
 *   advisor  : does NOT see Sourcing nav; /sourcing/companies → redirect (denied)
 *   unauth   : /sourcing/companies → /login
 *
 * Scenarios:
 *   S1. Analyst — invite+signup → sidebar shows Sourcing → click → /sourcing/companies renders
 *       (list OR empty "No companies yet" state; asserts screen chrome + filter bar, not a crash)
 *   S2. RBAC deny (advisor) — does NOT see Sourcing nav; direct nav to /sourcing/companies
 *       is redirected away (to '/' per assertRole) and does NOT crash
 *   S3. RBAC deny (unauthenticated) — /sourcing/companies → /login
 *   S4. Company appears in list (conditional) — only exercised if the API returns companies;
 *       prod tables purged to clean state post-C-2 → empty state is the expected prod condition.
 *       Test asserts empty state OR company list renders, whichever the API returns.
 *   Wave-2..5 regression guard — tests in auth.spec.ts / rbac-appshell.spec.ts run
 *       in the same Playwright run; this file adds zero collisions (fresh emails).
 *
 * SEEDABILITY NOTE (wave-6):
 *   The prod sourcing tables were purged to clean state after C-2. Seeding a company
 *   requires either: (a) creating a connection (POST /sourcing/connections) which needs
 *   a DB path unavailable from the e2e harness, or (b) direct DB seed — also unavailable.
 *   Seeding is NOT performed here. S4 asserts whatever the API returns: empty state or
 *   populated list. Per the wave-6 directive, "empty state is a valid AC".
 *
 * Test emails: fresh unique per run (e2e+w6-<label>+<ts>@example.com).
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
// Helpers — same pattern as wave-2..5 specs
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
 * Waits for post-submit navigation to settle.
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

  // Wait for post-submit navigation — '/' or '/login' (in case of session issues)
  await page.waitForURL(/\/(login)?$/, { timeout: 20_000 });
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
// S1: Analyst sees the companies screen
// ---------------------------------------------------------------------------

test.describe('S1: analyst — Sourcing nav visible + /sourcing/companies renders', () => {
  let analystToken: string;
  let analystEmail: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    analystEmail = `e2e+w6-analyst+${ts}@example.com`;
    analystToken = await mintInvite(request, analystEmail, 'analyst');
  });

  test('analyst: Sourcing nav present → navigate to /sourcing/companies → screen renders (list or empty state)', async ({
    page,
  }) => {
    // Arrange: establish session via accept-invite browser flow
    await acceptInviteInBrowser(page, analystToken);

    // Assert: landed on / (session cookie set)
    await expect(page, 'Post-invite nav must land on /').toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url(), 'Must NOT be on /login after successful invite acceptance').not.toMatch(
      /\/login/
    );

    // Assert: Sourcing nav item is visible for analyst
    const navLabels = await getNavLabels(page);
    expect(navLabels, 'Analyst must see Sourcing nav item').toContain('Sourcing');

    // Act: click the Sourcing nav item
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await nav.getByRole('link', { name: 'Sourcing' }).click();

    // Assert: navigated into sourcing area (sub-nav may appear; URL contains /sourcing)
    await page.waitForURL(/\/sourcing/, { timeout: 15_000 });

    // The sourcing workspace may redirect to /sourcing/companies directly, or
    // show a sourcing hub. Navigate directly to /sourcing/companies to verify the target screen.
    await page.goto('/sourcing/companies');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // Assert: URL is /sourcing/companies — not redirected to /login or /
    await expect(page).toHaveURL(/\/sourcing\/companies/, { timeout: 10_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);
    expect(page.url(), 'Must NOT be on / (RBAC deny redirect for analyst on companies)').not.toMatch(
      /^https:\/\/dealflow-web-production-a4f7\.up\.railway\.app\/$/
    );

    // Assert: the companies list panel renders — "Companies" heading in the list header
    await expect(
      page.getByRole('heading', { name: 'Companies' }),
      'Companies list heading must render'
    ).toBeVisible({ timeout: 10_000 });

    // Assert: the search input is present (filter bar renders)
    await expect(
      page.getByLabel('Search companies by name or domain'),
      'Search input (filter bar) must render'
    ).toBeVisible();

    // Assert: the filter chips (All, Active, Archived) are present — FilterBar renders
    await expect(
      page.getByRole('button', { name: 'Show all companies' }),
      'Filter chip "All" must be present'
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Show active companies only' }),
      'Filter chip "Active" must be present'
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Show archived companies only' }),
      'Filter chip "Archived" must be present'
    ).toBeVisible();

    // Assert: the companies list UL is present
    await expect(
      page.getByRole('list', { name: 'Company entries' }),
      'Company entries list must render'
    ).toBeVisible();

    // Assert: either the empty state OR at least one company row is present.
    // The prod tables were purged post-C-2; empty state is expected.
    // Both paths are valid — we assert the correct empty-state copy if no rows.
    const companyRows = page.getByRole('button', { name: /^View / });
    const rowCount = await companyRows.count();

    if (rowCount === 0) {
      // Empty state path — assert the "No companies yet" empty-state message
      await expect(
        page.getByText('No companies yet'),
        'Empty state text "No companies yet" must render when no companies exist'
      ).toBeVisible({ timeout: 5_000 });
      // The supplementary instruction text also renders
      await expect(
        page.getByText(/Companies appear here once data sources are synced/),
        'Empty state instruction copy must render'
      ).toBeVisible();
    } else {
      // Populated list path — at least one company row renders
      // Assert the first visible company row has an accessible button label
      const firstRow = companyRows.first();
      await expect(firstRow, 'First company row button must be visible').toBeVisible();
      const label = await firstRow.getAttribute('aria-label');
      expect(
        label,
        'Company row button must have aria-label starting with "View"'
      ).toMatch(/^View .+/);
    }

    // Note: This run used the empty-state path — seeding is not available from
    // the e2e harness (no /sourcing/connections CRUD without DB access).
    // The empty state is a confirmed valid AC per the wave-6 directive.
  });
});

// ---------------------------------------------------------------------------
// S2: RBAC deny — advisor does NOT see Sourcing nav; direct nav is redirected
// ---------------------------------------------------------------------------

test.describe('S2: RBAC deny — advisor: no Sourcing nav + direct nav to /sourcing/companies redirects', () => {
  let advisorToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const advisorEmail = `e2e+w6-advisor-deny+${ts}@example.com`;
    advisorToken = await mintInvite(request, advisorEmail, 'advisor');
  });

  test('advisor: Sourcing nav absent; /sourcing/companies redirects to / (role-denied)', async ({
    page,
  }) => {
    // Arrange: establish session as advisor
    await acceptInviteInBrowser(page, advisorToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url()).not.toMatch(/\/login/);

    // Assert: advisor does NOT see Sourcing nav (not in allowedRoles: ['analyst'])
    const navLabels = await getNavLabels(page);
    expect(navLabels, 'Advisor must NOT see Sourcing nav item').not.toContain('Sourcing');

    // Act: attempt direct navigation to /sourcing/companies
    await page.goto('/sourcing/companies');

    // Assert: redirected away — assertRole() redirects non-analyst to '/'
    // The page must NOT render the companies screen (heading not visible)
    await page.waitForURL(/\/(?!sourcing)/, { timeout: 15_000 });
    const finalUrl = page.url();
    // Must not stay on /sourcing/companies
    expect(finalUrl, 'Advisor must be redirected away from /sourcing/companies').not.toMatch(
      /\/sourcing\/companies/
    );
    // Must not be an error page crash — some content is rendered
    // The redirect target is '/' (dashboard) per assertRole implementation
    expect(finalUrl, 'Redirect destination must be / or /login, not a crash page').toMatch(
      /\/(login|)$/
    );
  });
});

// ---------------------------------------------------------------------------
// S3: RBAC deny — unauthenticated user → /login
// ---------------------------------------------------------------------------

test.describe('S3: unauthenticated /sourcing/companies → /login', () => {
  test('no session: /sourcing/companies redirects to /login', async ({ page }) => {
    // Use a fresh page context (no cookies — page fixture starts with clean storage)
    await page.goto('/sourcing/companies');

    // Assert: redirected to /login (the (app) layout guard handles unauth→/login)
    await expect(page, 'Unauthenticated /sourcing/companies must redirect to /login').toHaveURL(
      /\/login/,
      { timeout: 15_000 }
    );

    // Assert: login page heading renders (not a blank page or crash)
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
      'Login page must render after unauth redirect from /sourcing/companies'
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// S4: Company appears (conditional / empty-state-only in this run)
// ---------------------------------------------------------------------------

test.describe('S4: company appears after sync (conditional — empty-state-only in wave-6)', () => {
  let analystToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const analystEmail = `e2e+w6-s4-analyst+${ts}@example.com`;
    analystToken = await mintInvite(request, analystEmail, 'analyst');
  });

  test('companies API response — asserts either populated list or empty state; records seedability', async ({
    page,
    request,
  }) => {
    // Arrange: session
    await acceptInviteInBrowser(page, analystToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });

    // Attempt to seed: check if GET /sourcing/companies returns anything
    // (read-only probe — no DB-level seeding available from the harness)
    const apiRes = await request.get(`${API_BASE}/sourcing/companies`, {
      headers: { Origin: WEB_ORIGIN },
    });

    let apiCompanyCount = 0;
    if (apiRes.ok()) {
      try {
        const body = (await apiRes.json()) as { companies?: unknown[] };
        apiCompanyCount = Array.isArray(body.companies) ? body.companies.length : 0;
      } catch {
        // ignore parse errors
      }
    }

    // Navigate to the screen
    await page.goto('/sourcing/companies');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });
    await expect(page).toHaveURL(/\/sourcing\/companies/, { timeout: 10_000 });

    if (apiCompanyCount > 0) {
      // Populated list path — a company must appear in the DOM
      const companyRows = page.getByRole('button', { name: /^View / });
      await expect(
        companyRows.first(),
        'At least one company row must render when API returns companies'
      ).toBeVisible({ timeout: 10_000 });

      // Verify first row renders domain text (provenance visible)
      // domain is rendered as a <div> below the company name
      const firstRow = companyRows.first();
      const rowText = await firstRow.textContent();
      expect(rowText, 'Company row must contain visible text').toBeTruthy();
    } else {
      // Empty state path — prod tables purged post-C-2 (expected state in wave-6)
      // SEEDABILITY NOTE: seeding requires creating a connection via POST /sourcing/connections
      // which requires DB-level credentials unavailable from the e2e harness.
      // The C-2 live proof confirmed sync→dedupe→companies pipeline works end-to-end.
      // This run: EMPTY STATE ONLY (not seedable from harness).
      await expect(
        page.getByText('No companies yet'),
        'Empty state "No companies yet" must render when prod tables are purged'
      ).toBeVisible({ timeout: 5_000 });
    }
  });
});

// ---------------------------------------------------------------------------
// Wave-2..5 regression guard — login page still loads
// ---------------------------------------------------------------------------

test.describe('Wave-2..5 regression: login + unauth redirect still green', () => {
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
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
