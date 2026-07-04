/**
 * MandateService — orchestration for the mandate spine.
 *
 * Responsibilities:
 *   1. createAsActor — creates a mandate (mandates + buyer_criteria + compliance_profile)
 *      in ONE transaction. Audited in-tx via AuditService.append (last-in-txn).
 *   2. configureAsActor — PATCH a draft mandate; audited in-tx.
 *   3. list — list mandates with optional status filter.
 *   4. getById — mandate detail (mandate + buyer criteria + compliance profile); 404 if absent.
 *
 * ── Actor identity (wave-5 lesson) ─────────────────────────────────────────
 * ALL users.id FK columns are populated from the APP users.id — NEVER the
 * raw SuperTokens user id from the session. The service translates via
 * AuthRepository.getUserWithRole(supertokensUserId) before any DB write.
 * The raw ST id MUST NOT touch mandates.created_by or any audit field.
 *
 * ── 3-table atomicity ──────────────────────────────────────────────────────
 * createAsActor opens ONE transaction and inserts mandates + mandate_buyer_criteria
 * + mandate_compliance_profile + audit entry all inside it. Any failure (including
 * audit fail) rolls back all three table writes.
 *
 * ── Disclaimer derivation (D2) ─────────────────────────────────────────────
 * disclaimer_template_id is NEVER sourced from the request body. The service
 * looks up the active disclaimer template for input.compliance.jurisdiction
 * INSIDE the transaction. No match → BadRequestException(400).
 *
 * ── Acknowledgments (D5) ───────────────────────────────────────────────────
 * All 3 attestations (lawful_authorization, ai_results_validated,
 * conflict_dbs_reviewed) must be true. The mandateCreateSchema enforces this
 * at parse time via z.literal(true); the service additionally guards here.
 *
 * ── Audit (last-in-txn) ────────────────────────────────────────────────────
 * AuditService.append is called LAST in the transaction, after all business
 * writes. Audit failure rolls back the whole transaction (chain integrity).
 */

import { createHash } from 'node:crypto';
import type {
  AuditEntryInput,
  Mandate,
  MandateConfigureInput,
  MandateCreateInput,
  MandateDetail,
  MandateListFilter,
} from '@dealflow/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuthRepository } from '../auth/auth.repository';
import type { MandateRow, Tx } from './mandate.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { MandateRepository } from './mandate.repository';

@Injectable()
export class MandateService {
  constructor(
    private readonly repository: MandateRepository,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  /**
   * createAsActor — creates a mandate in a single atomic transaction.
   *
   * Steps (all in ONE tx — 3-table atomicity):
   *   1. Translate ST id → app users.id (actor-id-FK lesson).
   *   2. Validate all 3 acknowledgments (defensive; schema enforces at parse time).
   *   3. DERIVE disclaimer_template_id from input.compliance.jurisdiction (D2).
   *   4. INSERT mandates (created_by = appUserId).
   *   5. INSERT mandate_buyer_criteria.
   *   6. INSERT mandate_compliance_profile (with derived disclaimerTemplateId + acks).
   *   7. AUDIT mandate-create LAST-IN-TXN (rollback whole tx on audit fail).
   *
   * @param input              — validated MandateCreateInput (body)
   * @param supertokensUserId  — raw SuperTokens user id from the session
   */
  async createAsActor(input: MandateCreateInput, supertokensUserId: string): Promise<Mandate> {
    // 1. Translate SuperTokens id → app users.id (NEVER use ST id as a DB FK).
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    // 2. Defensive acknowledgments check (schema-level z.literal(true) is the
    //    primary guard; this catches any call-site that bypasses Zod validation).
    const { acknowledgments } = input.compliance;
    if (
      !acknowledgments.lawful_authorization ||
      !acknowledgments.ai_results_validated ||
      !acknowledgments.conflict_dbs_reviewed
    ) {
      throw new BadRequestException(
        'All three acknowledgments (lawful_authorization, ai_results_validated, ' +
          'conflict_dbs_reviewed) must be true'
      );
    }

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 3. DERIVE disclaimer_template_id from jurisdiction (D2). No user-supplied FK.
      const disclaimer = await this.repository.findActiveDisclaimerByJurisdiction(
        tx,
        input.compliance.jurisdiction
      );
      if (!disclaimer) {
        throw new BadRequestException(
          `No active disclaimer template found for jurisdiction "${input.compliance.jurisdiction}". ` +
            'Ensure a disclaimer template is active for this jurisdiction before creating a mandate.'
        );
      }

      // 4. INSERT mandate row (created_by = app users.id, NOT raw ST id).
      const mandate = await this.repository.insertMandate(tx, {
        createdBy: appUserId,
        sellerName: input.sellerName,
        sellerIndustry: input.sellerIndustry ?? null,
        sellerGeo: input.sellerGeo ?? null,
        sellerSizeBand: input.sellerSizeBand ?? null,
        description: input.description ?? null,
        dealType: input.dealType ?? null,
      });

      // 5. INSERT buyer criteria (cascade on mandate delete).
      await this.repository.insertBuyerCriteria(tx, {
        mandateId: mandate.id,
        industry: input.buyerCriteria?.industry ?? null,
        geo: input.buyerCriteria?.geo ?? null,
        sizeBand: input.buyerCriteria?.sizeBand ?? null,
        dealType: input.buyerCriteria?.dealType ?? null,
      });

      // 6. INSERT compliance profile (1:1; uses DERIVED disclaimer FK).
      await this.repository.insertComplianceProfile(tx, {
        mandateId: mandate.id,
        jurisdiction: input.compliance.jurisdiction,
        disclaimerTemplateId: disclaimer.id,
        suppressionScope: input.compliance.suppressionScope ?? null,
        // All 3 attestations validated above; always true here.
        lawfulAuthorization: true,
        aiResultsValidated: true,
        conflictDbsReviewed: true,
      });

      // 7. AUDIT in-tx — LAST-IN-TXN (audit failure rolls back ALL 3 table writes).
      //    actorUserId = app users.id (NOT the raw SuperTokens id — actor-id-FK lesson).
      const eventPayload = {
        mandateId: mandate.id,
        sellerName: mandate.sellerName,
        jurisdiction: input.compliance.jurisdiction,
        disclaimerTemplateId: disclaimer.id,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');
      // contentHash mirrors payloadHash (no separate "content" blob for mandate creation).
      const contentHash = payloadHash;

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'mandate-create',
        resourceType: 'mandate',
        resourceId: mandate.id,
        contentHash,
        payloadHash,
      };

      await this.auditService.append(auditInput, tx);

      return toMandate(mandate);
    });
  }

  // ---------------------------------------------------------------------------
  // configure (PATCH)
  // ---------------------------------------------------------------------------

  /**
   * configureAsActor — partially updates a mandate (draft → active or field update).
   *
   * State-machine rules (authoritative, server-enforced):
   *   - An 'active' mandate is LOCKED: profile/criteria/compliance edits are
   *     rejected with 409 ConflictException. Any field mutation or status
   *     revert (active → draft) on a live mandate is illegal.
   *   - A 'draft' mandate may be freely edited. The only legal transition is
   *     draft → active (when the mandate is complete).
   *   - active → draft is never permitted (one-way activation gate).
   *
   * Returns a full MandateDetail (mandate + buyerCriteria + complianceProfile)
   * so the client can re-render the detail page without a separate GET.
   *
   * Audited in-tx via AuditService.append (mandate-configure).
   * Actor = app users.id (actor-id-FK lesson).
   *
   * @param id                 — the mandate UUID to configure
   * @param input              — validated MandateConfigureInput (partial body)
   * @param supertokensUserId  — raw SuperTokens user id from the session
   */
  async configureAsActor(
    id: string,
    input: MandateConfigureInput,
    supertokensUserId: string
  ): Promise<MandateDetail> {
    // Translate SuperTokens id → app users.id.
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Confirm the mandate exists inside the transaction.
      const existing = await this.repository.findMandateByIdForUpdate(tx, id);
      if (!existing) {
        throw new NotFoundException(`Mandate ${id} not found`);
      }

      // ── State-machine enforcement (CRITICAL-2) ──────────────────────────
      // An 'active' mandate is locked. No field edits or status reversions
      // are permitted once a mandate is live. This is the authoritative
      // server-side gate — the client-side UI disables controls as a UX
      // convenience only.
      if (existing.status === 'active') {
        throw new ConflictException(
          'Active mandate is locked. Profile, criteria, and compliance fields cannot be ' +
            'modified after activation. The active → draft transition is not permitted.'
        );
      }

      // At this point existing.status === 'draft'.
      // The active-mandate lock above catches all mutations on an active mandate,
      // including active→draft attempts. Any patch on a draft proceeds below.

      // Update mandate row (only defined fields).
      // exactOptionalPropertyTypes: use conditional spread so no key is
      // present with value `undefined` (which violates the strict optional type).
      const updated = await this.repository.updateMandate(tx, id, {
        ...(input.sellerName !== undefined && { sellerName: input.sellerName }),
        ...(input.sellerIndustry !== undefined && { sellerIndustry: input.sellerIndustry }),
        ...(input.sellerGeo !== undefined && { sellerGeo: input.sellerGeo }),
        ...(input.sellerSizeBand !== undefined && { sellerSizeBand: input.sellerSizeBand }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.dealType !== undefined && { dealType: input.dealType }),
        ...(input.status !== undefined && { status: input.status }),
      });

      // Update buyer criteria if provided.
      if (input.buyerCriteria) {
        const bc = input.buyerCriteria;
        await this.repository.upsertBuyerCriteria(tx, {
          mandateId: id,
          ...(bc.industry !== undefined && { industry: bc.industry }),
          ...(bc.geo !== undefined && { geo: bc.geo }),
          ...(bc.sizeBand !== undefined && { sizeBand: bc.sizeBand }),
          ...(bc.dealType !== undefined && { dealType: bc.dealType }),
        });
      }

      // AUDIT in-tx (last).
      const eventPayload = {
        mandateId: id,
        changes: Object.keys(input).filter(
          (k) => (input as Record<string, unknown>)[k] !== undefined
        ),
        newStatus: updated.status,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');
      const contentHash = payloadHash;

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'mandate-configure',
        resourceType: 'mandate',
        resourceId: id,
        contentHash,
        payloadHash,
      };

      await this.auditService.append(auditInput, tx);

      // ── Return full MandateDetail (CRITICAL-1) ──────────────────────────
      // Read the post-update buyer criteria and compliance profile inside the
      // same transaction so the response is consistent with the committed state.
      const [buyerCriteria, complianceProfile] = await Promise.all([
        this.repository.findBuyerCriteriaByMandateIdInTx(tx, id),
        this.repository.findComplianceProfileByMandateIdInTx(tx, id),
      ]);

      return {
        mandate: toMandate(updated),
        buyerCriteria: buyerCriteria
          ? {
              id: buyerCriteria.id,
              mandateId: buyerCriteria.mandateId,
              industry: buyerCriteria.industry ?? null,
              geo: buyerCriteria.geo ?? null,
              sizeBand: buyerCriteria.sizeBand ?? null,
              dealType: buyerCriteria.dealType ?? null,
            }
          : null,
        complianceProfile: complianceProfile
          ? {
              id: complianceProfile.id,
              mandateId: complianceProfile.mandateId,
              jurisdiction: complianceProfile.jurisdiction,
              disclaimerTemplateId: complianceProfile.disclaimerTemplateId,
              suppressionScope: complianceProfile.suppressionScope ?? null,
              lawfulAuthorization: complianceProfile.lawfulAuthorization,
              aiResultsValidated: complianceProfile.aiResultsValidated,
              conflictDbsReviewed: complianceProfile.conflictDbsReviewed,
            }
          : null,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // list + detail
  // ---------------------------------------------------------------------------

  /**
   * list — returns mandates filtered by status.
   * Status 'all' (default) returns both draft and active mandates.
   */
  async list(filter: MandateListFilter): Promise<{ mandates: Mandate[] }> {
    const rows = await this.repository.listMandates(filter);
    return { mandates: rows.map(toMandate) };
  }

  /**
   * getById — returns a MandateDetail (mandate + buyer criteria + compliance profile).
   * Throws NotFoundException (404) if the mandate is not found.
   */
  async getById(id: string): Promise<MandateDetail> {
    const [mandate, buyerCriteria, complianceProfile] = await Promise.all([
      this.repository.findMandateById(id),
      this.repository.findBuyerCriteriaByMandateId(id),
      this.repository.findComplianceProfileByMandateId(id),
    ]);

    if (!mandate) {
      throw new NotFoundException(`Mandate ${id} not found`);
    }

    return {
      mandate: toMandate(mandate),
      buyerCriteria: buyerCriteria
        ? {
            id: buyerCriteria.id,
            mandateId: buyerCriteria.mandateId,
            industry: buyerCriteria.industry ?? null,
            geo: buyerCriteria.geo ?? null,
            sizeBand: buyerCriteria.sizeBand ?? null,
            dealType: buyerCriteria.dealType ?? null,
          }
        : null,
      complianceProfile: complianceProfile
        ? {
            id: complianceProfile.id,
            mandateId: complianceProfile.mandateId,
            jurisdiction: complianceProfile.jurisdiction,
            disclaimerTemplateId: complianceProfile.disclaimerTemplateId,
            suppressionScope: complianceProfile.suppressionScope ?? null,
            lawfulAuthorization: complianceProfile.lawfulAuthorization,
            aiResultsValidated: complianceProfile.aiResultsValidated,
            conflictDbsReviewed: complianceProfile.conflictDbsReviewed,
          }
        : null,
    };
  }
}

// ---------------------------------------------------------------------------
// Row → shared type mapper
// ---------------------------------------------------------------------------

function toMandate(row: MandateRow): Mandate {
  return {
    id: row.id,
    createdBy: row.createdBy,
    sellerName: row.sellerName,
    sellerIndustry: row.sellerIndustry ?? null,
    sellerGeo: row.sellerGeo ?? null,
    sellerSizeBand: row.sellerSizeBand ?? null,
    description: row.description ?? null,
    dealType: row.dealType ?? null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
  };
}
