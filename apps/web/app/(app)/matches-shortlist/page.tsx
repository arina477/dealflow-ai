/**
 * /matches-shortlist — Matches & Shortlist page (wave-10 B-3, task fb82d339).
 *
 * SSR-hydration pattern (wave-8/9):
 *   This page SSR-fetches GET /matches?mandateId= server-side via apiBase()
 *   (internal URL, never the Next.js page route). The ranked list + run data
 *   are passed as `initialData` to MatchesShortlistClient, which renders from
 *   that prop and does NOT issue any client fetch to /matches or /matches/:id.
 *   Client mutations (disposition, handoff, create-run) use /matches-data proxy.
 *
 * RBAC: advisor/admin/analyst. All three may view; only advisor/admin may
 *       create runs and mutate (disposition, handoff — enforced by the API too).
 *
 * AI-framing STRIP: NO AI/LLM/model language anywhere in this component.
 *   The fit score is a DETERMINISTIC rule-based integer (0–100). The drawer
 *   is "Score breakdown", NOT "AI Match Analysis" or "Rationale Explainability".
 *   The "similar mandates" / "data freshness" / "model" fabrications from the
 *   design prototype are ALL removed per the P-4 karen MANDATORY condition and
 *   CODE-OF-CONDUCT provenance rule.
 *
 * @see design/matches-shortlist.html (LAYOUT reference — AI-framing STRIPPED)
 */

import type { MatchRankedList, Role } from '@dealflow/shared';
import { matchRankedListSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../_lib/assertRole';
import { MatchesShortlistClient } from './_components/MatchesShortlistClient';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base (same pattern as buyer-universe + mandate pages)
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
// Match run + ranked candidates fetch (SSR — internal API, no page-route collision)
// ---------------------------------------------------------------------------

/**
 * Fetches GET /matches?mandateId= from the internal API server-side.
 * The API returns { runs: MatchRun[] } or similar list shape. We take the
 * first run (most recent) and then fetch GET /matches/:id for the full ranked list.
 * Returns null if no run exists for this mandate.
 */
async function fetchMatchRankedList(
  mandateId: string,
  cookie: string
): Promise<MatchRankedList | null> {
  try {
    // Fetch list of match runs for the mandate
    const listRes = await fetch(`${apiBase()}/matches?mandateId=${mandateId}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!listRes.ok) return null;
    const listRaw: unknown = await listRes.json();

    // The controller returns { runs: MatchRun[] }
    const listSchema = z.object({
      runs: z.array(z.object({ id: z.string().uuid() }).passthrough()),
    });
    const listParsed = listSchema.safeParse(listRaw);
    if (!listParsed.success || listParsed.data.runs.length === 0) return null;

    const runId = listParsed.data.runs[0]?.id;
    if (!runId) return null;

    // Fetch the full ranked detail (run + candidates ordered fit_score DESC)
    const detailRes = await fetch(`${apiBase()}/matches/${runId}`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!detailRes.ok) return null;
    const detailRaw: unknown = await detailRes.json();
    const parsed = matchRankedListSchema.safeParse(detailRaw);
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
        The Matches & Shortlist page requires a mandate context. Open it from a mandate detail page.
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

export default async function MatchesShortlistPage({ searchParams }: PageProps) {
  const { mandateId } = await searchParams;
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  assertRole('/matches', me.role);

  if (!mandateId) {
    return <NoMandateId />;
  }

  // SSR-fetch the ranked list. Runs server-side against apiBase() so it never
  // collides with the Next.js page route at /matches-shortlist.
  // Returns null if no run exists yet — client renders "create match run" CTA.
  const initialData = await fetchMatchRankedList(mandateId, cookieHeader);

  return (
    <MatchesShortlistClient
      mandateId={mandateId}
      initialData={initialData}
      userRole={me.role as Role}
    />
  );
}
