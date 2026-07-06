/**
 * /compliance/audit-log — AuditLogPage + IntegrityPanel tests (wave-4, B-3).
 *
 * Coverage:
 *   - Page renders integrity view for compliance role (verified state).
 *   - Non-compliance roles (advisor, analyst, admin) redirect to '/'.
 *   - Unauthenticated (no session) redirects to '/login'.
 *   - Verified state: renders "All entries verified" status.
 *   - Broken state: renders PERSISTENT non-dismissible panel with firstBreakAt
 *     and reason (NOT a toast that disappears).
 *   - Verify-now action: IntegrityPanel re-calls verify endpoint and updates
 *     state.
 *   - Empty log (entriesChecked: 0, ok: true): renders verified state with 0.
 *
 * Strategy:
 *   - AuditLogPage is an async server component; we await + render like
 *     the existing wave-3 tests (page.test.tsx / layout.test.tsx).
 *   - IntegrityPanel is a client component; we render it directly and use
 *     @testing-library/user-event for the verify-now interaction.
 *   - next/navigation and next/headers are mocked at the module boundary.
 *   - AppShell is excluded (this page is inside (app)/layout which is not
 *     rendered in unit tests; only page content is tested here).
 */

import type { AuditVerifyResponse } from '@dealflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { IntegrityPanel } from './_components/IntegrityPanel';
import AuditLogPage from './page';

// ── Helpers ────────────────────────────────────────────────────────────────

type Role = 'advisor' | 'analyst' | 'compliance' | 'admin';

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const VERIFIED_RESULT: AuditVerifyResponse = {
  ok: true,
  entriesChecked: 42,
};

const EMPTY_VERIFIED_RESULT: AuditVerifyResponse = {
  ok: true,
  entriesChecked: 0,
};

const BROKEN_RESULT: AuditVerifyResponse = {
  ok: false,
  entriesChecked: 17,
  firstBreakAt: 8,
  reason: 'content-hash-mismatch',
};

const BROKEN_PREV_HASH: AuditVerifyResponse = {
  ok: false,
  entriesChecked: 5,
  firstBreakAt: 3,
  reason: 'prev-hash-mismatch',
};

const BROKEN_GAP: AuditVerifyResponse = {
  ok: false,
  entriesChecked: 10,
  firstBreakAt: 7,
  reason: 'sequence-gap',
};

/**
 * Build a fetch mock that returns me-response on /auth/me and verifyResult
 * on /compliance/audit-log/verify.
 */
function makePageFetch(meRole: Role, verifyResult: AuditVerifyResponse | null) {
  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(meRole)),
      } as Response);
    }
    if (typeof url === 'string' && url.includes('/compliance/audit-log/verify')) {
      if (verifyResult === null) {
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(verifyResult),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${String(url)}`));
  });
}

function makeAuthFetch(status: number) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  } as Response);
}

async function renderPage() {
  try {
    const jsx = await AuditLogPage();
    if (jsx) render(jsx);
    return { redirected: false, path: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AuditLogPage (/compliance/audit-log)', () => {
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

  // ── RBAC / auth guards ──────────────────────────────────────────────────

  // wave-13: /compliance/audit-log extended from compliance-only to
  // compliance + admin + advisor (read; advisor gets own-outreach scope server-side).
  // The assertRole helper reads canAccess from shared roleRoutes, so this page
  // picks up the wave-13 expansion automatically (no page-code change needed).
  describe('RBAC guard — compliance + admin + advisor (wave-13)', () => {
    it('renders for compliance role (no redirect)', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance', VERIFIED_RESULT));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
    });

    it('renders for advisor role (no redirect, wave-13: own-outreach scope via API)', async () => {
      vi.stubGlobal('fetch', makePageFetch('advisor', VERIFIED_RESULT));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
    });

    it('redirects to / for analyst role (unchanged, analyst has no audit-log access)', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst', VERIFIED_RESULT));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/');
    });

    it('renders for admin role (no redirect, wave-13: admin added for org-wide access)', async () => {
      vi.stubGlobal('fetch', makePageFetch('admin', VERIFIED_RESULT));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
    });

    it('redirects to /login when session is invalid (401)', async () => {
      vi.stubGlobal('fetch', makeAuthFetch(401));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });

    it('redirects to /login when /auth/me returns 403', async () => {
      vi.stubGlobal('fetch', makeAuthFetch(403));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  // ── Integrity view rendering ────────────────────────────────────────────

  describe('integrity view content', () => {
    it('renders integrity view heading for compliance role', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance', VERIFIED_RESULT));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
      expect(screen.getByRole('heading', { level: 2 })).toBeDefined();
    });

    it('renders verified status for compliance role (ok:true)', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance', VERIFIED_RESULT));
      await renderPage();
      expect(screen.getByText(/all entries verified/i)).toBeDefined();
    });

    it('renders entries count in verified state', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance', VERIFIED_RESULT));
      await renderPage();
      // 42 entries shown as "42"
      expect(screen.getByText('42')).toBeDefined();
    });

    it('renders verified state for empty log (entriesChecked: 0)', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance', EMPTY_VERIFIED_RESULT));
      await renderPage();
      expect(screen.getByText(/all entries verified/i)).toBeDefined();
      expect(screen.getByText('0')).toBeDefined();
    });
  });
});

// ── IntegrityPanel unit tests ──────────────────────────────────────────────

describe('IntegrityPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Verified state ──────────────────────────────────────────────────────

  describe('verified state (ok:true)', () => {
    it('renders "All entries verified" status pill', () => {
      render(<IntegrityPanel initialResult={VERIFIED_RESULT} />);
      expect(screen.getByText(/all entries verified/i)).toBeDefined();
    });

    it('does not render the broken-chain alert', () => {
      render(<IntegrityPanel initialResult={VERIFIED_RESULT} />);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows entries checked count', () => {
      render(<IntegrityPanel initialResult={VERIFIED_RESULT} />);
      expect(screen.getByText('42')).toBeDefined();
    });

    it('shows empty log message when entriesChecked is 0', () => {
      render(<IntegrityPanel initialResult={EMPTY_VERIFIED_RESULT} />);
      expect(screen.getByText(/no audit entries/i)).toBeDefined();
    });
  });

  // ── Broken state ────────────────────────────────────────────────────────

  describe('broken state (ok:false) — persistent non-dismissible', () => {
    it('renders role="alert" (persistent, not a toast)', () => {
      render(<IntegrityPanel initialResult={BROKEN_RESULT} />);
      const alert = screen.getByRole('alert');
      expect(alert).toBeDefined();
    });

    it('shows "Hash-chain integrity failure detected" heading', () => {
      render(<IntegrityPanel initialResult={BROKEN_RESULT} />);
      expect(screen.getByText(/hash-chain integrity failure detected/i)).toBeDefined();
    });

    it('displays the firstBreakAt sequence number', () => {
      render(<IntegrityPanel initialResult={BROKEN_RESULT} />);
      const breakAt = screen.getByTestId('first-break-at');
      expect(breakAt.textContent).toContain('8');
    });

    it('displays the reason code', () => {
      render(<IntegrityPanel initialResult={BROKEN_RESULT} />);
      const reasonEl = screen.getByTestId('break-reason');
      expect(reasonEl.textContent).toBe('content-hash-mismatch');
    });

    it('shows human-readable reason for content-hash-mismatch', () => {
      render(<IntegrityPanel initialResult={BROKEN_RESULT} />);
      expect(screen.getByText(/content hash mismatch/i)).toBeDefined();
    });

    it('shows human-readable reason for prev-hash-mismatch', () => {
      render(<IntegrityPanel initialResult={BROKEN_PREV_HASH} />);
      expect(screen.getByText(/chain link broken/i)).toBeDefined();
    });

    it('shows human-readable reason for sequence-gap', () => {
      render(<IntegrityPanel initialResult={BROKEN_GAP} />);
      expect(screen.getByText(/sequence gap detected/i)).toBeDefined();
    });

    it('shows advisory note that panel cannot be dismissed', () => {
      render(<IntegrityPanel initialResult={BROKEN_RESULT} />);
      expect(screen.getByText(/cannot be dismissed/i)).toBeDefined();
    });

    it('does NOT render "All entries verified" in broken state', () => {
      render(<IntegrityPanel initialResult={BROKEN_RESULT} />);
      expect(screen.queryByText(/all entries verified/i)).toBeNull();
    });

    it('has aria-live="assertive" on the alert (persistent compliance signal)', () => {
      render(<IntegrityPanel initialResult={BROKEN_RESULT} />);
      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('aria-live')).toBe('assertive');
    });
  });

  // ── Unavailable state ───────────────────────────────────────────────────

  describe('unavailable state (null result)', () => {
    it('renders degraded status when initial result is null', () => {
      render(<IntegrityPanel initialResult={null} />);
      expect(screen.getByRole('status', { name: /unavailable/i })).toBeDefined();
    });

    it('does not render the broken-chain alert when result is null', () => {
      render(<IntegrityPanel initialResult={null} />);
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  // ── Verify now action ───────────────────────────────────────────────────

  describe('"Verify now" action', () => {
    it('renders the verify-now button', () => {
      render(<IntegrityPanel initialResult={VERIFIED_RESULT} />);
      expect(screen.getByRole('button', { name: /verify.*now/i })).toBeDefined();
    });

    it('button is keyboard-focusable (not disabled by default)', () => {
      render(<IntegrityPanel initialResult={VERIFIED_RESULT} />);
      const btn = screen.getByRole('button', { name: /verify.*now/i });
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    it('transitions to broken state after verify-now returns ok:false', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(BROKEN_RESULT),
        } as Response)
      );

      render(<IntegrityPanel initialResult={VERIFIED_RESULT} />);
      expect(screen.queryByRole('alert')).toBeNull();

      const btn = screen.getByRole('button', { name: /verify.*now/i });
      await user.click(btn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });
      expect(screen.getByText(/hash-chain integrity failure detected/i)).toBeDefined();
    });

    it('transitions to verified state after verify-now returns ok:true', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(VERIFIED_RESULT),
        } as Response)
      );

      render(<IntegrityPanel initialResult={BROKEN_RESULT} />);
      // Starts in broken state
      expect(screen.getByRole('alert')).toBeDefined();

      const btn = screen.getByRole('button', { name: /verify.*now/i });
      await user.click(btn);

      await waitFor(() => {
        expect(screen.queryByRole('alert')).toBeNull();
      });
      expect(screen.getByText(/all entries verified/i)).toBeDefined();
    });

    it('shows unavailable state when verify-now fetch fails', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        } as Response)
      );

      render(<IntegrityPanel initialResult={VERIFIED_RESULT} />);
      const btn = screen.getByRole('button', { name: /verify.*now/i });
      await user.click(btn);

      await waitFor(() => {
        expect(screen.getByRole('status', { name: /unavailable/i })).toBeDefined();
      });
    });
  });
});
