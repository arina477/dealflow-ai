/**
 * DisclaimersService (wave-5, B-2 step 2.13) — CRUD for disclaimer_templates.
 *
 * DISCLAIMER VERSIONING (append-style, load-bearing per spec block-3/4):
 *   An EDIT (PATCH) does NOT mutate an existing row. Instead, it:
 *     1. Acquires a per-jurisdiction advisory lock (pg_advisory_xact_lock on
 *        hashtext(jurisdiction)) as the FIRST statement of the tx. This
 *        serializes concurrent edits for the same jurisdiction so the
 *        read-max→deactivate→insert sequence is atomic per-jurisdiction.
 *        Two concurrent edits for different jurisdictions proceed in parallel
 *        (different lock keys). Released automatically at tx commit/rollback.
 *     2. Reads the current max(version) for the jurisdiction.
 *     3. INSERTs a new row with version = max + 1, active = true.
 *     4. Sets active = false on ALL prior rows for that jurisdiction.
 *   Steps 2–4 are in the same tx and the advisory lock guarantees no second
 *   concurrent tx can interleave steps 2–4 for the same jurisdiction.
 *
 *   DB backstop: disclaimer_templates has a partial unique index
 *   (jurisdiction) WHERE active = true (migration 0003 hand-append, wave-5
 *   B-6 CRITICAL-2 fix). If the advisory lock is somehow bypassed, the
 *   second concurrent INSERT active=true fails with SQLSTATE 23505 rather
 *   than silently creating two active rows.
 *
 * CREATE follows the same versioning: if a disclaimer for the jurisdiction
 * already exists, a new version row is inserted and prior deactivated.
 * If none exists, version=1 is the first row (active by definition).
 *
 * Every mutation writes an audit entry via AuditService.append(_, tx)
 * IN THE SAME TRANSACTION — audit-fail rolls back the mutation.
 */

import { createHash } from 'node:crypto';
import type {
  AuditEntryInput,
  DisclaimerCreate,
  DisclaimerTemplate,
  DisclaimerUpdate,
} from '@dealflow/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, max, sql } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { disclaimerTemplates } from '../../db/schema/compliance-rules';
import { DEFAULT_WORKSPACE_ID } from '../../db/schema/workspaces';
import { getDb, getWorkspaceId } from '../../db/workspace-context';
import type { Tx } from '../audit/audit.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';

function hashJson(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value, Object.keys(value as object).sort()), 'utf8')
    .digest('hex');
}

function toTemplate(row: typeof disclaimerTemplates.$inferSelect): DisclaimerTemplate {
  return {
    id: row.id,
    jurisdiction: row.jurisdiction,
    body: row.body,
    version: row.version,
    active: row.active,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class DisclaimersService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  /** GET /compliance/disclaimers — list all disclaimer rows (all versions). */
  async listDisclaimers(): Promise<DisclaimerTemplate[]> {
    const rows = await getDb(this.db).select().from(disclaimerTemplates);
    return rows.map(toTemplate);
  }

  /**
   * POST /compliance/disclaimers — create the first version for a jurisdiction,
   * or add a new version if prior rows exist. Deactivates prior rows, audit in-tx.
   */
  async createDisclaimer(
    input: DisclaimerCreate,
    actorUserId: string,
    actorRole: string
  ): Promise<DisclaimerTemplate> {
    return getDb(this.db).transaction(async (tx) => {
      // Serialize concurrent edits for the same jurisdiction via a per-jurisdiction
      // advisory lock. hashtext(jurisdiction) maps the text key to a stable int4
      // that is consistent within a single Postgres instance (same hash function
      // used by Postgres internally for hash-partitioning; not portable across
      // major versions, but stable within a running instance). The lock is
      // transaction-scoped (pg_advisory_xact_lock) and is released automatically
      // at tx commit or rollback — no explicit release needed.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.jurisdiction}))`);

      // Find the current max version for this jurisdiction (may be null if first).
      const [maxRow] = await tx
        .select({ maxVersion: max(disclaimerTemplates.version) })
        .from(disclaimerTemplates)
        .where(eq(disclaimerTemplates.jurisdiction, input.jurisdiction));

      const nextVersion = (maxRow?.maxVersion ?? 0) + 1;

      // Deactivate all prior rows for this jurisdiction (if any).
      if (nextVersion > 1) {
        await tx
          .update(disclaimerTemplates)
          .set({ active: false })
          .where(eq(disclaimerTemplates.jurisdiction, input.jurisdiction));
      }

      const [row] = await tx
        .insert(disclaimerTemplates)
        .values({
          jurisdiction: input.jurisdiction,
          body: input.body,
          version: nextVersion,
          active: true,
          createdBy: actorUserId,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning();

      if (!row) throw new Error('Insert did not return a row');

      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'disclaimer-change',
        resourceType: 'disclaimer_template',
        resourceId: row.id,
        contentHash: hashJson({ id: row.id, jurisdiction: row.jurisdiction, version: row.version }),
        payloadHash: hashJson({
          op: 'create',
          jurisdiction: input.jurisdiction,
          version: nextVersion,
        }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return toTemplate(row);
    });
  }

  /**
   * PATCH /compliance/disclaimers/:id — "edit" = append new version.
   *
   * Reads the referenced row to get the jurisdiction (and optionally body),
   * then inserts a new version row (version+1) and deactivates all prior rows
   * for that jurisdiction. The caller may supply a new jurisdiction and/or body.
   * All of this is atomic with the audit entry.
   */
  async updateDisclaimer(
    id: string,
    input: DisclaimerUpdate,
    actorUserId: string,
    actorRole: string
  ): Promise<DisclaimerTemplate> {
    return getDb(this.db).transaction(async (tx) => {
      // Fetch the referenced row (any version — the PATCH target).
      // We read the existing row BEFORE acquiring the advisory lock so that a
      // NotFoundException on a non-existent id fails fast (no lock acquired for
      // a row that will never be written). The lock is then taken on the TARGET
      // jurisdiction (which may differ from existing.jurisdiction if the caller
      // is remapping jurisdictions), so the lock key covers the write path.
      const [existing] = await tx
        .select()
        .from(disclaimerTemplates)
        .where(eq(disclaimerTemplates.id, id));

      if (!existing) {
        throw new NotFoundException(`disclaimer template ${id} not found`);
      }

      // The new jurisdiction is the updated one (if provided) or the existing one.
      const newJurisdiction = input.jurisdiction ?? existing.jurisdiction;
      const newBody = input.body ?? existing.body;

      // Serialize concurrent edits for the target jurisdiction via advisory lock.
      // Must be acquired BEFORE reading max(version) so the read-max→deactivate→
      // insert sequence is atomic for this jurisdiction.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${newJurisdiction}))`);

      // Compute next version for the target jurisdiction.
      const [maxRow] = await tx
        .select({ maxVersion: max(disclaimerTemplates.version) })
        .from(disclaimerTemplates)
        .where(eq(disclaimerTemplates.jurisdiction, newJurisdiction));

      const nextVersion = (maxRow?.maxVersion ?? 0) + 1;

      // Deactivate all existing rows for the target jurisdiction.
      await tx
        .update(disclaimerTemplates)
        .set({ active: false })
        .where(eq(disclaimerTemplates.jurisdiction, newJurisdiction));

      // Insert the new version row.
      const [row] = await tx
        .insert(disclaimerTemplates)
        .values({
          jurisdiction: newJurisdiction,
          body: newBody,
          version: nextVersion,
          active: true,
          createdBy: actorUserId,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning();

      if (!row) throw new Error('Insert did not return a row');

      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'disclaimer-change',
        resourceType: 'disclaimer_template',
        resourceId: row.id,
        contentHash: hashJson({ id: row.id, jurisdiction: row.jurisdiction, version: row.version }),
        payloadHash: hashJson({
          op: 'update',
          priorId: id,
          newId: row.id,
          jurisdiction: newJurisdiction,
          version: nextVersion,
        }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return toTemplate(row);
    });
  }
}
