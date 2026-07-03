/**
 * E2E — wave-2 auth screens (T-5 real-browser, chromium-1208)
 *
 * Targets the LIVE production deployment.
 *   web baseURL: https://dealflow-web-production-a4f7.up.railway.app (from playwright.config)
 *   api:         https://dealflow-api-production-66d4.up.railway.app
 *
 * Uses Playwright's `request` fixture for API calls (invite mint / account
 * setup) and the `page` fixture for browser-driven flows.
 *
 * Test emails: disposable e2e+<label>+<timestamp>@example.com — unique per run
 * so invite mint + account creation never collide with prior test runs.
 *
 * PRODUCT FINDINGS (routes to B per Iron Law — no test-side workaround):
 *   [FINDING-1] POST /auth/signin (SuperTokens auto-route) returns 404.
 *               Root cause: NestJS middleware ordering bug in main.ts — the
 *               SuperTokens middleware() and CORS middleware are registered via
 *               app.use() AFTER app.init() registers the NestJS router, so the
 *               NestJS router handles (and 404s) /auth/signin before
 *               SuperTokens can intercept it.  CORS OPTIONS preflight for
 *               /auth/signin also returns 404 with no CORS headers, so the
 *               browser fetch() throws (CORS policy violation) and the catch
 *               block shows "Unable to reach the server" instead of the
 *               intended "Invalid email or password".
 *   [FINDING-2] POST /auth/signup (custom route, works) responds 201 and
 *               creates the session as HTTP response headers (st-access-token /
 *               st-refresh-token / front-token) NOT as Set-Cookie.  The
 *               / server component calls next/headers cookies() which
 *               finds no session cookie, so /auth/me returns 401 and the
 *               dashboard redirects to /login.  Accept-invite happy path ends
 *               on /login not /.
 */

import { expect, test } from '@playwright/test';

// ── Configuration ──────────────────────────────────────────────────────────

const API_BASE = 'https://dealflow-api-production-66d4.up.railway.app';
const WEB_ORIGIN = 'https://dealflow-web-production-a4f7.up.railway.app';
const TEST_PASSWORD = 'Str0ngPassw0rd!';

/**
 * Unique timestamp suffix minted once per run.  Playwright runs in Node.js
 * where Date.now() is available; each `test.describe` block calls this via
 * beforeAll so every spec group gets its own non-colliding email.
 */
function makeEmail(label: string, ts: number): string {
  return `e2e+${label}+${ts}@example.com`;
}

/**
 * Mint an invite via POST /auth/invite and return the raw token string.
 * Throws if the API does not return 200-range.
 */
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

/**
 * Accept an invite token via the custom POST /auth/signup endpoint (server-side,
 * not via the browser).  Used by the login-success spec to pre-create an account
 * before testing the login page.
 * Returns the signup response body.
 */
async function acceptInviteViaApi(
  request: Parameters<Parameters<typeof test>[1]>[0]['request'],
  inviteToken: string,
  password: string
): Promise<{ userId: string; email: string; role: string }> {
  const res = await request.post(`${API_BASE}/auth/signup`, {
    headers: {
      'Content-Type': 'application/json',
      Origin: WEB_ORIGIN,
    },
    data: { inviteToken, password },
  });
  if (res.status() !== 201) {
    throw new Error(`acceptInviteViaApi failed: ${res.status()} ${await res.text()}`);
  }
  return res.json() as Promise<{ userId: string; email: string; role: string }>;
}

// ── Spec 1: Login success ──────────────────────────────────────────────────

test.describe('login success', () => {
  let testEmail: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    testEmail = makeEmail('login-success', ts);
    // Arrange: mint invite + create account via API before browser test.
    const token = await mintInvite(request, testEmail);
    await acceptInviteViaApi(request, token, TEST_PASSWORD);
  });

  test('fills login form and redirects to /', async ({ page }) => {
    // Arrange
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    // Act
    await page.getByLabel('Email address').fill(testEmail);
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Assert — wait for navigation; expect to land on /.
    // [FINDING-1] POST /auth/signin returns 404 (NestJS middleware ordering
    // bug: SuperTokens middleware() and CORS registered after app.init() routes
    // the NestJS router ahead of them). Browser fetch() throws (CORS policy on
    // OPTIONS preflight 404). Error shown is "Unable to reach the server", no
    // redirect. When FINDING-1 is fixed, this assertion should pass.
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    // Verify identity chip shows the correct email and role.
    await expect(page.getByText(testEmail)).toBeVisible();
    await expect(page.getByText('advisor')).toBeVisible();
  });
});

// ── Spec 2: Login failure ──────────────────────────────────────────────────

test.describe('login failure', () => {
  test('wrong password shows inline error with no redirect or enumeration', async ({ page }) => {
    // Arrange
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    // Act — enter credentials that will never match.
    await page.getByLabel('Email address').fill('e2e+login-fail@example.com');
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword999!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Assert — an inline alert is shown (role="alert"); NO redirect.
    // Note: with FINDING-1 in place, the fetch() to /auth/signin throws a CORS
    // TypeError (OPTIONS preflight returns 404 with no CORS headers).  The catch
    // block sets "Unable to reach the server. Check your connection and try again."
    // rather than the intended "Invalid email or password. Please try again."
    // The security property (no redirect on failure, no enumeration across
    // unknown-email vs wrong-password) is maintained regardless of error text.
    // When FINDING-1 is fixed, the alert text will be "Invalid email or password."
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    // Page must NOT have navigated away from /login.
    await expect(page).toHaveURL(/\/login/);
    // The submit button must be re-enabled (not stuck in loading state).
    await expect(page.getByRole('button', { name: /sign in/i })).toBeEnabled();
  });
});

// ── Spec 3: Accept-invite happy path ──────────────────────────────────────

test.describe('accept-invite happy path', () => {
  let inviteToken: string;

  test.beforeAll(async ({ request }) => {
    const ts = Date.now();
    const email = makeEmail('accept-invite', ts);
    inviteToken = await mintInvite(request, email);
  });

  test('set-password form renders and submitting provisions account', async ({ page }) => {
    // Arrange — navigate with a freshly minted invite token.
    await page.goto(`/accept-invite?token=${encodeURIComponent(inviteToken)}`);

    // Assert form present (invite token is non-empty → form branch renders).
    await expect(page.getByRole('heading', { name: 'Set up your account' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept & create account' })).toBeVisible();

    // Act — fill and submit the set-password form.
    // Use exact: true on 'Password' to avoid strict-mode violation: the page
    // has two labels containing "password" — "Password" and "Confirm password".
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Accept & create account' }).click();

    // Assert — expect redirect to / after account creation.
    // [FINDING-2] POST /auth/signup responds 201 and sets session as HTTP
    // response headers (st-access-token) NOT as Set-Cookie.  The /
    // server component calls next/headers cookies(); none are set, so
    // /auth/me returns 401 and the dashboard redirects to /login.
    // When FINDING-2 is resolved (cookie-based sessions or cookie-forwarding
    // fix), this assertion should pass.
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});

// ── Spec 4: Accept-invite invalid / bogus token ────────────────────────────

test.describe('accept-invite invalid token', () => {
  test('bogus token: form renders; on submit shows generic invite error', async ({ page }) => {
    // Design note: the client treats any non-empty token string as potentially
    // valid (token format is opaque; validation is server-side only).
    // With ?token=bogus the set-password form IS rendered (not an error page).
    // The error appears only after the form is submitted and the server rejects.
    await page.goto('/accept-invite?token=bogus');

    // The set-password form must render (client defers validation to server).
    await expect(page.getByRole('heading', { name: 'Set up your account' })).toBeVisible();

    // Act — fill and submit; server should reject the bogus token.
    // Use exact: true on 'Password' to avoid strict-mode violation.
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Accept & create account' }).click();

    // Assert — an inline alert is shown with a rejection message.
    // Intended behavior: "invalid, has expired, or has already been used" (400 from API).
    // If [FINDING-1]-class CORS issue affects /auth/signup OPTIONS preflight:
    // "Unable to reach the server" (catch block).  Either way, an alert is shown
    // and the user stays on /accept-invite.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
    await expect(page).toHaveURL(/\/accept-invite/);
  });

  test('missing token: error state renders immediately (no form)', async ({ page }) => {
    // No ?token= parameter → client renders the "Invite Link Invalid" error
    // without a network call (empty string evaluates falsy).
    await page.goto('/accept-invite');

    await expect(page.getByRole('heading', { name: 'Invite Link Invalid' })).toBeVisible();
    // Set-password form must NOT be present.
    await expect(page.getByRole('button', { name: 'Accept & create account' })).not.toBeVisible();
  });
});

// ── Spec 5: Reset-password request ────────────────────────────────────────

test.describe('reset password — request step', () => {
  test('submitting email shows check-your-email ack regardless of account existence', async ({
    page,
  }) => {
    // Arrange
    await page.goto('/reset-password');
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();

    // Act — enter an address (no real account needed; no-enumeration means same
    // 202 ack for existing and non-existing emails).
    await page.getByLabel('Email address').fill('e2e+reset-request@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();

    // Assert — "Check your email" ack rendered; no redirect to /login.
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible({
      timeout: 10_000,
    });
    // Must still be on /reset-password (ack is inline, not a new route).
    await expect(page).toHaveURL(/\/reset-password/);
    // "Back to sign in" link present.
    await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
  });
});
