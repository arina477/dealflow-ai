/**
 * /compliance/oversight — Compliance gate-outcome oversight surface (wave-14 B-3, task f5074df8).
 *
 * DISTINCT from:
 *   - /compliance-queue (wave-11 B-3): template VERSION approval workflow
 *     (approve/reject pending template versions — a write surface with SoD
 *     mutations). This page does NOT duplicate or replace that flow.
 *   - /compliance/queue: reserved for F10 approvals (not yet built).
 *
 * THIS PAGE is a READ-ONLY monitoring view for compliance/admin showing each
 * outreach record with its gate verdict outcome, template version, SoD/approver
 * status, and mandate reference. No edit, delete, approve, send, or AI
 * affordance — pure oversight.
 *
 * Data source: GET /outreach — the existing outreach list endpoint (advisor,
 * compliance). Returns { outreach: OutreachRow[] } with gate_verdict, status,
 * mandateId, templateVersionId, createdBy, createdAt. B-2 did NOT add a
 * dedicated /compliance/oversight endpoint — this page reuses GET /outreach
 * (confirmed from outreach.controller.ts: listOutreach returns the full shape
 * with gate_verdict + status).
 *
 * SSR-hydration pattern:
 *   Server component SSR-fetches GET /outreach via apiBase() (internal URL,
 *   no page-route collision). Results passed as initialRecords to
 *   ComplianceOversightTable, which renders from that prop and does NOT issue
 *   any client fetch to /compliance/oversight. Client refresh (optional) goes
 *   through /compliance/oversight-data proxy (non-page-colliding, defined in
 *   next.config.ts → proxied to GET /outreach on the API).
 *
 * RBAC: compliance + admin ONLY. Advisor is blocked (assertRole redirects to /).
 *   Sourced from '/compliance/oversight' in the shared roleRoutes matrix (wave-14
 *   B-1 addition). Fail-closed: if the route is missing from roleRoutes,
 *   assertRole redirects advisor/analyst to '/'.
 *
 * apiFetch: SSR page fetches are server-side GET-only and forward the session
 *   cookie directly — they do NOT use apiFetch (client-only helper). The rid
 *   anti-CSRF header is unnecessary for GET. See ExportPanel.tsx for the
 *   client-fetch pattern using apiFetch + rid.
 *
 * Design references: design/audit-log-export.html + design/compliance-queue.html
 *
 * HARD BOUNDARY:
 *   NO edit/delete/approve affordance on this page.
 *   NO actual email send — no Anthropic/LLM import — no transactional-email SDK.
 *   READ-ONLY over outreach records + gate verdicts.
 *   If a compliance reviewer needs to approve a template version, link to
 *   /compliance-queue (the version-approval workflow).
 */

import type { Outreach, Role } from '@dealflow/shared';
import { outreachSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../../_lib/assertRole';
import { ComplianceOversightTable } from './_components/ComplianceOversightTable';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base resolution
// ---------------------------------------------------------------------------

function apiBase(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  );
}

// ---------------------------------------------------------------------------
// Session fetch
// ---------------------------------------------------------------------------

const meSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.enum(['advisor', 'analyst', 'compliance', 'admin']),
});

type MeShape = z.infer<typeof meSchema>;

async function fetchMe(cookie: string): Promise<MeShape | null> {
  try {
    const res = await fetch(`${apiBase()}/auth/me`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = meSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Outreach records fetch — GET /outreach (SSR-hydration)
//
// Returns the outreach list (optionally filtered by mandateId from the
// deep-link ?mandate_id param). The GET /outreach endpoint returns:
//   { outreach: OutreachRow[] }
// each row contains: id, mandateId, matchCandidateId, templateVersionId,
//   gateVerdict, status, createdBy, createdAt.
//
// Returns [] on any failure — the client refresh can re-fetch.
// ---------------------------------------------------------------------------

async function fetchOutreachRecords(
  cookie: string,
  mandateId?: string | undefined
): Promise<Outreach[]> {
  try {
    const qs = new URLSearchParams();
    if (mandateId) qs.set('mandateId', mandateId);
    const url = `${apiBase()}/outreach${qs.toString() ? `?${qs.toString()}` : ''}`;

    const res = await fetch(url, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];

    const raw: unknown = await res.json();
    // Response shape: { outreach: OutreachRow[] }
    const listSchema = z.object({ outreach: z.array(outreachSchema) });
    const parsed = listSchema.safeParse(raw);
    return parsed.success ? parsed.data.outreach : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

interface OversightPageProps {
  searchParams?: Promise<{ mandate_id?: string }>;
}

export default async function ComplianceOversightPage({ searchParams }: OversightPageProps) {
  const cookieHeader = (await cookies()).toString();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  // 2. Assert route access — compliance + admin ONLY (advisor → redirect to '/').
  //    Reads from shared roleRoutes matrix (wave-14 B-1: '/compliance/oversight'
  //    added with allowedRoles: ['compliance', 'admin']).
  assertRole('/compliance/oversight', me.role as Role);

  // 3. Resolve deep-link mandate filter.
  const sp = searchParams ? await searchParams : {};
  const mandateId = sp.mandate_id;

  // 4. SSR-fetch outreach records (GET /outreach via apiBase — no page-route collision).
  const initialRecords = await fetchOutreachRecords(cookieHeader, mandateId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '1100px',
      }}
    >
      {/* ── Page heading ─────────────────────────────────────────────────── */}
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
            Compliance Oversight
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: '14px',
              lineHeight: '20px',
              color: '#6b7280',
            }}
          >
            Gate-outcome monitoring over outreach records · Read-only · compliance + admin
          </p>
        </div>

        {/* Link to the version-approval workflow (distinct from oversight) */}
        <a
          href="/compliance-queue"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            fontSize: '13px',
            fontWeight: 500,
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            backgroundColor: '#f9fafb',
            color: '#374151',
            textDecoration: 'none',
          }}
          aria-label="Go to template version approval queue"
        >
          Template approval queue →
        </a>
      </div>

      {/* ── Description panel ────────────────────────────────────────────── */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#166534',
          lineHeight: '20px',
        }}
      >
        <strong>What this page shows:</strong> Each outreach record and its gate decision
        (send_eligible or blocked), the template version used, SoD/approver status derived from the
        gate verdict, and the mandate it belongs to. This is a first-class monitoring view for
        compliance — not an approval workflow. To approve template versions, use the{' '}
        <a href="/compliance-queue" style={{ color: '#166534', fontWeight: 600 }}>
          template approval queue
        </a>
        .
      </div>

      {/* ── Oversight table (SSR-hydrated) ────────────────────────────────── */}
      <ComplianceOversightTable
        initialRecords={initialRecords}
        {...(mandateId !== undefined && { initialMandateId: mandateId })}
      />
    </div>
  );
}
