/**
 * T-8 unit — AuditKeyring boot fail-fast + key isolation (task a8b2b5a2).
 *
 * Security invariants asserted:
 *   - missing/empty AUDIT_LOG_HMAC_KEY → constructor THROWS (no unsigned entry
 *     is ever writable because AuditService depends on the keyring);
 *   - keyFor(currentVersion) returns the configured key;
 *   - keyFor(unknownVersion) throws (an entry referencing an unheld key version
 *     is unverifiable, not a silent pass);
 *   - the key is NEVER exposed via toString/JSON/enumeration.
 */

import { describe, expect, it } from 'vitest';

import { AuditKeyring, CURRENT_CHAIN_VERSION } from './audit.keyring';

describe('AuditKeyring — boot fail-fast', () => {
  it('throws when AUDIT_LOG_HMAC_KEY is missing', () => {
    expect(() => new AuditKeyring({})).toThrow(/AUDIT_LOG_HMAC_KEY/);
  });

  it('throws when AUDIT_LOG_HMAC_KEY is empty', () => {
    expect(() => new AuditKeyring({ AUDIT_LOG_HMAC_KEY: '' })).toThrow(/AUDIT_LOG_HMAC_KEY/);
  });

  it('constructs when the key is present', () => {
    const kr = new AuditKeyring({ AUDIT_LOG_HMAC_KEY: 'a-real-key' });
    expect(kr.currentVersion).toBe(1);
  });

  it('defaults chain_version to 1 (= CURRENT_CHAIN_VERSION) when VERSION unset', () => {
    const kr = new AuditKeyring({ AUDIT_LOG_HMAC_KEY: 'k' });
    expect(kr.currentVersion).toBe(CURRENT_CHAIN_VERSION);
  });

  it('honours an explicit AUDIT_LOG_HMAC_KEY_VERSION', () => {
    const kr = new AuditKeyring({ AUDIT_LOG_HMAC_KEY: 'k', AUDIT_LOG_HMAC_KEY_VERSION: '3' });
    expect(kr.currentVersion).toBe(3);
  });
});

describe('AuditKeyring — key selection', () => {
  it('keyFor(currentVersion) returns the configured key', () => {
    const kr = new AuditKeyring({ AUDIT_LOG_HMAC_KEY: 'my-key', AUDIT_LOG_HMAC_KEY_VERSION: '1' });
    expect(kr.keyFor(1)).toBe('my-key');
  });

  it('keyFor(unknownVersion) throws (unheld key version is unverifiable)', () => {
    const kr = new AuditKeyring({ AUDIT_LOG_HMAC_KEY: 'my-key' });
    expect(() => kr.keyFor(99)).toThrow(/no HMAC key configured for chain_version=99/);
  });
});

describe('AuditKeyring — key isolation', () => {
  it('does not leak the key via toString / JSON serialization', () => {
    const secret = 'super-secret-hmac-key-value';
    const kr = new AuditKeyring({ AUDIT_LOG_HMAC_KEY: secret });
    expect(String(kr)).not.toContain(secret);
    expect(JSON.stringify(kr)).not.toContain(secret);
    // Private #field is not enumerable on the instance.
    expect(Object.keys(kr)).not.toContain('#keysByVersion');
    expect(Object.values(kr).join(' ')).not.toContain(secret);
  });
});
