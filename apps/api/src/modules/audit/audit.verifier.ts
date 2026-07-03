/**
 * AuditVerifier (wave-4, task e6a4cbfe) — stateless chain-integrity verifier.
 *
 * Walk audit_log_entries in sequence_number ASC and, for each entry:
 *   1. recompute entry_hash (key selected by THAT entry's chain_version —
 *      rotation-safe) and compare to the stored entry_hash → CONTENT-TAMPER
 *      detection (reason: content-hash-mismatch);
 *   2. assert prev_hash == the prior entry's stored entry_hash (genesis: assert
 *      == GENESIS_PREV_HASH) → LINK-BREAK detection (reason: prev-hash-mismatch);
 *   3. assert sequence_number is contiguous (prior + 1; genesis == 1) →
 *      DELETION/GAP detection (reason: sequence-gap).
 * Returns at the FIRST break with { ok:false, entriesChecked, firstBreakAt, reason }.
 * Empty log → { ok:true, entriesChecked:0 } (vacuously intact).
 *
 * ── Why stateless walk-and-recompute (not a cached "verified" flag) ────────
 * A cached verification flag would itself be mutable and the first thing an
 * attacker flips. The verifier derives its verdict PURELY from the immutable
 * rows + the env key(s). Cost O(n); on-demand for MVP.
 *
 * ── ACCEPTED THREAT BOUNDARY (per Karen) ───────────────────────────────────
 * TAIL TRUNCATION — deleting the newest N entries with NO successor — is NOT
 * detectable by a self-contained walk: with the tail removed, the remaining
 * chain is internally consistent (each surviving link + hash + contiguous
 * sequence still checks out) and there is no anchor recording "the chain should
 * be longer". We do NOT claim to detect it; a future external high-water-mark
 * (e.g. a signed periodic checkpoint of max(sequence_number)) would be required.
 * Mid-chain deletion IS detected (it breaks contiguity — sequence-gap — and/or
 * the prev_hash link of the successor).
 */

import type { AuditVerifyResponse } from '@dealflow/shared';
import { GENESIS_PREV_HASH } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';

import { computeEntryHash, type HashableEntryFields } from './audit.hash';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditKeyring } from './audit.keyring';
import type { StoredAuditEntry } from './audit.repository';
// biome-ignore lint/style/useImportType: DI-injected, needs runtime metadata (emitDecoratorMetadata)
import { AuditRepository } from './audit.repository';

@Injectable()
export class AuditVerifier {
  constructor(
    private readonly keyring: AuditKeyring,
    private readonly repository: AuditRepository
  ) {}

  async verifyChain(): Promise<AuditVerifyResponse> {
    const entries = await this.repository.readChainAscending();
    return this.verifyEntries(entries);
  }

  /**
   * Pure verification over an in-memory ordered list. Extracted from I/O so it
   * is directly unit-testable with fixtures (intact / tampered / gapped).
   * Assumes `entries` is already sorted by sequence_number ASC (the repository
   * ORDER BY guarantees this).
   */
  verifyEntries(entries: StoredAuditEntry[]): AuditVerifyResponse {
    if (entries.length === 0) {
      return { ok: true, entriesChecked: 0 };
    }

    let expectedSequence = 1;
    let expectedPrevHash: string = GENESIS_PREV_HASH;
    let checked = 0;

    for (const entry of entries) {
      checked += 1;

      // (3) Contiguity — deletion/gap detection. Checked FIRST so a gap is
      // reported as sequence-gap at the offending sequence_number (a mid-chain
      // deletion surfaces here on the successor's sequence). We report the
      // EXPECTED-but-missing sequence_number as the break point.
      if (entry.sequenceNumber !== expectedSequence) {
        return {
          ok: false,
          entriesChecked: checked,
          firstBreakAt: expectedSequence,
          reason: 'sequence-gap',
        };
      }

      // (2) Link — prev_hash must equal the prior entry's stored entry_hash
      // (genesis: GENESIS_PREV_HASH). Detects a re-chained / relinked row.
      if (entry.prevHash !== expectedPrevHash) {
        return {
          ok: false,
          entriesChecked: checked,
          firstBreakAt: entry.sequenceNumber,
          reason: 'prev-hash-mismatch',
        };
      }

      // (1) Content — recompute the HMAC (key by THIS entry's chain_version) and
      // compare. Any mutated field (content_hash, payload_hash, actor, action,
      // resource, created_at, sequence_number, chain_version) changes the hash.
      const key = this.keyring.keyFor(entry.chainVersion);
      const hashable: HashableEntryFields = {
        sequenceNumber: entry.sequenceNumber,
        actorUserId: entry.actorUserId,
        actorRole: entry.actorRole,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        contentHash: entry.contentHash,
        payloadHash: entry.payloadHash,
        chainVersion: entry.chainVersion,
        createdAt: entry.createdAt,
      };
      const recomputed = computeEntryHash(hashable, entry.prevHash, key);
      if (recomputed !== entry.entryHash) {
        return {
          ok: false,
          entriesChecked: checked,
          firstBreakAt: entry.sequenceNumber,
          reason: 'content-hash-mismatch',
        };
      }

      // Advance the expectations for the next iteration.
      expectedSequence = entry.sequenceNumber + 1;
      expectedPrevHash = entry.entryHash;
    }

    return { ok: true, entriesChecked: checked };
  }
}
