# Wave 17 — T-9 Journey (gate + journey)
**Gate:** APPROVED (head-tester, security-scope-tightened). verdict → blocks/T/gate-verdict.md. next_action: PROCEED_TO_V.
## Journey delta (M8 data-isolation, LIVE @591b3f8)
Isolation is TRANSPARENT — NO new UI surface. Every existing authed endpoint now runs workspace-scoped (FORCE RLS + request-scoped GUC as the non-superuser dealflow_app role). Users see only their (the pilot firm's) workspace data. No journey-map screen change; the isolation is an enforcement layer under all existing routes.
## Security-invariant coverage (PROVEN — CI real-DB as dealflow_app [non-vacuous] + C-2 live)
FORCE-RLS-enforced-as-non-superuser (ISO-1..5 SET ROLE dealflow_app + C-2 [RLS-GUARD]) | request-scoped-GUC-no-leak (GUC-1/2/3) | pre-interceptor-RLS-exempt-bootstrap (RBAC CRITICAL-1b + INV-1..5) | audit-hash-exclude+WORM-reattribution+populated-migration (ISO-5 + AMP-1..5 + verifyChain ok:true 328 rows) | deny-by-default-fail-closed (NULLIF) | backfill-before-NOT-NULL.
