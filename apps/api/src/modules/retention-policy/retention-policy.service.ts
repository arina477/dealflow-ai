/**
 * RetentionPolicyService (wave-28, task d3cc1337) — retention window GET/SET.
 *
 * Endpoints served:
 *   GET /compliance/retention  — return the current policy + derived cutoff date.
 *   PUT /compliance/retention  — upsert the policy; audit-log the change.
 *
 * ── SEC-A (workspace server-resolved upsert) ─────────────────────────────────
 * workspace_id is ALWAYS sourced from getWorkspaceId() (ALS/GUC) — NEVER from
 * client input. The RetentionPolicyRepository uses ON CONFLICT (workspace_id) DO
 * UPDATE so there is exactly one row per workspace. The RLS WITH-CHECK (auto-derived
 * from USING) rejects any write whose workspace_id differs from the GUC.
 *
 * ── [SEC-C] Audit-logged config change (WORM-PRESERVING) ─────────────────────
 * When a PUT changes the value, AuditService.appendStandalone() is called with
 * action='retention.policy.updated'. This is a normal HMAC append — it does NOT
 * delete or mutate any existing audit_log_entries row. verifyChain stays ok:true
 * after this event. Only called when the new value differs from the old value (no
 * spurious no-op entries).
 *
 * ── NO deletion path ─────────────────────────────────────────────────────────
 * There is no method, no endpoint, and no code path that deletes the retention
 * policy row or any audit_log_entries row.
 *
 * ── Default behavior ─────────────────────────────────────────────────────────
 * If no row exists for this workspace yet, getPolicy() returns the default
 * (RETENTION_PERIOD_DAYS_DEFAULT = 2555 ≈ 7 years) without inserting a row.
 * The row is only created on the first explicit PUT.
 */

import { createHash } from 'node:crypto';
import type { RetentionPolicy, SetRetentionPolicyInput } from '@dealflow/shared';
import { RETENTION_PERIOD_DAYS_DEFAULT } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';
import { getWorkspaceId } from '../../db/workspace-context';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
import type { RetentionPolicyRow } from './retention-policy.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { RetentionPolicyRepository } from './retention-policy.repository';

/** Deterministic SHA-256 hex over a canonical JSON object (mirrors workspace-settings.service). */
function hashJson(value: unknown): string {
  const sorted =
    typeof value === 'object' && value !== null
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort())
      : value;
  return createHash('sha256').update(JSON.stringify(sorted), 'utf8').digest('hex');
}

/** Derive the cutoff date from now and the retention period. */
function deriveCutoffDate(retentionPeriodDays: number): string {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionPeriodDays);
  return cutoff.toISOString();
}

/** Map a DB row (or default) to the shared RetentionPolicy shape. */
function toPolicy(row: RetentionPolicyRow | null, days: number): RetentionPolicy {
  return {
    retentionPeriodDays: days,
    cutoffDate: deriveCutoffDate(days),
    updatedBy: row?.updatedBy ?? null,
    updatedAt: row?.updatedAt ?? null,
  };
}

@Injectable()
export class RetentionPolicyService {
  constructor(
    private readonly repository: RetentionPolicyRepository,
    private readonly auditService: AuditService
  ) {}

  /**
   * GET /compliance/retention — return the current policy + derived cutoff.
   * Returns the configured value, or the default (2555 days) if no row exists yet.
   * Reads are not audited.
   */
  async getPolicy(): Promise<RetentionPolicy> {
    const row = await this.repository.findOne();
    const days = row?.retentionPeriodDays ?? RETENTION_PERIOD_DAYS_DEFAULT;
    return toPolicy(row, days);
  }

  /**
   * PUT /compliance/retention — upsert the retention policy.
   *
   * SEC-A: workspace_id resolved server-side from getWorkspaceId() (ALS/GUC).
   * SEC-C: if the value changes, append 'retention.policy.updated' to the M2
   *        audit chain via AuditService.appendStandalone (WORM-preserving).
   *
   * @param input        - Validated request body (retentionPeriodDays only).
   * @param actorUserId  - App users.id of the admin/compliance actor.
   * @param actorRole    - Role snapshot at time of action.
   */
  async setPolicy(
    input: SetRetentionPolicyInput,
    actorUserId: string,
    actorRole: string
  ): Promise<RetentionPolicy> {
    // SEC-A: workspace resolved server-side — never trust client input for workspace_id.
    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
      throw new Error('RetentionPolicyService.setPolicy: no workspace in ALS context');
    }

    // Read existing row to determine if value actually changes (avoid no-op audit entries).
    const existing = await this.repository.findOne();
    const oldDays = existing?.retentionPeriodDays ?? RETENTION_PERIOD_DAYS_DEFAULT;
    const newDays = input.retentionPeriodDays;

    // SEC-A upsert — workspace_id from ALS, ON CONFLICT (workspace_id) DO UPDATE.
    const row = await this.repository.upsert(workspaceId, newDays, actorUserId);

    // SEC-C: only audit when the value actually changes (idempotent PUT skips audit).
    if (newDays !== oldDays) {
      await this.auditService.appendStandalone({
        actorUserId,
        actorRole,
        action: 'retention.policy.updated',
        resourceType: 'workspace_retention_policy',
        resourceId: workspaceId,
        // contentHash covers the before/after values for tamper-evidence.
        contentHash: hashJson({ old_days: oldDays, new_days: newDays }),
        // payloadHash covers the full input for completeness.
        payloadHash: hashJson({ op: 'set-retention-policy', input }),
      });
    }

    return toPolicy(row, row.retentionPeriodDays);
  }
}
