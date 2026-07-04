/**
 * OutreachRepository — Drizzle queries for the outreach spine.
 *
 * Covers:
 *   - outreach_templates CRUD (insert, find by id, list)
 *   - outreach_template_versions CRUD (insert, find by id, list by template,
 *     find max version number, update approval state)
 *   - outreach INSERT + find by id
 *   - disclaimer_templates lookup (validate required-block reference)
 *   - Transaction composition (runInTransaction for all services)
 *
 * All table writes catch pg FK/unique violations by unwrapping
 * err.cause.code (DrizzleQueryError wrapper) before falling back to err.code
 * (bare pg driver) — the wave-6 DrizzleQueryError lesson.
 *
 * Business logic, audit, and role checks live in the service layer — this
 * class is a pure Drizzle query repository.
 *
 * BUILD RULE 7: every read inside runInTransaction MUST use the tx handle,
 * not this.db, to ensure reads are consistent within the transaction.
 */

import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { disclaimerTemplates } from '../../db/schema/compliance-rules';
import { outreach, outreachTemplates, outreachTemplateVersions } from '../../db/schema/outreach';

// ---------------------------------------------------------------------------
// Row type aliases
// ---------------------------------------------------------------------------

export type OutreachTemplateRow = typeof outreachTemplates.$inferSelect;
export type OutreachTemplateVersionRow = typeof outreachTemplateVersions.$inferSelect;
export type OutreachRow = typeof outreach.$inferSelect;

/** Tx type for transaction-composable writes (used by all services). */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// DrizzleError unwrap helper (wave-6 lesson)
// ---------------------------------------------------------------------------

/**
 * Extract the pg error code from either:
 *   err.cause.code — DrizzleQueryError wraps the native pg error in .cause
 *   err.code       — bare pg driver error (e.g. connection-level throws)
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
export class OutreachRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Transaction helper
  // ---------------------------------------------------------------------------

  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  // ---------------------------------------------------------------------------
  // Disclaimer validation (required-block check for requestApproval)
  // ---------------------------------------------------------------------------

  /**
   * findDisclaimerById — validates that a disclaimer_templates row exists for the
   * given id. Used by TemplateService.requestApproval to enforce the required-block
   * constraint (400 if no valid disclaimer row exists).
   *
   * Called INSIDE a transaction (tx) for consistency.
   */
  async findDisclaimerById(tx: Tx, disclaimerId: string): Promise<{ id: string } | null> {
    const rows = await tx
      .select({ id: disclaimerTemplates.id })
      .from(disclaimerTemplates)
      .where(eq(disclaimerTemplates.id, disclaimerId))
      .limit(1);
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // outreach_templates
  // ---------------------------------------------------------------------------

  /**
   * insertTemplate — inserts the top-level outreach_templates row.
   * Called inside a transaction for atomicity with the v1 version insert.
   */
  async insertTemplate(
    tx: Tx,
    input: {
      name: string;
      mandateScope: string | null;
      ownerId: string;
    }
  ): Promise<OutreachTemplateRow> {
    let rows: OutreachTemplateRow[];
    try {
      rows = await tx
        .insert(outreachTemplates)
        .values({
          name: input.name,
          mandateScope: input.mandateScope ?? undefined,
          ownerId: input.ownerId,
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      // 23503 = foreign_key_violation (owner_id user not found)
      if (code === '23503') {
        throw new BadRequestException('Invalid actor: user not found in app-DB (FK violation)');
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('OutreachRepository: INSERT outreach_templates returned no row');
    }
    return row;
  }

  /**
   * findTemplateById — look up a template by UUID.
   * Returns null if not found. Uses module-level DB (outside tx).
   */
  async findTemplateById(id: string): Promise<OutreachTemplateRow | null> {
    const rows = await this.db
      .select()
      .from(outreachTemplates)
      .where(eq(outreachTemplates.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findTemplateByIdInTx — transaction-aware lookup.
   * Used inside transactions (BUILD rule 7: use tx handle inside runInTransaction).
   */
  async findTemplateByIdInTx(tx: Tx, id: string): Promise<OutreachTemplateRow | null> {
    const rows = await tx
      .select()
      .from(outreachTemplates)
      .where(eq(outreachTemplates.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * listTemplates — returns all outreach templates ordered by created_at DESC.
   */
  async listTemplates(): Promise<OutreachTemplateRow[]> {
    return this.db
      .select()
      .from(outreachTemplates)
      .orderBy(sql`${outreachTemplates.createdAt} DESC`);
  }

  // ---------------------------------------------------------------------------
  // outreach_template_versions
  // ---------------------------------------------------------------------------

  /**
   * findMaxVersionNumber — returns the current highest version_number for a
   * given template_id (used to compute the next monotonic version).
   * Returns 0 if no versions exist yet.
   * Called INSIDE a transaction (tx).
   */
  async findMaxVersionNumber(tx: Tx, templateId: string): Promise<number> {
    const rows = await tx
      .select({
        maxVersion: sql<number>`COALESCE(MAX(${outreachTemplateVersions.versionNumber}), 0)`,
      })
      .from(outreachTemplateVersions)
      .where(eq(outreachTemplateVersions.templateId, templateId));
    return rows[0]?.maxVersion ?? 0;
  }

  /**
   * insertVersion — inserts an outreach_template_versions row.
   * content_hash is computed by the caller (TemplateService) via computeContentHash.
   * Called inside a transaction.
   */
  async insertVersion(
    tx: Tx,
    input: {
      templateId: string;
      versionNumber: number;
      subject: string;
      body: string;
      disclaimerTemplateId: string;
      contentHash: string;
    }
  ): Promise<OutreachTemplateVersionRow> {
    let rows: OutreachTemplateVersionRow[];
    try {
      rows = await tx
        .insert(outreachTemplateVersions)
        .values({
          templateId: input.templateId,
          versionNumber: input.versionNumber,
          subject: input.subject,
          body: input.body,
          disclaimerTemplateId: input.disclaimerTemplateId,
          contentHash: input.contentHash,
          // approvalStatus defaults to 'pending'; approvedContentHash and approvedBy stay NULL.
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      // 23505 = unique_violation (template_id, version_number partial unique)
      if (code === '23505') {
        throw new ConflictException(
          `Version ${input.versionNumber} already exists for template ${input.templateId}`
        );
      }
      // 23503 = foreign_key_violation (template_id or disclaimer_template_id not found)
      if (code === '23503') {
        throw new BadRequestException(
          'FK violation in version insert: template or disclaimer template not found'
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('OutreachRepository: INSERT outreach_template_versions returned no row');
    }
    return row;
  }

  /**
   * findVersionById — look up a version by UUID.
   * Returns null if not found. Uses module-level DB (outside tx).
   */
  async findVersionById(id: string): Promise<OutreachTemplateVersionRow | null> {
    const rows = await this.db
      .select()
      .from(outreachTemplateVersions)
      .where(eq(outreachTemplateVersions.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findVersionByIdInTx — transaction-aware version lookup.
   * BUILD rule 7: use tx handle for reads inside runInTransaction.
   */
  async findVersionByIdInTx(tx: Tx, id: string): Promise<OutreachTemplateVersionRow | null> {
    const rows = await tx
      .select()
      .from(outreachTemplateVersions)
      .where(eq(outreachTemplateVersions.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * listVersionsByTemplateId — returns all versions for a template, ordered by
   * version_number DESC (newest first).
   */
  async listVersionsByTemplateId(templateId: string): Promise<OutreachTemplateVersionRow[]> {
    return this.db
      .select()
      .from(outreachTemplateVersions)
      .where(eq(outreachTemplateVersions.templateId, templateId))
      .orderBy(sql`${outreachTemplateVersions.versionNumber} DESC`);
  }

  /**
   * updateVersionApproval — updates the approval state of a version.
   * Called by ApprovalService.grantApproval and .reject inside a transaction.
   *
   * For grantApproval: sets approvalStatus='approved', approvedContentHash=contentHash,
   *   approvedBy=actorId.
   * For reject: sets approvalStatus='rejected' (approvedContentHash + approvedBy unchanged).
   */
  async updateVersionApproval(
    tx: Tx,
    versionId: string,
    patch: {
      approvalStatus: 'approved' | 'rejected';
      approvedContentHash?: string;
      approvedBy?: string;
    }
  ): Promise<OutreachTemplateVersionRow> {
    const updateValues: Record<string, unknown> = {
      approvalStatus: patch.approvalStatus,
    };
    if (patch.approvedContentHash !== undefined) {
      updateValues.approvedContentHash = patch.approvedContentHash;
    }
    if (patch.approvedBy !== undefined) {
      updateValues.approvedBy = patch.approvedBy;
    }

    const rows = await tx
      .update(outreachTemplateVersions)
      .set(updateValues as Partial<typeof outreachTemplateVersions.$inferInsert>)
      .where(eq(outreachTemplateVersions.id, versionId))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error(
        `OutreachRepository: UPDATE outreach_template_versions returned no row for ${versionId}`
      );
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // outreach
  // ---------------------------------------------------------------------------

  /**
   * insertOutreach — inserts an outreach record.
   * Called INSIDE a transaction by OutreachService.composeAsActor AFTER
   * ComplianceGateService.evaluate() has run. The gate_verdict and status
   * are always populated from the evaluate() result — never defaulted.
   */
  async insertOutreach(
    tx: Tx,
    input: {
      mandateId: string;
      matchCandidateId: string;
      templateVersionId: string;
      gateVerdict: object;
      status: 'send_eligible' | 'blocked';
      createdBy: string;
    }
  ): Promise<OutreachRow> {
    let rows: OutreachRow[];
    try {
      rows = await tx
        .insert(outreach)
        .values({
          mandateId: input.mandateId,
          matchCandidateId: input.matchCandidateId,
          templateVersionId: input.templateVersionId,
          gateVerdict: input.gateVerdict,
          status: input.status,
          createdBy: input.createdBy,
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      // 23503 = foreign_key_violation
      if (code === '23503') {
        throw new BadRequestException(
          'FK violation in outreach insert: mandate, candidate, version, or user not found'
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('OutreachRepository: INSERT outreach returned no row');
    }
    return row;
  }

  /**
   * findOutreachById — look up an outreach record by UUID.
   * Returns null if not found. Uses module-level DB (outside tx).
   */
  async findOutreachById(id: string): Promise<OutreachRow | null> {
    const rows = await this.db.select().from(outreach).where(eq(outreach.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * listOutreach — returns outreach records optionally filtered by mandateId,
   * ordered by created_at DESC.
   */
  async listOutreach(filter?: { mandateId?: string }): Promise<OutreachRow[]> {
    if (filter?.mandateId) {
      return this.db
        .select()
        .from(outreach)
        .where(eq(outreach.mandateId, filter.mandateId))
        .orderBy(sql`${outreach.createdAt} DESC`);
    }
    return this.db.select().from(outreach).orderBy(sql`${outreach.createdAt} DESC`);
  }

  // ---------------------------------------------------------------------------
  // Pending-approval list (compliance queue)
  // ---------------------------------------------------------------------------

  /**
   * listPendingVersions — returns all outreach_template_versions with
   * approvalStatus = 'pending', ordered by created_at ASC (oldest first).
   * Used by the compliance queue view.
   */
  async listPendingVersions(): Promise<OutreachTemplateVersionRow[]> {
    return this.db
      .select()
      .from(outreachTemplateVersions)
      .where(and(eq(outreachTemplateVersions.approvalStatus, 'pending')))
      .orderBy(sql`${outreachTemplateVersions.createdAt} ASC`);
  }
}
