/**
 * Shared evaluator contract (wave-5). Every gate evaluator is a pure async
 * function of (ctx, repo, tx) that returns a fragment of the verdict: the blocks
 * it found plus any required-disclaimer ids it wants enforced. The gate service
 * composes all four fragments into the single GateVerdict.
 *
 * Evaluators have NO independent entry point wired anywhere — they are only ever
 * invoked, all four, by ComplianceGateService.evaluate(). Composing them behind
 * one method (rather than exposing them as independently-callable services) is
 * what makes non-bypassability structural: there is no way to run only one check.
 */

import type { BlockReason, GateContext } from '@dealflow/shared';

import type { Tx } from '../../audit/audit.repository';
import type { ComplianceGateRepository } from '../compliance-gate.repository';

/** The partial verdict contribution of a single evaluator. */
export interface EvaluatorResult {
  /** Hard blocks this evaluator found (empty = nothing to block on). */
  blocks: BlockReason[];
  /** Disclaimer template ids this evaluator requires satisfied (usually empty). */
  requiredDisclaimers: string[];
}

/** Every evaluator conforms to this signature. */
export type Evaluator = (
  ctx: GateContext,
  repo: ComplianceGateRepository,
  tx: Tx
) => Promise<EvaluatorResult>;
