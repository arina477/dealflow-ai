/**
 * /compliance/retention — Retention-policy settings page.
 *
 * Wave-28 B-3 (task ce75c6c6). Route: /compliance/retention.
 * Adopted design: design/staging/retention-settings.html (D-3 APPROVED).
 *
 * RBAC: compliance + admin ONLY.
 *   advisor  → assertRole redirects to '/'.
 *   analyst  → assertRole redirects to '/'.
 *   anon     → redirect('/login').
 *   No navItem for this route (API-config surface, not a top-level nav item per rbac.ts).
 *
 * Rendering pattern (mirrors /compliance/export exactly):
 *   1. Re-fetch session (same pattern as export/page.tsx + audit-log/page.tsx).
 *   2. assertRole('/compliance/retention', me.role) — redirects to '/' for
 *      advisor/analyst; compliance/admin pass through.
 *   3. Render the page header + RetentionPolicyForm (client component).
 *
 * The RetentionPolicyForm handles all interactive state:
 *   loading / idle / saving / saved / error / invalid
 *   GET + PUT /compliance/retention-data (proxied → /compliance/retention on the API).
 *
 * WORM — LOAD-BEARING:
 *   NO purge/delete/clean-up affordance anywhere on this page. The cutoff panel is
 *   informational only. The audit-recorded trust note is always visible below Save.
 *
 * Max-width: 640px (single-control settings column — tighter than export's 720px,
 * intentional as per D-2 spec §1: "narrow single-column settings posture").
 */

import type { MeResponse, Role } from '@dealflow/shared';
import { meResponseSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { assertRole } from '../../_lib/assertRole';
import { RetentionPolicyForm } from './_components/RetentionPolicyForm';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base resolution (mirrors export/page.tsx pattern)
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

export default async function RetentionPolicyPage() {
  const cookie = (await cookies()).toString();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert route access — compliance + admin only.
  //    advisor / analyst → redirect('/').
  assertRole('/compliance/retention', me.role);

  const role = me.role as Role;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        maxWidth: '640px',
      }}
    >
      {/* ── Page heading (matches export page style: 20px/28/600, zinc-800, -0.01em) */}
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
          Records retention
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '20px',
            color: '#6b7280',
          }}
        >
          Set how long your firm&rsquo;s records are kept.
        </p>
      </div>

      {/* ── Retention policy form (client component) ───────────────────────── */}
      <RetentionPolicyForm userRole={role} />
    </div>
  );
}
