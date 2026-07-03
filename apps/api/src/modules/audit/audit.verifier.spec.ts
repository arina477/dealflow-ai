/**
 * T-8 unit — AuditVerifier detection (task e6a4cbfe).
 *
 * Builds a REAL valid chain (real keyring + real hash) then tampers the stored
 * fixture along each threat axis and asserts the verifier reports the break at
 * the right sequence_number with the right reason:
 *   - intact chain        → ok:true
 *   - content-tamper      → ok:false, reason content-hash-mismatch (mutate a row's
 *                           content_hash directly — the privileged/bypass path the
 *                           DB trigger blocks in prod; here we edit the fixture)
 *   - prev-link-break     → ok:false, reason prev-hash-mismatch
 *   - sequence-gap        → ok:false, reason sequence-gap (delete a middle entry)
 *   - empty log           → ok:true, entriesChecked:0
 *
 * NOTE: no tail-truncation test — deleting the newest-N with no successor is the
 * ACCEPTED, documented threat boundary (a self-contained walk cannot detect it).
 */

import type { AuditEntryInput } from '@dealflow/shared';
import { describe, expect, it, vi } from 'vitest';

import { AuditKeyring } from './audit.keyring';
import type { StoredAuditEntry, Tx } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditVerifier } from './audit.verifier';

const KEY = 'verifier-test-key';
const keyring = () =>
  new AuditKeyring({ AUDIT_LOG_HMAC_KEY: KEY, AUDIT_LOG_HMAC_KEY_VERSION: '1' });

class FakeRepo {
  rows: StoredAuditEntry[] = [];
  acquireChainLock = vi.fn(async (_tx: Tx) => {});
  readTail = vi.fn(async (_tx: Tx) => {
    if (this.rows.length === 0) return null;
    const t = this.rows[this.rows.length - 1];
    return { sequenceNumber: t.sequenceNumber, entryHash: t.entryHash };
  });
  insertEntry = vi.fn(async (_tx: Tx, e: StoredAuditEntry) => {
    this.rows.push(e);
    return e;
  });
  readChainAscending = vi.fn(async () =>
    [...this.rows].sort((a, b) => a.sequenceNumber - b.sequenceNumber)
  );
}

function input(n: number): AuditEntryInput {
  return {
    actorUserId: null,
    actorRole: 'compliance',
    action: 'verify-chain',
    resourceType: 'audit-log',
    resourceId: `res-${n}`,
    contentHash: String(n).padEnd(64, '0'),
    payloadHash: String(n).padEnd(64, '1'),
  };
}

/** Build a valid N-entry chain and return the (mutable) fixture rows. */
async function buildChain(n: number): Promise<StoredAuditEntry[]> {
  const repo = new FakeRepo();
  const svc = new AuditService(keyring(), repo as unknown as never);
  for (let i = 1; i <= n; i += 1) await svc.append(input(i), {} as Tx);
  return repo.rows;
}

/** A verifier over a fixed in-memory fixture. */
function verifierOver(rows: StoredAuditEntry[]): AuditVerifier {
  const repo = { readChainAscending: vi.fn(async () => rows) };
  return new AuditVerifier(keyring(), repo as unknown as never);
}

describe('AuditVerifier — intact chain', () => {
  it('a valid chain returns ok:true with the full count', async () => {
    const rows = await buildChain(4);
    const result = await verifierOver(rows).verifyChain();
    expect(result).toEqual({ ok: true, entriesChecked: 4 });
  });

  it('empty log → ok:true, entriesChecked:0 (vacuously intact)', async () => {
    const result = await verifierOver([]).verifyChain();
    expect(result).toEqual({ ok: true, entriesChecked: 0 });
  });
});

describe('AuditVerifier — content tampering', () => {
  it('mutating a row content_hash → ok:false content-hash-mismatch at that sequence', async () => {
    const rows = await buildChain(4);
    // Bypass path: directly edit the stored content_hash (the DB trigger blocks
    // this in prod; the verifier must catch it if a privileged actor did it).
    rows[2] = { ...rows[2], contentHash: 'tampered'.padEnd(64, '0') };

    const result = await verifierOver(rows).verifyChain();
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toBe(3);
    expect(result.reason).toBe('content-hash-mismatch');
    expect(result.entriesChecked).toBe(3);
  });

  it('mutating actor_role also trips content-hash-mismatch', async () => {
    const rows = await buildChain(3);
    rows[1] = { ...rows[1], actorRole: 'admin' };
    const result = await verifierOver(rows).verifyChain();
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toBe(2);
    expect(result.reason).toBe('content-hash-mismatch');
  });
});

describe('AuditVerifier — prev-link break', () => {
  it('corrupting a row prev_hash → ok:false prev-hash-mismatch', async () => {
    const rows = await buildChain(4);
    rows[2] = { ...rows[2], prevHash: 'f'.repeat(64) };
    const result = await verifierOver(rows).verifyChain();
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toBe(3);
    expect(result.reason).toBe('prev-hash-mismatch');
  });

  it('a genesis entry with a non-genesis prev_hash → prev-hash-mismatch at 1', async () => {
    const rows = await buildChain(2);
    rows[0] = { ...rows[0], prevHash: 'a'.repeat(64) };
    const result = await verifierOver(rows).verifyChain();
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toBe(1);
    expect(result.reason).toBe('prev-hash-mismatch');
  });
});

describe('AuditVerifier — sequence gap (deletion)', () => {
  it('deleting a middle entry → ok:false sequence-gap at the missing sequence', async () => {
    const rows = await buildChain(5);
    // Remove sequence_number=3 (the mid-chain deletion a privileged DELETE would
    // do — the DB trigger blocks it in prod; the verifier detects it here).
    const gapped = rows.filter((r) => r.sequenceNumber !== 3);
    const result = await verifierOver(gapped).verifyChain();
    expect(result.ok).toBe(false);
    // After entry 2, the verifier expects sequence 3 but sees 4 → gap at 3.
    expect(result.firstBreakAt).toBe(3);
    expect(result.reason).toBe('sequence-gap');
  });

  it('a missing genesis (chain starts at 2) → sequence-gap at 1', async () => {
    const rows = await buildChain(3);
    const gapped = rows.filter((r) => r.sequenceNumber !== 1);
    const result = await verifierOver(gapped).verifyChain();
    expect(result.ok).toBe(false);
    expect(result.firstBreakAt).toBe(1);
    expect(result.reason).toBe('sequence-gap');
  });
});
