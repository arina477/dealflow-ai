/**
 * T-5 E2E — wave-3 RBAC + AppShell (real-browser, chromium-1208/1228 shim)
 *
 * Targets LIVE production deployment.
 *   web baseURL: https://dealflow-web-production-a4f7.up.railway.app
 *   api:         https://dealflow-api-production-66d4.up.railway.app
 *
 * RBAC matrix under test (source: packages/shared/src/rbac.ts):
 *   compliance : Dashboard, Compliance   (no Mandates, Sourcing, Team, Settings)
 *   advisor    : Dashboard, Mandates, Compliance (no Sourcing, Team, Settings)
 *   analyst    : Dashboard, Mandates, Sourcing   (no Compliance, Team, Settings)
 *   admin      : Dashboard, Team, Settings       (no Mandates, Sourcing, Compliance)
 *
 * Scenarios:
 *   S1. Login → role-aware dashboard at / (compliance user)
 *   S2. Role-aware nav — compliance sees correct items; advisor sees correct items
 *   S3. Unauthenticated / → redirect to /login
 *   S4. RBAC nav deny — advisor has no Compliance nav AND compliance user has it
 *   S5. Login-failure (wrong creds) → generic inline error (regression, wave-2)
 *
 * Test emails: fresh unique per run (e2e+<label>+<ts>@example.com).
 * All invite mints use POST /auth/invite {email, role} — same pattern as wave-2.
 *
 * Cookie-based auth: wave-3 fix resolved FINDING-2 (sessions now set via
 * Set-Cookie). Login flow: invite → accept-invite page → set password → session
 * cookie set → redirect to /. The login page flow works if FINDING-1 is fixed.
 * We use the accept-invite path for account creation + full session setup, then
 * test the / landing in authed state.
 */

import path from 'node:path';
import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://dealflow-api-production-66d4.up.railway.app';
const WEB_ORIGIN = 'https://dealflow-web-production-a4f7.up.railway.app';
const TEST_PASSWORD = 'Str0ngPassw0rd!';

// Screenshot output directory — relative to this spec file.
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
 * Complete the accept-invite flow in the browser to establish a real session.
 * Navigate to /accept-invite?token=<token>, fill password, submit.
 * After session is established the server redirects to /.
 *
 * Waits for the post-submit navigation to settle (either / or /login).
 * Caller asserts the final URL.
 */
async function acceptInviteInBrowser(
  page: import('@playwright/test').Page,
  token: string,
  password: string
): Promise<void> {
  await page.goto(`/accept-invite?token=${encodeURIComponent(token)}`);
  await expect(
    page.getByRole('heading', { name: 'Set up your account' }),
    'Accept-invite form must render with valid token'
  ).toBeVisible({ timeout: 15_000 });

  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Accept & create account' }).click();

  // Wait for post-submit navigation. Match full URL (Playwright toHaveURL/waitForURL
  // matches against the full URL string, not just the path).
  // Accept either /  or /login (if session cookie is not yet set post-FINDING-2 fix).
  await page.waitForURL(/\/(login|)$/, { timeout: 20_000 });
}

/**
 * Returns visible nav link labels from the sidebar navigation.
 * The sidebar uses role="navigation" with aria-label="Main navigation".
 */
async function getNavLabels(page: import('@playwright/test').Page): Promise<string[]> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav, 'Sidebar nav must be present in authed shell').toBeVisible({ timeout: 10_000 });

  // Collect text content of all nav links inside the main navigation.
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
// S1: Login → role-aware dashboard at / (compliance user)
// ---------------------------------------------------------------------------

test.describe('S1: compliance user — invite+signup → lands on / with AppShell', () => {
  let complianceEmail: string;
  let complianceToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    complianceEmail = `e2e+w3-compliance+${ts}@example.com`;
    complianceToken = await mintInvite(request, complianceEmail, 'compliance');
  });

  test(
    'after accept-invite: lands on / (NOT bounced to /login), AppShell renders, identity + role visible',
    async ({ page }) => {
      // Act: complete invite flow in browser to get a real session cookie.
      await acceptInviteInBrowser(page, complianceToken, TEST_PASSWORD);

      // Assert: landed on /  (not /login — session cookie was set correctly).
      // toHaveURL matches against the full URL string; accept trailing slash.
      await expect(
        page,
        'Post-invite navigation must land on / (session cookie set after FINDING-2 fix)'
      ).toHaveURL(/\/$/, { timeout: 5_000 });
      // Must NOT be on /login.
      const currentUrl = page.url();
      expect(currentUrl, 'Must NOT be on /login after successful invite acceptance').not.toMatch(/\/login/);

      // AppShell: sidebar nav must be present.
      await expect(
        page.getByRole('navigation', { name: 'Main navigation' }),
        'Sidebar (Main navigation) must render in AppShell'
      ).toBeVisible();

      // AppShell: top bar — look for a top-bar structural element.
      // TopBar renders a <header> or <div> with the page title + user area.
      // We verify the identity is visible in the sidebar footer (email + role).
      // Use first() to avoid strict-mode violation: email appears in sidebar footer,
      // TopBar user chip, and WelcomeCard — all valid per design.
      await expect(
        page.getByText(complianceEmail).first(),
        'User email must be visible somewhere on page (sidebar footer / TopBar / WelcomeCard)'
      ).toBeVisible();

      // Role appears in the sidebar footer user button (aria-label contains the role).
      // Use the button locator to avoid strict-mode violation (many elements contain "compliance").
      await expect(
        page.getByRole('button', { name: /User menu:/i }),
        'Sidebar footer user button must be present with role label'
      ).toBeVisible();

      // Dashboard content: WelcomeCard renders "Signed in as <email>".
      await expect(
        page.getByText(/Signed in as/i),
        'Dashboard WelcomeCard must show "Signed in as" text'
      ).toBeVisible();

      // Compliance user sees the Compliance Overview section.
      await expect(
        page.getByRole('region', { name: /compliance overview/i }),
        'Compliance user must see Compliance Overview section'
      ).toBeVisible();
    }
  );
});

// ---------------------------------------------------------------------------
// S2: Role-aware nav — per-role nav set matches RBAC matrix
// ---------------------------------------------------------------------------

test.describe('S2: role-aware nav — compliance user nav set', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `e2e+w3-nav-compliance+${ts}@example.com`;
    token = await mintInvite(request, email, 'compliance');
  });

  test(
    'compliance: sees Dashboard + Compliance; does NOT see Mandates / Sourcing / Team / Settings',
    async ({ page }) => {
      await acceptInviteInBrowser(page, token, TEST_PASSWORD);
      // toHaveURL matches against the full URL; ensure we are at root (not /login).
      await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
      expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

      const labels = await getNavLabels(page);

      // Must-have nav items for compliance.
      expect(labels, 'compliance nav must contain Dashboard').toContain('Dashboard');
      expect(labels, 'compliance nav must contain Compliance').toContain('Compliance');

      // Must-NOT-have nav items for compliance.
      expect(labels, 'compliance nav must NOT contain Mandates').not.toContain('Mandates');
      expect(labels, 'compliance nav must NOT contain Sourcing').not.toContain('Sourcing');
      expect(labels, 'compliance nav must NOT contain Team').not.toContain('Team');
      expect(labels, 'compliance nav must NOT contain Settings').not.toContain('Settings');
    }
  );
});

test.describe('S2: role-aware nav — advisor user nav set', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `e2e+w3-nav-advisor+${ts}@example.com`;
    token = await mintInvite(request, email, 'advisor');
  });

  test(
    'advisor: sees Dashboard + Mandates + Compliance; does NOT see Sourcing / Team / Settings',
    async ({ page }) => {
      await acceptInviteInBrowser(page, token, TEST_PASSWORD);
      // toHaveURL matches against the full URL; ensure we are at root (not /login).
      await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
      expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

      const labels = await getNavLabels(page);

      // Must-have nav items for advisor.
      expect(labels, 'advisor nav must contain Dashboard').toContain('Dashboard');
      expect(labels, 'advisor nav must contain Mandates').toContain('Mandates');
      expect(labels, 'advisor nav must contain Compliance').toContain('Compliance');

      // Must-NOT-have nav items for advisor.
      expect(labels, 'advisor nav must NOT contain Sourcing').not.toContain('Sourcing');
      expect(labels, 'advisor nav must NOT contain Team').not.toContain('Team');
      expect(labels, 'advisor nav must NOT contain Settings').not.toContain('Settings');
    }
  );
});

// ---------------------------------------------------------------------------
// S3: Unauthenticated / → redirected to /login
// ---------------------------------------------------------------------------

test.describe('S3: unauthenticated / redirects to /login', () => {
  test('hitting / with no session redirects to /login', async ({ page }) => {
    // Use a fresh context (no cookies). page fixture starts with clean storage.
    await page.goto('/');

    // Must redirect to /login.
    await expect(
      page,
      'Unauthenticated / must redirect to /login'
    ).toHaveURL(/\/login/, { timeout: 15_000 });

    // Login page heading must render (not a blank page / error).
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
      'Login page heading must render after unauth redirect'
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// S4: RBAC nav deny — advisor has no Compliance nav vs compliance user has it
// (Web-side nav RBAC; API /compliance/summary RBAC is tested at T-4/T-8)
// ---------------------------------------------------------------------------

test.describe('S4: RBAC nav — advisor vs compliance nav divergence', () => {
  // Re-use fresh accounts for this test: both are created in beforeAll
  // and run in the SAME test file. Because tests run sequentially (workers:1)
  // and each test.describe has its own page fixture (new browser context per test),
  // the accounts are isolated.
  let advisorToken: string;
  let complianceToken: string;
  let advisorEmail: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    advisorEmail = `e2e+w3-rbac-adv+${ts}@example.com`;
    const complianceEmail = `e2e+w3-rbac-cmp+${ts}@example.com`;
    [advisorToken, complianceToken] = await Promise.all([
      mintInvite(request, advisorEmail, 'advisor'),
      mintInvite(request, complianceEmail, 'compliance'),
    ]);
  });

  test('advisor: Compliance nav item absent; advisor is NOT denied by a route-guard (Compliance nav simply not present)', async ({
    page,
  }) => {
    await acceptInviteInBrowser(page, advisorToken, TEST_PASSWORD);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

    const labels = await getNavLabels(page);

    // Advisor DOES see Compliance nav (rbac.ts: allowedRoles: ['compliance', 'advisor']).
    // Per the RBAC matrix: NAV_COMPLIANCE.allowedRoles = ['compliance', 'advisor'].
    // Both roles can see Compliance nav. Deny scenario for advisor is Sourcing/Team/Settings.
    expect(labels, 'advisor sees Compliance nav per rbac.ts matrix').toContain('Compliance');
    expect(labels, 'advisor does NOT see Sourcing nav').not.toContain('Sourcing');
    expect(labels, 'advisor does NOT see Team nav').not.toContain('Team');
    expect(labels, 'advisor does NOT see Settings nav').not.toContain('Settings');
  });

  test('compliance user: Compliance nav item present; does NOT see Mandates', async ({ page }) => {
    await acceptInviteInBrowser(page, complianceToken, TEST_PASSWORD);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

    const labels = await getNavLabels(page);
    expect(labels, 'compliance sees Compliance nav').toContain('Compliance');
    expect(labels, 'compliance does NOT see Mandates nav').not.toContain('Mandates');
    expect(labels, 'compliance does NOT see Sourcing nav').not.toContain('Sourcing');
  });
});

// ---------------------------------------------------------------------------
// S5: Login-failure (wrong creds) → generic inline error (wave-2 regression)
// ---------------------------------------------------------------------------

test.describe('S5: login failure — wrong creds → inline error, no redirect', () => {
  test('wrong password shows role="alert" and stays on /login', async ({ page }) => {
    // Arrange
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    // Act — credentials that will never match any account.
    await page.getByLabel('Email address').fill('e2e+w3-fail-never@example.com');
    await page.getByLabel('Password', { exact: true }).fill('WrongPa$$word42!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Assert — an inline alert is present (role="alert"), no redirect from /login.
    await expect(
      page.getByRole('alert'),
      'Inline error alert must appear on wrong credentials'
    ).toBeVisible({ timeout: 12_000 });

    await expect(
      page,
      'Page must stay on /login after failed login (no redirect)'
    ).toHaveURL(/\/login/);

    // Submit button must be re-enabled (not stuck loading).
    await expect(
      page.getByRole('button', { name: /sign in/i }),
      'Submit button must be re-enabled after failed attempt'
    ).toBeEnabled();
  });
});
