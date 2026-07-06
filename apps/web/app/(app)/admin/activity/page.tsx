/**
 * /admin/activity — Admin activity log page (wave-16, task 8bb0a22f).
 *
 * SSR-hydrates GET /admin/activity-data (cookie-forwarded, no-store).
 * Client filter/pagination goes through /admin/activity-data proxy
 * (non-page-colliding — see next.config.ts afterFiles rewrites).
 *
 * RBAC: admin-only. assertRole('/admin/activity', me.role).
 * Non-admin (advisor/analyst/compliance) → redirect('/') via assertRole.
 *
 * SECURITY INVARIANT (P-4 Finding 3 — load-bearing):
 *   - Admin-only: advisor 403 / anon 401 — enforced server-side HERE.
 *   - Read-only-immutable: opening this page writes ZERO audit log rows.
 *   - Columns: actor/target/action/timestamp ONLY — no hash, credential, PII
 *     beyond actor+target display identity, no sequenceNumber in the UI.
 *
 * Data source: GET /admin/activity-data → B-2 AdminActivityController
 * (reuses the existing audit.repository read path; does NOT fork a second
 * audit reader). Filtered to the 7 wave-15/16 admin actions; newest-first.
 *
 * Fetch pattern: same INTERNAL_API_BASE_URL / NEXT_PUBLIC_API_URL / localhost
 * fallback chain as the other admin pages. Cookie forwarded from next/headers.
 *
 * @see packages/shared/src/admin-activity.ts  (B-1 row shape + query schema)
 * @see apps/web/app/(app)/compliance/audit-log/page.tsx  (mirrored pattern)
 */

import type { AdminActivityResponse, MeResponse, Role } from '@dealflow/shared';
import { adminActivityResponseSchema, meResponseSchema } from '@dealflow/shared';
// Note: explicit React import needed for the test environment JSX transform.
// Next.js uses the automatic JSX runtime in production; the test environment's
// esbuild transform uses jsx:'automatic' but the import is still needed here
// because vitest resolves this file in the same transform pass as page-colliding
// modules that reference React explicitly.
import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { assertRole } from '../../_lib/assertRole';
import { ActivityTable } from './_components/ActivityTable';

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
// Cookie header
// ---------------------------------------------------------------------------

async function cookieHeader(): Promise<string> {
  return (await cookies()).toString();
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
// Activity fetch — GET /admin/activity-data (SSR-hydration, first page)
//
// Returns null on any failure — the client will re-fetch on filter change.
// Passes limit=50 for the first page. No cursor = newest-first start.
// ---------------------------------------------------------------------------

async function fetchInitialActivity(cookie: string): Promise<AdminActivityResponse | null> {
  try {
    const res = await fetch(`${apiBase()}/admin/activity-data?limit=50`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = adminActivityResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function AdminActivityPage() {
  const cookie = await cookieHeader();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert admin-only — advisor/analyst/compliance → redirect('/').
  assertRole('/admin/activity', me.role as Role);

  // 3. SSR-fetch first page of activity.
  const initial = await fetchInitialActivity(cookie);
  const initialRows = initial?.rows ?? [];
  const initialNextCursor = initial?.nextCursor ?? null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1000px',
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
          Admin Activity
        </h1>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#6b7280' }}>
          Read-only log of administrative actions — newest first. No write access.
        </p>
      </div>

      {/* Activity table — filterable, cursor-paginated, read-only */}
      <ActivityTable initialRows={initialRows} initialNextCursor={initialNextCursor} />
    </div>
  );
}
