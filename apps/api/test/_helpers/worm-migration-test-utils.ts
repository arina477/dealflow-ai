/**
 * worm-migration-test-utils.ts — thin helpers for populated-DB migration tests
 * that touch DB-trigger-enforced WORM / hash-chained tables.
 *
 * These are extracted from the AMP suite pattern
 * (apps/api/test/audit-migration-populated-db.e2e-spec.ts) to avoid copy-paste
 * across future migration tests.
 *
 * NOT a framework or DSL. Two small functions. Copy the template at
 * apps/api/test/_helpers/worm-migration-template.ts for new tests.
 *
 * ── WORM POLICY ────────────────────────────────────────────────────────────────
 * See command-center/testing/worm-migration-testing-policy.md for the standing AC.
 * This helper is the thin reusable layer; the template is the copy-able skeleton.
 */

import type { Pool } from 'pg';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SeededAuditEntry {
  sequenceNumber: number;
  entryHash: string;
  prevHash: string;
}

export interface SeedChainedAuditRowsOptions {
  /** The live test DB pool (superuser/migration role). */
  pool: Pool;
  /** The actor user's DB uuid (must exist in users table). */
  actorUserId: string;
  /** Number of chained rows to seed. Minimum 2 to form a chain. Default: 3. */
  count?: number;
  /** Resource id prefix for uniqueness across parallel suites. */
  resourceIdPrefix?: string;
}

export interface AssertVerifyChainOkOptions {
  /** The live test DB pool. */
  pool: Pool;
  /** Sequence numbers of the seeded rows to verify individually (immune to
   *  parallel-suite interleaving — does NOT require global chain contiguity). */
  sequenceNumbers: number[];
  /** The AuditKeyring instance (imported from audit.keyring). */
  keyring: { keyFor: (version: number) => string };
  /** computeEntryHash function (from audit.hash). */
  computeEntryHash: (fields: Record<string, unknown>, prevHash: string, key: string) => string;
}

// ── seedChainedAuditRows ───────────────────────────────────────────────────────

/**
 * Seeds `count` HMAC-chained audit entries via AuditService.appendStandalone
 * (structurally identical to production rows). Returns the sequence numbers and
 * hashes of the seeded rows so the caller can assert on them post-migration.
 *
 * Uses AuditService.appendStandalone — NOT raw SQL — so the seeded rows carry
 * real entry_hash / prev_hash values computed by the production code path.
 *
 * Caller is responsible for setting process.env.DATABASE_URL and
 * process.env.AUDIT_LOG_HMAC_KEY before calling this function.
 *
 * WORM teardown: audit_log_entries is append-only; seeded rows accumulate and are
 * never deleted. Design accordingly (use stable deterministic resource IDs with
 * ON CONFLICT DO NOTHING where idempotency matters).
 */
export async function seedChainedAuditRows(
  // biome-ignore lint/suspicious/noExplicitAny: drizzle handle is untyped in e2e context
  db: any,
  opts: SeedChainedAuditRowsOptions
): Promise<SeededAuditEntry[]> {
  const { actorUserId, count = 3, resourceIdPrefix = `worm-seed-${Date.now()}` } = opts;

  const { AuditKeyring } = await import('../../src/modules/audit/audit.keyring');
  const { AuditRepository } = await import('../../src/modules/audit/audit.repository');
  const { AuditService } = await import('../../src/modules/audit/audit.service');

  const keyring = new AuditKeyring(process.env);
  const auditRepo = new AuditRepository(db);
  const auditSvc = new AuditService(keyring, auditRepo);

  // Deterministic content/payload hashes — distinct per row so the chain is real.
  const h = (n: number) => `${n}`.repeat(64).slice(0, 64);

  const entries: SeededAuditEntry[] = [];
  for (let i = 0; i < count; i++) {
    const entry = await auditSvc.appendStandalone({
      actorUserId,
      actorRole: 'admin',
      action: 'user-invite',
      resourceType: 'invite',
      resourceId: `${resourceIdPrefix}-${i}`,
      contentHash: h(i * 2 + 1),
      payloadHash: h(i * 2 + 2),
    });
    entries.push({
      sequenceNumber: entry.sequenceNumber,
      entryHash: entry.entryHash,
      prevHash: entry.prevHash,
    });
  }
  return entries;
}

// ── assertVerifyChainOkForRows ─────────────────────────────────────────────────

/**
 * Per-row HMAC recompute for the given sequence numbers. Immune to
 * parallel-suite interleaving — does NOT require global chain contiguity.
 *
 * For each sequence number: re-fetches the row, recomputes its entry_hash from
 * the stored fields using computeEntryHash, and asserts the recomputed hash
 * matches the stored entry_hash. This independently proves the hash-exclusion
 * invariant of the column being migrated (e.g. workspace_id after backfill).
 *
 * Returns the fetched rows for additional caller assertions (e.g. checking
 * backfilled column values).
 *
 * IMPORTANT: this function uses dynamic import for computeEntryHash and keyring
 * to match the e2e pattern. The caller must ensure process.env is set up before
 * calling (AUDIT_LOG_HMAC_KEY, AUDIT_LOG_HMAC_KEY_VERSION).
 */
export async function assertVerifyChainOkForRows(
  pool: Pool,
  sequenceNumbers: number[],
  // biome-ignore lint/suspicious/noExplicitAny: generic across caller contexts
  expect: any
): Promise<Array<Record<string, unknown>>> {
  const { computeEntryHash } = await import('../../src/modules/audit/audit.hash');
  const { AuditKeyring } = await import('../../src/modules/audit/audit.keyring');
  const keyring = new AuditKeyring(process.env);

  const seqList = sequenceNumbers.join(', ');
  const rows = await pool.query<{
    sequence_number: number;
    actor_user_id: string | null;
    actor_role: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    content_hash: string;
    payload_hash: string;
    prev_hash: string;
    entry_hash: string;
    chain_version: number;
    created_at: string;
  }>(
    `SELECT
         sequence_number, actor_user_id, actor_role, action,
         resource_type, resource_id, content_hash, payload_hash,
         prev_hash, entry_hash, chain_version, created_at::text
       FROM audit_log_entries
       WHERE sequence_number IN (${seqList})
       ORDER BY sequence_number ASC`
  );

  expect(rows.rows).toHaveLength(sequenceNumbers.length);

  for (const r of rows.rows) {
    const hashable = {
      sequenceNumber: r.sequence_number,
      actorUserId: r.actor_user_id,
      actorRole: r.actor_role,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      contentHash: r.content_hash,
      payloadHash: r.payload_hash,
      chainVersion: r.chain_version,
      createdAt: r.created_at,
    };
    const key = keyring.keyFor(r.chain_version);
    const recomputed = computeEntryHash(hashable, r.prev_hash, key);
    expect(recomputed).toBe(r.entry_hash);
  }

  // biome-ignore lint/suspicious/noExplicitAny: return shape is caller-specific
  return rows.rows as any[];
}
