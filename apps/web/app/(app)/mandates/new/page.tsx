/**
 * /mandates/new — Mandate create form (wave-8 B-3, C-2 fix).
 *
 * Server component inside the (app) route group; AppShell inherited from layout.
 *
 * Responsibilities:
 *   1. Fine-grained RBAC: assertRole('/mandates/new', me.role) — advisor/admin only.
 *      Analyst is read-only for mandates; redirects to '/' if access denied.
 *   2. SSR-fetch available disclaimer-template jurisdictions (CRITICAL-2 fix).
 *      Calls GET /mandates/jurisdictions — advisor + admin readable (write roles).
 *      Only active templates are surfaced; the jurisdiction dropdown in MandateForm
 *      is populated from this list — so advisors can only pick a derivable jurisdiction,
 *      eliminating derive-no-match 400s.
 *   3. Renders <MandateForm availableJurisdictions={...}> (client component).
 *
 * RBAC note on jurisdiction fetch:
 *   GET /mandates/jurisdictions is gated by MANDATES_WRITE_ROLES (advisor + admin).
 *   Both roles can reach this endpoint — unlike /compliance/disclaimers which was
 *   compliance/admin-only and returned 403 for advisors. This endpoint returns only
 *   the jurisdiction strings (not template bodies), so it is safe to expose to
 *   the create-mandate persona (advisor).
 *
 * On success: MandateForm POSTs to /mandates-data (non-colliding proxy) → API,
 * then redirects to /mandates/:id (the created mandate's detail page).
 */

import { availableJurisdictionsResponseSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../../_lib/assertRole';
import type { AvailableJurisdiction } from '../_components/MandateForm';
import { MandateForm } from '../_components/MandateForm';

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
// Jurisdiction fetch (CRITICAL-2 fix — wave-8 C-2 gap)
//
// Fetches GET /mandates/jurisdictions server-side to discover which jurisdictions
// have an active disclaimer template. This endpoint is gated by MANDATES_WRITE_ROLES
// (advisor + admin) — unlike /compliance/disclaimers which is compliance/admin-only
// and returned 403 for advisors (the primary create-mandate persona).
//
// The endpoint returns only { jurisdiction: string }[] — no template body,
// version, or id — safe to expose to advisors.
//
// Returns empty array on any error (network failure, unexpected response shape, etc.).
// The form renders the empty-state fallback when the array is empty.
// ---------------------------------------------------------------------------

async function fetchAvailableJurisdictions(cookie: string): Promise<AvailableJurisdiction[]> {
  try {
    const res = await fetch(`${apiBase()}/mandates/jurisdictions`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    // Parse with the shared availableJurisdictionsResponseSchema.
    // Returns { jurisdiction: string }[] — transform to { value, label } for the dropdown.
    const parsed = availableJurisdictionsResponseSchema.safeParse(raw);
    if (!parsed.success) return [];
    return parsed.data.map((entry) => ({
      value: entry.jurisdiction,
      label: entry.jurisdiction,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function NewMandatePage() {
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  // advisor/admin only — analyst cannot create mandates (redirects to /).
  assertRole('/mandates/new', me.role);

  // SSR-fetch available disclaimer jurisdictions (CRITICAL-2 fix).
  // Runs in parallel with nothing else here, but is awaited before render.
  const availableJurisdictions = await fetchAvailableJurisdictions(cookieHeader);

  return (
    <div>
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ marginBottom: '20px' }}>
        <ol
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            listStyle: 'none',
            padding: 0,
            margin: 0,
            fontSize: '13px',
          }}
        >
          <li>
            <a href="/mandates" style={{ color: '#6B7280', textDecoration: 'none' }}>
              Mandates
            </a>
          </li>
          <li aria-hidden="true" style={{ color: '#D1D5DB' }}>
            /
          </li>
          <li aria-current="page" style={{ color: '#111827', fontWeight: 500 }}>
            New Mandate
          </li>
        </ol>
      </nav>

      {/* Page heading */}
      <div style={{ marginBottom: '28px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 600,
            color: '#111827',
            letterSpacing: '-0.01em',
            marginBottom: '4px',
          }}
        >
          Create Engagement
        </h1>
        <p style={{ fontSize: '13px', color: '#4B5563' }}>
          Configure seller profile, buyer criteria, and compliance guardrails.
        </p>
      </div>

      {/* Form — client component handles all state and submission.
          availableJurisdictions: SSR-fetched active disclaimer template jurisdictions.
          Empty array → form shows "no compliance jurisdictions configured" state. */}
      <MandateForm availableJurisdictions={availableJurisdictions} />
    </div>
  );
}
