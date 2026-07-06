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
 * Same scope → byte-identical package EXCEPT manifest generatedAt/generatingActor.
 * Entries are read in sequence_number ASC (stable order). All hashes come from
 * the immutable DB; none are recomputed here.
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
import type { RecordkeepingFilter } from './recordkeeping.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { RecordkeepingRepository } from './recordkeeping.repository';

// ---------------------------------------------------------------------------
// Export package shape
// ---------------------------------------------------------------------------

export interface ExportPackage {
  manifest: ExportManifest;
  verifyResult: AuditVerifyResponse;
  entries: StoredAuditEntry[];
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
  // exportAsActor — deterministic package + exactly-one audit row last-in-txn
  // ---------------------------------------------------------------------------

  /**
   * Assembles a deterministic, self-verifiable recordkeeping export package.
   *
   * Access: compliance/admin ONLY. Advisor 403 (NO export right).
   *
   * The package contains:
   *   (a) In-scope audit entries with sequence_number/prev_hash/entry_hash.
   *   (b) Full-chain AuditVerifier.verifyChain() result (proves the slice sits
   *       in an unbroken chain; verify is full-chain, NOT slice-only).
   *   (c) A manifest: scope, generatedAt, generatingActor, chainRoot, tailHash,
   *       entryCount.
   *
   * Exactly-one-or-none:
   *   ONE 'export_generated' audit row is appended LAST-IN-TXN. If the audit
   *   append throws, the tx rolls back → no package is delivered without its
   *   audit row. No package is returned from this method in the rollback case
   *   (the exception propagates to the controller → 500).
   *
   * Determinism:
   *   Entries are read in sequence_number ASC (stable order from the immutable
   *   chain). Hashes are read from the DB (never recomputed here). manifest
   *   generatedAt and generatingActor vary per call; all other fields are
   *   deterministic for the same scope.
   */
  async exportAsActor(scope: ExportScope, stUserId: string): Promise<ExportPackage> {
    const actor = await this.authRepository.getUserWithRole(stUserId);
    if (!actor) {
      throw new UnauthorizedException('User account not found');
    }

    // Advisor 403: export is restricted to compliance/admin
    if (!EXPORT_ALLOWED_ROLES.has(actor.roleName)) {
      throw new ForbiddenException('Export requires compliance or admin role');
    }

    // Build the filter for the export scope.
    // exactOptionalPropertyTypes: true — conditionally include fields.
    const exportFilter: Parameters<RecordkeepingRepository['findForExport']>[0] = {
      ...(scope.mandateId !== undefined && { mandateId: scope.mandateId }),
      ...(scope.from !== undefined && { from: scope.from }),
      ...(scope.to !== undefined && { to: scope.to }),
    };

    // Step (b): Full-chain verify OUTSIDE the tx (read-only, stateless).
    // Done before the tx so verify cost is not held inside the write tx.
    const verifyResult = await this.auditVerifier.verifyChain();

    // Steps (a) + (c) + audit row inside ONE transaction
    const pkg = await this.repository.runInTransaction(async (tx) => {
      // (a) Read in-scope entries inside the tx (BUILD rule 7: tx-scoped read)
      const entries = await this.repository.findForExport(exportFilter, tx);

      const entryCount = entries.length;
      // entries.at(-1) returns undefined for empty arrays; ?? null handles the
      // exactOptionalPropertyTypes constraint (tailHash: string | null in manifest).
      const tailHash = entries.at(-1)?.entryHash ?? null;
      const generatedAt = new Date().toISOString();

      // (c) Assemble manifest
      const manifest: ExportManifest = {
        scope,
        generatedAt,
        generatingActor: actor.id,
        chainRoot: GENESIS_PREV_HASH,
        tailHash,
        entryCount,
      };

      // Compute content/payload hashes for the audit entry (wave-5 pattern)
      const contentHash = createHash('sha256').update(JSON.stringify(scope)).digest('hex');
      const payloadHash = createHash('sha256')
        .update(JSON.stringify({ entryCount, tailHash, chainRoot: GENESIS_PREV_HASH }))
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

      return { manifest, verifyResult, entries };
    });

    return pkg;
  }
}
