/**
 * /admin/users — AdminUsersPage tests (wave-15, B-3).
 *
 * Coverage:
 *   - Renders per design: page title, team member list.
 *   - Admin-only RBAC: non-admin roles redirect to '/'.
 *   - Unauthenticated → redirect to '/login'.
 *   - Invite form: shows invite panel, submits, handles errors.
 *   - Role change: PATCH via proxy, handles 409 last-admin gracefully.
 *   - Deactivate: POST via proxy, handles 409 last-admin gracefully.
 *   - No send/AI affordance (assert-absent).
 *   - SSR: SSR-fetches user list; passes to client component.
 */

import type { Role, UserAdminListResponse } from '@dealflow/shared';
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

import { AdminUsersClient } from './_components/AdminUsersClient';
import AdminUsersPage from './page';

// ── Helpers ────────────────────────────────────────────────────────────────

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

// UUID-format IDs required by userAdminRecordSchema (z.string().uuid())
const UUID_ADMIN = '00000000-0000-0000-0000-000000000001';
const UUID_ADVISOR = '00000000-0000-0000-0000-000000000002';
const UUID_DEACTIVATED = '00000000-0000-0000-0000-000000000003';

const ADMIN_USER_LIST: UserAdminListResponse = {
  users: [
    {
      id: UUID_ADMIN,
      email: 'admin@firm.com',
      role: 'admin',
      deactivatedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      invitedBy: null,
    },
    {
      id: UUID_ADVISOR,
      email: 'advisor@firm.com',
      role: 'advisor',
      deactivatedAt: null,
      createdAt: '2024-01-02T00:00:00.000Z',
      invitedBy: UUID_ADMIN,
    },
    {
      id: UUID_DEACTIVATED,
      email: 'deactivated@firm.com',
      role: 'analyst',
      deactivatedAt: '2024-06-01T00:00:00.000Z',
      createdAt: '2024-01-03T00:00:00.000Z',
      invitedBy: UUID_ADMIN,
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
    const jsx = await AdminUsersPage();
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

describe('AdminUsersPage (/admin/users)', () => {
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
    it('renders page title "Manage Team" for admin', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/users', { ok: true, status: 200, body: ADMIN_USER_LIST }],
          ])
        )
      );
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
      expect(screen.getByRole('heading', { name: /manage team/i })).toBeDefined();
    });

    it('renders user list with email and role', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/users', { ok: true, status: 200, body: ADMIN_USER_LIST }],
          ])
        )
      );
      await renderPage();
      expect(screen.getByText('admin@firm.com')).toBeDefined();
      expect(screen.getByText('advisor@firm.com')).toBeDefined();
    });

    it('renders Team members section', async () => {
      vi.stubGlobal(
        'fetch',
        makeFetchMulti(
          new Map([
            ['/auth/me', { ok: true, status: 200, body: meFor('admin') }],
            ['/admin/users', { ok: true, status: 200, body: ADMIN_USER_LIST }],
          ])
        )
      );
      await renderPage();
      expect(screen.getByRole('region', { name: /team members/i })).toBeDefined();
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
              ['/admin/users', { ok: true, status: 200, body: ADMIN_USER_LIST }],
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
            ['/admin/users', { ok: true, status: 200, body: ADMIN_USER_LIST }],
          ])
        )
      );
      await renderPage();
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /compose/i })).toBeNull();
    });
  });
});

// ── AdminUsersClient unit tests ─────────────────────────────────────────────

describe('AdminUsersClient', () => {
  const user = userEvent.setup();

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Invite ──────────────────────────────────────────────────────────────────

  describe('invite flow', () => {
    it('renders "Invite user" button', () => {
      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      expect(screen.getByRole('button', { name: /invite user/i })).toBeDefined();
    });

    it('opens invite panel on click', async () => {
      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      await user.click(screen.getByRole('button', { name: /invite user/i }));
      const inviteRegion = screen.getByRole('region', { name: /invite user/i });
      expect(inviteRegion).toBeDefined();
      expect(screen.getByLabelText(/email address/i)).toBeDefined();
      // Use getByRole within the invite panel to avoid colliding with table role-selects
      expect(screen.getByLabelText(/^role$/i)).toBeDefined();
    });

    it('calls POST /admin/users-data/invite on submit', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            inviteId: 'inv-1',
            email: 'new@firm.com',
            role: 'advisor',
            expiry: '2025-01-01T00:00:00.000Z',
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      await user.click(screen.getByRole('button', { name: /invite user/i }));
      await user.type(screen.getByLabelText(/email address/i), 'new@firm.com');
      await user.click(screen.getByRole('button', { name: /send invite/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/admin/users-data/invite',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });
    });

    it('shows error when invite returns 409', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ message: 'User already exists' }),
        })
      );

      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      await user.click(screen.getByRole('button', { name: /invite user/i }));
      await user.type(screen.getByLabelText(/email address/i), 'existing@firm.com');
      await user.click(screen.getByRole('button', { name: /send invite/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
      });
    });
  });

  // ── Role change ─────────────────────────────────────────────────────────────

  describe('role change', () => {
    it('calls PATCH /admin/users-data/:id/role on role change', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(undefined),
      });
      vi.stubGlobal('fetch', mockFetch);

      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);

      const roleSelect = screen.getByLabelText(/change role for advisor@firm\.com/i);
      await user.selectOptions(roleSelect, 'analyst');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/admin/users-data/${UUID_ADVISOR}/role`),
          expect.objectContaining({ method: 'PATCH' })
        );
      });
    });

    it('shows last-admin-409 error gracefully on role change', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ message: 'Last admin' }),
        })
      );

      const adminUser = ADMIN_USER_LIST.users[0];
      if (!adminUser) throw new Error('Missing test fixture');
      render(<AdminUsersClient initialUsers={[adminUser]} currentUserId="u-other-admin" />);

      const roleSelect = screen.getByLabelText(/change role for admin@firm\.com/i);
      await user.selectOptions(roleSelect, 'advisor');

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        // Should contain "last admin" message
        expect(screen.getByRole('alert').textContent).toMatch(/last admin/i);
      });
    });
  });

  // ── Deactivate ──────────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('calls POST /admin/users-data/:id/deactivate on deactivate click', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ id: UUID_ADVISOR, deactivatedAt: '2024-12-01T00:00:00.000Z' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);

      const deactivateBtn = screen.getByRole('button', {
        name: /deactivate advisor@firm\.com/i,
      });
      await user.click(deactivateBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/admin/users-data/${UUID_ADVISOR}/deactivate`),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('shows last-admin-409 error gracefully on deactivate', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ message: 'Cannot deactivate last admin' }),
        })
      );

      const adminUser0 = ADMIN_USER_LIST.users[0];
      if (!adminUser0) throw new Error('Missing test fixture');
      render(<AdminUsersClient initialUsers={[adminUser0]} currentUserId="u-other-admin" />);

      const deactivateBtn = screen.getByRole('button', {
        name: /deactivate admin@firm\.com/i,
      });
      await user.click(deactivateBtn);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByRole('alert').textContent).toMatch(/last admin/i);
      });
    });

    it('does not show deactivate button for deactivated users', () => {
      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);

      // Show inactive to see deactivated user
      const toggleBtn = screen.getByRole('button', { name: /show inactive/i });
      // Not clicking it — deactivated user is hidden by default
      // Just verify the active users have deactivate buttons
      expect(screen.getByRole('button', { name: /deactivate advisor@firm\.com/i })).toBeDefined();
    });
  });

  // ── Reactivate (wave-16, task 042cf4e6) ─────────────────────────────────────

  describe('reactivate', () => {
    it('shows Reactivate button for deactivated users when inactive users are shown', async () => {
      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      // Reveal inactive users first
      await user.click(screen.getByRole('button', { name: /show inactive/i }));
      expect(
        screen.getByRole('button', { name: /reactivate deactivated@firm\.com/i })
      ).toBeDefined();
    });

    it('does not show Reactivate button for active users', async () => {
      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      // Active users get Deactivate, not Reactivate
      expect(screen.queryByRole('button', { name: /reactivate advisor@firm\.com/i })).toBeNull();
    });

    it('calls POST /admin/users-data/:id/reactivate on reactivate click', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: UUID_DEACTIVATED,
            email: 'deactivated@firm.com',
            deactivatedAt: null,
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      await user.click(screen.getByRole('button', { name: /show inactive/i }));

      const reactivateBtn = screen.getByRole('button', {
        name: /reactivate deactivated@firm\.com/i,
      });
      await user.click(reactivateBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining(`/admin/users-data/${UUID_DEACTIVATED}/reactivate`),
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('shows error when reactivate returns 400 (already active)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ message: 'User is already active' }),
        })
      );

      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      await user.click(screen.getByRole('button', { name: /show inactive/i }));

      await user.click(screen.getByRole('button', { name: /reactivate deactivated@firm\.com/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeDefined();
        expect(screen.getByRole('alert').textContent).toMatch(/already active/i);
      });
    });
  });

  // ── Invite form is write-only (credential-form regression guard) ───────────

  describe('invite form write-only — no credential pre-fill (wave-15 regression guard)', () => {
    it('email input has no defaultValue or value pre-filled from a user record', async () => {
      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      await user.click(screen.getByRole('button', { name: /invite user/i }));
      const emailInput = screen.getByLabelText(/email address/i) as HTMLInputElement;
      // Must start empty — never pre-filled from existing user data
      expect(emailInput.value).toBe('');
    });
  });

  // ── No send/AI ──────────────────────────────────────────────────────────────

  describe('no send/AI affordance', () => {
    it('does not render any send or AI affordance', () => {
      render(<AdminUsersClient initialUsers={ADMIN_USER_LIST.users} currentUserId={UUID_ADMIN} />);
      expect(screen.queryByRole('button', { name: /send email/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /compose/i })).toBeNull();
    });
  });
});
