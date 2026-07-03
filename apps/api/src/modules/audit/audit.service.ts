/**
 * AuditService (wave-4, task a8b2b5a2) — the SINGLE append authority for the
 * tamper-evident hash-chain. All audit writes go through append(); there is no
 * other write path and no fire-and-forget.
 *
 * ── Write atomicity (security invariant / P-4 item-6) ──────────────────────
 * append(input, tx) takes a REQUIRED Drizzle tx handle and composes into the
 * CALLER's transaction:
 *     await db.transaction(async (tx) => {
 *       await businessWrite(tx);                 // the audited action
 *       await auditService.append(evt, tx);      // its audit entry — SAME tx
 *     });
 * The audited action and its audit entry commit or roll back TOGETHER. An
 * audited action cannot commit without its audit row. (No real audited call-site
 * exists this wave — M6+; the tx API is exercised standalone here and via
 * appendStandalone() which opens its own tx.)
 *
 * ── Concurrent-append single chain (security invariant) ────────────────────
 * The FIRST statement in the append tx is pg_advisory_xact_lock on a fixed key
 * (AuditRepository.acquireChainLock). Only one appender holds the chain tail at
 * a time, so two concurrent appends cannot read the same tail and fork
 * prev_hash. The lock also covers the empty-log→genesis race (it locks a
 * constant, not a row). The lock releases at tx commit/rollback.
 *
 * ── Genesis anchor ─────────────────────────────────────────────────────────
 * The first entry (empty log) links to GENESIS_PREV_HASH (shared constant, 64
 * hex zeros) so the chain has a defined, reproducible root.
 *
 * ── sequence_number ↔ hash ordering (the correctness crux) ─────────────────
 * sequence_number is GENERATED ALWAYS AS IDENTITY (DB-assigned; the app cannot
 * supply it via a normal INSERT). But the entry_hash MUST incorporate the
 * assigned sequence_number, so the verifier — which recomputes the hash from the
 * STORED row — matches. We resolve the ordering by PREDICT-THEN-FORCE:
 *   1. Under the advisory lock, read the tail. nextSeq = tail.sequenceNumber + 1
 *      (or 1 for genesis). Because the lock serializes appends and IDENTITY
 *      increments by 1 from 1, this prediction is exact and collision-free.
 *   2. Compute entry_hash over that predicted nextSeq.
 *   3. INSERT with OVERRIDING SYSTEM VALUE, supplying sequence_number = nextSeq
 *      explicitly — so the STORED sequence_number is exactly the value that was
 *      hashed. No "insert then read back the identity then re-hash" round-trip;
 *      the value is forced to match the hash, not the other way round.
 * This is robust against the classic "hash references an id the DB hasn't
 * assigned yet" problem: the advisory lock makes tail+1 authoritative, and
 * OVERRIDING SYSTEM VALUE writes exactly that.
 */

import type { AuditEntryInput, AuditLogEntry } from '@dealflow/shared';
import { GENESIS_PREV_HASH } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';

import { computeEntryHash, type HashableEntryFields } from './audit.hash';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditKeyring } from './audit.keyring';
import type { StoredAuditEntry, Tx } from './audit.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditRepository } from './audit.repository';

@Injectable()
export class AuditService {
  constructor(
    private readonly keyring: AuditKeyring,
    private readonly repository: AuditRepository
  ) {}

  /**
   * Append one entry to the chain WITHIN the caller's transaction.
   *
   * The caller MUST have opened `tx` and MUST perform its audited business write
   * in the same `tx` for atomicity. This method:
   *   1. acquires the chain advisory lock (serialize appends onto one chain),
   *   2. reads the tail → prevHash (genesis anchor if empty) + nextSeq,
   *   3. computes entry_hash with the CURRENT chain_version key,
   *   4. inserts with the forced sequence_number.
   */
  async append(input: AuditEntryInput, tx: Tx): Promise<AuditLogEntry> {
    // (1) Serialize the critical section. First statement in the append tx.
    await this.repository.acquireChainLock(tx);

    // (2) Read the tail under the lock. Stable for the whole append.
    const tail = await this.repository.readTail(tx);
    const prevHash = tail === null ? GENESIS_PREV_HASH : tail.entryHash;
    const nextSeq = tail === null ? 1 : tail.sequenceNumber + 1;

    // The DB clock's stored created_at and the app's hashed created_at are the
    // SAME instant but pg's timestamptz read-back is a DIFFERENT string form
    // (space/`+00`/microsecond) than this app-ISO. canonicalSerialization()
    // normalizes BOTH forms to one canonical millisecond ISO string before
    // hashing, so append-bytes == verify-bytes regardless of pg round-trip.
    // We stamp millisecond-precision ISO here (toISOString() is always ms) so
    // pg never stores sub-millisecond precision that could shift the rounding.
    const createdAt = new Date().toISOString();

    const chainVersion = this.keyring.currentVersion;
    const key = this.keyring.keyFor(chainVersion);

    const hashable: HashableEntryFields = {
      sequenceNumber: nextSeq,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      contentHash: input.contentHash,
      payloadHash: input.payloadHash,
      chainVersion,
      createdAt,
    };

    // (3) Keyed HMAC over the canonical serialization + prev_hash link.
    const entryHash = computeEntryHash(hashable, prevHash, key);

    // (4) Insert with the forced sequence_number (OVERRIDING SYSTEM VALUE).
    const stored = await this.repository.insertEntry(tx, {
      ...hashable,
      prevHash,
      entryHash,
    });

    // (5) Self-check tripwire: recompute the hash over the STORED row (whose
    // created_at has now round-tripped through the timestamptz column) and
    // assert it reproduces the entry_hash we just wrote. This catches any
    // created_at (or other field) representation drift AT WRITE TIME, inside the
    // caller's tx, so a chain that would not verify live never commits. Cheap
    // (one HMAC) and self-heals the class of bug this defends against.
    const selfHash = computeEntryHash(
      {
        sequenceNumber: stored.sequenceNumber,
        actorUserId: stored.actorUserId,
        actorRole: stored.actorRole,
        action: stored.action,
        resourceType: stored.resourceType,
        resourceId: stored.resourceId,
        contentHash: stored.contentHash,
        payloadHash: stored.payloadHash,
        chainVersion: stored.chainVersion,
        createdAt: stored.createdAt,
      },
      stored.prevHash,
      key
    );
    if (selfHash !== stored.entryHash) {
      throw new Error(
        `AuditService.append self-check failed at sequence_number=${stored.sequenceNumber}: ` +
          'the stored row does not reproduce its entry_hash. Rolling back (chain would not ' +
          'verify live). This indicates a created_at/field serialization drift.'
      );
    }

    return toAuditLogEntry(stored);
  }

  /**
   * Standalone helper: opens a fresh transaction and appends. For call-sites
   * with NO surrounding business transaction (and for standalone tests). Real
   * audited actions should prefer append(input, tx) to compose atomically with
   * their business write.
   */
  appendStandalone(input: AuditEntryInput): Promise<AuditLogEntry> {
    return this.repository.runInTransaction((tx) => this.append(input, tx));
  }
}

/** Map the raw stored row to the shared AuditLogEntry shape (camelCase already). */
function toAuditLogEntry(stored: StoredAuditEntry): AuditLogEntry {
  return {
    sequenceNumber: stored.sequenceNumber,
    actorUserId: stored.actorUserId,
    actorRole: stored.actorRole,
    // action is `text` in the DB but the shared type is the enum; callers only
    // ever pass enum values (auditEntryInputSchema), so this is safe.
    action: stored.action as AuditLogEntry['action'],
    resourceType: stored.resourceType,
    resourceId: stored.resourceId,
    contentHash: stored.contentHash,
    payloadHash: stored.payloadHash,
    prevHash: stored.prevHash,
    entryHash: stored.entryHash,
    chainVersion: stored.chainVersion,
    createdAt: stored.createdAt,
  };
}
