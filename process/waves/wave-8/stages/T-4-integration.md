# Wave 8 — T-4 Integration (Pattern A, CI-verified + LIVE C-2)
Integration surface: mandate create/configure/list/detail→DB (one-txn 3-table + audit-last-in-txn); disclaimer derive FK-reads M2 disclaimer_templates; migrations 0006 (3 tables) + 0007 (partial unique index). **LIVE at C-2 (46642e7):** create-via-UI 201→redirect→detail (seller/jurisdiction-US/derived-disclaimer/draft/3-placeholders); derive-no-match→400; 3-acks→400; active-lock draft→active 200 + edit-active 409; audited (chain ok); RBAC full matrix; migrations 0006+0007 applied (8 rows + partial index); detail SSR-HTML-not-JSON. 3 C-2 fix-cycles (UI-collision, advisor-jurisdictions, create-response-shape) all live-confirmed.
```yaml
test_pattern: ci-verified
skipped: false
live_c2_evidence: ["create-via-UI 201→redirect→detail", "derive-disclaimer + no-match-400 + ambiguous-409", "3-acks-400", "active-lock-409", "audited", "migrations 0006+0007", "detail SSR-HTML"]
findings: []
