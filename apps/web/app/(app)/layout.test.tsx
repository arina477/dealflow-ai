/**
 * app/(app)/layout.tsx — AppLayout server component tests (wave-3, B-3).
 *
 * Coverage:
 *   - Unauthenticated: redirect('/login') when /auth/me returns non-OK.
 *   - Unauthenticated: redirect('/login') when fetch rejects (network error).
 *   - Unauthenticated: redirect('/login') when response fails schema validation.
 *   - Authenticated: renders children inside AppShell (does not redirect).
 *   - Cookie forwarding: passes next/headers cookie string as fetch header.
 *
 * Strategy: AppLayout is an async server component. We await it in tests,
 * passing a mock children prop. next/headers, next/navigation are mocked
 * at the module boundary. AppShell + Sidebar + TopBar + NavItem are mocked
 * to avoid lucide-react ESM complications in jsdom.
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockRedirect, mockCookies, mockHeaders } = vi.hoisted(() => {
  const mockRedirect = vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  });
  const mockCookies = vi.fn().mockResolvedValue({
    toString: () => 'st-access-token=test-token; st-refresh-token=refresh-xyz',
  });
  const mockHeaders = vi.fn().mockResolvedValue({
    get: (_: string) => null,
  });
  return { mockRedirect, mockCookies, mockHeaders };
});

vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('next/headers', () => ({ cookies: mockCookies, headers: mockHeaders }));

// Mock AppShell to avoid pulling in lucide-react ESM in jsdom.
vi.mock('./_components/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

import AppLayout from './layout';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeFetchOk(body: unknown): typeof fetch {
  return vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      headers: {
        get: () => null,
      },
      _capturedCookieHeader: (init?.headers as Record<string, string>)?.cookie,
    } as unknown as Response);
  });
}

function makeFetchNotOk(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  } as Response);
}

function makeFetchError(): typeof fetch {
  return vi.fn().mockRejectedValue(new Error('network error'));
}

// Capture cookie header from fetch call.
let capturedCookieHeader: string | undefined;

function makeFetchOkCapture(body: unknown): typeof fetch {
  return vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
    capturedCookieHeader = (init?.headers as Record<string, string>)?.cookie;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    } as Response);
  });
}

async function renderLayout(children: React.ReactNode = <div>page content</div>) {
  try {
    const jsx = await AppLayout({ children });
    if (jsx) render(jsx);
    return { redirected: false, path: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

const VALID_ME = { userId: 'u1', email: 'admin@firm.com', role: 'admin' as const };

// ── Tests ─────────────────────────────────────────────────────────────────

describe('AppLayout (app/(app)/layout.tsx)', () => {
  beforeEach(() => {
    capturedCookieHeader = undefined;
    mockCookies.mockResolvedValue({
      toString: () => 'st-access-token=test-token; st-refresh-token=refresh-xyz',
    });
    mockRedirect.mockImplementation((path: string): never => {
      throw new Error(`REDIRECT:${path}`);
    });
    mockHeaders.mockResolvedValue({ get: (_: string) => null });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('unauthenticated (redirect to /login)', () => {
    it('redirects to /login when /auth/me returns 401', async () => {
      vi.stubGlobal('fetch', makeFetchNotOk(401));
      const { redirected, path } = await renderLayout();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });

    it('redirects to /login when /auth/me returns 403', async () => {
      vi.stubGlobal('fetch', makeFetchNotOk(403));
      const { redirected, path } = await renderLayout();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });

    it('redirects to /login when fetch rejects (network error)', async () => {
      vi.stubGlobal('fetch', makeFetchError());
      const { redirected, path } = await renderLayout();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });

    it('redirects to /login when /auth/me body fails schema validation', async () => {
      vi.stubGlobal('fetch', makeFetchOk({ unexpected: 'shape' }));
      const { redirected, path } = await renderLayout();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  describe('authenticated — renders AppShell', () => {
    it('renders children inside AppShell when session is valid', async () => {
      vi.stubGlobal('fetch', makeFetchOk(VALID_ME));
      const { redirected } = await renderLayout(<div>Dashboard content</div>);
      expect(redirected).toBe(false);
      expect(screen.getByTestId('app-shell')).toBeDefined();
      expect(screen.getByText('Dashboard content')).toBeDefined();
    });

    it('does not redirect when session is valid', async () => {
      vi.stubGlobal('fetch', makeFetchOk(VALID_ME));
      const { redirected } = await renderLayout();
      expect(redirected).toBe(false);
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe('cookie forwarding', () => {
    it('passes next/headers cookie string as the fetch cookie header', async () => {
      vi.stubGlobal('fetch', makeFetchOkCapture(VALID_ME));
      await renderLayout();
      expect(capturedCookieHeader).toBe('st-access-token=test-token; st-refresh-token=refresh-xyz');
    });
  });
});
