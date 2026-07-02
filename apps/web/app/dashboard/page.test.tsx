/**
 * Dashboard page — RTL component tests (B-3 bug-fix, wave-2).
 *
 * Coverage:
 *   - Cookie forwarding: the server-side fetch includes the `cookie` header
 *     derived from `next/headers` cookies() — never relies on `credentials: 'include'`.
 *   - Authenticated path: renders email + role when /auth/me returns 200.
 *   - Unauthenticated path: calls redirect('/login') when /auth/me returns 401.
 *   - Unauthenticated path: calls redirect('/login') when fetch rejects (network error).
 *   - Unauthenticated path: calls redirect('/login') when response fails schema validation.
 *
 * Strategy: DashboardPage is an async server component. We await the async
 * function in tests (same pattern as apps/web/app/page.test.tsx). next/headers
 * and next/navigation are mocked at the module boundary. The global `fetch` mock
 * lets us control /auth/me responses per test.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks — must be declared before importing the page ──────────────────────
//
// vi.mock factories are hoisted to the top of the file by Vitest, so they run
// before any variable declarations below them. The factory must be completely
// self-contained — no references to outer `const` variables (those are
// initialized later and cause ReferenceError). We use vi.hoisted() to create
// stable mock refs that ARE available at hoist-time.

const { mockRedirect, mockCookies } = vi.hoisted(() => {
  const mockRedirect = vi.fn((path: string): never => {
    // next/navigation redirect throws in real Next.js to abort rendering.
    // Throw here so the async server component exits the same way.
    throw new Error(`REDIRECT:${path}`);
  });

  const mockCookies = vi.fn().mockResolvedValue({
    // next/headers ReadonlyRequestCookies exposes .toString() → "name=value; ..."
    toString: () => 'st-access-token=test-token; st-refresh-token=refresh-xyz',
  });

  return { mockRedirect, mockCookies };
});

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

vi.mock('next/headers', () => ({
  cookies: mockCookies,
}));

// Import AFTER mocks are established.
import DashboardPage from './page';

// Capture the cookie header passed to fetch so we can assert on it.
let capturedCookieHeader: string | undefined;

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchOk(body: unknown): typeof fetch {
  return vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    capturedCookieHeader = (init?.headers as Record<string, string>)?.cookie;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

function makeFetchNotOk(status: number): typeof fetch {
  return vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    capturedCookieHeader = (init?.headers as Record<string, string>)?.cookie;
    return Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({}),
    } as Response);
  });
}

function makeFetchError(): typeof fetch {
  return vi.fn().mockImplementation(() => {
    return Promise.reject(new Error('network failure'));
  });
}

// Helper to call DashboardPage and collect either JSX or the redirect error.
async function renderDashboard() {
  try {
    const jsx = await DashboardPage();
    render(jsx);
    return { redirected: false, path: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardPage', () => {
  beforeEach(() => {
    capturedCookieHeader = undefined;
    // Re-establish the mockCookies implementation after clearAllMocks.
    // vi.clearAllMocks() wipes mock implementations; we need cookies() to keep
    // resolving to a valid ReadonlyRequestCookies-like object every test.
    mockCookies.mockResolvedValue({
      toString: () => 'st-access-token=test-token; st-refresh-token=refresh-xyz',
    });
    // Re-establish mockRedirect throw behaviour — clearAllMocks wipes it too.
    mockRedirect.mockImplementation((path: string): never => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('cookie forwarding', () => {
    it('passes the next/headers cookie string as the fetch cookie header', async () => {
      // meResponseSchema requires: { userId, email, role } with role in enum.
      vi.stubGlobal(
        'fetch',
        makeFetchOk({ userId: 'u1', email: 'partner@firm.com', role: 'admin' })
      );

      await renderDashboard();

      // The cookie header must be the value returned by cookies().toString(),
      // not undefined (which would mean `credentials: 'include'` path).
      expect(capturedCookieHeader).toBe('st-access-token=test-token; st-refresh-token=refresh-xyz');
    });

    it('does NOT rely on credentials:include (header present, not undefined)', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchOk({ userId: 'u2', email: 'analyst@firm.com', role: 'analyst' })
      );

      await renderDashboard();

      // If the old broken code ran, capturedCookieHeader would be undefined
      // because credentials:'include' doesn't inject a cookie header in Node.
      expect(capturedCookieHeader).not.toBeUndefined();
    });
  });

  describe('authenticated (200 from /auth/me)', () => {
    it('renders the email of the authenticated user', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchOk({ userId: 'u1', email: 'partner@firm.com', role: 'admin' })
      );

      const { redirected } = await renderDashboard();

      expect(redirected).toBe(false);
      expect(screen.getByText(/partner@firm\.com/)).toBeDefined();
    });

    it('renders the role of the authenticated user', async () => {
      // Use 'compliance' so the role text does not appear inside the email address.
      vi.stubGlobal(
        'fetch',
        makeFetchOk({ userId: 'u2', email: 'compliance-lead@firm.com', role: 'compliance' })
      );

      const { redirected } = await renderDashboard();

      expect(redirected).toBe(false);
      // "compliance" appears standalone as the role; it is not part of the email.
      expect(screen.getAllByText(/compliance/).length).toBeGreaterThanOrEqual(1);
    });

    it('renders the Dashboard heading', async () => {
      vi.stubGlobal('fetch', makeFetchOk({ userId: 'u3', email: 'admin@firm.com', role: 'admin' }));

      const { redirected } = await renderDashboard();

      expect(redirected).toBe(false);
      expect(screen.getByRole('heading', { name: /dashboard/i })).toBeDefined();
    });
  });

  describe('unauthenticated (redirect to /login)', () => {
    it('redirects to /login when /auth/me returns 401', async () => {
      vi.stubGlobal('fetch', makeFetchNotOk(401));

      const { redirected, path } = await renderDashboard();

      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });

    it('redirects to /login when /auth/me returns 403', async () => {
      vi.stubGlobal('fetch', makeFetchNotOk(403));

      const { redirected, path } = await renderDashboard();

      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });

    it('redirects to /login when fetch rejects (network error)', async () => {
      vi.stubGlobal('fetch', makeFetchError());

      const { redirected, path } = await renderDashboard();

      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });

    it('redirects to /login when /auth/me body fails schema validation', async () => {
      // Missing required fields — meResponseSchema will reject this.
      vi.stubGlobal('fetch', makeFetchOk({ unexpected: 'shape' }));

      const { redirected, path } = await renderDashboard();

      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });
});
