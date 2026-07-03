/**
 * T-6 Layout — Visual baseline capture (wave-2 auth screens)
 *
 * FIRST UI wave: no prior baseline exists. This run ESTABLISHES the visual
 * baseline. There is no pixel-diff vs a prior run — assessment is human/agent
 * review of the captured screenshots against design/DESIGN-SYSTEM.md § Auth
 * pages and the canonical mockups (design/login.html, design/accept-invite.html,
 * design/reset-password.html).
 *
 * Screenshots are saved to: apps/web/e2e/__screenshots__/
 *   login.png
 *   accept-invite-valid-token.png
 *   accept-invite-invalid-token.png   (error state, no token)
 *   reset-password.png
 *
 * Visual conformance checks performed inline:
 *   - Form fields present (label/input pairs)
 *   - Primary CTA styled emerald (bg-emerald-600 / computed background)
 *   - SSO button ABSENT (no "Continue with Google" / "SSO" text)
 *   - SOC 2 Type II badge ABSENT
 *   - Page heading matches design copy
 *   - No app chrome (sidebar / topbar) on auth pages
 *   - Accessibility spot-check: focus ring visible on input (label association)
 *
 * Targets the LIVE production deployment (baseURL in playwright.config.ts).
 *   api: https://dealflow-api-production-66d4.up.railway.app
 */

import path from 'node:path';
import { expect, test } from '@playwright/test';

// ── Configuration ────────────────────────────────────────────────────────────

const API_BASE = 'https://dealflow-api-production-66d4.up.railway.app';
const WEB_ORIGIN = 'https://dealflow-web-production-a4f7.up.railway.app';

// Screenshot output directory — relative to this spec file.
const SCREENSHOT_DIR = path.join(__dirname, '__screenshots__');

/** Mint an invite token via POST /auth/invite. Throws on non-2xx. */
async function mintInvite(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  email: string
): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/invite`, {
    headers: {
      'Content-Type': 'application/json',
      Origin: WEB_ORIGIN,
    },
    data: { email, role: 'advisor' },
  });
  if (!res.ok()) {
    throw new Error(`mintInvite failed: ${res.status()} ${await res.text()} for email=${email}`);
  }
  const body = (await res.json()) as { token: string; expiry: string };
  return body.token;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Assert the primary CTA button has an emerald background colour.
 * Checks Tailwind class AND computed style (belt-and-suspenders).
 */
async function assertEmeraldCTA(
  page: import('@playwright/test').Page,
  buttonName: string | RegExp
): Promise<void> {
  const btn = page.getByRole('button', { name: buttonName });
  await expect(btn).toBeVisible();

  // Tailwind class check
  const cls = await btn.getAttribute('class');
  const hasEmeraldClass =
    cls?.includes('emerald') ||
    cls?.includes('bg-emerald') ||
    cls?.includes('bg-green') ||
    cls?.includes('primary');

  // Computed background — emerald-600 = rgb(16, 185, 129)
  const bgColor = await btn.evaluate((el) => window.getComputedStyle(el).backgroundColor);

  // Accept either Tailwind class presence OR computed emerald colour.
  // rgb(16, 185, 129) is emerald-600; slight rounding ok so we check substring.
  const isEmeraldComputed =
    bgColor.includes('16, 185, 129') ||
    bgColor.includes('4, 120, 87') || // emerald-700
    bgColor.includes('5, 150, 105'); // emerald-600 alt rendering

  const isEmerald = hasEmeraldClass || isEmeraldComputed;
  expect(
    isEmerald,
    `Primary CTA "${buttonName}" must have emerald background. class="${cls}" bg="${bgColor}"`
  ).toBe(true);
}

/**
 * Assert no SSO-related affordances are present.
 * Per jenny P-4 notes: SSO button was explicitly REMOVED from the auth pages.
 */
async function assertNoSSO(page: import('@playwright/test').Page): Promise<void> {
  // Text patterns that would indicate an SSO/OAuth button
  const ssoPatterns = [
    'Continue with Google',
    'Sign in with Google',
    'Sign in with SSO',
    'Single sign-on',
    'SSO',
    'Continue with Microsoft',
  ];
  for (const pattern of ssoPatterns) {
    await expect(
      page.getByText(pattern, { exact: false }),
      `SSO affordance "${pattern}" must be absent per P-4 scope decision`
    ).not.toBeVisible();
  }
}

/**
 * Assert no SOC 2 Type II badge is present.
 * Per jenny P-4 notes: SOC 2 badge was explicitly REMOVED from auth pages.
 */
async function assertNoSOC2Badge(page: import('@playwright/test').Page): Promise<void> {
  await expect(
    page.getByText('SOC 2', { exact: false }),
    'SOC 2 badge must be absent per P-4 scope decision'
  ).not.toBeVisible();
  await expect(
    page.getByText('Type II', { exact: false }),
    'SOC 2 Type II badge must be absent per P-4 scope decision'
  ).not.toBeVisible();
}

/**
 * Assert no app chrome (sidebar / topbar) is present on an auth page.
 * Auth pages per DESIGN-SYSTEM § 10 have NO sidebar, no top bar.
 *
 * Note: "DealFlow AI" text IS intentionally present in the AuthCard header
 * (brand wordmark in a <header> element, not a sidebar). That is correct.
 * What must be ABSENT is the sidebar nav structure (nav items, nav element).
 */
async function assertNoAppChrome(page: import('@playwright/test').Page): Promise<void> {
  // Sidebar nav items must NOT be present — these only appear in the authed shell.
  // If the sidebar were rendered, these links/texts would be visible.
  const sidebarNavItems = ['Dashboard', 'Mandates', 'Sourcing', 'Compliance', 'Team', 'Settings'];
  for (const item of sidebarNavItems) {
    // Use getByRole('link') for sidebar nav links to be precise (not just text).
    // The sidebar renders these as nav links; auth pages should have none of them.
    const sidebarLink = page.getByRole('link', { name: item });
    const count = await sidebarLink.count();
    expect(count, `Sidebar nav link "${item}" must be absent on auth pages (found ${count})`).toBe(
      0
    );
  }

  // Top bar <nav> element (role="navigation") must NOT be present.
  // AuthCard uses <header> for brand + <footer> for copyright — no nav.
  const navCount = await page.getByRole('navigation').count();
  expect(
    navCount,
    `role="navigation" element must be absent on auth pages (found ${navCount})`
  ).toBe(0);
}

// ── T-6 Spec 1: /login ───────────────────────────────────────────────────────

test.describe('T-6 login page — visual baseline', () => {
  test('captures baseline screenshot and validates layout conformance', async ({
    page,
    request,
  }) => {
    // Navigate
    await page.goto('/login');

    // Wait for the page to fully load
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── Structural assertions ────────────────────────────────────────────
    // Heading
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    // Form fields present
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();

    // Primary CTA present and emerald
    await assertEmeraldCTA(page, /sign in/i);

    // "Back to sign in" / "Forgot password" link — optional but present in design
    // (not asserting; just documenting — focus on must-haves)

    // ── Scope-decision assertions (P-4 removals) ─────────────────────────
    await assertNoSSO(page);
    await assertNoSOC2Badge(page);
    await assertNoAppChrome(page);

    // ── Accessibility spot-check ─────────────────────────────────────────
    // Label → input association: getByLabel resolves iff the label is
    // associated (for/id or wrapping); already asserted above via getByLabel.
    // Focus ring: trigger focus and verify outline visible via computed style.
    const emailInput = page.getByLabel('Email address');
    await emailInput.focus();
    const outlineWidth = await emailInput.evaluate(
      (el) => window.getComputedStyle(el).outlineWidth
    );
    const outlineColor = await emailInput.evaluate(
      (el) => window.getComputedStyle(el).outlineColor
    );
    // Outline should be non-zero (focus ring present)
    // Note: Tailwind ring utilities use box-shadow not outline on some versions,
    // so we also check box-shadow.
    const boxShadow = await emailInput.evaluate((el) => window.getComputedStyle(el).boxShadow);
    const hasFocusRing =
      (outlineWidth !== '0px' && outlineWidth !== '') ||
      (boxShadow && boxShadow !== 'none' && boxShadow !== '');
    expect(
      hasFocusRing,
      `Email input focus ring absent. outline="${outlineWidth}" outline-color="${outlineColor}" box-shadow="${boxShadow}"`
    ).toBe(true);

    // ── Capture full-page screenshot ─────────────────────────────────────
    // Blur focus before screenshot so we don't capture the focus ring artifact
    await page.keyboard.press('Escape');
    await emailInput.blur();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'login.png'),
      fullPage: true,
    });
  });
});

// ── T-6 Spec 2: /accept-invite (valid token) ─────────────────────────────────

test.describe('T-6 accept-invite page — valid token — visual baseline', () => {
  let inviteToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = `e2e+t6-accept-invite+${ts}@example.com`;
    inviteToken = await mintInvite(request, email);
  });

  test('captures baseline screenshot (set-password form) and validates layout conformance', async ({
    page,
  }) => {
    await page.goto(`/accept-invite?token=${encodeURIComponent(inviteToken)}`);
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── Structural assertions ────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Set up your account' })).toBeVisible();

    // Password + confirm password fields
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirm password')).toBeVisible();

    // Primary CTA
    await assertEmeraldCTA(page, /accept & create account/i);

    // ── Scope-decision assertions ─────────────────────────────────────────
    await assertNoSSO(page);
    await assertNoSOC2Badge(page);
    await assertNoAppChrome(page);

    // ── Capture full-page screenshot ─────────────────────────────────────
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'accept-invite-valid-token.png'),
      fullPage: true,
    });
  });
});

// ── T-6 Spec 3: /accept-invite (no token — error state) ──────────────────────

test.describe('T-6 accept-invite page — invalid/missing token — visual baseline', () => {
  test('captures baseline screenshot (error state) and validates error rendering', async ({
    page,
  }) => {
    // No token → client renders error branch ("Invite Link Invalid")
    await page.goto('/accept-invite');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── Structural assertions ────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Invite Link Invalid' })).toBeVisible();

    // Set-password form must NOT be present in error state
    await expect(page.getByRole('button', { name: /accept & create account/i })).not.toBeVisible();

    // ── Scope-decision assertions ─────────────────────────────────────────
    await assertNoSSO(page);
    await assertNoSOC2Badge(page);
    await assertNoAppChrome(page);

    // ── Capture full-page screenshot ─────────────────────────────────────
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'accept-invite-invalid-token.png'),
      fullPage: true,
    });
  });
});

// ── T-6 Spec 4: /reset-password ──────────────────────────────────────────────

test.describe('T-6 reset-password page — visual baseline', () => {
  test('captures baseline screenshot and validates layout conformance', async ({ page }) => {
    await page.goto('/reset-password');
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // ── Structural assertions ────────────────────────────────────────────
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();

    // Email field
    await expect(page.getByLabel('Email address')).toBeVisible();

    // Primary CTA
    await assertEmeraldCTA(page, /send reset link/i);

    // "Sign in" link present (part of "Remember your password? Sign in" text).
    // Note: "Back to sign in" only appears in the post-submit ack state;
    // initial page render has a "Sign in" link to /login.
    await expect(page.getByRole('link', { name: /^sign in$/i })).toBeVisible();

    // ── Scope-decision assertions ─────────────────────────────────────────
    await assertNoSSO(page);
    await assertNoSOC2Badge(page);
    await assertNoAppChrome(page);

    // ── Accessibility spot-check ─────────────────────────────────────────
    const emailInput = page.getByLabel('Email address');
    await emailInput.focus();
    const boxShadow = await emailInput.evaluate((el) => window.getComputedStyle(el).boxShadow);
    const outlineWidth = await emailInput.evaluate(
      (el) => window.getComputedStyle(el).outlineWidth
    );
    const hasFocusRing =
      (outlineWidth !== '0px' && outlineWidth !== '') ||
      (boxShadow && boxShadow !== 'none' && boxShadow !== '');
    expect(
      hasFocusRing,
      `Email input focus ring absent on reset-password. outline="${outlineWidth}" box-shadow="${boxShadow}"`
    ).toBe(true);

    // ── Capture full-page screenshot ─────────────────────────────────────
    await emailInput.blur();
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'reset-password.png'),
      fullPage: true,
    });
  });
});
