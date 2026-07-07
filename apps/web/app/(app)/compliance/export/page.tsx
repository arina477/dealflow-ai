/**
 * /compliance/export — Firm-admin recordkeeping export page.
 *
 * Wave-27 B-3 (task f331a51c). Route: /compliance/export.
 * Adopted design: design/staging/recordkeeping-export.html (D-3 APPROVED).
 *
 * RBAC: compliance + admin ONLY.
 *   advisor  → assertRole redirects to '/'.
 *   analyst  → assertRole redirects to '/'.
 *   No nav entry for advisor/analyst (nav⊆RBAC invariant; no navItem in rbac.ts).
 *
 * Server component inside the (app) route group; AppShell chrome is inherited
 * from app/(app)/layout.tsx (sidebar + topbar are NOT re-rendered here).
 *
 * Rendering pattern:
 *   1. Re-fetch session (same pattern as audit-log page.tsx).
 *   2. assertRole('/compliance/export', me.role) — redirects to '/' for
 *      advisor/analyst; compliance/admin pass through.
 *   3. Render the page header + RecordkeepingExportForm (client component).
 *
 * The RecordkeepingExportForm handles all interactive state (scope/format/date
 * pickers, CTA, states: idle/generating/success/truncated/empty/error).
 *
 * The export POST goes to /compliance/audit-log-data/export (the existing
 * afterFiles rewrite in next.config.ts → POST /compliance/audit-log/export on
 * the API). No new rewrite needed.
 *
 * HARD BOUNDARY: no edit/delete/send/AI affordance; export-only.
 */

import type { MeResponse, Role } from '@dealflow/shared';
import { meResponseSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { assertRole } from '../../_lib/assertRole';
import { RecordkeepingExportForm } from './_components/RecordkeepingExportForm';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base (mirrors audit-log page pattern)
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
// Page component
// ---------------------------------------------------------------------------

export default async function RecordkeepingExportPage() {
  const cookie = (await cookies()).toString();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert route access — compliance + admin only.
  //    advisor / analyst → redirect('/').
  assertRole('/compliance/export', me.role);

  const role = me.role as Role;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        maxWidth: '720px',
      }}
    >
      {/* ── Page heading ───────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            margin: '0 0 4px',
            fontSize: '20px',
            fontWeight: 600,
            lineHeight: '28px',
            color: '#1f2937',
            letterSpacing: '-0.01em',
          }}
        >
          Export records
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '20px',
            color: '#6b7280',
          }}
        >
          Download your firm&rsquo;s audit log and deal activity as a verifiable file.
        </p>
      </div>

      {/* ── Export form (client component) ────────────────────────────────── */}
      <RecordkeepingExportForm userRole={role} />
    </div>
  );
}
