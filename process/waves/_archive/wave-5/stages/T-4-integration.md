# Wave 5 — T-4 Integration (Pattern A, CI-verified + LIVE C-2)
Integration surface: gate→evaluators→AuditService.append (in-tx); CRUD→DB→AuditService.append (in-tx, rollback on audit-fail); migration 0003 (4 tables + 3 partial-unique indexes); SuperTokens-id→users.id translation (the FK boundary). Coverage: gate/evaluator/CRUD specs; **LIVE at C-2** — CRUD writes 201, config-mutation audited (entriesChecked +2), disclaimer versioning (1-active, partial-unique holds), gate SoD matrix (admin-approver BLOCKED), each verdict audited (gate-evaluate 0→5). Migration 0003 applied to app postgres (4 tables + 3 indexes confirmed). health e2e green.
```yaml
test_pattern: ci-verified
skipped: false
boundaries_audited: [gate->audit, CRUD->audit, migration 0003, ST-id->users.id FK]
live_c2_evidence: ["CRUD 201", "config-audited +2", "disclaimer 1-active", "SoD admin-approver BLOCKED", "gate verdicts audited 0->5"]
findings: []
