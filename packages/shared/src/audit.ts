import { z } from 'zod';

// ---------------------------------------------------------------------------
// Genesis anchor — the well-defined prev_hash for the first chain entry.
// 64 hex zeros matches SHA-256 hex output width; documented as the chain root.
// Both the append service and the verifier derive this constant from the
// shared package so neither side hard-codes it independently.
// ---------------------------------------------------------------------------

export const GENESIS_PREV_HASH = '0'.repeat(64);

// ---------------------------------------------------------------------------
// Chain-break reason enum — machine-stable strings returned by the verifier.
// Keep in sync with the verifier's reason-string assignments (B-2 step 2.9).
// ---------------------------------------------------------------------------

export const auditBreakReasonEnum = z.enum([
  'content-hash-mismatch',
  'prev-hash-mismatch',
  'sequence-gap',
]);

export type AuditBreakReason = z.infer<typeof auditBreakReasonEnum>;

// ---------------------------------------------------------------------------
// Action enum — audited action kinds (minimal for this wave).
// Callers wire in real action values at M6+; column accepts any text but the
// Zod enum gives shared type safety for the known set now.
// ---------------------------------------------------------------------------

export const auditActionEnum = z.enum([
  // --- Wave-4 actions (stable; serialization order must not change) ---
  'verify-chain',
  'compose',
  'approve',
  'send',
  'suppress',
  // --- Wave-5 compliance-gate + config-mutation actions (additive) ---
  /** Gate evaluation: a GateVerdict was computed and recorded. */
  'gate-evaluate',
  /** A compliance_rules row was created, updated, or toggled. */
  'rule-change',
  /** A suppression_list row was created or deleted. */
  'suppression-change',
  /** A disclaimer_templates row was versioned (edit = insert new version). */
  'disclaimer-change',
  // --- Wave-6 sourcing actions (additive) ---
  /**
   * A dedupe_candidates row was resolved by a human (merge or reject).
   * This is a material human-attributable mutation that changes the canonical
   * company universe, so it is audited via AuditService.append in the same
   * transaction as the resolve write (wave-5 rules.service pattern).
   * Appended AFTER all prior values — serialization order preserved.
   */
  'sourcing-dedupe-resolve',
  // --- Wave-7 sourcing actions (additive) ---
  /**
   * A data_source_connections row was created by a human.
   * Enables the AC-SEED ≥2-source view on the sourcing workspace page.
   * Audited in-tx (rollback on audit fail) — actor = app users.id.
   */
  'sourcing-connection-create',
  // --- Wave-8 mandate actions (additive; serialization order preserved) ---
  /**
   * A mandates row was created (along with mandate_buyer_criteria and
   * mandate_compliance_profile) in a single atomic transaction. The actor
   * is the app users.id of the creating advisor (NOT the raw ST id).
   * Audited LAST-IN-TXN so audit failure rolls back all three table writes.
   */
  'mandate-create',
  /**
   * A mandates row was re-configured (status change, criteria update, etc.)
   * by an advisor or admin. Audited in-tx.
   */
  'mandate-configure',
  // --- Wave-9 buyer-universe actions (additive; serialization order preserved) ---
  /**
   * A buyer_universe was assembled from M3 companies for a mandate.
   * Includes UPSERT of the buyer_universe row + INSERT of buyer_universe_candidates.
   * Audited LAST-IN-TXN (audit fail → whole tx rolls back).
   */
  'buyer-universe-assemble',
  /**
   * A buyer_universe's candidates were filtered by the mandate's buyer criteria.
   * Sets membership_status included|excluded + provenance per candidate.
   * Audited in-tx.
   */
  'buyer-universe-filter',
  /**
   * A buyer_universe's included candidates were enriched with M3 contacts.
   * No new data written to companies/contacts; enrichment is a view/join read.
   * Audited in-tx.
   */
  'buyer-universe-enrich',
  /**
   * A buyer_universe was submitted (status → submitted), marking it
   * ready-to-rank for the M5 ranking step. Audited in-tx.
   */
  'buyer-universe-submit',
  // --- Wave-10 match-run actions (additive; serialization order preserved) ---
  /**
   * A match_run was created and all candidates scored in a single atomic
   * transaction. Includes UPSERT of match_run + INSERT of match_candidates.
   * The pure deterministic scorer ran with NO LLM/AI calls.
   * Audited LAST-IN-TXN (audit fail → whole tx rolls back).
   */
  'match-run-create',
  /**
   * A match_candidates row's disposition was updated (accepted/rejected/flagged)
   * by an advisor or admin. Audited in-tx.
   */
  'match-disposition',
  /**
   * A match_run was handed off (ready_for_outreach → true), marking it
   * ready for M6 outreach. Guard: ≥1 accepted candidate required.
   * Audited in-tx.
   */
  'match-handoff',
  // --- Wave-11 outreach template + compose actions (additive; serialization order preserved) ---
  /**
   * An outreach_templates row was created (along with version 1) in a single
   * atomic transaction. The actor is the app users.id of the creating advisor/analyst.
   * Audited LAST-IN-TXN so audit failure rolls back all writes.
   */
  'template-create',
  /**
   * A new outreach_template_versions row was drafted (draftNewVersion).
   * ALWAYS creates a new version row — never mutates an approved version.
   * The content_hash is computed via the M2 computeContentHash (keyless SHA-256).
   * Audited in-tx.
   */
  'template-version-draft',
  /**
   * An outreach_template_versions row's approval was requested (requestApproval).
   * Returns 400 if the version's disclaimer_template_id does not reference a valid
   * disclaimer_templates row. Audited in-tx.
   */
  'template-approval-request',
  /**
   * An outreach_template_versions row was approved by a compliance user.
   * Sets approved_content_hash = current content_hash + approved_by = actor.
   * Compliance role ONLY (SoD — advisor 403). Audited in-tx.
   */
  'template-approval-grant',
  /**
   * An outreach_template_versions row was rejected by a compliance user.
   * Compliance role ONLY. Audited in-tx.
   */
  'template-approval-reject',
  /**
   * An outreach record was composed by an advisor.
   * The non-bypassable pre-send gate (ComplianceGateService.evaluate) was called
   * and the verdict is stored in outreach.gate_verdict. Status = send_eligible
   * (allowed:true) | blocked (allowed:false). Audited LAST-IN-TXN.
   */
  'outreach-compose',
  // --- Wave-12 pipeline actions (additive; serialization order preserved) ---
  /**
   * A pipeline row was created (enrolled) from an eligible source.
   * The source must be: outreach with status='send_eligible', OR an accepted
   * match_candidate under a match_run with ready_for_outreach=true.
   * Audited LAST-IN-TXN; idempotent enroll — a 2nd call returns 409.
   */
  'pipeline-enroll',
  /**
   * A pipeline row's stage was changed from one fixed stage to another.
   * A stage_changed pipeline_events row is written in the same txn.
   * Audited LAST-IN-TXN (rollback on audit fail).
   */
  'pipeline-transition',
  /**
   * A free-text note was appended to a pipeline deal's event timeline.
   * A note pipeline_events row is written in the same txn.
   * Append-only — no edit or delete path.
   * Audited LAST-IN-TXN (rollback on audit fail).
   */
  'pipeline-note',
  // --- Wave-13 recordkeeping-export actions (additive; serialization order preserved) ---
  /**
   * A compliance recordkeeping export package was generated.
   * The package contains the in-scope audit entries (with tamper-evidence hashes),
   * the full-chain AuditVerifier result, and a manifest for offline re-verification.
   * Appended LAST-IN-TXN by RecordkeepingService.exportAsActor; rollback on audit fail
   * (exactly-one-or-none: no package is delivered without its audit row).
   */
  'export_generated',
  // --- Wave-15 admin actions (additive; serialization order preserved) ---
  /**
   * An admin created an invite (privilege-granting action).
   * Audited by UserManagementService.inviteAsActor LAST-IN-TXN.
   * actor = admin app users.id.
   */
  'user-invite',
  /**
   * An admin changed a user's role (role-change / demotion / promotion).
   * Audited by UserManagementService.assignRoleAsActor LAST-IN-TXN.
   * actor = admin app users.id.
   */
  'role-change',
  /**
   * An admin deactivated a user (soft-deactivation via deactivated_at).
   * Audited by UserManagementService.deactivateAsActor LAST-IN-TXN.
   * actor = admin app users.id.
   */
  'deactivate',
  /**
   * An admin updated the firm-level workspace settings
   * (firm profile fields or default compliance profile).
   * Audited by WorkspaceSettingsService LAST-IN-TXN.
   * actor = admin app users.id.
   */
  'workspace-settings-update',
  /**
   * An admin created or updated a data_source_connections row
   * (upsert — new row or update of existing connection metadata + credential).
   * Audited by DataSourceAdminService LAST-IN-TXN.
   * actor = admin app users.id.
   * NOTE: the plaintext credential is NEVER included in the audit row.
   */
  'data-source-conn-upsert',
  /**
   * An admin toggled the enabled/disabled state of a data_source_connections row.
   * Audited by DataSourceAdminService LAST-IN-TXN.
   * actor = admin app users.id.
   */
  'data-source-conn-toggle',
  // --- Wave-16 admin-hardening actions (additive; serialization order preserved) ---
  /**
   * An admin reactivated a previously deactivated user (deactivated_at → NULL).
   * Audited by UserManagementService.reactivateAsActor LAST-IN-TXN.
   * actor = admin app users.id.
   * Mirrors the wave-15 'deactivate' action — same service, inverse operation.
   */
  'user-reactivate',
  // --- Wave-20 outreach-activity actions (additive; serialization order preserved) ---
  /**
   * An outreach_activity row was created by an advisor/admin.
   * Audited by OutreachActivityService.create LAST-IN-TXN.
   * actor = ALS-resolved app users.id (never client-supplied).
   */
  'outreach-activity-create',
  /**
   * An outreach_activity row's fields were updated (subject, notes, due_at, etc.).
   * Audited by OutreachActivityService.update LAST-IN-TXN.
   */
  'outreach-activity-update',
  /**
   * An outreach_activity row's status was transitioned (planned→completed).
   * Audited by OutreachActivityService.updateStatus LAST-IN-TXN.
   * completedAt is set server-side on transition to 'completed'.
   */
  'outreach-activity-status-transition',
  /**
   * An outreach_activity row was cancelled (status→cancelled).
   * Audited by OutreachActivityService.cancel LAST-IN-TXN.
   */
  'outreach-activity-cancel',
]);

export type AuditAction = z.infer<typeof auditActionEnum>;

// ---------------------------------------------------------------------------
// Append INPUT shape — the caller-supplied fields BEFORE hashing.
// The append service computes content_hash, payload_hash, prev_hash,
// entry_hash, and chain_version; callers supply everything else.
// ---------------------------------------------------------------------------

export const auditEntryInputSchema = z
  .object({
    /** User id of the actor; null for system / genesis events. */
    actorUserId: z.string().uuid().nullable(),
    /** Role snapshot at time of action (not a FK — stored as text). */
    actorRole: z.string().min(1),
    /** Action kind (shared enum). */
    action: auditActionEnum,
    /** Audited object type (e.g. "mandate", "outreach-batch"). */
    resourceType: z.string().min(1),
    /** Audited object id; null for non-object events. */
    resourceId: z.string().nullable(),
    /**
     * Hash of the communication payload content — DISTINCT from payloadHash.
     * Callers compute this before calling the service; service records it as-is.
     */
    contentHash: z.string().min(1),
    /**
     * Hash of the structured event payload — distinct from contentHash.
     * Callers compute this before calling the service; service records it as-is.
     */
    payloadHash: z.string().min(1),
  })
  .strict();

export type AuditEntryInput = z.infer<typeof auditEntryInputSchema>;

// ---------------------------------------------------------------------------
// READ shape — what the verify/list surfaces return (mirrors the DB columns).
// sequence_number is represented as a number here; consumers needing exact
// bigint precision for very large logs should use bigint at the DB boundary.
// ---------------------------------------------------------------------------

export const auditLogEntrySchema = z
  .object({
    /** Monotonically increasing PK; DB-assigned IDENTITY column. */
    sequenceNumber: z.number().int().positive(),
    /** Nullable — null for system / genesis entries. */
    actorUserId: z.string().uuid().nullable(),
    actorRole: z.string().min(1),
    action: auditActionEnum,
    resourceType: z.string().min(1),
    resourceId: z.string().nullable(),
    /** Hash of the communication payload (content). */
    contentHash: z.string().min(1),
    /** Hash of the structured event payload. */
    payloadHash: z.string().min(1),
    /** Prior entry's entry_hash; genesis entries store GENESIS_PREV_HASH. */
    prevHash: z.string().min(1),
    /** HMAC-SHA256 over the canonical serialization of this entry's fields. */
    entryHash: z.string().min(1),
    /**
     * Pins the HMAC key version (= AUDIT_LOG_HMAC_KEY_VERSION) AND the
     * canonical-serialization field-set/ordering version. A future change to
     * either the key OR the serialization field order MUST bump this value.
     */
    chainVersion: z.number().int().positive(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

// ---------------------------------------------------------------------------
// AuditVerifyResponse — the verification endpoint response shape.
// Consumed by:
//   - B-2 step 2.11 (audit-log controller, return type)
//   - B-3 step 3.1/3.2 (compliance integrity screen, parsed client-side)
// ---------------------------------------------------------------------------

export const auditVerifyResponseSchema = z
  .object({
    /** true = chain intact; false = break detected. */
    ok: z.boolean(),
    /** Number of entries walked. 0 for an empty log (vacuously ok:true). */
    entriesChecked: z.number().int().nonnegative(),
    /**
     * The sequence_number of the first detected break.
     * Present only when ok=false.
     */
    firstBreakAt: z.number().int().positive().optional(),
    /**
     * Machine-stable reason string for the break.
     * Present only when ok=false.
     */
    reason: auditBreakReasonEnum.optional(),
  })
  .strict();

export type AuditVerifyResponse = z.infer<typeof auditVerifyResponseSchema>;
