# Wave 5 — B-block review artifacts
**Block:** B (Build) · **Wave topic:** compliance rules engine + non-bypassable pre-send gate (M2 enforcement) · **Gate:** B-6 · **Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | branch wave-5-compliance-gate; no new deps; schema=YES(0003@B-2); 4 tasks claimed |
| B-1 | stages/B-1-contracts.md | done | GateVerdict/BlockReason + rules Zod + roleRoutes CRUD/nav (f998822); 275 tests |
| B-2 | stages/B-2-backend.md | done | 0003 + non-bypassable gate (SoD=compliance-only) + audited CRUD (64f0b60,26f13a7,c390359); 158 tests |
| B-3 | stages/B-3-frontend.md | done | compliance-settings CRUD UI at /compliance/settings (c7924bc); 134 tests |
| B-4 | stages/B-4-wiring.md | done | repo typecheck+build PASS |
| B-5 | stages/B-5-verify.md | done | lint 0-err, 567 tests, build pass; SoD-compliance-only test; runtime→C-2 |
| B-6 | stages/B-6-review.md | gate-passed | head-builder APPROVED; /review 3 CRIT fixed (6300c4e,c5d4f29); commit-discipline PASS |

## Block context
- **Spec:** seed 0595a835 (multi-spec 4 blocks + P-4 remediation addendum: SoD approver=compliance ONLY). Branch wave-5-compliance-gate.
- **claimed_task_ids:** [0595a835 (schema+gate), 95adac6c (suppression+SoD), 034463b1 (disclaimers+content-hash), 34cb1d18 (config CRUD UI)]
- **Deps:** none new (node:crypto). **Schema:** YES — additive migration 0003 (4 mutable config tables: compliance_rules, suppression_list, disclaimer_templates, compliance_approvals). NO immutability trigger (distinct from audit_log). **Env:** none new.
- **Load-bearing invariants (P-4):** single non-bypassable gate (no skip param, all evaluators every call, verdict→AuditService.append IN-TX before return, tx-rollback on audit-fail = no verdict without audit); **SoD approver=compliance ONLY** (admin excluded; self-approval blocked; approver from stored row server-side); suppression hard-block; disclaimers enforced; content-hash binding (post-approval edit re-blocks, keyless SHA-256); every verdict + config-change audited; CRUD @Roles compliance/admin (config mgmt); reuse M1 RolesGuard + wave-4 AuditService.append.
- **M6 dependency:** send-path must call evaluate() (do NOT claim live non-bypass this wave).
## Gate verdict log
<appended by head-builder at B-6>

```yaml
build_block_status: complete
branch: wave-5-compliance-gate
review_verdict: APPROVE
critical_fixes: [sod-null-approver-fail-closed, disclaimer-versioning-race, gate-ctx-validation]
ready_for_ci: true
```
