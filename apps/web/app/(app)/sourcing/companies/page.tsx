/**
 * /sourcing/companies — Companies & Contacts master data screen (wave-6, B-3).
 *
 * Server component inside the (app) route group; AppShell chrome is inherited
 * from app/(app)/layout.tsx.
 *
 * Responsibilities:
 *   1. Fine-grained RBAC: assertRole('/sourcing/companies', me.role) —
 *      analyst-only; any other role is redirected to '/'.
 *   2. SSR-fetches the companies list from GET /sourcing/companies,
 *      cookie-forwarded, no-store — consistent with the wave-5 settings page.
 *   3. Renders the companies list + filter bar per design/companies-contacts.html.
 *   4. Client components handle filter interaction + dedupe-candidate resolve.
 *
 * Design: DESIGN-SYSTEM §10 (zinc/emerald, AppShell chrome inherited, lucide).
 * Build to design/companies-contacts.html.
 *
 * RBAC: analyst sees the screen. Non-analyst authenticated roles are redirected
 * to '/'. Unauthenticated → /login via the (app) layout guard.
 *
 * NO manual-create: the +add buttons in design/companies-contacts.html are
 * out of scope (wave-6 plan P-4 addendum — view/filter/clean only). Stubbed.
 *
 * Same-origin proxy: client-side fetches hit /sourcing/companies,
 * /sourcing/dedupe-candidates/:id/resolve via afterFiles rewrites in
 * next.config.ts (page wins over the data API path — afterFiles ensures the
 * React page is served, and client GET calls proxy to the API).
 */

import type { Company, CompanyProvenance, DedupeCandidate } from '@dealflow/shared';
import { companySchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../../_lib/assertRole';
import { CompaniesClient } from './_components/CompaniesClient';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base resolution — mirrors compliance/settings pattern exactly
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
// ---------------------------------------------------------------------------

interface MeShape {
  userId: string;
  email: string;
  role: 'advisor' | 'analyst' | 'compliance' | 'admin';
}

const meSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.enum(['advisor', 'analyst', 'compliance', 'admin']),
});

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
// Companies list fetch — GET /sourcing/companies
// ---------------------------------------------------------------------------

const companiesResponseSchema = z.object({
  companies: z.array(companySchema),
});

export interface CompanyWithMeta extends Company {
  contactCount: number;
  sourceCount: number;
  hasPendingCandidates: boolean;
}

const companyWithMetaSchema = companySchema.extend({
  contactCount: z.number().int().nonnegative().optional().default(0),
  sourceCount: z.number().int().nonnegative().optional().default(0),
  hasPendingCandidates: z.boolean().optional().default(false),
});

const companiesWithMetaResponseSchema = z.object({
  companies: z.array(companyWithMetaSchema),
});

async function fetchCompanies(cookie: string): Promise<CompanyWithMeta[]> {
  try {
    const res = await fetch(`${apiBase()}/sourcing/companies`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    // Try the richer shape first (with meta fields), fall back to plain
    const withMeta = companiesWithMetaResponseSchema.safeParse(raw);
    if (withMeta.success) return withMeta.data.companies;
    const plain = companiesResponseSchema.safeParse(raw);
    if (plain.success) {
      return plain.data.companies.map((c) => ({
        ...c,
        contactCount: 0,
        sourceCount: 0,
        hasPendingCandidates: false,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function CompaniesPage() {
  const cookie = await cookieHeader();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert analyst-only access — redirects to '/' if denied.
  assertRole('/sourcing/companies', me.role);

  // 3. SSR data fetch.
  const companies = await fetchCompanies(cookie);

  // 4. Render the client-interactive companies list.
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
        height: 'calc(100vh - 57px)',
        margin: '-24px -32px',
        overflow: 'hidden',
      }}
    >
      <CompaniesClient initialCompanies={companies} />
    </div>
  );
}

export type { Company, CompanyProvenance, DedupeCandidate };
