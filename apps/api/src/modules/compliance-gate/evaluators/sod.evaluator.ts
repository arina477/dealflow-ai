/**
 * sodEvaluator (wave-5, task 95adac6c + P-4 remediation finding-1) — the
 * load-bearing Separation-of-Duties check. This is the compliance-critical
 * invariant of the whole wedge (bet #2).
 *
 * A send is BLOCKED unless a compliance_approvals row exists for
 * (resourceType, resourceId) that satisfies ALL of:
 *   1. status === 'approved'                    (a revoked approval is invalid),
 *   2. approver_user_id !== ctx.senderUserId    (sender ≠ approver — self-approval
 *      is the classic SoD bypass and is blocked),
 *   3. approver_role === 'compliance' EXACTLY   (admin is NOT a valid SoD approver
 *      per security.md §RBAC-SoD line 64: "no super-role shortcut around
 *      separation of duties". admin MANAGES compliance config but may NOT approve
 *      outreach — a distinct authority).
 *
 * SERVER-SIDE APPROVER IDENTITY (non-negotiable): the approver_user_id and
 * approver_role come ONLY from the STORED approval row, read server-side in the
 * gate tx. They are NEVER taken from ctx or any client field. ctx carries only
 * the SENDER identity (server-verified upstream from the session, see
 * RolesGuard's DB-authoritative role); the approver is looked up, never asserted
 * by the caller. Trusting a client-supplied `approvedBy` is the exact bypass this
 * evaluator exists to prevent.
 *
 * No approval row → 'no-approval' BlockReason (the send is unapproved).
 * A row that fails any of (1)-(3) → 'sod' BlockReason with a machine-stable
 * sub-reason. Both make the send ineligible.
 *
 * FAIL CLOSED on a NULL approver_user_id (approver account deleted, FK SET-NULL):
 * such a row can no longer prove sender ≠ approver, so it is BLOCKED with sod
 * sub-reason 'approver-unknown' — it never satisfies SoD, even if the stored
 * approver_role snapshot is 'compliance'.
 */

import type { BlockReason, GateContext } from '@dealflow/shared';

import type { Tx } from '../../audit/audit.repository';
import type { ComplianceGateRepository } from '../compliance-gate.repository';
import type { EvaluatorResult } from './evaluator.types';

/** The ONLY role accepted as a valid SoD approver. admin is deliberately excluded. */
const SOD_APPROVER_ROLE = 'compliance' as const;

export async function sodEvaluator(
  ctx: GateContext,
  repo: ComplianceGateRepository,
  tx: Tx
): Promise<EvaluatorResult> {
  const approval = await repo.loadApproval(tx, ctx.resourceType, ctx.resourceId);

  // No approval row at all → unapproved send.
  if (approval === null) {
    return { blocks: [noApprovalBlock()], requiredDisclaimers: [] };
  }

  // A revoked approval is not a valid approval.
  if (approval.status !== 'approved') {
    return {
      blocks: [sodBlock('approval-revoked', 'The approval for this resource has been revoked.')],
      requiredDisclaimers: [],
    };
  }

  // FAIL CLOSED on an unknown approver. approverUserId is NULL when the approver
  // account was deleted (FK onDelete: SET NULL). A null approver can no longer
  // PROVE sender ≠ approver — the ORIGINAL approver may well be the sender now
  // sending their OWN approved content, which is the exact self-approval SoD
  // bypass this evaluator exists to prevent. We therefore CANNOT trust a null
  // approver to satisfy SoD regardless of the stored approver_role snapshot, and
  // BLOCK it explicitly instead of letting the old `!== null` guard short-circuit
  // past the self-approval check.
  if (approval.approverUserId === null) {
    return {
      blocks: [
        sodBlock(
          'approver-unknown',
          'The approver account for this approval no longer exists, so separation of ' +
            'duties cannot be verified (the original approver may be the sender). Blocked.'
        ),
      ],
      requiredDisclaimers: [],
    };
  }

  // Self-approval — sender is the approver. Classic SoD violation.
  if (approval.approverUserId === ctx.senderUserId) {
    return {
      blocks: [
        sodBlock('sender-is-approver', 'The sender cannot be the approver (separation of duties).'),
      ],
      requiredDisclaimers: [],
    };
  }

  // Approver role must be EXACTLY 'compliance' — admin/advisor/analyst are invalid.
  if (approval.approverRole !== SOD_APPROVER_ROLE) {
    return {
      blocks: [
        sodBlock(
          'invalid-approver-role',
          `Approver role "${approval.approverRole}" is not a valid compliance approver ` +
            '(only the compliance role may approve outreach; admin is excluded).'
        ),
      ],
      requiredDisclaimers: [],
    };
  }

  // Valid SoD approval: approved, sender ≠ approver, approver role = compliance.
  return { blocks: [], requiredDisclaimers: [] };
}

function noApprovalBlock(): BlockReason {
  return {
    code: 'no-approval',
    message: 'No compliance approval exists for this outreach — it cannot be sent.',
  };
}

function sodBlock(
  reason: 'sender-is-approver' | 'invalid-approver-role' | 'approval-revoked' | 'approver-unknown',
  message: string
): BlockReason {
  return { code: 'sod', reason, message };
}
