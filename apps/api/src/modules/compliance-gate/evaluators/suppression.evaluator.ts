/**
 * suppressionEvaluator (wave-5, task 95adac6c) — HARD-block any recipient that
 * matches the suppression list.
 *
 * Match logic (server-side, against the suppression_list read in the gate tx):
 *   - match_type='email'  → exact, case-insensitive email equality.
 *   - match_type='domain' → the recipient's domain equals the suppressed domain
 *     OR is a sub-domain of it (domain-suffix match). e.g. a `domain` entry of
 *     `blocked.com` suppresses `foo@blocked.com` AND `foo@sub.blocked.com`, but
 *     NOT `foo@notblocked.com` and NOT `foo@xblocked.com` (the boundary is a dot,
 *     so `xblocked.com` is not a suffix-with-dot of `blocked.com`).
 *
 * Every matching recipient yields its own `suppression` BlockReason (so the
 * verdict enumerates exactly which addresses were suppressed and why). This is a
 * HARD block, not advisory — any suppression hit makes the send ineligible.
 */

import type { BlockReason, GateContext } from '@dealflow/shared';

import type { Tx } from '../../audit/audit.repository';
import type { ComplianceGateRepository } from '../compliance-gate.repository';
import type { EvaluatorResult } from './evaluator.types';

/** Extract the lower-cased domain part of an email ('a@B.com' → 'b.com'). */
function domainOf(email: string): string {
  const at = email.lastIndexOf('@');
  return at === -1 ? '' : email.slice(at + 1).toLowerCase();
}

/**
 * True when `domain` equals `suffix` or is a dot-boundary sub-domain of it.
 * 'sub.blocked.com' matches suffix 'blocked.com'; 'xblocked.com' does NOT.
 */
function domainMatchesSuffix(domain: string, suffix: string): boolean {
  return domain === suffix || domain.endsWith(`.${suffix}`);
}

export async function suppressionEvaluator(
  ctx: GateContext,
  repo: ComplianceGateRepository,
  tx: Tx
): Promise<EvaluatorResult> {
  const entries = await repo.loadSuppressionEntries(tx);

  const emailBlocklist = new Set(
    entries.filter((e) => e.matchType === 'email').map((e) => e.value.toLowerCase())
  );
  const domainSuffixes = entries
    .filter((e) => e.matchType === 'domain')
    .map((e) => e.value.toLowerCase());

  const blocks: BlockReason[] = [];

  for (const recipient of ctx.recipients) {
    const normalized = recipient.toLowerCase();

    if (emailBlocklist.has(normalized)) {
      blocks.push(makeBlock(recipient, 'email', normalized));
      continue;
    }

    const recipientDomain = domainOf(normalized);
    const matchedDomain = domainSuffixes.find((suffix) =>
      domainMatchesSuffix(recipientDomain, suffix)
    );
    if (matchedDomain !== undefined) {
      blocks.push(makeBlock(recipient, 'domain', matchedDomain));
    }
  }

  return { blocks, requiredDisclaimers: [] };
}

function makeBlock(
  recipient: string,
  matchType: 'email' | 'domain',
  matchedValue: string
): BlockReason {
  return {
    code: 'suppression',
    recipient,
    matchType,
    matchedValue,
    message:
      matchType === 'email'
        ? `Recipient ${recipient} is on the suppression list (exact email).`
        : `Recipient ${recipient} matches suppressed domain "${matchedValue}".`,
  };
}
