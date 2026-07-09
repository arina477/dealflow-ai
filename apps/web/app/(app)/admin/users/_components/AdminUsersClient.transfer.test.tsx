/**
 * AdminUsersClient — transfer admin + self-demote tests (wave-39 B-5, task 69cd8ce4).
 *
 * Coverage:
 *   - Transfer admin: "Transfer admin" button visible for active non-self members.
 *   - Transfer admin: clicking opens ConfirmDialog (not the proxy).
 *   - Transfer admin: confirming POSTs to /admin/users-data/:id/transfer-admin
 *     with { actorNewRole }.
 *   - Transfer admin: 409 last-admin surfaces as blockedReason in the dialog
 *     (no proxy call repeated; dialog stays open with warning).
 *   - Transfer admin: cancel/Esc closes dialog without firing the proxy.
 *   - Self-demote: "Step down" button visible for admin users.
 *   - Self-demote: confirm PATCHes /admin/users-data/:id/role for currentUserId.
 *   - Self-demote: 409 last-admin surfaces as blockedReason in the dialog.
 *   - Self-demote: cancel closes dialog without firing the proxy.
 *   - No transfer button for deactivated members (guarded).
 *   - No transfer button for the current user (self-target block).
 */

import type { UserAdminRecord } from '@dealflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminUsersClient } from './AdminUsersClient';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const UUID_ADMIN = '00000000-0000-0000-0000-000000000001';
const UUID_ADVISOR = '00000000-0000-0000-0000-000000000002';
const UUID_DEACTIVATED = '00000000-0000-0000-0000-000000000003';

const BASE_USERS: UserAdminRecord[] = [
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
];

// The admin user's list refresh response after a successful transfer.
const REFRESHED_LIST = {
  users: [
    { ...BASE_USERS[0]!, role: 'advisor' },
    { ...BASE_USERS[1]!, role: 'admin' },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetch(
  firstResponse: { ok: boolean; status: number; body: unknown },
  secondResponse?: { ok: boolean; status: number; body: unknown }
) {
  let callCount = 0;
  return vi.fn().mockImplementation(() => {
    callCount++;
    const resp = callCount === 1 ? firstResponse : (secondResponse ?? firstResponse);
    return Promise.resolve({
      ok: resp.ok,
      status: resp.status,
      json: () => Promise.resolve(resp.body),
    } as Response);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminUsersClient — transfer admin', () => {
  const user = userEvent.setup();

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Visibility guards ─────────────────────────────────────────────────────

  it('renders "Transfer admin" button for each active non-self member', () => {
    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    // Advisor (active, not self) → should have button.
    expect(screen.getByRole('button', { name: /transfer admin to advisor@firm\.com/i })).toBeDefined();
  });

  it('does NOT render "Transfer admin" button for the current user (self-target blocked)', () => {
    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    // Admin row is the current user → no transfer button.
    expect(
      screen.queryByRole('button', { name: /transfer admin to admin@firm\.com/i })
    ).toBeNull();
  });

  it('does NOT render "Transfer admin" for deactivated members', async () => {
    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    // Show inactive users.
    await user.click(screen.getByRole('button', { name: /show inactive/i }));

    // Deactivated member — only Reactivate button, no Transfer admin.
    expect(
      screen.queryByRole('button', { name: /transfer admin to deactivated@firm\.com/i })
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: /reactivate deactivated@firm\.com/i })
    ).toBeDefined();
  });

  // ── Dialog opens without firing proxy ────────────────────────────────────

  it('opens a ConfirmDialog on transfer click without calling the proxy', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /transfer admin to advisor@firm\.com/i }));

    // Dialog is open.
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: /transfer admin to advisor@firm\.com/i })).toBeDefined();

    // Proxy NOT called yet.
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Cancel closes without proxy call ─────────────────────────────────────

  it('cancel in transfer dialog closes dialog without calling the proxy', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /transfer admin to advisor@firm\.com/i }));
    expect(screen.getByRole('dialog')).toBeDefined();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('Esc key in transfer dialog closes dialog without calling the proxy', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /transfer admin to advisor@firm\.com/i }));
    expect(screen.getByRole('dialog')).toBeDefined();

    screen.getByRole('dialog').focus();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Confirm fires the proxy ───────────────────────────────────────────────

  it('confirm POSTs to /admin/users-data/:id/transfer-admin with actorNewRole', async () => {
    const mockFetch = makeFetch(
      { ok: true, status: 200, body: {} },
      { ok: true, status: 200, body: REFRESHED_LIST }
    );
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /transfer admin to advisor@firm\.com/i }));
    await user.click(screen.getByRole('button', { name: /transfer admin/i, hidden: true }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/admin/users-data/${UUID_ADVISOR}/transfer-admin`),
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Verify body contains actorNewRole.
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as unknown;
    expect(body).toMatchObject({ actorNewRole: 'advisor' });
  });

  // ── 409 last-admin surfaces as blocked-reason in dialog ──────────────────

  it('surfaces 409 as blockedReason in the dialog (dialog stays open)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ message: 'Last admin' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /transfer admin to advisor@firm\.com/i }));

    // Confirm to trigger the 409.
    const confirmBtn = screen.getByRole('button', { name: /transfer admin/i });
    await user.click(confirmBtn);

    await waitFor(() => {
      // Dialog stays open with a warning alert.
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByRole('alert').textContent).toMatch(/cannot transfer/i);
    });

    // Confirm button is gone (blocked state).
    expect(screen.queryByRole('button', { name: /transfer admin/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Self-demote tests
// ---------------------------------------------------------------------------

describe('AdminUsersClient — self-demote', () => {
  const user = userEvent.setup();

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Visibility ────────────────────────────────────────────────────────────

  it('renders "Step down" button when current user is admin', () => {
    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );
    expect(screen.getByRole('button', { name: /step down from admin role/i })).toBeDefined();
  });

  // ── Dialog opens without firing proxy ────────────────────────────────────

  it('opens ConfirmDialog on "Step down" click without calling the proxy', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /step down from admin role/i }));

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByRole('heading', { name: /step down from admin/i })).toBeDefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Cancel closes without proxy call ─────────────────────────────────────

  it('cancel in self-demote dialog closes dialog without calling the proxy', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /step down from admin role/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Confirm fires PATCH role on currentUserId ─────────────────────────────

  it('confirm PATCHes /admin/users-data/:id/role for currentUserId', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /step down from admin role/i }));
    await user.click(screen.getByRole('button', { name: /step down/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/admin/users-data/${UUID_ADMIN}/role`),
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    // Verify body contains the non-admin role.
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as unknown;
    expect(body).toMatchObject({ role: 'advisor' });
  });

  // ── 409 last-admin on self-demote ────────────────────────────────────────

  it('surfaces 409 as blockedReason in the dialog on self-demote (sole admin)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ message: 'Last admin' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <AdminUsersClient
        initialUsers={BASE_USERS}
        currentUserId={UUID_ADMIN}
        currentUserRole="admin"
      />
    );

    await user.click(screen.getByRole('button', { name: /step down from admin role/i }));
    await user.click(screen.getByRole('button', { name: /step down/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeDefined();
      expect(screen.getByRole('alert').textContent).toMatch(/cannot step down/i);
    });

    // Confirm button gone in blocked state.
    expect(screen.queryByRole('button', { name: /step down/i })).toBeNull();
  });
});
