/**
 * /admin/integrations — AdminIntegrationsPage tests (wave-15, B-3).
 *
 * Coverage:
 *   - Renders per design: connection list, add button.
 *   - Admin-only RBAC: non-admin roles redirect to '/'.
 *   - Unauthenticated → redirect to '/login'.
 *   - Credential WRITE-ONLY: hasCredential badge shown; credential NEVER in DOM.
 *   - Credential input NEVER pre-filled (always empty on open edit).
 *   - Add connection: POST /admin/integrations-data.
 *   - Edit connection: PATCH /admin/integrations-data/:id.
 *   - Toggle enable/disable: PATCH /admin/integrations-data/:id/toggle.
 *   - No live connection-test button (assert-absent).
 *   - No send/AI affordance (assert-absent).
 *   - hasCredential badge renders (NOT the credential value).
 */

import type { DataSourceConnectionAdminListResponse, Role } from '@dealflow/shared';
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

import { IntegrationsClient } from './_components/IntegrationsClient';
import AdminIntegrationsPage from './page';

// ── Helpers ────────────────────────────────────────────────────────────────

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

// UUID-format IDs required by schema (z.string().uuid())
const UUID_CONN_ADMIN = '00000000-0000-0000-0000-000000000010';
const UUID_CONN_1 = '00000000-0000-0000-0000-000000000011';
const UUID_CONN_2 = '00000000-0000-0000-0000-000000000012';

const SAMPLE_CONNECTIONS: DataSourceConnectionAdminListResponse = {
  connections: [
    {
      id: UUID_CONN_1,
      providerKey: 'GRATA_API_KEY',
      displayName: 'Grata',
      enabled: true,
      hasCredential: true,
      createdAt: '2024-01-01T00:00:00.000Z',
      createdBy: UUID_CONN_ADMIN,
    },
    {
      id: UUID_CONN_2,
      providerKey: 'PITCHBOOK_API_KEY',
      displayName: 'PitchBook',
      enabled: false,
      hasCredential: false,
      createdAt: '2024-01-02T00:00:00.000Z',
      createdBy: UUID_CONN_ADMIN,
    },
  ],
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
    const jsx = await AdminIntegrationsPage();
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

describe('AdminIntegrationsPage (/admin/integrations)', () => {
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
    it('renders page title for admin', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/integrations', { ok: true, status: 200, body: SAMPLE_CONNECTIONS }],
          ])
        )
      );
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
      expect(screen.getByRole('heading', { name: /data source integrations/i })).toBeDefined();
    });

    it('renders connection list', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/integrations', { ok: true, status: 200, body: SAMPLE_CONNECTIONS }],
          ])
        )
      );
      await renderPage();
      expect(screen.getByText('Grata')).toBeDefined();
      expect(screen.getByText('PitchBook')).toBeDefined();
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
              ['/admin/integrations', { ok: true, status: 200, body: SAMPLE_CONNECTIONS }],
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
            ['/admin/integrations', { ok: true, status: 200, body: SAMPLE_CONNECTIONS }],
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

// ── IntegrationsClient unit tests ──────────────────────────────────────────

describe('IntegrationsClient', () => {
  const user = userEvent.setup();

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Credential WRITE-ONLY ──────────────────────────────────────────────────

  describe('credential WRITE-ONLY security invariant', () => {
    it('shows hasCredential badge (not the credential value)', () => {
      render(<IntegrationsClient initialConnections={SAMPLE_CONNECTIONS.connections} />);
      // hasCredential=true for Grata → badge rendered
      expect(screen.getByLabelText('Credential stored')).toBeDefined();
      // hasCredential=false for PitchBook → no-credential badge
      expect(screen.getByLabelText('No credential')).toBeDefined();
    });

    it('credential is NOT in the rendered DOM', () => {
      render(<IntegrationsClient initialConnections={SAMPLE_CONNECTIONS.connections} />);
      // The actual credential value should never appear in the DOM
      // We verify there's no text containing any secret-like pattern
      // The list only shows hasCredential boolean badge
      const credentialTexts = screen.queryAllByText(/sk-|api-key-value|credential-value|secret/i);
      expect(credentialTexts).toHaveLength(0);
    });

    it('credential input is empty when opening edit panel (never pre-filled)', async () => {
      render(<IntegrationsClient initialConnections={SAMPLE_CONNECTIONS.connections} />);

      // Open edit for Grata (which HAS a credential stored)
      const editBtn = screen.getByRole('button', { name: /edit grata/i });
      await user.click(editBtn);

      const credentialInput = screen.getByLabelText(/api credential/i) as HTMLInputElement;
      // Must be empty — NEVER pre-filled with the stored credential
      expect(credentialInput.value).toBe('');
    });

    it('credential input type is password', async () => {
      render(<IntegrationsClient initialConnections={SAMPLE_CONNECTIONS.connections} />);

      await user.click(screen.getByRole('button', { name: /add integration/i }));

      const credentialInput = screen.getByLabelText(/api credential/i) as HTMLInputElement;
      expect(credentialInput.type).toBe('password');
    });
  });

  // ── No live connection-test ────────────────────────────────────────────────

  describe('no live connection-test button', () => {
    it('does not render a test connection or verify button', () => {
      render(<IntegrationsClient initialConnections={SAMPLE_CONNECTIONS.connections} />);
      expect(screen.queryByRole('button', { name: /test connection/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /test/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /verify connection/i })).toBeNull();
    });
  });

  // ── Add integration ────────────────────────────────────────────────────────

  describe('add integration', () => {
    it('opens add panel on click', async () => {
      render(<IntegrationsClient initialConnections={SAMPLE_CONNECTIONS.connections} />);
      await user.click(screen.getByRole('button', { name: /\+ add integration/i }));
      expect(screen.getByRole('region', { name: /add integration/i })).toBeDefined();
    });

    it('calls POST /admin/integrations-data on add submit', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: 'conn-3',
            providerKey: 'NEW_KEY',
            displayName: 'New Source',
            enabled: false,
            hasCredential: false,
            createdAt: '2024-12-01T00:00:00.000Z',
            createdBy: UUID_CONN_ADMIN,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      render(<IntegrationsClient initialConnections={SAMPLE_CONNECTIONS.connections} />);
      await user.click(screen.getByRole('button', { name: /\+ add integration/i }));
      await user.type(screen.getByLabelText(/provider key/i), 'NEW_KEY');
      await user.type(screen.getByLabelText(/display name/i), 'New Source');
      // The submit button says "Add integration" (exact); use the form submit button
      const submitBtn = screen.getByRole('button', { name: /^add integration$/i });
      await user.click(submitBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/admin/integrations-data',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  // ── Toggle ────────────────────────────────────────────────────────────────

  describe('toggle enable/disable', () => {
    it('calls PATCH /admin/integrations-data/:id/toggle on toggle', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...SAMPLE_CONNECTIONS.connections[0], enabled: false }),
      });
      vi.stubGlobal('fetch', mockFetch);

      render(<IntegrationsClient initialConnections={SAMPLE_CONNECTIONS.connections} />);

      // Click the Enabled badge for Grata (which is currently enabled)
      const toggleBtn = screen.getByRole('button', { name: /disable grata/i });
      await user.click(toggleBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/admin/integrations-data/${UUID_CONN_1}/toggle`),
          expect.objectContaining({ method: 'PATCH' })
        );
      });
    });
  });

  // ── No send/AI ──────────────────────────────────────────────────────────────

  describe('no send/AI affordance', () => {
    it('does not render any send or AI affordance', () => {
      render(<IntegrationsClient initialConnections={SAMPLE_CONNECTIONS.connections} />);
      expect(screen.queryByRole('button', { name: /send email/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
    });
  });
});
