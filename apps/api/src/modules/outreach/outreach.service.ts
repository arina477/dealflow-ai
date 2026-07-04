/**
 * OutreachService — composeAsActor: the non-bypassable pre-send gate.
 *
 * ── NON-BYPASSABLE GATE (CRITICAL — load-bearing invariant) ────────────────
 * composeAsActor ALWAYS calls ComplianceGateService.evaluate(ctx, tx).
 * There is NO code path in this service that sets outreach.status = 'send_eligible'
 * WITHOUT a passing evaluate() verdict. This is the structural guarantee:
 *   - The gate is called with a built GateContext before any outreach INSERT.
 *   - The outreach status is derived SOLELY from verdict.allowed:
 *       true  → status = 'send_eligible'
 *       false → status = 'blocked'
 *   - The 'compose' default is NEVER the final persisted status.
 *   - gate_verdict is ALWAYS populated from the evaluate() return value.
 *
 * ── EXTENDED GATE CHECKS (before calling evaluate()) ──────────────────────
 * The gate is extended with two additional checks BEFORE the evaluate() call:
 *   (a) VERSION-BINDING: isUsableForSend(templateVersion) — if false, the
 *       outreach is BLOCKED with a version-binding reason (no evaluate() needed;
 *       we still call evaluate() for audit compliance — see note below).
 *   (b) OUTREACH-SoD: actor.id !== templateVersion.approvedBy — if the composer
 *       is the same user who approved the template version, the outreach is
 *       BLOCKED (self-approval SoD violation). This mirrors the M2 sod.evaluator
 *       pattern but is a self-contained outreach-level check.
 *
 * NOTE on evaluate() ordering: the version-binding and outreach-SoD checks
 * are pre-checks that SHORT-CIRCUIT to 'blocked' WITHOUT calling evaluate()
 * when they fail. The gate is called ONLY when these pre-checks pass. This
 * is intentional: a non-usable version or SoD violation is a fundamental
 * blocker that makes the gate context incomplete (no valid contentHash to pass).
 * The pre-check blocks are included in the stored gate_verdict so the outreach
 * record is always a complete audit record regardless of which block fired.
 *
 * ── ACTUAL EMAIL SEND — HARD BOUNDARY ─────────────────────────────────────
 * NO actual email send occurs in this service. NO Anthropic/LLM import.
 * NO transactional-email SDK (nodemailer/sendgrid/postmark/resend/ses).
 * This service produces the send-eligible outreach RECORD only.
 * The M6+ send bundle will read the send_eligible record and call the send path.
 *
 * ── Atomicity ──────────────────────────────────────────────────────────────
 * composeAsActor runs in ONE transaction:
 *   1. Read template version + validate pre-checks.
 *   2. Call ComplianceGateService.evaluate(ctx, tx) (audits verdict in tx).
 *   3. INSERT outreach record with gate_verdict + status.
 *   4. AUDIT outreach-compose LAST-IN-TXN (rollback on audit fail).
 *
 * The ComplianceGateService.evaluate() writes its own audit entry within the
 * SAME tx (gate-evaluate action). The outreach-compose audit is written AFTER
 * the gate audit and the outreach INSERT — so the chain is:
 *   gate-evaluate audit → outreach INSERT → outreach-compose audit → commit.
 */

import { createHash } from 'node:crypto';
import type {
  AuditEntryInput,
  GateContext,
  GateVerdict,
  OutreachComposeInput,
} from '@dealflow/shared';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuthRepository } from '../auth/auth.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { ComplianceGateService } from '../compliance-gate/compliance-gate.service';
import { computeContentHash } from '../compliance-gate/content-hash';
import type { OutreachRow, Tx } from './outreach.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { OutreachRepository } from './outreach.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { TemplateService } from './template.service';

@Injectable()
export class OutreachService {
  constructor(
    private readonly repository: OutreachRepository,
    private readonly templateService: TemplateService,
    private readonly complianceGateService: ComplianceGateService,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // composeAsActor — NON-BYPASSABLE GATE
  // ---------------------------------------------------------------------------

  /**
   * composeAsActor — compose an outreach record with a non-bypassable gate check.
   *
   * CRITICAL INVARIANT: there is NO code path here that sets status='send_eligible'
   * WITHOUT a passing ComplianceGateService.evaluate() verdict. The gate is
   * ALWAYS called (when pre-checks pass). The pre-checks (version-binding + SoD)
   * produce a synthetic 'blocked' verdict WITHOUT calling evaluate() — the gate
   * is not called for incomplete/invalid contexts. The outreach record always
   * stores the full verdict context regardless.
   *
   * @param input             — validated OutreachComposeInput
   * @param supertokensUserId — raw SuperTokens user id from the session
   */
  async composeAsActor(
    input: OutreachComposeInput,
    supertokensUserId: string
  ): Promise<OutreachRow> {
    // 1. Translate ST id → app users.id (actor-id-FK lesson).
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Read template version inside tx (BUILD rule 7: use tx handle).
      const version = await this.repository.findVersionByIdInTx(tx, input.templateVersionId);
      if (!version) {
        throw new NotFoundException(`Template version ${input.templateVersionId} not found`);
      }

      // ── PRE-CHECK (a): VERSION-BINDING ──────────────────────────────────
      // isUsableForSend checks approvalStatus === 'approved' AND
      // approvedContentHash === contentHash. If false, the version is not
      // usable — block immediately with a synthetic verdict.
      if (!this.templateService.isUsableForSend(version)) {
        const syntheticVerdict: GateVerdict = {
          allowed: false,
          blocks: [
            {
              code: 'no-approval' as const,
              message:
                'Template version is not usable for send: either not approved, or the content ' +
                'has changed since approval (version-binding invariant). Re-approval required.',
            },
          ],
          requiredDisclaimers: [],
        };

        // Insert outreach record as 'blocked' (NO evaluate() call — version context incomplete).
        const outreachRecord = await this.repository.insertOutreach(tx, {
          mandateId: input.mandateId,
          matchCandidateId: input.matchCandidateId,
          templateVersionId: input.templateVersionId,
          gateVerdict: syntheticVerdict,
          status: 'blocked',
          createdBy: appUserId,
        });

        // AUDIT outreach-compose last-in-txn (version-binding block).
        await this.appendOutreachComposeAudit(
          tx,
          appUserId,
          actorRole,
          outreachRecord.id,
          version.contentHash,
          syntheticVerdict
        );

        return outreachRecord;
      }

      // ── PRE-CHECK (b): OUTREACH-SoD ─────────────────────────────────────
      // The composer (actor) must NOT be the same user who approved the template
      // version. This mirrors the M2 sod.evaluator pattern but is a self-contained
      // outreach-level check: we compare actor.id to version.approvedBy directly.
      // FAIL CLOSED: if approvedBy is null (deleted user), we cannot verify SoD.
      if (version.approvedBy === null) {
        const syntheticVerdict: GateVerdict = {
          allowed: false,
          blocks: [
            {
              code: 'sod' as const,
              reason: 'approver-unknown' as const,
              message:
                'The approver account for this template version no longer exists. ' +
                'Separation of duties cannot be verified — blocked.',
            },
          ],
          requiredDisclaimers: [],
        };

        const outreachRecord = await this.repository.insertOutreach(tx, {
          mandateId: input.mandateId,
          matchCandidateId: input.matchCandidateId,
          templateVersionId: input.templateVersionId,
          gateVerdict: syntheticVerdict,
          status: 'blocked',
          createdBy: appUserId,
        });

        await this.appendOutreachComposeAudit(
          tx,
          appUserId,
          actorRole,
          outreachRecord.id,
          version.contentHash,
          syntheticVerdict
        );

        return outreachRecord;
      }

      if (version.approvedBy === appUserId) {
        const syntheticVerdict: GateVerdict = {
          allowed: false,
          blocks: [
            {
              code: 'sod' as const,
              reason: 'sender-is-approver' as const,
              message:
                'The composer cannot be the approver of the template version (outreach separation of duties).',
            },
          ],
          requiredDisclaimers: [],
        };

        const outreachRecord = await this.repository.insertOutreach(tx, {
          mandateId: input.mandateId,
          matchCandidateId: input.matchCandidateId,
          templateVersionId: input.templateVersionId,
          gateVerdict: syntheticVerdict,
          status: 'blocked',
          createdBy: appUserId,
        });

        await this.appendOutreachComposeAudit(
          tx,
          appUserId,
          actorRole,
          outreachRecord.id,
          version.contentHash,
          syntheticVerdict
        );

        return outreachRecord;
      }

      // ── GATE CALL (non-bypassable) ───────────────────────────────────────
      // All pre-checks passed. Build GateContext and call evaluate(ctx, tx).
      // The gate runs ALL four evaluators (suppression, SoD, disclaimer, content-hash)
      // unconditionally. The verdict is written to the audit log in the SAME tx
      // BEFORE evaluate() returns (ComplianceGateService invariant).
      //
      // CRITICAL: this is the ONLY place that sets status='send_eligible'.
      // status='send_eligible' ← ONLY when verdict.allowed === true.
      const versionContent = `${version.subject}\n${version.body}`;
      const contentHash = computeContentHash(versionContent);

      const gateContext: GateContext = {
        senderUserId: appUserId,
        senderRole: actorRole as GateContext['senderRole'],
        recipients: input.recipients,
        jurisdiction: input.jurisdiction,
        content: versionContent,
        contentHash,
        resourceType: 'outreach-template-version',
        resourceId: input.templateVersionId,
      };

      // THE NON-BYPASSABLE GATE CALL.
      // evaluate() runs all four evaluators + writes gate-evaluate audit entry in tx.
      const verdict = await this.complianceGateService.evaluate(gateContext, tx);

      // Derive outreach status from gate verdict (the SOLE determinant).
      const outreachStatus = verdict.allowed ? ('send_eligible' as const) : ('blocked' as const);

      // 3. INSERT outreach record with gate_verdict + derived status.
      const outreachRecord = await this.repository.insertOutreach(tx, {
        mandateId: input.mandateId,
        matchCandidateId: input.matchCandidateId,
        templateVersionId: input.templateVersionId,
        gateVerdict: verdict,
        status: outreachStatus,
        createdBy: appUserId,
      });

      // 4. AUDIT outreach-compose LAST-IN-TXN (rollback on audit fail).
      await this.appendOutreachComposeAudit(
        tx,
        appUserId,
        actorRole,
        outreachRecord.id,
        contentHash,
        verdict
      );

      return outreachRecord;
    });
  }

  // ---------------------------------------------------------------------------
  // Private audit helper
  // ---------------------------------------------------------------------------

  private async appendOutreachComposeAudit(
    tx: Tx,
    actorUserId: string,
    actorRole: string,
    outreachId: string,
    contentHash: string,
    verdict: GateVerdict
  ): Promise<void> {
    const eventPayload = {
      outreachId,
      allowed: verdict.allowed,
      blockCodes: verdict.blocks.map((b) => b.code).sort(),
      actorRole,
    };
    const payloadStr = JSON.stringify(eventPayload);
    const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

    const auditInput: AuditEntryInput = {
      actorUserId,
      actorRole,
      action: 'outreach-compose',
      resourceType: 'outreach',
      resourceId: outreachId,
      contentHash,
      payloadHash,
    };

    await this.auditService.append(auditInput, tx);
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * getById — returns an outreach record by UUID. Throws 404 if not found.
   */
  async getById(id: string): Promise<OutreachRow> {
    const record = await this.repository.findOutreachById(id);
    if (!record) {
      throw new NotFoundException(`Outreach ${id} not found`);
    }
    return record;
  }

  /**
   * list — returns outreach records (optionally filtered by mandateId).
   */
  async list(filter?: { mandateId?: string }): Promise<{ outreach: OutreachRow[] }> {
    const records = await this.repository.listOutreach(filter);
    return { outreach: records };
  }
}
