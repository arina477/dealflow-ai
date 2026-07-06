/**
 * /compliance/audit-log — AuditLogPage + component tests (wave-4 + wave-13).
 *
 * Wave-4 coverage (unchanged):
 *   - Page renders integrity view for compliance role (verified state).
 *   - Non-compliance roles (advisor, analyst, admin) redirect / render per RBAC.
 *   - Unauthenticated (no session) redirects to '/login'.
 *   - Verified state: renders "All entries verified" status.
 *   - Broken state: renders PERSISTENT non-dismissible panel with firstBreakAt
 *     and reason (NOT a toast that disappears).
 *   - Verify-now action: IntegrityPanel re-calls verify endpoint and updates state.
 *   - Empty log (entriesChecked: 0, ok: true): renders verified state with 0.
 *
 * Wave-13 new coverage:
 *   - AuditLogTable: filter bar binds to /compliance/audit-log-data proxy.
 *   - IntegrityBadge: renders REAL {ok, entriesChecked, firstBreakAt, reason} shape.
 *   - ExportPanel: present for compliance/admin, ABSENT for advisor.
 *   - Export CTA: POSTs to /compliance/audit-log-data/export (not the page route)
 *     + includes rid anti-CSRF header.
 *   - Read-only boundary: NO edit/delete button, NO send/compose/AI affordance.
 *
 * Strategy:
 *   - AuditLogPage is an async server component; we await + render.
 *   - Client components tested directly (no server context).
 *   - next/navigation and next/headers are mocked at the module boundary.
 *   - AppShell excluded (inside (app)/layout, not rendered here).
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

import { AuditLogTable } from './_components/AuditLogTable';
import { ExportPanel } from './_components/ExportPanel';
import { IntegrityBadge } from './_components/IntegrityBadge';
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

// ── Shared fixtures ────────────────────────────────────────────────────────

/** Minimal AuditLogEntryRead fixture for table tests. */
const ENTRY_1 = {
  sequenceNumber: 1,
  actorUserId: 'aaa00000-0000-0000-0000-000000000001',
  actorRole: 'advisor',
  action: 'outreach-compose',
  resourceType: 'outreach',
  resourceId: 'bbb00000-0000-0000-0000-000000000002',
  contentHash: 'c'.repeat(64),
  payloadHash: 'd'.repeat(64),
  prevHash: '0'.repeat(64),
  entryHash: 'e'.repeat(64),
  chainVersion: 1,
  createdAt: '2026-07-01T10:00:00.000Z',
};

const ENTRY_2 = {
  ...ENTRY_1,
  sequenceNumber: 2,
  action: 'gate-evaluate',
  actorRole: 'compliance',
  createdAt: '2026-07-01T11:00:00.000Z',
};

const ENTRIES_PAGE = [ENTRY_1, ENTRY_2];

/**
 * Build a fetch mock that returns me-response on /auth/me, verifyResult
 * on /compliance/audit-log/verify, and initial entries on /compliance/audit-log.
 * Wave-13: the page now issues THREE server-side fetches.
 */
function makePageFetch(
  meRole: Role,
  verifyResult: AuditVerifyResponse | null,
  entries: typeof ENTRIES_PAGE = ENTRIES_PAGE
) {
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
    // GET /compliance/audit-log?limit=50&offset=0 — initial entries SSR fetch
    if (
      typeof url === 'string' &&
      url.includes('/compliance/audit-log') &&
      !url.includes('verify')
    ) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(entries),
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
    const jsx = await AuditLogPage({});
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
      // Wave-13: both IntegrityBadge and IntegrityPanel render "All entries verified"
      expect(screen.getAllByText(/all entries verified/i).length).toBeGreaterThan(0);
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
      // Wave-13: both IntegrityBadge and IntegrityPanel render "All entries verified"
      expect(screen.getAllByText(/all entries verified/i).length).toBeGreaterThan(0);
      expect(screen.getByText('0')).toBeDefined();
    });
  });
});

// ── Wave-13: AuditLogTable unit tests ─────────────────────────────────────

describe('AuditLogTable', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders SSR-hydrated entries without a client fetch', () => {
    render(<AuditLogTable initialEntries={ENTRIES_PAGE} />);
    // Rows are rendered from initialEntries (no fetch on mount)
    expect(screen.getByText('outreach-compose')).toBeDefined();
    expect(screen.getByText('gate-evaluate')).toBeDefined();
  });

  it('renders filter bar with event type, from, to, actor, mandate inputs', () => {
    render(<AuditLogTable initialEntries={[]} />);
    expect(screen.getByLabelText(/event type/i)).toBeDefined();
    expect(screen.getByLabelText(/^from$/i)).toBeDefined();
    expect(screen.getByLabelText(/^to$/i)).toBeDefined();
    expect(screen.getByLabelText(/actor/i)).toBeDefined();
    expect(screen.getByLabelText(/mandate/i)).toBeDefined();
  });

  it('renders Apply and Reset filter buttons', () => {
    render(<AuditLogTable initialEntries={[]} />);
    expect(screen.getByRole('button', { name: /apply filters/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /reset all filters/i })).toBeDefined();
  });

  it('Apply button is keyboard-focusable', () => {
    render(<AuditLogTable initialEntries={[]} />);
    const btn = screen.getByRole('button', { name: /apply filters/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('fetches from /compliance/audit-log-data proxy on Apply', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([ENTRY_1]),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<AuditLogTable initialEntries={ENTRIES_PAGE} />);
    const applyBtn = screen.getByRole('button', { name: /apply filters/i });
    await user.click(applyBtn);

    await waitFor(() => {
      const calls = mockFetch.mock.calls as Array<[string, ...unknown[]]>;
      const fetchUrl = calls.find(
        ([url]) => typeof url === 'string' && url.includes('/compliance/audit-log-data')
      );
      expect(fetchUrl).toBeDefined();
    });
  });

  it('filter Apply uses /compliance/audit-log-data (NOT the page route /compliance/audit-log)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<AuditLogTable initialEntries={[]} />);
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => {
      const calls = mockFetch.mock.calls as Array<[string, ...unknown[]]>;
      const pageRouteCall = calls.find(
        ([url]) => typeof url === 'string' && url === '/compliance/audit-log'
      );
      // No fetch to the bare page route
      expect(pageRouteCall).toBeUndefined();
      // Fetch goes to the proxy path
      const proxyCall = calls.find(
        ([url]) => typeof url === 'string' && url.startsWith('/compliance/audit-log-data')
      );
      expect(proxyCall).toBeDefined();
    });
  });

  it('includes rid anti-CSRF header in filter fetch', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<AuditLogTable initialEntries={[]} />);
    await user.click(screen.getByRole('button', { name: /apply filters/i }));

    await waitFor(() => {
      const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
      const proxyCall = calls.find(
        ([url]) => typeof url === 'string' && url.startsWith('/compliance/audit-log-data')
      );
      expect(proxyCall).toBeDefined();
      const init = proxyCall?.[1];
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.['rid']).toBe('anti-csrf');
    });
  });

  it('renders Prev/Next pagination buttons', () => {
    render(<AuditLogTable initialEntries={ENTRIES_PAGE} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDefined();
  });

  it('Prev button is disabled on first page (offset=0)', () => {
    render(<AuditLogTable initialEntries={ENTRIES_PAGE} />);
    const prev = screen.getByRole('button', { name: /previous page/i });
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders NO edit or delete button (read-only boundary)', () => {
    render(<AuditLogTable initialEntries={ENTRIES_PAGE} />);
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('renders NO send/compose/email/AI affordance (hard boundary)', () => {
    render(<AuditLogTable initialEntries={ENTRIES_PAGE} />);
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /compose/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /email/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
  });

  it('renders empty state message when no entries match', () => {
    render(<AuditLogTable initialEntries={[]} />);
    expect(screen.getByText(/no audit entries match/i)).toBeDefined();
  });
});

// ── Wave-13: IntegrityBadge unit tests ────────────────────────────────────

describe('IntegrityBadge', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('verified state (ok:true)', () => {
    it('renders "All entries verified" text', () => {
      render(<IntegrityBadge result={VERIFIED_RESULT} />);
      expect(screen.getByText(/all entries verified/i)).toBeDefined();
    });

    it('shows the entriesChecked count', () => {
      render(<IntegrityBadge result={VERIFIED_RESULT} />);
      expect(screen.getByTestId('badge-entries-count').textContent).toContain('42');
    });

    it('has role="status" (not role="alert") for verified state', () => {
      render(<IntegrityBadge result={VERIFIED_RESULT} />);
      const badge = screen.getByTestId('integrity-badge');
      expect(badge.getAttribute('role')).toBe('status');
    });

    it('shows 0 in count for empty log (entriesChecked: 0)', () => {
      render(<IntegrityBadge result={EMPTY_VERIFIED_RESULT} />);
      expect(screen.getByTestId('badge-entries-count').textContent).toContain('0');
    });
  });

  describe('broken state (ok:false) — REAL shape with firstBreakAt and reason', () => {
    it('renders role="alert" for broken state', () => {
      render(<IntegrityBadge result={BROKEN_RESULT} />);
      const badge = screen.getByTestId('integrity-badge');
      expect(badge.getAttribute('role')).toBe('alert');
    });

    it('shows the firstBreakAt sequence number', () => {
      render(<IntegrityBadge result={BROKEN_RESULT} />);
      expect(screen.getByTestId('badge-break-at').textContent).toContain('8');
    });

    it('shows the reason code', () => {
      render(<IntegrityBadge result={BROKEN_RESULT} />);
      expect(screen.getByTestId('badge-break-reason').textContent).toBe('content-hash-mismatch');
    });

    it('shows prev-hash-mismatch reason', () => {
      render(<IntegrityBadge result={BROKEN_PREV_HASH} />);
      expect(screen.getByTestId('badge-break-reason').textContent).toBe('prev-hash-mismatch');
    });

    it('shows sequence-gap reason', () => {
      render(<IntegrityBadge result={BROKEN_GAP} />);
      expect(screen.getByTestId('badge-break-reason').textContent).toBe('sequence-gap');
    });

    it('does NOT say "All entries verified" in broken state', () => {
      render(<IntegrityBadge result={BROKEN_RESULT} />);
      expect(screen.queryByText(/all entries verified/i)).toBeNull();
    });
  });

  describe('unavailable state (null)', () => {
    it('renders role="status" with unavailable label', () => {
      render(<IntegrityBadge result={null} />);
      const badge = screen.getByTestId('integrity-badge');
      expect(badge.getAttribute('role')).toBe('status');
      expect(badge.getAttribute('aria-label')).toMatch(/unavailable/i);
    });
  });
});

// ── Wave-13: ExportPanel unit tests ───────────────────────────────────────

describe('ExportPanel', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('role visibility', () => {
    it('renders export panel for compliance role', () => {
      render(<ExportPanel userRole="compliance" />);
      expect(screen.getByTestId('export-panel')).toBeDefined();
    });

    it('renders export panel for admin role', () => {
      render(<ExportPanel userRole="admin" />);
      expect(screen.getByTestId('export-panel')).toBeDefined();
    });

    it('does NOT render export panel for advisor role', () => {
      render(<ExportPanel userRole="advisor" />);
      expect(screen.queryByTestId('export-panel')).toBeNull();
    });

    it('does NOT render export panel for analyst role', () => {
      render(<ExportPanel userRole="analyst" />);
      expect(screen.queryByTestId('export-panel')).toBeNull();
    });
  });

  describe('export panel structure (compliance role)', () => {
    it('renders the "Export recordkeeping package" CTA button', () => {
      render(<ExportPanel userRole="compliance" />);
      expect(screen.getByTestId('export-cta')).toBeDefined();
      expect(screen.getByRole('button', { name: /export recordkeeping package/i })).toBeDefined();
    });

    it('renders mandate and date range scope inputs', () => {
      render(<ExportPanel userRole="compliance" />);
      expect(screen.getByLabelText(/mandate/i)).toBeDefined();
      expect(screen.getByLabelText(/^from$/i)).toBeDefined();
      expect(screen.getByLabelText(/^to$/i)).toBeDefined();
    });

    it('CTA is keyboard-focusable (not disabled initially)', () => {
      render(<ExportPanel userRole="compliance" />);
      const btn = screen.getByTestId('export-cta');
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    it('renders NO edit/delete affordance', () => {
      render(<ExportPanel userRole="compliance" />);
      expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    });

    it('renders NO send/email/AI affordance', () => {
      render(<ExportPanel userRole="compliance" />);
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /email/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
    });
  });

  describe('export CTA — POST to /compliance/audit-log-data/export', () => {
    it('POSTs to /compliance/audit-log-data/export (NOT the page route)', async () => {
      const user = userEvent.setup();

      // Mock URL.createObjectURL + document.createElement to avoid JSDOM errors
      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:mock'),
        revokeObjectURL: vi.fn(),
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => 'attachment; filename="audit-log-export.json"' },
        blob: () => Promise.resolve(new Blob(['{}'], { type: 'application/json' })),
      } as unknown as Response);
      vi.stubGlobal('fetch', mockFetch);

      render(<ExportPanel userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));

      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const exportCall = calls.find(
          ([url]) => typeof url === 'string' && url.includes('/compliance/audit-log-data/export')
        );
        expect(exportCall).toBeDefined();
        // Must NOT post to the page route
        const pageRouteCall = calls.find(
          ([url]) => typeof url === 'string' && url === '/compliance/audit-log/export'
        );
        expect(pageRouteCall).toBeUndefined();
      });
    });

    it('includes rid anti-CSRF header in export POST', async () => {
      const user = userEvent.setup();

      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:mock'),
        revokeObjectURL: vi.fn(),
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        blob: () => Promise.resolve(new Blob(['{}'], { type: 'application/json' })),
      } as unknown as Response);
      vi.stubGlobal('fetch', mockFetch);

      render(<ExportPanel userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));

      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const exportCall = calls.find(
          ([url]) => typeof url === 'string' && url.includes('/compliance/audit-log-data/export')
        );
        expect(exportCall).toBeDefined();
        const init = exportCall?.[1];
        const headers = init?.headers as Record<string, string> | undefined;
        expect(headers?.['rid']).toBe('anti-csrf');
      });
    });

    it('uses POST method for export', async () => {
      const user = userEvent.setup();

      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:mock'),
        revokeObjectURL: vi.fn(),
      });

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        blob: () => Promise.resolve(new Blob(['{}'], { type: 'application/json' })),
      } as unknown as Response);
      vi.stubGlobal('fetch', mockFetch);

      render(<ExportPanel userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));

      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const exportCall = calls.find(
          ([url]) => typeof url === 'string' && url.includes('/compliance/audit-log-data/export')
        );
        expect(exportCall?.[1]?.method).toBe('POST');
      });
    });

    it('shows success state after successful export', async () => {
      const user = userEvent.setup();

      vi.stubGlobal('URL', {
        ...URL,
        createObjectURL: vi.fn(() => 'blob:mock'),
        revokeObjectURL: vi.fn(),
      });

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: { get: () => null },
          blob: () => Promise.resolve(new Blob(['{}'], { type: 'application/json' })),
        } as unknown as Response)
      );

      render(<ExportPanel userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));

      await waitFor(() => {
        expect(screen.getByTestId('export-success')).toBeDefined();
      });
    });

    it('shows error state when export returns non-ok status', async () => {
      const user = userEvent.setup();

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 403,
          text: () => Promise.resolve('Forbidden'),
        } as unknown as Response)
      );

      render(<ExportPanel userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));

      await waitFor(() => {
        expect(screen.getByTestId('export-error')).toBeDefined();
      });
    });
  });
});

// ── Wave-13: Page-level integration (export panel visibility per role) ─────

describe('AuditLogPage — wave-13 integration (export panel + badge)', () => {
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

  it('renders export panel for compliance role', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', VERIFIED_RESULT));
    await renderPage();
    expect(screen.getByTestId('export-panel')).toBeDefined();
  });

  it('renders export panel for admin role', async () => {
    vi.stubGlobal('fetch', makePageFetch('admin', VERIFIED_RESULT));
    await renderPage();
    expect(screen.getByTestId('export-panel')).toBeDefined();
  });

  it('does NOT render export panel for advisor role', async () => {
    vi.stubGlobal('fetch', makePageFetch('advisor', VERIFIED_RESULT));
    await renderPage();
    expect(screen.queryByTestId('export-panel')).toBeNull();
  });

  it('renders integrity badge in the page heading area', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', VERIFIED_RESULT));
    await renderPage();
    expect(screen.getByTestId('integrity-badge')).toBeDefined();
  });

  it('integrity badge shows "All entries verified" (ok:true) — REAL verify shape', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', VERIFIED_RESULT));
    await renderPage();
    expect(screen.getAllByText(/all entries verified/i).length).toBeGreaterThan(0);
  });

  it('integrity badge shows break info (ok:false) — NOT a false "all verified"', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', BROKEN_RESULT));
    await renderPage();
    // Badge should NOT say "all entries verified"
    const badge = screen.getByTestId('integrity-badge');
    expect(badge.textContent).not.toMatch(/all entries verified/i);
    // Badge should show break info
    expect(badge.textContent).toMatch(/#8/);
  });

  it('renders the audit log table', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', VERIFIED_RESULT));
    await renderPage();
    expect(screen.getByRole('table', { name: /audit log entries/i })).toBeDefined();
  });

  it('renders NO edit/delete/send/AI affordance on the page (read-only boundary)', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', VERIFIED_RESULT));
    await renderPage();
    // No edit/delete buttons anywhere on the page
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^send$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /compose email/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ai draft/i })).toBeNull();
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
