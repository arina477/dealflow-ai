/**
 * RecordkeepingService — the FINRA/SOX audit-log read + verify + export surface.
 *
 * ── Methods ─────────────────────────────────────────────────────────────────
 *   listAsActor        — filterable/paginated read over audit_log_entries.
 *                        READ-ONLY: emits ZERO audit rows on this path.
 *   verifyChainAsActor — delegates to the EXISTING AuditVerifier.verifyChain().
 *                        Returns the real {ok, entriesChecked, firstBreakAt?, reason?}.
 *                        Does NOT re-implement chain verification (fork = drift risk).
 *   exportAsActor      — assembles a deterministic export package and appends
 *                        EXACTLY ONE 'export_generated' audit row LAST-IN-TXN.
 *
 * ── READ-ONLY INVARIANT (load-bearing) ──────────────────────────────────────
 * listAsActor and verifyChainAsActor MUST NOT call AuditService.append under
 * any code path. The spec asserts this in recordkeeping.spec.ts.
 *
 * ── ROLE-SCOPED FILTERING (advisor own-outreach) ─────────────────────────────
 * compliance/admin: org-wide access (all entries).
 * advisor:          own-outreach only — entries where resource_type='outreach'
 *                   AND the outreach record was created_by = actor.id.
 *                   The RBAC guard at the controller level allows advisor access;
 *                   the scope restriction is enforced HERE in the service.
 *
 * ── MANDATE-SCOPE DERIVATION ────────────────────────────────────────────────
 * audit_log_entries has NO mandate_id column. When mandateId is supplied, the
 * repository applies a per-resource_type derivation (mandate-* → direct;
 * outreach/pipeline/match_run/buyer_universe → joined via their mandate_id FK;
 * match_candidate/buyer_universe_candidate → two-hop join). See repository docs.
 *
 * ── EXPORT ATOMICITY (exactly-one-or-none) ──────────────────────────────────
 * exportAsActor opens ONE transaction. It:
 *   1. Reads the in-scope entries INSIDE the tx (tx-scoped read, BUILD rule 7).
 *   2. Calls AuditVerifier.verifyChain() (OUTSIDE the tx — full chain, stateless).
 *   3. Assembles the manifest.
 *   4. Appends 'export_generated' via AuditService.append LAST-IN-TXN.
 * If the audit append throws, the whole transaction rolls back. No package is
 * delivered without its audit row (exactly-one-or-none invariant).
 *
 * ── DETERMINISTIC EXPORT ────────────────────────────────────────────────────
 * Same scope → deterministic scoped entries (sequence_number ASC, stable order).
 * Manifest fields scope/chainRoot/tailHash/entryCount are deterministic for the
 * same scope; generatedAt and generatingActor vary per call. The full-chain
 * verifyResult.entriesChecked reflects live chain length at export time (it grows
 * as new entries are appended) — this is NOT a determinism bug: verify is full-
 * chain by design and proves the entire unbroken chain, not just the scoped slice.
 * All hashes come from the immutable DB; none are recomputed here.
 *
 * ── ACTOR IDENTITY (wave-5 lesson) ──────────────────────────────────────────
 * actor = AuthRepository.getUserWithRole(supertokensUserId) → app users.id UUID.
 * The raw SuperTokens id is NEVER written to audit entries.
 *
 * ── HARD BOUNDARY ───────────────────────────────────────────────────────────
 * NO Anthropic/LLM import. NO email SDK. NO new external SDK. Additive only.
 */

import { createHash } from 'node:crypto';

import type {
  AuditEntryInput,
  AuditVerifyResponse,
  ExportManifest,
  ExportScope,
} from '@dealflow/shared';
import { GENESIS_PREV_HASH } from '@dealflow/shared';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { StoredAuditEntry } from '../audit/audit.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { AuditVerifier } from '../audit/audit.verifier';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { AuthRepository } from '../auth/auth.repository';
import { serializeToCsv } from './csv.serializer';
import type { DealExportRow, RecordkeepingFilter } from './recordkeeping.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import {
  defaultFromDate,
  EXPORT_ROW_CAP,
  RecordkeepingRepository,
} from './recordkeeping.repository';

// ---------------------------------------------------------------------------
// Export package shape
// ---------------------------------------------------------------------------

/**
 * A single audit entry prepared for export (SEC-6).
 *
 * The global `sequenceNumber` is MASKED (omitted) — it is a cross-tenant
 * side-channel (reveals other firms' activity volume/timing via the global
 * monotonic sequence). Instead, `firmLocalOrdinal` (1..N over the firm's own
 * exported rows) is provided. `prevHash` and `entryHash` are retained for
 * offline linkage verification with zero cross-tenant information leakage.
 */
export interface ExportAuditEntry {
  /** SEC-6: firm-local ordinal (1..N), NOT the global sequence_number. */
  firmLocalOrdinal: number;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  contentHash: string;
  payloadHash: string;
  /** prev_hash — retained for offline chain linkage verification. */
  prevHash: string;
  /** entry_hash — retained for offline chain linkage verification. */
  entryHash: string;
  chainVersion: number;
  createdAt: string;
}

/**
 * A single deal/pipeline row prepared for export (SEC-3).
 * The `firmLocalOrdinal` is assigned sequentially over the firm's deal rows.
 */
export interface ExportDealEntry extends DealExportRow {
  firmLocalOrdinal: number;
}

export interface ExportPackage {
  manifest: ExportManifest;
  /**
   * verifyResult: the full-chain integrity check result.
   * INVARIANT: this is computed via AuditVerifier.verifyChain (RLS-exempt global
   * walk — this is PERMITTED for the boolean/summary; FORBIDDEN for payload rows).
   */
  verifyResult: AuditVerifyResponse;
  /**
   * Audit entries with firm-local ordinals (SEC-6).
   * Global sequence_number is MASKED — not present in this shape.
   */
  entries: ExportAuditEntry[];
  /**
   * Deal/pipeline activity rows (SEC-3). Empty when scope='audit'.
   */
  dealEntries: ExportDealEntry[];
  /**
   * format from the input scope — 'csv' | 'json'.
   * The controller uses this to set the Content-Type and serialize accordingly.
   */
  format: 'csv' | 'json';
  /**
   * CSV content when format='csv' (pre-serialized, injection-safe).
   * Null when format='json'.
   */
  csvContent: string | null;
}

// ---------------------------------------------------------------------------
// RecordkeepingService
// ---------------------------------------------------------------------------

const EXPORT_ALLOWED_ROLES = new Set(['compliance', 'admin']);

@Injectable()
export class RecordkeepingService {
  constructor(
    private readonly repository: RecordkeepingRepository,
    private readonly auditVerifier: AuditVerifier,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // listAsActor — READ-ONLY filterable paginated read
  // ---------------------------------------------------------------------------

  /**
   * Returns a filtered, paginated page of audit log entries.
   *
   * Role-scoped:
   *   compliance/admin → org-wide (no additional scope filter).
   *   advisor          → own-outreach entries only (resource_type='outreach',
   *                       outreach.created_by = actor.id).
   *
   * READ-ONLY: NO audit row is emitted on this path under any circumstances.
   */
  async listAsActor(filter: RecordkeepingFilter, stUserId: string): Promise<StoredAuditEntry[]> {
    const actor = await this.authRepository.getUserWithRole(stUserId);
    if (!actor) {
      throw new UnauthorizedException('User account not found');
    }

    if (actor.roleName === 'advisor') {
      // Advisor scope: own-outreach entries only
      return this.repository.findFiltered({
        ...filter,
        advisorUserId: actor.id,
      });
    }

    // compliance/admin: org-wide
    return this.repository.findFiltered(filter);
  }

  // ---------------------------------------------------------------------------
  // verifyChainAsActor — delegates to the existing AuditVerifier
  // ---------------------------------------------------------------------------

  /**
   * Runs the full chain integrity check via the EXISTING AuditVerifier.verifyChain().
   *
   * This method DOES NOT re-implement chain verification — reusing the single
   * source of tamper-evidence truth. A fork would create a second, drift-prone
   * verifier with different security guarantees.
   *
   * Returns the real AuditVerifyResponse {ok, entriesChecked, firstBreakAt?, reason?}.
   * READ-ONLY: NO audit row is emitted on this path.
   */
  async verifyChainAsActor(stUserId: string): Promise<AuditVerifyResponse> {
    const actor = await this.authRepository.getUserWithRole(stUserId);
    if (!actor) {
      throw new UnauthorizedException('User account not found');
    }
    // RBAC: caller's role is already validated by RolesGuard at the controller;
    // any role that reaches this method is permitted to run verify.
    return this.auditVerifier.verifyChain();
  }

  // ---------------------------------------------------------------------------
  // exportAsActor — extended SEC-1..10 compliant export
  // ---------------------------------------------------------------------------

  /**
   * Assembles a deterministic, self-verifiable recordkeeping export package.
   *
   * Access: compliance/admin ONLY. Advisor 403 (NO export right).
   *
   * SEC-1: Audit rows read via getDb/RLS (FORCE RLS on audit_log_entries).
   *   FORBID read_audit_chain_rls_exempt in payload path — it is used ONLY
   *   for the verifyChain boolean, never to source payload rows.
   *
   * SEC-2: workspace is server-resolved (getWorkspaceId from ALS/session GUC).
   *   The exportScopeSchema is .strict() — workspace_id/firmId/tenant → 400.
   *
   * SEC-3: deal/pipeline scope via getDb/RLS (mandates/pipeline are RLS-covered).
   *
   * SEC-4: bounded export (default 12-month from, max EXPORT_ROW_CAP rows).
   *   On cap-hit → manifest.truncated:true + rowsReturned + rowsAvailable.
   *   NEVER a silently-short "complete" file.
   *
   * SEC-5: CSV injection-safe serialization via csv.serializer.ts.
   *
   * SEC-6: exported audit entries carry firmLocalOrdinal (1..N over firm's own
   *   rows), NOT the global sequence_number (cross-tenant side-channel). The
   *   global sequence_number is MASKED/dropped from the export payload.
   *   prev_hash/entry_hash are retained for offline linkage verification.
   *
   * SEC-7: RBAC compliance+admin enforced here + at the controller layer.
   *
   * SEC-9: export-audit-log — scope/format/count/range only (never the DATA);
   *   actor.id (app users.id, not raw ST id); appended LAST-IN-TXN.
   *
   * SEC-10: deal/pipeline export joins ONLY RLS-covered tenant tables.
   *
   * Exactly-one-or-none:
   *   ONE 'export_generated' audit row appended LAST-IN-TXN. Rollback-on-audit-fail:
   *   no package without its audit row.
   */
  async exportAsActor(scope: ExportScope, stUserId: string): Promise<ExportPackage> {
    const actor = await this.authRepository.getUserWithRole(stUserId);
    if (!actor) {
      throw new UnauthorizedException('User account not found');
    }

    // SEC-7: Advisor 403 — export is restricted to compliance/admin
    if (!EXPORT_ALLOWED_ROLES.has(actor.roleName)) {
      throw new ForbiddenException('Export requires compliance or admin role');
    }

    // SEC-4: apply default from-date (last 12 months) when from is omitted.
    // This prevents unbounded exports that silently omit rows beyond the cap.
    const effectiveFrom = scope.from ?? defaultFromDate();
    const effectiveTo = scope.to;

    // Build the filter for the export scope.
    // exactOptionalPropertyTypes: true — conditionally include fields.
    const exportFilter: Omit<RecordkeepingFilter, 'limit' | 'offset' | 'advisorUserId'> = {
      ...(scope.mandateId !== undefined && { mandateId: scope.mandateId }),
      from: effectiveFrom,
      ...(effectiveTo !== undefined && { to: effectiveTo }),
    };

    const dealFilter = {
      ...(scope.mandateId !== undefined && { mandateId: scope.mandateId }),
      from: effectiveFrom,
      ...(effectiveTo !== undefined && { to: effectiveTo }),
    };

    // SEC-1: Full-chain verify OUTSIDE the tx (read-only, stateless).
    // verifyChain uses read_audit_chain_rls_exempt — this is PERMITTED for the
    // boolean/summary only. It MUST NOT be called inside the payload export path.
    // Done before the tx so verify cost is not held inside the write tx.
    const verifyResult = await this.auditVerifier.verifyChain();

    // Steps: read-scope + assemble manifest + audit row inside ONE transaction
    const pkg = await this.repository.runInTransaction(async (tx) => {
      // -----------------------------------------------------------------------
      // SEC-1: Read audit entries via getDb/RLS (tx handle; FORCE RLS applies).
      // FORBID read_audit_chain_rls_exempt here — RLS is the load-bearing guard.
      // -----------------------------------------------------------------------
      // Default scope='both' and format='csv' when not set (Zod defaults apply
      // at the controller layer; guard here for direct service invocations).
      const resolvedScope = scope.scope ?? 'both';
      const resolvedFormat = scope.format ?? 'csv';
      const includeAudit = resolvedScope === 'audit' || resolvedScope === 'both';
      const includeDeal = resolvedScope === 'deal' || resolvedScope === 'both';

      let auditRows: StoredAuditEntry[] = [];
      let auditTruncated = false;
      let auditRowsAvailable = 0;

      if (includeAudit) {
        const auditResult = await this.repository.findForExportBounded(
          exportFilter,
          tx,
          EXPORT_ROW_CAP
        );
        auditRows = auditResult.rows;
        auditTruncated = auditResult.truncated;
        auditRowsAvailable = auditResult.rowsAvailable;
      }

      // -----------------------------------------------------------------------
      // SEC-3: Deal/pipeline rows via getDb/RLS (tx handle; FORCE RLS on pipeline).
      // SEC-10: joins ONLY RLS-covered tenant tables (pipeline, mandates).
      // -----------------------------------------------------------------------
      let dealRows: DealExportRow[] = [];
      let dealTruncated = false;
      let dealRowsAvailable = 0;

      if (includeDeal) {
        const dealResult = await this.repository.findDealRowsBounded(
          dealFilter,
          tx,
          EXPORT_ROW_CAP
        );
        dealRows = dealResult.rows;
        dealTruncated = dealResult.truncated;
        dealRowsAvailable = dealResult.rowsAvailable;
      }

      // -----------------------------------------------------------------------
      // SEC-6: Assign firm-local ordinals; MASK global sequence_number.
      // prev_hash/entry_hash are retained for offline linkage verification.
      // -----------------------------------------------------------------------
      const exportAuditEntries: ExportAuditEntry[] = auditRows.map((row, idx) => ({
        firmLocalOrdinal: idx + 1,
        // Global sequenceNumber is deliberately OMITTED (cross-tenant side-channel).
        actorUserId: row.actorUserId,
        actorRole: row.actorRole,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        contentHash: row.contentHash,
        payloadHash: row.payloadHash,
        prevHash: row.prevHash,
        entryHash: row.entryHash,
        chainVersion: row.chainVersion,
        createdAt: row.createdAt,
      }));

      const exportDealEntries: ExportDealEntry[] = dealRows.map((row, idx) => ({
        firmLocalOrdinal: idx + 1,
        ...row,
      }));

      // -----------------------------------------------------------------------
      // SEC-4: Explicit truncation manifest fields.
      // total rowsReturned and rowsAvailable across both scopes.
      // -----------------------------------------------------------------------
      const totalRowsReturned = exportAuditEntries.length + exportDealEntries.length;
      const totalRowsAvailable =
        (includeAudit ? auditRowsAvailable : 0) + (includeDeal ? dealRowsAvailable : 0);
      const truncated = auditTruncated || dealTruncated;

      // Tail hash: last audit entry's entryHash (for offline chain linkage).
      const tailHash = exportAuditEntries.at(-1)?.entryHash ?? null;
      const generatedAt = new Date().toISOString();

      // Build the manifest with SEC-4 truncation fields.
      const manifest: ExportManifest = {
        scope,
        generatedAt,
        generatingActor: actor.id,
        chainRoot: GENESIS_PREV_HASH,
        tailHash,
        entryCount: exportAuditEntries.length,
        truncated,
        rowsReturned: totalRowsReturned,
        rowsAvailable: totalRowsAvailable,
      };

      // -----------------------------------------------------------------------
      // SEC-5: CSV serialization (injection-safe). Only when format='csv'.
      // -----------------------------------------------------------------------
      let csvContent: string | null = null;
      if (resolvedFormat === 'csv') {
        csvContent = buildCsvExport(exportAuditEntries, exportDealEntries, manifest);
      }

      // -----------------------------------------------------------------------
      // SEC-9: export-audit-log — log scope/format/count/range ONLY.
      // Never log the exported DATA. actor.id (app users.id, NOT raw ST id).
      // Appended LAST-IN-TXN so rollback-on-audit-fail applies.
      // -----------------------------------------------------------------------
      const contentHash = createHash('sha256').update(JSON.stringify(scope)).digest('hex');
      const payloadHash = createHash('sha256')
        .update(
          JSON.stringify({
            scope: resolvedScope,
            format: resolvedFormat,
            entryCount: exportAuditEntries.length,
            dealCount: exportDealEntries.length,
            from: effectiveFrom,
            to: effectiveTo ?? null,
            truncated,
          })
        )
        .digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: actor.id,
        actorRole: actor.roleName,
        action: 'export_generated',
        resourceType: 'audit-log-export',
        resourceId: scope.mandateId ?? null,
        contentHash,
        payloadHash,
      };

      // LAST-IN-TXN: audit row is the last write. Rollback on audit fail →
      // no package without its audit row (exactly-one-or-none).
      await this.auditService.append(auditInput, tx);

      return {
        manifest,
        verifyResult,
        entries: exportAuditEntries,
        dealEntries: exportDealEntries,
        format: resolvedFormat,
        csvContent,
      };
    });

    return pkg;
  }
}

// ---------------------------------------------------------------------------
// CSV builder (SEC-5) — module-level helper, outside the class
// ---------------------------------------------------------------------------

/**
 * Build the full CSV content for an export package (SEC-5).
 *
 * Audit entries and deal entries are emitted in separate sections with
 * clearly labeled headers. The manifest metadata is prepended as comment rows
 * (# prefix lines are not injection-risk since # is not a formula trigger).
 */
function buildCsvExport(
  auditEntries: ExportAuditEntry[],
  dealEntries: ExportDealEntry[],
  manifest: ExportManifest
): string {
  const sections: string[] = [];

  // ── Manifest metadata section ────────────────────────────────────────────
  sections.push(
    serializeToCsv(
      ['manifestField', 'value'],
      [
        ['generatedAt', manifest.generatedAt],
        ['generatingActor', manifest.generatingActor ?? ''],
        ['chainRoot', manifest.chainRoot],
        ['tailHash', manifest.tailHash ?? ''],
        ['entryCount', manifest.entryCount],
        ['truncated', manifest.truncated],
        ['rowsReturned', manifest.rowsReturned],
        ['rowsAvailable', manifest.rowsAvailable],
        ['scopeFormat', manifest.scope.format],
        ['scopeDataScope', manifest.scope.scope],
        ['scopeFrom', manifest.scope.from ?? ''],
        ['scopeTo', manifest.scope.to ?? ''],
        ['scopeMandateId', manifest.scope.mandateId ?? ''],
      ]
    )
  );

  // ── Audit entries section ────────────────────────────────────────────────
  if (auditEntries.length > 0) {
    sections.push(
      serializeToCsv(
        [
          'firmLocalOrdinal',
          'actorUserId',
          'actorRole',
          'action',
          'resourceType',
          'resourceId',
          'contentHash',
          'payloadHash',
          'prevHash',
          'entryHash',
          'chainVersion',
          'createdAt',
        ],
        auditEntries.map((e) => [
          e.firmLocalOrdinal,
          e.actorUserId,
          e.actorRole,
          e.action,
          e.resourceType,
          e.resourceId,
          e.contentHash,
          e.payloadHash,
          e.prevHash,
          e.entryHash,
          e.chainVersion,
          e.createdAt,
        ])
      )
    );
  }

  // ── Deal/pipeline entries section ────────────────────────────────────────
  if (dealEntries.length > 0) {
    sections.push(
      serializeToCsv(
        [
          'firmLocalOrdinal',
          'pipelineId',
          'mandateId',
          'dealSourceType',
          'outreachId',
          'matchCandidateId',
          'stage',
          'createdBy',
          'createdAt',
          'updatedAt',
          'mandateSellerName',
        ],
        dealEntries.map((e) => [
          e.firmLocalOrdinal,
          e.pipelineId,
          e.mandateId,
          e.dealSourceType,
          e.outreachId,
          e.matchCandidateId,
          e.stage,
          e.createdBy,
          e.createdAt,
          e.updatedAt,
          e.mandateSellerName,
        ])
      )
    );
  }

  return sections.join('\r\n\r\n');
}
