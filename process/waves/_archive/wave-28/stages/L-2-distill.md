# Wave 28 — L-2 Distill
## Task close: 4 -> done (d3cc1337 + 3 siblings).
## Observations: 0 emitted, **0 promoted** (honest — the bar is high; 12 promoted this session; promoting NOTHING is correct here).
- **RLS-on-new-table (explicit ENABLE+FORCE+policy+GRANT, per-table not inherited): NOT promoted** — the P-4 security-auditor gate ALREADY reliably enforces it per-wave (the spec ACs encode it; CI verifies enforcement in-DB under the runtime role; neither wave-27 nor wave-28 had a defect reach prod). A principle would RESTATE what the gate enforces = redundant, not a gap-closer. Same logic as OBS-W27-2 hold. The wave-28 success case reinforces the gate is working, not that a rule is missing.
- Held forward (unchanged): OBS-W27-1 (HTTP-boundary-tautology, strong), OBS-W27-4 (baseline-siblings), OBS-W25-2 (unjournaled-migration-CI-check), readTail-RLS-exempt, auth-security-integration-probe, MG1-guard-freeze, boot-safety.
## Promotion applied: NONE (correct restraint — no lesson cleared the multi-wave + generalizable + NOT-already-enforced bar).
l_stage_verdict: COMPLETE
tasks_marked_done: d3cc1337, b7786c5b, ed4945e0, ce75c6c6
promotions_applied: none (12 total this session: T-4 #1/#2/#3, VERIFY #3, BUILD #8/#9/#10/#11, CI #1/#2/#3, PRODUCT #1)
