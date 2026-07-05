import { z } from 'zod';

/**
 * Wave-12 pipeline shared contracts (B-1, task 07989285 / d1940142 / 45b259e1).
 *
 * Covers:
 *   - pipelineStageEnum / pipelineEventTypeEnum — Zod mirrors of the DB pgEnums
 *   - READ shapes (passthrough — rule 5: server may add fields without client break)
 *   - INPUT schemas (.strict() — mass-assignment guard)
 *
 * READ schemas use .passthrough().
 * INPUT schemas use .strict().
 * Timestamps use z.string() — NOT z.string().datetime() (wave-7 lesson: Drizzle
 *   mode:'string' returns ISO-8601 text but the .datetime() refinement rejects
 *   timezone offsets in some runtimes; z.string() is the safe choice).
 */

// ---------------------------------------------------------------------------
// Enums (mirror the DB pgEnums — keep in sync with pipeline.ts schema)
// ---------------------------------------------------------------------------

/**
 * pipelineStageEnum — the 7 fixed deal-lifecycle stages (product-decision #137).
 * shortlisted → contacted → engaged → diligence → offer → closed → withdrawn.
 * No configurable stages for MVP (H2-deferred).
 */
export const pipelineStageEnum = z.enum([
  'shortlisted',
  'contacted',
  'engaged',
  'diligence',
  'offer',
  'closed',
  'withdrawn',
]);
export type PipelineStage = z.infer<typeof pipelineStageEnum>;

/**
 * pipelineEventTypeEnum — three categories of append-only pipeline events.
 *   enrolled      — deal enrolled into the pipeline at stage 'shortlisted'.
 *   stage_changed — deal moved from from_stage → to_stage.
 *   note          — free-text note appended by an actor.
 */
export const pipelineEventTypeEnum = z.enum(['enrolled', 'stage_changed', 'note']);
export type PipelineEventType = z.infer<typeof pipelineEventTypeEnum>;

// ---------------------------------------------------------------------------
// READ shapes — passthrough (rule 5)
// ---------------------------------------------------------------------------

/**
 * pipelineSchema — the pipeline row READ shape.
 *
 * Timestamps use z.string() (wave-7 lesson — Drizzle mode:'string' returns
 * ISO-8601 text; z.string().datetime() may reject timezone-aware strings).
 *
 * .passthrough() — server may add fields (join results, computed fields) without
 * breaking client consumers.
 */
export const pipelineSchema = z
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
  })
  .passthrough();

export type Pipeline = z.infer<typeof pipelineSchema>;

/**
 * pipelineEventSchema — the pipeline_events row READ shape.
 *
 * from_stage / to_stage are nullable — NULL for enrolled and note events.
 * note is nullable — NULL for enrolled and stage_changed events.
 * .passthrough() for forward-compatibility.
 */
export const pipelineEventSchema = z
  .object({
    id: z.string().uuid(),
    pipelineId: z.string().uuid(),
    eventType: pipelineEventTypeEnum,
    fromStage: pipelineStageEnum.nullable(),
    toStage: pipelineStageEnum.nullable(),
    note: z.string().nullable(),
    actorId: z.string().uuid(),
    createdAt: z.string(),
  })
  .passthrough();

export type PipelineEvent = z.infer<typeof pipelineEventSchema>;

/**
 * pipelineBoardSchema — GET /pipeline response shape.
 *
 * Deals grouped by stage. Each stage column carries an array of pipeline rows.
 * The keys are the 7 fixed stage values. .passthrough() for forward-compat.
 */
export const pipelineBoardSchema = z
  .object({
    byStage: z.record(pipelineStageEnum, z.array(pipelineSchema)),
  })
  .passthrough();

export type PipelineBoard = z.infer<typeof pipelineBoardSchema>;

/**
 * pipelineEventsResponseSchema — GET /pipeline/:id/events response shape.
 * Ordered timeline (enrolled + stage_changed + note), created_at ASC.
 */
export const pipelineEventsResponseSchema = z
  .object({
    events: z.array(pipelineEventSchema),
  })
  .passthrough();

export type PipelineEventsResponse = z.infer<typeof pipelineEventsResponseSchema>;

// ---------------------------------------------------------------------------
// INPUT schemas — strict() (mass-assignment guard)
// ---------------------------------------------------------------------------

/**
 * enrollInputSchema — POST /pipeline body.
 *
 * Enroll a deal target from an eligible source into the pipeline.
 * sourceType: 'outreach' | 'match_candidate' (discriminant for the eligible-source guard).
 * sourceId: the UUID of the source row.
 * mandateId: the mandate this pipeline entry belongs to (required for FK).
 */
export const enrollInputSchema = z
  .object({
    /** Discriminant: 'outreach' or 'match_candidate'. */
    sourceType: z.enum(['outreach', 'match_candidate']),
    /** UUID of the source row (outreach.id or match_candidates.id). */
    sourceId: z.string().uuid(),
    /** UUID of the mandate this pipeline entry belongs to. */
    mandateId: z.string().uuid(),
  })
  .strict();

export type EnrollInput = z.infer<typeof enrollInputSchema>;

/**
 * transitionInputSchema — PATCH /pipeline/:id/stage body.
 *
 * Move a deal to a new fixed stage. toStage must be in the 7-value enum.
 * The server additionally validates via pipelineStageEnum at the service layer.
 */
export const transitionInputSchema = z
  .object({
    /** The target stage. Must be one of the 7 fixed pipeline stages. */
    toStage: pipelineStageEnum,
  })
  .strict();

export type TransitionInput = z.infer<typeof transitionInputSchema>;

/**
 * addNoteInputSchema — POST /pipeline/:id/notes body.
 *
 * Append a free-text note to a pipeline deal's event timeline.
 * text: non-empty (min 1 char — Zod guard; empty notes are rejected).
 */
export const addNoteInputSchema = z
  .object({
    /** Free-text note. Non-empty (min 1 char). */
    text: z.string().min(1),
  })
  .strict();

export type AddNoteInput = z.infer<typeof addNoteInputSchema>;
