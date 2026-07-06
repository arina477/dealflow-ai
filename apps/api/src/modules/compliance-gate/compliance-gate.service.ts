/**
 * ComplianceGateService (wave-5, task 0595a835) — the SOLE send-eligibility
 * authority (security.md §Outreach-compliance-controls + §Reusability-principle:
 * "One compliance-gate service is the only send-eligibility authority").
 *
 * ── NON-BYPASSABILITY (load-bearing) ───────────────────────────────────────
 * 1. NO skip param. evaluate() takes only (ctx, tx). There is no dryRun, no
 *    skipChecks, no per-check flag. Every call runs ALL FOUR evaluators
 *    unconditionally, in fixed order. There is no code path that runs a subset.
 * 2. Evaluators have no independent entry point — they are only ever invoked
 *    here, together. Composing them behind one method (vs exposing each as a
 *    callable service) makes non-bypassability STRUCTURAL, not conventional.
 * 3. MANDATORY audit-in-tx: the verdict is written via AuditService.append(_, tx)
 *    — the SAME tx the evaluators read in — BEFORE evaluate() returns. If the
 *    audit append throws, the whole tx rolls back and evaluate() throws: NO
 *    VERDICT WITHOUT ITS AUDIT ENTRY. This reuses the wave-4 atomicity contract
 *    (append composes into the caller's tx; audited action + audit row commit or
 *    roll back together) and mirrors the wave-4 self-check-rollback discipline.
 *
 * ── DEFAULT POSTURE — allow-with-no-rules (documented + tested) ────────────
 * With zero suppression/approval/disclaimer rows, every evaluator still RUNS and
 * the verdict is still AUDITED, but no hard block fires → allowed:true. The
 * non-negotiable invariant is COVERAGE (every decision audited), not blanket
 * deny. For a REAL send the effective posture is nonetheless "deny until
 * approved": the SoD evaluator blocks any resource without a valid compliance
 * approval, so a genuine outreach is not allowed until approved. See P-3 Δ2.4.
 *
 * ── THIS WAVE vs M6 (honest boundary) ──────────────────────────────────────
 * This wave delivers the gate as an ENFORCED CALLABLE CONTRACT. It does NOT claim
 * a live send path exists. The M6 outreach send endpoint MUST call evaluate()
 * before any send and block on allowed:false — tracked as an M6 dependency so
 * "non-bypassable" is not silently downgraded to "callable but uncalled".
 */

import { createHash } from 'node:crypto';
import type { AuditEntryInput, BlockReason, GateContext, GateVerdict } from '@dealflow/shared';
import { gateContextSchema } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';
import type { Tx } from '../audit/audit.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { ComplianceGateRepository } from './compliance-gate.repository';
import { computeContentHash } from './content-hash';
import { contentHashEvaluator } from './evaluators/content-hash.evaluator';
import { disclaimerEvaluator } from './evaluators/disclaimer.evaluator';
import type { Evaluator } from './evaluators/evaluator.types';
import { sodEvaluator } from './evaluators/sod.evaluator';
import { suppressionEvaluator } from './evaluators/suppression.evaluator';

@Injectable()
export class ComplianceGateService {
  /**
   * The fixed evaluator set. ALL of these run on EVERY evaluate() call, in this
   * order. There is no mechanism to skip, reorder-away, or subset this list — it
   * is a private constant, not a caller input. This is the non-bypassability
   * choke point.
   */
  private readonly evaluators: readonly Evaluator[] = [
    suppressionEvaluator,
    sodEvaluator,
    disclaimerEvaluator,
    contentHashEvaluator,
  ];

  constructor(
    private readonly audit: AuditService,
    private readonly repo: ComplianceGateRepository
  ) {}

  /**
   * Evaluate send-eligibility WITHIN the caller's transaction. Runs all four
   * evaluators, composes the verdict, and writes the verdict to the audit log in
   * `tx` BEFORE returning. If the audit append throws, `tx` rolls back and this
   * method throws — no verdict is returned without its audit entry.
   *
   * The caller (M6 send path, later) MUST perform its send write in the SAME `tx`
   * so send and verdict commit atomically.
   */
  async evaluate(ctx: GateContext, tx: Tx): Promise<GateVerdict> {
    // FAIL-CLOSED INPUT VALIDATION (non-bypassability). Parse+normalize the ctx
    // against the canonical schema BEFORE any evaluator runs. This is the FIRST
    // statement: a malformed/un-normalized ctx (whitespace recipient, empty
    // content, non-email address, wrong-length contentHash) must NEVER reach the
    // evaluators where it could silently bypass suppression/disclaimer/hash logic.
    // On invalid input .parse() THROWS — the caller's tx rolls back and no verdict
    // is produced (the gate refuses to decide over untrusted input). All downstream
    // reads use the parsed value, not the raw ctx.
    const parsed = gateContextSchema.parse(ctx);

    const blocks: BlockReason[] = [];
    const requiredDisclaimers: string[] = [];

    // Run ALL evaluators unconditionally, in fixed order. No skip, no subset.
    for (const evaluator of this.evaluators) {
      const result = await evaluator(parsed, this.repo, tx);
      blocks.push(...result.blocks);
      for (const id of result.requiredDisclaimers) {
        if (!requiredDisclaimers.includes(id)) {
          requiredDisclaimers.push(id);
        }
      }
    }

    const verdict: GateVerdict = {
      allowed: blocks.length === 0,
      blocks,
      requiredDisclaimers,
    };

    // MANDATORY: audit the verdict in the SAME tx BEFORE returning. If this
    // throws, the whole tx rolls back and evaluate() throws — no verdict without
    // its audit entry. Placed AFTER verdict computation, BEFORE the return.
    // Uses the parsed/normalized ctx so the audited hash + identity match what the
    // evaluators actually decided over.
    //
    // Wave-14 (task 487b0f0c): use appendWithMandate to record ctx.mandateId in
    // the hash-excluded mandate_id column. The HMAC preimage is UNCHANGED —
    // mandateId is NEVER fed into computeEntryHash. This makes the gate-evaluate
    // row mandate-attributable without touching hash-chain integrity.
    await this.audit.appendWithMandate(
      this.verdictAuditEntry(parsed, verdict),
      tx,
      parsed.mandateId
    );

    return verdict;
  }

  /**
   * Standalone entry for callers WITHOUT a surrounding tx (and for standalone
   * tests). Opens its own tx and delegates to evaluate(), which performs the
   * fail-closed gateContextSchema.parse(ctx) — so an invalid ctx throws here too
   * and rolls back the standalone tx. The M6 send path should prefer
   * evaluate(ctx, tx) to compose atomically with its send write.
   */
  evaluateStandalone(ctx: GateContext): Promise<GateVerdict> {
    return this.repo.runInTransaction((tx) => this.evaluate(ctx, tx));
  }

  /**
   * Build the audit entry for a gate verdict. action='gate-evaluate'. The
   * content_hash is the keyless content binding hash (recomputed from ctx.content
   * — the same hash the content-hash evaluator binds against). The payload_hash
   * summarizes the DECISION (allowed + the block codes) so the audit row records
   * WHAT was decided, tamper-evidently, alongside the content it was decided over.
   */
  private verdictAuditEntry(ctx: GateContext, verdict: GateVerdict): AuditEntryInput {
    return {
      actorUserId: ctx.senderUserId,
      actorRole: ctx.senderRole,
      action: 'gate-evaluate',
      resourceType: ctx.resourceType,
      resourceId: ctx.resourceId,
      contentHash: computeContentHash(ctx.content),
      payloadHash: hashDecision(verdict),
    };
  }
}

/**
 * Deterministic keyless hash of the DECISION payload (allowed + sorted block
 * codes). Keyless SHA-256 like the content hash — this is a summary digest for
 * the audit row's payload_hash column, not a tamper-evidence key (the audit
 * chain's own HMAC provides that over the whole entry).
 */
function hashDecision(verdict: GateVerdict): string {
  const codes = verdict.blocks
    .map((b) => b.code)
    .sort()
    .join(',');
  const payload = `allowed=${verdict.allowed}|blocks=${codes}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}
