/**
 * Wave-14 (task 487b0f0c) — hash-safety unit test: mixed chain with mandate context.
 *
 * PROVES:
 *   1. Appending old-style entries (mandateId=null) and new-style entries
 *      (mandateId set) produces a chain where AuditVerifier.verifyChain()
 *      returns {ok:true}.
 *   2. Old-style entries' entry_hash values are BYTE-IDENTICAL after adding
 *      the mandateId parameter path — the mandateId is NEVER fed into
 *      computeEntryHash / canonicalSerialization.
 *   3. New-style entries (with mandateId) also verify correctly — the HMAC
 *      is computed over the same HashableEntryFields as before.
 *
 * This is the load-bearing safety proof that the mandate_id column addition
 * does NOT break AuditVerifier.verifyChain() over the mixed old/new chain.
 */

import type { AuditEntryInput } from '@dealflow/shared';
import { GENESIS_PREV_HASH } from '@dealflow/shared';
import { describe, expect, it } from 'vitest';

import { computeEntryHash } from './audit.hash';
import { AuditKeyring } from './audit.keyring';
import type { StoredAuditEntry, Tx } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditVerifier } from './audit.verifier';

const KEY = 'hash-safety-test-key-do-not-use';
const MANDATE_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const MANDATE_B = 'bbbbbbbb-0000-0000-0000-000000000002';

function makeKeyring(): AuditKeyring {
  return new AuditKeyring({ AUDIT_LOG_HMAC_KEY: KEY, AUDIT_LOG_HMAC_KEY_VERSION: '1' });
}

/** In-memory repo that carries mandateId (mirrors the real AuditRepository shape). */
class FakeRepoWithMandate {
  rows: StoredAuditEntry[] = [];

  acquireChainLock = async (_tx: Tx) => {};

  readTail = async (_tx: Tx) => {
    if (this.rows.length === 0) return null;
    const tail = this.rows[this.rows.length - 1];
    return { sequenceNumber: tail.sequenceNumber, entryHash: tail.entryHash };
  };

  insertEntry = async (_tx: Tx, entry: StoredAuditEntry) => {
    this.rows.push(entry);
    return entry;
  };

  readChainAscending = async () =>
    [...this.rows].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  runInTransaction = async <T>(work: (tx: Tx) => Promise<T>) => work({} as Tx);
}

function makeInput(n: number): AuditEntryInput {
  return {
    actorUserId: null,
    actorRole: 'compliance',
    action: 'gate-evaluate',
    resourceType: 'outreach-template-version',
    resourceId: `ver-${n}`,
    contentHash: `${n}`.repeat(64).slice(0, 64),
    payloadHash: `${n === 0 ? 1 : n}`.repeat(64).slice(0, 64),
  };
}

function makeInputOld(n: number): AuditEntryInput {
  return {
    actorUserId: null,
    actorRole: 'compliance',
    action: 'outreach-compose',
    resourceType: 'outreach',
    resourceId: `out-${n}`,
    contentHash: `${n}`.repeat(64).slice(0, 64),
    payloadHash: `${n === 0 ? 1 : n}`.repeat(64).slice(0, 64),
  };
}

describe('Wave-14 hash-safety — mandateId is HASH-EXCLUDED (mixed chain)', () => {
  it('verifyChain {ok:true} over a chain of old-style entries (no mandateId)', async () => {
    const repo = new FakeRepoWithMandate();
    const svc = new AuditService(makeKeyring(), repo as never);

    // Append 3 old-style entries (append() sets mandateId=null internally)
    await svc.append(makeInputOld(1), {} as Tx);
    await svc.append(makeInputOld(2), {} as Tx);
    await svc.append(makeInputOld(3), {} as Tx);

    const verifier = new AuditVerifier(makeKeyring(), repo as never);
    const result = await verifier.verifyChain();
    expect(result).toEqual({ ok: true, entriesChecked: 3 });

    // All mandateId values are null (old-style path)
    for (const row of repo.rows) {
      expect(row.mandateId).toBeNull();
    }
  });

  it('verifyChain {ok:true} over a chain of new-style entries (with mandateId)', async () => {
    const repo = new FakeRepoWithMandate();
    const svc = new AuditService(makeKeyring(), repo as never);

    // Append 3 new-style entries (appendWithMandate)
    await svc.appendWithMandate(makeInput(1), {} as Tx, MANDATE_A);
    await svc.appendWithMandate(makeInput(2), {} as Tx, MANDATE_A);
    await svc.appendWithMandate(makeInput(3), {} as Tx, MANDATE_B);

    const verifier = new AuditVerifier(makeKeyring(), repo as never);
    const result = await verifier.verifyChain();
    expect(result).toEqual({ ok: true, entriesChecked: 3 });
  });

  it('verifyChain {ok:true} over a MIXED chain (old + new entries interleaved)', async () => {
    const repo = new FakeRepoWithMandate();
    const svc = new AuditService(makeKeyring(), repo as never);

    // Simulate the real-world mixed chain:
    // seq 1: old-style (pre-wave-14, no mandateId)
    // seq 2: new-style (wave-14, with mandateId)
    // seq 3: old-style
    // seq 4: new-style
    const e1 = await svc.append(makeInputOld(1), {} as Tx);
    const e2 = await svc.appendWithMandate(makeInput(2), {} as Tx, MANDATE_A);
    const e3 = await svc.append(makeInputOld(3), {} as Tx);
    const e4 = await svc.appendWithMandate(makeInput(4), {} as Tx, MANDATE_B);

    // Chain structure must hold
    expect(e1.sequenceNumber).toBe(1);
    expect(e2.sequenceNumber).toBe(2);
    expect(e3.sequenceNumber).toBe(3);
    expect(e4.sequenceNumber).toBe(4);
    expect(e2.prevHash).toBe(e1.entryHash);
    expect(e3.prevHash).toBe(e2.entryHash);
    expect(e4.prevHash).toBe(e3.entryHash);

    // mandateId is present on new-style, null on old-style
    expect(repo.rows[0].mandateId).toBeNull();
    expect(repo.rows[1].mandateId).toBe(MANDATE_A);
    expect(repo.rows[2].mandateId).toBeNull();
    expect(repo.rows[3].mandateId).toBe(MANDATE_B);

    // verifyChain must pass over the mixed chain
    const verifier = new AuditVerifier(makeKeyring(), repo as never);
    const result = await verifier.verifyChain();
    expect(result).toEqual({ ok: true, entriesChecked: 4 });
  });

  it('mandateId is excluded from the hash: direct hash recomputation proof', async () => {
    // Prove hash-exclusion by appending ONE entry with mandateId, then manually
    // recomputing the HMAC over the SAME hashable fields WITHOUT mandateId.
    // The recomputed hash must equal the stored entry_hash.
    //
    // This is the direct proof that mandateId is not in the hash preimage:
    //   - computeEntryHash(hashable, prevHash, key) uses ONLY HashableEntryFields
    //   - HashableEntryFields does NOT contain mandateId
    //   - Therefore the stored entry_hash == hash(fields_without_mandateId)
    const repo = new FakeRepoWithMandate();
    const svc = new AuditService(makeKeyring(), repo as never);
    const input = makeInputOld(1);

    await svc.appendWithMandate(input, {} as Tx, MANDATE_A);

    const stored = repo.rows[0];
    expect(stored).toBeDefined();
    expect(stored.mandateId).toBe(MANDATE_A);

    // Manually recompute the hash over ONLY the HashableEntryFields (no mandateId).
    const key = makeKeyring().keyFor(1);
    const recomputed = computeEntryHash(
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
      GENESIS_PREV_HASH,
      key
    );

    // If mandateId were in the hash, this would fail because we excluded it.
    // It passes → mandateId is hash-excluded.
    expect(recomputed).toBe(stored.entryHash);

    // Also confirm verifyChain passes (covers the same computation from the verifier side)
    const verifier = new AuditVerifier(makeKeyring(), repo as never);
    expect(await verifier.verifyChain()).toEqual({ ok: true, entriesChecked: 1 });
  });

  it('mandateId mutation does NOT affect entry_hash (tamper simulation)', async () => {
    // Simulate a scenario where mandate_id in the DB is mutated after INSERT.
    // Since mandate_id is not part of the HMAC preimage, the verifier must
    // still return {ok:true} — i.e., mandate_id tamper is NOT detectable by
    // verifyChain (by design — it is a metadata column, not a tamper-evident field).
    // This test documents and asserts that boundary explicitly.
    const repo = new FakeRepoWithMandate();
    const svc = new AuditService(makeKeyring(), repo as never);
    await svc.appendWithMandate(makeInput(1), {} as Tx, MANDATE_A);

    // Simulate "tamper" of the metadata column after insert (would not be
    // possible in the real immutable DB, but the hash should be unaffected)
    repo.rows[0] = { ...repo.rows[0], mandateId: MANDATE_B };

    const verifier = new AuditVerifier(makeKeyring(), repo as never);
    const result = await verifier.verifyChain();
    // Still ok — mandateId is hash-excluded by design
    expect(result).toEqual({ ok: true, entriesChecked: 1 });
  });
});
