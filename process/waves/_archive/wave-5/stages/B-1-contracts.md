# Wave 5 — B-1 Contracts
typescript-pro. Commit `f998822`. Branch wave-5-compliance-gate.
- **compliance-gate.ts:** blockReasonEnum (suppression|sod|content-hash-mismatch|missing-disclaimer|no-approval), blockReasonSchema (discriminatedUnion w/ typed detail per kind), gateVerdictSchema {allowed,blocks[],requiredDisclaimers[]}, gateContextSchema {senderUserId,senderRole,recipients,jurisdiction,content,contentHash,resource...}.
- **compliance-rules.ts:** entity schemas (complianceRule/suppressionEntry/disclaimerTemplate/complianceApproval) + create/update inputs + pgEnum mirrors (ruleType, matchType[email|domain], approvalStatus[approved|revoked]).
- **audit.ts:** auditActionEnum EXTENDED additively (+gate-evaluate, rule-change, suppression-change, disclaimer-change; appended after wave-4 values — order-stable, serialization unaffected, DB action=text). Additive-safe confirmed.
- **rbac.ts:** +NAV_COMPLIANCE_SETTINGS (label 'Rules', /compliance/settings, ['compliance']) attached to existing entry + ALL_NAV_ITEMS; +3 CRUD routes /compliance/{rules,suppression,disclaimers} (['compliance','admin'], no nav). /compliance/audit-log{,/verify} UNTOUCHED.
- **SoD distinction:** CRUD routes compliance/admin (config mgmt); SoD APPROVER = compliance-only, enforced at B-2 gate sodEvaluator (NOT a route). Documented.
- Tests: 275 (82 compliance-rules + 25 rbac wave-5 + 10 audit). typecheck + biome clean.
```yaml
skipped: false
contracts_authored: [compliance-gate.ts, compliance-rules.ts, audit.ts(ext), rbac.ts(mod), index.ts]
commit: f998822
nav_subset_rbac: preserved
audit_enum_additive_safe: true
deviations: []
```
