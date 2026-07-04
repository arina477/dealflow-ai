/**
 * /sourcing — Sourcing Workspace (wave-7, B-3).
 *
 * REPLACES the old redirect-to-companies stub. This IS the workspace: the
 * M3 search entry point per design/sourcing-workspace.html.
 *
 * Server component inside the (app) route group; AppShell chrome inherited
 * from app/(app)/layout.tsx.
 *
 * Responsibilities:
 *   1. Fine-grained RBAC: assertRole('/sourcing', me.role) — analyst/admin.
 *      Non-matching authenticated roles redirect to '/'.
 *      Unauthenticated → /login via the (app) layout guard.
 *   2. SSR-fetches (parallel):
 *      - GET /sourcing/connections (connected sources list + companyCount)
 *      - GET /sourcing/companies (initial result set, canonical universe)
 *      Cookie-forwarded, cache: 'no-store'.
 *   3. Renders per design/sourcing-workspace.html:
 *      - Connectors row (connected sources with status dots + Sync now buttons)
 *      - Search bar (query + source filter)
 *      - Results matrix (company rows + real source/provenance badges — AC-BADGE)
 *      - Detail drawer (company detail + source lineage)
 *      - Review & Import CTA → /sourcing/companies hand-off (AC-CTA)
 *      - Connection-create affordance (AC-SEED enabler)
 *
 * Design tokens: DESIGN-SYSTEM §10 (zinc/emerald, AppShell chrome inherited).
 * NO in-page dedupe modal (deferred b9141490). NO literal PitchBook/Crunchbase
 * badge text — badges come from real data_source_connections.displayName (AC-BADGE).
 *
 * Same-origin proxy: /sourcing/connections (create+list) via afterFiles rewrite
 * added in next.config.ts. /sourcing/connections/:id/sync already wired (wave-6).
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../_lib/assertRole';
import { WorkspaceClient } from './_components/WorkspaceClient';
import { fetchConnections, fetchWorkspaceCompanies } from './_lib/workspace-types';

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
// Page component
// ---------------------------------------------------------------------------

export default async function SourcingWorkspacePage() {
  const cookie = await cookieHeader();
  const base = apiBase();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert analyst/admin access.
  assertRole('/sourcing', me.role);

  // 3. SSR data fetches (parallel).
  const [connections, companies] = await Promise.all([
    fetchConnections(base, cookie),
    fetchWorkspaceCompanies(base, cookie),
  ]);

  // 4. Render workspace — client components handle interaction.
  return <WorkspaceClient initialConnections={connections} initialCompanies={companies} />;
}
