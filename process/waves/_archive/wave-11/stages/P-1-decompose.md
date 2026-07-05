# Wave 11 — P-1 Decompose

## Maximum size rubric (all under → no split)
| Measure | Threshold | Estimate | Trip? |
|---|---|---|---|
| Files touched | >60 | ~30-40 (schema+migration 0010, TemplateService, composer+gate service, SoD, controllers, repos, shared, 2-3 pages + components, tests) | no |
| New primitives | >60 | ~20-25 (2 tables + 1 migration + TemplateService + composer/gate + SoD + 6-8 endpoints + Zod + 2-3 pages) | no |
| Net LOC | >5,000 | ~3,500-4,500 | no (substantial but under) |
| Stage-4 working set | >350K | under (reuse-heavy: M2 disclaimer/audit + M1 RBAC + existing designs; NO SDK) | no |

## Wave type + floor
- **claimed_task_ids:** [102a2f00 (template spine + versioning + version-binding), e90a4a99 (composer + non-bypassable pre-send gate), 2601ba33 (sender≠approver SoD + version-binding)] = 3 → **multi-spec**.
- **Floor (multi-spec):** >2,500 LOC OR ≥6 specs. ~3,500-4,500 > 2,500 → **PASS**.

## Verdict: PROCEED
No split (under max), no merge (above floor). Coherent compliance-first vertical (versioned approved template → composer → non-bypassable pre-send gate → SoD) — all 3 reframers aligned; the compliance invariants (version-binding, SoD, non-bypassable gate) are the mvp-critical moat.

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []   # design/templates-library.html + outreach-composer.html + compliance-queue.html all exist (adopted) → D-block SKIPS → next block B
```

## Carry-forward (boundaries + compliance invariants → P-2/P-3/P-4)
1. **VERSION-BINDING INVARIANT (compliance-critical):** editing an approved template mints a NEW version + invalidates approval — usable-for-send ONLY when approved AND approved-content_hash==current-content_hash; ASSERT in the service (mirrors M2 disclaimer binding). The pre-send gate (e90a4a99) enforces this at send.
2. **NON-BYPASSABLE PRE-SEND GATE (e90a4a99):** server-side, consumes M2 rules engine, writes M2 audit — the sole send-eligibility authority (mirrors the wave-5 ComplianceGateService.evaluate). No client-only bypass.
3. **SoD (2601ba33):** sender≠approver; compliance approves. Enforced server-side.
4. **HARD BOUNDARIES:** NO Anthropic/LLM/AI-drafting (later M6 bundle, shares M5's blocked founder-spend gate); NO transactional-email SDK / send-path (later bundle). This slice = template store + composer + GATE + SoD, NO actual send.
5. Reuse M2 disclaimer_templates + AuditService + M1 RBAC. Additive schema (migration 0010). P-4 SECURITY-SCOPE-TIGHTENED.

```yaml
wave_type: multi-spec
verdict: PROCEED
floor_merge_attempt: 0
design_gap_flag: false
claimed_task_ids: [102a2f00, e90a4a99, 2601ba33]
siblings_created: []
