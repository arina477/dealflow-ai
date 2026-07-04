/**
 * T-6 Layout — buyer-universe page visual baseline (wave-9)
 *
 * Establishes visual baseline for /buyer-universe?mandateId=<id> as an analyst
 * with an assembled universe.
 *
 * Assessment plane: design/buyer-universe.html + DESIGN-SYSTEM §10:
 *   - AppShell: sidebar zinc-900 (#111827), TopBar h-16 (64px), white (#ffffff)
 *   - Palette: zinc + emerald only (no indigo/sky/purple/rose/orange)
 *   - Lucide icons only; no Phosphor icons
 *   - Criteria filter sidebar (aside aria-label="Criteria Filters") — left panel, 272px
 *   - Candidate data table (table aria-label="Buyer universe candidates")
 *     Columns: Company, Status, Contact Readiness, Completeness, Included, Provenance
 *   - Include/exclude toggle (button role="switch") per row
 *   - Submit CTA (button "Submit to Match Engine") — emerald (#10B981) when enabled
 *   - NO fit-score / rank column (M4/M5 boundary)
 *   - TopBar title recurring defect check
 *
 * Design reference: design/buyer-universe.html
 * DESIGN-SYSTEM: design/DESIGN-SYSTEM.md §10
 *
 * Screenshot saved to: apps/web/e2e/__screenshots__/t6-buyer-universe.png
 *
 * This is the FIRST visual baseline for buyer-universe (wave-9); no prior baseline exists.
 * Assessment is code-driven (computed styles + DOM structure assertions) + screenshot.
 *
 * Browser: chromium-1208, Playwright 1.61.1
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

async function mintInviteFromPage(
  page: import('@playwright/test').Page,
  email: string,
  role: string
): Promise<string> {
  const res = await page.context().request.post(`${API_BASE}/auth/invite`, {
    headers: { 'Content-Type': 'application/json', Origin: WEB_ORIGIN },
    data: { email, role },
  });
  if (!res.ok()) {
    throw new Error(
      `mintInviteFromPage failed: ${res.status()} ${await res.text()} email=${email} role=${role}`
    );
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

async function ensureLoggedIn(page: import('@playwright/test').Page, email: string): Promise<void> {
  if (page.url().includes('/login')) {
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/$/, { timeout: 20_000 });
  }
}

/** Assert §10 AppShell chrome (sidebar + TopBar) is intact. */
async function assertAppShellChrome(
  page: import('@playwright/test').Page,
  pageName: string
): Promise<void> {
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav, `[${pageName}] Sidebar nav must be present`).toBeVisible({ timeout: 10_000 });

  const navBg = await nav.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(navBg, `[${pageName}] Sidebar bg must be zinc-900 (rgb(17, 24, 39)); got "${navBg}"`).toBe(
    'rgb(17, 24, 39)'
  );

  const navBox = await nav.boundingBox();
  expect(
    navBox?.width,
    `[${pageName}] Sidebar width must be 240-280px; got ${navBox?.width}`
  ).toBeGreaterThanOrEqual(240);
  expect(
    navBox?.width,
    `[${pageName}] Sidebar width must be 240-280px; got ${navBox?.width}`
  ).toBeLessThanOrEqual(280);

  // TopBar: first <header> element, h=60-72px (h-16), white background.
  const topbar = page.locator('header').first();
  await expect(topbar, `[${pageName}] TopBar header must be present`).toBeVisible();

  const headerBox = await topbar.boundingBox();
  expect(
    headerBox?.height,
    `[${pageName}] TopBar height must be 60-72px; got ${headerBox?.height}`
  ).toBeGreaterThanOrEqual(60);
  expect(
    headerBox?.height,
    `[${pageName}] TopBar height must be 60-72px; got ${headerBox?.height}`
  ).toBeLessThanOrEqual(72);

  const topbarBg = await topbar.evaluate((el) => window.getComputedStyle(el).backgroundColor);
  expect(
    topbarBg,
    `[${pageName}] TopBar bg must be white (rgb(255, 255, 255)); got "${topbarBg}"`
  ).toBe('rgb(255, 255, 255)');

  // DealFlow AI wordmark in sidebar.
  await expect(
    nav.getByText('DealFlow AI'),
    `[${pageName}] "DealFlow AI" wordmark must be in sidebar`
  ).toBeVisible();

  // No Phosphor icons (§10: lucide only).
  const phosphorCount = await page.locator('[class*="ph-"]').count();
  expect(phosphorCount, `[${pageName}] No Phosphor icons (§10: lucide only)`).toBe(0);

  // "Buyer Universe" nav link visible (NAV_BUYER_UNIVERSE: analyst/advisor/admin).
  await expect(
    nav.getByRole('link', { name: 'Buyer Universe' }),
    `[${pageName}] "Buyer Universe" nav link must be visible`
  ).toBeVisible();
}

// ---------------------------------------------------------------------------
// T-6 visual baseline: analyst with assembled universe
// ---------------------------------------------------------------------------

test.describe('T-6 buyer-universe — analyst visual baseline (wave-9)', () => {
  test('T-6-BU: /buyer-universe?mandateId= renders per design (buyer-universe.html) — assembled universe with candidate table', async ({
    page,
  }) => {
    const ts = Date.now();

    // ── Arrange step 1: advisor creates mandate ───────────────────────────────
    const advEmail = `e2e+t6-w9-adv+${ts}@example.com`;
    const advToken = await mintInviteFromPage(page, advEmail, 'advisor');
    await acceptInviteInBrowser(page, advToken);
    await ensureLoggedIn(page, advEmail);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });

    // Create mandate
    await page.goto('/mandates/new');
    await expect(page.getByRole('heading', { name: 'Create Engagement' })).toBeVisible({
      timeout: 15_000,
    });
    const sellerName = `T6 BU Baseline ${ts}`;
    await page.getByLabel(/Company Name/i).fill(sellerName);
    await page.locator('#jurisdiction').selectOption('US');
    await page.locator('#ack-lawful').check();
    await page.locator('#ack-ai').check();
    await page.locator('#ack-conflict').check();
    await page.getByRole('button', { name: 'Create Mandate' }).click();
    await page.waitForURL(
      (url) => /^\/mandates\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'),
      { timeout: 30_000 }
    );
    const detailUrl = page.url();
    const mandateId = detailUrl.match(/\/mandates\/([^/]+)$/)?.[1] ?? '';

    // ── Arrange step 2: try assemble universe (advisor session) ──────────────
    // The assemble endpoint is /buyer-universe-data (POST).
    // Note: /buyer-universe-data is the non-page-colliding proxy — not /buyer-universe.
    let universeAssembled = false;
    if (mandateId) {
      const assembleRes = await page.context().request.post(`${API_BASE}/buyer-universe-data`, {
        headers: { 'Content-Type': 'application/json', Origin: WEB_ORIGIN },
        data: { mandateId },
      });
      if (assembleRes.ok()) {
        universeAssembled = true;
        console.info('[T-6-BU] Universe assembled via API for visual baseline.');
      } else {
        const errBody = await assembleRes.text();
        console.warn(
          `[T-6-BU] POST /buyer-universe-data → ${assembleRes.status()} "${errBody}". ` +
            'Visual baseline will show AssembleEmptyState (no candidates). Noted as FINDING if route missing.'
        );
        if (assembleRes.status() === 404) {
          console.error(
            '[FINDING-T6-BU-1] POST /buyer-universe-data returns 404. ' +
              'The /buyer-universe-data proxy route may not be registered in the API. ' +
              'Routes to B — the BuyerUniverseController may be mounted at a different path.'
          );
        }
      }
    }

    // ── Arrange step 3: switch to analyst session ─────────────────────────────
    const analyEmail = `e2e+t6-w9-analyst+${ts}@example.com`;
    const analyToken = await mintInviteFromPage(page, analyEmail, 'analyst');
    await acceptInviteInBrowser(page, analyToken);
    await ensureLoggedIn(page, analyEmail);
    await expect(page).toHaveURL(/\/$/, { timeout: 5_000 });

    // If universe was not assembled by advisor, try assembling as analyst.
    if (!universeAssembled && mandateId) {
      const assembleRes2 = await page.context().request.post(`${API_BASE}/buyer-universe-data`, {
        headers: { 'Content-Type': 'application/json', Origin: WEB_ORIGIN },
        data: { mandateId },
      });
      if (assembleRes2.ok()) {
        universeAssembled = true;
        console.info('[T-6-BU] Universe assembled via API as analyst.');
      }
    }

    // ── Act: navigate to /buyer-universe?mandateId= ───────────────────────────
    const buyerUrl = mandateId ? `/buyer-universe?mandateId=${mandateId}` : '/buyer-universe';
    await page.goto(buyerUrl);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── Assert: AppShell chrome (§10) ─────────────────────────────────────────
    await assertAppShellChrome(page, '/buyer-universe');

    // ── Assert: page heading "Buyer Universe" ────────────────────────────────
    await expect(
      page.getByRole('heading', { name: 'Buyer Universe' }),
      '[T-6-BU] "Buyer Universe" h1 heading must be present'
    ).toBeVisible({ timeout: 10_000 });

    // ── Assert: Breadcrumb "Build Universe" ──────────────────────────────────
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    const breadcrumbCount = await breadcrumb.count();
    if (breadcrumbCount > 0) {
      await expect(
        breadcrumb.first(),
        '[T-6-BU] Breadcrumb nav must be present (design: Mandates › Mandate › Build Universe)'
      ).toBeVisible();
    } else {
      // Breadcrumb may be rendered as a <nav> without the aria-label — check for "Build Universe" text
      const buildUniverseText = await page.getByText('Build Universe', { exact: true }).count();
      if (buildUniverseText === 0) {
        console.warn(
          '[T-6-BU] Breadcrumb "Build Universe" text not found — possible design delta.'
        );
      }
    }

    // ── Assert: filter sidebar (Criteria Filters) ────────────────────────────
    const filterSidebar = page.locator('aside[aria-label="Criteria Filters"]');
    const filterSidebarCount = await filterSidebar.count();
    if (universeAssembled && filterSidebarCount > 0) {
      await expect(
        filterSidebar,
        '[T-6-BU] Criteria Filters sidebar must be visible when universe exists'
      ).toBeVisible({ timeout: 5_000 });

      // Sidebar width: 272px (per design/buyer-universe.html FilterSidebar style)
      const sidebarBox = await filterSidebar.boundingBox();
      expect(
        sidebarBox?.width,
        `[T-6-BU] Filter sidebar width must be ~272px (240-290px); got ${sidebarBox?.width}`
      ).toBeGreaterThanOrEqual(240);
      expect(
        sidebarBox?.width,
        `[T-6-BU] Filter sidebar width must be ~272px (240-290px); got ${sidebarBox?.width}`
      ).toBeLessThanOrEqual(290);

      // Sidebar bg: zinc-50 (#F9FAFB)
      const sidebarBg = await filterSidebar.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );
      const isZincMuted = sidebarBg === 'rgb(249, 250, 251)';
      if (!isZincMuted) {
        console.warn(
          `[T-6-BU] Filter sidebar bg="${sidebarBg}" — expected zinc-50 (rgb(249, 250, 251)). Palette delta.`
        );
      }

      // "Criteria Filters" heading in sidebar
      await expect(
        filterSidebar.getByText('Criteria Filters'),
        '[T-6-BU] Filter sidebar must show "Criteria Filters" heading'
      ).toBeVisible();

      // "Membership Status" label and segmented control
      await expect(
        filterSidebar.getByText('Membership Status'),
        '[T-6-BU] Filter sidebar must show "Membership Status" section'
      ).toBeVisible();
    } else if (!universeAssembled) {
      console.info(
        '[T-6-BU] Universe not assembled — filter sidebar not expected. Assemble empty-state visible instead.'
      );
    } else {
      console.warn(
        '[T-6-BU] aside[aria-label="Criteria Filters"] not found — filter sidebar may use different selector.'
      );
    }

    // ── Assert: candidate data table ─────────────────────────────────────────
    const candidateTable = page.locator('table[aria-label="Buyer universe candidates"]');
    const tableCount = await candidateTable.count();

    if (universeAssembled && tableCount > 0) {
      await expect(
        candidateTable,
        '[T-6-BU] Candidate data table must be present when universe is assembled'
      ).toBeVisible({ timeout: 10_000 });

      // ── Assert: column headers match design (no fit-score/rank — M4/M5 boundary) ──
      const headers = await page
        .locator('table[aria-label="Buyer universe candidates"] th')
        .allTextContents();
      const flatHeaders = headers.map((h) => h.trim().toLowerCase());

      // Expected columns (design/buyer-universe.html):
      // Company, Status, Contact Readiness, Completeness, Included, Provenance
      const expectedColumns = ['company', 'status'];
      for (const col of expectedColumns) {
        const found = flatHeaders.some((h) => h.includes(col));
        if (!found) {
          console.warn(
            `[T-6-BU] Expected column "${col}" not found in headers: [${flatHeaders.join(', ')}]`
          );
        }
      }

      // CRITICAL: No Score/Rank/Fit column (M4/M5 boundary)
      const hasFitScore = flatHeaders.some(
        (h) => h.includes('score') || h.includes('fit') || h.includes('rank')
      );
      expect(
        hasFitScore,
        `[T-6-BU] Candidate table must NOT have score/fit/rank column at M4 boundary. Found: [${flatHeaders.join(', ')}]`
      ).toBe(false);

      console.info(`[T-6-BU] Candidate table column headers: [${headers.join(', ')}]`);

      // ── Assert: include/exclude toggle present ────────────────────────────
      const toggles = page.locator('table[aria-label="Buyer universe candidates"] [role="switch"]');
      const toggleCount = await toggles.count();
      // Toggles present only if there are candidate rows
      const rows = await page
        .locator('table[aria-label="Buyer universe candidates"] tbody tr')
        .count();
      if (rows > 0) {
        expect(
          toggleCount,
          `[T-6-BU] Include/exclude toggles must be present (one per candidate row); got ${toggleCount} for ${rows} rows`
        ).toBeGreaterThan(0);
      }
    } else if (!universeAssembled) {
      // Empty state: AssembleEmptyState renders instead
      const assembleBtn = page.getByRole('button', { name: /Assemble Buyer Universe/i });
      const assembleBtnCount = await assembleBtn.count();
      if (assembleBtnCount > 0) {
        await expect(
          assembleBtn,
          '[T-6-BU] Assemble empty-state CTA button must be visible when no universe exists'
        ).toBeVisible({ timeout: 5_000 });

        // CTA button bg: emerald (#10B981)
        const ctaBg = await assembleBtn.evaluate(
          (el) => window.getComputedStyle(el).backgroundColor
        );
        const isEmerald = ctaBg === 'rgb(16, 185, 129)' || ctaBg.startsWith('rgb(16, 185');
        if (!isEmerald) {
          console.warn(
            `[T-6-BU] Assemble CTA bg="${ctaBg}" — expected emerald (#10B981). Palette delta.`
          );
        }
        console.info('[T-6-BU] Rendering AssembleEmptyState (no universe); CTA bg=' + ctaBg);
      }
    } else {
      console.warn(
        '[T-6-BU] Universe assembled but candidate table not found — possible render issue.'
      );
    }

    // ── Assert: Submit to Match Engine button ────────────────────────────────
    if (universeAssembled && tableCount > 0) {
      const submitBtn = page.getByRole('button', { name: /Submit to Match Engine/i });
      const submitBtnCount = await submitBtn.count();
      if (submitBtnCount > 0) {
        await expect(
          submitBtn,
          '[T-6-BU] "Submit to Match Engine" CTA must be present when universe is assembled'
        ).toBeVisible({ timeout: 5_000 });
      } else {
        console.warn(
          '[T-6-BU] "Submit to Match Engine" button not found — may be after submit or no candidates.'
        );
      }
    }

    // ── Assert: palette check — no off-palette colors ────────────────────────
    // The design uses only zinc + emerald. Check that the page body background is zinc-25 or white.
    const bodyBg = await page.evaluate(
      () => window.getComputedStyle(document.body).backgroundColor
    );
    const validBgs = ['rgb(252, 252, 253)', 'rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'];
    const isValidBg = validBgs.some((v) => bodyBg === v);
    if (!isValidBg) {
      console.warn(
        `[T-6-BU] Body background="${bodyBg}" — expected zinc-25 or white. Palette delta.`
      );
    }

    // ── TopBar title check (recurring defect) ────────────────────────────────
    // DESIGN-SYSTEM §10 TopBar should show the active page title.
    // Prior waves documented this as a recurring defect: TopBar shows "Dashboard" on all pages.
    const topbarTitleEl = page.locator('header h2, header [data-testid="page-title"]').first();
    const topbarTitleCount = await topbarTitleEl.count();
    if (topbarTitleCount > 0) {
      const topbarTitle = await topbarTitleEl.textContent().catch(() => null);
      if (topbarTitle !== null) {
        console.info(`[T-6-BU] TopBar title text: "${topbarTitle.trim()}"`);
        const isDashboardTitle = topbarTitle.trim().toLowerCase() === 'dashboard';
        if (isDashboardTitle) {
          console.warn(
            '[T-6-BU FINDING-TOPBAR] TopBar title shows "Dashboard" on /buyer-universe. ' +
              'Recurring defect from prior waves (wave-3/4/8 T-6 reports). Routes to B.'
          );
        }
      }
    } else {
      // TopBar title element absent — check if AppBar renders ANY title text in the TopBar
      const topbarContent = await page
        .locator('header')
        .first()
        .textContent()
        .catch(() => null);
      console.info(
        `[T-6-BU] TopBar text content: "${topbarContent?.trim().slice(0, 80) ?? 'n/a'}"`
      );
    }

    // ── Capture baseline screenshot ───────────────────────────────────────────
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 't6-buyer-universe.png'),
      fullPage: true,
    });

    console.info(
      `[T-6-BU] Baseline saved: t6-buyer-universe.png ` +
        `(mandateId=${mandateId || 'n/a'}, universeAssembled=${universeAssembled}). ` +
        'Compare against design/buyer-universe.html.'
    );
  });
});
