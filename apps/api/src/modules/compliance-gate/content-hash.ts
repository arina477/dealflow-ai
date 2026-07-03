/**
 * content-hash.ts (wave-5, task 034463b1) — deterministic content-binding hash
 * for the compliance gate's approval-version binding.
 *
 * WHAT THIS IS (and is NOT):
 *   This is a KEYLESS SHA-256 over a canonicalized content string. It is an
 *   equality-binding primitive: "same content ⇒ same hash", so an approval that
 *   stored the hash of the approved version can be compared against the hash of
 *   the version being sent. A post-approval edit changes the hash → the gate
 *   re-blocks (content-hash-mismatch). See security.md §Approval-workflow:
 *   "the gate compares a content hash of the approved version against the version
 *   being sent."
 *
 *   It is DELIBERATELY NOT the audit HMAC (audit.hash.ts). The audit chain uses a
 *   KEYED HMAC-SHA256 (audit.keyring) because its job is tamper-EVIDENCE of the
 *   decision chain against a key-less forger. Content binding needs only
 *   deterministic equality, not unforgeability — a keyless SHA-256 is the correct
 *   primitive, and it must match whatever hash the approval-creation path stored
 *   (which is also a keyless content hash). Mixing the audit key in here would
 *   couple content binding to key rotation and break equality across a rotation.
 *
 * CANONICALIZATION DISCIPLINE (reused from audit.hash.ts):
 *   The audit hash's load-bearing lesson is that two byte-representations of the
 *   "same" logical value must be funnelled to ONE canonical form before hashing,
 *   or the recompute preimage drifts. For free-text outreach content the drift
 *   vectors are line-ending style (CRLF vs LF), a trailing newline, and
 *   surrounding whitespace. We normalize all three deterministically so the
 *   approval-time hash and the gate-recompute hash are byte-identical for
 *   logically-identical content. This mirrors the audit module's
 *   normalizeCreatedAt() discipline (collapse equivalent representations to one
 *   canonical string BEFORE the digest), applied to content instead of timestamps.
 *
 *   IMPORTANT: the approval-creation path (M6+, not built this wave) MUST hash via
 *   this SAME function so the stored content_hash and the gate recompute agree.
 *   The shared GateContext.contentHash the caller precomputes is likewise expected
 *   to be this canonical hash; the gate does NOT trust it for the binding check —
 *   it RECOMPUTES from ctx.content here and compares to the stored approval hash.
 */

import { createHash } from 'node:crypto';

/**
 * Canonicalize outreach content to a single deterministic form before hashing.
 *
 * Rules (v1 — pinned; changing these changes every hash and would break existing
 * approvals, exactly like the audit v1 serialization is pinned):
 *   1. Normalize line endings CRLF (`\r\n`) and lone CR (`\r`) → LF (`\n`).
 *   2. Strip a single trailing newline (so "body" and "body\n" bind identically).
 *   3. Trim leading/trailing whitespace.
 *
 * Interior whitespace is preserved verbatim — it is semantically part of the
 * message. We deliberately do NOT collapse interior runs (that would let a
 * meaningful edit slip past the binding).
 */
export function canonicalizeContent(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/, '').trim();
}

/**
 * Compute the keyless SHA-256 content hash (64 lowercase hex chars) over the
 * canonicalized content. Deterministic: identical logical content ⇒ identical
 * hash, regardless of line-ending or trailing-whitespace representation.
 */
export function computeContentHash(content: string): string {
  return createHash('sha256').update(canonicalizeContent(content), 'utf8').digest('hex');
}
