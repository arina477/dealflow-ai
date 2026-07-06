# Wave 13 — P-2 Spec (pointer)
Authoritative spec = YAML head of task 36a17c81's tasks.description (DB). multi-spec, 3 blocks.
## claimed_task_ids: [36a17c81 (seed), 20c479db, 10ee0ec4]
- **36a17c81 (read+verify API):** filterable/paginated read over immutable audit_log_entries (READ-ONLY, zero audit rows) + GET verify → REAL AuditVerifier shape {ok,entriesChecked,firstBreakAt?,reason?} (full-chain); RBAC compliance/admin org-wide, advisor own-outreach; exposes sequence_number/prev_hash/entry_hash.
- **20c479db (export package):** POST export (mandate/time scope) → self-contained deterministic package (in-scope entries + hashes + full-chain verify result + manifest for offline re-verify); ONE format v1 (CSV/JSON+integrity, defer PDF/multi); export_generated audit row appended EXACTLY-once last-in-txn; compliance/admin only (advisor 403).
- **10ee0ec4 (page):** /compliance/audit-log per design/audit-log-export.html — filter/sort table + integrity badge (real verify shape) + export panel; role-scoped (advisor no export); read-only (no edit/delete); SSR + /compliance/audit-log-data proxy; NO send/AI.
design_gap_flag false. Scope-held: real-verifier-shape + one-export-format-v1. Boundaries: read-only over immutable chain, no credential/send/webhook/LLM, additive (no schema change).
