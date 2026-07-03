# Wave 5 — P-2 Spec (pointer)
**Source of truth:** spec contract in `tasks.description` of seed **0595a835-db62-4685-b451-1cd6c06416bf** (YAML head + prose). DB wins.
**wave_type:** multi-spec (4 blocks). **design_gap_flag:** false. **claimed_task_ids:** [0595a835 (schema+gate), 95adac6c (suppression+SoD), 034463b1 (disclaimers+content-hash), 34cb1d18 (config CRUD UI)].

## Acceptance criteria (copy)
### Block 1 — rules-engine schema + gate service (0595a835)
Additive migration: 4 tables (compliance_rules, suppression_list, disclaimer_templates[jurisdiction,version], compliance_approvals[content_hash,approver_user_id,status]). ComplianceGateService.evaluate(ctx)→GateVerdict{allowed,blocks[],requiredDisclaimers[]} = SOLE send-authority. **Non-bypassable:** no skippable fast path (all checks run every call); **every verdict audited** (writes to wave-4 AuditService.append IN-TX before returning — no verdict without audit). Gate is a callable contract; M6 send-path must call it (dependency, not claimed live).
### Block 2 — suppression + SoD (95adac6c)
Suppression: recipient email/domain match → HARD block. **SoD:** block unless a valid compliance_approvals row with approver_user_id≠senderUserId AND approver_role=compliance ONLY (SoD; admin excluded); approver from stored row (server-side); self-approval blocked.
### Block 3 — disclaimers + content-hash binding (034463b1)
Jurisdiction required disclaimers ENFORCED (block if unsatisfied). **Content-hash binding:** approval binds to content_hash; gate recomputes ctx.content hash, blocks on mismatch (post-approval edit re-blocks). Verdict audited.
### Block 4 — compliance-settings CRUD (34cb1d18)
/compliance/settings (RBAC compliance, journey row 17) CRUD compliance_rules/suppression_list/disclaimer_templates per design/compliance-settings.html; **every config change audited**; non-compliance role 403.

## Security-scope
Compliance gate + SoD + audit-write = compliance-critical → P-4 security-scope tightened + SoD/RBAC gate + T-8. Carry from P-0: gate exposes no skippable fast path; P-4 tracks M6 send-path non-bypass wiring as a dependency. Reuses M1 RolesGuard + wave-4 AuditService.append. No new SDK (node:crypto content hash).
