/**
 * audit.hash.ts (wave-4, task a8b2b5a2) — pure crypto core for the hash-chain.
 *
 * No I/O. No key storage. No env reads. This module is deterministic given
 * (fields, prevHash, key) — which is exactly what the golden-vector test pins.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CANONICAL SERIALIZATION — FIELD-SET + ORDER ARE PINNED BY chain_version.
 *
 * chain_version is DUAL-PURPOSE (P-4 remediation item-1): it pins BOTH
 *   (a) the HMAC key version (which key signs/verifies — see audit.keyring.ts), AND
 *   (b) THIS canonical-serialization field-set and field ORDER (this file).
 *
 * Any change to EITHER — rotating the key OR altering the fields/order/encoding
 * below — MUST bump chain_version (CURRENT_CHAIN_VERSION in audit.keyring.ts) and
 * add a new branch here keyed on the version. NEVER edit the v1 serialization in
 * place: doing so would make every previously-stored entry_hash unverifiable
 * (the verifier recomputes with this exact byte layout). The golden-vector test
 * (audit.hash.spec.ts) fails on any accidental change to the v1 byte layout.
 *
 * The serialized byte layout (v1):
 *   Each field is emitted as  <label> "=" <value> "\n"  in the FIXED order below,
 *   then the chain link  "prev_hash=" <prevHash> "\n"  is appended LAST.
 *   - Field labels are literal and length-delimited by "=" and "\n", so no two
 *     distinct field tuples can serialize to the same byte string (no ambiguity
 *     from a value that happens to contain "=" — the label prefix disambiguates,
 *     and newlines in hash/id values are not possible for our hex/uuid inputs;
 *     free-text values are hashed upstream into content_hash/payload_hash, never
 *     serialized raw here).
 *   - NULLs are emitted as the explicit sentinel token "\x00null" (a value no
 *     legitimate hex/uuid/text field can produce), so null and the literal
 *     string "null" are distinguishable — explicit null handling.
 *   - sequence_number and chain_version are emitted as base-10 integer strings.
 *   - created_at is NORMALIZED to a canonical millisecond ISO-8601 UTC string
 *     (`YYYY-MM-DDTHH:mm:ss.sssZ`) via `normalizeCreatedAt()` BEFORE hashing.
 *     This is load-bearing: the append path hashes a JS `new Date().toISOString()`
 *     value, but Postgres stores it in `timestamptz` and Drizzle `mode:'string'`
 *     reads it back as pg WIRE TEXT — a DIFFERENT representation of the SAME
 *     instant (space separator, `+00` offset instead of `Z`, and MICROSECOND
 *     precision, e.g. `2026-07-03 12:34:56.789000+00`). Serializing verbatim would
 *     make the verifier's recompute preimage differ byte-for-byte from the append
 *     preimage → HMAC mismatch on EVERY live chain. Normalizing both sides through
 *     the same `new Date(...).toISOString()` funnel collapses every equivalent
 *     representation to one canonical instant string, so append-bytes == verify-bytes
 *     regardless of pg's storage/read-back format. Millisecond truncation is the
 *     canonical precision (the append value is already ms-precision, and pg's
 *     trailing `000` sub-ms washes out under Date parsing).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createHmac } from 'node:crypto';

/** The fields (already-computed hashes + metadata) that feed the entry hash. */
export interface HashableEntryFields {
  sequenceNumber: number;
  actorUserId: string | null;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  contentHash: string;
  payloadHash: string;
  chainVersion: number;
  /** The stored timestamptz string (mode:'string' from Drizzle). */
  createdAt: string;
}

/** Explicit-null sentinel — a byte no hex/uuid/text field can legitimately emit. */
const NULL_SENTINEL = '\x00null';

/** Encode a nullable string value with explicit null handling. */
function enc(value: string | null): string {
  return value === null ? NULL_SENTINEL : value;
}

/**
 * Normalize a created_at value to the canonical millisecond ISO-8601 UTC string.
 *
 * The INVARIANT this guarantees: the append path (which hands us a JS
 * `new Date().toISOString()`, e.g. `2026-07-03T12:34:56.789Z`) and the verify
 * path (which hands us the pg `timestamptz` wire-text read-back via Drizzle
 * `mode:'string'`, e.g. `2026-07-03 12:34:56.789000+00`) BOTH funnel through
 * `new Date(input).toISOString()` here — so both emit the IDENTICAL canonical
 * string for the same stored instant, and thus the identical hash preimage.
 *
 * `new Date(...)` parses both the ISO `T…Z` form and the pg space/`+00` form to
 * the same epoch-ms instant (Node's Date parser accepts both), and
 * `.toISOString()` always emits exactly millisecond precision with a `Z` suffix,
 * truncating pg's microsecond `.789000` to `.789`. Verified deterministic in Node.
 *
 * Throws on an unparseable value (NaN) rather than silently hashing `Invalid Date`.
 */
function normalizeCreatedAt(createdAt: string): string {
  const ms = Date.parse(createdAt);
  if (Number.isNaN(ms)) {
    throw new Error(`canonicalSerialization: unparseable created_at value: "${createdAt}"`);
  }
  return new Date(ms).toISOString();
}

/**
 * Build the canonical, versioned byte string for an entry.
 *
 * The field ORDER below is the load-bearing v1 contract. See the file header.
 * `prev_hash` is appended LAST to make the chain-link explicit in the layout.
 */
export function canonicalSerialization(fields: HashableEntryFields, prevHash: string): string {
  if (fields.chainVersion !== 1) {
    // Only v1 serialization exists today. A new version adds a branch here and
    // bumps CURRENT_CHAIN_VERSION — never mutate the v1 layout in place.
    throw new Error(
      `canonicalSerialization: unsupported chain_version=${fields.chainVersion}. ` +
        'Add a versioned serialization branch before bumping CURRENT_CHAIN_VERSION.'
    );
  }

  // v1 — FIXED field order. Do not reorder / relabel / re-encode in place.
  return (
    `sequence_number=${fields.sequenceNumber.toString(10)}\n` +
    `actor_user_id=${enc(fields.actorUserId)}\n` +
    `actor_role=${fields.actorRole}\n` +
    `action=${fields.action}\n` +
    `resource_type=${fields.resourceType}\n` +
    `resource_id=${enc(fields.resourceId)}\n` +
    `content_hash=${fields.contentHash}\n` +
    `payload_hash=${fields.payloadHash}\n` +
    `chain_version=${fields.chainVersion.toString(10)}\n` +
    // NORMALIZED — collapses pg wire-text and app-ISO to one canonical instant
    // string so append-bytes == verify-bytes. See normalizeCreatedAt() + header.
    `created_at=${normalizeCreatedAt(fields.createdAt)}\n` +
    `prev_hash=${prevHash}\n`
  );
}

/**
 * entry_hash = HMAC-SHA256(key, canonicalSerialization(fields, prevHash)),
 * hex-encoded (64 lowercase hex chars — matches GENESIS_PREV_HASH width).
 *
 * Keyed HMAC (NOT a bare SHA-256): an attacker without the key cannot forge a
 * valid continuation, which is what makes the chain tamper-EVIDENT to any
 * verifier holding the key.
 */
export function computeEntryHash(
  fields: HashableEntryFields,
  prevHash: string,
  key: string
): string {
  return createHmac('sha256', key)
    .update(canonicalSerialization(fields, prevHash), 'utf8')
    .digest('hex');
}
