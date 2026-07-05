/**
 * /compliance-queue — Compliance Queue page (wave-11 B-3, task 2601ba33).
 *
 * SSR-hydration (wave-8/9 pattern):
 *   This page SSR-fetches pending template versions from the internal API
 *   server-side using apiBase(). Results are passed as `initialVersions` to
 *   ComplianceQueueClient, which renders from that prop and does NOT issue any
 *   client fetch to /compliance-queue. Mutations (approve/reject) go through
 *   the /outreach-templates-data proxy.
 *
 * RBAC: compliance only. assertRole('/compliance/queue', me.role).
 *   Advisor/analyst attempting this page are redirected to '/'.
 *
 * Wires the approval + SoD UI:
 *   - Lists pending-approval template versions (all templates, all pending versions).
 *   - Grant/reject actions call POST /outreach-templates-data/:id/versions/:vid/approve|reject.
 *   - SoD is enforced server-side (approver != drafter); the UI surfaces 403 as an error.
 *
 * @see design/compliance-queue.html (LAYOUT reference)
 */

import type { Role } from '@dealflow/shared';
import { outreachTemplateVersionSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../_lib/assertRole';
import { ComplianceQueueClient } from './_components/ComplianceQueueClient';

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
// Pending-version shape (version + parent template metadata)
// ---------------------------------------------------------------------------

const versionWithTemplateSchema = outreachTemplateVersionSchema.extend({
  templateId: z.string().uuid(),
  templateName: z.string(),
});

export type VersionWithTemplate = z.infer<typeof versionWithTemplateSchema>;

// ---------------------------------------------------------------------------
// Pending versions fetch (SSR — internal API, no page-route collision)
// ---------------------------------------------------------------------------

/**
 * Fetches GET /outreach-templates, then flattens to a list of pending-approval
 * versions with their template name attached.
 */
async function fetchPendingVersions(cookie: string): Promise<VersionWithTemplate[] | null> {
  try {
    const res = await fetch(`${apiBase()}/outreach-templates`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();

    const listSchema = z.object({
      templates: z.array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string(),
            versions: z.array(outreachTemplateVersionSchema),
          })
          .passthrough()
      ),
    });
    const parsed = listSchema.safeParse(raw);
    if (!parsed.success) return null;

    const pending: VersionWithTemplate[] = [];
    for (const tmpl of parsed.data.templates) {
      for (const v of tmpl.versions) {
        if (v.approvalStatus === 'pending') {
          pending.push({ ...v, templateId: tmpl.id, templateName: tmpl.name });
        }
      }
    }
    // Sort by createdAt ascending (oldest first = highest priority)
    pending.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return pending;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ComplianceQueuePage() {
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  // compliance-queue is accessible to compliance role only
  assertRole('/compliance/queue', me.role);

  // SSR-fetch pending versions. Runs server-side against apiBase() so it
  // never collides with the Next.js page route at /compliance-queue.
  const initialVersions = await fetchPendingVersions(cookieHeader);

  return <ComplianceQueueClient initialVersions={initialVersions} userRole={me.role as Role} />;
}
