import { describe, expect, it } from 'vitest';
import {
  auditActionEnum,
  auditBreakReasonEnum,
  auditEntryInputSchema,
  auditLogEntrySchema,
  auditVerifyResponseSchema,
  GENESIS_PREV_HASH,
} from './audit';

// ---------------------------------------------------------------------------
// GENESIS_PREV_HASH
// ---------------------------------------------------------------------------

describe('GENESIS_PREV_HASH', () => {
  it('is 64 hex-zero characters (matches SHA-256 hex output width)', () => {
    expect(GENESIS_PREV_HASH).toBe('0'.repeat(64));
    expect(GENESIS_PREV_HASH).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// auditActionEnum
// ---------------------------------------------------------------------------

describe('auditActionEnum', () => {
  it('accepts all wave-4 action values (existing — must remain stable)', () => {
    expect(auditActionEnum.parse('verify-chain')).toBe('verify-chain');
    expect(auditActionEnum.parse('compose')).toBe('compose');
    expect(auditActionEnum.parse('approve')).toBe('approve');
    expect(auditActionEnum.parse('send')).toBe('send');
    expect(auditActionEnum.parse('suppress')).toBe('suppress');
  });

  it('accepts all wave-5 compliance action values (additive extension)', () => {
    expect(auditActionEnum.parse('gate-evaluate')).toBe('gate-evaluate');
    expect(auditActionEnum.parse('rule-change')).toBe('rule-change');
    expect(auditActionEnum.parse('suppression-change')).toBe('suppression-change');
    expect(auditActionEnum.parse('disclaimer-change')).toBe('disclaimer-change');
  });

  it('accepts wave-6 sourcing-dedupe-resolve action (additive extension)', () => {
    expect(auditActionEnum.parse('sourcing-dedupe-resolve')).toBe('sourcing-dedupe-resolve');
  });

  it('rejects unknown action values', () => {
    expect(() => auditActionEnum.parse('unknown-action')).toThrow();
    expect(() => auditActionEnum.parse('')).toThrow();
    expect(() => auditActionEnum.parse(42)).toThrow();
  });

  it('wave-4 actions appear before wave-5 actions in the enum options (serialization order stable)', () => {
    // The enum options array reflects the declaration order.
    // wave-4 values must precede wave-5 values so existing chain_version
    // serialization that depends on ordinal position is not disturbed.
    const options = auditActionEnum.options;
    const wave4 = ['verify-chain', 'compose', 'approve', 'send', 'suppress'];
    const wave5 = ['gate-evaluate', 'rule-change', 'suppression-change', 'disclaimer-change'];
    const lastWave4Idx = Math.max(...wave4.map((v) => options.indexOf(v)));
    const firstWave5Idx = Math.min(...wave5.map((v) => options.indexOf(v)));
    expect(lastWave4Idx).toBeLessThan(firstWave5Idx);
  });

  it('wave-5 actions appear before wave-6 sourcing-dedupe-resolve (serialization order stable)', () => {
    // Wave-6 value appended after all wave-5 values — existing ordinal positions unchanged.
    const options = auditActionEnum.options;
    const wave5 = ['gate-evaluate', 'rule-change', 'suppression-change', 'disclaimer-change'];
    const lastWave5Idx = Math.max(...wave5.map((v) => options.indexOf(v)));
    const wave6Idx = options.indexOf('sourcing-dedupe-resolve');
    expect(wave6Idx).toBeGreaterThan(-1);
    expect(lastWave5Idx).toBeLessThan(wave6Idx);
  });

  it('existing wave-4 action string values are unchanged (no rename)', () => {
    // Exhaustive check: each wave-4 action must parse to the SAME string.
    // A rename would change the serialized value in the audit log — forbidden.
    const wave4Actions = [
      ['verify-chain', 'verify-chain'],
      ['compose', 'compose'],
      ['approve', 'approve'],
      ['send', 'send'],
      ['suppress', 'suppress'],
    ] as const;
    for (const [input, expected] of wave4Actions) {
      expect(auditActionEnum.parse(input)).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// auditBreakReasonEnum
// ---------------------------------------------------------------------------

describe('auditBreakReasonEnum', () => {
  it('accepts all three reason values', () => {
    expect(auditBreakReasonEnum.parse('content-hash-mismatch')).toBe('content-hash-mismatch');
    expect(auditBreakReasonEnum.parse('prev-hash-mismatch')).toBe('prev-hash-mismatch');
    expect(auditBreakReasonEnum.parse('sequence-gap')).toBe('sequence-gap');
  });

  it('rejects unknown reason values', () => {
    expect(() => auditBreakReasonEnum.parse('unknown')).toThrow();
    expect(() => auditBreakReasonEnum.parse('')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// auditEntryInputSchema — append input (caller-supplied fields before hashing)
// ---------------------------------------------------------------------------

const validEntryInput = {
  actorUserId: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  actorRole: 'compliance',
  action: 'verify-chain' as const,
  resourceType: 'audit-log',
  resourceId: null,
  contentHash: 'a'.repeat(64),
  payloadHash: 'b'.repeat(64),
};

describe('auditEntryInputSchema', () => {
  it('parses a valid entry input with a UUID actor', () => {
    const result = auditEntryInputSchema.parse(validEntryInput);
    expect(result.actorUserId).toBe('1931b452-c7d5-43a0-9657-7e7cd1728203');
    expect(result.action).toBe('verify-chain');
    expect(result.contentHash).toHaveLength(64);
    expect(result.payloadHash).toHaveLength(64);
  });

  it('accepts null actorUserId (system / genesis events)', () => {
    const result = auditEntryInputSchema.parse({ ...validEntryInput, actorUserId: null });
    expect(result.actorUserId).toBeNull();
  });

  it('accepts null resourceId (non-object events)', () => {
    const result = auditEntryInputSchema.parse({ ...validEntryInput, resourceId: null });
    expect(result.resourceId).toBeNull();
  });

  it('accepts a string resourceId', () => {
    const result = auditEntryInputSchema.parse({
      ...validEntryInput,
      resourceId: 'mandate-123',
    });
    expect(result.resourceId).toBe('mandate-123');
  });

  it('rejects a non-UUID actorUserId', () => {
    expect(() =>
      auditEntryInputSchema.parse({ ...validEntryInput, actorUserId: 'not-a-uuid' })
    ).toThrow();
  });

  it('rejects empty actorRole', () => {
    expect(() => auditEntryInputSchema.parse({ ...validEntryInput, actorRole: '' })).toThrow();
  });

  it('rejects empty contentHash', () => {
    expect(() => auditEntryInputSchema.parse({ ...validEntryInput, contentHash: '' })).toThrow();
  });

  it('rejects empty payloadHash', () => {
    expect(() => auditEntryInputSchema.parse({ ...validEntryInput, payloadHash: '' })).toThrow();
  });

  it('accepts sourcing-dedupe-resolve as action (wave-6 extension)', () => {
    const result = auditEntryInputSchema.parse({
      ...validEntryInput,
      action: 'sourcing-dedupe-resolve',
    });
    expect(result.action).toBe('sourcing-dedupe-resolve');
  });

  it('rejects an unknown action', () => {
    expect(() => auditEntryInputSchema.parse({ ...validEntryInput, action: 'unknown' })).toThrow();
  });

  it('rejects unknown extra fields (strict mode)', () => {
    expect(() => auditEntryInputSchema.parse({ ...validEntryInput, extraField: 'oops' })).toThrow();
  });

  it('rejects missing required fields', () => {
    const { action: _action, ...withoutAction } = validEntryInput;
    expect(() => auditEntryInputSchema.parse(withoutAction)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// auditLogEntrySchema — read shape (mirrors DB columns)
// ---------------------------------------------------------------------------

const validEntry = {
  sequenceNumber: 1,
  actorUserId: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  actorRole: 'compliance',
  action: 'verify-chain' as const,
  resourceType: 'audit-log',
  resourceId: null,
  contentHash: 'a'.repeat(64),
  payloadHash: 'b'.repeat(64),
  prevHash: '0'.repeat(64),
  entryHash: 'c'.repeat(64),
  chainVersion: 1,
  createdAt: '2026-07-03T16:00:00.000Z',
};

describe('auditLogEntrySchema', () => {
  it('parses a valid first (genesis) entry', () => {
    const result = auditLogEntrySchema.parse(validEntry);
    expect(result.sequenceNumber).toBe(1);
    expect(result.prevHash).toBe('0'.repeat(64));
    expect(result.chainVersion).toBe(1);
  });

  it('accepts null actorUserId on the read shape', () => {
    const result = auditLogEntrySchema.parse({ ...validEntry, actorUserId: null });
    expect(result.actorUserId).toBeNull();
  });

  it('rejects sequenceNumber <= 0', () => {
    expect(() => auditLogEntrySchema.parse({ ...validEntry, sequenceNumber: 0 })).toThrow();
    expect(() => auditLogEntrySchema.parse({ ...validEntry, sequenceNumber: -1 })).toThrow();
  });

  it('rejects non-integer sequenceNumber', () => {
    expect(() => auditLogEntrySchema.parse({ ...validEntry, sequenceNumber: 1.5 })).toThrow();
  });

  it('rejects invalid createdAt (not datetime)', () => {
    expect(() => auditLogEntrySchema.parse({ ...validEntry, createdAt: 'not-a-date' })).toThrow();
  });

  it('rejects unknown extra fields (strict mode)', () => {
    expect(() => auditLogEntrySchema.parse({ ...validEntry, surprise: 'field' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// auditVerifyResponseSchema — verify endpoint response
// ---------------------------------------------------------------------------

describe('auditVerifyResponseSchema — ok:true cases', () => {
  it('parses an empty-log ok:true response (vacuously intact)', () => {
    const result = auditVerifyResponseSchema.parse({ ok: true, entriesChecked: 0 });
    expect(result.ok).toBe(true);
    expect(result.entriesChecked).toBe(0);
    expect(result.firstBreakAt).toBeUndefined();
    expect(result.reason).toBeUndefined();
  });

  it('parses a non-empty intact chain (ok:true)', () => {
    const result = auditVerifyResponseSchema.parse({ ok: true, entriesChecked: 42 });
    expect(result.ok).toBe(true);
    expect(result.entriesChecked).toBe(42);
  });

  it('accepts optional fields absent on ok:true', () => {
    const result = auditVerifyResponseSchema.parse({ ok: true, entriesChecked: 1 });
    expect('firstBreakAt' in result).toBe(false);
    expect('reason' in result).toBe(false);
  });
});

describe('auditVerifyResponseSchema — ok:false cases', () => {
  it('parses a content-hash-mismatch break', () => {
    const result = auditVerifyResponseSchema.parse({
      ok: false,
      entriesChecked: 5,
      firstBreakAt: 3,
      reason: 'content-hash-mismatch',
    });
    expect(result.ok).toBe(false);
    expect(result.entriesChecked).toBe(5);
    expect(result.firstBreakAt).toBe(3);
    expect(result.reason).toBe('content-hash-mismatch');
  });

  it('parses a prev-hash-mismatch break', () => {
    const result = auditVerifyResponseSchema.parse({
      ok: false,
      entriesChecked: 10,
      firstBreakAt: 7,
      reason: 'prev-hash-mismatch',
    });
    expect(result.reason).toBe('prev-hash-mismatch');
    expect(result.firstBreakAt).toBe(7);
  });

  it('parses a sequence-gap break (deletion detected)', () => {
    const result = auditVerifyResponseSchema.parse({
      ok: false,
      entriesChecked: 8,
      firstBreakAt: 4,
      reason: 'sequence-gap',
    });
    expect(result.reason).toBe('sequence-gap');
    expect(result.firstBreakAt).toBe(4);
  });
});

describe('auditVerifyResponseSchema — rejection cases', () => {
  it('rejects missing ok field', () => {
    expect(() => auditVerifyResponseSchema.parse({ entriesChecked: 0 })).toThrow();
  });

  it('rejects missing entriesChecked field', () => {
    expect(() => auditVerifyResponseSchema.parse({ ok: true })).toThrow();
  });

  it('rejects negative entriesChecked', () => {
    expect(() => auditVerifyResponseSchema.parse({ ok: true, entriesChecked: -1 })).toThrow();
  });

  it('rejects non-integer entriesChecked', () => {
    expect(() => auditVerifyResponseSchema.parse({ ok: true, entriesChecked: 1.5 })).toThrow();
  });

  it('rejects firstBreakAt <= 0', () => {
    expect(() =>
      auditVerifyResponseSchema.parse({
        ok: false,
        entriesChecked: 3,
        firstBreakAt: 0,
        reason: 'sequence-gap',
      })
    ).toThrow();
  });

  it('rejects an unknown reason string', () => {
    expect(() =>
      auditVerifyResponseSchema.parse({
        ok: false,
        entriesChecked: 3,
        firstBreakAt: 2,
        reason: 'bad-reason',
      })
    ).toThrow();
  });

  it('rejects extra unknown fields (strict mode)', () => {
    expect(() =>
      auditVerifyResponseSchema.parse({ ok: true, entriesChecked: 0, extra: 'field' })
    ).toThrow();
  });

  it('rejects non-boolean ok', () => {
    expect(() => auditVerifyResponseSchema.parse({ ok: 'yes', entriesChecked: 0 })).toThrow();
  });
});
