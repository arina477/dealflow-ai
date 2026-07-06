/**
 * /admin/settings — AdminSettingsPage tests (wave-15, B-3).
 *
 * Coverage:
 *   - Renders per design: firm profile form + compliance profile.
 *   - Admin-only RBAC: non-admin roles redirect to '/'.
 *   - Unauthenticated → redirect to '/login'.
 *   - Workspace form: submits PUT via proxy, success/error states.
 *   - Handles null settings (first load, settings not yet set).
 *   - No send/AI affordance (assert-absent).
 */

import type { Role, WorkspaceSettings } from '@dealflow/shared';
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

import { WorkspaceSettingsClient } from './_components/WorkspaceSettingsClient';
import AdminSettingsPage from './page';

// ── Helpers ────────────────────────────────────────────────────────────────

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const SAMPLE_SETTINGS: WorkspaceSettings = {
  id: 'ws-1',
  firmName: 'Acme Capital',
  firmAddress: '123 Main St',
  regulatoryIds: 'CRD #12345',
  primaryContactName: 'Jane Smith',
  primaryContactEmail: 'jane@acme.com',
  defaultJurisdiction: 'US-NY',
  defaultDisclaimerTemplateId: null,
  defaultSuppressionScope: 'firm',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-06-01T00:00:00.000Z',
};

function makeFetchMulti(responses: Map<string, { ok: boolean; status: number; body: unknown }>) {
  return vi.fn().mockImplementation((url: string) => {
    const urlStr = String(url);
    for (const [pattern, resp] of responses) {
      if (urlStr.includes(pattern)) {
        return Promise.resolve({
          ok: resp.ok,
          status: resp.status,
          json: () => Promise.resolve(resp.body),
        } as Response);
      }
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response);
  });
}

async function renderPage() {
  try {
    const jsx = await AdminSettingsPage();
    if (jsx) render(jsx);
    return { redirected: false, path: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('AdminSettingsPage (/admin/settings)', () => {
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

  // ── Renders per design ──────────────────────────────────────────────────

  describe('renders per design', () => {
    it('renders "Workspace Settings" heading for admin', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/workspace-settings', { ok: true, status: 200, body: SAMPLE_SETTINGS }],
          ])
        )
      );
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
      expect(screen.getByRole('heading', { name: /workspace settings/i })).toBeDefined();
    });

    it('renders firm profile section', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/workspace-settings', { ok: true, status: 200, body: SAMPLE_SETTINGS }],
          ])
        )
      );
      await renderPage();
      expect(screen.getByRole('region', { name: /firm profile/i })).toBeDefined();
    });

    it('renders default compliance profile section', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/workspace-settings', { ok: true, status: 200, body: SAMPLE_SETTINGS }],
          ])
        )
      );
      await renderPage();
      expect(screen.getByRole('region', { name: /default compliance profile/i })).toBeDefined();
    });

    it('renders with null settings (first load)', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/workspace-settings', { ok: false, status: 404, body: {} }],
          ])
        )
      );
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
      // Should still render the form, just with empty fields
      expect(screen.getByRole('heading', { name: /workspace settings/i })).toBeDefined();
    });
  });

  // ── Admin-only RBAC ──────────────────────────────────────────────────────

  describe('admin-only RBAC (non-admin blocked)', () => {
    const NON_ADMIN_ROLES: Role[] = ['advisor', 'analyst', 'compliance'];
    for (const role of NON_ADMIN_ROLES) {
      it(`redirects ${role} to '/'`, async () => {
        vi.stubGlobal(
          'fetch',
          makeFetchMulti(
            new Map([
              ['/auth/me', { ok: true, status: 200, body: meFor(role) }],
              ['/admin/workspace-settings', { ok: true, status: 200, body: SAMPLE_SETTINGS }],
            ])
          )
        );
        const { redirected, path } = await renderPage();
        expect(redirected).toBe(true);
        expect(path).toBe('/');
      });
    }
  });

  // ── Unauthenticated ────────────────────────────────────────────────────────

  describe('unauthenticated', () => {
    it('redirects to /login when /auth/me returns 401', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })
      );
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  // ── No send/AI affordance ─────────────────────────────────────────────────

  describe('no send/AI affordance', () => {
    it('does not render any send or AI affordance', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/workspace-settings', { ok: true, status: 200, body: SAMPLE_SETTINGS }],
          ])
        )
      );
      await renderPage();
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
    });
  });
});

// ── WorkspaceSettingsClient unit tests ────────────────────────────────────

describe('WorkspaceSettingsClient', () => {
  const user = userEvent.setup();

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders form fields', () => {
    render(<WorkspaceSettingsClient initialSettings={SAMPLE_SETTINGS} />);
    expect(screen.getByLabelText(/firm name/i)).toBeDefined();
    expect(screen.getByLabelText(/primary contact email/i)).toBeDefined();
    expect(screen.getByLabelText(/default jurisdiction/i)).toBeDefined();
    expect(screen.getByLabelText(/default suppression scope/i)).toBeDefined();
  });

  it('pre-fills existing values', () => {
    render(<WorkspaceSettingsClient initialSettings={SAMPLE_SETTINGS} />);
    const firmNameInput = screen.getByLabelText(/firm name/i) as HTMLInputElement;
    expect(firmNameInput.value).toBe('Acme Capital');
  });

  it('renders with null settings (empty form)', () => {
    render(<WorkspaceSettingsClient initialSettings={null} />);
    const firmNameInput = screen.getByLabelText(/firm name/i) as HTMLInputElement;
    expect(firmNameInput.value).toBe('');
  });

  it('calls PUT /admin/settings-data on submit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(SAMPLE_SETTINGS),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<WorkspaceSettingsClient initialSettings={SAMPLE_SETTINGS} />);
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/admin/settings-data',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  it('shows success message on save', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_SETTINGS),
      })
    );

    render(<WorkspaceSettingsClient initialSettings={SAMPLE_SETTINGS} />);
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeDefined();
    });
  });

  it('shows error message on save failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Internal error' }),
      })
    );

    render(<WorkspaceSettingsClient initialSettings={SAMPLE_SETTINGS} />);
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('does not render any send or AI affordance', () => {
    render(<WorkspaceSettingsClient initialSettings={null} />);
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
  });
});
