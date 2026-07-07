# Wave 25 — L-2 Distill
## Task close: 1 -> done (6fe232e3).
## Observations: 3 -> blocks/L/observations.md. 1 promoted (BUILD #11).
- **OBS-W25-1 guard-adversarial-self-test -> BUILD #11 PROMOTED** [karen APPROVE w/ byte-corrected trim 117/98 — pre-authored 122/108 over-count caught]. 2nd sighting: wave-24 WORM-check bypasses (schema-qualified DML + hollow-coverage) + wave-25 rate-limiter defects (replica-bypass, email-keying-to-IP, fail-open-any-error) — same class (guard authored, happy-path-only tests, adversarial review found bypass inputs). DISTINCT from #4/#9/#10 (migration-specific) — #11 is the guard-self-test-adversariality author obligation.
- **OBS-W25-2 (DEFECT-1 unjournaled-migration-is-dead-code):** NOT promoted — BUILD #4 (migration journaling) already covers it; noted the CI-enforcement gap (a check that a migration SQL has a journal entry) as a future mechanical-enforcement opportunity. HELD.
- **OBS-W25-3 / Actions-minutes (3rd sighting, now independent-session):** HOLD elevated — slot taken + remediation partially founder-dependent (billing ceiling), borderline CI-principle quality.
- Held forward: OBS-W25-2 (unjournaled-migration-CI-enforcement), Actions-minutes (elevated), readTail-RLS-exempt, NaN-seed, auth-security-integration-probe (test-hardening).
## Promotion applied (1): BUILD-PRINCIPLES.md — rule 11 (guard/CI-check fault-injection fixtures per bypass class).
```yaml
l_stage_verdict: COMPLETE
tasks_marked_done: [6fe232e3]
promotions_applied: [{file: BUILD-PRINCIPLES.md, rule: guard-fault-injection-fixtures-per-bypass-class}]
held_next_wave: [OBS-W25-2-unjournaled-migration-CI-check, actions-minutes-elevated, readTail-RLS-exempt, auth-security-integration-probe]
note: "11 principles promoted this session: T-4 #1/#2/#3, VERIFY #3, BUILD #8/#9/#10/#11, CI #1/#2, PRODUCT #1"
```
