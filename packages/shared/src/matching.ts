import { z } from 'zod';

/**
 * Wave-10 match shared contracts (B-1, task 47ed7ddd).
 *
 * Read shapes mirror the DB columns — timestamps use z.string() NOT
 * z.string().datetime() because PostgreSQL wire format ("2026-07-04 04:42:20+00")
 * is not ISO-8601 and is rejected by strict datetime parsing (wave-7 lesson).
 *
 * Read schemas use .passthrough() — extra server-added fields are forwarded
 * to callers rather than dropped (wave-7 connectionIds lesson).
 *
 * Input schemas use .strict() — extra client-supplied fields are rejected
 * to prevent privilege escalation through unexpected body keys.
 *
 * HARD BOUNDARY: NO Anthropic/Claude/LLM/BullMQ import or field anywhere in
 * this file. score_breakdown is structured rule-contributions jsonb, NOT prose.
 * fit_score is a deterministic integer (0–100). No rationale-TEXT field exists.
 */

// ---------------------------------------------------------------------------
// ScoreBreakdown schema (mirrors matching.scorer.ts ScoreBreakdown interface)
// ---------------------------------------------------------------------------

/**
 * scoreBreakdownSchema — typed contract for score_breakdown JSONB.
 * Mirrors the ScoreBreakdown interface from matching.scorer.ts exactly.
 * Fields are flat numbers (NOT nested objects with score/weight/label).
 * notApplied entries are strings like 'geo: not applied — M3 lacks column'.
 *
 * READ schema: .passthrough() — tolerates extra server-added fields.
 */
export const scoreBreakdownSchema = z
  .object({
    /** Points from sector/industry token match (0, 20, 30, or 60). */
    sectorMatch: z.number(),
    /** Points from contact completeness (0, 15, or 30). */
    contactCompleteness: z.number(),
    /** Deterministic tie-break points (0..10). */
    tieBreak: z.number(),
    /** Total fit score (sum of above, clamped to [0, 100]). */
    total: z.number(),
    /**
     * Dimensions that were specified in criteria but could not be applied
     * (M3 companies lack the column). Each entry is a string like
     * 'geo: not applied — M3 lacks column'.
     */
    notApplied: z.array(z.string()),
  })
  .passthrough();

export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

// ---------------------------------------------------------------------------
// Status / disposition enums
// ---------------------------------------------------------------------------

export const matchRunStatusEnum = z.enum(['pending', 'scored']);
export type MatchRunStatus = z.infer<typeof matchRunStatusEnum>;

export const matchCandidateDispositionEnum = z.enum(['pending', 'accepted', 'rejected', 'flagged']);
export type MatchCandidateDisposition = z.infer<typeof matchCandidateDispositionEnum>;

// ---------------------------------------------------------------------------
// Entity read shapes (mirror DB rows — tolerant of real API shape)
// ---------------------------------------------------------------------------

/**
 * matchRunSchema — mirrors the match_run table row.
 * Timestamps use z.string() (PG-wire format; NOT .datetime()).
 *
 * READ schema: .passthrough() — extra server-added fields are forwarded.
 * NOT .strict() — future server columns do not break existing clients.
 */
export const matchRunSchema = z
  .object({
    id: z.string().uuid(),
    /** FK → mandates.id */
    mandateId: z.string().uuid(),
    /** FK → buyer_universe.id — UNIQUE (one run per universe). */
    buyerUniverseId: z.string().uuid(),
    /** App users.id of the actor who triggered the run (NOT supertokens_user_id). */
    createdBy: z.string().uuid(),
    status: matchRunStatusEnum,
    /** M6 handoff sentinel — true when ≥1 accepted candidate + handoff confirmed. */
    readyForOutreach: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .passthrough();

export type MatchRun = z.infer<typeof matchRunSchema>;

/**
 * matchCandidateSchema — mirrors the match_candidates table row.
 * fit_score is an integer in [0, 100].
 * score_breakdown is structured JSONB — NOT prose text.
 *
 * READ schema: .passthrough().
 */
export const matchCandidateSchema = z
  .object({
    id: z.string().uuid(),
    /** FK → match_run.id */
    matchRunId: z.string().uuid(),
    /** FK → buyer_universe_candidates.id */
    buyerUniverseCandidateId: z.string().uuid(),
    /** Pure deterministic fit score (0–100). NO LLM, NO randomness. */
    fitScore: z.number().int().min(0).max(100),
    /**
     * Structured rule-contribution breakdown.
     * Shape: { sectorMatch, contactCompleteness, tieBreak, total, notApplied }.
     * NOT prose — no rationale-text field.
     * Typed by scoreBreakdownSchema (mirrors matching.scorer.ts ScoreBreakdown).
     */
    scoreBreakdown: scoreBreakdownSchema.nullable(),
    disposition: matchCandidateDispositionEnum,
    createdAt: z.string(),
  })
  .passthrough();

export type MatchCandidate = z.infer<typeof matchCandidateSchema>;

// ---------------------------------------------------------------------------
// Ranked list + shortlist aggregates
// ---------------------------------------------------------------------------

/**
 * MatchRankedList — GET /matches/:id response shape.
 * Includes the run + candidates ordered fit_score DESC.
 */
export const matchRankedListSchema = z
  .object({
    run: matchRunSchema,
    /** Candidates ordered by fit_score DESC (deterministic, no LLM). */
    candidates: z.array(matchCandidateSchema),
  })
  .passthrough();

export type MatchRankedList = z.infer<typeof matchRankedListSchema>;

/**
 * Shortlist — GET /matches/:id/shortlist response.
 * Candidates with disposition='accepted', ordered fit_score DESC.
 */
export const shortlistSchema = z
  .object({
    run: matchRunSchema,
    /** Accepted candidates only, ordered fit_score DESC. */
    accepted: z.array(matchCandidateSchema),
  })
  .passthrough();

export type Shortlist = z.infer<typeof shortlistSchema>;

// ---------------------------------------------------------------------------
// Input schemas (all .strict())
// ---------------------------------------------------------------------------

/**
 * matchRunCreateInputSchema — body for POST /matches.
 * mandateId is the only required field; the service resolves the universe.
 *
 * INPUT schema: .strict() — no extra fields allowed.
 */
export const matchRunCreateInputSchema = z
  .object({
    /** The mandate UUID to run matching for. */
    mandateId: z.string().uuid(),
  })
  .strict();

export type MatchRunCreateInput = z.infer<typeof matchRunCreateInputSchema>;

/**
 * dispositionInputSchema — body for PATCH /matches/:id/candidates/:cid.
 * Updates the disposition of a single match candidate.
 *
 * INPUT schema: .strict() — no extra fields allowed.
 */
export const dispositionInputSchema = z
  .object({
    disposition: matchCandidateDispositionEnum,
  })
  .strict();

export type DispositionInput = z.infer<typeof dispositionInputSchema>;

/**
 * handoffInputSchema — body for POST /matches/:id/handoff.
 * No additional fields — service validates ≥1 accepted candidate.
 *
 * INPUT schema: .strict() — no extra fields allowed.
 */
export const handoffInputSchema = z.object({}).strict();

export type HandoffInput = z.infer<typeof handoffInputSchema>;

/**
 * matchListFilterSchema — query params for GET /matches?mandateId=.
 *
 * NOT .strict() — extra query params are ignored.
 */
export const matchListFilterSchema = z
  .object({
    mandateId: z.string().uuid().optional(),
  })
  .passthrough();

export type MatchListFilter = z.infer<typeof matchListFilterSchema>;
