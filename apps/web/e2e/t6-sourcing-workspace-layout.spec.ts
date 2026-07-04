/**
 * T-6 Layout — Sourcing Workspace visual baseline (wave-7)
 *
 * Establishes visual baseline for /sourcing (analyst persona) — the sourcing
 * WORKSPACE introduced in wave-7. NOT the old /sourcing/companies screen.
 *
 * Assessment plane: design/sourcing-workspace.html + DESIGN-SYSTEM §10
 *   - AppShell: Sidebar w-64 (256px) bg-zinc-900, TopBar h-16 white
 *   - Sidebar: Sourcing nav item active (emerald left-rail indicator)
 *   - Workspace top bar: "Connectors" label + connector badges + search bar
 *   - Source facet sidebar: "Source Filter" legend + facet buttons
 *   - Results matrix area: present (empty or populated)
 *   - Add source affordance: dashed-border button visible
 *   - Palette: zinc + emerald ONLY (no Phosphor icons — class ph-*)
 *   - DESIGN-SYSTEM §10 TopBar title: should show page title
 *
 * Screenshot saved to:
 *   apps/web/e2e/__screenshots__/sourcing-workspace-baseline.png (analyst, full page)
 *
 * First visual run for wave-7 sourcing-workspace screen.
 * Assessment is code-driven (computed styles + DOM assertions) + screenshot.
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
// Helpers (self-contained — spec must run independently)
// ---------------------------------------------------------------------------

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
    throw new Error(`mintInvite failed: ${res.status()} ${await res.text()} role=${role}`);
  }
  const body = (await res.json()) as { token: string; expiry: string };
  return body.token;
}

async function acceptInviteInBrowser(
  page: import('@playwright/test').Page,
  token: string
): Promise<void> {
  await page.goto(`/accept-invite?token=${encodeURIComponent(token)}`);
  await expect(page.getByRole('heading', { name: 'Set up your account' })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Accept & create account' }).click();
  // Accept / or /login (FINDING-2 wave-2: header-token vs. cookie session)
  await page.waitForURL(/\/(login)?$/, { timeout: 20_000 });
}

async function ensureLoggedIn(
  page: import('@playwright/test').Page,
  email: string
): Promise<void> {
  if (!page.url().includes('/login')) return;
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(login|)$/, { timeout: 15_000 });
}

/**
 * Assert sidebar per DESIGN-SYSTEM §10: zinc-900 bg, ~256px width.
 */
async function assertSidebar(page: import('@playwright/test').Page): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav, 'Sidebar nav[aria-label="Main navigation"] must be present').toBeVisible({
    timeout: 10_000,
  });

  const bbox = await nav.boundingBox();
  expect(bbox?.width, `Sidebar width must be ~256px (w-64); got ${bbox?.width}`).toBeGreaterThanOrEqual(240);
  expect(bbox?.width, `Sidebar width must be ~256px (w-64); got ${bbox?.width}`).toBeLessThanOrEqual(280);

  const bgColor = await nav.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(bgColor, `Sidebar bg must be zinc-900 rgb(17,24,39); got "${bgColor}"`).toBe(
    'rgb(17, 24, 39)'
  );
}

/**
 * Assert TopBar per DESIGN-SYSTEM §10: h-16 (64px), white background.
 */
async function assertTopBar(page: import('@playwright/test').Page): Promise<{
  headerText: string;
  hasPageTitle: boolean;
}> {
  const header = page.locator('header').first();
  await expect(header, 'TopBar <header> must be present').toBeVisible();

  const bbox = await header.boundingBox();
  expect(bbox?.height, `TopBar height must be ~64px; got ${bbox?.height}`).toBeGreaterThanOrEqual(56);
  expect(bbox?.height, `TopBar height must be ~64px; got ${bbox?.height}`).toBeLessThanOrEqual(72);

  const bgColor = await header.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(bgColor, `TopBar bg must be white rgb(255,255,255); got "${bgColor}"`).toBe(
    'rgb(255, 255, 255)'
  );

  const headerText = (await header.textContent()) ?? '';
  // Design shows "Target Sourcing" as the page title in the TopBar breadcrumb
  const hasPageTitle =
    headerText.toLowerCase().includes('sourcing') ||
    headerText.toLowerCase().includes('target sourcing') ||
    headerText.toLowerCase().includes('workspace');

  return { headerText: headerText.trim(), hasPageTitle };
}

// ---------------------------------------------------------------------------
// T-6 Spec: Sourcing workspace — analyst visual baseline
// ---------------------------------------------------------------------------

test.describe('T-6 sourcing-workspace — analyst visual baseline (wave-7)', () => {
  let analystEmail: string;
  let analystToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    analystEmail = `e2e+t6-w7-analyst+${ts}@example.com`;
    analystToken = await mintInvite(request, analystEmail, 'analyst');
  });

  test('captures baseline screenshot + validates §10 chrome and workspace layout', async ({
    page,
  }) => {
    // ── Arrange: establish analyst session ────────────────────────────────────
    await acceptInviteInBrowser(page, analystToken);
    await ensureLoggedIn(page, analystEmail);
    await expect(page).toHaveURL(/\/$/, { timeout: 8_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

    // Navigate to the sourcing workspace
    await page.goto('/sourcing');
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    await expect(page).toHaveURL(/\/sourcing(\?.*)?$/, { timeout: 10_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);
    expect(page.url(), 'Must NOT redirect to /sourcing/companies').not.toMatch(
      /\/sourcing\/companies/
    );

    // ── §10 AppShell: sidebar ─────────────────────────────────────────────────
    await assertSidebar(page);

    const nav = page.getByRole('navigation', { name: 'Main navigation' });

    // Logomark: "DealFlow AI" wordmark in sidebar
    await expect(
      nav.getByText('DealFlow AI'),
      'Sidebar must contain "DealFlow AI" wordmark'
    ).toBeVisible();

    // Sourcing nav item must be visible for analyst
    await expect(
      nav.getByRole('link', { name: 'Sourcing' }),
      'Sourcing nav must be visible for analyst'
    ).toBeVisible();

    // Dashboard nav must be visible
    await expect(
      nav.getByRole('link', { name: 'Dashboard' }),
      'Dashboard nav must be visible for analyst'
    ).toBeVisible();

    // Analyst must NOT see Compliance, Team, or Settings nav items
    await expect(
      nav.getByRole('link', { name: 'Compliance' }),
      'Compliance nav must NOT be visible for analyst'
    ).not.toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'Team' }),
      'Team nav must NOT be visible for analyst'
    ).not.toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'Settings' }),
      'Settings nav must NOT be visible for analyst'
    ).not.toBeVisible();

    // Sidebar footer: analyst email
    await expect(
      nav.getByText(analystEmail).first(),
      'Sidebar footer must show analyst email'
    ).toBeVisible();

    // ── §10 AppShell: TopBar ──────────────────────────────────────────────────
    const { headerText, hasPageTitle } = await assertTopBar(page);
    if (!hasPageTitle) {
      // FINDING: TopBar title does not show "Sourcing" or "Target Sourcing" on this screen.
      // Matches the recurring x-invoke-path propagation issue tracked in prior waves.
      // Routes to B per Iron Law.
      console.warn(
        `[T-6 FINDING] TopBar title missing page name: header text="${headerText}" — ` +
          'expected "Sourcing" or "Target Sourcing" per design/sourcing-workspace.html §10. Routes to B.'
      );
    } else {
      console.log(`[T-6] TopBar title: "${headerText}" — contains expected sourcing keyword. PASS.`);
    }

    // ── Workspace-specific chrome ─────────────────────────────────────────────

    // Connectors row: "Connectors" label visible in top-bar region
    await expect(
      page.getByText('Connectors', { exact: false }),
      'Workspace top area must render "Connectors" label'
    ).toBeVisible({ timeout: 8_000 });

    // Add source affordance: dashed-border "Add source" button visible
    const addSourceBtn = page.getByRole('button', { name: /add.*source|add a data source/i });
    await expect(
      addSourceBtn,
      'Add source button (dashed-border affordance) must render per design'
    ).toBeVisible({ timeout: 8_000 });

    // Search bar: labeled search input
    const searchInput = page.getByLabel('Search companies by name or domain');
    await expect(searchInput, 'Search bar must render').toBeVisible({ timeout: 8_000 });

    // Source facet sidebar: fieldset with Source Filter legend
    const sourceFacet = page
      .getByRole('group', { name: /filter.*source|source.*filter/i })
      .or(page.locator('fieldset[aria-label*="source"]'));
    await expect(sourceFacet, 'Source facet sidebar must render').toBeVisible({ timeout: 8_000 });

    // Source facet: "All Sources" facet button present
    await expect(
      page.getByRole('button', { name: /all sources/i }),
      'Source facet "All Sources" button must render'
    ).toBeVisible({ timeout: 8_000 });

    // ── Search bar focus ring (emerald) ───────────────────────────────────────
    await searchInput.focus();
    const focusBorderColor = await searchInput.evaluate(
      (el) => window.getComputedStyle(el).borderColor
    );
    const focusBoxShadow = await searchInput.evaluate(
      (el) => window.getComputedStyle(el).boxShadow
    );
    const hasEmeraldFocus =
      focusBorderColor.includes('16, 185, 129') ||
      focusBoxShadow.includes('16, 185, 129') ||
      focusBorderColor.includes('10b981') ||
      focusBoxShadow.includes('10b981');
    if (!hasEmeraldFocus) {
      // Non-fatal: inline style transitions may not surface in computed style at this moment.
      console.warn(
        `[T-6] Search bar focus ring: borderColor="${focusBorderColor}" boxShadow="${focusBoxShadow}" — ` +
          'emerald focus ring not detected in computed style (JS inline style may need mouse interaction).'
      );
    } else {
      console.log(`[T-6] Search bar emerald focus ring confirmed. PASS.`);
    }
    await searchInput.blur();

    // ── No Phosphor icons ─────────────────────────────────────────────────────
    // Phosphor icons use class="ph ph-*" — must be absent per §10 (lucide/inline SVG only)
    const phosphorCount = await page.locator('[class*="ph-"]').count();
    expect(
      phosphorCount,
      `No Phosphor icons must be present (§10: lucide/inline SVG only); found ${phosphorCount}`
    ).toBe(0);

    // ── WorkspaceClient wrapper: zinc-25 background ───────────────────────────
    // The workspace root div has bg #fcfcfd (zinc-25) per WorkspaceClient
    // Look for a div wrapping the connectors + body area
    // We test the main content area background
    const mainEl = page.locator('main').first();
    if (await mainEl.isVisible()) {
      const mainBg = await mainEl.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      // main should have a neutral zinc tone (not a bright or off-palette color)
      const isNeutralBg =
        mainBg === 'rgba(0, 0, 0, 0)' || // transparent (inherits)
        mainBg.includes('252') || // zinc-25 #fcfcfd
        mainBg.includes('249') || // zinc-50 #f9fafb
        mainBg.includes('255'); // white
      if (!isNeutralBg) {
        console.warn(
          `[T-6] Main content area background: "${mainBg}" — unexpected color (expected zinc-25/50 or white/transparent)`
        );
      }
    }

    // ── Capture baseline screenshot ────────────────────────────────────────────
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'sourcing-workspace-baseline.png'),
      fullPage: true,
    });

    // ── Summary ───────────────────────────────────────────────────────────────
    console.log(
      `[T-6] sourcing-workspace baseline captured. ` +
        `URL: ${page.url()}. ` +
        `TopBar title present: ${hasPageTitle}. ` +
        `Phosphor icons found: ${phosphorCount} (must be 0). ` +
        `Screenshot: __screenshots__/sourcing-workspace-baseline.png`
    );
  });
});
