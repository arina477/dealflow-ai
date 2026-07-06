/**
 * SuppressionService (wave-5, B-2 step 2.12) — CRUD for suppression_list table.
 *
 * Every mutation (create / delete) writes an audit entry via
 * AuditService.append(_, tx) IN THE SAME TRANSACTION as the DB write.
 * Audit-append failure rolls back the entire mutation — no silent unaudited
 * change can commit (wave-4 atomicity contract).
 *
 * Normalization: `value` is normalized to lower-case before persistence
 * (DB stores already-normalized form per schema comment).
 */

import { createHash } from 'node:crypto';
import type { AuditEntryInput, SuppressionCreate, SuppressionEntry } from '@dealflow/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { getDb, getWorkspaceId } from '../../db/workspace-context';
import { DEFAULT_WORKSPACE_ID } from '../../db/schema/workspaces';
import { suppressionList } from '../../db/schema/compliance-rules';
import type { Tx } from '../audit/audit.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';

function hashJson(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value, Object.keys(value as object).sort()), 'utf8')
    .digest('hex');
}

function toEntry(row: typeof suppressionList.$inferSelect): SuppressionEntry {
  return {
    id: row.id,
    matchType: row.matchType as SuppressionEntry['matchType'],
    value: row.value,
    reason: row.reason ?? null,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class SuppressionService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  /** GET /compliance/suppression — list all entries (no audit for reads). */
  async listEntries(): Promise<SuppressionEntry[]> {
    const rows = await getDb(this.db).select().from(suppressionList);
    return rows.map(toEntry);
  }

  /** POST /compliance/suppression — create entry, audit in-tx. */
  async createEntry(
    input: SuppressionCreate,
    actorUserId: string,
    actorRole: string
  ): Promise<SuppressionEntry> {
    return getDb(this.db).transaction(async (tx) => {
      // Normalize value to lower-case before persistence.
      const normalizedValue = input.value.toLowerCase();

      const [row] = await tx
        .insert(suppressionList)
        .values({
          matchType: input.matchType,
          value: normalizedValue,
          reason: input.reason ?? null,
          createdBy: actorUserId,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning();

      if (!row) throw new Error('Insert did not return a row');

      const resourceJson = { id: row.id, matchType: row.matchType, value: row.value };
      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'suppression-change',
        resourceType: 'suppression_entry',
        resourceId: row.id,
        contentHash: hashJson(resourceJson),
        payloadHash: hashJson({ op: 'create', matchType: input.matchType, value: normalizedValue }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return toEntry(row);
    });
  }

  /** DELETE /compliance/suppression/:id — hard delete, audit in-tx. */
  async deleteEntry(id: string, actorUserId: string, actorRole: string): Promise<void> {
    await getDb(this.db).transaction(async (tx) => {
      const [existing] = await tx.select().from(suppressionList).where(eq(suppressionList.id, id));

      if (!existing) {
        throw new NotFoundException(`suppression entry ${id} not found`);
      }

      await tx.delete(suppressionList).where(eq(suppressionList.id, id));

      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'suppression-change',
        resourceType: 'suppression_entry',
        resourceId: id,
        contentHash: hashJson({ id, matchType: existing.matchType, value: existing.value }),
        payloadHash: hashJson({ op: 'delete', id }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);
    });
  }
}
