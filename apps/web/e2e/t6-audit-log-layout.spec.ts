/**
 * T-6 Layout — Audit-log integrity view visual baseline (wave-4)
 *
 * Establishes visual baseline for /compliance/audit-log (compliance user).
 *
 * Assessment plane: design/audit-log-export.html §Integrity Validation
 * + DESIGN-SYSTEM §10 "Canonical app chrome" tokens:
 *   - Sidebar w-64 (256px), bg-zinc-900 (#111827)
 *   - "Audit Log" nav item with scroll icon, active state (emerald left rail)
 *   - TopBar h-16 (64px), white (#ffffff), border-b #e5e7eb
 *   - IntegrityPanel: white bg, border #e5e7eb, radius 8px, shadow-xs
 *   - "All entries verified" status pill: bg #ECFDF5, text #047857 (emerald-700)
 *   - "Entries checked" stat visible (tabular-nums)
 *   - "Verify now" button: white bg, zinc border, zinc-700 text
 *   - Palette: zinc + emerald ONLY (no indigo/sky/purple/rose/orange)
 *   - Icons: lucide-react inline SVG (shield-check, file-archive, refresh-cw)
 *   - No Phosphor icons (class ph-*)
 *
 * Screenshot saved to:
 *   apps/web/e2e/__screenshots__/audit-log-integrity.png  (compliance user, full page)
 *
 * This is the FIRST visual run for wave-4 audit-log; no prior baseline exists.
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

// Reuse sidebar assertion from t6-appshell-layout.spec.ts pattern.
async function assertSidebar(
  page: import('@playwright/test').Page
): Promise<import('@playwright/test').Locator> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav, 'Sidebar nav[aria-label="Main navigation"] must be present').toBeVisible();

  const bbox = await nav.boundingBox();
  expect(bbox?.width, `Sidebar width must be ~256px (w-64); got ${bbox?.width}`).toBeGreaterThanOrEqual(240);
  expect(bbox?.width, `Sidebar width must be ~256px (w-64); got ${bbox?.width}`).toBeLessThanOrEqual(280);

  const bgColor = await nav.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(
    bgColor,
    `Sidebar bg must be zinc-900 (rgb(17, 24, 39) / #111827); got "${bgColor}"`
  ).toBe('rgb(17, 24, 39)');

  return nav;
}

async function assertTopBar(page: import('@playwright/test').Page): Promise<void> {
  const header = page.locator('header').first();
  await expect(header, 'TopBar <header> must be present').toBeVisible();

  const bbox = await header.boundingBox();
  expect(bbox?.height, `TopBar height must be 64px (h-16); got ${bbox?.height}`).toBeGreaterThanOrEqual(60);
  expect(bbox?.height, `TopBar height must be 64px (h-16); got ${bbox?.height}`).toBeLessThanOrEqual(72);

  const bgColor = await header.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(bgColor, `TopBar bg must be white (rgb(255, 255, 255)); got "${bgColor}"`).toBe(
    'rgb(255, 255, 255)'
  );
}

// ---------------------------------------------------------------------------
// T-6 Spec: Compliance user — audit-log integrity view visual baseline
// ---------------------------------------------------------------------------

test.describe('T-6 audit-log — compliance user integrity view visual baseline', () => {
  let complianceEmail: string;
  let complianceToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    complianceEmail = `e2e+t6-audit+${ts}@example.com`;
    complianceToken = await mintInvite(request, complianceEmail, 'compliance');
  });

  test('audit-log integrity view renders per §Integrity Validation + §10; saves baseline screenshot', async ({
    page,
  }) => {
    // ── Arrange: establish compliance session ─────────────────────────────
    await acceptInviteInBrowser(page, complianceToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url(), 'Must NOT be on /login').not.toMatch(/\/login/);

    // ── Navigate to /compliance/audit-log ────────────────────────────────
    await page.goto('/compliance/audit-log');
    await expect(page).toHaveURL(/\/compliance\/audit-log/, { timeout: 15_000 });
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── §10 Sidebar assertions ────────────────────────────────────────────
    const nav = await assertSidebar(page);

    // Logomark "DealFlow AI" wordmark.
    await expect(
      nav.getByText('DealFlow AI'),
      'Sidebar must contain "DealFlow AI" wordmark'
    ).toBeVisible();

    // "Audit Log" nav item present (compliance-only) and active.
    await expect(
      nav.getByRole('link', { name: 'Audit Log' }),
      '"Audit Log" nav item must be visible for compliance user'
    ).toBeVisible();

    // Compliance link present.
    await expect(nav.getByRole('link', { name: 'Compliance' })).toBeVisible();

    // Sidebar footer: user email.
    await expect(
      nav.getByText(complianceEmail).first(),
      `Sidebar footer must show user email "${complianceEmail}"`
    ).toBeVisible();

    // Sidebar footer: user menu button.
    await expect(
      nav.getByRole('button', { name: /User menu:/i }),
      'Sidebar footer user button must be present'
    ).toBeVisible();

    // ── §10 TopBar assertions ─────────────────────────────────────────────
    await assertTopBar(page);

    // ── Page heading ──────────────────────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: 'Audit Log Integrity' }),
      'Page heading "Audit Log Integrity" must be visible (h2)'
    ).toBeVisible();

    // ── IntegrityPanel section ────────────────────────────────────────────
    const integritySection = page.getByRole('region', { name: 'Chain integrity status' });
    await expect(integritySection, 'IntegrityPanel section must be visible').toBeVisible();

    // Panel header: "Integrity hashes & verification" label.
    await expect(
      integritySection.getByText(/Integrity hashes.*verification/i),
      'Panel header "Integrity hashes & verification" must be visible'
    ).toBeVisible();

    // Panel header: "Required by FINRA profile" badge.
    await expect(
      integritySection.getByText('Required by FINRA profile'),
      '"Required by FINRA profile" badge must be visible'
    ).toBeVisible();

    // Panel: "Verify now" button (zinc border, white bg per design).
    await expect(
      integritySection.getByRole('button', { name: /verify.*chain integrity/i }),
      '"Verify now" button must be visible in panel header'
    ).toBeVisible();

    // ── Verified state: emerald status pill ───────────────────────────────
    // "All entries verified" pill (bg #ECFDF5, text #047857, role="status").
    const verifiedPill = integritySection.getByRole('status', { name: /all entries verified/i });
    await expect(verifiedPill, '"All entries verified" emerald status pill must be visible').toBeVisible();

    // Verify pill's computed background color matches emerald-50 (#ECFDF5 = rgb(236, 253, 245)).
    const pillBg = await verifiedPill.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(
      pillBg,
      `Verified pill bg must be emerald-50 (rgb(236, 253, 245)); got "${pillBg}"`
    ).toBe('rgb(236, 253, 245)');

    // Verify pill text color: emerald-700 (#047857 = rgb(4, 120, 87)).
    const pillColor = await verifiedPill.evaluate((el) => window.getComputedStyle(el).color);
    expect(
      pillColor,
      `Verified pill text must be emerald-700 (rgb(4, 120, 87)); got "${pillColor}"`
    ).toBe('rgb(4, 120, 87)');

    // ── "Entries checked" stat ─────────────────────────────────────────────
    await expect(
      integritySection.getByText(/Entries checked/i),
      '"Entries checked" label must be visible in VerifiedState dl'
    ).toBeVisible();

    // ── Chain status "Intact" ──────────────────────────────────────────────
    await expect(
      integritySection.getByText('Intact'),
      '"Intact" chain status text must be visible'
    ).toBeVisible();

    // ── Panel surface: white bg, border #e5e7eb ───────────────────────────
    const panelBg = await integritySection.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(
      panelBg,
      `IntegrityPanel bg must be white (rgb(255, 255, 255)); got "${panelBg}"`
    ).toBe('rgb(255, 255, 255)');

    // ── Palette: no Phosphor icons ────────────────────────────────────────
    const phosphorIcons = await page.locator('[class*="ph-"]').count();
    expect(phosphorIcons, 'No Phosphor icons (§10: lucide inline SVG only)').toBe(0);

    // ── UnavailableState must NOT be rendered ─────────────────────────────
    await expect(
      integritySection.getByRole('status', { name: /integrity status unavailable/i }),
      'UnavailableState must NOT render when chain is intact'
    ).not.toBeVisible();

    // ── "Last verified" footer present ────────────────────────────────────
    await expect(
      integritySection.getByText(/Last verified:/i),
      '"Last verified:" footer timestamp must be present'
    ).toBeVisible();

    // ── Capture full-page baseline screenshot ─────────────────────────────
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'audit-log-integrity.png'),
      fullPage: true,
    });
  });
});
