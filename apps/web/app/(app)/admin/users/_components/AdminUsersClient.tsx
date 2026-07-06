/**
 * AdminUsersClient — interactive user management table + invite panel.
 *
 * Client component for:
 *   - Displaying user list (name/email/role/active status)
 *   - Invite user (POST /admin/users-data/invite)
 *   - Change role (PATCH /admin/users-data/:id/role)
 *   - Deactivate user (POST /admin/users-data/:id/deactivate)
 *   - Graceful last-admin-409 error display
 *
 * HARD BOUNDARIES:
 *   NO send/AI affordance.
 *   Credential data never shown.
 *
 * Mutations use /admin/users-data/* proxy (non-page-colliding).
 */

'use client';

import type { Role, UserAdminRecord } from '@dealflow/shared';
import { roleEnum } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminUsersClientProps {
  initialUsers: UserAdminRecord[];
  currentUserId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  advisor: 'Advisor',
  analyst: 'Analyst',
  compliance: 'Compliance',
};

const ROLE_BADGE_COLORS: Record<Role, { bg: string; color: string; border: string }> = {
  admin: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  advisor: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  analyst: { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  compliance: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
};

const VALID_ROLES = roleEnum.options as Role[];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RoleBadge({ role }: { role: Role }) {
  const colors = ROLE_BADGE_COLORS[role] ?? ROLE_BADGE_COLORS.analyst;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: '18px',
        backgroundColor: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`,
      }}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: '18px',
        backgroundColor: active ? '#d1fae5' : '#f3f4f6',
        color: active ? '#065f46' : '#6b7280',
        border: `1px solid ${active ? '#6ee7b7' : '#e5e7eb'}`,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: active ? '#10b981' : '#9ca3af',
          flexShrink: 0,
        }}
      />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminUsersClient({ initialUsers, currentUserId }: AdminUsersClientProps) {
  const [users, setUsers] = useState<UserAdminRecord[]>(initialUsers);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('advisor');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const visibleUsers = showInactive ? users : users.filter((u) => u.deactivatedAt === null);

  // ── Invite ────────────────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const res = await apiFetch('/admin/users-data/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (res.ok) {
        setInviteSuccess(`Invite created for ${inviteEmail}`);
        setInviteEmail('');
        setInviteRole('advisor');
        setShowInvitePanel(false);
        // Refresh user list
        const listRes = await apiFetch('/admin/users-data');
        if (listRes.ok) {
          const data = (await listRes.json()) as { users: UserAdminRecord[] };
          setUsers(data.users ?? []);
        }
      } else if (res.status === 409) {
        setInviteError('A user with this email already exists or is already invited.');
      } else {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setInviteError(body.message ?? 'Failed to create invite. Please try again.');
      }
    } catch {
      setInviteError('Network error. Please try again.');
    } finally {
      setInviting(false);
    }
  }

  // ── Role change ───────────────────────────────────────────────────────────

  async function handleRoleChange(userId: string, newRole: Role) {
    setActionError(null);
    setActionUserId(userId);
    try {
      const res = await apiFetch(`/admin/users-data/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      } else if (res.status === 409) {
        setActionError(
          'Cannot change role: this would remove the last admin from the organization.'
        );
      } else {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setActionError(body.message ?? 'Failed to change role. Please try again.');
      }
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setActionUserId(null);
    }
  }

  // ── Deactivate ────────────────────────────────────────────────────────────

  async function handleDeactivate(userId: string) {
    if (userId === currentUserId) {
      setActionError('You cannot deactivate your own account.');
      return;
    }
    setActionError(null);
    setActionUserId(userId);
    try {
      const res = await apiFetch(`/admin/users-data/${userId}/deactivate`, {
        method: 'POST',
      });

      if (res.ok) {
        const body = (await res.json()) as { id: string; deactivatedAt: string };
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, deactivatedAt: body.deactivatedAt } : u))
        );
      } else if (res.status === 409) {
        setActionError('Cannot deactivate the last admin. Assign another admin first.');
      } else {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setActionError(body.message ?? 'Failed to deactivate user. Please try again.');
      }
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setActionUserId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Action toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setShowInactive((v) => !v)}
          style={{
            height: '36px',
            padding: '0 16px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            color: '#374151',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {showInactive ? 'Hide inactive' : 'Show inactive'}
        </button>

        <button
          type="button"
          onClick={() => {
            setShowInvitePanel(true);
            setInviteError(null);
            setInviteSuccess(null);
          }}
          style={{
            height: '36px',
            padding: '0 16px',
            borderRadius: '6px',
            border: '1px solid transparent',
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          + Invite user
        </button>
      </div>

      {/* Success toast */}
      {inviteSuccess && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: '#d1fae5',
            color: '#065f46',
            fontSize: '13px',
            border: '1px solid #6ee7b7',
          }}
        >
          {inviteSuccess}
        </div>
      )}

      {/* Action error banner */}
      {actionError && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            fontSize: '13px',
            border: '1px solid #fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#991b1b',
              fontSize: '16px',
              padding: '0 4px',
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Invite panel */}
      {showInvitePanel && (
        <section
          aria-label="Invite user"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgb(16 24 40 / 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: '16px',
                fontWeight: 600,
                color: '#111827',
              }}
            >
              Invite team member
            </h2>
            <button
              type="button"
              onClick={() => setShowInvitePanel(false)}
              aria-label="Close invite panel"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '20px',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <form
            onSubmit={handleInvite}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="invite-email"
                style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
              >
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@firm.com"
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  color: '#111827',
                  backgroundColor: '#ffffff',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="invite-role"
                style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
              >
                Role
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  color: '#111827',
                  backgroundColor: '#ffffff',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {VALID_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            {inviteError && (
              <p role="alert" style={{ margin: 0, fontSize: '13px', color: '#dc2626' }}>
                {inviteError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowInvitePanel(false)}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={inviting}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: inviting ? '#6ee7b7' : '#10b981',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: inviting ? 'wait' : 'pointer',
                }}
              >
                {inviting ? 'Sending invite…' : 'Send invite'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Users table */}
      <section
        aria-label="Team members"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr',
            padding: '12px 20px',
            borderBottom: '1px solid #f3f4f6',
            backgroundColor: '#f9fafb',
          }}
        >
          {['Email', 'Role', 'Status', 'Actions'].map((h) => (
            <span
              key={h}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Table rows */}
        {visibleUsers.length === 0 ? (
          <div
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '14px',
            }}
          >
            {showInactive ? 'No users found.' : 'No active users found.'}
          </div>
        ) : (
          visibleUsers.map((user) => (
            <div
              key={user.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                padding: '14px 20px',
                borderBottom: '1px solid #f3f4f6',
                alignItems: 'center',
                opacity: user.deactivatedAt ? 0.6 : 1,
              }}
            >
              {/* Email */}
              <span
                style={{
                  fontSize: '13px',
                  color: '#111827',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.email}
              </span>

              {/* Role — dropdown if active, static if deactivated */}
              <div>
                {user.deactivatedAt ? (
                  <RoleBadge role={user.role} />
                ) : (
                  <select
                    aria-label={`Change role for ${user.email}`}
                    value={user.role}
                    disabled={actionUserId === user.id}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as Role)}
                    style={{
                      height: '28px',
                      padding: '0 8px',
                      borderRadius: '5px',
                      border: '1px solid #d1d5db',
                      fontSize: '12px',
                      color: '#374151',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    {VALID_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Status */}
              <StatusBadge active={user.deactivatedAt === null} />

              {/* Actions */}
              <div>
                {!user.deactivatedAt && (
                  <button
                    type="button"
                    aria-label={`Deactivate ${user.email}`}
                    disabled={actionUserId === user.id || user.id === currentUserId}
                    onClick={() => handleDeactivate(user.id)}
                    style={{
                      height: '28px',
                      padding: '0 12px',
                      borderRadius: '5px',
                      border: '1px solid #fca5a5',
                      backgroundColor: '#ffffff',
                      color: '#dc2626',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor:
                        actionUserId === user.id || user.id === currentUserId
                          ? 'not-allowed'
                          : 'pointer',
                      opacity: actionUserId === user.id || user.id === currentUserId ? 0.5 : 1,
                    }}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
