/**
 * IngestionService — ETL service for the deal-sourcing data spine.
 *
 * Implements the two-tier ingest model:
 *   1. Resolve adapter for the connection's provider_key.
 *   2. fetchCompanies → normalize → UPSERT raw_companies (staging; idempotent
 *      by UNIQUE(connection_id, source_record_id) — onConflictDoUpdate).
 *      Re-sync UPDATES the existing row; it never creates a duplicate staging row.
 *   3. Invoke DedupeEngine.promoteStaging to promote raw→canonical.
 *
 * This service writes ONLY to the staging tier (raw_companies). The dedupe
 * engine is the sole writer of the canonical tier (companies / contacts /
 * *_provenance). This separation is load-bearing: ingest idempotency and
 * dedupe idempotency are independently verifiable service concerns.
 *
 * Transaction model:
 *   Staging upsert runs in its own transaction (or the caller's; we use the
 *   db handle directly since raw writes are idempotent and non-critical for
 *   atomicity beyond the row level). The dedupe pass runs in a separate
 *   transaction via db.transaction() after all staging rows are written.
 *   A failed staging upsert leaves no partial state (each row is a full upsert).
 *   A failed dedupe pass leaves staging intact; re-running sync recovers
 *   by re-invoking promoteStaging over the unpromoted staging rows.
 *
 * Error behaviour:
 *   - Unknown/disabled connection → caller (SourcingService) returns 404.
 *   - No matching adapter → sync returns { ingested: 0, updated: 0, error: ... }
 *     or throws a clean error that the controller maps to 400.
 *   - Adapter fetch failure → thrown; controller maps to 500 or re-throws.
 *
 * Audit:
 *   ETL upserts to staging are NOT audited (machine ingest, high-volume, not a
 *   human decision). Only dedupe-candidate resolution (human decision, alters
 *   canonical truth) is audited — in SourcingService.resolveDedupeCandidate.
 */

import type { SyncSummary } from '@dealflow/shared';
import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { dataSourceConnections, rawCompanies } from '../../db/schema/sourcing';
import { DEFAULT_WORKSPACE_ID } from '../../db/schema/workspaces';
import { getDb, getWorkspaceId } from '../../db/workspace-context';
import type { AdapterRegistry } from './adapters/adapter.registry';
import { ADAPTER_REGISTRY } from './adapters/adapter.registry';
import { DedupeEngine, normalizeDomain } from './dedupe.engine';

@Injectable()
export class IngestionService {
  private readonly dedupeEngine: DedupeEngine;

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ADAPTER_REGISTRY) private readonly adapterRegistry: AdapterRegistry
  ) {
    this.dedupeEngine = new DedupeEngine();
  }

  /**
   * sync — runs the full ETL + dedupe pass for a single connection.
   *
   * Steps:
   *   1. Load the connection row (caller must have validated it exists + enabled).
   *   2. Resolve the adapter for provider_key.
   *   3. fetchCompanies → UPSERT raw_companies (idempotent by connection_id+source_record_id).
   *   4. Invoke promoteStaging in a separate transaction (dedupe engine owns canonical).
   *
   * Returns SyncSummary { ingested, updated } where:
   *   ingested = new staging rows created on this sync
   *   updated  = existing staging rows refreshed on this sync
   *
   * The ingested/updated split is derived from the DB's response to the upsert:
   * new rows vs rows where the conflict fired (updated).
   */
  async sync(connectionId: string): Promise<SyncSummary> {
    // 1. Load connection
    const connectionRows = await getDb(this.db)
      .select()
      .from(dataSourceConnections)
      .where(eq(dataSourceConnections.id, connectionId))
      .limit(1);

    const connection = connectionRows[0];
    if (!connection?.enabled) {
      throw new Error(`Connection ${connectionId} not found or disabled`);
    }

    // Adapt to the DataSourceConnection interface shape
    const connectionInput = {
      id: connection.id,
      providerKey: connection.providerKey,
      displayName: connection.displayName,
      enabled: connection.enabled,
      config: connection.config as Record<string, unknown>,
      createdBy: connection.createdBy,
      createdAt: connection.createdAt,
    };

    // 2. Resolve adapter
    const adapter = this.adapterRegistry.getAdapter(connection.providerKey);
    if (!adapter) {
      throw new Error(
        `No adapter registered for provider_key "${connection.providerKey}". ` +
          `Registered providers: ${this.adapterRegistry.registeredKeys().join(', ') || 'none'}`
      );
    }

    // 3. Fetch + normalize from adapter
    const records = await adapter.fetchCompanies(connectionInput);

    let ingested = 0;
    let updated = 0;

    // 4. UPSERT raw_companies — idempotent by (connection_id, source_record_id)
    for (const record of records) {
      const normalizedDomainValue = normalizeDomain(record.domain ?? null);

      // Use onConflictDoUpdate to distinguish new vs re-synced rows.
      // The raw JSON payload includes the contacts array for the dedupe engine
      // to extract at promotion time.
      const rawPayload: Record<string, unknown> = {
        name: record.name,
        domain: record.domain,
        contacts: record.contacts,
        ...(record.raw ?? {}),
      };

      // We use a raw SQL approach to detect insert vs update:
      // Drizzle's onConflictDoUpdate sets a sentinel xmax which we can read,
      // but simpler: we track whether the row was inserted or updated via
      // the returning clause checking if ingested_at changed.
      //
      // Approach: insert with conflict update; count via a pre-check (less
      // complex than parsing xmax in Drizzle). We do a simple EXISTS check
      // before the upsert to determine if this is new or existing.
      const existingRows = await getDb(this.db)
        .select({ id: rawCompanies.id })
        .from(rawCompanies)
        .where(
          // Use raw SQL for clarity; Drizzle AND condition
          eq(rawCompanies.connectionId, connectionId)
        )
        .limit(999); // get all for this connection

      const _existsBefore = existingRows.some((_r) => {
        // We need to check by sourceRecordId — load it from source
        // This approach requires a targeted query:
        return false; // we'll use a different strategy below
      });

      // More direct: use the upsert result to determine new vs update
      // by checking xmax. We use a simpler strategy: count before/after.
      // For correctness and simplicity, use a per-record existence check.
      const existingRecord = await getDb(this.db)
        .select({ id: rawCompanies.id })
        .from(rawCompanies)
        .where(
          sql`${rawCompanies.connectionId} = ${connectionId} AND ${rawCompanies.sourceRecordId} = ${record.sourceRecordId}`
        )
        .limit(1);

      const isNew = existingRecord.length === 0;

      await getDb(this.db)
        .insert(rawCompanies)
        .values({
          connectionId,
          sourceRecordId: record.sourceRecordId,
          name: record.name,
          domain: record.domain ?? null,
          normalizedDomain: normalizedDomainValue,
          raw: rawPayload,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .onConflictDoUpdate({
          target: [rawCompanies.connectionId, rawCompanies.sourceRecordId],
          set: {
            name: record.name,
            domain: record.domain ?? null,
            normalizedDomain: normalizedDomainValue,
            raw: rawPayload,
            ingestedAt: sql`now()`,
          },
        });

      if (isNew) {
        ingested++;
      } else {
        updated++;
      }
    }

    // 5. Run dedupe promotion in a separate transaction (canonical writes)
    // The engine promotes all unpromoted raw rows for this connection.
    await getDb(this.db).transaction(async (tx) => {
      await this.dedupeEngine.promoteStaging(tx, connectionId);
    });

    return { ingested, updated };
  }
}
