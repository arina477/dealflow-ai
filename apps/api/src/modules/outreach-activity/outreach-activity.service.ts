/**
 * OutreachActivityService — wave-20 M9 outreach-activity tracker (task 5c12ac3a).
 *
 * Methods:
 *   create          — POST /outreach-activity (advisor, admin)
 *   list            — GET /outreach-activity (advisor, admin)
 *   update          — PATCH /outreach-activity/:id (field edits)
 *   updateStatus    — PATCH /outreach-activity/:id (status transition)
 *   cancel          — PATCH /outreach-activity/:id (cancel shortcut)
 *
 * ── SF1 [HIGH] — NO DEFAULT_WORKSPACE_ID fallback ───────────────────────────
 * workspace_id is derived from getWorkspaceId(). If null (empty ALS / background
 * job / non-request context), the service THROWS ForbiddenException BEFORE any
 * DB write. This is the primary guard (belt). The column DEFAULT in the DB is
 * the secondary guard (suspenders): an omitted workspace_id captures the GUC
 * or rejects with NOT NULL if GUC is unset.
 * NEVER: `getWorkspaceId() ?? DEFAULT_WORKSPACE_ID` in this service.
 *
 * ── R3/SF4 — Cross-firm FK tenancy guard ─────────────────────────────────────
 * Every provided deal-target FK (outreachId, matchCandidateId, pipelineId,
 * mandateId) is validated inside the tx via a RLS-scoped read. A firm-B row is
 * invisible under firm-A's GUC → read returns null → service throws NotFoundException.
 * createdBy is the ALS-resolved actor.id — NEVER from client input.
 *
 * ── R4/SF5 — Audit LAST-IN-TXN ───────────────────────────────────────────────
 * Every mutation (create/update/updateStatus/cancel) calls
 * auditService.append(evt, tx) LAST in the same runInTransaction as the business
 * write. Audit failure → rollback. One audit entry per verb. verifyChain ok.
 *
 * ── HARD BOUNDARY ────────────────────────────────────────────────────────────
 * ZERO AI/LLM import. ZERO transactional-email SDK. ZERO external send.
 * Channel values are pure record labels — no downstream dispatch.
 */

import { createHash } from 'node:crypto';
import type {
  AuditEntryInput,
  CreateOutreachActivityInput,
  UpdateOutreachActivityInput,
} from '@dealflow/shared';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { getWorkspaceId } from '../../db/workspace-context';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuthRepository } from '../auth/auth.repository';
import type { OutreachActivityRow, Tx } from './outreach-activity.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { OutreachActivityRepository } from './outreach-activity.repository';

@Injectable()
export class OutreachActivityService {
  constructor(
    private readonly repository: OutreachActivityRepository,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // create — POST /outreach-activity
  // ---------------------------------------------------------------------------

  /**
   * create — create a new outreach_activity row.
   *
   * Steps (all in ONE tx):
   *   1. SF1: getWorkspaceId() — THROW if null (no DEFAULT fallback).
   *   2. Translate ST id → app users.id (actor-id-FK lesson).
   *   3. R3/SF4: validate all provided deal-target FKs (tx-scoped RLS read).
   *   4. INSERT outreach_activity (workspace_id from column DEFAULT/GUC, SF1).
   *   5. AUDIT outreach-activity-create LAST-IN-TXN (R4/SF5).
   */
  async create(
    input: CreateOutreachActivityInput,
    supertokensUserId: string
  ): Promise<OutreachActivityRow> {
    // 1. SF1: workspace must be set.
    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
      throw new ForbiddenException(
        'OutreachActivityService.create: workspace context is not set (empty ALS). ' +
          'This call must be made from a request context with a valid workspace GUC.'
      );
    }

    // 2. Translate ST id → app users.id.
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }
    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 3. R3/SF4: validate deal-target FKs (tx-scoped RLS reads).
      if (input.outreachId) {
        const row = await this.repository.findOutreachByIdInTx(tx, input.outreachId);
        if (!row) {
          throw new NotFoundException(
            `outreach ${input.outreachId} not found or not accessible in this workspace`
          );
        }
      }
      if (input.matchCandidateId) {
        const row = await this.repository.findMatchCandidateByIdInTx(tx, input.matchCandidateId);
        if (!row) {
          throw new NotFoundException(
            `match_candidate ${input.matchCandidateId} not found or not accessible in this workspace`
          );
        }
      }
      if (input.pipelineId) {
        const row = await this.repository.findPipelineByIdInTx(tx, input.pipelineId);
        if (!row) {
          throw new NotFoundException(
            `pipeline ${input.pipelineId} not found or not accessible in this workspace`
          );
        }
      }
      if (input.mandateId) {
        const row = await this.repository.findMandateByIdInTx(tx, input.mandateId);
        if (!row) {
          throw new NotFoundException(
            `mandate ${input.mandateId} not found or not accessible in this workspace`
          );
        }
      }

      // 4. INSERT outreach_activity.
      // workspace_id is OMITTED from values — captured by column DEFAULT from GUC (SF1 HIGH).
      // createdBy is ALS-resolved actor.id — NEVER client-supplied (SF4).
      const row = await this.repository.insertActivity(tx, {
        channel: input.channel,
        status: input.status ?? 'planned',
        subject: input.subject,
        notes: input.notes ?? null,
        dueAt: input.dueAt ?? null,
        outreachId: input.outreachId ?? null,
        matchCandidateId: input.matchCandidateId ?? null,
        pipelineId: input.pipelineId ?? null,
        mandateId: input.mandateId ?? null,
        createdBy: appUserId,
      });

      // 5. AUDIT outreach-activity-create LAST-IN-TXN (R4/SF5).
      await this.appendAudit(tx, {
        actorUserId: appUserId,
        actorRole,
        action: 'outreach-activity-create',
        resourceType: 'outreach_activity',
        resourceId: row.id,
        payload: {
          activityId: row.id,
          channel: row.channel,
          status: row.status,
          workspaceId,
        },
      });

      return row;
    });
  }

  // ---------------------------------------------------------------------------
  // list — GET /outreach-activity
  // ---------------------------------------------------------------------------

  /**
   * list — list outreach_activity rows for the current workspace (RLS-scoped).
   * Optional status filter. Ordered by (workspace_id, status, due_at) index.
   */
  async list(filter?: { status?: OutreachActivityRow['status'] }): Promise<OutreachActivityRow[]> {
    return this.repository.listActivities(filter);
  }

  // ---------------------------------------------------------------------------
  // update — PATCH /outreach-activity/:id (field edits)
  // ---------------------------------------------------------------------------

  /**
   * update — update editable fields on an outreach_activity row.
   *
   * Steps (all in ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Find activity (NotFoundException if not found/invisible — RLS).
   *   3. R3/SF4: validate any updated FK targets.
   *   4. UPDATE activity fields.
   *   5. AUDIT outreach-activity-update LAST-IN-TXN (R4/SF5).
   */
  async update(
    activityId: string,
    input: UpdateOutreachActivityInput,
    supertokensUserId: string
  ): Promise<OutreachActivityRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }
    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Verify row exists and is visible (RLS).
      const existing = await this.repository.findActivityByIdInTx(tx, activityId);
      if (!existing) {
        throw new NotFoundException(`outreach_activity ${activityId} not found`);
      }

      // R3/SF4: validate any updated FK targets.
      if (input.outreachId !== undefined && input.outreachId !== null) {
        const row = await this.repository.findOutreachByIdInTx(tx, input.outreachId);
        if (!row)
          throw new NotFoundException(`outreach ${input.outreachId} not found or not accessible`);
      }
      if (input.matchCandidateId !== undefined && input.matchCandidateId !== null) {
        const row = await this.repository.findMatchCandidateByIdInTx(tx, input.matchCandidateId);
        if (!row)
          throw new NotFoundException(
            `match_candidate ${input.matchCandidateId} not found or not accessible`
          );
      }
      if (input.pipelineId !== undefined && input.pipelineId !== null) {
        const row = await this.repository.findPipelineByIdInTx(tx, input.pipelineId);
        if (!row)
          throw new NotFoundException(`pipeline ${input.pipelineId} not found or not accessible`);
      }
      if (input.mandateId !== undefined && input.mandateId !== null) {
        const row = await this.repository.findMandateByIdInTx(tx, input.mandateId);
        if (!row)
          throw new NotFoundException(`mandate ${input.mandateId} not found or not accessible`);
      }

      // Build update fields (only explicitly provided keys).
      type UpdateFields = Parameters<typeof this.repository.updateActivityInTx>[2];
      const fields: UpdateFields = {};
      if (input.status !== undefined) fields.status = input.status;
      if (input.subject !== undefined) fields.subject = input.subject;
      if ('notes' in input) fields.notes = input.notes ?? null;
      if ('dueAt' in input) fields.dueAt = input.dueAt ?? null;
      if ('outreachId' in input) fields.outreachId = input.outreachId ?? null;
      if ('matchCandidateId' in input) fields.matchCandidateId = input.matchCandidateId ?? null;
      if ('pipelineId' in input) fields.pipelineId = input.pipelineId ?? null;
      if ('mandateId' in input) fields.mandateId = input.mandateId ?? null;

      const updated = await this.repository.updateActivityInTx(tx, activityId, fields);

      // AUDIT outreach-activity-update LAST-IN-TXN.
      await this.appendAudit(tx, {
        actorUserId: appUserId,
        actorRole,
        action: 'outreach-activity-update',
        resourceType: 'outreach_activity',
        resourceId: activityId,
        payload: {
          activityId,
          updatedFields: Object.keys(fields),
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // updateStatus — PATCH /outreach-activity/:id (status transition)
  // ---------------------------------------------------------------------------

  /**
   * updateStatus — transition an activity's status.
   * Sets completedAt server-side when status → 'completed'.
   * Audits 'outreach-activity-status-transition' LAST-IN-TXN.
   */
  async updateStatus(
    activityId: string,
    newStatus: 'planned' | 'completed' | 'cancelled',
    supertokensUserId: string
  ): Promise<OutreachActivityRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }
    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      const existing = await this.repository.findActivityByIdInTx(tx, activityId);
      if (!existing) {
        throw new NotFoundException(`outreach_activity ${activityId} not found`);
      }

      const fromStatus = existing.status;
      const fields: { status: OutreachActivityRow['status']; completedAt?: string | null } = {
        status: newStatus,
      };
      if (newStatus === 'completed') {
        fields.completedAt = new Date().toISOString();
      }

      const updated = await this.repository.updateActivityInTx(tx, activityId, fields);

      // AUDIT outreach-activity-status-transition LAST-IN-TXN (R4/SF5).
      await this.appendAudit(tx, {
        actorUserId: appUserId,
        actorRole,
        action: 'outreach-activity-status-transition',
        resourceType: 'outreach_activity',
        resourceId: activityId,
        payload: {
          activityId,
          fromStatus,
          toStatus: newStatus,
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // cancel — PATCH /outreach-activity/:id (cancel shortcut)
  // ---------------------------------------------------------------------------

  /**
   * cancel — cancel an outreach_activity (status → 'cancelled').
   * Audits 'outreach-activity-cancel' LAST-IN-TXN (separate verb from status-transition
   * for per-verb audit coverage per R4/SF5).
   */
  async cancel(activityId: string, supertokensUserId: string): Promise<OutreachActivityRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }
    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      const existing = await this.repository.findActivityByIdInTx(tx, activityId);
      if (!existing) {
        throw new NotFoundException(`outreach_activity ${activityId} not found`);
      }

      const updated = await this.repository.updateActivityInTx(tx, activityId, {
        status: 'cancelled',
      });

      // AUDIT outreach-activity-cancel LAST-IN-TXN (R4/SF5).
      await this.appendAudit(tx, {
        actorUserId: appUserId,
        actorRole,
        action: 'outreach-activity-cancel',
        resourceType: 'outreach_activity',
        resourceId: activityId,
        payload: {
          activityId,
          previousStatus: existing.status,
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Private audit helper
  // ---------------------------------------------------------------------------

  private async appendAudit(
    tx: Tx,
    params: {
      actorUserId: string;
      actorRole: string;
      action: AuditEntryInput['action'];
      resourceType: string;
      resourceId: string;
      payload: Record<string, unknown>;
    }
  ): Promise<void> {
    const payloadStr = JSON.stringify(params.payload);
    const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

    const auditInput: AuditEntryInput = {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      contentHash: payloadHash,
      payloadHash,
    };

    await this.auditService.append(auditInput, tx);
  }
}
