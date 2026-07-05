/**
 * TemplateService — orchestration for outreach template management.
 *
 * Responsibilities:
 *   1. create        — creates an outreach_template + v1 in ONE transaction.
 *                      content_hash computed via M2 computeContentHash (keyless SHA-256).
 *                      Audited in-tx via AuditService.append (template-create, last-in-txn).
 *   2. draftNewVersion — ALWAYS creates a new version row with a new content_hash.
 *                        NEVER mutates an approved version in place. This is the
 *                        append-style versioning invariant — approved versions are immutable.
 *                        Audited in-tx (template-version-draft).
 *   3. requestApproval — validates required-block (disclaimer FK) → 400 if missing.
 *                        Audited in-tx (template-approval-request).
 *   4. isUsableForSend — VERSION-BINDING INVARIANT (pure predicate, no DB call):
 *                        returns true IFF approvalStatus === 'approved' AND
 *                        approvedContentHash === contentHash.
 *                        This is the authoritative server-side gate pre-check.
 *
 * ── Actor identity (wave-5 lesson) ────────────────────────────────────────
 * All users.id FK columns are populated from the APP users.id — NEVER the
 * raw SuperTokens user id. Translated via AuthRepository.getUserWithRole.
 *
 * ── Content hash (M2 reuse) ────────────────────────────────────────────────
 * computeContentHash from content-hash.ts is THE SAME keyless SHA-256 used
 * by the M2 compliance gate's content-hash binding. Any edit to subject/body
 * MUST produce a new version row (draftNewVersion) — never a mutation.
 */

import { createHash } from 'node:crypto';
import type { AuditEntryInput, TemplateCreateInput, VersionDraftInput } from '@dealflow/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuthRepository } from '../auth/auth.repository';
import { computeContentHash } from '../compliance-gate/content-hash';
import type { OutreachTemplateRow, OutreachTemplateVersionRow, Tx } from './outreach.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { OutreachRepository } from './outreach.repository';

@Injectable()
export class TemplateService {
  constructor(
    private readonly repository: OutreachRepository,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // VERSION-BINDING INVARIANT (pure predicate)
  // ---------------------------------------------------------------------------

  /**
   * isUsableForSend — the version-binding invariant check.
   *
   * Returns true IFF:
   *   1. approvalStatus === 'approved'   (compliance has approved this version)
   *   2. approvedContentHash === contentHash   (the approved hash still matches
   *      the current content — a post-approval draft of a new version resets
   *      the new version's approvedContentHash to NULL, making it NOT usable)
   *
   * This is a PURE function — no DB call, no side effects. Called by
   * OutreachService.composeAsActor as the version-binding gate pre-check.
   *
   * @param version — an OutreachTemplateVersionRow (from findVersionByIdInTx)
   * @returns boolean — true = usable for send; false = NOT usable (gate blocks)
   */
  isUsableForSend(version: OutreachTemplateVersionRow): boolean {
    return (
      version.approvalStatus === 'approved' &&
      version.approvedContentHash !== null &&
      version.approvedContentHash === version.contentHash
    );
  }

  // ---------------------------------------------------------------------------
  // create (template + v1)
  // ---------------------------------------------------------------------------

  /**
   * create — creates an outreach_template + version 1 in ONE atomic transaction.
   *
   * Steps:
   *   1. Translate ST id → app users.id (actor-id-FK lesson).
   *   2. Compute content_hash via computeContentHash(subject + '\n' + body).
   *   3. INSERT outreach_templates.
   *   4. INSERT outreach_template_versions (version_number=1, contentHash).
   *   5. AUDIT template-create LAST-IN-TXN.
   */
  async create(
    input: TemplateCreateInput,
    supertokensUserId: string
  ): Promise<{ template: OutreachTemplateRow; version: OutreachTemplateVersionRow }> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Compute content_hash over the canonicalized v1 content.
      const contentString = `${input.subject}\n${input.body}`;
      const contentHash = computeContentHash(contentString);

      // INSERT template container.
      const template = await this.repository.insertTemplate(tx, {
        name: input.name,
        mandateScope: input.mandateScope ?? null,
        ownerId: appUserId,
      });

      // INSERT version 1 (always starts at 1).
      const version = await this.repository.insertVersion(tx, {
        templateId: template.id,
        versionNumber: 1,
        subject: input.subject,
        body: input.body,
        disclaimerTemplateId: input.disclaimerTemplateId,
        contentHash,
      });

      // AUDIT last-in-txn (rollback on audit fail).
      const eventPayload = {
        templateId: template.id,
        templateName: template.name,
        versionId: version.id,
        versionNumber: 1,
        contentHash,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'template-create',
        resourceType: 'outreach-template',
        resourceId: template.id,
        contentHash,
        payloadHash,
      };

      await this.auditService.append(auditInput, tx);

      return { template, version };
    });
  }

  // ---------------------------------------------------------------------------
  // draftNewVersion
  // ---------------------------------------------------------------------------

  /**
   * draftNewVersion — ALWAYS creates a new version row; NEVER mutates an approved
   * version. This is the append-style versioning invariant.
   *
   * The new version starts with approvalStatus='pending' and
   * approvedContentHash=NULL → isUsableForSend returns false until compliance
   * approves the new version via ApprovalService.grantApproval.
   *
   * Steps:
   *   1. Translate ST id → app users.id.
   *   2. Confirm template exists (404 if not).
   *   3. Compute next version_number = MAX(version_number) + 1 (in tx).
   *   4. Compute content_hash via computeContentHash.
   *   5. INSERT new version row.
   *   6. AUDIT template-version-draft in-tx.
   */
  async draftNewVersion(
    templateId: string,
    input: VersionDraftInput,
    supertokensUserId: string
  ): Promise<OutreachTemplateVersionRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Confirm template exists (BUILD rule 7: read inside tx).
      const template = await this.repository.findTemplateByIdInTx(tx, templateId);
      if (!template) {
        throw new NotFoundException(`Outreach template ${templateId} not found`);
      }

      // Next monotonic version number.
      const maxVersion = await this.repository.findMaxVersionNumber(tx, templateId);
      const nextVersion = maxVersion + 1;

      // Compute content_hash (M2 reuse — keyless SHA-256).
      const contentString = `${input.subject}\n${input.body}`;
      const contentHash = computeContentHash(contentString);

      // INSERT new version (approvalStatus='pending', approvedContentHash=NULL by default).
      const version = await this.repository.insertVersion(tx, {
        templateId,
        versionNumber: nextVersion,
        subject: input.subject,
        body: input.body,
        disclaimerTemplateId: input.disclaimerTemplateId,
        contentHash,
      });

      // AUDIT in-tx.
      const eventPayload = {
        templateId,
        versionId: version.id,
        versionNumber: nextVersion,
        contentHash,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'template-version-draft',
        resourceType: 'outreach-template-version',
        resourceId: version.id,
        contentHash,
        payloadHash,
      };

      await this.auditService.append(auditInput, tx);

      return version;
    });
  }

  // ---------------------------------------------------------------------------
  // requestApproval
  // ---------------------------------------------------------------------------

  /**
   * requestApproval — validates the required-compliance-block and audits the
   * approval request. Returns 400 if the version's disclaimer_template_id does
   * not reference a valid disclaimer_templates row.
   *
   * NOTE: this method does NOT change the approval_status field — it validates
   * that the version is ready for compliance review and audits the request.
   * The actual status transition (pending→approved|rejected) is handled by
   * ApprovalService.grantApproval / .reject.
   */
  async requestApproval(
    versionId: string,
    supertokensUserId: string
  ): Promise<OutreachTemplateVersionRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Find version inside tx (BUILD rule 7).
      const version = await this.repository.findVersionByIdInTx(tx, versionId);
      if (!version) {
        throw new NotFoundException(`Outreach template version ${versionId} not found`);
      }

      // REQUIRED-BLOCK validation: confirm the disclaimer_template_id FK is valid.
      // Returns 400 if the disclaimer row does not exist.
      const disclaimer = await this.repository.findDisclaimerById(tx, version.disclaimerTemplateId);
      if (!disclaimer) {
        throw new BadRequestException(
          `The version's disclaimer_template_id "${version.disclaimerTemplateId}" does not ` +
            'reference a valid disclaimer_templates row. Update the version with a valid ' +
            'disclaimer before requesting approval.'
        );
      }

      // AUDIT in-tx (template-approval-request).
      const eventPayload = {
        versionId,
        templateId: version.templateId,
        disclaimerTemplateId: version.disclaimerTemplateId,
        contentHash: version.contentHash,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'template-approval-request',
        resourceType: 'outreach-template-version',
        resourceId: versionId,
        contentHash: version.contentHash,
        payloadHash,
      };

      await this.auditService.append(auditInput, tx);

      return version;
    });
  }

  // ---------------------------------------------------------------------------
  // List / detail
  // ---------------------------------------------------------------------------

  /**
   * listTemplates — C-2 FIX: returns all outreach templates, each embedding its
   * full versions array. The compliance-queue, template-library, and composer pages
   * all parse GET /outreach-templates expecting
   *   { templates: Array<OutreachTemplate & { versions: OutreachTemplateVersion[] }> }
   * Versions are fetched via a single LEFT JOIN round-trip (one query, not N+1).
   */
  async listTemplates(): Promise<{
    templates: Array<OutreachTemplateRow & { versions: OutreachTemplateVersionRow[] }>;
  }> {
    const templates = await this.repository.listTemplatesWithVersions();
    return { templates };
  }

  /**
   * getTemplateById — returns template + its versions.
   * Throws 404 if not found.
   */
  async getTemplateById(
    id: string
  ): Promise<{ template: OutreachTemplateRow; versions: OutreachTemplateVersionRow[] }> {
    const [template, versions] = await Promise.all([
      this.repository.findTemplateById(id),
      this.repository.listVersionsByTemplateId(id),
    ]);
    if (!template) {
      throw new NotFoundException(`Outreach template ${id} not found`);
    }
    return { template, versions };
  }

  /**
   * getPendingVersions — returns all versions with approvalStatus='pending'.
   * Used by the compliance queue view.
   */
  async getPendingVersions(): Promise<OutreachTemplateVersionRow[]> {
    return this.repository.listPendingVersions();
  }
}
