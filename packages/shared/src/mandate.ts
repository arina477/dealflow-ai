import { z } from 'zod';

/**
 * Wave-8 mandate shared contracts (B-1, task ba0edebf).
 *
 * Read shapes mirror the DB columns — timestamps use z.string() NOT
 * z.string().datetime() because PostgreSQL wire format ("2026-07-04 04:42:20+00")
 * is not ISO-8601 and is rejected by strict datetime parsing (wave-7 lesson).
 *
 * mandateCreateSchema: the create INPUT shape. NOTE — disclaimerTemplateId is
 * NOT in the input; it is DERIVED server-side from input.compliance.jurisdiction
 * by looking up the active disclaimer_templates row (D2). If no match, the
 * service throws BadRequestException (400).
 *
 * mandateAcknowledgmentsSchema: all 3 attestations must be z.literal(true).
 * A missing or false acknowledgment is rejected at schema parse time (D5).
 */

// ---------------------------------------------------------------------------
// Status enum
// ---------------------------------------------------------------------------

export const mandateStatusEnum = z.enum(['draft', 'active']);
export type MandateStatus = z.infer<typeof mandateStatusEnum>;

// ---------------------------------------------------------------------------
// Entity read shapes (mirror DB rows — tolerant of real API shape)
// ---------------------------------------------------------------------------

/**
 * mandateSchema — mirrors the mandates table row.
 * Timestamps use z.string() (PG-wire format; NOT .datetime()).
 */
export const mandateSchema = z
  .object({
    id: z.string().uuid(),
    /** App users.id of the creating advisor (NOT supertokens_user_id). */
    createdBy: z.string().uuid(),
    sellerName: z.string(),
    sellerIndustry: z.string().nullable(),
    /** Multi-geography array, nullable if no geo restriction. */
    sellerGeo: z.array(z.string()).nullable(),
    sellerSizeBand: z.string().nullable(),
    description: z.string().nullable(),
    dealType: z.string().nullable(),
    status: mandateStatusEnum,
    // PG-wire timestamptz format — NOT ISO-8601; use z.string() not .datetime()
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export type Mandate = z.infer<typeof mandateSchema>;

/**
 * mandateBuyerCriteriaSchema — mirrors the mandate_buyer_criteria table row.
 * All criteria columns are nullable (no restriction means any value accepted).
 */
export const mandateBuyerCriteriaSchema = z
  .object({
    id: z.string().uuid(),
    mandateId: z.string().uuid(),
    industry: z.string().nullable(),
    geo: z.string().nullable(),
    sizeBand: z.string().nullable(),
    dealType: z.string().nullable(),
  })
  .strict();

export type MandateBuyerCriteria = z.infer<typeof mandateBuyerCriteriaSchema>;

/**
 * mandateComplianceProfileSchema — mirrors the mandate_compliance_profile table row.
 *
 * disclaimerTemplateId: present on read (was derived at create time);
 *   absent from the CREATE input (D2 server-side derivation).
 * suppressionScope: unknown (JSONB — schema does not constrain the shape).
 */
export const mandateComplianceProfileSchema = z
  .object({
    id: z.string().uuid(),
    mandateId: z.string().uuid(),
    jurisdiction: z.string(),
    /** The ONE FK into disclaimer_templates — derived server-side, present on read. */
    disclaimerTemplateId: z.string().uuid(),
    /** Suppression context (JSONB); nullable if no scope declared. */
    suppressionScope: z.unknown().nullable(),
    /** Attestation 1: lawful authorization. */
    lawfulAuthorization: z.boolean(),
    /** Attestation 2: AI results validated. */
    aiResultsValidated: z.boolean(),
    /** Attestation 3: conflict DBs reviewed. */
    conflictDbsReviewed: z.boolean(),
  })
  .strict();

export type MandateComplianceProfile = z.infer<typeof mandateComplianceProfileSchema>;

// ---------------------------------------------------------------------------
// Acknowledgments sub-schema (D5) — all 3 must be literal true
// ---------------------------------------------------------------------------

/**
 * mandateAcknowledgmentsSchema — the 3 mandatory attestations.
 *
 * All three fields MUST be z.literal(true). A false value or missing field
 * causes the schema to reject the input (D5 — refine/validation). The error
 * message is surfaced as a 400 BadRequestException by the controller.
 */
export const mandateAcknowledgmentsSchema = z
  .object({
    lawful_authorization: z.literal(true, {
      errorMap: () => ({
        message: 'lawful_authorization attestation is required and must be acknowledged (true)',
      }),
    }),
    ai_results_validated: z.literal(true, {
      errorMap: () => ({
        message: 'ai_results_validated attestation is required and must be acknowledged (true)',
      }),
    }),
    conflict_dbs_reviewed: z.literal(true, {
      errorMap: () => ({
        message: 'conflict_dbs_reviewed attestation is required and must be acknowledged (true)',
      }),
    }),
  })
  .strict();

export type MandateAcknowledgments = z.infer<typeof mandateAcknowledgmentsSchema>;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/**
 * mandateCreateSchema — request body for POST /mandates.
 *
 * IMPORTANT: disclaimerTemplateId is NOT in this schema — it is DERIVED
 * server-side from compliance.jurisdiction (D2). Including it in the request
 * body would allow clients to bypass the jurisdiction→disclaimer derivation.
 *
 * compliance.acknowledgments: all 3 must be true (D5). mandateAcknowledgmentsSchema
 * uses z.literal(true) so any false or missing acknowledgment is a parse error
 * (→ 400 from the controller).
 */
export const mandateCreateSchema = z
  .object({
    /** Seller company name — required. */
    sellerName: z.string().min(1),
    /** Seller industry / sector — optional. */
    sellerIndustry: z.string().optional(),
    /** Seller geography labels (ISO-3166 or custom). Optional. */
    sellerGeo: z.array(z.string().min(1)).optional(),
    /** Seller size band label. Optional. */
    sellerSizeBand: z.string().optional(),
    /** Free-text deal / seller description. Optional. */
    description: z.string().optional(),
    /** Deal type label. Optional. */
    dealType: z.string().optional(),
    /** Buyer-side targeting criteria — all fields optional (no restriction = any). */
    buyerCriteria: z
      .object({
        industry: z.string().optional(),
        geo: z.string().optional(),
        sizeBand: z.string().optional(),
        dealType: z.string().optional(),
      })
      .optional(),
    /** Compliance context — required (jurisdiction + acknowledgments are mandatory). */
    compliance: z
      .object({
        /** Jurisdiction key — used server-side to derive disclaimerTemplateId. */
        jurisdiction: z.string().min(1),
        /** Suppression scope payload. Optional. */
        suppressionScope: z.unknown().optional(),
        /**
         * All 3 mandatory attestations (D5). Use z.literal(true) so any
         * false or missing value is a parse-level rejection → 400.
         * NO disclaimerTemplateId here — derived server-side (D2).
         * .strict() here ensures no extra keys (e.g. disclaimerTemplateId)
         * can be sneaked into the compliance object from a client request.
         */
        acknowledgments: mandateAcknowledgmentsSchema,
      })
      .strict(),
  })
  .strict();

export type MandateCreateInput = z.infer<typeof mandateCreateSchema>;

/**
 * mandateConfigureSchema — request body for PATCH /mandates/:id.
 *
 * Partial update for draft mandates. Status can be advanced to 'active'
 * when the mandate is complete. Buyer criteria can be updated.
 * Compliance fields are not re-configurable after creation (the jurisdiction
 * and disclaimer are fixed; attestations cannot be retracted).
 */
export const mandateConfigureSchema = z
  .object({
    sellerName: z.string().min(1).optional(),
    sellerIndustry: z.string().optional(),
    sellerGeo: z.array(z.string().min(1)).optional(),
    sellerSizeBand: z.string().optional(),
    description: z.string().optional(),
    dealType: z.string().optional(),
    /** Advance to 'active' when the mandate is complete. */
    status: mandateStatusEnum.optional(),
    /** Updated buyer-side criteria — all fields optional. */
    buyerCriteria: z
      .object({
        industry: z.string().optional(),
        geo: z.string().optional(),
        sizeBand: z.string().optional(),
        dealType: z.string().optional(),
      })
      .optional(),
  })
  .strict();

export type MandateConfigureInput = z.infer<typeof mandateConfigureSchema>;

// ---------------------------------------------------------------------------
// Filter / query types for the mandates list
// ---------------------------------------------------------------------------

/**
 * MandateListFilter — query parameters for GET /mandates.
 * status 'all' means no filter applied; absent defaults to 'all'.
 */
export const mandateListFilterSchema = z
  .object({
    status: z.enum(['draft', 'active', 'all']).optional().default('all'),
  })
  .strict();

export type MandateListFilter = z.infer<typeof mandateListFilterSchema>;

// ---------------------------------------------------------------------------
// Aggregate detail type
// ---------------------------------------------------------------------------

/**
 * MandateDetail — GET /mandates/:id response shape.
 * Includes the mandate row + its associated buyer criteria + compliance profile.
 * buyerCriteria and complianceProfile are nullable until created.
 */
export const mandateDetailSchema = z
  .object({
    mandate: mandateSchema,
    buyerCriteria: mandateBuyerCriteriaSchema.nullable(),
    complianceProfile: mandateComplianceProfileSchema.nullable(),
  })
  .strict();

export type MandateDetail = z.infer<typeof mandateDetailSchema>;
