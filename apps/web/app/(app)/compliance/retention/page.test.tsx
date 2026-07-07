/**
 * /compliance/retention — RetentionPolicyPage + RetentionPolicyForm tests.
 *
 * Wave-28 B-3 (task ce75c6c6).
 *
 * Coverage:
 *   Page RBAC:
 *     - compliance role: renders (no redirect).
 *     - admin role: renders (no redirect).
 *     - advisor role: redirects to '/'.
 *     - analyst role: redirects to '/'.
 *     - unauthenticated (401): redirects to '/login'.
 *     - unauthenticated (403): redirects to '/login'.
 *
 *   Page heading:
 *     - renders "Records retention" H1.
 *     - renders subtitle copy.
 *
 *   Form — loading state:
 *     - loading skeleton renders while fetch resolves.
 *
 *   Form — idle state (after successful GET):
 *     - years input populated with value derived from retentionPeriodDays.
 *     - provenance line rendered.
 *     - Save button enabled.
 *     - audit-recorded trust note always present.
 *     - cutoff panel rendered with cutoff date.
 *     - Read-only badge present on cutoff panel.
 *
 *   RBAC component guard:
 *     - advisor/analyst: RetentionPolicyForm returns null (client-side gate).
 *     - compliance/admin: form renders.
 *
 *   States:
 *     - saving: Save button disabled + aria-busy during in-flight PUT.
 *     - saved: Saved pill visible; Save button reverts.
 *     - error: role=alert danger panel + Retry button.
 *     - invalid: aria-invalid on input; Save disabled; years-error rendered;
 *                cutoff panel shows placeholder copy.
 *
 *   Years ↔ days conversion:
 *     - 2555 days → 7 years displayed.
 *     - 3650 days → 10 years displayed.
 *     - 365 days → 1 year displayed.
 *     - 10950 days → 30 years displayed.
 *     - save sends retentionPeriodDays = years * 365.
 *
 *   Stepper:
 *     - increment button increases value by 1 year.
 *     - decrement button decreases value by 1 year.
 *
 *   PUT payload:
 *     - sends { retentionPeriodDays } only — NO workspace_id (SEC-2).
 *     - sends anti-CSRF rid header.
 *     - uses PUT method.
 *
 *   [WORM — LOAD-BEARING] NO purge/delete control:
 *     - asserts NO button matching /purge|delete|clean/i renders.
 *
 *   Audit note (LOAD-BEARING):
 *     - "This change is recorded in your audit log." always present.
 *     - ShieldCheck trust note rendered in every non-loading state.
 *
 *   Cutoff panel:
 *     - role="note" (read-only informational).
 *     - "Read-only" badge present.
 *     - no interactive affordances (no button, no link inside the panel).
 *     - "Records are preserved. Deletion is not performed automatically" note.
 *     - invalid state: shows placeholder copy.
 *
 *   Accessibility:
 *     - <label> associated with input via htmlFor/id.
 *     - aria-describedby on input points to years-error + years-hint.
 *     - aria-invalid toggled in sync with validation state.
 *     - aria-live="assertive" + role="alert" on validation error.
 *     - aria-live="polite" + role="status" on saved pill.
 *     - aria-live="assertive" + role="alert" on server error panel.
 *     - aria-busy on Save button during saving.
 *     - role="note" on cutoff panel and audit note.
 *
 * Strategy:
 *   - RetentionPolicyPage is an async server component; await + render.
 *   - RetentionPolicyForm tested directly (no server context needed).
 *   - next/navigation + next/headers mocked at module boundary.
 *   - AppShell excluded (inside (app)/layout, not rendered here).
 */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

import { RetentionPolicyForm } from './_components/RetentionPolicyForm';
import RetentionPolicyPage from './page';

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

/** Successful GET /compliance/retention-data response. */
function makePolicyFetch(opts: {
  retentionPeriodDays: number;
  cutoffDate?: string;
  updatedBy?: string | null;
  updatedAt?: string | null;
}) {
  const policy = {
    retentionPeriodDays: opts.retentionPeriodDays,
    cutoffDate: opts.cutoffDate ?? '2019-07-07T00:00:00.000Z',
    // Must be a valid UUID to pass retentionPolicySchema (z.string().uuid().nullable())
    updatedBy:
      opts.updatedBy !== undefined ? opts.updatedBy : '00000000-0000-4000-a000-000000000123',
    updatedAt: opts.updatedAt ?? '2026-04-14T00:00:00.000Z',
  };
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(policy),
  } as unknown as Response);
}

/** Successful GET then successful PUT response. */
function makePolicyFetchThenPut(opts: { retentionPeriodDays: number; putDays: number }) {
  let callCount = 0;
  return vi.fn().mockImplementation((_url: string, _init?: RequestInit) => {
    callCount++;
    if (callCount === 1) {
      // First call = GET
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            retentionPeriodDays: opts.retentionPeriodDays,
            cutoffDate: '2019-07-07T00:00:00.000Z',
            updatedBy: '00000000-0000-4000-a000-000000000123',
            updatedAt: '2026-04-14T00:00:00.000Z',
          }),
      } as unknown as Response);
    }
    // Second call = PUT — return updated policy
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          retentionPeriodDays: opts.putDays,
          cutoffDate: '2016-07-07T00:00:00.000Z',
          updatedBy: '00000000-0000-4000-a000-000000000456',
          updatedAt: '2026-07-07T00:00:00.000Z',
        }),
    } as unknown as Response);
  });
}

async function renderPage() {
  try {
    const jsx = await RetentionPolicyPage();
    render(jsx);
    return { redirected: false, path: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── Page RBAC tests ────────────────────────────────────────────────────────

describe('RetentionPolicyPage (/compliance/retention)', () => {
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
    it('renders "Records retention" H1', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      expect(screen.getByRole('heading', { level: 1, name: /records retention/i })).toBeDefined();
    });

    it('renders subtitle copy', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      expect(screen.getByText(/set how long your firm/i)).toBeDefined();
    });
  });

  describe('[WORM — LOAD-BEARING] NO purge/delete control on page', () => {
    it('renders NO button matching /purge|delete|clean/i on the page', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      const btns = screen.queryAllByRole('button');
      const dangerous = btns.filter((b) => /purge|delete|clean/i.test(b.textContent ?? ''));
      expect(dangerous).toHaveLength(0);
    });
  });
});

// ── RetentionPolicyForm component tests ───────────────────────────────────

describe('RetentionPolicyForm', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── RBAC component guard ──────────────────────────────────────────────────

  describe('client-side role guard', () => {
    it('renders form for compliance role', () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      // Loading state should be present (the GET is pending)
      expect(screen.getByTestId('loading-state')).toBeDefined();
    });

    it('renders form for admin role', () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="admin" />);
      expect(screen.getByTestId('loading-state')).toBeDefined();
    });

    it('returns null for advisor role (no form rendered)', () => {
      const { container } = render(<RetentionPolicyForm userRole="advisor" />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null for analyst role (no form rendered)', () => {
      const { container } = render(<RetentionPolicyForm userRole="analyst" />);
      expect(container.firstChild).toBeNull();
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  describe('loading state', () => {
    it('renders loading skeleton while GET is pending', () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockReturnValue(
          new Promise(() => {
            /* never resolves */
          })
        )
      );
      render(<RetentionPolicyForm userRole="compliance" />);
      expect(screen.getByTestId('loading-state')).toBeDefined();
    });

    it('loading state has aria-live="polite"', () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockReturnValue(
          new Promise(() => {
            /* never resolves */
          })
        )
      );
      render(<RetentionPolicyForm userRole="compliance" />);
      const region = screen.getByTestId('loading-state');
      expect(region.getAttribute('aria-live')).toBe('polite');
    });
  });

  // ── Idle state (after successful load) ───────────────────────────────────

  describe('idle state (after successful GET)', () => {
    it('populates input with correct years from retentionPeriodDays=2555 → 7 years', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const input = screen.getByTestId('retention-years-input') as HTMLInputElement;
        expect(input.value).toBe('7');
      });
    });

    it('renders settings card in idle state', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        expect(screen.getByTestId('retention-settings-card')).toBeDefined();
      });
    });

    it('Save button is enabled in idle state', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const btn = screen.getByTestId('save-btn') as HTMLButtonElement;
        expect(btn.disabled).toBe(false);
      });
    });

    it('renders provenance line', async () => {
      vi.stubGlobal(
        'fetch',
        makePolicyFetch({
          retentionPeriodDays: 2555,
          // Must be a valid UUID to pass retentionPolicySchema (z.string().uuid().nullable())
          updatedBy: '00000000-0000-4000-a000-000000000123',
          updatedAt: '2026-04-14T00:00:00.000Z',
        })
      );
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        expect(screen.getByTestId('provenance-line')).toBeDefined();
      });
    });

    it('renders cutoff panel', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        expect(screen.getByTestId('cutoff-panel')).toBeDefined();
      });
    });

    it('cutoff panel has role="note" (read-only informational)', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const panel = screen.getByTestId('cutoff-panel');
        expect(panel.getAttribute('role')).toBe('note');
      });
    });

    it('renders Read-only badge on cutoff panel', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        expect(screen.getByTestId('readonly-badge')).toBeDefined();
      });
    });

    it('renders cutoff statement with years and date', async () => {
      vi.stubGlobal(
        'fetch',
        makePolicyFetch({ retentionPeriodDays: 2555, cutoffDate: '2019-07-07T00:00:00.000Z' })
      );
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        expect(screen.getByTestId('cutoff-statement')).toBeDefined();
        expect(screen.getByTestId('cutoff-years').textContent).toBe('7-year');
      });
    });

    it('renders "Records are preserved" note on cutoff panel', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const note = screen.getByTestId('cutoff-note');
        expect(note.textContent).toMatch(/records are preserved/i);
        expect(note.textContent).toMatch(/deletion is not performed automatically/i);
      });
    });

    it('cutoff panel has NO interactive affordances (no button or link inside)', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const panel = screen.getByTestId('cutoff-panel');
        const buttons = panel.querySelectorAll('button');
        const links = panel.querySelectorAll('a');
        expect(buttons.length).toBe(0);
        expect(links.length).toBe(0);
      });
    });
  });

  // ── [WORM — LOAD-BEARING] NO purge/delete control ────────────────────────

  describe('[WORM — LOAD-BEARING] NO purge/delete control', () => {
    it('renders NO button matching /purge|delete|clean/i in idle state', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        screen.getByTestId('retention-settings-card');
      });
      const btns = screen.queryAllByRole('button');
      const dangerous = btns.filter((b) => /purge|delete|clean/i.test(b.textContent ?? ''));
      expect(dangerous).toHaveLength(0);
    });

    it('renders NO button matching /purge|delete|clean/i in loading state', () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockReturnValue(
          new Promise(() => {
            /* never resolves */
          })
        )
      );
      render(<RetentionPolicyForm userRole="compliance" />);
      const btns = screen.queryAllByRole('button');
      const dangerous = btns.filter((b) => /purge|delete|clean/i.test(b.textContent ?? ''));
      expect(dangerous).toHaveLength(0);
    });

    it('renders NO element with aria-label matching /purge|delete|clean/i', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        screen.getByTestId('retention-settings-card');
      });
      const elements = document.querySelectorAll('[aria-label]');
      const dangerous = Array.from(elements).filter((el) =>
        /purge|delete|clean/i.test(el.getAttribute('aria-label') ?? '')
      );
      expect(dangerous).toHaveLength(0);
    });
  });

  // ── Audit note (LOAD-BEARING) ─────────────────────────────────────────────

  describe('audit-recorded trust note (LOAD-BEARING)', () => {
    it('renders audit note "This change is recorded in your audit log." in idle state', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        expect(screen.getByTestId('audit-note')).toBeDefined();
        expect(screen.getByText(/this change is recorded in your audit log/i)).toBeDefined();
      });
    });

    it('audit note has role="note"', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const note = screen.getByTestId('audit-note');
        expect(note.getAttribute('role')).toBe('note');
      });
    });
  });

  // ── Years ↔ days conversion ───────────────────────────────────────────────

  describe('years ↔ days conversion', () => {
    it('2555 days → 7 years displayed in input', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const input = screen.getByTestId('retention-years-input') as HTMLInputElement;
        expect(input.value).toBe('7');
      });
    });

    it('3650 days → 10 years displayed in input', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 3650 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const input = screen.getByTestId('retention-years-input') as HTMLInputElement;
        expect(input.value).toBe('10');
      });
    });

    it('365 days → 1 year displayed in input', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 365 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const input = screen.getByTestId('retention-years-input') as HTMLInputElement;
        expect(input.value).toBe('1');
      });
    });

    it('10950 days → 30 years displayed in input', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 10950 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const input = screen.getByTestId('retention-years-input') as HTMLInputElement;
        expect(input.value).toBe('30');
      });
    });

    it('Save sends retentionPeriodDays = years * 365 (7 years → 2555 days)', async () => {
      const user = userEvent.setup();
      const mockFetch = makePolicyFetchThenPut({ retentionPeriodDays: 2555, putDays: 2555 });
      vi.stubGlobal('fetch', mockFetch);
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const putCall = calls.find(([, init]) => init?.method === 'PUT');
        expect(putCall).toBeDefined();
        const body = JSON.parse(putCall?.[1]?.body as string) as Record<string, unknown>;
        expect(body.retentionPeriodDays).toBe(2555); // 7 * 365
      });
    });

    it('PUT body does NOT include workspace_id (SEC-2)', async () => {
      const user = userEvent.setup();
      const mockFetch = makePolicyFetchThenPut({ retentionPeriodDays: 2555, putDays: 2555 });
      vi.stubGlobal('fetch', mockFetch);
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const putCall = calls.find(([, init]) => init?.method === 'PUT');
        expect(putCall).toBeDefined();
        const body = JSON.parse(putCall?.[1]?.body as string) as Record<string, unknown>;
        expect(body.workspace_id).toBeUndefined();
        expect(body.firmId).toBeUndefined();
      });
    });
  });

  // ── Stepper ───────────────────────────────────────────────────────────────

  describe('stepper', () => {
    it('increment button increases value by 1 year', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('retention-years-input');
      });

      await user.click(screen.getByTestId('btn-increment'));

      const input = screen.getByTestId('retention-years-input') as HTMLInputElement;
      expect(input.value).toBe('8');
    });

    it('decrement button decreases value by 1 year', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('retention-years-input');
      });

      await user.click(screen.getByTestId('btn-decrement'));

      const input = screen.getByTestId('retention-years-input') as HTMLInputElement;
      expect(input.value).toBe('6');
    });
  });

  // ── Saving state ──────────────────────────────────────────────────────────

  describe('saving state', () => {
    it('Save button has aria-busy="true" during PUT', async () => {
      const user = userEvent.setup();
      // GET resolves immediately; PUT never resolves (holds saving state)
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  retentionPeriodDays: 2555,
                  cutoffDate: '2019-07-07T00:00:00.000Z',
                  updatedBy: null,
                  updatedAt: null,
                }),
            } as unknown as Response);
          }
          // PUT never resolves — holds saving state
          return new Promise(() => {
            /* never */
          });
        })
      );
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const btn = screen.getByTestId('save-btn') as HTMLButtonElement;
        expect(btn.getAttribute('aria-busy')).toBe('true');
      });
    });

    it('Save button is disabled during saving', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  retentionPeriodDays: 2555,
                  cutoffDate: '2019-07-07T00:00:00.000Z',
                  updatedBy: null,
                  updatedAt: null,
                }),
            } as unknown as Response);
          }
          return new Promise(() => {
            /* never */
          });
        })
      );
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const btn = screen.getByTestId('save-btn') as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
      });
    });
  });

  // ── Saved state ───────────────────────────────────────────────────────────

  describe('saved state', () => {
    it('Saved pill is visible after successful PUT', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', makePolicyFetchThenPut({ retentionPeriodDays: 2555, putDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const pill = screen.getByTestId('saved-pill');
        expect(pill.style.opacity).toBe('1');
      });
    });

    it('Saved pill has role="status" + aria-live="polite"', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        screen.getByTestId('save-btn');
      });
      const pill = screen.getByTestId('saved-pill');
      expect(pill.getAttribute('role')).toBe('status');
      expect(pill.getAttribute('aria-live')).toBe('polite');
      expect(pill.getAttribute('aria-atomic')).toBe('true');
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────

  describe('error state', () => {
    it('renders error panel with role="alert" on non-ok PUT response', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  retentionPeriodDays: 2555,
                  cutoffDate: '2019-07-07T00:00:00.000Z',
                  updatedBy: null,
                  updatedAt: null,
                }),
            } as unknown as Response);
          }
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Internal Server Error'),
          } as unknown as Response);
        })
      );
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const panel = screen.getByTestId('save-error-panel');
        expect(panel.getAttribute('role')).toBe('alert');
      });
    });

    it('error panel has aria-live="assertive"', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  retentionPeriodDays: 2555,
                  cutoffDate: '2019-07-07T00:00:00.000Z',
                  updatedBy: null,
                  updatedAt: null,
                }),
            } as unknown as Response);
          }
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('fail'),
          } as unknown as Response);
        })
      );
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const panel = screen.getByTestId('save-error-panel');
        expect(panel.getAttribute('aria-live')).toBe('assertive');
      });
    });

    it('renders Retry button in error state', async () => {
      const user = userEvent.setup();
      let callCount = 0;
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({
                  retentionPeriodDays: 2555,
                  cutoffDate: '2019-07-07T00:00:00.000Z',
                  updatedBy: null,
                  updatedAt: null,
                }),
            } as unknown as Response);
          }
          return Promise.resolve({
            ok: false,
            status: 500,
            text: () => Promise.resolve('fail'),
          } as unknown as Response);
        })
      );
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('retry-btn')).toBeDefined();
      });
    });
  });

  // ── Invalid state ─────────────────────────────────────────────────────────

  describe('invalid state', () => {
    it('aria-invalid="true" on input for out-of-range value', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('retention-years-input');
      });

      const input = screen.getByTestId('retention-years-input');
      await user.clear(input);
      await user.type(input, '999');

      await waitFor(() => {
        expect(input.getAttribute('aria-invalid')).toBe('true');
      });
    });

    it('years-error renders for out-of-range value', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('retention-years-input');
      });

      const input = screen.getByTestId('retention-years-input');
      await user.clear(input);
      await user.type(input, '99');

      await waitFor(() => {
        const err = screen.getByTestId('years-error');
        expect(err.style.display).not.toBe('none');
        expect(err.getAttribute('role')).toBe('alert');
        expect(err.getAttribute('aria-live')).toBe('assertive');
      });
    });

    it('Save button is disabled when input is invalid', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('retention-years-input');
      });

      const input = screen.getByTestId('retention-years-input');
      await user.clear(input);
      await user.type(input, '99');

      await waitFor(() => {
        const btn = screen.getByTestId('save-btn') as HTMLButtonElement;
        expect(btn.disabled).toBe(true);
      });
    });

    it('cutoff panel shows placeholder copy when invalid', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('retention-years-input');
      });

      const input = screen.getByTestId('retention-years-input');
      await user.clear(input);
      await user.type(input, '99');

      await waitFor(() => {
        expect(screen.getByTestId('cutoff-statement-placeholder')).toBeDefined();
        expect(screen.getByTestId('cutoff-statement-placeholder').textContent).toMatch(
          /enter a valid retention period/i
        );
      });
    });
  });

  // ── PUT mechanics ─────────────────────────────────────────────────────────

  describe('PUT mechanics', () => {
    it('sends anti-CSRF rid header on PUT', async () => {
      const user = userEvent.setup();
      const mockFetch = makePolicyFetchThenPut({ retentionPeriodDays: 2555, putDays: 2555 });
      vi.stubGlobal('fetch', mockFetch);
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const putCall = calls.find(([, init]) => init?.method === 'PUT');
        expect(putCall).toBeDefined();
        const headers = putCall?.[1]?.headers as Record<string, string> | undefined;
        expect(headers?.rid).toBe('anti-csrf');
      });
    });

    it('uses PUT method', async () => {
      const user = userEvent.setup();
      const mockFetch = makePolicyFetchThenPut({ retentionPeriodDays: 2555, putDays: 2555 });
      vi.stubGlobal('fetch', mockFetch);
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const putCall = calls.find(([, init]) => init?.method === 'PUT');
        expect(putCall?.[1]?.method).toBe('PUT');
      });
    });

    it('fetches from /compliance/retention-data (non-colliding proxy path)', async () => {
      const user = userEvent.setup();
      const mockFetch = makePolicyFetchThenPut({ retentionPeriodDays: 2555, putDays: 2555 });
      vi.stubGlobal('fetch', mockFetch);
      render(<RetentionPolicyForm userRole="compliance" />);

      await waitFor(() => {
        screen.getByTestId('save-btn');
      });

      await user.click(screen.getByTestId('save-btn'));

      await waitFor(() => {
        const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
        const putCall = calls.find(
          ([url]) => typeof url === 'string' && url.includes('/compliance/retention-data')
        );
        expect(putCall).toBeDefined();
      });
    });
  });

  // ── Accessibility ─────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('label is associated with years input via htmlFor/id', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const label = document.querySelector('label[for="retention-years"]');
        expect(label).not.toBeNull();
        const input = document.getElementById('retention-years');
        expect(input).not.toBeNull();
      });
    });

    it('input has aria-describedby pointing to years-error and years-hint', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const input = screen.getByTestId('retention-years-input');
        expect(input.getAttribute('aria-describedby')).toContain('years-error');
        expect(input.getAttribute('aria-describedby')).toContain('years-hint');
      });
    });

    it('input aria-invalid defaults to false in idle state', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const input = screen.getByTestId('retention-years-input');
        // aria-invalid is false when valid
        expect(input.getAttribute('aria-invalid')).toBe('false');
      });
    });

    it('Save button has aria-describedby pointing to audit-note-text', async () => {
      vi.stubGlobal('fetch', makePolicyFetch({ retentionPeriodDays: 2555 }));
      render(<RetentionPolicyForm userRole="compliance" />);
      await waitFor(() => {
        const btn = screen.getByTestId('save-btn');
        expect(btn.getAttribute('aria-describedby')).toBe('audit-note-text');
      });
    });
  });
});
