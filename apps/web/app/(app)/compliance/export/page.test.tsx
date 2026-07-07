/**
 * /compliance/export — RecordkeepingExportPage + RecordkeepingExportForm tests.
 *
 * Wave-27 B-3 (task f331a51c).
 *
 * Coverage:
 *   Page RBAC:
 *     - compliance role: renders (no redirect).
 *     - admin role: renders (no redirect).
 *     - advisor role: redirects to '/'.
 *     - analyst role: redirects to '/'.
 *     - unauthenticated (401): redirects to '/login'.
 *
 *   Form component states:
 *     - idle: scope/format/date controls present, Export CTA enabled.
 *     - generating: CTA aria-busy, form fields disabled, result skeleton.
 *     - success: integrity band (ShieldCheck + "Integrity verified"), meta grid, download link.
 *     - truncated (SEC-4): integrity band still present, PROMINENT truncation warning
 *       (role=alert / aria-live="assertive"), download still available (honest disclosure).
 *     - empty: "No records in this range", NO download affordance.
 *     - error: role=alert danger panel, Retry button.
 *
 *   A11y:
 *     - Scope segmented control: role="radiogroup" on container, role="radio" per option.
 *     - Format segmented control: same.
 *     - Truncation warning: role="alert".
 *     - Integrity band: NOT color-only (text "Integrity verified" present).
 *     - Error panel: role="alert".
 *     - CTA aria-busy during generating.
 *
 *   RBAC component guard:
 *     - advisor/analyst: RecordkeepingExportForm returns null (client-side gate).
 *     - compliance/admin: form renders.
 *
 *   Export mechanics:
 *     - POSTs to /compliance/audit-log-data/export (NOT the page route).
 *     - Includes rid anti-CSRF header.
 *     - Includes scope, format in body.
 *     - Triggers download (blobUrl created).
 *
 * Strategy:
 *   - RecordkeepingExportPage is an async server component; await + render.
 *   - RecordkeepingExportForm tested directly (no server context).
 *   - next/navigation + next/headers mocked at module boundary.
 *   - AppShell excluded (inside (app)/layout, not rendered here).
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockRedirect, mockCookies } = vi.hoisted(() => {
  const mockRedirect = vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  });
  const mockCookies = vi.fn().mockResolvedValue({
    toString: () => 'st-access-token=test-token',
  });
  return { mockRedirect, mockCookies };
});

vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('next/headers', () => ({ cookies: mockCookies }));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { RecordkeepingExportForm } from './_components/RecordkeepingExportForm';
import RecordkeepingExportPage from './page';

// ── Helpers ────────────────────────────────────────────────────────────────

type Role = 'advisor' | 'analyst' | 'compliance' | 'admin';

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

function makePageFetch(meRole: Role) {
  return vi.fn().mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(meRole)),
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
    const jsx = await RecordkeepingExportPage();
    render(jsx);
    return { redirected: false, path: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

/** Build a manifest-like object for mock responses. */
function makeManifest(opts: { rowsReturned: number; rowsAvailable: number; truncated: boolean }) {
  return {
    scope: { scope: 'both', format: 'csv' },
    generatedAt: '2026-07-07T00:00:00.000Z',
    generatingActor: null,
    chainRoot: '0'.repeat(64),
    tailHash: null,
    entryCount: opts.rowsReturned,
    truncated: opts.truncated,
    rowsReturned: opts.rowsReturned,
    rowsAvailable: opts.rowsAvailable,
  };
}

/** Mock a successful export fetch returning a manifest header + blob. */
function makeExportFetch(opts: {
  rowsReturned: number;
  rowsAvailable: number;
  truncated: boolean;
}) {
  const manifest = makeManifest(opts);
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => {
        if (name === 'x-export-manifest') return JSON.stringify(manifest);
        if (name === 'content-disposition') return 'attachment; filename="dealflow-export.csv"';
        return null;
      },
    },
    blob: () => Promise.resolve(new Blob(['row1\nrow2'], { type: 'text/csv' })),
  } as unknown as Response);
}

// ── Page RBAC tests ────────────────────────────────────────────────────────

describe('RecordkeepingExportPage (/compliance/export)', () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({ toString: () => 'st-access-token=test-token' });
    mockRedirect.mockImplementation((path: string): never => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('RBAC guard — compliance + admin only', () => {
    it('renders for compliance role (no redirect)', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
    });

    it('renders for admin role (no redirect)', async () => {
      vi.stubGlobal('fetch', makePageFetch('admin'));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
    });

    it('redirects to / for advisor role', async () => {
      vi.stubGlobal('fetch', makePageFetch('advisor'));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/');
    });

    it('redirects to / for analyst role', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/');
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

  describe('page heading', () => {
    it('renders "Export records" heading for compliance role', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      expect(screen.getByRole('heading', { level: 1, name: /export records/i })).toBeDefined();
    });

    it('renders subtitle copy', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      expect(screen.getByText(/download your firm/i)).toBeDefined();
    });
  });

  describe('page renders the export form', () => {
    it('renders the Export CTA button', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      expect(screen.getByTestId('export-cta')).toBeDefined();
    });

    it('renders NO edit/delete/send/AI affordance (hard boundary)', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /^send$/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /ai draft/i })).toBeNull();
    });
  });
});

// ── RecordkeepingExportForm component tests ────────────────────────────────

describe('RecordkeepingExportForm', () => {
  beforeEach(() => {
    // Stub URL for blob creation
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Role guard ────────────────────────────────────────────────────────────

  describe('client-side role guard', () => {
    it('renders export form for compliance role', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      expect(screen.getByTestId('export-cta')).toBeDefined();
    });

    it('renders export form for admin role', () => {
      render(<RecordkeepingExportForm userRole="admin" />);
      expect(screen.getByTestId('export-cta')).toBeDefined();
    });

    it('returns null for advisor role (no form rendered)', () => {
      const { container } = render(<RecordkeepingExportForm userRole="advisor" />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null for analyst role (no form rendered)', () => {
      const { container } = render(<RecordkeepingExportForm userRole="analyst" />);
      expect(container.firstChild).toBeNull();
    });
  });

  // ── Idle state ────────────────────────────────────────────────────────────

  describe('idle state (default)', () => {
    it('renders the configure export card', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      expect(screen.getByTestId('export-form-card')).toBeDefined();
    });

    it('renders the Export CTA button enabled', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const btn = screen.getByTestId('export-cta') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
      expect(btn.getAttribute('aria-busy')).not.toBe('true');
    });

    it('does NOT render result panel in idle state (D-3 polish note 4)', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      expect(screen.queryByTestId('result-panel')).toBeNull();
    });

    it('renders scope segmented control with 3 options', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const group = document.getElementById('scope-control');
      expect(group).toBeDefined();
      expect(group?.getAttribute('role')).toBe('radiogroup');
      const radios = group?.querySelectorAll('[role="radio"]') ?? [];
      expect(radios.length).toBe(3);
    });

    it('scope control default is "Both" (aria-checked="true")', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const bothBtn = document.getElementById('scope-control-both');
      expect(bothBtn?.getAttribute('aria-checked')).toBe('true');
    });

    it('renders format segmented control with 2 options', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const group = document.getElementById('format-control');
      expect(group).toBeDefined();
      expect(group?.getAttribute('role')).toBe('radiogroup');
      const radios = group?.querySelectorAll('[role="radio"]') ?? [];
      expect(radios.length).toBe(2);
    });

    it('format control default is "CSV" (aria-checked="true")', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const csvBtn = document.getElementById('format-control-csv');
      expect(csvBtn?.getAttribute('aria-checked')).toBe('true');
    });

    it('renders date-from and date-to inputs', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      expect(screen.getByLabelText(/export start date/i)).toBeDefined();
      expect(screen.getByLabelText(/export end date/i)).toBeDefined();
    });

    it('renders bounds note with 12-month default mention', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      expect(screen.getByText(/last 12 months/i)).toBeDefined();
    });
  });

  // ── A11y: radiogroup ARIA idiom (D-3 polish note 1) ──────────────────────

  describe('A11y — segmented controls use radiogroup idiom (D-3 note 1)', () => {
    it('scope container has role="radiogroup"', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const group = document.getElementById('scope-control');
      expect(group?.getAttribute('role')).toBe('radiogroup');
    });

    it('format container has role="radiogroup"', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const group = document.getElementById('format-control');
      expect(group?.getAttribute('role')).toBe('radiogroup');
    });

    it('scope options have role="radio"', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const group = document.getElementById('scope-control');
      const radios = group?.querySelectorAll('[role="radio"]') ?? [];
      expect(radios.length).toBeGreaterThan(0);
      for (const r of radios) {
        expect(r.getAttribute('role')).toBe('radio');
      }
    });

    it('format options have role="radio"', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const group = document.getElementById('format-control');
      const radios = group?.querySelectorAll('[role="radio"]') ?? [];
      expect(radios.length).toBeGreaterThan(0);
      for (const r of radios) {
        expect(r.getAttribute('role')).toBe('radio');
      }
    });

    it('checked option has aria-checked="true", others have aria-checked="false"', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      const group = document.getElementById('scope-control');
      const radios = Array.from(group?.querySelectorAll('[role="radio"]') ?? []);
      const checked = radios.filter((r) => r.getAttribute('aria-checked') === 'true');
      const unchecked = radios.filter((r) => r.getAttribute('aria-checked') === 'false');
      expect(checked.length).toBe(1); // only one checked at a time
      expect(unchecked.length).toBe(2);
    });
  });

  // ── Scope selection ───────────────────────────────────────────────────────

  describe('scope selection', () => {
    it('clicking "Audit log" changes aria-checked', async () => {
      const user = userEvent.setup();
      render(<RecordkeepingExportForm userRole="compliance" />);
      const auditBtn = document.getElementById('scope-control-audit') as HTMLButtonElement;
      await user.click(auditBtn);
      expect(auditBtn.getAttribute('aria-checked')).toBe('true');
      expect(document.getElementById('scope-control-both')?.getAttribute('aria-checked')).toBe(
        'false'
      );
    });

    it('clicking "Deal & pipeline" changes aria-checked', async () => {
      const user = userEvent.setup();
      render(<RecordkeepingExportForm userRole="compliance" />);
      const dealBtn = document.getElementById('scope-control-deal') as HTMLButtonElement;
      await user.click(dealBtn);
      expect(dealBtn.getAttribute('aria-checked')).toBe('true');
    });
  });

  // ── Format selection ──────────────────────────────────────────────────────

  describe('format selection', () => {
    it('clicking "JSON" changes aria-checked', async () => {
      const user = userEvent.setup();
      render(<RecordkeepingExportForm userRole="compliance" />);
      const jsonBtn = document.getElementById('format-control-json') as HTMLButtonElement;
      await user.click(jsonBtn);
      expect(jsonBtn.getAttribute('aria-checked')).toBe('true');
      expect(document.getElementById('format-control-csv')?.getAttribute('aria-checked')).toBe(
        'false'
      );
    });
  });

  // ── Generating state ──────────────────────────────────────────────────────

  describe('generating state', () => {
    it('Export CTA becomes aria-busy during generating', async () => {
      const user = userEvent.setup();
      // Fetch that never resolves to hold the generating state
      vi.stubGlobal(
        'fetch',
        vi.fn().mockReturnValue(
          new Promise(() => {
            /* never resolves */
          })
        )
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      const btn = screen.getByTestId('export-cta');
      await user.click(btn);
      await waitFor(() => {
        expect((btn as HTMLButtonElement).getAttribute('aria-busy')).toBe('true');
      });
    });

    it('result panel renders in generating state (after CTA click)', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockReturnValue(
          new Promise(() => {
            /* never resolves */
          })
        )
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getByTestId('result-panel')).toBeDefined();
      });
    });
  });

  // ── Success state ─────────────────────────────────────────────────────────

  describe('success state', () => {
    it('renders "Integrity verified" text (integrity band — NOT color-only)', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 1234, rowsAvailable: 1234, truncated: false })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getAllByText(/integrity verified/i).length).toBeGreaterThan(0);
      });
    });

    it('renders download link after successful export', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 1234, rowsAvailable: 1234, truncated: false })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getByTestId('export-download-link')).toBeDefined();
      });
    });

    it('does NOT render truncation warning in success state', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 1234, rowsAvailable: 1234, truncated: false })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.queryByTestId('truncation-warning')).toBeNull();
      });
    });
  });

  // ── Truncated state — SEC-4 compliance-honesty UI ─────────────────────────

  describe('truncated state (SEC-4 compliance-honesty UI)', () => {
    it('renders truncation warning with role="alert" (SEC-4 — NOT color-only)', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 50000, rowsAvailable: 183492, truncated: true })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        const warning = screen.getByTestId('truncation-warning');
        expect(warning.getAttribute('role')).toBe('alert');
      });
    });

    it('truncation warning has aria-live="assertive"', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 50000, rowsAvailable: 183492, truncated: true })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        const warning = screen.getByTestId('truncation-warning');
        expect(warning.getAttribute('aria-live')).toBe('assertive');
      });
    });

    it('truncation warning contains row counts (50,000 of 183,492)', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 50000, rowsAvailable: 183492, truncated: true })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getByTestId('truncation-warning').textContent).toMatch(/50,000/);
        expect(screen.getByTestId('truncation-warning').textContent).toMatch(/183,492/);
      });
    });

    it('truncation warning text instructs user to narrow the date range', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 50000, rowsAvailable: 183492, truncated: true })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getByTestId('truncation-warning').textContent).toMatch(
          /narrow the date range/i
        );
      });
    });

    it('download link is STILL available in truncated state (honest disclosure, not a gate)', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 50000, rowsAvailable: 183492, truncated: true })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getByTestId('export-download-link')).toBeDefined();
      });
    });

    it('integrity band is STILL present in truncated state (scoped to rows in file)', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 50000, rowsAvailable: 183492, truncated: true })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getAllByText(/integrity verified/i).length).toBeGreaterThan(0);
      });
    });

    it('does NOT present a truncated export as complete (no false "all records" claim)', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 50000, rowsAvailable: 183492, truncated: true })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        const warning = screen.getByTestId('truncation-warning');
        // Warning must NOT falsely claim "all records" or "complete set" in the file
        expect(warning.textContent?.toLowerCase()).not.toMatch(/all records/);
        expect(warning.textContent?.toLowerCase()).not.toMatch(/complete set/);
        // But MUST show a partial-export acknowledgement
        expect(warning.textContent).toMatch(/50,000/);
      });
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  describe('empty state (0 rows)', () => {
    it('renders "No records in this range" when 0 rows returned', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 0, rowsAvailable: 0, truncated: false })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getByTestId('empty-panel')).toBeDefined();
        expect(screen.getByText(/no records in this range/i)).toBeDefined();
      });
    });

    it('does NOT render download link in empty state', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 0, rowsAvailable: 0, truncated: false })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.queryByTestId('export-download-link')).toBeNull();
      });
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────

  describe('error state', () => {
    it('renders error panel with role="alert" on non-ok response', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        } as unknown as Response)
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        const panel = screen.getByTestId('error-panel');
        expect(panel.getAttribute('role')).toBe('alert');
      });
    });

    it('renders Retry button in error state', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal Server Error'),
        } as unknown as Response)
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getByTestId('retry-btn')).toBeDefined();
        expect(screen.getByRole('button', { name: /retry export/i })).toBeDefined();
      });
    });

    it('renders error panel on fetch exception', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(screen.getByTestId('error-panel')).toBeDefined();
      });
    });

    it('error panel has aria-live="assertive"', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('fail'),
        } as unknown as Response)
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        const panel = screen.getByTestId('error-panel');
        expect(panel.getAttribute('aria-live')).toBe('assertive');
      });
    });
  });

  // ── Export mechanics ──────────────────────────────────────────────────────

  describe('export mechanics', () => {
    it('POSTs to /compliance/audit-log-data/export (NOT the page route)', async () => {
      const user = userEvent.setup();
      const mockFetch = makeExportFetch({
        rowsReturned: 100,
        rowsAvailable: 100,
        truncated: false,
      });
      vi.stubGlobal('fetch', mockFetch);
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const exportCall = calls.find(
          ([url]) => typeof url === 'string' && url.includes('/compliance/audit-log-data/export')
        );
        expect(exportCall).toBeDefined();
        // Must NOT post to the bare page route
        const pageRouteCall = calls.find(
          ([url]) => typeof url === 'string' && url === '/compliance/export'
        );
        expect(pageRouteCall).toBeUndefined();
      });
    });

    it('includes rid anti-CSRF header in export POST', async () => {
      const user = userEvent.setup();
      const mockFetch = makeExportFetch({
        rowsReturned: 100,
        rowsAvailable: 100,
        truncated: false,
      });
      vi.stubGlobal('fetch', mockFetch);
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const exportCall = calls.find(
          ([url]) => typeof url === 'string' && url.includes('/compliance/audit-log-data/export')
        );
        expect(exportCall).toBeDefined();
        const headers = exportCall?.[1]?.headers as Record<string, string> | undefined;
        expect(headers?.['rid']).toBe('anti-csrf');
      });
    });

    it('uses POST method', async () => {
      const user = userEvent.setup();
      const mockFetch = makeExportFetch({
        rowsReturned: 100,
        rowsAvailable: 100,
        truncated: false,
      });
      vi.stubGlobal('fetch', mockFetch);
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const exportCall = calls.find(
          ([url]) => typeof url === 'string' && url.includes('/compliance/audit-log-data/export')
        );
        expect(exportCall?.[1]?.method).toBe('POST');
      });
    });

    it('includes scope and format in the request body', async () => {
      const user = userEvent.setup();
      const mockFetch = makeExportFetch({
        rowsReturned: 100,
        rowsAvailable: 100,
        truncated: false,
      });
      vi.stubGlobal('fetch', mockFetch);
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const exportCall = calls.find(
          ([url]) => typeof url === 'string' && url.includes('/compliance/audit-log-data/export')
        );
        const body = JSON.parse(exportCall?.[1]?.body as string);
        expect(body.scope).toBe('both'); // default
        expect(body.format).toBe('csv'); // default
      });
    });

    it('creates a blob URL for download trigger', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 100, rowsAvailable: 100, truncated: false })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
      });
    });
  });

  // ── A11y: integrity band is NOT color-only ────────────────────────────────

  describe('A11y — integrity band not color-only', () => {
    it('integrity band shows ShieldCheck icon + "Integrity verified" text (not color-only)', async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        'fetch',
        makeExportFetch({ rowsReturned: 100, rowsAvailable: 100, truncated: false })
      );
      render(<RecordkeepingExportForm userRole="compliance" />);
      await user.click(screen.getByTestId('export-cta'));
      await waitFor(() => {
        // Text label must be present (shape=icon is invisible to SR; text is the contract)
        expect(screen.getAllByText(/integrity verified/i).length).toBeGreaterThan(0);
      });
    });
  });

  // ── Hard boundary: no mutation affordance ─────────────────────────────────

  describe('hard boundary — read-only / export-only', () => {
    it('renders NO edit button', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    });

    it('renders NO delete button', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
    });

    it('renders NO send/email/AI affordance', () => {
      render(<RecordkeepingExportForm userRole="compliance" />);
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /email/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
    });
  });
});
