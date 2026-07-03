# Wave 5 — P-1 Decompose

## Maximum size rubric (split when over — OR logic)
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | > 60 | ~45 (migration + 4 Drizzle schemas; gate service + suppression/SoD/disclaimer/approval evaluators; rules/suppression/disclaimer config controllers; compliance-settings CRUD UI + components; shared compliance-rules Zod; tests) | No |
| New primitives | > 60 | ~30 (4 tables + migration; ComplianceGateService.evaluate + 4 evaluators; approval content-hash binding; 3 CRUD controllers; config screens; shared types) | No |
| Estimated net LOC | > 5,000 | ~3,500 (compliance-critical TEST burden heavy: non-bypass, SoD sender≠approver, content-hash-rebind, suppression hard-block, disclaimer enforce, audit-integration, per-rule CRUD) | No |
| Stage-4 working set | > 350K | security.md + databases.md + mockups + plan — under | No |

No maximum threshold trips → **no split**.

## Wave type
`claimed_task_ids.length == 4` → **multi-spec**.
- Seed 0595a835 — rules-engine schema (compliance_rules, suppression_list, disclaimer_templates, compliance_approvals) + ComplianceGateService.evaluate() sole send-authority (writes every verdict to wave-4 audit log)
- Sibling 95adac6c — suppression-list check + SoD (sender≠approver) in the gate
- Sibling 034463b1 — jurisdiction disclaimers + approval-version content-hash binding in the gate
- Sibling 34cb1d18 — wire compliance-settings screen to CRUD rules/suppression/disclaimers

## Minimum floor
Multi-spec floor: net LOC > 2,500 OR length ≥ 6. ~3,500 > 2,500 → **floor met**. **No merge** — this IS the complete enforcement-layer slice; the outreach composer that CALLS the gate is M6 (deliberately out of scope).

## Verdict: **PROCEED** (multi-spec, no split, no merge)
- `claimed_task_ids: [0595a835…, 95adac6c…, 034463b1…, 34cb1d18…]`
- `floor_merge_attempt: 0`

## design_gap_flag: **false**
| Surface | Prior art |
|---|---|
| Compliance-settings Rules Engine CRUD (rules/suppression/disclaimers) | design/compliance-settings.html (58 rules/suppression/disclaimer refs) + DESIGN-SYSTEM |
| AppShell chrome + audit-log integrity view | §10 (wave 3) + /compliance/audit-log (wave 4) |
No missing surfaces → **D-block SKIPS; next block B.**

## wave_type (T-block)
backend + ui + auth (compliance gate + SoD + audit-write = compliance/security → T-8 Security MANDATORY; security-scope + SoD gate at P-4). Real UI (compliance-settings CRUD) → T-5 E2E + T-6 layout run.

```yaml
wave_type: multi-spec
verdict: PROCEED
claimed_task_ids: [0595a835-db62-4685-b451-1cd6c06416bf, 95adac6c-25cb-4c67-bd78-a401477143ad, 034463b1-7abb-4417-8e34-7f6184a0c8db, 34cb1d18-9bff-4302-8f7e-c508ac5fef99]
siblings_created: []
floor_merge_attempt: 0
design_gap_flag: false
missing_surfaces: []
t_block_wave_type: [backend, ui, auth]
carry_from_p0: ["gate exposes no skippable fast path (P-2 AC)", "P-4 tracks M6 send-path non-bypass wiring as dependency"]
```
