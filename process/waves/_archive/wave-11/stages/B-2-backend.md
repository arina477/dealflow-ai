# Wave 11 — B-2 Backend (+ B-0 schema)
backend-developer.
- **B-0 schema:** outreach.ts (outreach_templates + outreach_template_versions [version_number, content_hash, **outreach_approval_status DISTINCT enum**, approved_content_hash, approved_by, disclaimer_template_id FK→M2] + outreach [template_version_id FK, gate_verdict, status compose|send_eligible|blocked]) + migration 0010_mighty_the_anarchist (journal when > 0009 — BUILD rule 4; distinct enum name — karen; .down.sql).
- **B-2 TemplateService:** create/draftNewVersion (new version + content_hash REUSING M2 keyless SHA-256)/requestApproval (required-block 400) + **isUsableForSend (VERSION-BINDING: approved AND approved_content_hash==current)**. ApprovalService grant/reject (compliance-role SoD; sets approved_content_hash + approved_by). **OutreachService.compose ALWAYS CALLS M2 ComplianceGateService.evaluate (REUSE the sole authority) + version-binding + SoD (composer!=approved_by) + M2 rules → send_eligible|blocked FAIL-CLOSED; NO bypass path to send_eligible (gate-called structural test)**; one-txn + audit-last-in-txn + actor-id + tx-scoped-reads (rule 7) + DrizzleError-unwrap. NO email SEND (produces send-eligible only).
- Controllers (per-method @Roles + module-load assertion + route-order) + di-boot. BOUNDARY-clean: no anthropic/email-SDK import (boundary test extracts import lines, not comments).
- FULL pnpm -r test: 593 api (outreach.spec 44 + di-boot) + 458 shared + 377 web (cross-package verify — wave-10 lesson).
```yaml
skipped: false
specialists_spawned: [backend-developer]
version_binding_isUsableForSend: true
non_bypassable_gate_reuses_M2: true
compose_always_calls_evaluate: true
sod_composer_ne_approved_by: true
boundary_clean_no_llm_no_email: true
full_repo_test_green: true
