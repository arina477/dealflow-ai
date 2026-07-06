/**
 * credential-crypto.ts — AES-256-GCM envelope encryption for admin-entered
 * data-source credentials (wave-15, task 41c017f7).
 *
 * ── Security invariants (P-4 load-bearing) ──────────────────────────────────
 * 1. Random IV per encryption: crypto.randomBytes(12), NEVER reused.
 * 2. Auth-tag stored AND verified on decrypt (GCM tag is 16 bytes, base64-encoded).
 * 3. Key-id/version prefix on stored ciphertext (reserves future rotation).
 * 4. Key sourced from process.env.CREDENTIALS_ENC_KEY (base64 32 bytes).
 *    Fail-closed at module init if missing/wrong-length.
 * 5. Plaintext NEVER appears in error messages or logs. The encrypt() caller MUST
 *    redact the plaintext from any error path (see DataSourceAdminService).
 *
 * Stored format: `v1:<base64-iv>:<base64-tag>:<base64-ciphertext>`
 *   - 'v1' = key-id prefix (single current version; rotation increments this)
 *   - iv  = 12-byte random nonce, base64-encoded
 *   - tag = 16-byte GCM authentication tag, base64-encoded
 *   - ciphertext = encrypted payload, base64-encoded
 *
 * MVP documented limitation:
 *   Loss of CREDENTIALS_ENC_KEY = permanent loss of all stored credentials.
 *   Single-key scheme = no rotation without re-encrypting all stored values.
 *   The 'v1' prefix reserves the rotation path for a future multi-key rotation.
 *
 * Algorithm: AES-256-GCM (Node.js built-in crypto — no external SDK).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY_ID = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** Load and validate the encryption key from env. Exported for testability. */
export function loadEncKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.CREDENTIALS_ENC_KEY;
  if (!raw) {
    throw new Error(
      'CREDENTIALS_ENC_KEY is not set. This env var is required for admin credential encryption. ' +
        'Generate with: openssl rand -base64 32'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(
      `CREDENTIALS_ENC_KEY must decode to exactly 32 bytes (AES-256 key); got ${key.length} bytes. ` +
        'Regenerate with: openssl rand -base64 32'
    );
  }
  return key;
}

/**
 * Encrypt `plaintext` with AES-256-GCM.
 *
 * Returns an opaque storable string in the format:
 *   `v1:<base64-iv>:<base64-tag>:<base64-ciphertext>`
 *
 * Callers MUST NOT include the plaintext in any log or error message after
 * calling this function — the string should be treated as ephemeral input that
 * is immediately discarded once the ciphertext is stored.
 *
 * @throws if CREDENTIALS_ENC_KEY is missing or wrong-length (fail-closed).
 */
export function encryptCredential(plaintext: string): string {
  const key = loadEncKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ctBuf = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${KEY_ID}:${iv.toString('base64')}:${tag.toString('base64')}:${ctBuf.toString('base64')}`;
}

/**
 * Decrypt a stored credential envelope. Verifies the GCM auth tag before
 * returning the plaintext — any tampering (ciphertext, tag, iv, or key-id
 * mismatch) causes Node.js GCM to throw (fail-closed, no partial plaintext).
 *
 * @param stored - The `v1:iv:tag:ciphertext` string from the DB column.
 * @returns Plaintext credential string.
 * @throws if the format is wrong, the key-id is unknown, or tag verification fails.
 */
export function decryptCredential(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 4) {
    throw new Error(`Malformed encrypted credential: expected 4 colon-delimited parts`);
  }
  const [keyId, ivB64, tagB64, ctB64] = parts as [string, string, string, string];

  if (keyId !== KEY_ID) {
    throw new Error(`Unknown credential key-id: ${keyId}. Only 'v1' is supported.`);
  }

  const key = loadEncKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');

  if (iv.length !== IV_BYTES) {
    throw new Error(`Invalid IV length: expected ${IV_BYTES}, got ${iv.length}`);
  }
  if (tag.length !== TAG_BYTES) {
    throw new Error(`Invalid tag length: expected ${TAG_BYTES}, got ${tag.length}`);
  }

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  // GCM auth tag verification happens here — throws `Unsupported state or
  // unable to authenticate data` on tamper or wrong key.
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
