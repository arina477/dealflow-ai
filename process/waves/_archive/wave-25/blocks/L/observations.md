# Wave 25 — L-block Observations (knowledge-synthesizer)

**Wave:** 25 — M10 auth-hardening (rate-limiting on `/auth/*`, missing-invite 500→400, logout anti-CSRF verify).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 20–25 (prior observations waves 20–24 fully read; wave-24 carry-forward queue audited below).
**Net pre-promotion candidates:** 1 PROMOTION (OBS-W24-2 guard adversarial self-test — 2-wave bar met via wave-24 WORM-check bypass + wave-25 rate-limiter bypass). 2 new HOLDs (DEFECT-2 mock concurrency tautology; Actions-minutes 3rd sighting elevated). DEFECT-1 unjournaled migration is NOT a new observation — BUILD rule 4 already encodes the lesson.

---

## DEFECT-1 disposition — NOT a new observation (BUILD rule 4 already exists)

DEFECT-1: migration 0019_rate_limit_hits.sql had no `_journal.json` entry → drizzle skipped it → the rate-limit table was never created in prod → the feature was silently dead-code (fail-open on every request). Caught at B-6.

BUILD-PRINCIPLES rule 4 (promoted in a prior wave) already reads: "Any hand-authored drizzle migration must appear in `_journal.json` with a `when` greater than all prior entries. Why: drizzle skips a migration with a missing or stale `when` while reporting success."

This is the identical lesson. DEFECT-1 is a violation of an existing rule, not a new pattern. Not filed as a new observation or promotion candidate. The lesson is already encoded; the enforcement gap (no CI check to verify journal coverage, analogous to the wave-24 worm-migration check) is noted as a future mechanical-enforcement opportunity but does not clear the 1st-sighting bar as its own principle.

---

## Observation ledger

### OBS-W25-1 — OBS-W24-2 guard adversarial self-test: 2nd sighting confirmed (PROMOTION; BUILD #11; 2-wave: wave-24 WORM-check bypass + wave-25 rate-limiter bypass)

**What:** Wave-24 first sighting (OBS-W24-2, HOLD): the WORM-migration CI check shipped to B-6 /review with two distinct bypass paths neither the author nor the initial self-test caught — schema-qualified DML escape (`UPDATE public.audit_log_entries` evaded the original DML regexes) and hollow-coverage (existsSync-only marker; a stub file passed without any real populated-DB assertion). Both were caught at B-6 adversarial review Phase 2. Fix: 8 fault-injection `toBe(false)` bypass fixtures added, bringing total to 16.

Wave-25 second sighting: the rate-limiter middleware (itself a guard) shipped to B-6 and /review with multiple bypass paths not probed by its own tests:

1. **Replica bypass:** The limiter was in-memory-per-instance — bypassable across replicas with no shared store. No test probed multi-instance behavior. Fix: Postgres-backed shared counter.
2. **Body-parsing fallback (DEFECT-3):** The middleware ran BEFORE body-parsing → could not read the request body → rate-keying silently fell back from per-account to per-IP. The tests never validated which key was actually used in a body-unparsed context. Fix: buffer body before rate-key extraction.
3. **Fail-open on ANY error (P2-C):** The limiter failed open on ANY exception, not just connection-class errors. A code bug silently disabled the limiter. No test probed fail-behavior on a non-connection exception. Fix: tighten fail-open scope to connection errors only.

All three bypass paths were caught at B-6 and /review gates, not by the guard's own test suite.

**Shared class (both waves):** A guard (security mechanism, CI enforcer, middleware) shipped to review with bypass-class inputs that its own self-tests did not probe. The B-6 adversarial review caught the bypasses in both waves. The fix in both waves was adding explicit bypass-class fixtures or behavioral probes that the author had not authored before review.

**Is this the same lesson as OBS-W24-2?** Yes. OBS-W24-2's kernel: "A mechanical guard or CI check must include fault-injection fixtures for each bypass class, not only happy-path tests." A rate-limiter middleware IS a mechanical guard. Its self-tests exercised the happy path (basic limit enforcement) without probing bypass inputs (replica state, body-absent context, non-connection exceptions). This matches the exact class.

**Distinction from wave-24:** Wave-24's bypass inputs were adversarial string inputs (schema-qualified DML, hollow file). Wave-25's bypass inputs were architectural (replica state), runtime-ordering (body not yet parsed), and error-class (non-connection exception). The class is the same but the bypass modalities differ — which broadens the generalization rather than narrowing it.

**2-wave bar:** Two distinct waves, two distinct guard implementations, same pattern: (a) a guard was authored; (b) the guard's tests did not include bypass-class probes; (c) B-6 adversarial review found the bypasses; (d) fix added bypass-class tests. Bar met.

**Promotion criteria:**
- Generalizable: yes — any project with security-enforcing middleware, CI compliance checks, or policy-enforcement gates faces this class whenever bypass-class inputs are not adversarially probed.
- Falsifiable: yes — a guard whose self-test suite contains no fixture asserting a bypass-class input is rejected fails this rule. A reviewer can check: does the test file include at least one `expect(limitExceeded(bypassInput)).toBe(false)` class of assertion?
- Cited: 2-wave artifact chain (OBS-W24-2 `process/waves/_archive/wave-24/blocks/L/observations.md` §OBS-W24-2; wave-24 B-6-review.md §Phase 2 P1#1 + P1#2; wave-25 B-6 and /review gate catches on replica bypass + body-parsing fallback + fail-open-any-error).

**Near-dup check:** BUILD rules 1–10 reviewed. No existing rule covers "guard self-tests must include bypass-class fixtures." Rule 9 covers real-DB e2e fixture setup; rule 10 covers populated-DB migration tests. Both are distinct. VERIFY-PRINCIPLES rule 2 covers the reviewer's adversarial posture; this rule covers the AUTHOR's pre-review obligation. Distinct.

**Candidate principles file:** BUILD-PRINCIPLES. Current rule count: 10. This is #11.

**BUILD-PRINCIPLES #11 promotion entry (format-checked against Contract for new rules):**

```
11. A mechanical guard or CI check must include fault-injection fixtures for each bypass class, not only happy-path tests.
    Why: Happy-path-only self-tests leave unprobed bypass inputs able to pass a guard that should block them.
```

Rule line: 118 chars (≤120). Why line: 100 chars (≤100). Exactly 2 non-empty lines. Both end in period. No `we`/`our`/`the team`. No `wave-<N>`. No em-dash. No parenthetical longer than 5 words. FORMAT VALID.

**Promotion status:** PROMOTION-GRADE (2-wave: wave-24 WORM-check bypass + wave-25 rate-limiter bypass; THE promotion for wave-25). Karen vets; orchestrator promotes; ≤1/file/wave cap.

**Source artifacts:**
- `process/waves/_archive/wave-24/blocks/L/observations.md` §OBS-W24-2 (first sighting; pre-authored text; BUILD candidate; HOLD).
- `process/waves/_archive/wave-24/stages/B-6-review.md` §Phase 2 (P1 #1: schema-qualified DML escape; P1 #2: hollow-coverage bypass).
- `process/waves/wave-25/stages/B-2-backend.md` (rate-limiter implementation; in-memory-per-instance; body-parsing order; fail-open scope).
- Wave-25 B-6 and /review gate artifacts (replica bypass, DEFECT-3 body-parsing fallback, P2-C fail-open catch).
- `process/waves/wave-25/stages/V-1-karen.md` (V-1 gate — rate-limiter defect confirmation).

---

### OBS-W25-2 — Concurrency-sensitive logic tested only against an in-memory mock is a tautology (NEW; first sighting; HOLD)

**What (DEFECT-2):** The rate-limiter's atomicity was validated against an in-memory mock: a SELECT-then-UPDATE sequence on an object in memory serializes trivially (JavaScript is single-threaded; the mock's reads and writes never interleave). A test using this mock passes regardless of whether the implementation actually handles concurrent requests atomically. The defect was caught at B-6: real Postgres concurrent writes expose actual race conditions because multiple connections can read the same stale count before any write commits. Fix: test concurrency against a real Postgres connection with concurrent request simulation.

**Generalizable kernel:** Any guard or counter that relies on a read-then-write (check-then-act) pattern on shared mutable state must be tested against the real concurrency primitive, not an in-memory stand-in. An in-memory mock always passes a serialized test; a real Postgres connection with concurrent writers will expose the window between the read and the write. The tautology is structural: mocks serialize by construction, so a concurrency test against a mock tests nothing.

**Distinction from existing rules:** BUILD rule 9 covers real-DB e2e fixtures for correctness against the migrated schema. This observation is about concurrency semantics specifically — that mocks eliminate the interleaving that makes concurrency tests meaningful. Distinct enough to hold independently.

**Is this 2-wave?** First sighting as a named observation. No prior L-2 wave explicitly covers "concurrency tested against an in-memory mock is a tautology." HOLD pending second occurrence.

**Candidate principles file:** BUILD-PRINCIPLES (implementation obligation; would be #12 or later depending on queue resolution).

**Pre-authored BUILD candidate (format-checked; DO NOT promote until 2nd sighting):**

```
X. Test concurrency-sensitive read-then-write logic against a real Postgres connection, not an in-memory mock.
   Why: A mock serializes reads and writes by construction, so a concurrency test against it proves nothing.
```

Rule: "Test concurrency-sensitive read-then-write logic against a real Postgres connection, not an in-memory mock." = 107 chars (≤120). Why: "A mock serializes reads and writes by construction, so a concurrency test against it proves nothing." = 100 chars (≤100). Exactly 2 non-empty lines. Both end in period. No forbidden tokens. FORMAT VALID.

**Severity:** warning (the atomicity gap would have caused double-spend / double-count under concurrent load; caught at B-6 before shipping; no production impact from this specific defect given the in-memory limiter itself was also caught as an architectural bypass).

**Promotion status:** HOLD (first sighting; genuine kernel; distinct from existing rules; 1-wave).

**Source artifacts:**
- Wave-25 B-6 review catch (DEFECT-2: SELECT-then-UPDATE mock tautology).
- Wave-25 rate-limiter implementation (in-memory mock for unit test; Postgres-backed concurrency fix).

---

### OBS-W25-3 — GitHub Actions minutes exhaustion: 3rd sighting, independent-session condition met (HOLD elevated; CI-PRINCIPLES candidate)

**What:** Wave-25 C-1 stage escalated: Actions withheld CI runs again — 0 check-suites on the initial push at commit 704ba83 (2nd same-day minutes exhaustion within wave-25, per the escalation commit message). This mirrors wave-22 and wave-23 first/second sightings but occurs in a new billing cycle after the spending limit was raised at wave-23 and after wave-24 had no occurrence.

**Recurrence analysis:**
- Wave-22: first occurrence (same-session billing limit; spending limit not yet raised; HOLD OBS-W22-2).
- Wave-23: second occurrence (same billing cycle, OBS-W23-3; spending limit raised mid-wave by founder; still treated as same-session incident).
- Wave-24: NO occurrence (limit raised; tooling-only wave; low CI volume).
- Wave-25: 3rd occurrence, different billing cycle, different wave, high CI volume (auth-hardening + full test suite). Independent-session condition met.

**Independent-session assessment:** The hold condition from wave-24 was "promote on next independent-session occurrence." Wave-25 is a distinct billing cycle (founder had raised the limit; it was exhausted again by wave-25 volume). This IS an independent-session occurrence.

**Why still HOLD despite meeting the independent-session condition:**
1. The promotion slot for this wave is taken by OBS-W25-1 (BUILD #11; ≤1 promotion per file per wave).
2. More importantly: the root cause is a billing-limit ceiling that the agent cannot query or raise autonomously. A CI-PRINCIPLES rule phrased as "verify Actions spending-limit headroom before starting a CI-heavy wave" is technically actionable (GitHub billing API is queryable) but the remediation when the balance is low requires founder action (raise the limit or switch to a paid runner). This makes the rule partially operational rather than purely a CI authoring principle.
3. The pre-authored OBS-W22-2 text is described as format-valid in the wave-24 ledger but is not available in this session for direct verification. Defer promotion to a wave where: (a) the slot is open, (b) the pre-authored text can be verified or re-authored against the CI-PRINCIPLES Contract.

**Severity:** operational-blocker (wave-25 C-1 required escalation; CI runs were withheld; no merge occurred until the issue was resolved; no data loss or correctness impact, but wave velocity was materially blocked).

**Promotion status:** HOLD elevated (3rd sighting, independent-session condition met, slot taken this wave; prioritize for CI-PRINCIPLES promotion in next wave with available slot; re-verify pre-authored OBS-W22-2 text against Contract before promoting).

**Source artifacts:**
- `process/waves/wave-25/stages/C-1-pr-ci-merge.md` (Actions withheld; 0 check-suites on 704ba83).
- Wave-22 OBS-W22-2 (first sighting; pre-authored text in wave-22 observations).
- `process/waves/_archive/wave-24/blocks/L/observations.md` §carry-forward (OBS-W22-2/W23-3 hold status + pre-authored text reference).
- Escalation commit: `2a776bc` (message: "C-1 ESCALATE — Actions withholding runs AGAIN (0 check-suites @704ba83, 2nd same-day minutes exhaustion)").

---

## Carry-forward holds recurrence audit (waves 20–24)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W24-2 Guard adversarial self-test (BUILD #11 candidate) | RECURRENCE — wave-25 rate-limiter had bypass paths not probed by self-tests; caught at B-6 + /review. | PROMOTION-GRADE via OBS-W25-1 — THE promotion this wave |
| OBS-W23-2 NaN-seed in reduce (BUILD candidate X, 1-wave) | NON-RECURRENCE (auth-hardening wave; no reduce/accumulator pattern authored). | HOLD unchanged (first sighting; genuine kernel; 1-wave) |
| OBS-W20-2 Global shared-infra read RLS-exempt (BUILD #X, 1-wave strong) | NON-RECURRENCE (no shared-infra read path touched; rate-limiter backed by Postgres but keyed per-account/IP, not a shared-infra read exemption). | HOLD unchanged (first sighting; strong; load-bearing M11) |
| OBS-W22-2/W23-3 GitHub Actions minutes exhaustion (CI-PRINCIPLES X, elevated) | RECURRENCE (independent-session 3rd sighting; see OBS-W25-3). | HOLD elevated (slot taken; re-verify pre-authored text at next slot) |
| OBS-W21-3 P-0 process-theater avoidance (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W20-3 P-4 three-layer defense meta (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W19-4 P-4 obligation as lesson-forwarding (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W18-5 T-9 journey-map skipped (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-2 Vacuous RLS under BYPASSRLS (VERIFY #4 provisional) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER (BUILD #12+ provisional) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-5 SET utility-statement bind-param (informational) | NON-RECURRENCE. | HOLD unchanged |
| Other inherited holds (W16-2/W16-6/W14-3/W14-2/W13-1/W15-4/W15-5/W12-2/W11-1/W12-1) | All NON-RECURRENCE. | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W25-1 Guard adversarial self-test (OBS-W24-2 confirmed) | W24 WORM-check bypass + W25 rate-limiter bypass | warning | YES (generalizable + falsifiable + 2-wave cited) | BUILD-PRINCIPLES (#11) | PROMOTION-GRADE (THE promotion this wave) |
| OBS-W25-2 Mock concurrency tautology (DEFECT-2) | W25 only | warning | 2-wave bar NOT met; first sighting; distinct kernel | BUILD-PRINCIPLES (X, tentative #12+) | HOLD (first sighting) |
| OBS-W25-3 Actions minutes 3rd sighting | W22 + W23 + W25 (independent-session met) | operational | Independent-session condition met; slot taken; rule-quality borderline | CI-PRINCIPLES (X, tentative) | HOLD elevated (slot taken; prioritize next wave) |
| DEFECT-1 Unjournaled migration | W25 | warning | BUILD rule 4 already exists — not a new candidate | N/A | NOT FILED (rule 4 encodes the lesson) |

**Carry-forward queue after wave-25:**

- OBS-W25-2 — Mock concurrency tautology (HOLD, BUILD candidate X, first sighting; pre-authored text format-valid; target ~#12+ after queue resolves).
- OBS-W25-3 — GitHub Actions minutes exhaustion (HOLD elevated, CI-PRINCIPLES candidate, 3rd sighting, independent-session condition met; promote at next open slot; re-verify OBS-W22-2 pre-authored text against Contract).
- OBS-W24-2 / OBS-W25-1 — PROMOTED this wave (BUILD #11).
- OBS-W23-2 — NaN-seed in reduce (HOLD, BUILD candidate, first sighting; genuine kernel; carry forward unchanged).
- OBS-W20-2 — readTail-RLS-exempt (HOLD, BUILD candidate, first sighting strong; carry forward unchanged).
- OBS-W21-3 — P-0 process-theater (informational; carry forward).
- OBS-W20-3 — P-4 three-layer defense (informational; carry forward).
- OBS-W19-4 — P-4 obligation (informational; carry forward).
- OBS-W18-5 — T-9 journey-map skipped (informational; carry forward).
- OBS-W17-2 — Vacuous RLS (VERIFY #4 provisional; carry forward).
- OBS-W17-4 — Pre-GUC guard SECURITY DEFINER (BUILD #12+ provisional; renumbers as queue resolves).
- OBS-W17-5 — SET utility-statement bind-param (informational; carry forward).
- Remaining inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle JSONB sql-cast, W14-3 hash-excluded HMAC metadata, W14-2 differential discriminator, W13-1 mock-only derivation, W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W12-2 self-migrate race, W11-1 store-binding, W12-1 caller-FK.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 3
promotion_grade:
  - OBS-W25-1 (BUILD-PRINCIPLES #11 — guard adversarial self-test; 2-wave W24-WORM-check+W25-rate-limiter; THE promotion this wave)
promotion_grade_text: >
  11. A mechanical guard or CI check must include fault-injection fixtures for each bypass class, not only happy-path tests.
      Why: Happy-path-only self-tests leave unprobed bypass inputs able to pass a guard that should block them.
build_11_rule_chars: 118    # ≤120
build_11_why_chars: 100     # ≤100
build_11_format_valid: true
hold:
  - OBS-W25-2 (mock concurrency tautology; first sighting; BUILD candidate X; distinct kernel; 1-wave)
  - OBS-W25-3 (Actions minutes 3rd sighting; independent-session met; slot taken; CI-PRINCIPLES candidate elevated)
defect_1_disposition: "NOT FILED — BUILD rule 4 already encodes the unjournaled-migration lesson; violation of existing rule, not new pattern"
obs_w24_2_promotion_rationale: "2-wave: W24 WORM-check bypass (schema-qualified DML + hollow-coverage) + W25 rate-limiter bypass (replica, body-parse, fail-open-any-error); both caught at B-6 adversarial review"
nan_seed_hold: unchanged          # OBS-W23-2; no 2nd sighting
readtail_rls_exempt_hold: unchanged   # OBS-W20-2; no 2nd sighting
actions_minutes_hold: elevated    # OBS-W22-2/W23-3/W25-3; 3rd sighting; independent-session condition met; slot taken
build_principles_current_rule_count_after_promotion: 11   # rules 1-10 present before wave-25; #11 = OBS-W25-1 on karen+orchestrator promotion
```
