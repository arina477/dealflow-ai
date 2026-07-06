# Wave 17 — L-2 Distill
## Task close: 4 claimed → done (0db154ff, e45ba68c, 96026365, df2f3b2f). + reconciled stale triage 52224877 (WORM-migration defect, fixed-forward this wave) → done.
## Observations: 5 emitted → blocks/L/observations.md. 1 promoted:
- OBS-W17-1 cross-suite shared-DB chain pollution (2-wave: w16 HMAC-key + w17 sequence-non-contiguity) → **T-4 #2 PROMOTED** [karen APPROVE w/ corrected text; lint OK].
4 holds: W17-2 RLS-vacuous-under-BYPASSRLS (VERIFY, strong 1-wave), W17-3 populated-DB-migration (BUILD, 1-wave), W17-4 pre-GUC-guard-SECURITY-DEFINER (BUILD, 1-wave), W17-5 SET-bind-param (info).
2 edge-flags karen-ruled HOLD: OBS-W16-4 [skip-ci] proactive-non-recurrence (avoidance ≠ promotion; earns on recurring defect), OBS-W14-3 hash-excluded-metadata correct-use (design-stability ≠ falsifiable-pain-rule; belongs in architecture doc).
## Promotion applied (1): command-center/principles/test-layer-principles/T-4.md:72 — rule 2 (shared-DB parallel suite asserts own scoped rows, not full chain).
```yaml
l_stage_verdict: COMPLETE
tasks_marked_done: [0db154ff, e45ba68c, 96026365, df2f3b2f]
tasks_reconciled: [52224877 (blocked→done, WORM-migration fixed-forward)]
observations_emitted: 5
promotion_candidates: 1
karen_verdicts: [{OBS-W17-1: T-4, APPROVE}, {FLAG-A skip-ci: HOLD}, {FLAG-B hash-metadata: HOLD}]
promotions_applied: [{file: test-layer-principles/T-4.md, line: 72, rule: shared-DB-parallel-suite-scoped-rows}]
note: "3 strong 1-wave holds (RLS-vacuous-under-privileged-role, populated-DB-migration, pre-GUC-guard-SECURITY-DEFINER) carry forward — likely to clear the bar next wave"
```
