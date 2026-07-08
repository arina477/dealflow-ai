# Wave 29 checklist — M10 records-VIEW (LAST vertical; read-only browse; light)
- [x] P-0
- [x] P-1
- [x] P-2
- [x] P-3
- [x] P-4
- [x] B-6 (APPROVE — records-view deal-activity browse; RLS-browse-isolation, READ-ONLY, paginated, advisor-denied)
- [x] C-1 PR/CI/merge — PASS: direct-push main tip 8526999 (tree ec77462); run FIRED on exact headSha (Ghost-Green guard); 5/5 green incl DA-ISO/DA-RBAC/DA-RO ran+passed in CI (DB reachable, NOT skipped); fix-up 1 (ForbiddenException-by-type assertion, routed backend-developer). head_signoff APPROVED
- [x] C-2 Deploy & verify — PASS: BOTH api+web deployed @8526999 (commit-verified, stale-web caught+corrected); api /health 200 {status:ok,db:ok,version==8526999}; web+/compliance/audit-log 307; deal-activity unauthed 401 (perimeter); NO migration; rollback armed @775cd67; canary skipped (0 DAU). head_signoff APPROVED → PROCEED_TO_T-block
