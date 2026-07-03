/**
 * /compliance/settings — Compliance Rules Engine settings page (wave-5, B-3).
 *
 * Server component inside the (app) route group; AppShell chrome is inherited
 * from app/(app)/layout.tsx (not re-implemented here).
 *
 * Responsibilities:
 *   1. Fine-grained RBAC: assertRole('/compliance/settings', me.role) —
 *      compliance-only; any other authenticated role is redirected to '/'.
 *   2. SSR-fetches the current rules/suppression/disclaimers data from the
 *      API (GET /compliance/{rules,suppression,disclaimers}), cookie-forwarded,
 *      no-store — consistent with the wave-4 audit-log page pattern.
 *   3. Renders the 3 sections per design/compliance-settings.html:
 *        - Approval & Gating Policy (compliance_rules)
 *        - Suppression Matrix (suppression_list)
 *        - Jurisdiction Templates (disclaimer_templates)
 *   4. Each section is a client component that handles its own CRUD mutations
 *      via same-origin fetch (first-party cookie, afterFiles rewrite proxy).
 *
 * Design: DESIGN-SYSTEM §10 (zinc/emerald, 4px grid, lucide-react, AppShell
 * chrome inherited). Build to design/compliance-settings.html.
 *
 * RBAC note: the (app) layout guards "is the user authenticated". This page
 * adds the per-route fine-grained check (compliance role only, per rbac.ts
 * `/compliance/settings` → allowedRoles: ['compliance']).
 * The CRUD API endpoints (/compliance/rules etc.) are compliance/admin per
 * rbac.ts — that asymmetry is intentional per the plan (admin manages config;
 * only compliance has the settings PAGE).
 *
 * Fetch pattern: INTERNAL_API_BASE_URL / NEXT_PUBLIC_API_URL / localhost:3001
 * fallback chain — mirrors the audit-log page exactly. Cookie forwarded via
 * next/headers.
 */

import type {
  ComplianceRule,
  DisclaimerTemplate,
  MeResponse,
  SuppressionEntry,
} from '@dealflow/shared';
import {
  complianceRuleSchema,
  disclaimerTemplateSchema,
  meResponseSchema,
  suppressionEntrySchema,
} from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../../_lib/assertRole';
import { ApprovalGatingSection } from './_components/ApprovalGatingSection';
import { JurisdictionTemplatesSection } from './_components/JurisdictionTemplatesSection';
import { SuppressionMatrixSection } from './_components/SuppressionMatrixSection';

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
// Cookie header helper
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
// Rules fetch — GET /compliance/rules
// ---------------------------------------------------------------------------

async function fetchRules(cookie: string): Promise<ComplianceRule[]> {
  try {
    const res = await fetch(`${apiBase()}/compliance/rules`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    const parsed = z.array(complianceRuleSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Suppression fetch — GET /compliance/suppression
// ---------------------------------------------------------------------------

async function fetchSuppression(cookie: string): Promise<SuppressionEntry[]> {
  try {
    const res = await fetch(`${apiBase()}/compliance/suppression`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    const parsed = z.array(suppressionEntrySchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Disclaimers fetch — GET /compliance/disclaimers
// ---------------------------------------------------------------------------

async function fetchDisclaimers(cookie: string): Promise<DisclaimerTemplate[]> {
  try {
    const res = await fetch(`${apiBase()}/compliance/disclaimers`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    const parsed = z.array(disclaimerTemplateSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function ComplianceSettingsPage() {
  const cookie = await cookieHeader();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert compliance-only access — redirects to '/' if denied.
  assertRole('/compliance/settings', me.role);

  // 3. Parallel SSR data fetch for all 3 sections.
  const [rules, suppressionEntries, disclaimers] = await Promise.all([
    fetchRules(cookie),
    fetchSuppression(cookie),
    fetchDisclaimers(cookie),
  ]);

  // 4. Render the three sections.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '32px',
        maxWidth: '1200px',
      }}
    >
      {/* Page heading — matches design/compliance-settings.html title block */}
      <div>
        <h2
          style={{
            margin: '0 0 4px',
            fontSize: '22px',
            fontWeight: 600,
            lineHeight: '28px',
            letterSpacing: '-0.01em',
            color: '#111827',
          }}
        >
          Compliance Rules Engine
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '20px',
            color: '#6b7280',
            maxWidth: '640px',
          }}
        >
          Manage suppression logic, jurisdictional disclaimers, and send-time approval policies.
          Changes take effect on the next network cycle.
        </p>
      </div>

      {/* Section 1: Approval & Gating Policy */}
      <ApprovalGatingSection initialRules={rules} />

      {/* Sections 2 + 3: Suppression Matrix + Jurisdiction Templates (bento grid) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Section 2: Suppression Matrix */}
        <div style={{ gridColumn: 'span 2' }}>
          <SuppressionMatrixSection initialEntries={suppressionEntries} />
        </div>

        {/* Section 3: Jurisdiction Templates */}
        <div>
          <JurisdictionTemplatesSection initialTemplates={disclaimers} />
        </div>
      </div>
    </div>
  );
}
