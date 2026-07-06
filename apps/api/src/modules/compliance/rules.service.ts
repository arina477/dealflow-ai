/**
 * RulesService (wave-5, B-2 step 2.11) — CRUD for compliance_rules table.
 *
 * Every mutation (create / update / delete) writes an audit entry via
 * AuditService.append(_, tx) IN THE SAME TRANSACTION as the DB write.
 * Audit-append failure rolls back the entire mutation — no silent unaudited
 * change can commit. This mirrors the wave-4 atomicity contract.
 *
 * Actor identity (created_by / actor) is sourced from the server-verified
 * session only — never from the client request body.
 *
 * Content + payload hashes supplied to AuditService are deterministic SHA-256
 * over the canonical JSON serialization of the relevant record, matching the
 * discipline in audit.hash.ts (plain SHA-256 for content binding, HMAC is
 * applied by the append service over the chain entry itself).
 */

import { createHash } from 'node:crypto';
import type { AuditEntryInput, ComplianceRule, RuleCreate, RuleUpdate } from '@dealflow/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { complianceRules } from '../../db/schema/compliance-rules';
import { DEFAULT_WORKSPACE_ID } from '../../db/schema/workspaces';
import { getDb, getWorkspaceId } from '../../db/workspace-context';
import type { Tx } from '../audit/audit.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';

/** Deterministic SHA-256 hex over a canonical JSON object (sorted keys). */
function hashJson(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value, Object.keys(value as object).sort()), 'utf8')
    .digest('hex');
}

/** Map a Drizzle row to the shared ComplianceRule shape. */
function toRule(row: typeof complianceRules.$inferSelect): ComplianceRule {
  return {
    id: row.id,
    ruleType: row.ruleType as ComplianceRule['ruleType'],
    jurisdiction: row.jurisdiction ?? null,
    config: row.config as Record<string, unknown>,
    enabled: row.enabled,
    createdBy: row.createdBy ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}

@Injectable()
export class RulesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly auditService: AuditService
  ) {}

  /** GET /compliance/rules — list all rules (no audit for reads). */
  async listRules(): Promise<ComplianceRule[]> {
    const rows = await getDb(this.db).select().from(complianceRules);
    return rows.map(toRule);
  }

  /** POST /compliance/rules — create a new rule, audit in-tx. */
  async createRule(
    input: RuleCreate,
    actorUserId: string,
    actorRole: string
  ): Promise<ComplianceRule> {
    return getDb(this.db).transaction(async (tx) => {
      const [row] = await tx
        .insert(complianceRules)
        .values({
          ruleType: input.ruleType,
          jurisdiction: input.jurisdiction ?? null,
          config: input.config,
          enabled: input.enabled ?? true,
          createdBy: actorUserId,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning();

      if (!row) throw new Error('Insert did not return a row');

      const resourceJson = { id: row.id, ruleType: row.ruleType, enabled: row.enabled };
      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'rule-change',
        resourceType: 'compliance_rule',
        resourceId: row.id,
        contentHash: hashJson(resourceJson),
        payloadHash: hashJson({ op: 'create', input }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return toRule(row);
    });
  }

  /** PATCH /compliance/rules/:id — update fields incl. enabled toggle, audit in-tx. */
  async updateRule(
    id: string,
    input: RuleUpdate,
    actorUserId: string,
    actorRole: string
  ): Promise<ComplianceRule> {
    return getDb(this.db).transaction(async (tx) => {
      // Verify the row exists first.
      const [existing] = await tx.select().from(complianceRules).where(eq(complianceRules.id, id));

      if (!existing) {
        throw new NotFoundException(`compliance rule ${id} not found`);
      }

      const updateValues: Partial<typeof complianceRules.$inferInsert> = {};
      if (input.ruleType !== undefined) updateValues.ruleType = input.ruleType;
      if (input.jurisdiction !== undefined) updateValues.jurisdiction = input.jurisdiction;
      if (input.config !== undefined) updateValues.config = input.config;
      if (input.enabled !== undefined) updateValues.enabled = input.enabled;

      const [row] = await tx
        .update(complianceRules)
        .set(updateValues)
        .where(eq(complianceRules.id, id))
        .returning();

      if (!row) throw new Error('Update did not return a row');

      const resourceJson = { id: row.id, ruleType: row.ruleType, enabled: row.enabled };
      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'rule-change',
        resourceType: 'compliance_rule',
        resourceId: row.id,
        contentHash: hashJson(resourceJson),
        payloadHash: hashJson({ op: 'update', id, input }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);

      return toRule(row);
    });
  }

  /** DELETE /compliance/rules/:id — hard delete, audit in-tx. */
  async deleteRule(id: string, actorUserId: string, actorRole: string): Promise<void> {
    await getDb(this.db).transaction(async (tx) => {
      const [existing] = await tx.select().from(complianceRules).where(eq(complianceRules.id, id));

      if (!existing) {
        throw new NotFoundException(`compliance rule ${id} not found`);
      }

      await tx.delete(complianceRules).where(eq(complianceRules.id, id));

      const auditInput: AuditEntryInput = {
        actorUserId,
        actorRole,
        action: 'rule-change',
        resourceType: 'compliance_rule',
        resourceId: id,
        contentHash: hashJson({ id, ruleType: existing.ruleType }),
        payloadHash: hashJson({ op: 'delete', id }),
      };

      await this.auditService.append(auditInput, tx as unknown as Tx);
    });
  }
}
