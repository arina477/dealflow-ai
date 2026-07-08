/**
 * /compliance/audit-log — Audit-log integrity + recordkeeping export view
 * (wave-4 B-3 step 3.1 + wave-13 B-3 extension + wave-29 B-3 deal-activity scope).
 *
 * Server component inside the (app) route group; AppShell chrome is inherited
 * from app/(app)/layout.tsx.
 *
 * Wave-4 responsibilities (unchanged):
 *   1. Fine-grained RBAC via assertRole('/compliance/audit-log', me.role).
 *      Wave-13 expanded RBAC: compliance + admin + advisor (shared rbac.ts).
 *   2. SSR-fetches GET /compliance/audit-log/verify (cookie-forwarded, no-store).
 *   3. Renders IntegrityPanel (full panel) + IntegrityBadge (compact header pill).
 *
 * Wave-13 extensions:
 *   4. SSR-fetches GET /compliance/audit-log (initial 50 entries, timestamp DESC)
 *      for SSR-hydration of AuditLogTable. Passes initialEntries to the client.
 *   5. Renders AuditLogTable (filterable/paginated, read-only, NO edit/delete/AI).
 *      Client filter/paginate refetches via /compliance/audit-log-data proxy.
 *   6. Renders ExportPanel — compliance/admin only (returns null for advisor).
 *      Export calls POST /compliance/audit-log-data/export via apiFetch + rid.
 *   7. Deep-link support: ?mandate_id, ?from, ?to forwarded to table + export panel.
 *      (?campaign_id/?mode=export deferred — MVP.)
 *
 * Wave-29 extension:
 *   8. SSR-fetches GET /compliance/records/deal-activity (initial 25 rows) for
 *      SSR-hydration of DealActivityTable — compliance/admin only (advisor: []).
 *   9. Renders RecordsPanel with scope toggle (Audit log | Deal activity).
 *      "Deal activity" tab/scope is gated to compliance/admin (canSeeDealActivity).
 *      Advisor sees only the "Audit log" tab (no deal-activity tab, no fetch result).
 *
 * Fetch pattern: same INTERNAL_API_BASE_URL / NEXT_PUBLIC_API_URL / localhost
 * fallback chain as the layout. Cookie forwarded from next/headers.
 *
 * VERIFY ROUTE RECONCILIATION (wave-4 vs wave-13):
 *   The existing AuditLogController (wave-4 ComplianceModule) also exposes
 *   GET /compliance/audit-log/verify. RecordkeepingController (wave-13) adds
 *   the same route (both delegate to AuditVerifier.verifyChain). Since
 *   ComplianceModule is registered before RecordkeepingModule in AppModule, the
 *   AuditLogController handler takes priority in production. Both return the
 *   identical real shape: {ok, entriesChecked, firstBreakAt?, reason?}.
 *   This page SSR-fetches /compliance/audit-log/verify once and passes the
 *   real shape to both IntegrityBadge and IntegrityPanel. No conflict.
 *
 * HARD BOUNDARY: no edit/delete affordance; no send/email/AI; read-only over
 * the immutable hash-chain and deal-activity browse.
 */

import type {
  AuditLogEntryRead,
  AuditVerifyResponse,
  DealActivityRow,
  MeResponse,
  Role,
} from '@dealflow/shared';
import {
  auditLogEntryReadSchema,
  auditVerifyResponseSchema,
  dealActivityBrowseResponseSchema,
  meResponseSchema,
} from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../../_lib/assertRole';
import { ExportPanel } from './_components/ExportPanel';
import { IntegrityBadge } from './_components/IntegrityBadge';
import { IntegrityPanel } from './_components/IntegrityPanel';
import { RecordsPanel } from './_components/RecordsPanel';

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
// Cookie header — resolved once per request and shared by all fetches.
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
// Verify fetch — GET /compliance/audit-log/verify (cookie-forwarded)
//
// Returns null on any failure (network, 4xx, 5xx, schema mismatch).
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
// Audit log entries fetch — GET /compliance/audit-log (SSR-hydration)
//
// Returns the first page (up to 50 entries) for SSR-hydration of AuditLogTable.
// Returns [] on any failure — the client will re-fetch on filter change.
//
// Query params forwarded from the page URL (deep-link support):
//   mandateId, from, to — pre-populate the filter on initial render.
// ---------------------------------------------------------------------------

async function fetchInitialEntries(
  cookie: string,
  params: { mandateId?: string | undefined; from?: string | undefined; to?: string | undefined }
): Promise<AuditLogEntryRead[]> {
  try {
    const qs = new URLSearchParams({ limit: '50', offset: '0' });
    if (params.mandateId) qs.set('mandateId', params.mandateId);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);

    const res = await fetch(`${apiBase()}/compliance/audit-log?${qs.toString()}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    const parsed = z.array(auditLogEntryReadSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Deal-activity browse fetch — GET /compliance/records/deal-activity
//
// compliance/admin only: returns { rows: [], total: 0 } for advisor (caller
// skips the fetch entirely when role is 'advisor').
// Returns { rows: [], total: 0 } on any failure.
// ---------------------------------------------------------------------------

async function fetchInitialDealActivity(
  cookie: string,
  params: { mandateId?: string | undefined; from?: string | undefined; to?: string | undefined }
): Promise<{ rows: DealActivityRow[]; total: number }> {
  try {
    const qs = new URLSearchParams({ limit: '25', offset: '0' });
    if (params.mandateId) qs.set('mandateId', params.mandateId);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);

    const res = await fetch(`${apiBase()}/compliance/records/deal-activity?${qs.toString()}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return { rows: [], total: 0 };
    const raw: unknown = await res.json();
    const parsed = dealActivityBrowseResponseSchema.safeParse(raw);
    return parsed.success
      ? { rows: parsed.data.rows, total: parsed.data.total }
      : { rows: [], total: 0 };
  } catch {
    return { rows: [], total: 0 };
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface AuditLogPageProps {
  searchParams?: Promise<{ mandate_id?: string; from?: string; to?: string }>;
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const cookie = await cookieHeader();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert route access — compliance + admin + advisor (wave-13 RBAC).
  //    assertRole reads canAccess from shared roleRoutes (wave-13 expanded).
  assertRole('/compliance/audit-log', me.role);

  const role = me.role as Role;

  // 3. Resolve deep-link params (all optional).
  const sp = searchParams ? await searchParams : {};
  const mandateId = sp.mandate_id;
  const from = sp.from;
  const to = sp.to;

  // 4. RBAC: deal-activity tab visible to compliance/admin only (advisor excluded).
  //    This matches GET /compliance/records/deal-activity allowedRoles in rbac.ts.
  const canSeeDealActivity = role === 'compliance' || role === 'admin';

  // 5. Parallel fetches: verify chain + initial entries + deal-activity (if allowed).
  //    All are no-store (compliance requires fresh data on every request).
  //    Deal-activity fetch is skipped entirely for advisor (no 403 risk; avoids
  //    a redundant network call the role cannot use).
  const [verifyResult, initialEntries, initialDealActivity] = await Promise.all([
    fetchVerify(cookie),
    fetchInitialEntries(cookie, { mandateId, from, to }),
    canSeeDealActivity
      ? fetchInitialDealActivity(cookie, { mandateId, from, to })
      : Promise.resolve({ rows: [], total: 0 }),
  ]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '900px',
      }}
    >
      {/* ── Page heading + integrity badge ───────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
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
            Audit Log &amp; Recordkeeping
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '20px',
              color: '#6b7280',
            }}
          >
            HMAC-SHA256 hash-chain · FINRA profile · Read-only immutable log
          </p>
        </div>

        {/* Top-right integrity status badge — bound to the verify endpoint */}
        <IntegrityBadge result={verifyResult} />
      </div>

      {/* ── Scope toggle + filterable/paginated records table ────────────── */}
      {/* RecordsPanel owns the active scope state (Audit log | Deal activity). */}
      {/* Deal-activity tab is gated to compliance/admin (canSeeDealActivity).   */}
      <RecordsPanel
        initialEntries={initialEntries}
        initialDealRows={initialDealActivity.rows}
        initialDealTotal={initialDealActivity.total}
        canSeeDealActivity={canSeeDealActivity}
        {...(from !== undefined && { initialFrom: from })}
        {...(to !== undefined && { initialTo: to })}
        {...(mandateId !== undefined && { initialMandateId: mandateId })}
      />

      {/* ── Integrity panel — full panel with verify-now action ──────────── */}
      <IntegrityPanel initialResult={verifyResult} />

      {/* ── Export panel — compliance/admin only (null for advisor) ─────── */}
      <ExportPanel
        userRole={role}
        {...(mandateId !== undefined && { initialMandateId: mandateId })}
        {...(from !== undefined && { initialFrom: from })}
        {...(to !== undefined && { initialTo: to })}
      />
    </div>
  );
}
