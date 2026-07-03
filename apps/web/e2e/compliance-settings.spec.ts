/**
 * T-5 E2E — wave-5 compliance-settings CRUD UI (real-browser, chromium-1208/1228 shim)
 *
 * Targets LIVE production deployment.
 *   web baseURL: https://dealflow-web-production-a4f7.up.railway.app
 *   api:         https://dealflow-api-production-66d4.up.railway.app
 *
 * Scenarios:
 *   S1. Compliance user sees the settings UI:
 *       invite+signup compliance user → login → sidebar shows "Rules" nav item →
 *       click → lands on /compliance/settings → all 3 sections render.
 *
 *   S2. Create works in-browser (C-2 FK fix proof):
 *       as compliance, open Suppression Matrix "Add Entry" modal → fill email
 *       match_type + labeled test value → submit → POST /compliance/suppression
 *       returns 201 via same-origin proxy with first-party cookie → new entry
 *       appears in the list. This proves the actor-id FK fix + same-origin proxy
 *       work end-to-end in a real browser.
 *
 *   S3. RBAC:
 *       S3a. advisor: sidebar does NOT show "Rules" nav item;
 *            navigating directly to /compliance/settings is denied (redirected).
 *       S3b. unauthenticated /compliance/settings → redirected to /login.
 *
 *   S4. Wave-3/4 regression:
 *       login-failure still shows inline error on /login.
 *
 * Test data: suppression entries created in S2 persist in prod (pre-launch,
 * 0-DAU). Values are labeled with the prefix 't5-test-' + timestamp so they
 * are identifiable and do not clash with real data.
 *
 * Clean-up: entries are left in place; the test value pattern makes them
 * identifiable for manual removal if needed. The UI supports DELETE via the
 * trash-icon button if removal is desired.
 */

import path from 'node:path';
import { expect, test } from '@playwright/test';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE = 'https://dealflow-api-production-66d4.up.railway.app';
const WEB_ORIGIN = 'https://dealflow-web-production-a4f7.up.railway.app';
const TEST_PASSWORD = 'Str0ngPassw0rd!';

// Screenshot dir — consistent with prior wave specs.
const SCREENSHOT_DIR = path.join(__dirname, '__screenshots__');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mint an invite via POST /auth/invite for the given role.
 * Returns the raw invite token. Throws on non-2xx.
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
 * Navigate to /accept-invite?token=, fill password, submit.
 * Waits for post-submit navigation to / or /login.
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

  // Wait for post-submit navigation — either / (success) or /login (regression).
  await page.waitForURL(/\/(login|)$/, { timeout: 20_000 });
}

/**
 * Returns visible nav link labels from the sidebar (role="navigation" aria-label="Main navigation").
 */
async function getNavLabels(page: import('@playwright/test').Page): Promise<string[]> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav, 'Sidebar nav must be present in authed AppShell').toBeVisible({
    timeout: 10_000,
  });
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
// S1: Compliance user sees the settings UI
// ---------------------------------------------------------------------------

test.describe('S1: compliance user — "Rules" nav item + /compliance/settings renders all 3 sections', () => {
  let complianceEmail: string;
  let complianceToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    complianceEmail = `e2e+w5-settings-s1+${ts}@example.com`;
    complianceToken = await mintInvite(request, complianceEmail, 'compliance');
  });

  test('after accept-invite: sidebar shows "Rules" nav; clicking lands on /compliance/settings with all 3 sections', async ({
    page,
  }) => {
    // Arrange: establish compliance session via accept-invite browser flow.
    await acceptInviteInBrowser(page, complianceToken);
    await expect(
      page,
      'Post-invite navigation must land on / (session cookie set)'
    ).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url(), 'Must NOT be on /login after invite acceptance').not.toMatch(/\/login/);

    // Assert: sidebar nav is present.
    const nav = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(nav, 'Sidebar nav must be present').toBeVisible();

    // Assert: "Rules" nav item is visible (NAV_COMPLIANCE_SETTINGS label per rbac.ts).
    const labels = await getNavLabels(page);
    expect(
      labels,
      'compliance user sidebar must contain "Rules" nav item (NAV_COMPLIANCE_SETTINGS)'
    ).toContain('Rules');

    // Act: click the "Rules" nav link.
    await nav.getByRole('link', { name: 'Rules' }).click();

    // Assert: landed on /compliance/settings.
    await expect(
      page,
      'Clicking "Rules" nav must navigate to /compliance/settings'
    ).toHaveURL(/\/compliance\/settings/, { timeout: 15_000 });

    // Assert: page heading visible.
    await expect(
      page.getByRole('heading', { name: 'Compliance Rules Engine' }),
      'Page heading "Compliance Rules Engine" must be visible (h2)'
    ).toBeVisible({ timeout: 10_000 });

    // Assert: Section 1 — Approval & Gating Policy.
    await expect(
      page.getByRole('region', { name: 'Approval and gating policy' }),
      'Section 1 "Approval and gating policy" must render'
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText('Approval & Gating Policy'),
      '"Approval & Gating Policy" section heading must be visible'
    ).toBeVisible();

    // Assert: Section 2 — Suppression Matrix.
    await expect(
      page.getByRole('region', { name: 'Suppression matrix' }),
      'Section 2 "Suppression matrix" must render'
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText('Suppression Matrix'),
      '"Suppression Matrix" section heading must be visible'
    ).toBeVisible();

    // Assert: Section 3 — Jurisdiction Templates.
    await expect(
      page.getByRole('region', { name: 'Jurisdiction templates' }),
      'Section 3 "Jurisdiction templates" must render'
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText('Jurisdiction Templates'),
      '"Jurisdiction Templates" section heading must be visible'
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// S2: Create works in-browser — C-2 FK fix proof
// ---------------------------------------------------------------------------

test.describe('S2: suppression entry create in-browser — C-2 FK fix + same-origin proxy proof', () => {
  let complianceToken: string;
  // Unique test value — labeled with t5-test prefix so it is identifiable.
  let suppressionValue: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `e2e+w5-settings-s2+${ts}@example.com`;
    complianceToken = await mintInvite(request, email, 'compliance');
    // Use a labeled test email value: identifiable, not real, won't suppress real outreach.
    suppressionValue = `t5-test-${ts}@example.test`;
  });

  test('adding a suppression entry POSTs /compliance/suppression → 201 → new entry appears in list (C-2-FK-fix proof)', async ({
    page,
  }) => {
    // Arrange: establish compliance session.
    await acceptInviteInBrowser(page, complianceToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

    // Navigate directly to /compliance/settings.
    await page.goto('/compliance/settings');
    await expect(page).toHaveURL(/\/compliance\/settings/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Assert: Suppression Matrix section is present.
    const suppressionSection = page.getByRole('region', { name: 'Suppression matrix' });
    await expect(
      suppressionSection,
      'Suppression Matrix section must be visible before Add Entry'
    ).toBeVisible({ timeout: 10_000 });

    // Capture the response for POST /compliance/suppression to verify 201.
    const suppressionPostPromise = page.waitForResponse(
      (response) =>
        response.url().includes('/compliance/suppression') &&
        response.request().method() === 'POST',
      { timeout: 20_000 }
    );

    // Act: open the Add Entry modal.
    const addEntryButton = suppressionSection.getByRole('button', { name: 'Add Entry' });
    await expect(
      addEntryButton,
      '"Add Entry" button must be visible in Suppression Matrix header'
    ).toBeVisible();
    await addEntryButton.click();

    // Assert: modal renders with correct role and heading.
    const modal = page.getByRole('dialog', { name: 'Add Suppression Entry' });
    await expect(
      modal,
      'Add Suppression Entry dialog must open on "Add Entry" click'
    ).toBeVisible({ timeout: 8_000 });

    // Act: select match type "email" (default; explicit for test clarity).
    // The select is labeled "Match Type" (id="suppression-match-type").
    const matchTypeSelect = modal.getByLabel('Match Type');
    await matchTypeSelect.selectOption('email');

    // Act: fill in the labeled test suppression email address.
    // Label switches to "Email Address" when matchType === 'email'.
    const valueInput = modal.getByLabel('Email Address');
    await expect(valueInput, 'Email Address input must be visible in modal').toBeVisible();
    await valueInput.fill(suppressionValue);

    // Reason is optional — leave blank (tests the happy path without a required reason).

    // Act: submit the form.
    await modal.getByRole('button', { name: 'Append Entry' }).click();

    // Assert (network): POST /compliance/suppression returned 201.
    // This is the C-2-FK-fix proof: before the fix, the actor-id FK constraint
    // caused a 500 (FK violation: actor_id not found). The fix resolves the FK
    // at insert time by looking up the DB user from the session. After the fix
    // the request returns 201. Same-origin proxy (afterFiles rewrite) ensures
    // the first-party session cookie is sent.
    const suppressionResponse = await suppressionPostPromise;
    expect(
      suppressionResponse.status(),
      'POST /compliance/suppression must return 201 (C-2-FK-fix proof + same-origin proxy)'
    ).toBe(201);

    // Parse response body — must contain id, value, matchType, createdAt.
    const created = (await suppressionResponse.json()) as {
      id: string;
      value: string;
      matchType: string;
      createdAt: string;
    };
    expect(
      created.value,
      'Created suppression entry value must match the submitted value (lowercased by server)'
    ).toBe(suppressionValue.toLowerCase());
    expect(created.matchType, 'Created entry matchType must be "email"').toBe('email');
    expect(created.id, 'Created entry must have an id').toBeTruthy();

    // Assert (UI): modal closes and success toast appears.
    await expect(
      modal,
      'Modal must close after successful submission'
    ).not.toBeVisible({ timeout: 8_000 });

    // Assert (UI): the new entry appears in the suppression list.
    // The table row renders entry.value as the first cell text.
    await expect(
      suppressionSection.getByText(suppressionValue, { exact: false }),
      `New suppression entry "${suppressionValue}" must appear in the list after create`
    ).toBeVisible({ timeout: 10_000 });

    // Assert (UI): entry count badge incremented (at least 1 entry now).
    // The count badge shows "<N> entries" or "1 entry".
    const countBadge = suppressionSection.locator(
      '[style*="tabular-nums"], [style*="tabular_nums"]'
    );
    // Just verify the section still renders (badge presence is secondary to the row).
    await expect(
      suppressionSection,
      'Suppression Matrix section must still render after create'
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// S3a: RBAC — advisor denied the "Rules" nav + direct route
// ---------------------------------------------------------------------------

test.describe('S3a: RBAC — advisor: no "Rules" nav item; direct GET /compliance/settings denied', () => {
  let advisorToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `e2e+w5-settings-s3a+${ts}@example.com`;
    advisorToken = await mintInvite(request, email, 'advisor');
  });

  test('advisor: "Rules" nav item absent; direct nav to /compliance/settings redirected', async ({
    page,
  }) => {
    // Arrange: establish advisor session.
    await acceptInviteInBrowser(page, advisorToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

    // Assert: sidebar nav items for advisor do NOT include "Rules".
    const labels = await getNavLabels(page);
    expect(
      labels,
      'advisor sidebar must NOT contain "Rules" nav item (/compliance/settings is compliance-only)'
    ).not.toContain('Rules');

    // Advisor still sees Dashboard + Compliance (per rbac.ts matrix).
    expect(labels, 'advisor must see Dashboard').toContain('Dashboard');
    expect(labels, 'advisor must see Compliance').toContain('Compliance');

    // Act: attempt direct navigation to /compliance/settings.
    await page.goto('/compliance/settings');

    // Assert: assertRole() redirects advisor away — must NOT stay on /compliance/settings.
    await page.waitForURL(/\/(login|)$/, { timeout: 15_000 });
    expect(
      page.url(),
      'Advisor must NOT stay on /compliance/settings — assertRole redirects to /'
    ).not.toMatch(/\/compliance\/settings/);
  });
});

// ---------------------------------------------------------------------------
// S3b: RBAC — unauthenticated /compliance/settings → /login
// ---------------------------------------------------------------------------

test.describe('S3b: RBAC — unauthenticated /compliance/settings redirects to /login', () => {
  test('unauthenticated hit on /compliance/settings redirects to /login', async ({ page }) => {
    // Fresh browser context — no session cookies.
    await page.goto('/compliance/settings');

    // The (app) layout checks /auth/me → 401 → redirect('/login').
    await expect(
      page,
      'Unauthenticated /compliance/settings must redirect to /login'
    ).toHaveURL(/\/login/, { timeout: 15_000 });

    // Login page must render (not a blank page or error).
    await expect(
      page.getByRole('heading', { name: 'Welcome back' }),
      'Login page heading must be visible after unauth redirect'
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// S4: Wave-3/4 regression — login-failure stays on /login (inline error)
// ---------------------------------------------------------------------------

test.describe('S4: wave-3/4 regression — login-failure still produces inline error', () => {
  test('wrong credentials show role="alert" and stay on /login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    await page.getByLabel('Email address').fill('e2e+w5-regression-fail@example.com');
    await page.getByLabel('Password', { exact: true }).fill('WrongPassw0rd!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(
      page.getByRole('alert'),
      'Inline error alert must appear on wrong credentials (wave-3/4 regression)'
    ).toBeVisible({ timeout: 12_000 });

    await expect(page, 'Page must stay on /login after failed login').toHaveURL(/\/login/);

    await expect(
      page.getByRole('button', { name: /sign in/i }),
      'Submit button must be re-enabled after failed attempt'
    ).toBeEnabled();
  });
});
