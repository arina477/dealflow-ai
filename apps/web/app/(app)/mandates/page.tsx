/**
 * /mandates — Mandate list page (wave-8 B-3).
 *
 * Server component inside the (app) route group; AppShell inherited from layout.
 *
 * Responsibilities:
 *   1. Fine-grained RBAC: assertRole('/mandates', me.role) — advisor/admin/analyst.
 *   2. SSR-fetch GET /mandates (cookie-forwarded via internal API URL).
 *      Returns Mandate[] on success; null on any error (error state rendered).
 *   3. Renders <MandateListClient initialMandates={...}>.
 *
 * read-schema: mandateSchema.createdAt uses z.string() (NOT .datetime()) because
 * PostgreSQL wire format ("2026-07-04 04:42:20+00") is not ISO-8601 (wave-7 lesson).
 *
 * SSR data flow (no client fetch to /mandates — page route):
 *   Server page → internal API (apiBase()) → MandateListClient (receives array as prop)
 *   Any client-side status filtering is done in-memory over the SSR-loaded list.
 */

import type { Mandate } from '@dealflow/shared';
import { mandateSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../_lib/assertRole';
import { MandateListClient } from './_components/MandateListClient';

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
// Mandates list fetch
// ---------------------------------------------------------------------------

/**
 * List response schema — wrapper over mandateSchema[].
 * Timestamps use z.string() (wave-7 PG-wire lesson).
 */
const mandatesListResponseSchema = z.object({
  mandates: z.array(mandateSchema),
});

async function fetchMandates(cookie: string): Promise<Mandate[] | null> {
  try {
    const res = await fetch(`${apiBase()}/mandates`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = mandatesListResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data.mandates : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function MandatesPage() {
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  assertRole('/mandates', me.role);

  const mandates = await fetchMandates(cookieHeader);

  return <MandateListClient initialMandates={mandates} />;
}
