# Wave 13 — B-block review artifacts
**Wave topic:** M6 audit-log / recordkeeping export (read+verify API + export package + page)
**Block exit gate:** B-6
**Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | branch wave-13-recordkeeping-export; schema SKIP (no migration — action col is text) |
| B-1 | done | shared recordkeeping + re-export verify + export_generated enum + rbac (f528a46) |
| B-2 | done | mandate-derivation + read-only + verify-reuse + export-one-audit + advisor-403; 13 spec (a25313a). VERIFY-ROUTE-CONFLICT flagged for B-6 |
| B-3 | done | extended audit-log page: filter table + real-shape badge + advisor-gated export panel (00fdbaa) |
| B-4 | done | repo typecheck+build PASS |
| B-5 | done | lint 0, full test green (~1675), build pass |
| B-6 | stages/B-6-review.md | pending | head-builder gate + /review |
## Context (P-4 build-notes)
- Branch: wave-13-recordkeeping-export. claimed: [36a17c81, 20c479db, 10ee0ec4]. multi-spec.
- **B-0 = DEFINITE SKIP** (no migration; audit action col is text; export_generated → shared auditActionEnum at B-1).
- **Mandate-scope = per-resource_type DERIVATION** (NO mandate_id column): mandate-* resource_id=mandate; outreach join outreach.mandate_id; pipeline join pipeline.mandate_id; gate/approval via resource. Capture ALL producers' rows. New filtered/paginated read repo method (audit.repository has only readChainAscending).
- **RE-EXPORT the existing auditVerifyResponseSchema** (audit.ts) — do NOT mirror.
- Reuse: M2 AuditService.append + AuditVerifier.verifyChain (real shape {ok,entriesChecked,firstBreakAt?,reason?}), M1 getUserWithRole. audit_log_entries immutable read-only.
- RBAC export: compliance-reviewer/compliance-officer/audit-lead/admin; advisor NO export + own-outreach read only.
