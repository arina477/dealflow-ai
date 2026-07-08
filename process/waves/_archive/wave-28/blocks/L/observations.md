# Wave 28 — L-block Observations (knowledge-synthesizer)

**Wave:** 28 — M10 RETENTION policy (light; UI wave; WORM-preserving).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 20–28 (prior observations waves 20–27 fully read; wave-27 carry-forward queue audited below).
**Net pre-promotion candidates:** 0 PROMOTIONS. 0 new observations filed (wave executed cleanly; no new defect or gap). All held candidates recurrence-audited.

---

## Observation ledger

No new observations this wave. Wave-28 ran with no defects escaping any gate. The three notable events (RLS on new table, WORM-preservation, isolation-role discipline) are all process-working-as-designed outcomes, not new principle gaps — analysis below.

---

## Wave-28 notable event analysis

### EVENT-W28-A — Explicit RLS on a new tenant table (POSITIVE; not a new observation; gate-working-as-designed; NO PROMOTION)

**What:** The new `retention_policy_config` table required explicit `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + a workspace-scoped policy + `GRANT` to the runtime role. The P-4 gate (security-auditor) and the spec ACs explicitly required this. The build correctly delivered it. C-1 CI verified it enforced in-database under the runtime role.

**Why not a new observation:** This is the P-4 gate and security-auditor working as designed. Wave-27 OBS-W27-2 was already held for the cognate case (inverted RLS premise caught by P-4) with the explicit reasoning "the P-4 gate mandate already requires reviewers to read actual schema/migrations" — promote only if a false premise slips through P-4 into implementation. Wave-28 is the complementary success case: the gate guided the spec correctly, and the build complied. Neither wave had RLS missing on a new table reach production. This does not clear "not-already-enforced" — the P-4 security-auditor mandate explicitly checks RLS on new tables per-wave.

**RLS-on-new-table promotion judgment (explicit):** The lesson is real and generalizable. Two exposures exist (wave-27 catch of inverted premise; wave-28 correct delivery). However the "not-already-enforced" criterion fails: the P-4 gate's security-auditor mandate already explicitly checks ENABLE+FORCE RLS on new tables; the spec ACs encoded the requirement; the build and CI verified it. A BUILD principle restating "a new tenant table needs its own explicit ENABLE+FORCE RLS policy + GRANT" would be redundant with the mechanism that already enforces it. The gate reliably catches it. Promoting a principle the gate already reliably enforces dilutes the canon. NO PROMOTION.

**Severity:** informational/positive (gate and build working as designed; no gap).

---

### EVENT-W28-B — WORM-preservation delivered cleanly (POSITIVE; no new observation)

**What:** Config changes were appended to the audit log; `verifyChain` passed after a config change; no purge path was exposed. Build and spec both correctly handled WORM-preservation. No defect; no novel gap.

**Why not a new observation:** Clean delivery of a well-specified invariant. No failure mode encountered. Nothing to file.

---

### EVENT-W28-C — Isolation test run as dealflow_app, not postgres (POSITIVE; recurring discipline; no new observation)

**What:** The RET-ISO e2e ran under the `dealflow_app` runtime role, correctly avoiding the 0016 false-green trap (superuser connection masks missing GRANT and absent RLS enforcement). This is a recurring discipline already encoded as wave history — the obligation is already in the test fixture conventions and B-0/B-2 role discipline.

**Why not a new observation:** The existing BUILD rule 9 ("Run any new real-DB e2e fixture against a migrated DB with the runtime role locally before B-6 approval") covers this. No new principle gap. Recurring-discipline positive outcome.

---

## Carry-forward holds recurrence audit (waves 20–28)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W27-1 HTTP-boundary producer-vs-consumer tautology | NON-RECURRENCE (no test fabricated an output signal this wave; clean build). | HOLD unchanged (first sighting; genuine distinct kernel; test-writing-principles candidate) |
| OBS-W27-2 Inverted spec premise (P-4 catch) | NON-RECURRENCE (no inverted security premise in spec; EVENT-W28-A is the success case). | HOLD unchanged (first sighting; P-4 gate already catches; promote only if false premise slips through to implementation) |
| OBS-W27-3 Duplicate-surface before spec | NON-RECURRENCE (no duplicate surface). | HOLD unchanged |
| OBS-W27-4 Baseline sibling tests before fix | NON-RECURRENCE (no mid-wave fix-regression cycle). | HOLD unchanged (first sighting; genuine kernel; distinct) |
| OBS-W25-2 Mock concurrency tautology | NON-RECURRENCE (no read-then-write in-memory-mock pattern). | HOLD unchanged |
| OBS-W23-2 NaN-seed in reduce | NON-RECURRENCE (no reduce/accumulator pattern). | HOLD unchanged |
| OBS-W20-2 readTail-RLS-exempt | NON-RECURRENCE (no shared-infra read path touched). | HOLD unchanged (strong; load-bearing M11) |
| OBS-W26-2 MG1 docs/guard-freeze | NON-RECURRENCE. | HOLD unchanged |
| OBS-W26-3 Boot-safety startup-assert | NON-RECURRENCE. | HOLD unchanged |
| OBS-W21-3 P-0 process-theater | NON-RECURRENCE. | HOLD unchanged |
| OBS-W20-3 P-4 three-layer defense | NON-RECURRENCE. | HOLD unchanged |
| OBS-W19-4 P-4 obligation | NON-RECURRENCE. | HOLD unchanged |
| OBS-W18-5 T-9 journey-map skipped | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-2 Vacuous RLS | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-5 SET utility-statement bind-param | NON-RECURRENCE. | HOLD unchanged |
| Remaining inherited holds (W16-2/W16-6/W14-3/W14-2/W13-1/W15-4/W15-5/W12-2/W11-1/W12-1) | All NON-RECURRENCE. | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | All 3 promo criteria? | Verdict |
|---|---|---|---|
| EVENT-W28-A RLS-on-new-table | W27 (OBS-W27-2 cognate) + W28 | NO — "not-already-enforced" fails; P-4 gate + security-auditor mandate + spec ACs already enforce this per-wave | NO PROMOTION |
| All held candidates | 1-wave each (unchanged) | NO — none recurred this wave | HOLD unchanged |

**Carry-forward queue after wave-28** (unchanged from wave-27 queue; no additions, no promotions):

- OBS-W27-1 — Test fabricates the signal it verifies (HOLD, first sighting; test-writing-principles candidate; promote if a second wave surfaces a test that short-circuits the producer by pre-injecting its output signal).
- OBS-W27-4 — Baseline siblings green before fix (HOLD, first sighting; genuine kernel; distinct from BUILD rule 9; promote if second wave surfaces fix-introduced regression caught by sibling baseline).
- OBS-W27-2 — Inverted spec premise (HOLD, first sighting; P-4 gate already catches; promote only if false premise slips through P-4 into implementation).
- OBS-W27-3 — Duplicate-surface-before-spec (HOLD, first sighting; security-auditor already covers).
- OBS-W25-2 — Mock concurrency tautology (HOLD, BUILD candidate, first sighting).
- OBS-W26-2 — MG1 docs/guard-freeze (HOLD, first sighting; B-6 + /review process handles it).
- OBS-W26-3 — Boot-safety startup-assert (HOLD, first sighting; C-2 gate already catches it).
- OBS-W23-2 — NaN-seed in reduce (HOLD, BUILD candidate, first sighting).
- OBS-W20-2 — readTail-RLS-exempt (HOLD, BUILD candidate, first sighting strong; load-bearing M11).
- OBS-W21-3 — P-0 process-theater (informational).
- OBS-W20-3 — P-4 three-layer defense (informational).
- OBS-W19-4 — P-4 obligation (informational).
- OBS-W18-5 — T-9 journey-map skipped (informational).
- OBS-W17-2 — Vacuous RLS (VERIFY #4 provisional).
- OBS-W17-4 — Pre-GUC guard SECURITY DEFINER (BUILD #12+ provisional; renumbers as queue resolves).
- OBS-W17-5 — SET utility-statement bind-param (informational).
- Remaining inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle JSONB sql-cast, W14-3 hash-excluded HMAC metadata, W14-2 differential discriminator, W13-1 mock-only derivation, W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W12-2 self-migrate race, W11-1 store-binding, W12-1 caller-FK.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 0
promotion_grade: none
promotion_reasoning: >
  RLS-on-new-table (EVENT-W28-A): the lesson is real and generalizable. Two cognate
  exposures exist (wave-27 OBS-W27-2 inverted-premise catch + wave-28 correct delivery).
  However "not-already-enforced" fails: the P-4 security-auditor mandate explicitly checks
  ENABLE+FORCE RLS on new tables per-wave; spec ACs encoded the requirement; CI verified
  enforcement. A BUILD principle restating what the gate reliably enforces dilutes the canon.
  Neither wave had a defect reach implementation. NO PROMOTION.

  All 17+ held candidates: non-recurrence this wave. No held candidate cleared the
  2-wave + generalizable + not-already-enforced bar. HOLD unchanged.
hold:
  - OBS-W27-1 (test fabricates the signal it verifies; first sighting; test-writing-principles candidate)
  - OBS-W27-4 (baseline siblings green before fix; first sighting; genuine kernel)
  - OBS-W27-2 (inverted spec premise; first sighting; P-4 gate already catches)
  - OBS-W27-3 (duplicate-surface-before-spec; first sighting; security-auditor already covers)
  - OBS-W25-2 (mock concurrency tautology; first sighting)
  - OBS-W26-2 (MG1 docs/guard-freeze; first sighting)
  - OBS-W26-3 (boot-safety startup-assert; first sighting)
  - OBS-W23-2 (NaN-seed in reduce; first sighting)
  - OBS-W20-2 (readTail-RLS-exempt; first sighting strong)
  - (plus 8 informational/provisional inherited holds unchanged)
rls_new_table_promotion_verdict: >
  not-already-enforced criterion fails — P-4 security-auditor mandate + spec ACs already
  enforce ENABLE+FORCE RLS on new tables per-wave; gate is the mechanism; principle would
  be redundant. Clean delivery is NOT evidence of a principle gap.
build_principles_current_rule_count: 11    # rules 1-11 present entering wave-28; no new rule promoted
verify_principles_current_rule_count: 3    # rules 1-3 present; no new rule promoted
```
