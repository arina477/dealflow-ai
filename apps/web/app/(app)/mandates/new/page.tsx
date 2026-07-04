/**
 * /mandates/new — Mandate create form (wave-8 B-3, C-2 fix).
 *
 * Server component inside the (app) route group; AppShell inherited from layout.
 *
 * Responsibilities:
 *   1. Fine-grained RBAC: assertRole('/mandates/new', me.role) — advisor/admin only.
 *      Analyst is read-only for mandates; redirects to '/' if access denied.
 *   2. SSR-fetch available disclaimer-template jurisdictions (CRITICAL-2 fix).
 *      Only active templates are surfaced; the jurisdiction dropdown in MandateForm
 *      is populated from this list — so advisors can only pick a derivable jurisdiction,
 *      eliminating derive-no-match 400s.
 *   3. Renders <MandateForm availableJurisdictions={...}> (client component).
 *
 * RBAC note on disclaimer fetch:
 *   GET /compliance/disclaimers is compliance/admin-only. When called with an
 *   advisor session cookie the API returns 403, which is caught → empty array → the
 *   form shows "no compliance jurisdictions configured" (empty-state per spec). Admin
 *   sessions can reach the endpoint and get the real list. This is the correct
 *   behaviour: an advisor can only create mandates once an admin has configured
 *   disclaimer templates and an admin-scoped session is used for the new-mandate flow.
 *
 * On success: MandateForm POSTs to /mandates-data (non-colliding proxy) → API,
 * then redirects to /mandates/:id (the created mandate's detail page).
 */

import type { DisclaimerTemplate } from '@dealflow/shared';
import { disclaimerTemplateSchema } from '@dealflow/shared';
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
// Disclaimer jurisdictions fetch (CRITICAL-2 fix)
//
// Fetches GET /compliance/disclaimers server-side to discover which jurisdictions
// have an active disclaimer template. Only active rows are surfaced as selectable
// options in MandateForm — prevents derive-no-match 400s on create.
//
// Returns empty array on any error (403 for non-admin roles, network failure, etc.).
// The form renders the empty-state fallback when the array is empty.
// ---------------------------------------------------------------------------

const disclaimerListSchema = z.array(disclaimerTemplateSchema);

async function fetchAvailableJurisdictions(cookie: string): Promise<AvailableJurisdiction[]> {
  try {
    const res = await fetch(`${apiBase()}/compliance/disclaimers`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    // The API returns DisclaimerTemplate[] (list, not wrapped object)
    const parsed = disclaimerListSchema.safeParse(raw);
    if (!parsed.success) return [];
    // Filter to only active templates and deduplicate by jurisdiction
    // (only one active row per jurisdiction by DB constraint, but filter defensively).
    const seen = new Set<string>();
    const available: AvailableJurisdiction[] = [];
    for (const template of parsed.data as DisclaimerTemplate[]) {
      if (template.active && !seen.has(template.jurisdiction)) {
        seen.add(template.jurisdiction);
        // Use the API's jurisdiction value as both the option value and display label.
        // The value MUST match exactly what the API expects for derive-match.
        available.push({ value: template.jurisdiction, label: template.jurisdiction });
      }
    }
    return available;
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
