# Wave 12 — B-block review artifacts
**Wave topic:** M6 pipeline/deal-stage tracking (pipeline spine + board + timeline)
**Block exit gate:** B-6
**Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | in-progress | branch wave-12-pipeline-tracking; migration 0011 (pipeline + pipeline_events) |
| B-1 | done | shared pipeline contracts+rbac(advisor+compliance)+audit actions (dec1b87) |
| B-2 | done | pipeline module; eligible-guard+idempotent-409+fixed-enum+append-note+audit-last-in-txn; 42 spec (9188f0e) |
| B-3 | done | board 7 fixed columns + timeline + add-note; NO send/AI; SSR+proxy (9cf1969) |
| B-4 | done | repo typecheck+build PASS |
| B-5 | done | lint 0, full test green (~1543), build pass |
| B-6 | stages/B-6-review.md | pending | head-builder gate + /review |
## Context
- Branch: wave-12-pipeline-tracking. claimed_task_ids: [07989285, d1940142, 45b259e1]. wave_type multi-spec.
- **B-3 BUILD NOTE (P-4 karen+jenny):** render the 7 FIXED pipeline_stage columns (shortlisted→contacted→engaged→diligence→offer→closed→withdrawn), NOT design/pipeline.html's illustrative/partial labels.
- Reuse: M2 AuditService.append last-in-txn (audit.service.ts:75), M1 getUserWithRole (auth.repository.ts:154), wave-11 outreach send_eligible, wave-10 match_run/match_candidates, wave-8 mandates.
- Migration head 0010 → new 0011 (distinct enums pipeline_stage + pipeline_event_type).
