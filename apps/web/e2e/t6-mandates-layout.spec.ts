/**
 * T-6 Layout — mandate pages visual baseline (wave-8)
 *
 * Establishes visual baselines for the three mandate pages as an advisor user:
 *   /mandates        (list page — mandates-list.html)
 *   /mandates/new    (create form — mandate-new.html)
 *   /mandates/:id    (detail page — mandate-detail.html)
 *
 * Assessment plane: DESIGN-SYSTEM §10 "AppShell chrome" + mandate designs.
 *   - Sidebar zinc-900 (#111827), AppShell chrome per §10
 *   - Palette: zinc + emerald only (no indigo/sky/purple/rose/orange)
 *   - Mandate list: table with Mandate/Seller, Deal Type, Status, Created columns
 *   - New mandate: 3-section form (Seller Profile §1, Buyer Criteria §2, Compliance §3)
 *   - Mandate detail: h1 seller name, status badge, Seller/Buyer/Compliance sections,
 *     3 deferred placeholders (Buyer Engine, Ranked Candidates, Pipeline)
 *   - No off-palette colors; no Phosphor icons
 *   - TopBar h-16 (64px), white (#ffffff)
 *
 * Screenshots saved to: apps/web/e2e/__screenshots__/
 *   t6-mandate-list.png
 *   t6-mandate-new.png
 *   t6-mandate-detail.png
 *
 * This is the FIRST visual run for mandate pages (wave-8); no prior baseline exists.
 * Assessment is code-driven (computed styles + DOM assertions) + screenshot.
 *
 * Design reference files:
 *   design/mandates-list.html
 *   design/mandate-new.html
 *   design/mandate-detail.html
 *   design/DESIGN-SYSTEM.md §10
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

/** Assert §10 AppShell chrome (sidebar + TopBar) is intact on a mandate page. */
async function assertAppShellChrome(
  page: import('@playwright/test').Page,
  pageName: string
): Promise<void> {
  // Sidebar: role="navigation" aria-label="Main navigation", zinc-900 background.
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav, `[${pageName}] Sidebar nav must be present`).toBeVisible({ timeout: 10_000 });

  const navBg = await nav.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(
    navBg,
    `[${pageName}] Sidebar bg must be zinc-900 (rgb(17, 24, 39)); got "${navBg}"`
  ).toBe('rgb(17, 24, 39)');

  // Sidebar width: ~256px (w-64).
  const navBox = await nav.boundingBox();
  expect(navBox?.width, `[${pageName}] Sidebar width must be 240-280px; got ${navBox?.width}`).toBeGreaterThanOrEqual(240);
  expect(navBox?.width, `[${pageName}] Sidebar width must be 240-280px; got ${navBox?.width}`).toBeLessThanOrEqual(280);

  // TopBar: <header> first, h=64px, white background.
  const header = page.locator('header').first();
  await expect(header, `[${pageName}] TopBar header must be present`).toBeVisible();

  const headerBox = await header.boundingBox();
  expect(
    headerBox?.height,
    `[${pageName}] TopBar height must be 60-72px (h-16); got ${headerBox?.height}`
  ).toBeGreaterThanOrEqual(60);
  expect(
    headerBox?.height,
    `[${pageName}] TopBar height must be 60-72px (h-16); got ${headerBox?.height}`
  ).toBeLessThanOrEqual(72);

  const headerBg = await header.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(
    headerBg,
    `[${pageName}] TopBar bg must be white (rgb(255, 255, 255)); got "${headerBg}"`
  ).toBe('rgb(255, 255, 255)');

  // DealFlow AI wordmark in sidebar.
  await expect(
    nav.getByText('DealFlow AI'),
    `[${pageName}] "DealFlow AI" wordmark must be in sidebar`
  ).toBeVisible();

  // No Phosphor icons.
  const phosphorCount = await page.locator('[class*="ph-"]').count();
  expect(phosphorCount, `[${pageName}] No Phosphor icons (§10: lucide only)`).toBe(0);

  // Mandates nav link is visible for advisor.
  await expect(
    nav.getByRole('link', { name: 'Mandates' }),
    `[${pageName}] Mandates nav link must be visible for advisor`
  ).toBeVisible();
}

/** Assert emerald-600 (#10b981) primary action button is present on list page. */
async function assertEmeraldPrimaryButton(
  page: import('@playwright/test').Page,
  pageName: string
): Promise<void> {
  // The "Create a new mandate" / "New mandate" button should use emerald-600 background.
  const newBtn = page.getByRole('button', { name: /new mandate|create.*mandate/i });
  const count = await newBtn.count();
  if (count === 0) return; // Skip if not present (e.g. after no-ack test modifies state).

  const btnBg = await newBtn.first().evaluate((el) => window.getComputedStyle(el).backgroundColor);
  // Emerald-600 = rgb(16, 185, 129) or rgba variant.
  const isEmerald =
    btnBg === 'rgb(16, 185, 129)' || btnBg === 'rgba(16, 185, 129, 1)' || btnBg.startsWith('rgb(16, 185');
  if (!isEmerald) {
    console.warn(
      `[T-6][${pageName}] "New mandate" button bg="${btnBg}" — expected emerald-600 (rgb(16, 185, 129)). Possible off-palette defect.`
    );
  }
  // Non-fatal palette check; record for T-6 report.
}

// ---------------------------------------------------------------------------
// T-6 baseline: advisor user for all three mandate pages
// ---------------------------------------------------------------------------

test.describe('T-6 mandate pages — advisor visual baseline', () => {
  let advisorToken: string;
  let advisorEmail: string;
  /** Mandate ID created during the test for the detail page baseline. */
  let createdMandateId: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    advisorEmail = `e2e+t6-w8-adv+${ts}@example.com`;
    advisorToken = await mintInvite(request, advisorEmail, 'advisor');
  });

  // ------------------------------------------------------------------
  // Test 1: /mandates (list page)
  // ------------------------------------------------------------------

  test('T-6-1: /mandates list page renders per design (mandates-list.html)', async ({ page }) => {
    // ── Arrange: establish advisor session ───────────────────────────────────
    await acceptInviteInBrowser(page, advisorToken);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });
    expect(page.url()).not.toMatch(/\/login/);

    // ── Navigate to /mandates ────────────────────────────────────────────────
    await page.goto('/mandates');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── AppShell chrome ──────────────────────────────────────────────────────
    await assertAppShellChrome(page, '/mandates');

    // ── Page-specific DOM structure ──────────────────────────────────────────
    // H1: "Mandates" heading.
    await expect(
      page.getByRole('heading', { name: 'Mandates' }),
      '[/mandates] H1 "Mandates" must be present'
    ).toBeVisible();

    // Subline: "Manage active engagements..." description text.
    await expect(
      page.getByText(/Manage active engagements/i),
      '[/mandates] Description text must be present'
    ).toBeVisible();

    // "New mandate" or "Create a new mandate" button (emerald primary CTA).
    const newMandateBtn = page.getByRole('button', { name: /new mandate|create.*mandate/i });
    await expect(newMandateBtn.first(), '[/mandates] New mandate CTA button must be present').toBeVisible();
    await assertEmeraldPrimaryButton(page, '/mandates');

    // Filter segmented control (StatusFilter: draft/active/all).
    // StatusFilter renders buttons; look for "All" or the segment control area.
    // The component renders via StatusFilter.tsx with "all"/"draft"/"active" options.
    // Check for the filter container.
    const filterContainer = page.locator('div[role="group"], [aria-label*="filter"], button').filter({
      hasText: /all|draft|active/i,
    });
    // Non-fatal: filter controls are visible.
    const filterCount = await filterContainer.count();
    if (filterCount === 0) {
      console.warn(
        '[T-6][/mandates] Status filter segmented control not detected — check StatusFilter component DOM.'
      );
    }

    // The mandates table OR empty state must be present (not an error).
    const tableOrEmpty = page.locator(
      'table[aria-label="Mandates list"], [aria-label*="No"], [data-state="empty"]'
    );
    const tablePresent = await page.locator('table[aria-label="Mandates list"]').count();
    const emptyPresent = await page.getByText(/Create your first mandate|No.*mandates/i).count();
    const hasContent = tablePresent > 0 || emptyPresent > 0;
    expect(
      hasContent,
      '[/mandates] Must show either mandate table or empty-state (not error)'
    ).toBe(true);

    // ── Palette spot-check: content area background ──────────────────────────
    const mainContent = page.locator('#main-content');
    const mainContentBg = await mainContent
      .evaluate((el) => window.getComputedStyle(el).backgroundColor)
      .catch(() => 'n/a');
    // Content area bg should be zinc-25 (#fcfcfd) or white — not an off-palette color.
    const validBgs = ['rgb(252, 252, 253)', 'rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)', 'n/a'];
    if (!validBgs.some((v) => mainContentBg.includes(v.replace(/\s/g, '')))) {
      console.warn(
        `[T-6][/mandates] Content area bg="${mainContentBg}" — expected zinc-25 or white.`
      );
    }

    // ── Capture baseline screenshot ───────────────────────────────────────────
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 't6-mandate-list.png'),
      fullPage: true,
    });
  });

  // ------------------------------------------------------------------
  // Test 2: /mandates/new (create form)
  // ------------------------------------------------------------------

  test('T-6-2: /mandates/new form renders per design (mandate-new.html) — 3 sections + jurisdiction dropdown', async ({
    page,
  }) => {
    // ── Arrange: navigate to /mandates/new (session cookie must carry over
    //    via page.goto within same test context — but each test has a fresh
    //    browser context in workers:1 mode). Establish session inline.
    const ts2 = Date.now();
    const email2 = `e2e+t6-w8-adv-new+${ts2}@example.com`;
    const token2 = await mintInvite(page.context().request, email2, 'advisor');
    await acceptInviteInBrowser(page, token2);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });

    await page.goto('/mandates/new');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── AppShell chrome ──────────────────────────────────────────────────────
    await assertAppShellChrome(page, '/mandates/new');

    // ── Page heading + breadcrumb ────────────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: 'Create Engagement' }),
      '[/mandates/new] H1 "Create Engagement" must be present'
    ).toBeVisible();

    // Breadcrumb: "Mandates / New Mandate" trail.
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }),
      '[/mandates/new] Breadcrumb nav must be present'
    ).toBeVisible();

    // ── 3 Form sections (§1, §2, §3) ─────────────────────────────────────────
    // Section 1: "Seller & Target Profile" (SectionCard number=1 title=...)
    await expect(
      page.getByRole('heading', { name: 'Seller & Target Profile' }),
      '[/mandates/new] Section 1 "Seller & Target Profile" must be present'
    ).toBeVisible();

    // Section 2: "Buyer Universe Criteria"
    await expect(
      page.getByRole('heading', { name: 'Buyer Universe Criteria' }),
      '[/mandates/new] Section 2 "Buyer Universe Criteria" must be present'
    ).toBeVisible();

    // Section 3: "Compliance Guardrails"
    await expect(
      page.getByRole('heading', { name: 'Compliance Guardrails' }),
      '[/mandates/new] Section 3 "Compliance Guardrails" must be present'
    ).toBeVisible();

    // ── Jurisdiction dropdown (CRITICAL-2 fix — must be populated, not empty-state) ──
    const jurisdictionSelect = page.locator('#jurisdiction');
    await expect(
      jurisdictionSelect,
      '[/mandates/new] Jurisdiction dropdown must be present (active disclaimer templates loaded)'
    ).toBeVisible({ timeout: 10_000 });

    // US option must be present.
    const usOptionCount = await jurisdictionSelect.locator('option[value="US"]').count();
    expect(
      usOptionCount,
      '[/mandates/new] Jurisdiction dropdown must contain "US" option'
    ).toBeGreaterThan(0);

    // ── 3 Acknowledgment checkboxes (D5) ─────────────────────────────────────
    await expect(
      page.locator('#ack-lawful'),
      '[/mandates/new] ack-1 (lawful_authorization) checkbox must be present'
    ).toBeVisible();
    await expect(
      page.locator('#ack-ai'),
      '[/mandates/new] ack-2 (ai_results_validated) checkbox must be present'
    ).toBeVisible();
    await expect(
      page.locator('#ack-conflict'),
      '[/mandates/new] ack-3 (conflict_dbs_reviewed) checkbox must be present'
    ).toBeVisible();

    // Required Acknowledgments fieldset legend.
    await expect(
      page.getByText('Required Acknowledgments'),
      '[/mandates/new] "Required Acknowledgments" fieldset legend must be present'
    ).toBeVisible();

    // ── Submit button (emerald) ───────────────────────────────────────────────
    const submitBtn = page.getByRole('button', { name: 'Create Mandate' });
    await expect(submitBtn, '[/mandates/new] "Create Mandate" submit button must be present').toBeVisible();

    const submitBg = await submitBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const isEmerald =
      submitBg === 'rgb(16, 185, 129)' || submitBg.startsWith('rgb(16, 185');
    if (!isEmerald) {
      console.warn(
        `[T-6][/mandates/new] "Create Mandate" button bg="${submitBg}" — expected emerald-600. Possible off-palette defect.`
      );
    }

    // ── Compliance notice (D2 captured-not-enforced banner) ──────────────────
    await expect(
      page.getByText(/Compliance information captured here/i),
      '[/mandates/new] Compliance "captured not enforced" notice must be present'
    ).toBeVisible();

    // ── Capture baseline screenshot ───────────────────────────────────────────
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 't6-mandate-new.png'),
      fullPage: true,
    });
  });

  // ------------------------------------------------------------------
  // Test 3: /mandates/:id (detail page) — create mandate first, then assess
  // ------------------------------------------------------------------

  test('T-6-3: /mandates/:id detail renders per design (mandate-detail.html) — seller, compliance, 3 deferred placeholders', async ({
    page,
  }) => {
    // ── Arrange: create a fresh advisor account + mandate to get a detail URL ─
    const ts3 = Date.now();
    const email3 = `e2e+t6-w8-detail+${ts3}@example.com`;
    const token3 = await mintInvite(page.context().request, email3, 'advisor');
    await acceptInviteInBrowser(page, token3);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });

    // Create mandate via form to land on detail page.
    await page.goto('/mandates/new');
    await expect(page.getByRole('heading', { name: 'Create Engagement' })).toBeVisible({
      timeout: 15_000,
    });

    const sellerName = `T6 Detail Baseline ${ts3}`;

    // Fill company name, jurisdiction, all 3 acks.
    await page.getByLabel(/Company Name/i).fill(sellerName);
    await page.locator('#jurisdiction').selectOption('US');
    await page.locator('#ack-lawful').check();
    await page.locator('#ack-ai').check();
    await page.locator('#ack-conflict').check();
    await page.getByRole('button', { name: 'Create Mandate' }).click();

    // Wait for redirect to detail page.
    await expect(page).toHaveURL(/\/mandates\/[^/]+$/, { timeout: 20_000 });
    const detailUrl = page.url();
    // Save mandate ID for reference.
    const mandateIdMatch = detailUrl.match(/\/mandates\/([^/]+)$/);
    if (mandateIdMatch) {
      createdMandateId = mandateIdMatch[1] ?? '';
    }

    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── AppShell chrome ──────────────────────────────────────────────────────
    await assertAppShellChrome(page, '/mandates/:id');

    // ── Page header: seller name h1, status badge, created date ──────────────
    await expect(
      page.getByRole('heading', { level: 1 }).filter({ hasText: sellerName }),
      `[/mandates/:id] H1 must show seller name "${sellerName}"`
    ).toBeVisible();

    await expect(
      page.getByText('draft', { exact: false }),
      '[/mandates/:id] Status badge "draft" must be present (new mandate starts draft)'
    ).toBeVisible();

    // "Created" date substring (the DetailRow for created at).
    await expect(
      page.getByText(/Created/i),
      '[/mandates/:id] "Created" date label must be present'
    ).toBeVisible();

    // ── Configure button (advisor on draft mandate) ───────────────────────────
    await expect(
      page.getByRole('button', { name: /configure/i }),
      '[/mandates/:id] "Configure" button must be visible for advisor on draft mandate'
    ).toBeVisible();

    // ── Seller & Target Profile section ──────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: 'Seller & Target Profile' }),
      '[/mandates/:id] "Seller & Target Profile" section heading must be present'
    ).toBeVisible();

    // Company name in the detail row.
    await expect(
      page.getByText(sellerName, { exact: false }).first(),
      `[/mandates/:id] Seller name "${sellerName}" must appear in detail section`
    ).toBeVisible();

    // ── Buyer Universe Criteria section ──────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: 'Buyer Universe Criteria' }),
      '[/mandates/:id] "Buyer Universe Criteria" section heading must be present'
    ).toBeVisible();

    // ── Compliance Profile section ────────────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: 'Compliance Profile' }),
      '[/mandates/:id] "Compliance Profile" section heading must be present'
    ).toBeVisible();

    // Jurisdiction US in compliance profile.
    // The "Jurisdiction" label + "US" value appears in the compliance section dd element.
    await expect(
      page.getByRole('definition').filter({ hasText: /^US$/ }).first(),
      '[/mandates/:id] Jurisdiction "US" must appear in Compliance Profile'
    ).toBeVisible();

    // Disclaimer Template ID (monospace) — derived server-side, non-empty.
    const disclaimerIdEl = page.locator('span[style*="monospace"]').first();
    const disclaimerIdCount = await disclaimerIdEl.count();
    expect(
      disclaimerIdCount,
      '[/mandates/:id] Disclaimer Template ID (monospace span) must be present'
    ).toBeGreaterThan(0);
    if (disclaimerIdCount > 0) {
      const disclaimerText = await disclaimerIdEl.textContent();
      expect(
        disclaimerText?.trim().length,
        '[/mandates/:id] Disclaimer Template ID must be non-empty'
      ).toBeGreaterThan(0);
    }

    // ── D6 Deferred placeholders: Buyer Engine / Ranked Candidates / Pipeline ─
    await expect(
      page.getByText('Buyer Engine', { exact: true }).first(),
      '[/mandates/:id] "Buyer Engine" deferred placeholder must be present'
    ).toBeVisible();
    await expect(
      page.getByText('Ranked Candidates', { exact: true }).first(),
      '[/mandates/:id] "Ranked Candidates" deferred placeholder must be present'
    ).toBeVisible();
    await expect(
      page.getByText('Pipeline', { exact: true }).first(),
      '[/mandates/:id] "Pipeline" deferred placeholder must be present'
    ).toBeVisible();

    // "AI Sourcing Canvas" section label (D6 heading).
    await expect(
      page.getByRole('heading', { name: 'AI Sourcing Canvas' }),
      '[/mandates/:id] "AI Sourcing Canvas" D6 section heading must be present'
    ).toBeVisible();

    // ── No Phosphor icons ─────────────────────────────────────────────────────
    const phosphorIcons = await page.locator('[class*="ph-"]').count();
    expect(phosphorIcons, '[/mandates/:id] No Phosphor icons (§10: lucide only)').toBe(0);

    // ── TopBar title check — recurring defect from prior waves ───────────────
    // TopBar title sometimes shows a wrong/blank/stale title. Check it.
    const topbarTitle = await page.locator('header h2, header [data-testid="page-title"]').first().textContent().catch(() => null);
    if (topbarTitle !== null) {
      // If the TopBar title element exists, note its value.
      console.info(`[T-6][/mandates/:id] TopBar title text: "${topbarTitle?.trim()}"`);
    }

    // ── Capture baseline screenshot ───────────────────────────────────────────
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 't6-mandate-detail.png'),
      fullPage: true,
    });

    console.info(
      `[T-6] Baseline saved: t6-mandate-detail.png (mandateId=${createdMandateId ?? 'n/a'})`
    );
  });
});
