/**
 * /admin/integrations — Admin data source integrations page (wave-15, task 41c017f7).
 *
 * SSR-hydrates GET /admin/integrations (cookie-forwarded, no-store).
 * Client mutations (POST/PATCH/toggle) go through /admin/integrations-data proxy
 * (non-page-colliding).
 *
 * RBAC: admin-only. assertRole('/admin/integrations', me.role).
 *
 * HARD BOUNDARIES:
 *   - The read shape returns hasCredential (boolean) ONLY — the plaintext/ciphertext
 *     is NEVER returned by the API and NEVER rendered here.
 *   - The credential input is WRITE-ONLY: never pre-filled, submitting sets a
 *     new credential.
 *   - NO live connection-test button.
 *   - NO send/AI affordance.
 *
 * @see design/admin-integrations.html
 * @see packages/shared/src/data-source-admin.ts
 */

import type { DataSourceConnectionAdminListResponse, MeResponse, Role } from '@dealflow/shared';
import { dataSourceConnectionAdminListResponseSchema, meResponseSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { assertRole } from '../../_lib/assertRole';
import { IntegrationsClient } from './_components/IntegrationsClient';

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
// Integrations fetch
// ---------------------------------------------------------------------------

async function fetchIntegrations(
  cookie: string
): Promise<DataSourceConnectionAdminListResponse | null> {
  try {
    const res = await fetch(`${apiBase()}/admin/integrations`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = dataSourceConnectionAdminListResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function AdminIntegrationsPage() {
  const cookie = (await cookies()).toString();

  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // Fine-grained RBAC: admin-only.
  assertRole('/admin/integrations', me.role as Role);

  const integrations = await fetchIntegrations(cookie);

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
          Data Source Integrations
        </h1>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#6b7280' }}>
          Manage data source connections, credentials, and enable/disable integrations.
        </p>
      </div>

      <IntegrationsClient initialConnections={integrations?.connections ?? []} />
    </div>
  );
}
