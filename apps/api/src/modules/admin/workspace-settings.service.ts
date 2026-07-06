/**
 * WorkspaceSettingsService (wave-15, task 648a86a6) — firm-profile CRUD
 * + default-compliance-profile cascade.
 *
 * Single-row-per-firm semantics: the workspace_settings table holds at most
 * one row. GET returns it (or a default empty object if not yet seeded).
 * PUT upserts — if no row exists it inserts; otherwise it updates in place.
 *
 * Cascade semantics:
 *   - Mutating default_jurisdiction / default_disclaimer_template_id /
 *     default_suppression_scope sets the FIRM-LEVEL DEFAULTS that new mandates
 *     inherit when they are created (via MandateService reading workspace_settings).
 *   - NO retroactive mutation of existing mandate_compliance_profile rows.
 *     Existing mandates are unaffected.
 *
 * Every PUT is audited LAST-IN-TXN via AuditService.append (WORM; action
 * 'workspace-settings-update'). Audit failure rolls back the update.
 *
 * RBAC: admin-only (callers use RolesGuard + @Roles('admin')).
 * Actor identity: callers supply actorUserId (app users.id) obtained from the
 * server-verified session via AuthRepository.getUserWithRole.
 */

import { createHash } from 'node:crypto';
import type {
  AuditEntryInput,
  WorkspaceSettings,
  WorkspaceSettingsUpdateInput,
} from '@dealflow/shared';
import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { getDb, getWorkspaceId } from '../../db/workspace-context';
import { DEFAULT_WORKSPACE_ID } from '../../db/schema/workspaces';
import { workspaceSettings } from '../../db/schema/admin-settings';
import type { Tx } from '../audit/audit.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';

/**
 * Fixed advisory-lock key for the workspace-settings singleton critical section.
 * Distinct from ADMIN_GUARD_LOCK_KEY (4_200_500_500) and
 * AUDIT_CHAIN_ADVISORY_LOCK_KEY (4_100_400_400).
 * Serializes concurrent first-PUT races so only one INSERT wins; the second
 * waits, sees the row, and falls through to UPDATE.
 * pg_advisory_xact_lock(<key>) — transaction-scoped, auto-released on commit/rollback.
 */
export const WORKSPACE_SETTINGS_LOCK_KEY = 4_300_600_600 as const;

/** Deterministic SHA-256 hex over a canonical JSON object. */
function hashJson(value: unknown): string {
  const sorted =
    typeof value === 'object' && value !== null
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort())
      : value;
  return createHash('sha256').update(JSON.stringify(sorted), 'utf8').digest('hex');
}

/** Map a DB row to the shared WorkspaceSettings shape. */
function toSettings(row: typeof workspaceSettings.$inferSelect): WorkspaceSettings {
  return {
    id: row.id,
    firmName: row.firmName ?? null,
    firmAddress: row.firmAddress ?? null,
    regulatoryIds: row.regulatoryIds ?? null,
    primaryContactName: row.primaryContactName ?? null,
    primaryContactEmail: row.primaryContactEmail ?? null,
    defaultJurisdiction: row.defaultJurisdiction ?? null,
    defaultDisclaimerTemplateId: row.defaultDisclaimerTemplateId ?? null,
    defaultSuppressionScope:
      (row.defaultSuppressionScope as WorkspaceSettings['defaultSuppressionScope']) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

@Injectable()
export class WorkspaceSettingsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  /**
   * GET /admin/workspace-settings — return current settings (null if unset).
   * Reads are not audited.
   */
  async getSettings(): Promise<WorkspaceSettings | null> {
    const rows = await getDb(this.db).select().from(workspaceSettings).limit(1);
    return rows[0] ? toSettings(rows[0]) : null;
  }

  /**
   * PUT /admin/workspace-settings — upsert (insert or update) the single settings row.
   * Audited LAST-IN-TXN with action 'workspace-settings-update'.
   */
  async updateSettings(
    input: WorkspaceSettingsUpdateInput,
    actorUserId: string,
    actorRole: string
  ): Promise<WorkspaceSettings> {
    return getDb(this.db).transaction(async (tx) => {
      // Serialize concurrent first-PUT races: two simultaneous requests that each
      // see no row would both proceed to INSERT, producing two workspace_settings
      // rows (nondeterministic firm-defaults cascade). The advisory lock ensures
      // the second transaction waits for the first to commit; it then sees the
      // already-inserted row and falls through to the UPDATE branch.
      // Transaction-scoped — released automatically on commit or rollback.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${WORKSPACE_SETTINGS_LOCK_KEY})`);

      // Fetch existing row (for audit before/after and to decide insert vs update).
      const [existing] = await tx.select().from(workspaceSettings).limit(1);

      let row: typeof workspaceSettings.$inferSelect;

      if (!existing) {
        // Insert first row.
        const [inserted] = await tx
          .insert(workspaceSettings)
          .values({
            firmName: input.firmName ?? null,
            firmAddress: input.firmAddress ?? null,
            regulatoryIds: input.regulatoryIds ?? null,
            primaryContactName: input.primaryContactName ?? null,
            primaryContactEmail: input.primaryContactEmail ?? null,
            defaultJurisdiction: input.defaultJurisdiction ?? null,
            defaultDisclaimerTemplateId: input.defaultDisclaimerTemplateId ?? null,
            defaultSuppressionScope: input.defaultSuppressionScope ?? null,
            createdBy: actorUserId,
            workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
          })
          .returning();

        if (!inserted) throw new Error('workspace_settings insert returned no row');
        row = inserted;
      } else {
        // Update existing row.
        const updateValues: Partial<typeof workspaceSettings.$inferInsert> = {};
        if (input.firmName !== undefined) updateValues.firmName = input.firmName;
        if (input.firmAddress !== undefined) updateValues.firmAddress = input.firmAddress;
        if (input.regulatoryIds !== undefined) updateValues.regulatoryIds = input.regulatoryIds;
        if (input.primaryContactName !== undefined)
          updateValues.primaryContactName = input.primaryContactName;
        if (input.primaryContactEmail !== undefined)
          updateValues.primaryContactEmail = input.primaryContactEmail;
        if (input.defaultJurisdiction !== undefined)
          updateValues.defaultJurisdiction = input.defaultJurisdiction;
        if ('defaultDisclaimerTemplateId' in input)
          updateValues.defaultDisclaimerTemplateId = input.defaultDisclaimerTemplateId ?? null;
        if ('defaultSuppressionScope' in input)
          updateValues.defaultSuppressionScope = input.defaultSuppressionScope ?? null;

        const [updated] = await tx
          .update(workspaceSettings)
          .set(updateValues)
          .where(eq(workspaceSettings.id, existing.id))
          .returning();

        if (!updated) throw new Error('workspace_settings update returned no row');
        row = updated;
      }

      // Audit LAST-IN-TXN (before the tx commits).
      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'workspace-settings-update',
        resourceType: 'workspace_settings',
        resourceId: row.id,
        contentHash: hashJson({
          firmName: row.firmName,
          defaultJurisdiction: row.defaultJurisdiction,
          defaultDisclaimerTemplateId: row.defaultDisclaimerTemplateId,
        }),
        payloadHash: hashJson({ op: 'update', input }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return toSettings(row);
    });
  }
}
