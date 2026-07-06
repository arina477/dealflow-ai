# Audit Log — Mandate Attribution vs. Tamper-Evidence Boundary

**Scope:** `audit_log_entries.mandate_id` column (wave-14, task 487b0f0c).
**Audience:** Compliance auditors, future developers reviewing the audit-log integrity model.

---

## Summary

The `audit_log_entries` table carries a nullable `mandate_id` UUID column.
This column is **not** part of the tamper-evident HMAC hash chain.

---

## What is covered by the hash chain

`AuditService._appendCore` computes `entry_hash` as:

```
HMAC-SHA256(
  key  = AUDIT_LOG_HMAC_KEY,
  data = sequence_number | actor_user_id | actor_role | action |
         resource_type | resource_id | content_hash | payload_hash |
         chain_version | created_at | prev_hash
)
```

The `mandate_id` column value is **intentionally excluded** from this preimage.
`AuditVerifier.verifyChain()` recomputes hashes over the same fixed field set and
therefore returns `{ok: true}` regardless of the value (or absence) of `mandate_id`
on any row.

---

## What mandate_id is for

`mandate_id` is a **filterable attribution column** written at append time by
`AuditService.appendWithMandate()`. It records which mandate context a
`gate-evaluate` event (resource_type `outreach-template-version`) belongs to.

`RecordkeepingRepository.findForExport` uses it to scope a mandate-level export:

```sql
resource_type = 'outreach-template-version'
  AND mandate_id = <target_mandate_id>::uuid
```

This allows a single template version to be gate-evaluated in the context of
multiple mandates without any row being claimed by the wrong export.

---

## Security boundary

Because `mandate_id` is outside the HMAC preimage, a post-insert mutation of
`mandate_id` is **not detectable by `AuditVerifier.verifyChain()`**.

The tamper-evident guarantee covers: who performed the action, on what resource,
at what time, and in what order (hash chain). It does **not** extend to the
mandate attribution column.

Two defenses exist for the attribution column despite the exclusion:

1. **Append-only table.** The DB role has INSERT/SELECT only (no UPDATE/DELETE
   grant). A BEFORE UPDATE/DELETE trigger raises an exception as a second layer.
   A post-insert mutation would therefore require bypassing both the application
   role grants and the trigger — which is a higher-privilege DB access event and
   outside the normal application write path.

2. **Audit-log integrity job.** The nightly `AuditIntegrityJob` re-walks the hash
   chain and logs any break. It does not validate `mandate_id`, but a chain break
   (from any other field mutation) would be detected.

**Auditor note:** If mandate attribution integrity is a compliance requirement,
a separate control (e.g. DB audit log on the Postgres superuser role, or a
periodic reconciliation that cross-references `mandate_id` against the
`ComplianceGateService` call log) would be needed. The HMAC chain alone is not
sufficient for that assurance.

---

## References

- `apps/api/src/modules/audit/audit.service.ts` — `_appendCore`, `appendWithMandate`
- `apps/api/src/modules/recordkeeping/recordkeeping.repository.ts` — `outreach-template-version` branch
- `apps/api/test/recordkeeping-gate.e2e-spec.ts` — test I (shared-version mandate_id isolation)
- Wave-14 tasks: 487b0f0c (gate records mandateId), 07bd1e1a (recordkeeping gate-evaluate capture)
