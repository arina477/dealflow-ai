-- Wave-14, task 487b0f0c — additive nullable mandate_id on audit_log_entries.
--
-- HASH-CHAIN SAFETY: this column is intentionally EXCLUDED from the HMAC hash
-- core (HashableEntryFields / canonicalSerialization v1). Adding it as a
-- separate nullable column (not part of the serialized preimage) means:
--   • All existing entries' entry_hash / payload_hash values are byte-identical
--     after this migration (the column is NULL for every existing row, and NULL
--     is never serialized).
--   • AuditVerifier.verifyChain() continues to recompute the same HMAC over the
--     same canonicalSerialization fields → verifyChain returns {ok:true} over
--     the full mixed old/new chain.
--
-- The column is populated ONLY for gate-evaluate rows, set via a dedicated
-- INSERT path in AuditRepository.insertEntry (mandateId is passed alongside
-- the hashed fields but is never fed into computeEntryHash). All other action
-- types leave mandate_id NULL.
--
-- Journal: applies after 0011_brainy_the_liberteens.sql.

ALTER TABLE "audit_log_entries"
  ADD COLUMN "mandate_id" uuid;
