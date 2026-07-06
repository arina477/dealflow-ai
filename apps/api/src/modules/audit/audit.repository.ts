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
import { and, asc, eq, gte, inArray, lte, lt, sql } from 'drizzle-orm';

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
  /**
   * Wave-14 (task 487b0f0c) — hash-excluded mandate context.
   * NULL for all non-gate-evaluate rows and for gate-evaluate rows appended
   * before this wave. NEVER included in HashableEntryFields / canonicalSerialization.
   */
  mandateId: string | null;
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
        // mandateId is hash-excluded — written to the DB column directly, never
        // fed into computeEntryHash. NULL for all non-gate-evaluate rows.
        mandateId: entry.mandateId,
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

  /**
   * Filtered + paginated read over audit_log_entries for the admin-activity surface.
   *
   * READ-ONLY: this method NEVER writes to audit_log_entries.
   * Mirrors the RecordkeepingRepository.findFiltered pattern for the admin-activity
   * read surface (task 8bb0a22f — P-4 Finding 3).
   *
   * Filters:
   *   - actions: restrict to an explicit set of action values (IN clause).
   *   - action: optional single-action filter within the set above.
   *   - since / until: ISO datetime bounds (inclusive).
   *   - cursor: sequence_number of the last item on the prior page (exclusive upper bound).
   *   - limit: page size (max 200, default 50).
   *
   * Returns entries newest-first (sequence_number DESC).
   */
  async findAdminActivity(filter: {
    actions: string[];
    action?: string;
    since?: string;
    until?: string;
    cursor?: number;
    limit?: number;
  }): Promise<StoredAuditEntry[]> {
    const limit = Math.min(filter.limit ?? 50, 200);
    const conditions: ReturnType<typeof eq>[] = [];

    // Restrict to the closed admin-action set (always applied).
    conditions.push(inArray(auditLogEntries.action, filter.actions));

    // Optional single-action filter within the set.
    if (filter.action) {
      conditions.push(eq(auditLogEntries.action, filter.action));
    }

    // Datetime bounds.
    if (filter.since) {
      conditions.push(gte(auditLogEntries.createdAt, filter.since));
    }
    if (filter.until) {
      conditions.push(lte(auditLogEntries.createdAt, filter.until));
    }

    // Cursor-based pagination: fetch entries older than (sequence_number < cursor).
    if (filter.cursor !== undefined) {
      conditions.push(lt(auditLogEntries.sequenceNumber, filter.cursor));
    }

    return this.db
      .select()
      .from(auditLogEntries)
      .where(and(...conditions))
      .orderBy(sql`${auditLogEntries.sequenceNumber} DESC`)
      .limit(limit);
  }

  /**
   * Count matching admin-activity entries (for total pagination metadata).
   * Uses the same filter set as findAdminActivity (without cursor/limit).
   *
   * READ-ONLY.
   */
  async countAdminActivity(filter: {
    actions: string[];
    action?: string;
    since?: string;
    until?: string;
  }): Promise<number> {
    const conditions: ReturnType<typeof eq>[] = [];

    conditions.push(inArray(auditLogEntries.action, filter.actions));

    if (filter.action) {
      conditions.push(eq(auditLogEntries.action, filter.action));
    }
    if (filter.since) {
      conditions.push(gte(auditLogEntries.createdAt, filter.since));
    }
    if (filter.until) {
      conditions.push(lte(auditLogEntries.createdAt, filter.until));
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogEntries)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  /** Expose the db handle so the service can open a standalone tx (helper path). */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
