/**
 * /compliance/audit-log — Audit-log integrity view (wave-4, B-3 step 3.1).
 *
 * Server component inside the (app) route group; AppShell chrome is inherited
 * from app/(app)/layout.tsx (no re-implementation here).
 *
 * Responsibilities:
 *   1. Fine-grained RBAC: assertRole('/compliance/audit-log', me.role) —
 *      compliance-only; any other authenticated role is redirected to '/'.
 *   2. Fetches GET /compliance/audit-log/verify (cookie-forwarded, no-store)
 *      following the same pattern as the wave-3 dashboard /auth/me fetch.
 *   3. Renders the integrity view per design/audit-log-export.html
 *      §Integrity Validation + DESIGN-SYSTEM §10 tokens (zinc/emerald).
 *   4. Passes the parsed AuditVerifyResponse to <IntegrityPanel> for the
 *      interactive "verify now" action and persistent status rendering.
 *
 * RBAC note: the (app) layout already guards "is the user authenticated".
 * This page adds the per-route fine-grained check (compliance role only).
 *
 * Fetch pattern: same INTERNAL_API_BASE_URL / NEXT_PUBLIC_API_URL / localhost
 * fallback chain as the layout. Cookie forwarded from next/headers.
 */

import type { AuditVerifyResponse, MeResponse } from '@dealflow/shared';
import { auditVerifyResponseSchema, meResponseSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { assertRole } from '../../_lib/assertRole';
import { IntegrityPanel } from './_components/IntegrityPanel';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base resolution (mirrors the layout pattern exactly)
// ---------------------------------------------------------------------------

function apiBase(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  );
}

// ---------------------------------------------------------------------------
// Cookie header — resolved once per request and shared by both fetches.
// ---------------------------------------------------------------------------

async function cookieHeader(): Promise<string> {
  return (await cookies()).toString();
}

// ---------------------------------------------------------------------------
// Session fetch — re-fetches me to get the role for assertRole.
// The (app) layout already ran this; a second no-store server fetch is
// acceptable for this wave (same cookie-forwarded pattern, not cached).
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
// Verify fetch — GET /compliance/audit-log/verify (cookie-forwarded)
//
// Returns null on any failure (network, 4xx, 5xx, schema mismatch).
// The page renders a degraded state when null rather than throwing.
// ---------------------------------------------------------------------------

async function fetchVerify(cookie: string): Promise<AuditVerifyResponse | null> {
  try {
    const res = await fetch(`${apiBase()}/compliance/audit-log/verify`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = auditVerifyResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function AuditLogPage() {
  const cookie = await cookieHeader();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert compliance-only access — redirects to '/' if denied.
  assertRole('/compliance/audit-log', me.role);

  // 3. Fetch chain integrity from the verify endpoint.
  const verifyResult = await fetchVerify(cookie);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '720px',
      }}
    >
      {/* Page heading */}
      <div>
        <h2
          style={{
            margin: '0 0 4px',
            fontSize: '20px',
            fontWeight: 600,
            lineHeight: '28px',
            color: '#1f2937',
          }}
        >
          Audit Log Integrity
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '20px',
            color: '#6b7280',
          }}
        >
          HMAC-SHA256 hash-chain verification — Required by FINRA profile. Each entry is
          cryptographically linked to the previous; any modification to a historical record is
          immediately detectable.
        </p>
      </div>

      {/* Integrity panel — client component for verify-now action */}
      <IntegrityPanel initialResult={verifyResult} />
    </div>
  );
}
