/**
 * /outreach-templates — Templates Library page (wave-11 B-3, task 102a2f00).
 *
 * SSR-hydration (wave-8/9 pattern):
 *   This page SSR-fetches GET /outreach-templates from the internal API server-side
 *   using apiBase() (never the Next.js page route). The full list + versions are
 *   passed as `initialTemplates` to TemplatesLibraryClient, which renders from
 *   that prop and does NOT issue any client fetch to /outreach-templates.
 *   Client mutations (create, draftNewVersion, requestApproval) use the
 *   /outreach-templates-data proxy — no page-route collision.
 *
 * RBAC: advisor/analyst (draft + request-approval), compliance (read + approve).
 *   All three roles may view the list. assertRole('/outreach-templates', me.role).
 *
 * AC-STRIP (P-4 karen MANDATORY + CODE-OF-CONDUCT):
 *   NO AI-drafting, NO "Generate with AI", NO AI-capability language.
 *   Drafting is MANUAL/structured only.
 *
 * @see design/templates-library.html (LAYOUT reference — AI-drafting STRIPPED)
 */

import type { Role } from '@dealflow/shared';
import { outreachTemplateSchema, outreachTemplateVersionSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../_lib/assertRole';
import { TemplatesLibraryClient } from './_components/TemplatesLibraryClient';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base (same pattern as mandate/buyer-universe/matches pages)
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
// Template list shape — template + nested versions
// ---------------------------------------------------------------------------

const templateWithVersionsSchema = outreachTemplateSchema.extend({
  versions: z.array(outreachTemplateVersionSchema),
});

export type TemplateWithVersions = z.infer<typeof templateWithVersionsSchema>;

// ---------------------------------------------------------------------------
// Templates fetch (SSR — internal API, no page-route collision)
// ---------------------------------------------------------------------------

/**
 * Fetches GET /outreach-templates from the internal API server-side.
 * The API returns { templates: TemplateWithVersions[] } (list + versions).
 * Returns null on any error (network, parse, !ok).
 */
async function fetchTemplates(cookie: string): Promise<TemplateWithVersions[] | null> {
  try {
    const res = await fetch(`${apiBase()}/outreach-templates`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    // The controller returns { templates: [...] }
    const listSchema = z.object({
      templates: z.array(templateWithVersionsSchema),
    });
    const parsed = listSchema.safeParse(raw);
    return parsed.success ? parsed.data.templates : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Disclaimer templates fetch (for the version editor dropdown)
// ---------------------------------------------------------------------------

const disclaimerSchema = z
  .object({
    id: z.string().uuid(),
    jurisdiction: z.string(),
    body: z.string(),
  })
  .passthrough();

export type DisclaimerTemplate = z.infer<typeof disclaimerSchema>;

async function fetchDisclaimers(cookie: string): Promise<DisclaimerTemplate[]> {
  try {
    const res = await fetch(`${apiBase()}/compliance/disclaimers`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    const parsed = z.array(disclaimerSchema).safeParse(raw);
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TemplatesLibraryPage() {
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  assertRole('/outreach-templates', me.role);

  // SSR-fetch templates + versions. Runs server-side against apiBase() so
  // it never collides with the Next.js page route at /outreach-templates.
  const [initialTemplates, disclaimers] = await Promise.all([
    fetchTemplates(cookieHeader),
    fetchDisclaimers(cookieHeader),
  ]);

  return (
    <TemplatesLibraryClient
      initialTemplates={initialTemplates}
      disclaimers={disclaimers}
      userRole={me.role as Role}
      userId={me.userId}
    />
  );
}
