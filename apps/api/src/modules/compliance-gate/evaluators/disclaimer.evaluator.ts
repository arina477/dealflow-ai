/**
 * disclaimerEvaluator (wave-5, task 034463b1) — enforce jurisdiction-required
 * disclaimers. NOT advisory: if the recipient jurisdiction has an active
 * disclaimer template and the content does not include its body, the gate blocks
 * (missing-disclaimer BlockReason) AND lists the template id in
 * requiredDisclaimers[] — `allowed` stays false until satisfied.
 *
 * Resolution: the ACTIVE disclaimer template for ctx.jurisdiction (highest
 * version among active rows). "Satisfied" = the canonicalized content contains
 * the canonicalized disclaimer body as a substring (a required legal disclaimer
 * must be present verbatim in the message). Version drift is handled implicitly:
 * the gate resolves the CURRENT active template every evaluate(), so a template
 * version bump re-blocks content that only carried the prior version's body —
 * the block-3 stale-version edge case.
 *
 * No active template for the jurisdiction → nothing to enforce (allow — the
 * default posture of allow-with-no-rules applies per-check).
 */

import type { BlockReason, GateContext } from '@dealflow/shared';

import type { Tx } from '../../audit/audit.repository';
import type { ComplianceGateRepository } from '../compliance-gate.repository';
import { canonicalizeContent } from '../content-hash';
import type { EvaluatorResult } from './evaluator.types';

export async function disclaimerEvaluator(
  ctx: GateContext,
  repo: ComplianceGateRepository,
  tx: Tx
): Promise<EvaluatorResult> {
  const template = await repo.loadActiveDisclaimer(tx, ctx.jurisdiction);

  // No active disclaimer template for this jurisdiction → nothing required.
  if (template === null) {
    return { blocks: [], requiredDisclaimers: [] };
  }

  const content = canonicalizeContent(ctx.content);
  const requiredBody = canonicalizeContent(template.body);

  // Satisfied when the required disclaimer body appears in the content.
  if (content.includes(requiredBody)) {
    return { blocks: [], requiredDisclaimers: [] };
  }

  const block: BlockReason = {
    code: 'missing-disclaimer',
    jurisdiction: ctx.jurisdiction,
    disclaimerTemplateId: template.id,
    message:
      `Outreach to jurisdiction "${ctx.jurisdiction}" is missing the required ` +
      `disclaimer (template v${template.version}).`,
  };

  return { blocks: [block], requiredDisclaimers: [template.id] };
}
