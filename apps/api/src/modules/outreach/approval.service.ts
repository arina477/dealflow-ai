/**
 * ApprovalService — compliance-only template version approval/rejection.
 *
 * SoD ENFORCEMENT (load-bearing):
 *   - grantApproval and reject are gated to compliance role ONLY (advisor 403).
 *   - This is enforced in two places:
 *     1. @Roles(OUTREACH_TEMPLATES_APPROVE_ROLES) on the controller methods.
 *     2. The service defensively checks the actor's roleName === 'compliance'
 *        and throws ForbiddenException (403) if not — belt-and-suspenders.
 *
 * grantApproval:
 *   - Sets approvalStatus = 'approved'.
 *   - Sets approvedContentHash = version.contentHash (the VERSION-BINDING snapshot).
 *     A later draft (draftNewVersion) creates a new version with a new contentHash
 *     and approvedContentHash=NULL — isUsableForSend returns false for the new version
 *     until compliance approves it.
 *   - Sets approvedBy = actor.id (for the outreach-SoD check: composer ≠ approved_by).
 *   - Audited in-tx (template-approval-grant). Rollback on audit fail.
 *
 * reject:
 *   - Sets approvalStatus = 'rejected'.
 *   - Does NOT set approvedContentHash or approvedBy.
 *   - Audited in-tx (template-approval-reject). Rollback on audit fail.
 *
 * HARD BOUNDARY: NO Anthropic/LLM import. NO email-SDK import.
 */

import { createHash } from 'node:crypto';
import type { AuditEntryInput } from '@dealflow/shared';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuthRepository } from '../auth/auth.repository';
import type { OutreachTemplateVersionRow, Tx } from './outreach.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { OutreachRepository } from './outreach.repository';

/** The ONLY role that may approve or reject template versions. */
const COMPLIANCE_ROLE = 'compliance' as const;

@Injectable()
export class ApprovalService {
  constructor(
    private readonly repository: OutreachRepository,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // grantApproval
  // ---------------------------------------------------------------------------

  /**
   * grantApproval — approves a template version.
   *
   * SoD: compliance role ONLY. Advisor → 403 ForbiddenException.
   *
   * Steps:
   *   1. Translate ST id → app users.id; confirm role = 'compliance'.
   *   2. Find version inside tx (BUILD rule 7).
   *   3. UPDATE: approvalStatus='approved', approvedContentHash=version.contentHash,
   *      approvedBy=actor.id (the VERSION-BINDING snapshot).
   *   4. AUDIT template-approval-grant in-tx (last-in-txn order: write then audit).
   *
   * @param versionId        — the version to approve
   * @param supertokensUserId — raw SuperTokens user id from the session
   */
  async grantApproval(
    versionId: string,
    supertokensUserId: string
  ): Promise<OutreachTemplateVersionRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    // SoD: compliance-only gate (belt-and-suspenders; controller @Roles is primary).
    if (actor.roleName !== COMPLIANCE_ROLE) {
      throw new ForbiddenException(
        `Only the compliance role may approve template versions. Actor role: "${actor.roleName}".`
      );
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Read version inside tx (BUILD rule 7).
      const version = await this.repository.findVersionByIdInTx(tx, versionId);
      if (!version) {
        throw new NotFoundException(`Outreach template version ${versionId} not found`);
      }

      // UPDATE version: set approval fields.
      // approvedContentHash = version.contentHash (the VERSION-BINDING snapshot).
      // approvedBy = actor.id (for outreach-SoD: composer ≠ approvedBy).
      const updated = await this.repository.updateVersionApproval(tx, versionId, {
        approvalStatus: 'approved',
        approvedContentHash: version.contentHash,
        approvedBy: appUserId,
      });

      // AUDIT in-tx (template-approval-grant).
      const eventPayload = {
        versionId,
        templateId: version.templateId,
        approvedContentHash: version.contentHash,
        approvedBy: appUserId,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'template-approval-grant',
        resourceType: 'outreach-template-version',
        resourceId: versionId,
        contentHash: version.contentHash,
        payloadHash,
      };

      await this.auditService.append(auditInput, tx);

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // reject
  // ---------------------------------------------------------------------------

  /**
   * reject — rejects a template version under review.
   *
   * SoD: compliance role ONLY. Advisor → 403 ForbiddenException.
   *
   * Sets approvalStatus='rejected'. Does NOT set approvedContentHash or approvedBy.
   * The version becomes permanently rejected; a new draft is required to restart.
   *
   * @param versionId        — the version to reject
   * @param reason           — required reason for rejection (audited)
   * @param supertokensUserId — raw SuperTokens user id from the session
   */
  async reject(
    versionId: string,
    reason: string,
    supertokensUserId: string
  ): Promise<OutreachTemplateVersionRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    // SoD: compliance-only gate.
    if (actor.roleName !== COMPLIANCE_ROLE) {
      throw new ForbiddenException(
        `Only the compliance role may reject template versions. Actor role: "${actor.roleName}".`
      );
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Read version inside tx (BUILD rule 7).
      const version = await this.repository.findVersionByIdInTx(tx, versionId);
      if (!version) {
        throw new NotFoundException(`Outreach template version ${versionId} not found`);
      }

      // UPDATE version: set approvalStatus='rejected'.
      const updated = await this.repository.updateVersionApproval(tx, versionId, {
        approvalStatus: 'rejected',
      });

      // AUDIT in-tx (template-approval-reject).
      const eventPayload = {
        versionId,
        templateId: version.templateId,
        reason,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'template-approval-reject',
        resourceType: 'outreach-template-version',
        resourceId: versionId,
        contentHash: version.contentHash,
        payloadHash,
      };

      await this.auditService.append(auditInput, tx);

      return updated;
    });
  }
}
