/**
 * T-8 unit — AuditService append chaining (task a8b2b5a2).
 *
 * Uses the REAL AuditKeyring (known key) + REAL hash, with an in-memory fake
 * AuditRepository that models the advisory-lock-serialized tail/insert semantics
 * (single-threaded appends → tail+1 sequence, OVERRIDING-SYSTEM-VALUE forcing
 * the stored sequence_number to what was hashed). No live DB.
 *
 * Asserts:
 *   - genesis entry: sequence_number=1, prev_hash=GENESIS_PREV_HASH;
 *   - N entries chain: each entry's prev_hash == the prior entry's entry_hash;
 *   - stored sequence_number equals the value the hash was computed over (the
 *     verifier — run over the same fixture — returns ok:true);
 *   - the advisory lock is acquired before the tail read (ordering).
 */

import type { AuditEntryInput } from '@dealflow/shared';
import { GENESIS_PREV_HASH } from '@dealflow/shared';
import { describe, expect, it, vi } from 'vitest';

import { AuditKeyring } from './audit.keyring';
import type { StoredAuditEntry, Tx } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditVerifier } from './audit.verifier';

const KEY = 'append-test-key';

function keyring(): AuditKeyring {
  return new AuditKeyring({ AUDIT_LOG_HMAC_KEY: KEY, AUDIT_LOG_HMAC_KEY_VERSION: '1' });
}

/** In-memory repo modelling the serialized append semantics. */
class FakeRepo {
  rows: StoredAuditEntry[] = [];
  lockOrder: string[] = [];

  acquireChainLock = vi.fn(async (_tx: Tx) => {
    this.lockOrder.push('lock');
  });

  readTail = vi.fn(async (_tx: Tx) => {
    this.lockOrder.push('read');
    if (this.rows.length === 0) return null;
    const tail = this.rows[this.rows.length - 1];
    return { sequenceNumber: tail.sequenceNumber, entryHash: tail.entryHash };
  });

  insertEntry = vi.fn(async (_tx: Tx, entry: StoredAuditEntry) => {
    this.rows.push(entry);
    return entry;
  });

  readChainAscending = vi.fn(async () =>
    [...this.rows].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  );

  runInTransaction = vi.fn(async <T>(work: (tx: Tx) => Promise<T>) => work({} as Tx));
}

function inputFor(n: number): AuditEntryInput {
  return {
    actorUserId: null,
    actorRole: 'compliance',
    action: 'verify-chain',
    resourceType: 'audit-log',
    resourceId: `res-${n}`,
    contentHash: `${n}`.repeat(64).slice(0, 64),
    payloadHash: `${n === 0 ? 1 : n}`.repeat(64).slice(0, 64),
  };
}

describe('AuditService.append — genesis + chaining', () => {
  it('genesis entry: sequence_number=1, prev_hash=GENESIS_PREV_HASH', async () => {
    const repo = new FakeRepo();
    const svc = new AuditService(keyring(), repo as unknown as never);

    const entry = await svc.append(inputFor(1), {} as Tx);

    expect(entry.sequenceNumber).toBe(1);
    expect(entry.prevHash).toBe(GENESIS_PREV_HASH);
    expect(entry.chainVersion).toBe(1);
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('acquires the advisory lock BEFORE reading the tail', async () => {
    const repo = new FakeRepo();
    const svc = new AuditService(keyring(), repo as unknown as never);
    await svc.append(inputFor(1), {} as Tx);
    expect(repo.lockOrder).toEqual(['lock', 'read']);
  });

  it('N entries chain: each prev_hash links to the prior entry_hash', async () => {
    const repo = new FakeRepo();
    const svc = new AuditService(keyring(), repo as unknown as never);

    const e1 = await svc.append(inputFor(1), {} as Tx);
    const e2 = await svc.append(inputFor(2), {} as Tx);
    const e3 = await svc.append(inputFor(3), {} as Tx);

    expect([e1.sequenceNumber, e2.sequenceNumber, e3.sequenceNumber]).toEqual([1, 2, 3]);
    expect(e2.prevHash).toBe(e1.entryHash);
    expect(e3.prevHash).toBe(e2.entryHash);
  });

  it('stored sequence_number matches the hashed value → verifier accepts the chain', async () => {
    const repo = new FakeRepo();
    const svc = new AuditService(keyring(), repo as unknown as never);
    for (let i = 1; i <= 5; i += 1) {
      await svc.append(inputFor(i), {} as Tx);
    }

    const verifier = new AuditVerifier(keyring(), repo as unknown as never);
    const result = await verifier.verifyChain();
    expect(result).toEqual({ ok: true, entriesChecked: 5 });
  });

  it('appendStandalone opens its own tx and appends', async () => {
    const repo = new FakeRepo();
    const svc = new AuditService(keyring(), repo as unknown as never);
    const entry = await svc.appendStandalone(inputFor(1));
    expect(entry.sequenceNumber).toBe(1);
    expect(repo.runInTransaction).toHaveBeenCalledOnce();
  });
});
