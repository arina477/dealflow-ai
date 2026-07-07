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
import { and, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { auditLogEntries } from '../../db/schema/audit-log';
import { getDb } from '../../db/workspace-context';

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
  /**
   * Wave-17 (task 0db154ff) — tenant boundary, HASH-EXCLUDED.
   * NEVER included in HashableEntryFields / canonicalSerialization.
   * The WORM trigger is the sole backstop against cross-workspace re-attribution.
   */
  workspaceId: string;
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
   *
   * SECURITY INVARIANT: MUST use read_audit_chain_rls_exempt (SECURITY DEFINER)
   * rather than a direct Drizzle ORM select. The audit chain is a SINGLE GLOBAL
   * monotonic sequence across ALL workspaces. When this method runs within a tx
   * opened by a dealflow_app session (NOBYPASSRLS + FORCE ROW LEVEL SECURITY),
   * a direct Drizzle select on auditLogEntries is filtered by the workspace_isolation
   * RLS policy to only the current app.workspace_id. If no prior audit entries
   * exist for that workspace, the RLS-filtered select returns empty → the append
   * treats the log as empty and computes genesis nextSeq=1. If any global entry
   * already exists at sequence_number=1 (from any workspace), the subsequent
   * INSERT ... OVERRIDING SYSTEM VALUE with sequence_number=1 collides with the
   * existing PK → SQLSTATE 23505 duplicate-key error.
   *
   * The SECURITY DEFINER function bypasses RLS and returns the full global chain,
   * so we read the actual global tail regardless of which workspace is active.
   * dealflow_app has EXECUTE on read_audit_chain_rls_exempt (migration 0016).
   * The advisory lock on `tx` still serializes concurrent appends — the function
   * call runs within that same transaction.
   */
  async readTail(tx: Tx): Promise<ChainTail | null> {
    const result = await tx.execute<Record<string, unknown>>(sql`
      SELECT
        (sequence_number)::int AS "sequenceNumber",
        entry_hash             AS "entryHash"
      FROM read_audit_chain_rls_exempt(1, 9223372036854775807)
      ORDER BY sequence_number DESC
      LIMIT 1
    `);
    const row = result.rows[0];
    if (!row) return null;
    return {
      sequenceNumber: row.sequenceNumber as number,
      entryHash: row.entryHash as string,
    };
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
        // workspaceId is hash-excluded — mirrors the mandate_id exclusion pattern.
        // The WORM trigger is the sole backstop against cross-workspace re-attribution.
        workspaceId: entry.workspaceId,
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
   *
   * [P-4 F3] MUST use the SECURITY DEFINER function read_audit_chain_rls_exempt()
   * rather than a direct Drizzle select. The audit HMAC chain is a SINGLE GLOBAL
   * monotonic sequence across ALL workspaces; a GUC-scoped RLS read would return
   * a non-contiguous subset → false sequence-gap → ok:false. The SECURITY DEFINER
   * function bypasses RLS so the verifier always sees the full chain.
   *
   * The LIST/EXPORT projection (findAdminActivity, recordkeeping queries) remains
   * RLS-scoped (workspace-filtered) — only this integrity WALK is RLS-exempt.
   *
   * Column aliases map the function's snake_case returns to StoredAuditEntry
   * camelCase fields. sequence_number::int casts BIGINT to JS number (safe for
   * MVP volumes; promote to Number() + BigInt if chain exceeds 2^31 entries).
   * created_at::text returns the timestamptz as a pg text string, which
   * canonicalSerialization() normalises before hashing (see audit.service.ts comment).
   */
  async readChainAscending(): Promise<StoredAuditEntry[]> {
    const result = await getDb(this.db).execute<Record<string, unknown>>(sql`
      SELECT
        (sequence_number)::int    AS "sequenceNumber",
        actor_user_id::text       AS "actorUserId",
        actor_role                AS "actorRole",
        action,
        resource_type             AS "resourceType",
        resource_id               AS "resourceId",
        content_hash              AS "contentHash",
        payload_hash              AS "payloadHash",
        prev_hash                 AS "prevHash",
        entry_hash                AS "entryHash",
        chain_version             AS "chainVersion",
        created_at::text          AS "createdAt",
        mandate_id::text          AS "mandateId",
        workspace_id::text        AS "workspaceId"
      FROM read_audit_chain_rls_exempt(1, 9223372036854775807)
    `);
    return result.rows as unknown as StoredAuditEntry[];
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

    return getDb(this.db)
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

    const result = await getDb(this.db)
      .select({ count: sql<number>`count(*)::int` })
      .from(auditLogEntries)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }

  /** Expose the db handle so the service can open a standalone tx (helper path). */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return getDb(this.db).transaction(work);
  }
}
