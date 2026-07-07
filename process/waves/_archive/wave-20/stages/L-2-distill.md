# Wave 20 — L-2 Distill
## Task close: 4 claimed → done (d45c73b5, 5c12ac3a, c3776cac, b2acf4ce).
## Observations: 3 → blocks/L/observations.md. 1 promoted (BUILD #9). Strong holds carry forward.
- **OBS-W20-1 fixture-vs-real-DB → BUILD-PRINCIPLES #9 PROMOTED** [karen APPROVE w/ corrected Why 99b; lint OK]. 3-wave: wave-18 schema-mismatch + wave-19 invalid-UUID + wave-20 (4 of 5 C-1 fix-forwards fixture/seed SQL). Held from wave-19 by the one-per-wave cap — this was its turn.
- **OBS-W20-2 readTail-RLS-exempt (STRONG HOLD, 1-wave):** the C-1 fix-forward #2 real prod bug — a global shared-infra read (the audit HMAC chain tail) RLS-filtered under dealflow_app → per-workspace genesis seq=1 collision; fixed to the RLS-exempt read_audit_chain_rls_exempt. Kernel: a global-view read under per-tenant RLS must use an RLS-exempt path. Load-bearing for M11. HOLD pending 2nd sighting (wave-17 SECURITY-DEFINER-function is an implicit precedent).
- **OBS-W17-1 T-4 #2 (hardcoded-HMAC-key in e2e, now 3rd sighting — wave-21's promotion turn):** wave-20 C-1 cycle 2 reinforced it; deferred by the one-per-wave cap.
- OBS-W20-3 P-4 three-layer-defense (meta, INFO hold).
## Promotion applied (1): command-center/principles/BUILD-PRINCIPLES.md:86 — rule 9 (run any new real-DB e2e fixture against a migrated DB with the runtime role before B-6).
```yaml
l_stage_verdict: COMPLETE
tasks_marked_done: [d45c73b5, 5c12ac3a, c3776cac, b2acf4ce]
observations_emitted: 3
promotions_applied: [{file: BUILD-PRINCIPLES.md, line: 86, rule: run-real-DB-e2e-fixture-against-migrated-DB-pre-B-6}]
held_next_wave: [{obs: OBS-W20-2, target: BUILD readTail-RLS-exempt, status: strong-hold-1wave}, {obs: OBS-W17-1, target: T-4 #2 hardcoded-HMAC, status: 3wave-ready-wave-21}]
```
