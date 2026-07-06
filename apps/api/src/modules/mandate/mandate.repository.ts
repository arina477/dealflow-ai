/**
 * MandateRepository — Drizzle queries for the mandate spine.
 *
 * Covers:
 *   - Mandate CRUD (insert, find by id, list with filter, update)
 *   - Buyer criteria insert + upsert (cascade on mandate delete)
 *   - Compliance profile insert (1:1 per mandate)
 *   - Disclaimer template lookup by jurisdiction (server-side derivation — D2)
 *   - Transaction composition (runInTransaction for the service)
 *
 * All table writes catch pg FK/unique violations by unwrapping
 * err.cause.code (DrizzleQueryError wrapper) before falling back to err.code
 * (bare pg driver) — the wave-6 DrizzleQueryError lesson.
 *
 * Business logic, audit, and role checks live in MandateService — this
 * class is a pure Drizzle query repository.
 */

import type { MandateListFilter } from '@dealflow/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { getDb, getWorkspaceId } from '../../db/workspace-context';
import { DEFAULT_WORKSPACE_ID } from '../../db/schema/workspaces';
import { workspaceSettings } from '../../db/schema/admin-settings';
import { disclaimerTemplates } from '../../db/schema/compliance-rules';
import { mandateBuyerCriteria, mandateComplianceProfile, mandates } from '../../db/schema/mandate';

export type MandateRow = typeof mandates.$inferSelect;
export type MandateBuyerCriteriaRow = typeof mandateBuyerCriteria.$inferSelect;
export type MandateComplianceProfileRow = typeof mandateComplianceProfile.$inferSelect;
export type DisclaimerTemplateRow = typeof disclaimerTemplates.$inferSelect;

/** Tx type for transaction-composable writes (used by MandateService). */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Extract the pg error code from either:
 *   err.cause.code — DrizzleQueryError wraps the native pg error in .cause
 *   err.code       — bare pg driver error (e.g. connection-level throws)
 *
 * The wave-6 DrizzleQueryError lesson: drizzle-orm wraps query errors in a
 * DrizzleQueryError whose own `.code` is undefined; the SQLSTATE lives on
 * err.cause.code. Check both so the catch branch fires regardless of wrapper.
 */
function pgCode(err: unknown): string | undefined {
  const causeCode =
    typeof err === 'object' &&
    err !== null &&
    'cause' in err &&
    typeof (err as { cause: unknown }).cause === 'object' &&
    (err as { cause: unknown }).cause !== null &&
    'code' in (err as { cause: Record<string, unknown> }).cause
      ? (err as { cause: Record<string, unknown> }).cause.code
      : undefined;

  const directCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code: unknown }).code
      : undefined;

  return (causeCode ?? directCode) as string | undefined;
}

@Injectable()
export class MandateRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Transaction helper
  // ---------------------------------------------------------------------------

  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return getDb(this.db).transaction(work);
  }

  // ---------------------------------------------------------------------------
  // Firm defaults lookup (compliance-default cascade — BUILD rule 7)
  // ---------------------------------------------------------------------------

  /**
   * findWorkspaceSettingsInTx — reads the single workspace_settings row inside
   * the provided transaction snapshot (BUILD rule 7: tx-scoped read, not a
   * module-level off-snapshot read). Returns null when no settings row exists.
   *
   * Called inside createAsActor's transaction so the cascade resolution is
   * consistent with the other writes in the same atomic unit.
   */
  async findWorkspaceSettingsInTx(tx: Tx): Promise<typeof workspaceSettings.$inferSelect | null> {
    const rows = await tx.select().from(workspaceSettings).limit(1);
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Disclaimer lookup (D2 — server-side jurisdiction→disclaimer derivation)
  // ---------------------------------------------------------------------------

  /**
   * findActiveDisclaimerByJurisdiction — looks up the active disclaimer template
   * for the given jurisdiction.
   *
   * Ambiguity-safe logic (CRITICAL-3):
   *   0 active rows → returns null (service throws BadRequestException 400).
   *   1 active row  → returns that row.
   *  >1 active rows → throws ConflictException (ambiguous compliance config — do
   *                   NOT silently pick an arbitrary disclaimer). The caller must
   *                   fix the disclaimer_templates data before proceeding.
   *
   * Deterministic: selects ALL active rows (no LIMIT 1 without ORDER BY) then
   * checks count explicitly. This eliminates the "arbitrary pick" hazard when
   * the DB has two active rows for the same jurisdiction.
   *
   * Called INSIDE the creation transaction (tx) so the lookup is consistent
   * with the rest of the atomic insert.
   */
  async findActiveDisclaimerByJurisdiction(
    tx: Tx,
    jurisdiction: string
  ): Promise<DisclaimerTemplateRow | null> {
    const rows = await tx
      .select()
      .from(disclaimerTemplates)
      .where(
        and(
          eq(disclaimerTemplates.jurisdiction, jurisdiction),
          eq(disclaimerTemplates.active, true)
        )
      )
      // ORDER BY version DESC so the result is deterministic in tests and in
      // the ambiguity check below. For ">1" we still reject — ORDER BY is
      // tiebreak documentation, NOT a "latest wins" policy.
      .orderBy(sql`${disclaimerTemplates.version} DESC`);

    if (rows.length === 0) {
      return null;
    }
    if (rows.length > 1) {
      throw new ConflictException(
        `Ambiguous disclaimer configuration: ${rows.length} active disclaimer templates ` +
          `found for jurisdiction "${jurisdiction}". Deactivate all but one before creating ` +
          'a mandate for this jurisdiction.'
      );
    }
    // Exactly one — deterministic, safe.
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Available jurisdictions (GET /mandates/jurisdictions)
  // ---------------------------------------------------------------------------

  /**
   * listAvailableJurisdictions — returns DISTINCT jurisdictions that have at
   * least one active disclaimer template.
   *
   * This is the advisor-readable "which jurisdictions can I pick" query. It
   * returns only the jurisdiction strings — no template body, version, or id —
   * to avoid leaking compliance content to non-compliance roles.
   *
   * ORDER BY jurisdiction ASC for stable, alphabetical dropdown ordering.
   */
  async listAvailableJurisdictions(): Promise<Array<{ jurisdiction: string }>> {
    const rows = await getDb(this.db)
      .selectDistinct({ jurisdiction: disclaimerTemplates.jurisdiction })
      .from(disclaimerTemplates)
      .where(eq(disclaimerTemplates.active, true))
      .orderBy(disclaimerTemplates.jurisdiction);
    return rows;
  }

  // ---------------------------------------------------------------------------
  // Mandate CRUD
  // ---------------------------------------------------------------------------

  /**
   * insertMandate — inserts the top-level mandate row.
   * Must be called within a transaction (tx) for atomicity with the
   * buyer criteria + compliance profile inserts and the audit append.
   */
  async insertMandate(
    tx: Tx,
    input: {
      createdBy: string;
      sellerName: string;
      sellerIndustry: string | null;
      sellerGeo: string[] | null;
      sellerSizeBand: string | null;
      description: string | null;
      dealType: string | null;
    }
  ): Promise<MandateRow> {
    let rows: MandateRow[];
    try {
      rows = await tx
        .insert(mandates)
        .values({
          createdBy: input.createdBy,
          sellerName: input.sellerName,
          sellerIndustry: input.sellerIndustry ?? undefined,
          sellerGeo: input.sellerGeo ?? undefined,
          sellerSizeBand: input.sellerSizeBand ?? undefined,
          description: input.description ?? undefined,
          dealType: input.dealType ?? undefined,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      // 23503 = foreign_key_violation (created_by user not found)
      if (code === '23503') {
        throw new BadRequestException('Invalid actor: user not found in app-DB (FK violation)');
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('MandateRepository: INSERT mandates returned no row');
    }
    return row;
  }

  /**
   * findMandateById — look up a mandate by its UUID.
   * Returns null if not found (service maps to 404).
   */
  async findMandateById(id: string): Promise<MandateRow | null> {
    const rows = await getDb(this.db).select().from(mandates).where(eq(mandates.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * findMandateByIdForUpdate — look up a mandate inside a transaction.
   * Used by configureAsActor to read-then-update within the same tx.
   */
  async findMandateByIdForUpdate(tx: Tx, id: string): Promise<MandateRow | null> {
    const rows = await tx.select().from(mandates).where(eq(mandates.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * listMandates — returns mandates matching the optional status filter.
   *
   * Filter semantics:
   *   status 'draft'  → WHERE status = 'draft'
   *   status 'active' → WHERE status = 'active'
   *   status 'all'    → no filter (returns both)
   *
   * Ordered by created_at DESC (newest first).
   */
  async listMandates(filter: MandateListFilter): Promise<MandateRow[]> {
    if (filter.status === 'all' || filter.status === undefined) {
      return getDb(this.db).select().from(mandates).orderBy(sql`${mandates.createdAt} DESC`);
    }
    return getDb(this.db)
      .select()
      .from(mandates)
      .where(eq(mandates.status, filter.status))
      .orderBy(sql`${mandates.createdAt} DESC`);
  }

  /**
   * updateMandate — applies a partial update to a mandate row.
   * Called inside a transaction (tx) for atomicity with the audit append.
   * Throws NotFoundException (404) if the row is not found after update.
   */
  async updateMandate(
    tx: Tx,
    id: string,
    patch: {
      sellerName?: string;
      sellerIndustry?: string;
      sellerGeo?: string[];
      sellerSizeBand?: string;
      description?: string;
      dealType?: string;
      status?: 'draft' | 'active';
    }
  ): Promise<MandateRow> {
    // Build a partial update — only include defined fields.
    const updateValues: Record<string, unknown> = {};
    if (patch.sellerName !== undefined) updateValues.sellerName = patch.sellerName;
    if (patch.sellerIndustry !== undefined) updateValues.sellerIndustry = patch.sellerIndustry;
    if (patch.sellerGeo !== undefined) updateValues.sellerGeo = patch.sellerGeo;
    if (patch.sellerSizeBand !== undefined) updateValues.sellerSizeBand = patch.sellerSizeBand;
    if (patch.description !== undefined) updateValues.description = patch.description;
    if (patch.dealType !== undefined) updateValues.dealType = patch.dealType;
    if (patch.status !== undefined) updateValues.status = patch.status;

    const rows = await tx
      .update(mandates)
      .set(updateValues as Partial<typeof mandates.$inferInsert>)
      .where(eq(mandates.id, id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Mandate ${id} not found`);
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // Buyer criteria
  // ---------------------------------------------------------------------------

  /**
   * insertBuyerCriteria — inserts the mandate_buyer_criteria row.
   * Must be called within the same transaction as insertMandate.
   */
  async insertBuyerCriteria(
    tx: Tx,
    input: {
      mandateId: string;
      industry: string | null;
      geo: string | null;
      sizeBand: string | null;
      dealType: string | null;
    }
  ): Promise<MandateBuyerCriteriaRow> {
    let rows: MandateBuyerCriteriaRow[];
    try {
      rows = await tx
        .insert(mandateBuyerCriteria)
        .values({
          mandateId: input.mandateId,
          industry: input.industry ?? undefined,
          geo: input.geo ?? undefined,
          sizeBand: input.sizeBand ?? undefined,
          dealType: input.dealType ?? undefined,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      if (code === '23503') {
        throw new BadRequestException(
          `Invalid mandate_id ${input.mandateId}: mandate not found (FK violation)`
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('MandateRepository: INSERT mandate_buyer_criteria returned no row');
    }
    return row;
  }

  /**
   * upsertBuyerCriteria — updates the existing buyer criteria for a mandate,
   * or does nothing if no row exists. Called by configureAsActor.
   */
  async upsertBuyerCriteria(
    tx: Tx,
    input: {
      mandateId: string;
      industry?: string;
      geo?: string;
      sizeBand?: string;
      dealType?: string;
    }
  ): Promise<void> {
    const updateValues: Record<string, unknown> = {};
    if (input.industry !== undefined) updateValues.industry = input.industry;
    if (input.geo !== undefined) updateValues.geo = input.geo;
    if (input.sizeBand !== undefined) updateValues.sizeBand = input.sizeBand;
    if (input.dealType !== undefined) updateValues.dealType = input.dealType;

    if (Object.keys(updateValues).length === 0) {
      return;
    }

    await tx
      .update(mandateBuyerCriteria)
      .set(updateValues as Partial<typeof mandateBuyerCriteria.$inferInsert>)
      .where(eq(mandateBuyerCriteria.mandateId, input.mandateId));
  }

  /**
   * findBuyerCriteriaByMandateId — returns the buyer criteria for a mandate.
   * Returns null if no row exists. Uses the module-level DB connection (outside tx).
   */
  async findBuyerCriteriaByMandateId(mandateId: string): Promise<MandateBuyerCriteriaRow | null> {
    const rows = await getDb(this.db)
      .select()
      .from(mandateBuyerCriteria)
      .where(eq(mandateBuyerCriteria.mandateId, mandateId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findBuyerCriteriaByMandateIdInTx — transaction-aware variant.
   * Used by configureAsActor to read buyer criteria INSIDE the configure
   * transaction so the MandateDetail response is consistent with committed state.
   */
  async findBuyerCriteriaByMandateIdInTx(
    tx: Tx,
    mandateId: string
  ): Promise<MandateBuyerCriteriaRow | null> {
    const rows = await tx
      .select()
      .from(mandateBuyerCriteria)
      .where(eq(mandateBuyerCriteria.mandateId, mandateId))
      .limit(1);
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Compliance profile
  // ---------------------------------------------------------------------------

  /**
   * insertComplianceProfile — inserts the mandate_compliance_profile row (1:1).
   * Must be called within the same transaction as insertMandate.
   *
   * UNIQUE(mandate_id) constraint: a second insert for the same mandate_id
   * raises SQLSTATE 23505 → ConflictException (409).
   */
  async insertComplianceProfile(
    tx: Tx,
    input: {
      mandateId: string;
      jurisdiction: string;
      disclaimerTemplateId: string;
      suppressionScope: unknown;
      lawfulAuthorization: boolean;
      aiResultsValidated: boolean;
      conflictDbsReviewed: boolean;
    }
  ): Promise<MandateComplianceProfileRow> {
    let rows: MandateComplianceProfileRow[];
    try {
      rows = await tx
        .insert(mandateComplianceProfile)
        .values({
          mandateId: input.mandateId,
          jurisdiction: input.jurisdiction,
          disclaimerTemplateId: input.disclaimerTemplateId,
          suppressionScope: input.suppressionScope,
          lawfulAuthorization: input.lawfulAuthorization,
          aiResultsValidated: input.aiResultsValidated,
          conflictDbsReviewed: input.conflictDbsReviewed,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      // 23505 = unique_violation — mandate_id UNIQUE constraint (1:1)
      if (code === '23505') {
        throw new ConflictException(
          `A compliance profile already exists for mandate ${input.mandateId}`
        );
      }
      // 23503 = foreign_key_violation (mandate_id or disclaimer_template_id not found)
      if (code === '23503') {
        throw new BadRequestException(
          'FK violation in compliance profile insert: mandate or disclaimer template not found'
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('MandateRepository: INSERT mandate_compliance_profile returned no row');
    }
    return row;
  }

  /**
   * findComplianceProfileByMandateId — returns the compliance profile for a mandate.
   * Returns null if no row exists. Uses the module-level DB connection (outside tx).
   */
  async findComplianceProfileByMandateId(
    mandateId: string
  ): Promise<MandateComplianceProfileRow | null> {
    const rows = await getDb(this.db)
      .select()
      .from(mandateComplianceProfile)
      .where(eq(mandateComplianceProfile.mandateId, mandateId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findComplianceProfileByMandateIdInTx — transaction-aware variant.
   * Used by configureAsActor to read the compliance profile INSIDE the configure
   * transaction so the MandateDetail response is consistent with committed state.
   */
  async findComplianceProfileByMandateIdInTx(
    tx: Tx,
    mandateId: string
  ): Promise<MandateComplianceProfileRow | null> {
    const rows = await tx
      .select()
      .from(mandateComplianceProfile)
      .where(eq(mandateComplianceProfile.mandateId, mandateId))
      .limit(1);
    return rows[0] ?? null;
  }
}
