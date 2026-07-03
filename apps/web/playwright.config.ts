/**
 * Playwright E2E configuration — DealFlow AI web (wave-2 auth screens).
 *
 * Targets the LIVE production deployment:
 *   web: https://dealflow-web-production-a4f7.up.railway.app
 *   api: https://dealflow-api-production-66d4.up.railway.app
 *
 * Browser: bundled chromium-1208 via PLAYWRIGHT_BROWSERS_PATH compatibility
 * shim.  The system has playwright@1.61.1 installed; playwright-core@1.61.1
 * expects chromium revision 1228 but the host has revision 1208 at
 * ~/.cache/ms-playwright/.  The `test:e2e` npm script sets
 * PLAYWRIGHT_BROWSERS_PATH to ~/.local/share/pw-compat where revision 1228
 * directory names are symlinked to the actual 1208 binaries.
 *
 * NO channel: 'chrome' — the host Google Chrome binary is absent.
 *
 * E2E specs live in ./e2e/ — separated from app/**  so the vitest unit
 * runner (include: ['app/**\/*.{spec,test}.{ts,tsx}']) never picks them up.
 */

import { defineConfig, devices } from '@playwright/test';

const WEB_BASE_URL = 'https://dealflow-web-production-a4f7.up.railway.app';

export default defineConfig({
  testDir: './e2e',
  // Each test file gets a fresh browser context; no shared state across specs.
  fullyParallel: false,
  // Retry once on first failure to guard against transient network blips.
  retries: 1,
  // Single worker — live site; avoid concurrent state mutations on the same
  // test accounts.
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'e2e/results.json' }]],
  use: {
    baseURL: WEB_BASE_URL,
    // Desktop Chrome device profile (viewport, user-agent).
    // No channel set — relies on bundled chromium-1208 via PLAYWRIGHT_BROWSERS_PATH.
    ...devices['Desktop Chrome'],
    headless: true,
    // Wait up to 10 s for any action / network event.
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    // Capture traces + screenshots on test failure for post-run triage.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Global timeout per test (ms).
  timeout: 60_000,
  // Give the expect() matcher up to 8 s before failing.
  expect: {
    timeout: 8_000,
  },
});
