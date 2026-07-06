import { sql } from 'drizzle-orm';
import {
  bigint,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './users-roles';
import { workspaces } from './workspaces';

/**
 * Wave-4 compliance backbone (B-2, task ec1f279d).
 *
 * audit_log_entries — tamper-evident, append-only audit table.
 *
 * Immutability design (two independent DB-layer controls):
 *   1. GRANT INSERT, SELECT only to the app role (see migration 0002_*.sql).
 *      Blocks the app role at the privilege layer. Note: grants do NOT bind
 *      the table owner / superuser — that case is handled by control 2.
 *   2. BEFORE UPDATE OR DELETE trigger (audit_log_no_mutate) that unconditionally
 *      RAISEs for EVERY connecting role, including superuser/owner.
 *      Postgres BEFORE row triggers fire regardless of the session's privilege
 *      level; the only escapes (ALTER TABLE DISABLE TRIGGER, SET
 *      session_replication_role = replica) are themselves privileged, non-default,
 *      auditable operations that the app cannot perform.
 *
 * Hash-chain integrity:
 *   entry_hash = HMAC-SHA256(AUDIT_LOG_HMAC_KEY,
 *                  canonical(content_hash‖payload_hash‖prev_hash‖
 *                            sequence_number‖action‖resource_type‖
 *                            resource_id‖actor_user_id‖actor_role‖created_at))
 *   chain_version = AUDIT_LOG_HMAC_KEY_VERSION at write time.
 *   Dual purpose of chain_version: (a) selects the HMAC key on verification
 *   (key rotation); (b) versions the canonical-serialization field-set/ordering.
 *   A future change to the canonical field order MUST bump chain_version —
 *   not just a key rotation.
 *
 * Additive-only — no existing table (users/roles/invites/app_meta) is touched.
 */

export const auditLogEntries = pgTable(
  'audit_log_entries',
  {
    /**
     * Strict monotonic ordering PK — DB-assigned BIGINT GENERATED ALWAYS AS IDENTITY.
     * The application cannot supply a value; the sequence is unbreakable from
     * the app layer. Gap detection during verification catches deletions.
     *
     * Drizzle note: bigint() with mode:'number' returns JS number (safe to 2^53).
     * For the audit volumes of a pilot-customer M&A tool this is fine; promote to
     * bigint mode:'bigint' if volume grows beyond Number.MAX_SAFE_INTEGER entries.
     */
    sequenceNumber: bigint('sequence_number', { mode: 'number' })
      .generatedAlwaysAsIdentity()
      .primaryKey(),

    /**
     * Nullable FK to users.id — system/genesis events have no actor; user
     * deletion must never cascade-delete or block an immutable audit row.
     * ON DELETE SET NULL keeps the audit row; actor_role snapshot is retained.
     */
    actorUserId: uuid('actor_user_id'),

    /** Role at time of action — snapshot (not FK), so role renames don't drift history. */
    actorRole: text('actor_role').notNull(),

    /** Action enum string (e.g. compose/approve/send/verify) — values added by callers. */
    action: text('action').notNull(),

    /** Audited object type (e.g. outreach, mandate, suppression). */
    resourceType: text('resource_type').notNull(),

    /** Audited object id — nullable for non-object events (e.g. system boot, rule-change). */
    resourceId: text('resource_id'),

    /**
     * Hash of the communication payload (message body).
     * Kept DISTINCT from payload_hash — AC requirement.
     * content_hash = hash of the raw outreach communication content.
     */
    contentHash: text('content_hash').notNull(),

    /**
     * Hash of the structured event payload (metadata / event envelope).
     * Kept DISTINCT from content_hash — AC requirement.
     * payload_hash = hash of the structured event data fields.
     */
    payloadHash: text('payload_hash').notNull(),

    /**
     * Prior entry's entry_hash.
     * Genesis entry uses GENESIS_PREV_HASH = '0'.repeat(64) (64 hex zeros,
     * matching SHA-256 hex width) — documented in audit-hash.ts.
     */
    prevHash: text('prev_hash').notNull(),

    /**
     * HMAC-SHA256(AUDIT_LOG_HMAC_KEY, canonical(...)) — see canonical() in audit-hash.ts.
     * Verifier recomputes this to detect any content tampering.
     */
    entryHash: text('entry_hash').notNull(),

    /**
     * = AUDIT_LOG_HMAC_KEY_VERSION at the time of write.
     * Dual purpose: (a) HMAC key selector (rotation); (b) canonical-serialization
     * version. Both must be bumped together if either the key or the field-order changes.
     */
    chainVersion: integer('chain_version').notNull(),

    /** Server clock — set by DB default, not by the application. */
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    /**
     * Wave-14 (task 487b0f0c) — nullable mandate context, HASH-EXCLUDED.
     *
     * Populated ONLY for gate-evaluate rows: set at INSERT time to the mandate
     * UUID that was in scope when ComplianceGateService.evaluate() was called.
     * All other action types leave this NULL.
     *
     * CRITICAL: this column is NOT part of HashableEntryFields and is NEVER fed
     * into canonicalSerialization() or computeEntryHash(). Existing rows have
     * mandate_id = NULL and their entry_hash values are byte-identical after this
     * additive migration — the column's value (NULL or otherwise) does not affect
     * the HMAC preimage, so AuditVerifier.verifyChain() remains valid over the
     * full mixed old/new chain.
     *
     * The recordkeeping mandate-derivation uses this column to capture
     * gate-evaluate rows for a mandate-scoped export without over-capture
     * (rows for other mandates' gate decisions are excluded by mandate_id ≠ mid).
     * No FK: mandate rows can be deleted without cascading into the immutable
     * audit log (same rationale as actor_user_id ON DELETE SET NULL).
     */
    mandateId: uuid('mandate_id'),

    /**
     * Wave-17 (task 0db154ff) — tenant boundary FK. HASH-EXCLUDED.
     *
     * CRITICAL: this column is NOT part of HashableEntryFields and is NEVER fed
     * into canonicalSerialization() or computeEntryHash(). Mirrors the mandate_id
     * exclusion pattern (wave-14) exactly. Existing entry_hash values are
     * byte-identical after this migration — the HMAC preimage is unchanged.
     * workspace_id hash-exclusion is SAFE because the WORM BEFORE-UPDATE trigger
     * (migration 0002) unconditionally rejects ALL UPDATE/DELETE on audit_log_entries
     * regardless of which column is targeted. The trigger is the sole backstop
     * against cross-workspace re-attribution; df2f3b2f MUST prove it fires.
     *
     * The LIST/EXPORT projection is RLS-scoped (GUC policy). The integrity WALK
     * (verifyChain readChainAscending) uses read_audit_chain_rls_exempt()
     * SECURITY DEFINER to bypass RLS and walk the FULL global chain, returning
     * ok:true over the whole chain, not per-workspace sub-chains.
     */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'audit_log_entries_actor_user_id_fk',
      columns: [table.actorUserId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'audit_log_entries_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),
    // sequence_number is the PK and the walk order for verification.
    // No additional index needed for MVP — the verifier walks the full chain
    // in PK order; the PK B-tree index already covers that scan.
    index('audit_log_entries_workspace_id_idx').on(table.workspaceId),
  ]
);
