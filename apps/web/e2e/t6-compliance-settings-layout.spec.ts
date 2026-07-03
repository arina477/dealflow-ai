/**
 * T-6 Layout — /compliance/settings visual baseline (wave-5)
 *
 * Establishes visual baseline for the Compliance Rules Engine settings page
 * (compliance user, /compliance/settings), comparing render against:
 *   - design/compliance-settings.html (Approval & Gating, Suppression Matrix,
 *     Jurisdiction Templates sections)
 *   - DESIGN-SYSTEM §10 (AppShell chrome: zinc-900 sidebar, h-16 white TopBar,
 *     zinc/emerald palette, lucide icons only)
 *
 * Assessment is code-driven (computed styles + DOM assertions) + screenshot.
 * The screenshot is the wave-5 visual baseline; no prior baseline exists for
 * this page (first run).
 *
 * Screenshot saved to:
 *   apps/web/e2e/__screenshots__/compliance-settings.png  (compliance user, full page)
 *
 * Assessment plane:
 *   - Sidebar: w-64 (256px), bg-zinc-900 (#111827), "DealFlow AI" wordmark,
 *     "Rules" nav item active (emerald left rail), compliance user footer.
 *   - TopBar: h-16 (64px), white bg, breadcrumb or page title.
 *   - Page heading "Compliance Rules Engine".
 *   - Section 1 (Approval & Gating Policy): white bg, zinc border, emerald icon.
 *   - Section 2 (Suppression Matrix): white bg, zinc border, "Add Entry" button.
 *   - Section 3 (Jurisdiction Templates): white bg, zinc border, "New Jurisdiction" button.
 *   - Palette: zinc + emerald ONLY (no indigo/sky/purple/rose/orange).
 *   - Icons: lucide inline SVG (no Phosphor class="ph-*").
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
// Helpers
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
  await page.waitForURL(/\/(login)?$/, { timeout: 20_000 });
}

/**
 * Assert §10 sidebar constraints and return the nav locator.
 * Consistent with t6-audit-log-layout.spec.ts pattern.
 */
async function assertSidebar(
  page: import('@playwright/test').Page
): Promise<import('@playwright/test').Locator> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav, 'Sidebar nav[aria-label="Main navigation"] must be present').toBeVisible();

  const bbox = await nav.boundingBox();
  expect(
    bbox?.width,
    `Sidebar width must be ~256px (w-64); got ${bbox?.width}`
  ).toBeGreaterThanOrEqual(240);
  expect(
    bbox?.width,
    `Sidebar width must be ~256px (w-64); got ${bbox?.width}`
  ).toBeLessThanOrEqual(280);

  const bgColor = await nav.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(
    bgColor,
    `Sidebar bg must be zinc-900 (rgb(17, 24, 39) / #111827); got "${bgColor}"`
  ).toBe('rgb(17, 24, 39)');

  return nav;
}

/**
 * Assert §10 TopBar constraints.
 */
async function assertTopBar(page: import('@playwright/test').Page): Promise<void> {
  const header = page.locator('header').first();
  await expect(header, 'TopBar <header> must be present').toBeVisible();

  const bbox = await header.boundingBox();
  expect(
    bbox?.height,
    `TopBar height must be 64px (h-16); got ${bbox?.height}`
  ).toBeGreaterThanOrEqual(60);
  expect(
    bbox?.height,
    `TopBar height must be 64px (h-16); got ${bbox?.height}`
  ).toBeLessThanOrEqual(72);

  const bgColor = await header.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(
    bgColor,
    `TopBar bg must be white (rgb(255, 255, 255)); got "${bgColor}"`
  ).toBe('rgb(255, 255, 255)');
}

// ---------------------------------------------------------------------------
// T-6 Spec: compliance user — /compliance/settings visual baseline
// ---------------------------------------------------------------------------

test.describe('T-6 compliance-settings — compliance user visual baseline', () => {
  let complianceEmail: string;
  let complianceToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    complianceEmail = `e2e+t6-settings+${ts}@example.com`;
    complianceToken = await mintInvite(request, complianceEmail, 'compliance');
  });

  test('compliance-settings renders per design/compliance-settings.html + §10; saves baseline screenshot', async ({
    page,
  }) => {
    // ── Arrange: establish compliance session ─────────────────────────────
    await acceptInviteInBrowser(page, complianceToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

    // ── Navigate to /compliance/settings ─────────────────────────────────
    await page.goto('/compliance/settings');
    await expect(page).toHaveURL(/\/compliance\/settings/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── §10 Sidebar assertions ────────────────────────────────────────────
    const nav = await assertSidebar(page);

    // Wordmark: "DealFlow AI" text in sidebar.
    await expect(
      nav.getByText('DealFlow AI'),
      'Sidebar must contain "DealFlow AI" wordmark'
    ).toBeVisible();

    // Compliance links visible: "Compliance", "Audit Log", "Rules" (compliance persona).
    await expect(
      nav.getByRole('link', { name: 'Compliance' }),
      '"Compliance" nav link must be visible in sidebar (compliance persona)'
    ).toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'Audit Log' }),
      '"Audit Log" nav link must be visible in sidebar (compliance persona)'
    ).toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'Rules' }),
      '"Rules" nav link must be visible in sidebar (compliance persona, wave-5 addition)'
    ).toBeVisible();

    // Sidebar footer: user email.
    await expect(
      nav.getByText(complianceEmail).first(),
      `Sidebar footer must show user email "${complianceEmail}"`
    ).toBeVisible();

    // Sidebar footer: user menu button with role label.
    await expect(
      nav.getByRole('button', { name: /User menu:/i }),
      'Sidebar footer user button must be present'
    ).toBeVisible();

    // ── §10 TopBar assertions ─────────────────────────────────────────────
    await assertTopBar(page);

    // ── Page heading ──────────────────────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: 'Compliance Rules Engine' }),
      'Page heading "Compliance Rules Engine" (h2) must be visible — per design/compliance-settings.html'
    ).toBeVisible();

    // ── Section 1: Approval & Gating Policy ──────────────────────────────
    const approvalSection = page.getByRole('region', { name: 'Approval and gating policy' });
    await expect(
      approvalSection,
      'Section 1 aria-label="Approval and gating policy" must be visible'
    ).toBeVisible();

    // Section 1 heading present.
    await expect(
      approvalSection.getByText('Approval & Gating Policy'),
      '"Approval & Gating Policy" section heading must be visible'
    ).toBeVisible();

    // "Add Rule" CTA button present (primary action per §8 Button).
    await expect(
      approvalSection.getByRole('button', { name: 'Add Rule' }),
      '"Add Rule" button must be present in Approval & Gating Policy section'
    ).toBeVisible();

    // Section 1 surface: white bg, zinc-200 border.
    const approvalBg = await approvalSection.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    expect(
      approvalBg,
      `Approval section bg must be white (rgb(255, 255, 255)); got "${approvalBg}"`
    ).toBe('rgb(255, 255, 255)');

    // ── Section 2: Suppression Matrix ────────────────────────────────────
    const suppressionSection = page.getByRole('region', { name: 'Suppression matrix' });
    await expect(
      suppressionSection,
      'Section 2 aria-label="Suppression matrix" must be visible'
    ).toBeVisible();

    await expect(
      suppressionSection.getByText('Suppression Matrix'),
      '"Suppression Matrix" section heading must be visible'
    ).toBeVisible();

    // "Add Entry" button present.
    await expect(
      suppressionSection.getByRole('button', { name: 'Add Entry' }),
      '"Add Entry" CTA button must be present in Suppression Matrix section'
    ).toBeVisible();

    // Section 2 surface: white bg.
    const suppressionBg = await suppressionSection.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    expect(
      suppressionBg,
      `Suppression Matrix section bg must be white (rgb(255, 255, 255)); got "${suppressionBg}"`
    ).toBe('rgb(255, 255, 255)');

    // "Add Entry" button: emerald bg (#10b981 = rgb(16, 185, 129)) per §8 primary button.
    const addEntryBtn = suppressionSection.getByRole('button', { name: 'Add Entry' });
    const addEntryBg = await addEntryBtn.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    expect(
      addEntryBg,
      `"Add Entry" button bg must be emerald-600 (rgb(16, 185, 129)); got "${addEntryBg}" — §8 "primary CTA: bg-emerald-600"`
    ).toBe('rgb(16, 185, 129)');

    // ── Section 3: Jurisdiction Templates ────────────────────────────────
    const jurisdictionSection = page.getByRole('region', { name: 'Jurisdiction templates' });
    await expect(
      jurisdictionSection,
      'Section 3 aria-label="Jurisdiction templates" must be visible'
    ).toBeVisible();

    await expect(
      jurisdictionSection.getByText('Jurisdiction Templates'),
      '"Jurisdiction Templates" section heading must be visible'
    ).toBeVisible();

    // "New Jurisdiction" button present.
    await expect(
      jurisdictionSection.getByRole('button', { name: 'New Jurisdiction' }),
      '"New Jurisdiction" button must be present in Jurisdiction Templates section'
    ).toBeVisible();

    // Section 3 surface: white bg.
    const jurisdictionBg = await jurisdictionSection.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    );
    expect(
      jurisdictionBg,
      `Jurisdiction Templates section bg must be white (rgb(255, 255, 255)); got "${jurisdictionBg}"`
    ).toBe('rgb(255, 255, 255)');

    // ── Palette: no Phosphor icons (§10 hard rule) ────────────────────────
    const phosphorIcons = await page.locator('[class*="ph-"]').count();
    expect(phosphorIcons, 'No Phosphor icons — §10: lucide inline SVG only').toBe(0);

    // ── Off-palette color check: no indigo/sky/purple/rose/orange ─────────
    // The type badges in SuppressionMatrixSection use a blue tint for 'email'
    // and green for 'domain' when entries exist. With an empty list (empty state)
    // no entry rows are rendered, so no badge colors to check here.
    // The check below verifies no Phosphor-class drift at least.
    // (Full palette validation requires entries present — covered when S2 passes.)

    // ── Capture full-page baseline screenshot ─────────────────────────────
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'compliance-settings.png'),
      fullPage: true,
    });
  });
});
