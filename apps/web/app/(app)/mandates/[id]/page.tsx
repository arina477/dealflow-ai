/**
 * /mandates/:id — Mandate detail page (wave-8 B-3).
 *
 * SSR-hydration (wave-7 pattern — page-route-collision fix):
 *   This page SSR-fetches the FULL mandate detail (mandate + buyerCriteria +
 *   complianceProfile) from GET /mandates/:id server-side, using apiBase()
 *   which resolves to the internal API (never to the Next.js page route itself).
 *   The full detail is passed as `initialDetail` prop to MandateDetailClient,
 *   which renders directly from the prop and does NOT issue any client fetch
 *   to /mandates/:id (the page route). This eliminates the page-route collision
 *   that would cause a 500 or HTML response on the client.
 *
 * RBAC: advisor/admin/analyst may view. Advisor/admin see edit controls.
 *       Analyst is read-only (no configure button).
 *
 * 404: if the API returns !ok (incl. 404), we render a not-found state.
 *      We do NOT redirect — the user should see a clear error on the detail URL.
 *
 * read-schema: mandateDetailSchema uses z.string() timestamps (NOT .datetime())
 * per wave-7 PG-wire lesson.
 */

import type { MandateDetail, Role } from '@dealflow/shared';
import { mandateDetailSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../../_lib/assertRole';
import { MandateDetailClient } from '../_components/MandateDetailClient';

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
// Mandate detail fetch (SSR — internal API, no page-route collision)
// ---------------------------------------------------------------------------

/**
 * Fetches GET /mandates/:id from the internal API server-side.
 *
 * Uses apiBase() (resolved to the internal API URL, not the same-origin Next.js
 * path) so there is no page-route collision — the browser will never fetch
 * /mandates/:id as the client data path; only this server-side call does.
 *
 * Returns null on any error (404, 500, network, parse failure). The caller
 * renders a not-found state when null.
 */
async function fetchMandateDetail(id: string, cookie: string): Promise<MandateDetail | null> {
  try {
    const res = await fetch(`${apiBase()}/mandates/${id}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = mandateDetailSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Not-found state
// ---------------------------------------------------------------------------

function MandateNotFound({ id }: { id: string }) {
  return (
    <div
      role="alert"
      style={{
        padding: '64px 24px',
        textAlign: 'center',
        maxWidth: '480px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: '#F3F4F6',
          border: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
        Mandate not found
      </div>
      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
        The mandate with ID{' '}
        <code
          style={{
            fontFamily: 'monospace',
            backgroundColor: '#F3F4F6',
            padding: '1px 4px',
            borderRadius: '3px',
          }}
        >
          {id}
        </code>{' '}
        could not be found or you do not have access to it.
      </p>
      <a
        href="/mandates"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#374151',
          backgroundColor: '#FFFFFF',
          border: '1px solid #D1D5DB',
          borderRadius: '6px',
          textDecoration: 'none',
        }}
      >
        Back to Mandates
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MandateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  assertRole('/mandates/:id', me.role);

  // SSR-fetch the full detail. Runs server-side against apiBase() (the internal
  // API), so it never collides with the Next.js page route at /mandates/:id.
  const detail = await fetchMandateDetail(id, cookieHeader);

  if (!detail) {
    return <MandateNotFound id={id} />;
  }

  // Pass the full SSR-fetched detail to the client component.
  // MandateDetailClient renders from this prop and issues NO client fetch
  // to /mandates/:id — eliminating the page-route collision (wave-7 lesson).
  return <MandateDetailClient mandateId={id} initialDetail={detail} userRole={me.role as Role} />;
}
