/**
 * AuditRepository (wave-4, task a8b2b5a2 / e6a4cbfe) — app-DB access for the
 * audit module. Pure data access; ZERO crypto and ZERO chain logic (those live
 * in audit.hash.ts / audit.service.ts / audit.verifier.ts).
 *
 * Every write/tail-read method takes a Drizzle `tx` handle so the caller owns
 * the transaction boundary — the append composes into the caller's business
 * transaction (write atomicity, see audit.service.ts). The full-chain read for
 * verification runs on the shared pool (read-only, no tx needed).
 */

import { Inject, Injectable } from '@nestjs/common';
import { asc, sql } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { auditLogEntries } from '../../db/schema/audit-log';

/** Drizzle transaction handle — same derivation as auth.repository.ts. */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * A fixed advisory-lock key for the single audit chain. Any constant works so
 * long as it is STABLE across processes — `pg_advisory_xact_lock(<key>)` on this
 * value serializes the tail-read→compute→insert critical section so two
 * concurrent appends cannot fork prev_hash (and covers the empty-log→genesis
 * race, since it locks a constant, not a row). Chosen arbitrarily; documented so
 * a future second chain would use a distinct key.
 */
export const AUDIT_CHAIN_ADVISORY_LOCK_KEY = 4_100_400_400 as const;

/** The tail (highest sequence_number) entry — the chain link the next append reads. */
export interface ChainTail {
  sequenceNumber: number;
  entryHash: string;
}

/** A stored entry as read for verification (all chain-relevant columns). */
export interface StoredAuditEntry {
  sequenceNumber: number;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  contentHash: string;
  payloadHash: string;
  prevHash: string;
  entryHash: string;
  chainVersion: number;
  createdAt: string;
}

/** Fields the service supplies to INSERT — sequence_number IS supplied here */
/** (via OVERRIDING SYSTEM VALUE) so the stored value equals what was hashed. */
export interface InsertAuditEntry extends StoredAuditEntry {}

@Injectable()
export class AuditRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Acquire the transaction-scoped advisory lock that serializes appends onto
   * the single chain. Released automatically at tx commit/rollback. MUST be
   * called at the TOP of the append transaction, before reading the tail.
   */
  async acquireChainLock(tx: Tx): Promise<void> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_ADVISORY_LOCK_KEY})`);
  }

  /**
   * Read the current chain tail (max sequence_number's entry) inside the tx.
   * Returns null for an empty log (genesis case). Must be called AFTER
   * acquireChainLock so the tail is stable for the duration of the append.
   */
  async readTail(tx: Tx): Promise<ChainTail | null> {
    const rows = await tx
      .select({
        sequenceNumber: auditLogEntries.sequenceNumber,
        entryHash: auditLogEntries.entryHash,
      })
      .from(auditLogEntries)
      .orderBy(sql`${auditLogEntries.sequenceNumber} DESC`)
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Insert one entry, FORCING the sequence_number to the value that was hashed
   * (OVERRIDING SYSTEM VALUE). Under the advisory lock this value is exactly
   * tail+1 (or 1 for genesis) and never collides — so the stored entry_hash the
   * verifier recomputes matches. Returns the inserted row.
   */
  async insertEntry(tx: Tx, entry: InsertAuditEntry): Promise<StoredAuditEntry> {
    // drizzle .overridingSystemValue() emits INSERT ... OVERRIDING SYSTEM VALUE,
    // required because sequence_number is GENERATED ALWAYS AS IDENTITY.
    const rows = await tx
      .insert(auditLogEntries)
      .overridingSystemValue()
      .values({
        sequenceNumber: entry.sequenceNumber,
        actorUserId: entry.actorUserId,
        actorRole: entry.actorRole,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        contentHash: entry.contentHash,
        payloadHash: entry.payloadHash,
        prevHash: entry.prevHash,
        entryHash: entry.entryHash,
        chainVersion: entry.chainVersion,
        createdAt: entry.createdAt,
      })
      .returning();

    const row = rows[0];
    if (row === undefined) {
      throw new Error('AuditRepository.insertEntry: INSERT ... RETURNING yielded no row');
    }
    return row;
  }

  /**
   * Read the WHOLE chain in sequence_number ASC order for verification.
   * Read-only, runs on the shared pool (no tx). O(n) — acceptable for MVP
   * volumes; a future paginated/streamed verify is a noted upgrade path.
   */
  async readChainAscending(): Promise<StoredAuditEntry[]> {
    return this.db.select().from(auditLogEntries).orderBy(asc(auditLogEntries.sequenceNumber));
  }

  /** Expose the db handle so the service can open a standalone tx (helper path). */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
