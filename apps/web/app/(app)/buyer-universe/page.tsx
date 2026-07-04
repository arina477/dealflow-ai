/**
 * /buyer-universe — Buyer Universe page (wave-9 B-3).
 *
 * SSR-hydration (wave-8 pattern):
 *   This page SSR-fetches the buyer universe for the given mandateId server-side,
 *   using apiBase() which resolves to the internal API (never to the Next.js page
 *   route itself). The result is passed as `initialDetail` prop to
 *   BuyerUniverseClient, which renders from that prop and does NOT issue any
 *   client fetch to /buyer-universe or /buyer-universe/:id (the page routes).
 *   This eliminates the page-route collision class from wave-7/8.
 *
 * RBAC: analyst/advisor/admin. Compliance is denied (redirected to /).
 *
 * Empty state: if no universe exists for the mandateId, renders an "Assemble"
 * CTA in the client component. The server passes initialDetail=null in that case.
 *
 * query param: ?mandateId= (required; without it the page renders an error state)
 */

import type { BuyerUniverseDetail, Role } from '@dealflow/shared';
import { buyerUniverseDetailSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../_lib/assertRole';
import { BuyerUniverseClient } from './_components/BuyerUniverseClient';

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
// Session fetch (same shape as mandate detail page)
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
// Buyer universe list fetch (SSR — internal API, no page-route collision)
// ---------------------------------------------------------------------------

/**
 * Fetches GET /buyer-universe?mandateId= from the internal API server-side.
 *
 * The API returns { universes: BuyerUniverseRow[] } (controller.listUniverses →
 * { universes }). We take the first entry (at most one per mandate — UNIQUE on
 * mandate_id). Returns null if none found.
 *
 * NOTE: We do NOT use GET /buyer-universe/:id here because we only have
 * the mandateId from the query param; the universe id is not known at page-load.
 * The list endpoint with mandateId filter is the correct entry point.
 */
async function fetchUniverseByMandate(
  mandateId: string,
  cookie: string
): Promise<BuyerUniverseDetail | null> {
  try {
    // First fetch the list to find the universe id for this mandate.
    // The controller returns { universes: BuyerUniverseRow[] } — NOT a bare array.
    const listRes = await fetch(`${apiBase()}/buyer-universe?mandateId=${mandateId}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!listRes.ok) return null;
    const listRaw: unknown = await listRes.json();
    // Parse the wrapper object shape the controller actually returns.
    const listSchema = z.object({
      universes: z.array(z.object({ id: z.string().uuid() }).passthrough()),
    });
    const listParsed = listSchema.safeParse(listRaw);
    if (!listParsed.success || listParsed.data.universes.length === 0) return null;

    const universeId = listParsed.data.universes[0]?.id;
    if (!universeId) return null;

    // Fetch the full detail
    const detailRes = await fetch(`${apiBase()}/buyer-universe/${universeId}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!detailRes.ok) return null;
    const detailRaw: unknown = await detailRes.json();
    const parsed = buyerUniverseDetailSchema.safeParse(detailRaw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// No-mandate-id state
// ---------------------------------------------------------------------------

function NoMandateId() {
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
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
        No mandate selected
      </div>
      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
        The Buyer Universe requires a mandate context. Open it from a mandate detail page.
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
  searchParams: Promise<{ mandateId?: string }>;
}

export default async function BuyerUniversePage({ searchParams }: PageProps) {
  const { mandateId } = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  assertRole('/buyer-universe', me.role);

  if (!mandateId) {
    return <NoMandateId />;
  }

  // SSR-fetch the buyer universe detail. Runs server-side against apiBase() so
  // it never collides with the Next.js page route at /buyer-universe.
  // Returns null if no universe has been assembled yet — client renders assemble CTA.
  const initialDetail = await fetchUniverseByMandate(mandateId, cookieHeader);

  return (
    <BuyerUniverseClient
      mandateId={mandateId}
      initialDetail={initialDetail}
      userRole={me.role as Role}
    />
  );
}
