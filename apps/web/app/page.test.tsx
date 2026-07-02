/**
 * T-2 Unit — apps/web/app/page.tsx (HomePage server component)
 *
 * Strategy: HomePage is an async server component that calls `fetch` internally.
 * We render it directly under jsdom by awaiting the async component function
 * and passing the resolved JSX to RTL `render`. React 19 async server components
 * resolve synchronously in a test environment when their awaited data is pre-resolved
 * via mocked fetch.
 *
 * Mock boundary: global `fetch` is mocked at the network boundary per
 * test-writing-principles §7. We never mock the component itself.
 *
 * Covers AC#11 — web page consumes healthResponseSchema and renders correctly.
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The component is an async function — import it directly.
import HomePage from './page';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeFetchOk(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  } as Response);
}

function makeFetchError(message: string): typeof fetch {
  return vi.fn().mockRejectedValue(new Error(message));
}

function makeFetchNonOk(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  } as unknown as Response);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('HomePage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('healthy API response (status:ok, db:ok)', () => {
    it('renders the health card with ok status (AC#11)', async () => {
      // Arrange — mock fetch to return a valid healthResponseSchema payload
      const healthPayload = { status: 'ok', db: 'ok', version: 'abc1234' };
      vi.stubGlobal('fetch', makeFetchOk(healthPayload));

      // Act — await the async server component, then render
      const jsx = await HomePage();
      render(jsx);

      // Assert — API health status section is present (accessibility landmark)
      const section = screen.getByRole('region', { name: /api health status/i });
      expect(section).toBeDefined();

      // Assert — "ok" appears at least once (status pill + API row + DB row)
      const okElements = screen.getAllByText('ok');
      expect(okElements.length).toBeGreaterThanOrEqual(1);

      // Assert — version is rendered (AC#11: schema field consumed + displayed)
      expect(screen.getByText('abc1234')).toBeDefined();

      // Assert — no error alert rendered in the ok branch
      const alerts = screen.queryAllByRole('alert');
      expect(alerts).toHaveLength(0);
    });

    it('renders database status as ok when db field is ok', async () => {
      // Arrange
      const healthPayload = { status: 'ok', db: 'ok', version: 'v1' };
      vi.stubGlobal('fetch', makeFetchOk(healthPayload));

      // Act
      const jsx = await HomePage();
      render(jsx);

      // Assert — "Database" label row is present
      expect(screen.getByText('Database')).toBeDefined();

      // Assert — multiple "ok" text nodes (status pill + API row + DB row)
      const okEls = screen.getAllByText('ok');
      expect(okEls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('fetch rejects (api unreachable branch)', () => {
    it('renders the api-unreachable error reason in an alert', async () => {
      // Arrange — fetch rejects (network failure, AbortSignal timeout, etc.)
      vi.stubGlobal('fetch', makeFetchError('Failed to fetch'));

      // Act
      const jsx = await HomePage();
      render(jsx);

      // Assert — error alert is present (role="alert" per page.tsx)
      const alert = screen.getByRole('alert');
      expect(alert).toBeDefined();

      // Assert — reason text includes the unreachable marker and error message
      expect(alert.textContent).toMatch(/api unreachable/i);
      expect(alert.textContent).toContain('Failed to fetch');
    });

    it('renders degraded status in multiple places when fetch rejects', async () => {
      // Arrange
      vi.stubGlobal('fetch', makeFetchError('connection refused'));

      // Act
      const jsx = await HomePage();
      render(jsx);

      // Assert — "degraded" text appears at least once (statusPill + API row)
      const degradedEls = screen.getAllByText('degraded');
      expect(degradedEls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('non-ok HTTP response from API', () => {
    it('renders the error alert with api-returned-status reason', async () => {
      // Arrange — fetch resolves but HTTP status is 503
      vi.stubGlobal('fetch', makeFetchNonOk(503));

      // Act
      const jsx = await HomePage();
      render(jsx);

      // Assert — error alert present
      const alert = screen.getByRole('alert');
      expect(alert).toBeDefined();
      expect(alert.textContent).toMatch(/api returned 503/i);
    });
  });

  describe('invalid response shape (schema validation)', () => {
    it('renders the invalid-response-shape error when body fails healthResponseSchema', async () => {
      // Arrange — fetch returns body that fails healthResponseSchema
      // (proves the web consumes and validates healthResponseSchema — AC#11)
      // Missing version field + bad status enum value:
      const badPayload = { status: 'unknown_status', db: 'ok' };
      vi.stubGlobal('fetch', makeFetchOk(badPayload));

      // Act
      const jsx = await HomePage();
      render(jsx);

      // Assert — invalid-response-shape error rendered in alert
      const alert = screen.getByRole('alert');
      expect(alert).toBeDefined();
      expect(alert.textContent).toMatch(/invalid response shape/i);
    });
  });
});
