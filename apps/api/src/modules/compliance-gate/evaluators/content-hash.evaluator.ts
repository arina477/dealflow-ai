/**
 * contentHashEvaluator (wave-5, task 034463b1) — approval-version content
 * binding. RECOMPUTES the hash of ctx.content server-side and blocks
 * (content-hash-mismatch BlockReason) unless it matches the content_hash stored
 * on the approval. A post-approval edit changes the content → changes the hash →
 * re-block. An approval cannot be reused for modified/different content.
 *
 * The recompute uses the SAME keyless canonical SHA-256 (computeContentHash) the
 * approval-creation path must use, so identical logical content hashes identically
 * (see content-hash.ts for why this is keyless and NOT the audit HMAC).
 *
 * NOTE the gate does NOT trust ctx.contentHash for this check — that caller-
 * supplied value is only a lookup convenience. The binding is verified by
 * recomputing from ctx.content and comparing to the STORED approval hash.
 *
 * If there is NO approval row, this evaluator emits nothing: the SoD evaluator
 * already blocks the unapproved send (no-approval). This evaluator's job is
 * specifically the CONTENT-DRIFT case — an approval exists but the content it was
 * bound to has changed. (A revoked approval likewise: SoD blocks it; we still
 * check the hash only against an approved row so we don't emit a redundant/
 * misleading mismatch against a revoked binding.)
 */

import type { BlockReason, GateContext } from '@dealflow/shared';

import type { Tx } from '../../audit/audit.repository';
import type { ComplianceGateRepository } from '../compliance-gate.repository';
import { computeContentHash } from '../content-hash';
import type { EvaluatorResult } from './evaluator.types';

export async function contentHashEvaluator(
  ctx: GateContext,
  repo: ComplianceGateRepository,
  tx: Tx
): Promise<EvaluatorResult> {
  const approval = await repo.loadApproval(tx, ctx.resourceType, ctx.resourceId);

  // No approval (or a non-approved one) → SoD owns that block; nothing to bind to.
  if (approval === null || approval.status !== 'approved') {
    return { blocks: [], requiredDisclaimers: [] };
  }

  const currentHash = computeContentHash(ctx.content);

  if (currentHash === approval.contentHash) {
    return { blocks: [], requiredDisclaimers: [] };
  }

  const block: BlockReason = {
    code: 'content-hash-mismatch',
    approvedHash: approval.contentHash,
    currentHash,
    message:
      'The content has changed since it was approved — the approval no longer ' +
      'binds this content. Re-approval is required.',
  };

  return { blocks: [block], requiredDisclaimers: [] };
}
