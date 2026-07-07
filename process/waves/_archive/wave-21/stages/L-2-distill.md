# Wave 21 — L-2 Distill (docs wave)
## Task close: 1 claimed → done (1d95cac0).
## Observations: 3 → blocks/L/observations.md. 1 promoted (T-4 #3, the held-from-wave-20 due promotion).
- **OBS-W21-1 hardcoded-HMAC-key-in-audit-chain-e2e → test-layer T-4 #3 PROMOTED** [karen APPROVE w/ corrected Why 98b; lint OK]. 3-wave: wave-16 recordkeeping-gate + wave-17 ISO-5 kernel + wave-20 pipeline-gate (C-1 cycle 2). DISTINCT from T-4 rule 2 (rule 2 = scoped-row COUNT/sequence pollution; rule 3 = HMAC-key mismatch — complementary halves of the shared-chain-pollution class). Held from wave-20's L-2 by the one-per-wave cap.
- **OBS-W21-2 OAE-3 unscoped-global-count = T-4 rule 2 RECURRENCE (no new promotion):** the 8 unscoped COUNT(*) FROM audit_log_entries sites re-violated the promoted T-4 rule 2 → VALIDATES it; fix-forward task 02f4e6a1 (whole-class) is the enforcement artifact.
- **OBS-W21-3 REFRAME-avoided-process-theater (meta HOLD):** P-0 checked the promoted PRODUCT #1 before authoring → scoped down instead of re-doc. Low falsifiability, no home.
## Promotion applied (1): command-center/principles/test-layer-principles/T-4.md:74 — rule 3 (real-DB e2e over a shared audit chain derives its HMAC key from the shared env var).
```yaml
l_stage_verdict: COMPLETE
tasks_marked_done: [1d95cac0]
observations_emitted: 3
promotions_applied: [{file: test-layer-principles/T-4.md, line: 74, rule: e2e-verifyChain-derives-HMAC-key-from-shared-env}]
held_next_wave: [{obs: readTail-RLS-exempt, status: strong-hold-1wave-BUILD-candidate}]
note: "OAE-3 validated T-4 rule 2 (recurrence, fix-forwarded 02f4e6a1); 8 principles now promoted this session across P/B/C/V/T + PRODUCT/BUILD/CI/T-4"
```
