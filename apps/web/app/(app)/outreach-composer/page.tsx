/**
 * /outreach-composer — Outreach Composer page (wave-11 B-3, tasks e90a4a99 + 2601ba33).
 *
 * SSR-hydration (wave-8/9 pattern):
 *   This page SSR-fetches approved template versions + shortlisted candidates
 *   server-side via apiBase(). Results are passed as `initialData` to
 *   OutreachComposerClient which renders from those props and issues NO client
 *   fetch to /outreach or /outreach-composer. Mutations go through
 *   /outreach-data proxy (non-page-colliding).
 *
 * RBAC: advisor only (compose). assertRole('/outreach', me.role).
 *
 * AC-STRIP (P-4 karen MANDATORY + CODE-OF-CONDUCT provenance):
 *   NO "Send Immediate Campaign", NO "Schedule Send...",
 *   NO "WORM storage upon send", NO "AI Drafting", NO "AI-powered",
 *   NO "generated" as a send or AI capability.
 *   This page produces a SEND-ELIGIBLE record, NOT an actual send.
 *   The actual send is a later bundle. The gate verdict is surfaced honestly.
 *
 * @see design/outreach-composer.html (LAYOUT reference — send/AI affordances STRIPPED)
 */

import type { Role } from '@dealflow/shared';
import {
  matchCandidateSchema,
  matchRunSchema,
  outreachTemplateVersionSchema,
} from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../_lib/assertRole';
import { OutreachComposerClient } from './_components/OutreachComposerClient';

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
// Approved template versions fetch (send-eligible only)
// ---------------------------------------------------------------------------

const templateVersionWithTemplateSchema = outreachTemplateVersionSchema.extend({
  templateName: z.string().optional(),
});

export type TemplateVersionWithName = z.infer<typeof templateVersionWithTemplateSchema>;

/**
 * Fetches all outreach template versions that are approved AND version-binding
 * invariant holds (approved_content_hash == content_hash).
 *
 * The API returns { templates: [{ id, name, versions: [...] }] }. We flatten
 * to a list of approved versions with their template name attached.
 */
async function fetchApprovedVersions(cookie: string): Promise<TemplateVersionWithName[]> {
  try {
    const res = await fetch(`${apiBase()}/outreach-templates`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
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
    if (!parsed.success) return [];

    // Filter to only send-eligible versions (version-binding invariant)
    const eligible: TemplateVersionWithName[] = [];
    for (const tmpl of parsed.data.templates) {
      for (const v of tmpl.versions) {
        if (
          v.approvalStatus === 'approved' &&
          v.approvedContentHash !== null &&
          v.approvedContentHash === v.contentHash
        ) {
          eligible.push({ ...v, templateName: tmpl.name });
        }
      }
    }
    return eligible;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Accepted match candidates fetch (shortlist — accepted disposition)
// ---------------------------------------------------------------------------

// matchCandidateSchema is imported from @dealflow/shared (mirrors match_candidates row).
// Re-export the inferred type so _components/OutreachComposerClient can reference it.
export type MatchCandidate = z.infer<typeof matchCandidateSchema>;

/**
 * Fetches shortlisted (accepted) match candidates for a specific mandate.
 *
 * M-3 fix: mandateId is REQUIRED — GET /matches returns { runs: [] } without one
 * (by design; see matching.controller.ts listMatchRuns). Always pass the selected
 * (or first-available) mandate's id.
 *
 * C-3 fix: GET /matches/:id/shortlist returns { run, accepted: [...] } — the real
 * shape from MatchingService.getShortlist (matching.service.ts). The accepted array
 * is already server-filtered to disposition==='accepted'; no client-side filter needed.
 *
 * Returns an empty array on any error.
 */
async function fetchAcceptedCandidates(
  cookie: string,
  mandateId: string
): Promise<MatchCandidate[]> {
  try {
    // M-3: always scope the run lookup to the given mandateId.
    const listRes = await fetch(`${apiBase()}/matches?mandateId=${mandateId}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!listRes.ok) return [];
    const listRaw: unknown = await listRes.json();
    const listSchema = z.object({
      runs: z.array(z.object({ id: z.string().uuid() }).passthrough()),
    });
    const listParsed = listSchema.safeParse(listRaw);
    if (!listParsed.success || listParsed.data.runs.length === 0) return [];

    const runId = listParsed.data.runs[0]?.id;
    if (!runId) return [];

    // Fetch the shortlist for this run.
    const shortlistRes = await fetch(`${apiBase()}/matches/${runId}/shortlist`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!shortlistRes.ok) return [];
    const shortlistRaw: unknown = await shortlistRes.json();

    // C-3 fix: real shape is { run: matchRunSchema, accepted: z.array(matchCandidateSchema) }
    // (MatchingService.getShortlist → Shortlist type in @dealflow/shared).
    // The `accepted` array is server-filtered to disposition==='accepted'; no client filter.
    const shortlistSchema = z.object({
      run: matchRunSchema,
      accepted: z.array(matchCandidateSchema),
    });
    const shortlistParsed = shortlistSchema.safeParse(shortlistRaw);
    if (!shortlistParsed.success) return [];
    return shortlistParsed.data.accepted;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Disclaimer templates for jurisdiction dropdown
// ---------------------------------------------------------------------------

const disclaimerSchema = z
  .object({
    id: z.string().uuid(),
    jurisdiction: z.string(),
    body: z.string(),
  })
  .passthrough();

export type DisclaimerForComposer = z.infer<typeof disclaimerSchema>;

async function fetchDisclaimers(cookie: string): Promise<DisclaimerForComposer[]> {
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
// Mandates list (for mandate selector in composer)
// ---------------------------------------------------------------------------

const mandateRowSchema = z
  .object({
    id: z.string().uuid(),
    sellerName: z.string(),
  })
  .passthrough();

export type MandateRow = z.infer<typeof mandateRowSchema>;

async function fetchMandates(cookie: string): Promise<MandateRow[]> {
  try {
    const res = await fetch(`${apiBase()}/mandates`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    // Controller returns { mandates: [...] } or bare array
    const parseSchema = z.union([
      z.object({ mandates: z.array(mandateRowSchema) }),
      z.array(mandateRowSchema),
    ]);
    const parsed = parseSchema.safeParse(raw);
    if (!parsed.success) return [];
    return Array.isArray(parsed.data) ? parsed.data : parsed.data.mandates;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export interface ComposerInitialData {
  approvedVersions: TemplateVersionWithName[];
  acceptedCandidates: MatchCandidate[];
  disclaimers: DisclaimerForComposer[];
  mandates: MandateRow[];
}

export default async function OutreachComposerPage() {
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  assertRole('/outreach', me.role);

  // SSR-fetch all initial data in parallel. Runs server-side against apiBase()
  // — no page-route collision.
  const [approvedVersions, disclaimers, mandates] = await Promise.all([
    fetchApprovedVersions(cookieHeader),
    fetchDisclaimers(cookieHeader),
    fetchMandates(cookieHeader),
  ]);

  // M-3 fix: scope the accepted-candidates load to the first available mandate.
  // GET /matches without mandateId returns { runs: [] } by design (controller);
  // a mandateId is required to retrieve any runs. The client component re-fetches
  // when the advisor selects a different mandate (mandate-scoped recipient list).
  const firstMandateId = mandates[0]?.id;
  const acceptedCandidates = firstMandateId
    ? await fetchAcceptedCandidates(cookieHeader, firstMandateId)
    : [];

  const initialData: ComposerInitialData = {
    approvedVersions,
    acceptedCandidates,
    disclaimers,
    mandates,
  };

  return <OutreachComposerClient initialData={initialData} userRole={me.role as Role} />;
}
