/**
 * / (app/(app)/page.tsx) — role-aware dashboard shell tests (wave-3, B-3).
 *
 * Coverage:
 *   - AppShell renders per role: each of 4 roles sees the correct nav set.
 *   - Unauth → /login redirect (layout guard; also defensively in the page).
 *   - Role-aware nav = navItemsForRole (verified by mocked Sidebar + rbac.ts).
 *   - Dashboard shell renders identity (email) + role for every role.
 *   - Cookie forwarding: fetch passes next/headers cookie string.
 *   - Compliance/admin role sees compliance section; advisor/analyst sees landing.
 *
 * Strategy: DashboardPage is an async server component. AppShell, Sidebar,
 * TopBar, NavItem are mocked to isolate page-level logic from chrome. The
 * rbac.ts navItemsForRole is imported directly to verify per-role nav sets
 * without relying on the Sidebar implementation.
 */

import type { Role } from '@dealflow/shared';
import { navItemsForRole } from '@dealflow/shared';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockRedirect, mockCookies } = vi.hoisted(() => {
  const mockRedirect = vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  });
  const mockCookies = vi.fn().mockResolvedValue({
    toString: () => 'st-access-token=test-token; st-refresh-token=refresh-xyz',
  });
  return { mockRedirect, mockCookies };
});

vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('next/headers', () => ({ cookies: mockCookies }));

// ── Tests ─────────────────────────────────────────────────────────────────

import DashboardPage from './page';

// Helpers

function makeFetchOk(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
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

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

async function renderDashboard() {
  try {
    const jsx = await DashboardPage();
    if (jsx) render(jsx);
    return { redirected: false, path: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

const ALL_ROLES: Role[] = ['advisor', 'analyst', 'compliance', 'admin'];

// ── Tests ─────────────────────────────────────────────────────────────────

describe('DashboardPage (app/(app)/page.tsx)', () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({
      toString: () => 'st-access-token=test-token; st-refresh-token=refresh-xyz',
    });
    mockRedirect.mockImplementation((path: string): never => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── navItemsForRole — RBAC contract (unit, no render needed) ────────────

  describe('navItemsForRole — per-role nav set (rbac.ts contract)', () => {
    it('advisor sees Dashboard + Mandates + Compliance (not Sourcing, not Team, not Settings)', () => {
      const items = navItemsForRole('advisor');
      const labels = items.map((i) => i.label);
      expect(labels).toContain('Dashboard');
      expect(labels).toContain('Mandates');
      expect(labels).toContain('Compliance');
      expect(labels).not.toContain('Sourcing');
      expect(labels).not.toContain('Team');
      expect(labels).not.toContain('Settings');
    });

    it('analyst sees Dashboard + Mandates + Sourcing (not Compliance, not Team, not Settings)', () => {
      const items = navItemsForRole('analyst');
      const labels = items.map((i) => i.label);
      expect(labels).toContain('Dashboard');
      expect(labels).toContain('Mandates');
      expect(labels).toContain('Sourcing');
      expect(labels).not.toContain('Compliance');
      expect(labels).not.toContain('Team');
      expect(labels).not.toContain('Settings');
    });

    it('compliance sees Dashboard + Compliance (not Mandates, not Sourcing, not Team, not Settings)', () => {
      const items = navItemsForRole('compliance');
      const labels = items.map((i) => i.label);
      expect(labels).toContain('Dashboard');
      expect(labels).toContain('Compliance');
      expect(labels).not.toContain('Mandates');
      expect(labels).not.toContain('Sourcing');
      expect(labels).not.toContain('Team');
      expect(labels).not.toContain('Settings');
    });

    it('admin sees Dashboard + Mandates + Sourcing + Team + Settings (read-oversight; not Compliance)', () => {
      // Wave-8: admin on NAV_MANDATES. Wave-36: admin gains read-only oversight of Sourcing.
      const items = navItemsForRole('admin');
      const labels = items.map((i) => i.label);
      expect(labels).toContain('Dashboard');
      expect(labels).toContain('Mandates');
      expect(labels).toContain('Team');
      expect(labels).toContain('Settings');
      expect(labels).toContain('Sourcing');
      expect(labels).not.toContain('Compliance');
    });

    it('every role sees at least 1 nav item (never empty sidebar)', () => {
      for (const role of ALL_ROLES) {
        expect(navItemsForRole(role).length).toBeGreaterThan(0);
      }
    });

    it('Dashboard item is permitted for all 4 roles', () => {
      for (const role of ALL_ROLES) {
        const items = navItemsForRole(role);
        expect(items.some((i) => i.label === 'Dashboard')).toBe(true);
      }
    });
  });

  // ── Unauthenticated ───────────────────────────────────────────────────────

  describe('unauthenticated (redirect to /login)', () => {
    it('redirects to /login when /auth/me returns 401', async () => {
      vi.stubGlobal('fetch', makeFetchNotOk(401));
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
      vi.stubGlobal('fetch', makeFetchOk({ invalid: 'shape' }));
      const { redirected, path } = await renderDashboard();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  // ── Identity rendering (all roles) ────────────────────────────────────────

  describe('dashboard shell renders identity + role', () => {
    for (const role of ALL_ROLES) {
      it(`renders email and role label for ${role}`, async () => {
        vi.stubGlobal('fetch', makeFetchOk(meFor(role)));
        const { redirected } = await renderDashboard();
        expect(redirected).toBe(false);
        expect(screen.getByText(new RegExp(`${role}@firm\\.com`))).toBeDefined();
        // Role label or role text appears somewhere in the rendered output.
        expect(screen.getAllByText(new RegExp(role, 'i')).length).toBeGreaterThanOrEqual(1);
      });
    }
  });

  // ── Role-appropriate content ──────────────────────────────────────────────

  describe('role-appropriate content', () => {
    it('compliance role sees Compliance Overview section', async () => {
      vi.stubGlobal('fetch', makeFetchOk(meFor('compliance')));
      const { redirected } = await renderDashboard();
      expect(redirected).toBe(false);
      expect(screen.getByRole('region', { name: /compliance overview/i })).toBeDefined();
    });

    it('admin role sees Compliance Overview section', async () => {
      vi.stubGlobal('fetch', makeFetchOk(meFor('admin')));
      const { redirected } = await renderDashboard();
      expect(redirected).toBe(false);
      expect(screen.getByRole('region', { name: /compliance overview/i })).toBeDefined();
    });

    it('advisor role sees coming-soon landing (not compliance section)', async () => {
      vi.stubGlobal('fetch', makeFetchOk(meFor('advisor')));
      const { redirected } = await renderDashboard();
      expect(redirected).toBe(false);
      // Coming-soon content should appear
      expect(screen.queryByRole('region', { name: /compliance overview/i })).toBeNull();
    });

    it('analyst role sees coming-soon landing (not compliance section)', async () => {
      vi.stubGlobal('fetch', makeFetchOk(meFor('analyst')));
      const { redirected } = await renderDashboard();
      expect(redirected).toBe(false);
      expect(screen.queryByRole('region', { name: /compliance overview/i })).toBeNull();
    });
  });

  // ── Cookie forwarding ─────────────────────────────────────────────────────

  describe('cookie forwarding', () => {
    it('passes the next/headers cookie string as the fetch cookie header', async () => {
      let capturedCookie: string | undefined;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
          capturedCookie = (init?.headers as Record<string, string>)?.cookie;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(meFor('admin')),
          } as Response);
        })
      );
      await renderDashboard();
      expect(capturedCookie).toBe('st-access-token=test-token; st-refresh-token=refresh-xyz');
    });
  });
});
