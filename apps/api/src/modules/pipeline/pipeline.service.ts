/**
 * PipelineService — deal-stage tracking mutations.
 *
 * ── Methods ─────────────────────────────────────────────────────────────────
 *   enrollAsActor       — create a pipeline row from an eligible source.
 *   transitionStageAsActor — move a deal to a new fixed stage.
 *   addNoteAsActor      — append a free-text note event.
 *   getBoard            — deals grouped by stage (optional mandateId filter).
 *   getEvents           — ordered event timeline for a deal.
 *
 * ── ELIGIBLE-SOURCE GUARD ────────────────────────────────────────────────────
 * enrollAsActor enforces:
 *   sourceType='outreach' → outreach.status MUST be 'send_eligible' (else 400).
 *   sourceType='match_candidate' → match_candidate.disposition MUST be 'accepted'
 *     AND its match_run.ready_for_outreach MUST be true (else 400).
 * Ineligible source is rejected with 400 BadRequestException.
 *
 * ── MANDATE-PROVENANCE GUARD (H-1) ──────────────────────────────────────────
 * enrollAsActor validates that the source (outreach or match_candidate via its
 * match_run) BELONGS to the caller-supplied mandateId. The source's mandate_id
 * is selected in the same tx-scoped read as the eligibility fields and compared
 * to input.mandateId BEFORE insertPipeline. A mismatch is rejected with 400
 * ("source does not belong to mandate"). This prevents a caller from enrolling
 * a source from mandate A while passing mandateId=B — which would record a false
 * mandate association across the pipeline row, pipeline_events, and audit_log_entries.
 *
 * Design choice: we keep input.mandateId in the call signature (the web enroll
 * call passes it) but treat the source's actual mandate_id as ground truth and
 * reject any divergence rather than silently overriding the caller's value. If
 * the source's mandate equals input.mandateId the pipeline row is written with
 * that value. If they differ the call is rejected before any write.
 *
 * ── IDEMPOTENT ENROLL ────────────────────────────────────────────────────────
 * The DB partial UNIQUE index prevents duplicate pipeline rows per deal target.
 * PipelineRepository.insertPipeline catches 23505 (unique_violation) and throws
 * ConflictException (409). The service surfaces this directly — no second row.
 *
 * ── FIXED-ENUM TRANSITION GUARD ─────────────────────────────────────────────
 * transitionStageAsActor validates toStage ∈ the 7 fixed pipelineStageEnum at
 * the service level (Zod already guards the HTTP input; service re-validates for
 * direct-call safety).
 *
 * ── APPEND-ONLY NOTES ────────────────────────────────────────────────────────
 * addNoteAsActor appends exactly ONE pipeline_events row (type='note') and ONE
 * audit_log_entries row in the same txn. No edit or delete path exists.
 *
 * ── AUDIT LAST-IN-TXN ────────────────────────────────────────────────────────
 * Every mutation runs ONE transaction. AuditService.append is called LAST in
 * every txn — after all business writes. Audit failure rolls back the whole txn
 * (no orphan rows, no orphan events without an audit entry).
 *
 * ── ACTOR IDENTITY (wave-5 lesson) ──────────────────────────────────────────
 * All actor IDs (createdBy, updatedBy, actorId on events) are the APP users.id
 * obtained via AuthRepository.getUserWithRole(supertokensUserId). The raw
 * SuperTokens id from the session is NEVER written to the DB directly.
 *
 * ── TX-SCOPED READS (BUILD rule 7) ──────────────────────────────────────────
 * All reads inside runInTransaction use the tx-scoped repository methods
 * (findPipelineByIdInTx, findOutreachByIdInTx, etc.) to ensure they share
 * the transaction snapshot and are not subject to phantom reads.
 *
 * ── HARD BOUNDARY ───────────────────────────────────────────────────────────
 * NO Anthropic/LLM import. NO email SDK. NO new external SDK. Additive only.
 */

import { createHash } from 'node:crypto';
import type { AuditEntryInput } from '@dealflow/shared';
import { pipelineStageEnum } from '@dealflow/shared';
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
import type { PipelineEventRow, PipelineRow, Tx } from './pipeline.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { PipelineRepository } from './pipeline.repository';

/** The 7 fixed stage values as a Set for O(1) validation. */
const VALID_STAGES = new Set(pipelineStageEnum.options);

@Injectable()
export class PipelineService {
  constructor(
    private readonly repository: PipelineRepository,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // enrollAsActor — create a pipeline row from an eligible source
  // ---------------------------------------------------------------------------

  /**
   * enrollAsActor — enroll a deal target into the pipeline.
   *
   * Steps (all in ONE tx):
   *   1. Translate ST id → app users.id (actor-id-FK lesson).
   *   2. Eligible-source guard + mandate-provenance guard (tx-scoped read — BUILD rule 7):
   *      - sourceType='outreach' → outreach.status MUST be 'send_eligible'.
   *        outreach.mandate_id MUST equal input.mandateId (H-1 provenance guard).
   *      - sourceType='match_candidate' → disposition MUST be 'accepted' AND
   *        match_run.ready_for_outreach MUST be true.
   *        match_run.mandate_id MUST equal input.mandateId (H-1 provenance guard).
   *      Mismatch rejected with 400 BadRequestException BEFORE any INSERT.
   *   3. INSERT pipeline row at stage 'shortlisted'.
   *      DB UNIQUE constraint rejects duplicate enrolls (23505 → 409).
   *   4. INSERT pipeline_events row (type='enrolled').
   *   5. AUDIT pipeline-enroll LAST-IN-TXN (rollback on audit fail).
   */
  async enrollAsActor(
    input: {
      sourceType: 'outreach' | 'match_candidate';
      sourceId: string;
      mandateId: string;
    },
    supertokensUserId: string
  ): Promise<PipelineRow> {
    // 1. Translate ST id → app users.id.
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Eligible-source guard + mandate-provenance guard (tx-scoped reads — BUILD rule 7).
      //    For each source type: verify eligibility first, then verify the source's mandate_id
      //    matches input.mandateId (H-1 fix: reject cross-mandate enrollment before any INSERT).
      if (input.sourceType === 'outreach') {
        const outreachRow = await this.repository.findOutreachByIdInTx(tx, input.sourceId);
        if (!outreachRow) {
          throw new NotFoundException(`Outreach ${input.sourceId} not found`);
        }
        if (outreachRow.status !== 'send_eligible') {
          throw new BadRequestException(
            `Outreach ${input.sourceId} is not eligible for pipeline enrollment: ` +
              `status is '${outreachRow.status}' (must be 'send_eligible'). ` +
              'The outreach must pass the pre-send gate before it can be enrolled.'
          );
        }
        // H-1 mandate-provenance guard: the outreach must belong to the declared mandate.
        // Prevents a caller from recording a false mandate association on the pipeline row,
        // pipeline_events, and audit_log_entries (compliance provenance defect).
        if (outreachRow.mandateId !== input.mandateId) {
          throw new BadRequestException(
            `Source does not belong to mandate: outreach ${input.sourceId} belongs to mandate ` +
              `${outreachRow.mandateId}, not ${input.mandateId}. ` +
              'Enroll using the mandate that owns this outreach record.'
          );
        }
      } else {
        // sourceType='match_candidate'
        const candidateRow = await this.repository.findMatchCandidateEligibilityInTx(
          tx,
          input.sourceId
        );
        if (!candidateRow) {
          throw new NotFoundException(`Match candidate ${input.sourceId} not found`);
        }
        if (candidateRow.disposition !== 'accepted') {
          throw new BadRequestException(
            `Match candidate ${input.sourceId} is not eligible for pipeline enrollment: ` +
              `disposition is '${candidateRow.disposition}' (must be 'accepted'). ` +
              'Accept the candidate in the match run before enrolling it.'
          );
        }
        if (!candidateRow.readyForOutreach) {
          throw new BadRequestException(
            `Match candidate ${input.sourceId} is not eligible for pipeline enrollment: ` +
              'the match run has not been handed off (ready_for_outreach is false). ' +
              'Hand off the match run before enrolling candidates from it.'
          );
        }
        // H-1 mandate-provenance guard: the match_run (and therefore this candidate) must
        // belong to the declared mandate. Prevents cross-mandate provenance defect.
        if (candidateRow.mandateId !== input.mandateId) {
          throw new BadRequestException(
            `Source does not belong to mandate: match candidate ${input.sourceId} belongs to ` +
              `mandate ${candidateRow.mandateId} (via its match run), not ${input.mandateId}. ` +
              'Enroll using the mandate that owns this match candidate.'
          );
        }
      }

      // 3. INSERT pipeline row at stage 'shortlisted'.
      //    DB UNIQUE constraint rejects duplicate enrolls (23505 → 409 ConflictException).
      const pipelineRow = await this.repository.insertPipeline(tx, {
        mandateId: input.mandateId,
        dealSourceType: input.sourceType,
        outreachId: input.sourceType === 'outreach' ? input.sourceId : null,
        matchCandidateId: input.sourceType === 'match_candidate' ? input.sourceId : null,
        createdBy: appUserId,
      });

      // 4. INSERT pipeline_events row (type='enrolled').
      await this.repository.insertPipelineEvent(tx, {
        pipelineId: pipelineRow.id,
        eventType: 'enrolled',
        fromStage: null,
        toStage: null,
        note: null,
        actorId: appUserId,
      });

      // 5. AUDIT pipeline-enroll LAST-IN-TXN.
      await this.appendAudit(tx, {
        actorUserId: appUserId,
        actorRole,
        action: 'pipeline-enroll',
        resourceType: 'pipeline',
        resourceId: pipelineRow.id,
        payload: {
          pipelineId: pipelineRow.id,
          mandateId: input.mandateId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          stage: 'shortlisted',
          actorRole,
        },
      });

      return pipelineRow;
    });
  }

  // ---------------------------------------------------------------------------
  // transitionStageAsActor — move a deal to a new fixed stage
  // ---------------------------------------------------------------------------

  /**
   * transitionStageAsActor — move a pipeline deal to a new fixed stage.
   *
   * Steps (all in ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Validate toStage ∈ the 7 fixed enum (service-level guard).
   *   3. Read current stage (tx-scoped — BUILD rule 7).
   *   4. UPDATE pipeline.stage + updated_by.
   *   5. INSERT pipeline_events row (type='stage_changed', from_stage/to_stage set).
   *   6. AUDIT pipeline-transition LAST-IN-TXN (rollback on audit fail).
   */
  async transitionStageAsActor(
    pipelineId: string,
    toStage: string,
    supertokensUserId: string
  ): Promise<PipelineRow> {
    // 1. Translate ST id → app users.id.
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    // 2. Service-level fixed-enum guard (Zod already guards HTTP input; this
    //    guards direct-call paths and catches any unexpected stage values).
    if (!VALID_STAGES.has(toStage as PipelineRow['stage'])) {
      throw new BadRequestException(
        `Invalid stage '${toStage}'. Must be one of: ${[...VALID_STAGES].join(', ')}`
      );
    }

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 3. Read current stage (tx-scoped — BUILD rule 7).
      const current = await this.repository.findPipelineByIdInTx(tx, pipelineId);
      if (!current) {
        throw new NotFoundException(`Pipeline ${pipelineId} not found`);
      }

      const fromStage = current.stage;

      // 4. UPDATE pipeline.stage + updated_by.
      const updated = await this.repository.updatePipelineStageInTx(
        tx,
        pipelineId,
        toStage,
        appUserId
      );

      // 5. INSERT pipeline_events row (type='stage_changed').
      await this.repository.insertPipelineEvent(tx, {
        pipelineId,
        eventType: 'stage_changed',
        fromStage,
        toStage,
        note: null,
        actorId: appUserId,
      });

      // 6. AUDIT pipeline-transition LAST-IN-TXN.
      await this.appendAudit(tx, {
        actorUserId: appUserId,
        actorRole,
        action: 'pipeline-transition',
        resourceType: 'pipeline',
        resourceId: pipelineId,
        payload: {
          pipelineId,
          fromStage,
          toStage,
          actorRole,
        },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // addNoteAsActor — append a free-text note event
  // ---------------------------------------------------------------------------

  /**
   * addNoteAsActor — append a note to a pipeline deal's event timeline.
   *
   * Steps (all in ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Verify pipeline row exists (tx-scoped — BUILD rule 7).
   *   3. INSERT pipeline_events row (type='note', actor app users.id).
   *   4. AUDIT pipeline-note LAST-IN-TXN — exactly one events row + one audit row.
   *
   * APPEND-ONLY: there is NO edit or delete path for notes. This method is the
   * sole writer for 'note' events.
   */
  async addNoteAsActor(
    pipelineId: string,
    text: string,
    supertokensUserId: string
  ): Promise<PipelineEventRow> {
    // 1. Translate ST id → app users.id.
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Verify pipeline row exists (tx-scoped — BUILD rule 7).
      const pipelineRow = await this.repository.findPipelineByIdInTx(tx, pipelineId);
      if (!pipelineRow) {
        throw new NotFoundException(`Pipeline ${pipelineId} not found`);
      }

      // 3. INSERT pipeline_events row (type='note').
      //    This is the ONLY note insert in this method — exactly one events row.
      const eventRow = await this.repository.insertPipelineEvent(tx, {
        pipelineId,
        eventType: 'note',
        fromStage: null,
        toStage: null,
        note: text,
        actorId: appUserId,
      });

      // 4. AUDIT pipeline-note LAST-IN-TXN — exactly one audit row per note.
      //    Rollback on audit failure: the events row rolls back too (no orphan note).
      await this.appendAudit(tx, {
        actorUserId: appUserId,
        actorRole,
        action: 'pipeline-note',
        resourceType: 'pipeline_event',
        resourceId: eventRow.id,
        payload: {
          pipelineId,
          eventId: eventRow.id,
          noteLength: text.length,
          actorRole,
        },
      });

      return eventRow;
    });
  }

  // ---------------------------------------------------------------------------
  // getBoard — deals grouped by stage
  // ---------------------------------------------------------------------------

  /**
   * getBoard — return all pipeline rows grouped by stage.
   * Optional mandateId filter for mandate-scoped board views.
   *
   * READ PASSTHROUGH (BUILD rule 5): returns DB rows directly (no transformation).
   */
  async getBoard(filter?: { mandateId?: string }): Promise<{
    byStage: Partial<Record<string, PipelineRow[]>>;
  }> {
    const rows = await this.repository.listPipelineForBoard(filter);

    // Group by stage.
    const byStage: Partial<Record<string, PipelineRow[]>> = {};
    for (const row of rows) {
      const stageKey = row.stage as string;
      if (!byStage[stageKey]) {
        byStage[stageKey] = [];
      }
      // biome-ignore lint/style/noNonNullAssertion: stageKey initialized above
      byStage[stageKey]!.push(row);
    }

    return { byStage };
  }

  // ---------------------------------------------------------------------------
  // getEvents — ordered event timeline for a deal
  // ---------------------------------------------------------------------------

  /**
   * getEvents — return the ordered event timeline for a pipeline deal.
   * Throws 404 if the pipeline row does not exist.
   *
   * READ PASSTHROUGH (BUILD rule 5): returns DB rows directly.
   */
  async getEvents(pipelineId: string): Promise<{ events: PipelineEventRow[] }> {
    const pipelineRow = await this.repository.findPipelineById(pipelineId);
    if (!pipelineRow) {
      throw new NotFoundException(`Pipeline ${pipelineId} not found`);
    }
    const events = await this.repository.listEventsByPipelineId(pipelineId);
    return { events };
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
