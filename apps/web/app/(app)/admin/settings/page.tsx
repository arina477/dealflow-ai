/**
 * /admin/settings — Admin workspace settings page (wave-15, task 648a86a6).
 *
 * Route: /admin/settings (NAV_SETTINGS from rbac.ts points here).
 * Also aliased at /admin/workspace-settings in next.config.ts rewrites.
 *
 * SSR-hydrates GET /admin/workspace-settings (cookie-forwarded, no-store).
 * Client mutations (PUT) go through /admin/settings-data proxy
 * (non-page-colliding).
 *
 * RBAC: admin-only. assertRole('/admin/settings', me.role).
 *
 * HARD BOUNDARIES:
 *   NO send/AI affordance.
 *
 * @see design/admin-workspace-settings.html
 * @see packages/shared/src/workspace-settings.ts
 */

import type { MeResponse, Role, WorkspaceSettings } from '@dealflow/shared';
import { meResponseSchema, workspaceSettingsSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { assertRole } from '../../_lib/assertRole';
import { WorkspaceSettingsClient } from './_components/WorkspaceSettingsClient';

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
// Settings fetch
// ---------------------------------------------------------------------------

async function fetchSettings(cookie: string): Promise<WorkspaceSettings | null> {
  try {
    const res = await fetch(`${apiBase()}/admin/workspace-settings`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = workspaceSettingsSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminSettingsPage() {
  const cookie = (await cookies()).toString();

  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // Fine-grained RBAC: admin-only.
  assertRole('/admin/settings', me.role as Role);

  const settings = await fetchSettings(cookie);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '800px',
      }}
    >
      {/* Page header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
          Workspace Settings
        </h1>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#6b7280' }}>
          Configure your firm profile and default compliance settings for new mandates.
        </p>
      </div>

      <WorkspaceSettingsClient initialSettings={settings} />
    </div>
  );
}
