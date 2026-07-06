/**
 * ComplianceGateRepository (wave-5, task 0595a835) — read-only data access for
 * the compliance gate's evaluators.
 *
 * The gate reads the 4 config tables INSIDE the caller's transaction (the same
 * tx the verdict is audited into), so a config read and the verdict audit are
 * one atomic unit. Every read method therefore takes the `tx` handle.
 *
 * Pure data access: ZERO policy logic. The evaluators own the block decisions;
 * this repository only fetches rows. This mirrors the audit module's
 * repository/service split (AuditRepository has zero chain logic).
 */

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { getDb } from '../../db/workspace-context';
import {
  complianceApprovals,
  disclaimerTemplates,
  suppressionList,
} from '../../db/schema/compliance-rules';
import type { Tx } from '../audit/audit.repository';

/** A suppression_list row as read by the suppression evaluator. */
export interface SuppressionRow {
  matchType: 'email' | 'domain';
  value: string;
}

/** The active disclaimer template for a jurisdiction (highest version, active). */
export interface ActiveDisclaimerRow {
  id: string;
  jurisdiction: string;
  body: string;
  version: number;
}

/** A compliance_approvals row as read by the SoD + content-hash evaluators. */
export interface ApprovalRow {
  contentHash: string;
  approverUserId: string | null;
  approverRole: string;
  status: 'approved' | 'revoked';
}

@Injectable()
export class ComplianceGateRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * All suppression entries. Suppression matching (exact-email OR domain-suffix)
   * needs the domain rows scanned against every recipient's domain; loading the
   * (small, config-scale) list once per evaluate() and matching in-process is
   * simpler and correct vs a per-recipient round-trip. Read in the gate tx.
   */
  async loadSuppressionEntries(tx: Tx): Promise<SuppressionRow[]> {
    return tx
      .select({ matchType: suppressionList.matchType, value: suppressionList.value })
      .from(suppressionList);
  }

  /**
   * The single ACTIVE disclaimer template for a jurisdiction (highest version
   * among active rows). Returns null if the jurisdiction has no active template.
   * Read in the gate tx.
   */
  async loadActiveDisclaimer(tx: Tx, jurisdiction: string): Promise<ActiveDisclaimerRow | null> {
    const rows = await tx
      .select({
        id: disclaimerTemplates.id,
        jurisdiction: disclaimerTemplates.jurisdiction,
        body: disclaimerTemplates.body,
        version: disclaimerTemplates.version,
      })
      .from(disclaimerTemplates)
      .where(
        and(
          eq(disclaimerTemplates.jurisdiction, jurisdiction),
          eq(disclaimerTemplates.active, true)
        )
      )
      .orderBy(sql`${disclaimerTemplates.version} DESC`)
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * The compliance_approvals row for (resourceType, resourceId). Returns the
   * most recent row (there may be historical revoked rows). The SoD evaluator
   * validates status/approver/role from the STORED row — never from the client.
   * Read in the gate tx.
   */
  async loadApproval(
    tx: Tx,
    resourceType: string,
    resourceId: string
  ): Promise<ApprovalRow | null> {
    const rows = await tx
      .select({
        contentHash: complianceApprovals.contentHash,
        approverUserId: complianceApprovals.approverUserId,
        approverRole: complianceApprovals.approverRole,
        status: complianceApprovals.status,
      })
      .from(complianceApprovals)
      .where(
        and(
          eq(complianceApprovals.resourceType, resourceType),
          eq(complianceApprovals.resourceId, resourceId)
        )
      )
      .orderBy(sql`${complianceApprovals.createdAt} DESC`)
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Open a fresh transaction. Used by ComplianceGateService.evaluateStandalone
   * for callers with no surrounding business tx (and standalone tests). Mirrors
   * AuditRepository.runInTransaction.
   */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return getDb(this.db).transaction(work);
  }
}
