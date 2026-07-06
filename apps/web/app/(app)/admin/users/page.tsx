/**
 * /admin/users — Admin user management page (wave-15, task 82ec8724).
 *
 * SSR-hydrates the user list from GET /admin/users (cookie-forwarded, no-store).
 * Client mutations (invite / role-change / deactivate) go through
 * /admin/users-data proxy (non-page-colliding).
 *
 * RBAC: admin-only. assertRole('/admin/users', me.role) — non-admin → redirect('/').
 *
 * HARD BOUNDARIES:
 *   NO send/AI affordance.
 *   Credential/session data never exposed here.
 *   Last-admin guard: 409 from deactivate/role-change surfaced gracefully.
 *
 * @see design/admin-users.html
 * @see packages/shared/src/user-admin.ts
 */

import type { MeResponse, Role, UserAdminListResponse } from '@dealflow/shared';
import { meResponseSchema, userAdminListResponseSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { assertRole } from '../../_lib/assertRole';
import { AdminUsersClient } from './_components/AdminUsersClient';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base
// ---------------------------------------------------------------------------

function apiBase(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  );
}

// ---------------------------------------------------------------------------
// Session fetch
// ---------------------------------------------------------------------------

async function fetchMe(cookie: string): Promise<MeResponse | null> {
  try {
    const res = await fetch(`${apiBase()}/auth/me`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = meResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Users fetch
// ---------------------------------------------------------------------------

async function fetchUsers(cookie: string): Promise<UserAdminListResponse | null> {
  try {
    const res = await fetch(`${apiBase()}/admin/users`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = userAdminListResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminUsersPage() {
  const cookie = (await cookies()).toString();

  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // Fine-grained RBAC: admin-only.
  assertRole('/admin/users', me.role as Role);

  const userList = await fetchUsers(cookie);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1200px',
      }}
    >
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 600,
            lineHeight: '32px',
            letterSpacing: '-0.01em',
            color: '#111827',
          }}
        >
          Manage Team
        </h1>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#6b7280' }}>
          Provision access, assign roles, and review team membership.
        </p>
      </div>

      {/* Client component handles all mutations */}
      <AdminUsersClient initialUsers={userList?.users ?? []} currentUserId={me.userId} />
    </div>
  );
}
