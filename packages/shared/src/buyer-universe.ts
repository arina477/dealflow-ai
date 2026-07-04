import { z } from 'zod';

/**
 * Wave-9 buyer-universe shared contracts (B-1, task 92a8ff3f).
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
 * M4/M5 BOUNDARY: NO score / rank / fit field appears anywhere in this file.
 * Those fields belong to M5 (ranking). The boundary test in buyer-universe.spec.ts
 * asserts this explicitly.
 */

// ---------------------------------------------------------------------------
// Status enums
// ---------------------------------------------------------------------------

export const buyerUniverseStatusEnum = z.enum(['draft', 'filtered', 'submitted']);
export type BuyerUniverseStatus = z.infer<typeof buyerUniverseStatusEnum>;

export const buyerUniverseCandidateMembershipStatusEnum = z.enum([
  'candidate',
  'included',
  'excluded',
]);
export type BuyerUniverseCandidateMembershipStatus = z.infer<
  typeof buyerUniverseCandidateMembershipStatusEnum
>;

// ---------------------------------------------------------------------------
// Entity read shapes (mirror DB rows — tolerant of real API shape)
// ---------------------------------------------------------------------------

/**
 * buyerUniverseSchema — mirrors the buyer_universe table row.
 * Timestamps use z.string() (PG-wire format; NOT .datetime()).
 *
 * READ schema: .passthrough() — extra server-added fields are forwarded.
 * NOT .strict() — future server columns do not break existing clients.
 */
export const buyerUniverseSchema = z
  .object({
    id: z.string().uuid(),
    /** FK → mandates.id */
    mandateId: z.string().uuid(),
    /** App users.id of the creating actor (NOT supertokens_user_id). */
    createdBy: z.string().uuid(),
    status: buyerUniverseStatusEnum,
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .passthrough();

export type BuyerUniverse = z.infer<typeof buyerUniverseSchema>;

/**
 * buyerUniverseCandidateSchema — mirrors the buyer_universe_candidates table row.
 * provenance is nullable (may not be set for edge-case candidates).
 *
 * READ schema: .passthrough() — extra server-added fields are forwarded.
 */
export const buyerUniverseCandidateSchema = z
  .object({
    id: z.string().uuid(),
    /** FK → buyer_universe.id */
    buyerUniverseId: z.string().uuid(),
    /** FK → companies.id (the M3 canonical company). */
    companyId: z.string().uuid(),
    membershipStatus: buyerUniverseCandidateMembershipStatusEnum,
    /** Provenance / reason string. Nullable. */
    provenance: z.string().nullable(),
    createdAt: z.string(),
  })
  .passthrough();

export type BuyerUniverseCandidate = z.infer<typeof buyerUniverseCandidateSchema>;

// ---------------------------------------------------------------------------
// Enrich — enriched candidate view (candidate + attached M3 contacts)
// ---------------------------------------------------------------------------

/**
 * enrichedContactSchema — a single M3 contact attached to a candidate company.
 * READ schema: .passthrough() — extra fields forwarded.
 */
export const enrichedContactSchema = z
  .object({
    id: z.string().uuid(),
    companyId: z.string().uuid(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    normalizedEmail: z.string().nullable(),
    title: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .passthrough();

export type EnrichedContact = z.infer<typeof enrichedContactSchema>;

/**
 * enrichedCandidateSchema — a candidate with its attached M3 contacts.
 * contacts array is populated by enrichAsActor.
 * READ schema: .passthrough().
 */
export const enrichedCandidateSchema = buyerUniverseCandidateSchema.extend({
  contacts: z.array(enrichedContactSchema),
});

export type EnrichedCandidate = z.infer<typeof enrichedCandidateSchema>;

// ---------------------------------------------------------------------------
// Gap — candidates with missing contact data
// ---------------------------------------------------------------------------

/**
 * buyerUniverseGapSchema — a single gap entry: an included candidate that has
 * no M3 contacts or has missing key fields (email null on all contacts).
 * READ schema: .passthrough().
 */
export const buyerUniverseGapSchema = z
  .object({
    /** The candidate UUID. */
    candidateId: z.string().uuid(),
    /** The company UUID. */
    companyId: z.string().uuid(),
    /** Human-readable reason why this is flagged as a gap. */
    reason: z.string(),
  })
  .passthrough();

export type BuyerUniverseGap = z.infer<typeof buyerUniverseGapSchema>;

/**
 * buyerUniverseGapsResponseSchema — response shape for GET /buyer-universe/:id/gaps.
 */
export const buyerUniverseGapsResponseSchema = z
  .object({
    universeId: z.string().uuid(),
    gaps: z.array(buyerUniverseGapSchema),
  })
  .passthrough();

export type BuyerUniverseGapsResponse = z.infer<typeof buyerUniverseGapsResponseSchema>;

// ---------------------------------------------------------------------------
// Detail aggregate
// ---------------------------------------------------------------------------

/**
 * BuyerUniverseDetail — GET /buyer-universe/:id response shape.
 * Includes the universe row + its enriched candidates.
 * READ schema: .passthrough().
 */
export const buyerUniverseDetailSchema = z
  .object({
    universe: buyerUniverseSchema,
    candidates: z.array(enrichedCandidateSchema),
  })
  .passthrough();

export type BuyerUniverseDetail = z.infer<typeof buyerUniverseDetailSchema>;

// ---------------------------------------------------------------------------
// Input schemas (all .strict())
// ---------------------------------------------------------------------------

/**
 * buyerUniverseAssembleInputSchema — body for POST /buyer-universe.
 * mandateId is the only required field; the service does the rest.
 *
 * INPUT schema: .strict() — no extra fields allowed.
 */
export const buyerUniverseAssembleInputSchema = z
  .object({
    /** The mandate UUID to assemble a buyer universe for. */
    mandateId: z.string().uuid(),
  })
  .strict();

export type BuyerUniverseAssembleInput = z.infer<typeof buyerUniverseAssembleInputSchema>;

/**
 * buyerUniverseFilterInputSchema — body for POST /buyer-universe/:id/filter.
 * No additional fields required — the filter dimensions come from the mandate's
 * mandateBuyerCriteria (industry/geo/size_band/deal_type).
 *
 * INPUT schema: .strict().
 */
export const buyerUniverseFilterInputSchema = z.object({}).strict();

export type BuyerUniverseFilterInput = z.infer<typeof buyerUniverseFilterInputSchema>;

/**
 * buyerUniverseEnrichInputSchema — body for POST /buyer-universe/:id/enrich.
 * No additional fields required — enrichment reads existing M3 contacts.
 *
 * INPUT schema: .strict().
 */
export const buyerUniverseEnrichInputSchema = z.object({}).strict();

export type BuyerUniverseEnrichInput = z.infer<typeof buyerUniverseEnrichInputSchema>;

/**
 * buyerUniverseSubmitInputSchema — body for POST /buyer-universe/:id/submit.
 * No additional fields required.
 *
 * INPUT schema: .strict().
 */
export const buyerUniverseSubmitInputSchema = z.object({}).strict();

export type BuyerUniverseSubmitInput = z.infer<typeof buyerUniverseSubmitInputSchema>;

/**
 * buyerUniverseCandidatePatchInputSchema — body for PATCH /buyer-universe/:id/candidates/:candidateId.
 * Allows updating membership_status and/or provenance for a single candidate.
 *
 * INPUT schema: .strict().
 */
export const buyerUniverseCandidatePatchInputSchema = z
  .object({
    membershipStatus: buyerUniverseCandidateMembershipStatusEnum.optional(),
    provenance: z.string().optional(),
  })
  .strict();

export type BuyerUniverseCandidatePatchInput = z.infer<
  typeof buyerUniverseCandidatePatchInputSchema
>;

/**
 * buyerUniverseListFilterSchema — query params for GET /buyer-universe?mandateId=.
 *
 * NOT .strict() — extra query params are ignored (wave-7 class: strict filter
 * schema 400s any unexpected query parameter passed by the browser).
 */
export const buyerUniverseListFilterSchema = z
  .object({
    mandateId: z.string().uuid().optional(),
  })
  .passthrough();

export type BuyerUniverseListFilter = z.infer<typeof buyerUniverseListFilterSchema>;
