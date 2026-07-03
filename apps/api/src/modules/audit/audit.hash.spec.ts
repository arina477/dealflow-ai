/**
 * T-8 unit — audit.hash canonical serialization + HMAC (task a8b2b5a2).
 *
 * Pins:
 *   - determinism (same input → same hash, every call);
 *   - GOLDEN VECTOR: a fixed (fields, prevHash, key) → a KNOWN hex HMAC. This is
 *     the P-4 item-1 serialization-order-stability guard — any accidental change
 *     to the v1 field-set / order / encoding in audit.hash.ts flips this vector
 *     and fails the suite (which would otherwise silently invalidate every
 *     stored entry_hash);
 *   - explicit null handling (null ≠ the literal string "null");
 *   - field-order sensitivity (swapping two field VALUES changes the hash);
 *   - unsupported chain_version throws (forces a versioned branch on format change).
 */

import { describe, expect, it } from 'vitest';

import { canonicalSerialization, computeEntryHash, type HashableEntryFields } from './audit.hash';

const GOLDEN_KEY = 'golden-vector-fixed-key';
const GENESIS = '0'.repeat(64);

const goldenFields: HashableEntryFields = {
  sequenceNumber: 1,
  actorUserId: null,
  actorRole: 'compliance',
  action: 'verify-chain',
  resourceType: 'audit-log',
  resourceId: null,
  contentHash: 'c'.repeat(64),
  payloadHash: 'p'.repeat(64),
  chainVersion: 1,
  createdAt: '2026-07-03T00:00:00.000Z',
};

// If this constant ever needs to change, it means the v1 canonical serialization
// changed — which MUST be paired with a chain_version bump, NOT an in-place edit.
const GOLDEN_HMAC = '228e6ee140c3dc8193decbe19ef11e4ceeb4a772cf67673f20d3760677ed4e5e';

describe('audit.hash — canonicalSerialization', () => {
  it('is deterministic (same input → same bytes)', () => {
    const a = canonicalSerialization(goldenFields, GENESIS);
    const b = canonicalSerialization(goldenFields, GENESIS);
    expect(a).toBe(b);
  });

  it('emits fields in the pinned v1 order with explicit labels', () => {
    const s = canonicalSerialization(goldenFields, GENESIS);
    const labels = s
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => l.split('=')[0]);
    expect(labels).toEqual([
      'sequence_number',
      'actor_user_id',
      'actor_role',
      'action',
      'resource_type',
      'resource_id',
      'content_hash',
      'payload_hash',
      'chain_version',
      'created_at',
      'prev_hash',
    ]);
  });

  it('distinguishes null from the literal string "null" (explicit null handling)', () => {
    const withNull = canonicalSerialization({ ...goldenFields, resourceId: null }, GENESIS);
    const withLiteral = canonicalSerialization({ ...goldenFields, resourceId: 'null' }, GENESIS);
    expect(withNull).not.toBe(withLiteral);
  });

  it('throws on an unsupported chain_version (forces a versioned branch)', () => {
    expect(() => canonicalSerialization({ ...goldenFields, chainVersion: 2 }, GENESIS)).toThrow(
      /unsupported chain_version/
    );
  });
});

describe('audit.hash — computeEntryHash', () => {
  it('GOLDEN VECTOR: fixed input → known HMAC (serialization-order stability)', () => {
    expect(computeEntryHash(goldenFields, GENESIS, GOLDEN_KEY)).toBe(GOLDEN_HMAC);
  });

  it('is deterministic across calls', () => {
    const h1 = computeEntryHash(goldenFields, GENESIS, GOLDEN_KEY);
    const h2 = computeEntryHash(goldenFields, GENESIS, GOLDEN_KEY);
    expect(h1).toBe(h2);
  });

  it('is KEYED — a different key produces a different hash (not a bare hash)', () => {
    const withKeyA = computeEntryHash(goldenFields, GENESIS, 'key-a');
    const withKeyB = computeEntryHash(goldenFields, GENESIS, 'key-b');
    expect(withKeyA).not.toBe(withKeyB);
  });

  it('changes when ANY covered field changes (tamper sensitivity)', () => {
    const base = computeEntryHash(goldenFields, GENESIS, GOLDEN_KEY);
    const mutations: Partial<HashableEntryFields>[] = [
      { sequenceNumber: 2 },
      { actorUserId: '11111111-1111-1111-1111-111111111111' },
      { actorRole: 'admin' },
      { action: 'send' },
      { resourceType: 'outreach' },
      { resourceId: 'x' },
      { contentHash: 'd'.repeat(64) },
      { payloadHash: 'q'.repeat(64) },
      { createdAt: '2026-07-03T00:00:00.001Z' },
    ];
    for (const m of mutations) {
      expect(computeEntryHash({ ...goldenFields, ...m }, GENESIS, GOLDEN_KEY)).not.toBe(base);
    }
  });

  it('changes when prev_hash changes (chain link is covered)', () => {
    const linked = computeEntryHash(goldenFields, 'a'.repeat(64), GOLDEN_KEY);
    expect(linked).not.toBe(computeEntryHash(goldenFields, GENESIS, GOLDEN_KEY));
  });

  it('produces a 64-char lowercase hex digest (matches GENESIS width)', () => {
    const h = computeEntryHash(goldenFields, GENESIS, GOLDEN_KEY);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
