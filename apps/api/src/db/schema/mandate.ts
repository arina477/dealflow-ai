import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { disclaimerTemplates } from './compliance-rules';
import { users } from './users-roles';

/**
 * Wave-8 mandate spine (B-0, task ba0edebf).
 *
 * Three MUTABLE tables:
 *   1. mandates                  — the top-level mandate record (seller + deal metadata)
 *   2. mandate_buyer_criteria    — queryable buyer-side criteria (1:1 or 1:N per mandate)
 *   3. mandate_compliance_profile — jurisdiction + disclaimer + suppression + 3 attestations (1:1)
 *
 * DESIGN INVARIANTS:
 *   - mandate_compliance_profile is 1:1 with mandates (UNIQUE on mandate_id).
 *   - disclaimer_template_id is the ONLY FK into disclaimer_templates; it is
 *     DERIVED server-side from input.jurisdiction at create time (never user-supplied).
 *   - All 3 attestation columns (lawful_authorization, ai_results_validated,
 *     conflict_dbs_reviewed) must be TRUE at INSERT time; validated in MandateService
 *     before the transaction begins.
 *   - created_by references users.id (app UUID, NOT supertokens_user_id). The
 *     service translates via AuthRepository.getUserWithRole (wave-5 actor-id-FK lesson).
 *
 * MUTABILITY NOTE:
 *   Standard DML permitted. All mandate mutations are audited via AuditService.append
 *   in the same transaction (audit fail → whole tx rolls back).
 *
 * Additive-only — no existing table is altered.
 */

// ---------------------------------------------------------------------------
// pgEnum
// ---------------------------------------------------------------------------

/**
 * mandate_status — lifecycle of a mandate.
 *   draft  — the default on creation; can be configured/edited.
 *   active — mandate is live and visible to matching engines.
 */
export const mandateStatusPgEnum = pgEnum('mandate_status', ['draft', 'active']);

// ---------------------------------------------------------------------------
// 1. mandates
// ---------------------------------------------------------------------------

/**
 * mandates — the top-level mandate record.
 *
 * created_by: NOT NULL FK to users.id (app UUID). SET to restrict on user
 *   deletion (mandates must outlive their creator for recordkeeping; the
 *   platform admin handles orphaned mandates administratively).
 *
 * seller_geo: text[] — multi-geography support (e.g. ['US', 'EU']).
 *   Nullable: a mandate may not specify a seller geography restriction.
 *
 * seller_size_band: text — categorical size bucket (e.g. 'mid-market').
 *   Nullable: no constraint required.
 *
 * status: default 'draft' — mandates start in draft; transition to 'active'
 *   via the configure endpoint (service sets status=active when complete).
 *
 * updated_at: application-layer clock via Drizzle's .$onUpdateFn.
 *   NULL until first update.
 */
export const mandates = pgTable(
  'mandates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /**
     * App users.id of the creating advisor (NOT supertokens_user_id).
     * The MandateService translates the session's ST id via getUserWithRole
     * before this FK is populated. The wave-5 actor-id-FK lesson.
     */
    createdBy: uuid('created_by').notNull(),

    /** Seller company name — required at create time. */
    sellerName: text('seller_name').notNull(),

    /** Industry / sector of the seller — optional metadata. */
    sellerIndustry: text('seller_industry'),

    /** Geography array (ISO-3166 codes or labels). Nullable. */
    sellerGeo: text('seller_geo').array(),

    /** Size band label (e.g. 'small', 'mid-market', 'large'). Nullable. */
    sellerSizeBand: text('seller_size_band'),

    /** Free-text description of the deal or seller. Nullable. */
    description: text('description'),

    /** Deal type label (e.g. 'acquisition', 'merger', 'carve-out'). Nullable. */
    dealType: text('deal_type'),

    /**
     * Lifecycle status. 'draft' on creation; transitions to 'active'
     * via configureAsActor when the mandate is complete.
     */
    status: mandateStatusPgEnum('status').notNull().default('draft'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    /**
     * Application-layer updated_at (Drizzle .$onUpdateFn).
     * NULL until first UPDATE.
     */
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),
  },
  (table) => [
    foreignKey({
      name: 'mandates_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),

    /** Status-scoped listing: WHERE status = $1 ORDER BY created_at. */
    index('mandates_status_created_at_idx').on(table.status, table.createdAt),

    /** Creator-scoped listing: WHERE created_by = $1. */
    index('mandates_created_by_idx').on(table.createdBy),
  ]
);

// ---------------------------------------------------------------------------
// 2. mandate_buyer_criteria
// ---------------------------------------------------------------------------

/**
 * mandate_buyer_criteria — buyer-side targeting criteria for a mandate.
 *
 * One row per mandate (1:1 in practice for this wave; the schema supports
 * multiple rows per mandate if needed in future waves). The buyer criteria
 * are the searchable facets used by the matching engine to find buyer-side
 * counterparties.
 *
 * All columns are nullable — the criteria are optional at each dimension;
 * a missing value means "no restriction on this dimension".
 */
export const mandateBuyerCriteria = pgTable(
  'mandate_buyer_criteria',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → mandates.id — which mandate these criteria belong to. */
    mandateId: uuid('mandate_id').notNull(),

    /** Preferred buyer industry sector. Nullable — no restriction. */
    industry: text('industry'),

    /** Preferred buyer geography. Nullable — no restriction. */
    geo: text('geo'),

    /** Preferred buyer size band. Nullable — no restriction. */
    sizeBand: text('size_band'),

    /** Preferred deal type. Nullable — no restriction. */
    dealType: text('deal_type'),
  },
  (table) => [
    foreignKey({
      name: 'mandate_buyer_criteria_mandate_id_fk',
      columns: [table.mandateId],
      foreignColumns: [mandates.id],
    }).onDelete('cascade'),

    /** Mandate-scoped criteria lookup. */
    index('mandate_buyer_criteria_mandate_id_idx').on(table.mandateId),
  ]
);

// ---------------------------------------------------------------------------
// 3. mandate_compliance_profile
// ---------------------------------------------------------------------------

/**
 * mandate_compliance_profile — jurisdiction, disclaimer, and attestations.
 *
 * 1:1 with mandates (UNIQUE on mandate_id). The profile captures the
 * compliance context for the mandate — which jurisdiction's rules apply,
 * which disclaimer template is attached (derived from jurisdiction at
 * create time — NEVER user-supplied), and the three mandatory attestations.
 *
 * DISCLAIMER FK INVARIANT (karen note):
 *   disclaimer_template_id is the ONE FK into disclaimer_templates.id.
 *   The MandateService DERIVES this FK by querying the active disclaimer
 *   template for input.jurisdiction. If no active template exists for the
 *   given jurisdiction, the service throws BadRequestException (400) and
 *   the transaction never commits. The FK value is NEVER sourced from the
 *   request body.
 *
 * ACKNOWLEDGMENTS (D5 — 3 attestation booleans):
 *   lawful_authorization   — actor confirms lawful authority for the mandate.
 *   ai_results_validated   — actor confirms AI results were reviewed.
 *   conflict_dbs_reviewed  — actor confirms conflict databases were checked.
 *   All three MUST be TRUE at INSERT time; the MandateService validates this
 *   before the transaction and the mandateCreateSchema enforces z.literal(true).
 *
 * suppression_scope (D4): JSONB — captures the suppression context as a
 *   structured payload. Nullable if no additional suppression scope is declared.
 */
export const mandateComplianceProfile = pgTable(
  'mandate_compliance_profile',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → mandates.id — UNIQUE (1:1 per mandate). */
    mandateId: uuid('mandate_id').notNull(),

    /**
     * Jurisdiction label (ISO-3166 or custom label, e.g. 'US', 'EU', 'UK').
     * Used to DERIVE disclaimer_template_id at create time.
     * NOT NULL — every mandate must declare a jurisdiction for compliance.
     */
    jurisdiction: text('jurisdiction').notNull(),

    /**
     * FK → disclaimer_templates.id — THE SINGLE FK into disclaimer_templates.
     * Derived server-side: MandateService queries
     *   WHERE jurisdiction = input.jurisdiction AND active = TRUE
     * If no match, the CREATE fails with 400. Never populated from user input.
     */
    disclaimerTemplateId: uuid('disclaimer_template_id').notNull(),

    /**
     * Suppression scope (D4): structured payload capturing who/what is
     * suppressed under this mandate's outreach. JSONB — flexible shape.
     * Nullable if no explicit suppression scope is declared.
     */
    suppressionScope: jsonb('suppression_scope'),

    /**
     * Attestation 1 (D5): actor confirms lawful authorization to run this mandate.
     * Must be TRUE at INSERT. Default false for DB integrity; service enforces TRUE.
     */
    lawfulAuthorization: boolean('lawful_authorization').notNull().default(false),

    /**
     * Attestation 2 (D5): actor confirms AI-generated results were validated.
     * Must be TRUE at INSERT. Default false for DB integrity; service enforces TRUE.
     */
    aiResultsValidated: boolean('ai_results_validated').notNull().default(false),

    /**
     * Attestation 3 (D5): actor confirms conflict databases were reviewed.
     * Must be TRUE at INSERT. Default false for DB integrity; service enforces TRUE.
     */
    conflictDbsReviewed: boolean('conflict_dbs_reviewed').notNull().default(false),
  },
  (table) => [
    /**
     * 1:1 invariant — each mandate has at most one compliance profile.
     * UNIQUE on mandate_id enforces this at the DB level.
     */
    unique('mandate_compliance_profile_mandate_id_unique').on(table.mandateId),

    foreignKey({
      name: 'mandate_compliance_profile_mandate_id_fk',
      columns: [table.mandateId],
      foreignColumns: [mandates.id],
    }).onDelete('cascade'),

    /**
     * The ONE FK into disclaimer_templates (karen precision note).
     * disclaimer_template_id is derived server-side from jurisdiction;
     * never user-supplied. ON DELETE RESTRICT — a disclaimer template row
     * cannot be hard-deleted if a mandate profile references it.
     */
    foreignKey({
      name: 'mandate_compliance_profile_disclaimer_template_id_fk',
      columns: [table.disclaimerTemplateId],
      foreignColumns: [disclaimerTemplates.id],
    }).onDelete('restrict'),
  ]
);
