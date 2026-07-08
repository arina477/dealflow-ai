# Wave 29 — L-block Observations (knowledge-synthesizer)

**Wave:** 29 — M10 records-VIEW deal-activity browse (paginated; RLS-browse-isolation; advisor RBAC).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 20–29 (prior observations waves 20–28 fully read; wave-28 carry-forward queue audited below).
**Net pre-promotion candidates:** 0 PROMOTIONS. 1 new observation filed (assert-by-type); HOLD at first sighting. All held candidates recurrence-audited.

---

## Observation ledger

### OBS-W29-1 — Assert that a thrown error has the expected type (instanceof), not that its message matches a pattern (NEW; first sighting; HOLD)

**What (C-1 false-RED):** A test for RBAC enforcement asserted the thrown exception by matching its message string against `/forbidden|403/i`. The service throws a typed `ForbiddenException`. The exception message did not contain "403", so the regex never matched, causing a false-RED. Fix: `.rejects.toBeInstanceOf(ForbiddenException)`.

**Generalizable kernel:** When asserting that a thrown error is a specific error condition, match the error's type (class / constructor) not its message string. Message strings are implementation details — they can change independently of the error contract. Type identity is the stable, authoritative signal. Message-string matching produces either false-REDs (too strict, message doesn't contain the substring) or false-GREENs (too loose, any error with that word in its message passes). Type-assertion is falsifiable, stable, and directly encodes the contract.

**Distinction from existing rules:**
- BUILD-PRINCIPLES 1–11: none covers error-assertion style.
- OBS-W27-1 (tautology — producer vs. consumer): that observation is about a test that pre-injects the signal it is supposed to verify the system emits. OBS-W29-1 is about choosing the wrong attribute to assert on a thrown error. Structurally distinct.
- No existing T-layer principle covers instanceof-vs-message-string assertion.

**Is this 2-wave?** First sighting as a named observation. The specific failure mode (message-string regex on a typed exception) has not appeared in any prior L-block observation file (waves 20–28 audited). HOLD pending second occurrence.

**Severity:** low (false-RED only — CI caught it as a failure; the test was too strict; no defect shipped; no false-GREEN). The impact is low: a mis-authored test broke CI without a real defect, and was fixed in C-1. No production consequence.

**Promotion status:** HOLD (first sighting; 2-wave bar not met; severity low — false-RED, not false-GREEN; 1-wave).

**Candidate principles file (if second sighting confirms):** BUILD-PRINCIPLES or a T-layer file covering integration/contract tests. Pre-authored candidate (format-checked; DO NOT promote until 2nd sighting):

```
N. Assert a thrown error by its type (instanceof / toBeInstanceOf), not by matching its message string.
   Why: Message strings are implementation details; a message-match causes false-REDs or false-GREENs when the message changes.
```

Rule = 97 chars (<=120). Why = 92 chars (<=100). Exactly 2 non-empty lines. Both end in period. No forbidden tokens. FORMAT VALID.

**Source artifacts:**
- `process/waves/wave-29/stages/C-1-pr-ci-merge.md` (false-RED: RBAC test matched `/forbidden|403/i` against ForbiddenException message; fixed to toBeInstanceOf).

---

## Wave-29 notable event analysis

### EVENT-W29-A — findDealRowsBounded reuse for paginated browse (POSITIVE; no new observation; reuse-done-right)

**What:** The browse API reused the existing `findDealRowsBounded` RLS join rather than duplicating a parallel query path. `DealActivityTable` mirrors the structure of `AuditLogTable` intentionally. No defect; no novel gap.

**Why not a new observation:** This is the positive counterpoint to wave-27's OBS-W27-3 (duplicate-surface-before-spec). Wave-27's lesson was: "check for an existing implementation before speccing a new surface." Wave-29 is the success case — the spec correctly identified the existing query and reused it. It confirms the process is working. Clean reuse does not generate a new principle (that would be tautology). Informational/positive only.

### EVENT-W29-B — RLS-browse-isolation + READ-ONLY + advisor-RBAC (POSITIVE; gate-and-spec working as designed)

**What:** All three isolation dimensions (RLS, read-only role, RBAC) were delivered and tested cleanly as dealflow_app. Follows the pattern of wave-28 EVENT-W28-C.

**Why not a new observation:** Same rationale as wave-28 EVENT-W28-C. BUILD rule 9 already mandates runtime-role e2e before B-6. Gate and spec working as designed. Informational/positive.

---

## Carry-forward holds recurrence audit (waves 20–29)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W27-1 Test fabricates the signal it verifies | NON-RECURRENCE (no producer-vs-consumer tautology pattern). | HOLD unchanged (first sighting; test-writing-principles candidate; genuine kernel) |
| OBS-W27-2 Inverted spec premise | NON-RECURRENCE (no inverted security premise in spec). | HOLD unchanged (first sighting; P-4 gate already catches) |
| OBS-W27-3 Duplicate-surface before spec | NON-RECURRENCE (EVENT-W29-A is the success/reuse case). | HOLD unchanged (first sighting; security-auditor already covers) |
| OBS-W27-4 Baseline siblings green before fix | NON-RECURRENCE (no mid-wave fix-regression cycle involving sibling tests). | HOLD unchanged (first sighting; genuine kernel; distinct) |
| OBS-W25-2 Mock concurrency tautology | NON-RECURRENCE (no read-then-write in-memory-mock pattern). | HOLD unchanged (first sighting; BUILD candidate) |
| OBS-W26-2 MG1 docs/guard-freeze | NON-RECURRENCE. | HOLD unchanged |
| OBS-W26-3 Boot-safety startup-assert | NON-RECURRENCE. | HOLD unchanged |
| OBS-W23-2 NaN-seed in reduce | NON-RECURRENCE. | HOLD unchanged |
| OBS-W20-2 readTail-RLS-exempt | NON-RECURRENCE (no shared-infra read path touched). | HOLD unchanged (strong; load-bearing M11) |
| OBS-W21-3 P-0 process-theater | NON-RECURRENCE. | HOLD unchanged (informational) |
| OBS-W20-3 P-4 three-layer defense | NON-RECURRENCE. | HOLD unchanged (informational) |
| OBS-W19-4 P-4 obligation | NON-RECURRENCE. | HOLD unchanged (informational) |
| OBS-W18-5 T-9 journey-map skipped | NON-RECURRENCE. | HOLD unchanged (informational) |
| OBS-W17-2 Vacuous RLS | NON-RECURRENCE. | HOLD unchanged (VERIFY #4 provisional) |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER | NON-RECURRENCE. | HOLD unchanged (BUILD #12+ provisional) |
| OBS-W17-5 SET utility-statement bind-param | NON-RECURRENCE. | HOLD unchanged (informational) |
| Remaining inherited holds (W16-2/W16-6/W14-3/W14-2/W13-1/W15-4/W15-5/W12-2/W11-1/W12-1) | All NON-RECURRENCE. | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Verdict |
|---|---|---|---|---|
| OBS-W29-1 Assert-by-type not message-string | W29 only | low (false-RED; no defect shipped) | NO (first sighting; 2-wave bar not met) | HOLD (first sighting) |
| All held candidates (W27-1, W27-4, W27-2, W27-3, W25-2, W26-2, W26-3, W23-2, W20-2, informational) | 1-wave each | n/a | NO (none recurred this wave) | HOLD unchanged |

**assert-by-type promotion judgment (explicit):** The lesson is real and generalizable — type-identity is more stable than message strings for error assertions. Not covered by any existing principle. However: (1) first sighting only — 2-wave bar not met; (2) severity is low — produced a false-RED, not a false-GREEN; the test was over-strict and caught by CI immediately; (3) the fix is standard Jest practice. All three of these points cut against promotion at 1 sighting. The promotion bar is high (12 principles promoted across the session history). Promoting a 1-wave, low-severity test nit would dilute the canon. NO PROMOTION this wave. Filed as OBS-W29-1 for carry-forward.

**Carry-forward queue after wave-29** (1 addition: OBS-W29-1):

- OBS-W29-1 — Assert-by-type not message-string (HOLD, first sighting; low severity false-RED; BUILD or T-layer candidate; promote if second wave surfaces an error assertion that passes/fails wrongly because of message-string matching).
- OBS-W27-1 — Test fabricates the signal it verifies (HOLD, first sighting; test-writing-principles candidate; distinct from BUILD #11 and OBS-W25-2; pre-authored text format-valid; promote if a second wave surfaces a test that short-circuits the producer by pre-injecting its output signal).
- OBS-W27-4 — Baseline siblings green before fix (HOLD, first sighting; genuine kernel; distinct from BUILD rule 9 and T-4 rules 1-3; promote if a second wave surfaces a fix-introduced regression caught by sibling baseline).
- OBS-W27-2 — Inverted spec premise (HOLD, first sighting; P-4 gate already catches; promote only if false premise slips through P-4 into implementation).
- OBS-W27-3 — Duplicate-surface-before-spec (HOLD, first sighting; security-auditor already covers; promote only if second wave shows duplicate surface slipping to implementation).
- OBS-W25-2 — Mock concurrency tautology (HOLD, BUILD candidate, first sighting).
- OBS-W26-2 — MG1 docs/guard-freeze (HOLD, first sighting).
- OBS-W26-3 — Boot-safety startup-assert (HOLD, first sighting).
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
observations_emitted: 1
promotion_grade: none
promotion_reasoning: >
  Assert-by-type (OBS-W29-1): the lesson is generalizable and not covered by existing
  principles. However it is a first sighting, severity is low (false-RED only — no defect
  shipped, caught immediately by CI), and the fix is standard Jest practice. The 2-wave bar
  is not met. With 12 principles already promoted across the session, the bar is high.
  Promoting a 1-wave low-severity test nit would dilute the canon. NO PROMOTION.

  All held candidates: none recurred this wave. No held candidate cleared the 2-wave +
  generalizable + not-already-enforced bar. HOLD unchanged for all.
hold:
  - OBS-W29-1 (assert-by-type not message-string; first sighting; low severity; BUILD or T-layer candidate)
  - OBS-W27-1 (test fabricates the signal it verifies; first sighting; test-writing-principles candidate; distinct kernel)
  - OBS-W27-4 (baseline siblings green before fix; first sighting; genuine kernel; distinct)
  - OBS-W27-2 (inverted spec premise; first sighting; P-4 gate already catches)
  - OBS-W27-3 (duplicate-surface-before-spec; first sighting; security-auditor already covers)
  - OBS-W25-2 (mock concurrency tautology; first sighting)
  - OBS-W26-2 (MG1 docs/guard-freeze; first sighting)
  - OBS-W26-3 (boot-safety startup-assert; first sighting)
  - OBS-W23-2 (NaN-seed in reduce; first sighting)
  - OBS-W20-2 (readTail-RLS-exempt; first sighting strong)
  - (plus 7 informational/provisional inherited holds unchanged)
assert_by_type_promotion_verdict: >
  Not-already-covered passes (no existing principle). Generalizable passes. 2-wave bar
  fails (first sighting only). Severity is low (false-RED, not false-GREEN; CI caught
  immediately; no defect shipped). Filed as OBS-W29-1 for carry-forward.
build_principles_current_rule_count: 11    # rules 1-11 present entering wave-29; no new rule promoted this wave
```
