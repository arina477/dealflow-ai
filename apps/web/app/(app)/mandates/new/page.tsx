/**
 * /mandates/new — Mandate create form (wave-8 B-3).
 *
 * Server component inside the (app) route group; AppShell inherited from layout.
 *
 * Responsibilities:
 *   1. Fine-grained RBAC: assertRole('/mandates/new', me.role) — advisor/admin only.
 *      Analyst is read-only for mandates; redirects to '/' if access denied.
 *   2. Renders <MandateForm> (client component) — the three-section create form.
 *
 * No SSR data fetch — this is a create form, not a pre-populated edit.
 * All form state and submission logic lives in the MandateForm client component.
 * On success, MandateForm redirects to /mandates/:id (the created mandate).
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../../_lib/assertRole';
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
// Page
// ---------------------------------------------------------------------------

export default async function NewMandatePage() {
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  // advisor/admin only — analyst cannot create mandates (redirects to /).
  assertRole('/mandates/new', me.role);

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

      {/* Form — client component handles all state and submission */}
      <MandateForm />
    </div>
  );
}
