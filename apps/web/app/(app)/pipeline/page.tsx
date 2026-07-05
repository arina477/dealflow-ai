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
 * RBAC: advisor + compliance (/pipeline route).
 *   assertRole('/pipeline', me.role) — advisor sees board + can mutate;
 *   compliance sees board + timeline + can add notes (read-heavy).
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
// Returns a NormalisedBoard guaranteed to contain all 7 fixed stage keys —
// even if the server returns a partial map we normalise here so the client
// always receives a complete 7-column board.
// ---------------------------------------------------------------------------

const boardResponseSchema = z
  .object({
    byStage: z.record(pipelineStageEnum, z.array(pipelineRowWithJoinsSchema)),
  })
  .passthrough();

function normaliseBoard(raw: PipelineBoard | null): NormalisedBoard {
  const empty = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, [] as PipelineRowWithJoins[]])
  ) as NormalisedBoard['byStage'];
  if (!raw) return { byStage: empty };
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

async function fetchBoard(cookie: string, mandateId?: string): Promise<NormalisedBoard> {
  try {
    const url = mandateId
      ? `${apiBase()}/pipeline?mandateId=${encodeURIComponent(mandateId)}`
      : `${apiBase()}/pipeline`;
    const res = await fetch(url, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return normaliseBoard(null);
    const raw: unknown = await res.json();
    const parsed = boardResponseSchema.safeParse(raw);
    if (!parsed.success) return normaliseBoard(null);
    // Cast — boardResponseSchema validates the shape matches PipelineBoard
    return normaliseBoard(parsed.data as PipelineBoard);
  } catch {
    return normaliseBoard(null);
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

  const board = await fetchBoard(cookieHeader, mandateId);

  return (
    <PipelineBoardClient initialBoard={board} userRole={me.role as Role} mandateId={mandateId} />
  );
}
