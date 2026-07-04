/**
 * /sourcing/companies/:id — company detail page (standalone route).
 *
 * Provides a deep-linkable URL for a specific company. Renders the same
 * CompanyDetail component as the inline pane on the list view, so users
 * can share a link directly to a company record.
 *
 * RBAC: analyst-only (assertRole mirrors the list page).
 *
 * SSR-hydration (wave-7 page-route-collision fix):
 *   Previously the page SSR-fetched only basic company info (name/domain) and
 *   let CompanyDetail client-fetch the full detail from /sourcing/companies/:id.
 *   That client fetch collided with the Next.js page route at the same path —
 *   the browser received page HTML instead of API JSON, causing "Network error".
 *
 *   Fix: this page now SSR-fetches the FULL detail (contacts + provenance +
 *   pendingCandidates) from GET /sourcing/companies/:id server-side (where
 *   apiBase() resolves to the internal API, never to Next.js) and passes it as
 *   the `initialDetail` prop to CompanyDetail. CompanyDetail skips its client
 *   fetch entirely when initialDetail is provided, eliminating the collision.
 */

import {
  companyProvenanceSchema,
  companySchema,
  contactSchema,
  dedupeCandidateSchema,
} from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../../../_lib/assertRole';
import { CompanyDetail } from '../_components/CompanyDetail';

export const dynamic = 'force-dynamic';

function apiBase(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  );
}

const meSchema = z.object({
  userId: z.string(),
  email: z.string(),
  role: z.enum(['advisor', 'analyst', 'compliance', 'admin']),
});

/**
 * Full detail response schema — matches CompanyDetail's detailResponseSchema
 * so the SSR-fetched data is type-compatible with the initialDetail prop.
 */
const companyDetailResponseSchema = z.object({
  company: companySchema,
  contacts: z.array(contactSchema),
  provenance: z.array(companyProvenanceSchema),
  pendingCandidates: z.array(dedupeCandidateSchema),
});

type CompanyDetailResponse = z.infer<typeof companyDetailResponseSchema>;

async function fetchMe(cookie: string) {
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

/**
 * SSR-fetch the FULL company detail from GET /sourcing/companies/:id.
 *
 * Uses apiBase() (internal API URL, never a Next.js page route) so there
 * is no page-route collision. Returns null on any error; the caller redirects
 * back to the list page when null.
 */
async function fetchCompanyDetail(
  id: string,
  cookie: string
): Promise<CompanyDetailResponse | null> {
  try {
    const res = await fetch(`${apiBase()}/sourcing/companies/${id}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = companyDetailResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  assertRole('/sourcing/companies/:id', me.role);

  // SSR-fetch the full detail. This runs server-side against apiBase() (the
  // internal API), so it never collides with the Next.js page route.
  const detail = await fetchCompanyDetail(id, cookieHeader);
  // If not found (404) or parse error, redirect back to the list.
  if (!detail) redirect('/sourcing/companies');

  const { company } = detail;

  return (
    <div style={{ padding: '0', margin: '-24px -32px' }}>
      {/*
       * initialDetail passes the SSR-fetched full detail to CompanyDetail.
       * CompanyDetail will render directly from this prop and SKIP its client
       * fetch, so no browser request ever goes to /sourcing/companies/:id
       * (the page route) from this component on the detail page.
       */}
      <CompanyDetail
        companyId={id}
        companyName={company.name}
        {...(company.domain != null ? { companyDomain: company.domain } : {})}
        initialDetail={detail}
      />
    </div>
  );
}
