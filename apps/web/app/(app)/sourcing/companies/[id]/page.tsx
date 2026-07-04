/**
 * /sourcing/companies/:id — company detail page (standalone route).
 *
 * Provides a deep-linkable URL for a specific company. Renders the same
 * CompanyDetail component as the inline pane on the list view, so users
 * can share a link directly to a company record.
 *
 * RBAC: analyst-only (assertRole mirrors the list page).
 * SSR fetches the company name/domain from GET /sourcing/companies/:id
 * for the page heading; the full detail renders client-side via CompanyDetail.
 */

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

const companyBasicSchema = z.object({
  company: z.object({
    id: z.string().uuid(),
    name: z.string(),
    domain: z.string().optional().nullable(),
  }),
});

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

async function fetchCompanyBasic(id: string, cookie: string) {
  try {
    const res = await fetch(`${apiBase()}/sourcing/companies/${id}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = companyBasicSchema.safeParse(raw);
    return parsed.success ? parsed.data.company : null;
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

  const company = await fetchCompanyBasic(id, cookieHeader);
  // If not found, redirect back to the list
  if (!company) redirect('/sourcing/companies');

  return (
    <div style={{ padding: '0', margin: '-24px -32px' }}>
      <CompanyDetail
        companyId={id}
        companyName={company.name}
        {...(company.domain != null ? { companyDomain: company.domain } : {})}
      />
    </div>
  );
}
