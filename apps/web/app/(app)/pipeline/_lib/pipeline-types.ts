/**
 * Pipeline shared constants + types (wave-12 B-3).
 *
 * This file is intentionally NOT a server component — it exports only
 * plain constants and Zod-derived types that are safe to import from
 * both Server Components (page.tsx) and Client Components
 * (PipelineBoardClient, DealTimelinePanel).
 *
 * CRITICAL: Do NOT import next/headers, next/cookies, or any other
 * server-only API here. This file must be importable from 'use client'
 * components without triggering a Server Component boundary error.
 */

import { pipelineStageEnum } from '@dealflow/shared';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// The 7 fixed pipeline stages in canonical order (product-decision #137).
// Exported as a stable const array used for column ordering in the board.
// ---------------------------------------------------------------------------

export const PIPELINE_STAGES = pipelineStageEnum.options;

// ---------------------------------------------------------------------------
// Pipeline row with optional join fields (mandate name, buyer name/firm).
//
// The server's GET /pipeline response may include these join fields beyond
// the base pipelineSchema. .passthrough() lets additional fields flow through.
// ---------------------------------------------------------------------------

export const pipelineRowWithJoinsSchema = z
  .object({
    id: z.string().uuid(),
    mandateId: z.string().uuid(),
    dealSourceType: z.string(),
    outreachId: z.string().uuid().nullable(),
    matchCandidateId: z.string().uuid().nullable(),
    stage: pipelineStageEnum,
    createdBy: z.string().uuid(),
    updatedBy: z.string().uuid().nullable(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
    // Optional join fields populated by the board endpoint
    mandateName: z.string().nullable().optional(),
    buyerName: z.string().nullable().optional(),
    buyerFirm: z.string().nullable().optional(),
  })
  .passthrough();

export type PipelineRowWithJoins = z.infer<typeof pipelineRowWithJoinsSchema>;

// ---------------------------------------------------------------------------
// Normalised board shape: all 7 stage keys always present.
// ---------------------------------------------------------------------------

export type NormalisedBoard = {
  byStage: Record<(typeof PIPELINE_STAGES)[number], PipelineRowWithJoins[]>;
};
