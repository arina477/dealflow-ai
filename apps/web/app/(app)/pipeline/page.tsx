/**
 * /pipeline — Pipeline board page (wave-12 B-3, tasks d1940142 + 45b259e1).
 *
 * SSR-hydration (wave-8/9 pattern):
 *   This page SSR-fetches the board server-side via apiBase() (internal URL).
 *   The board data is passed as `initialBoard` to PipelineBoardClient which
 *   renders from that prop and issues NO client fetch to /pipeline (page route).
 *   Client mutations (stage transition, add note) go through /pipeline-data
 *   proxy (non-page-colliding — wave-8/9 lesson).
 *
 * RBAC: advisor + compliance + admin (/pipeline route).
 *   assertRole('/pipeline', me.role) — advisor sees board + can mutate;
 *   compliance sees board + timeline + can add notes (read-heavy);
 *   admin sees board + timeline (read-only oversight, wave-36 task 76edc7e2).
 *   admin cannot enroll (/pipeline/new) or transition stages (/pipeline/:id/stage).
 *
 * HARD BOUNDARY (P-4 karen flag):
 *   NO send/email affordance.
 *   NO AI/drafting affordance.
 *   Pipeline tracking only — 7 fixed stage columns per product-decision #137.
 *   The 7 stages in order: shortlisted → contacted → engaged → diligence →
 *   offer → closed → withdrawn.
 *
 * Board response shape: { byStage: Record<PipelineStage, Pipeline[]> }
 *   (pipelineBoardSchema from @dealflow/shared).
 *
 * @see design/pipeline.html (LAYOUT reference — 7 fixed stage columns)
 * @see packages/shared/src/pipeline.ts (pipelineBoardSchema)
 */

import type { PipelineBoard, Role } from '@dealflow/shared';
import { pipelineStageEnum } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertRole } from '../_lib/assertRole';
import { PipelineBoardClient } from './_components/PipelineBoardClient';
import type { NormalisedBoard, PipelineRowWithJoins } from './_lib/pipeline-types';
import { PIPELINE_STAGES, pipelineRowWithJoinsSchema } from './_lib/pipeline-types';

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
// Board fetch  (GET /pipeline)
//
// Returns a discriminated result so the page can distinguish a real fetch /
// parse failure from a genuinely-empty board.  Callers must NOT collapse the
// two cases — a shape-drift regression (the wave-8/9/10/11 class) would
// otherwise silently render as an empty board and pass a green smoke test.
//
// Success path: { ok: true, board: NormalisedBoard }
//   board is guaranteed to contain all 7 fixed stage keys.
//   board.byStage[stage] === [] when the server returned no deals for that
//   stage — the 7-column structure is always complete.
//
// Error path: { ok: false, status: number }
//   Covers: non-2xx HTTP status (e.g. 500, 403 after mid-session role change)
//   OR safeParse shape-mismatch (response body does not match boardResponseSchema).
//   status = HTTP status code for non-OK responses; 0 for network / parse errors.
// ---------------------------------------------------------------------------

const boardResponseSchema = z
  .object({
    byStage: z.record(pipelineStageEnum, z.array(pipelineRowWithJoinsSchema)),
  })
  .passthrough();

type BoardResult = { ok: true; board: NormalisedBoard } | { ok: false; status: number };

function normaliseBoard(raw: PipelineBoard): NormalisedBoard {
  const empty = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, [] as PipelineRowWithJoins[]])
  ) as NormalisedBoard['byStage'];
  // Merge raw byStage into the empty map — fills missing stages with [].
  return {
    byStage: {
      ...empty,
      ...Object.fromEntries(
        Object.entries(raw.byStage).filter(([k]) =>
          (PIPELINE_STAGES as readonly string[]).includes(k)
        )
      ),
    } as NormalisedBoard['byStage'],
  };
}

async function fetchBoard(cookie: string, mandateId?: string): Promise<BoardResult> {
  try {
    const url = mandateId
      ? `${apiBase()}/pipeline?mandateId=${encodeURIComponent(mandateId)}`
      : `${apiBase()}/pipeline`;
    const res = await fetch(url, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return { ok: false, status: res.status };
    const raw: unknown = await res.json();
    const parsed = boardResponseSchema.safeParse(raw);
    // Shape-mismatch: treat as parse error, not empty board.
    // status 0 distinguishes "response arrived but body was malformed" from an
    // HTTP error where the status code is meaningful.
    if (!parsed.success) return { ok: false, status: 0 };
    // Cast — boardResponseSchema validates the shape matches PipelineBoard
    return { ok: true, board: normaliseBoard(parsed.data as PipelineBoard) };
  } catch {
    return { ok: false, status: 0 };
  }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PipelinePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PipelinePage({ searchParams }: PipelinePageProps) {
  const cookieHeader = (await cookies()).toString();

  const me = await fetchMe(cookieHeader);
  if (!me) redirect('/login');

  assertRole('/pipeline', me.role);

  const params = (await searchParams) ?? {};
  const mandateId = typeof params.mandateId === 'string' ? params.mandateId : undefined;

  const boardResult = await fetchBoard(cookieHeader, mandateId);

  if (!boardResult.ok) {
    return (
      <PipelineBoardClient
        initialBoard={null}
        boardError={{ status: boardResult.status }}
        userRole={me.role as Role}
        mandateId={mandateId}
      />
    );
  }

  return (
    <PipelineBoardClient
      initialBoard={boardResult.board}
      userRole={me.role as Role}
      mandateId={mandateId}
    />
  );
}
