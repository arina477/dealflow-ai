/**
 * SourcingService — orchestration service for the sourcing module.
 *
 * Responsibilities:
 *   1. Connection validation + sync orchestration (delegates ETL to IngestionService).
 *   2. Companies + contacts read (delegates queries to SourcingRepository).
 *   3. Dedupe-candidate resolution — the AUDITED human-decision endpoint.
 *      a. merge  → apply merge (raw into canonical) + write provenance + set
 *                  candidate status=merged — ALL in one transaction.
 *      b. reject → set status=rejected (keep-separate; raw may become its own
 *                  canonical or stay unresolved per the documented edge policy).
 *      In both cases: AuditService.append(action=sourcing-dedupe-resolve) is
 *      called IN THE SAME TRANSACTION as the mutation. A human decision
 *      that alters the canonical universe is a recordkeeping event (P-3 Δ6);
 *      audit failure rolls back the mutation.
 *
 * Actor identity:
 *   For any users.id FK (audit actorUserId, dedupe resolvedBy), the actor is
 *   always translated from SuperTokens id → app users.id via
 *   AuthRepository.getUserWithRole (the wave-5 actor-id-FK lesson). The raw
 *   SuperTokens id MUST NEVER be passed into a users.id FK column.
 *
 * AUDIT:
 *   ETL upserts (staging writes) are NOT audited — machine ingest.
 *   Auto-merges by the dedupe engine are NOT audited — deterministic promotion.
 *   Dedupe-resolve (human merge/reject) IS audited in-tx via AuditService.append.
 */

import { createHash } from 'node:crypto';
import type {
  AuditEntryInput,
  CompaniesListFilter,
  ConnectionCreateInput,
  DedupeResolveInput,
  SyncSummary,
} from '@dealflow/shared';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { AuthRepository } from '../auth/auth.repository';
import type { AdapterRegistry } from './adapters/adapter.registry';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { ADAPTER_REGISTRY } from './adapters/adapter.registry';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { IngestionService } from './ingestion.service';
import type { Tx } from './sourcing.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value
import { SourcingRepository } from './sourcing.repository';

@Injectable()
export class SourcingService {
  constructor(
    private readonly repository: SourcingRepository,
    private readonly ingestionService: IngestionService,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository,
    @Inject(ADAPTER_REGISTRY) private readonly adapterRegistry: AdapterRegistry
  ) {}

  // ---------------------------------------------------------------------------
  // Connection create + list (wave-7 AC-SEED)
  // ---------------------------------------------------------------------------

  /**
   * createConnectionAsActor — creates a data_source_connections row AUDITED in-tx.
   *
   * Translates the SuperTokens id to app users.id via getUserWithRole (the wave-5
   * actor-id-FK lesson). The raw SuperTokens id MUST NOT touch the created_by FK.
   *
   * AUDIT in-tx: sourcing-connection-create.
   *   actor = app users.id; rollback on audit fail (same tx as INSERT).
   *
   * @param input              — validated ConnectionCreateInput (body)
   * @param supertokensUserId  — raw SuperTokens user id from the session
   */
  async createConnectionAsActor(
    input: ConnectionCreateInput,
    supertokensUserId: string
  ): Promise<{
    id: string;
    providerKey: string;
    displayName: string;
    enabled: boolean;
    config: Record<string, unknown>;
    createdBy: string | null;
    createdAt: string;
  }> {
    // Translate SuperTokens id → app users.id.
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    // CRITICAL-2 fix (a): validate providerKey against the adapter registry BEFORE
    // the INSERT. An unknown providerKey creates a row that can never sync (the
    // first sync call hits IngestionService → 'No adapter registered' → 500). Reject
    // it here with 400 BadRequestException so the CREATE looks successful IFF the
    // connection will be syncable.
    const adapter = this.adapterRegistry.getAdapter(input.providerKey);
    if (!adapter) {
      throw new BadRequestException(
        `Unknown provider_key "${input.providerKey}". Registered providers: ${this.adapterRegistry.registeredKeys().join(', ') || 'none'}`
      );
    }

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Insert the connection row.
      const conn = await this.repository.createConnection(tx, {
        providerKey: input.providerKey,
        displayName: input.displayName,
        config: input.config,
        createdBy: appUserId,
      });

      // AUDIT in-tx: sourcing-connection-create.
      const eventPayload = {
        connectionId: conn.id,
        providerKey: conn.providerKey,
        displayName: conn.displayName,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');
      const contentHash = payloadHash;

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'sourcing-connection-create',
        resourceType: 'data_source_connection',
        resourceId: conn.id,
        contentHash,
        payloadHash,
      };

      await this.auditService.append(auditInput, tx);

      return {
        id: conn.id,
        providerKey: conn.providerKey,
        displayName: conn.displayName,
        enabled: conn.enabled,
        config: conn.config as Record<string, unknown>,
        createdBy: conn.createdBy,
        createdAt: conn.createdAt,
      };
    });
  }

  /**
   * listConnections — returns all data_source_connections with per-connection
   * company count (for the ≥2-source facet on the workspace page).
   */
  async listConnections() {
    const rows = await this.repository.listConnections();
    return {
      connections: rows.map((row) => ({
        id: row.id,
        providerKey: row.providerKey,
        displayName: row.displayName,
        enabled: row.enabled,
        config: row.config,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        companyCount: row.companyCount,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Sync endpoint orchestration
  // ---------------------------------------------------------------------------

  /**
   * syncConnection — validates the connection exists and is enabled, then
   * delegates to IngestionService.sync.
   *
   * Returns SyncSummary { ingested, updated } on success.
   * Throws NotFoundException (404) if connection unknown or disabled.
   * Throws BadRequestException (400) if the connection's provider_key has no
   * registered adapter (CRITICAL-2 fix b: maps the plain Error from
   * IngestionService to 400 instead of letting NestJS 500 it).
   */
  async syncConnection(connectionId: string): Promise<SyncSummary> {
    const connection = await this.repository.findConnectionById(connectionId);
    if (!connection?.enabled) {
      throw new NotFoundException(`Connection ${connectionId} not found or is disabled`);
    }
    try {
      return await this.ingestionService.sync(connectionId);
    } catch (err: unknown) {
      // CRITICAL-2 fix (b): IngestionService throws a plain Error (not a NestJS
      // HttpException) when no adapter is registered for the connection's
      // provider_key. Map it to BadRequestException (400) so the caller gets a
      // clean "unknown provider" error instead of an opaque 500.
      if (
        err instanceof Error &&
        err.message.startsWith('No adapter registered for provider_key')
      ) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Companies read surface
  // ---------------------------------------------------------------------------

  /**
   * listCompanies — returns canonical companies + augmented counts + connectionIds
   * for the list screen. Applies CompaniesListFilter (q/source/status).
   *
   * CRITICAL-1 fix: connectionIds is now included in the mapped response so the
   * web ResultsMatrix can render per-company source badges from real connection
   * display_name values, instead of defaulting to [] and showing '—' for every
   * Source column.
   */
  async listCompanies(filter: CompaniesListFilter) {
    const rows = await this.repository.listCompanies(filter);
    return {
      companies: rows.map((row) => ({
        id: row.id,
        name: row.name,
        domain: row.domain,
        normalizedDomain: row.normalizedDomain,
        normalizedName: row.normalizedName,
        sector: row.sector,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        contactCount: row.contactCount,
        sourceCount: row.sourceCount,
        connectionIds: row.connectionIds,
      })),
    };
  }

  /**
   * getCompanyDetail — returns one canonical company with contacts, provenance,
   * and any pending dedupe_candidates targeting it.
   *
   * Throws NotFoundException (404) if not found.
   */
  async getCompanyDetail(companyId: string) {
    const company = await this.repository.findCompanyById(companyId);
    if (!company) {
      throw new NotFoundException(`Company ${companyId} not found`);
    }

    const [contacts, provenance, pendingCandidates] = await Promise.all([
      this.repository.findContactsByCompanyId(companyId),
      this.repository.findProvenanceByCompanyId(companyId),
      this.repository.findPendingCandidatesByMatchedCompany(companyId),
    ]);

    return {
      company,
      contacts,
      provenance,
      pendingCandidates,
    };
  }

  // ---------------------------------------------------------------------------
  // Dedupe-candidate resolution (AUDITED)
  // ---------------------------------------------------------------------------

  /**
   * resolveDedupeCandidateAsActor — resolves a dedupe candidate (merge|reject)
   * WITH audit, actor identity via getUserWithRole.
   *
   * This is the entry point called by the controller. The SuperTokens user id
   * is translated to the app users.id here (NOT in the controller) so the FK
   * and audit actor id are always the authoritative app UUID.
   *
   * @param candidateId  — the dedupe_candidates row to resolve
   * @param input        — { action: 'merge' | 'reject' }
   * @param supertokensUserId — the raw SuperTokens user id from the session
   *
   * Throws:
   *   NotFoundException (404) if candidate not found or already resolved.
   *   ForbiddenException (403) if getUserWithRole returns null (no app user row).
   *   UnprocessableEntityException (422) if merge attempted on a candidate with
   *     no matched_company_id.
   */
  async resolveDedupeCandidateAsActor(
    candidateId: string,
    input: DedupeResolveInput,
    supertokensUserId: string
  ): Promise<{ candidateId: string; status: 'merged' | 'rejected'; companyId?: string }> {
    // Translate SuperTokens id → app users.id (the wave-5 actor-id-FK lesson).
    // MUST NOT pass supertokensUserId directly into a users.id FK column.
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      // No app users row for this SuperTokens session — refuse (fail closed).
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.resolveDedupeCandidate(candidateId, input, appUserId, actorRole);
  }

  /**
   * resolveDedupeCandidate — core resolution logic (inner; accepts resolved
   * app users.id + roleName directly so it's independently testable with mock
   * IDs).
   *
   * Runs within a single db.transaction so the candidate status update +
   * optional merge write + AuditService.append all commit or roll back together.
   */
  private async resolveDedupeCandidate(
    candidateId: string,
    input: DedupeResolveInput,
    appUserId: string,
    actorRole: string
  ): Promise<{ candidateId: string; status: 'merged' | 'rejected'; companyId?: string }> {
    return this.repository.runInTransaction(async (tx: Tx) => {
      // CRITICAL-3 fix: read the candidate INSIDE the transaction with a
      // conditional-update guard so that two concurrent resolves cannot both
      // see "pending" and both apply the merge + audit.
      //
      // The pattern: read inside tx (so the read participates in the tx snapshot),
      // then make the status transition atomic+single-winner via the conditional
      // UPDATE in updateDedupeCandidateStatus (WHERE status='pending' guard).
      // If two concurrent requests both read pending, only one will win the
      // UPDATE (the loser gets 0 rows returned → ConflictException).
      const candidate = await this.repository.findDedupeCandidateByIdForUpdate(tx, candidateId);
      if (!candidate) {
        throw new NotFoundException(`Dedupe candidate ${candidateId} not found`);
      }
      if (candidate.status !== 'pending') {
        // Already resolved — report as conflict (no double-apply).
        // Using ConflictException (409) for the concurrent-resolve case, which is
        // more semantically accurate than 404 here. The outer resolveDedupeCandidateAsActor
        // retains NotFoundException for the "candidate already resolved at read time" case.
        throw new ConflictException(
          `Dedupe candidate ${candidateId} is already resolved (status=${candidate.status})`
        );
      }

      let companyId: string | undefined;

      // --- action=merge ---
      if (input.action === 'merge') {
        if (!candidate.matchedCompanyId) {
          throw new UnprocessableEntityException(
            `Cannot merge candidate ${candidateId}: no matched_company_id (null). ` +
              'A merge requires a target canonical company.'
          );
        }

        // Perform the merge: raw → canonical + provenance + contacts + contact_provenance
        await this.repository.mergeRawIntoCanonical(
          tx,
          candidate.rawCompanyId,
          candidate.matchedCompanyId
        );

        companyId = candidate.matchedCompanyId;
      }
      // action=reject: no canonical write; the raw row stays as-is.
      // Documented policy: rejected candidate — raw may become its own canonical
      // on a future dedupe pass that uses different thresholds, or it stays as
      // a staging-only record. No action taken on the raw row here.

      // Update candidate status with WHERE status='pending' guard (single-winner).
      // If ZERO rows returned → another concurrent resolve already won → throw.
      await this.repository.updateDedupeCandidateStatusConditional(
        tx,
        candidateId,
        input.action === 'merge' ? 'merged' : 'rejected',
        appUserId
      );

      // AUDIT in-tx: sourcing-dedupe-resolve (wave-5 pattern; P-3 Δ6)
      // actorUserId = app users.id (not the raw SuperTokens id).
      // Both contentHash and payloadHash are required by the append input schema.
      // We compute them over the event payload (deterministic serialization).
      const eventPayload = {
        candidateId,
        action: input.action,
        rawCompanyId: candidate.rawCompanyId,
        matchedCompanyId: candidate.matchedCompanyId ?? null,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');
      // contentHash: same as payloadHash in this context (no separate "content"
      // blob distinct from the event). This matches the audit schema's requirement
      // that both fields are present. They diverge for outreach events (message body
      // vs metadata payload); for resolves they are the same payload.
      const contentHash = payloadHash;

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'sourcing-dedupe-resolve',
        resourceType: 'dedupe_candidate',
        resourceId: candidateId,
        contentHash,
        payloadHash,
      };

      await this.auditService.append(auditInput, tx);

      return {
        candidateId,
        status: input.action === 'merge' ? 'merged' : 'rejected',
        ...(companyId !== undefined ? { companyId } : {}),
      };
    });
  }
}
