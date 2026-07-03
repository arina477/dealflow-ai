/**
 * /dashboard redirect — component test (wave-3).
 *
 * The wave-2 dashboard placeholder at /dashboard has been retired.
 * The page now immediately redirects to '/' (canonical authed dashboard).
 *
 * Full dashboard coverage lives in:
 *   app/(app)/page.test.tsx  — role-aware dashboard shell tests
 *   app/(app)/layout.test.tsx — auth guard + AppShell render tests
 */

import { describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockRedirect } = vi.hoisted(() => {
  const mockRedirect = vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  });
  return { mockRedirect };
});

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
}));

import DashboardRedirectPage from './page';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DashboardRedirectPage (/dashboard retired)', () => {
  it('redirects to / (canonical dashboard per P-4 remediation)', () => {
    // Re-establish mock behaviour after any clearAllMocks from beforeEach.
    mockRedirect.mockImplementation((path: string): never => {
      throw new Error(`REDIRECT:${path}`);
    });

    let redirectedTo: string | null = null;
    try {
      DashboardRedirectPage();
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
        redirectedTo = err.message.replace('REDIRECT:', '');
      } else {
        throw err;
      }
    }
    expect(redirectedTo).toBe('/');
  });
});
