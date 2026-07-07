# Wave 27 — L-block Observations (knowledge-synthesizer)

**Wave:** 27 — M10 recordkeeping EXPORTS.
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 20–27 (prior observations waves 20–26 fully read; wave-26 carry-forward queue audited below).
**Net pre-promotion candidates:** 0 PROMOTIONS (no candidate clears the 2-wave + generalizable + not-already-covered bar this wave). 4 new observations filed; all HOLD at first sighting.

---

## Observation ledger

### OBS-W27-1 — A test that fabricates the signal it is verifying is a tautology (NEW; first sighting; HOLD)

**What (B-6 + C-1 catch — SEC-4 manifest header):** The SEC-4 invariant required the export HTTP response to carry a `X-Export-Manifest` header. The service-layer logic was correct. However, the HTTP controller never set the header; the frontend fell back to "complete" silently. The test for this invariant fabricated the header directly in the request fixture rather than exercising the controller path that was supposed to emit it. The test passed. The invariant was dead at the transport boundary. B-6 caught it.

**Generalizable kernel:** When a test is supposed to verify that a system EMITS a signal (header, field, event), injecting that signal directly into the test fixture makes the test a tautology: it proves the consumer handles the signal, not that the producer emits it. The correct test structure drives the full producer path (controller, handler, middleware) and asserts the signal appears in the output. A test that short-circuits the producer by pre-injecting the signal cannot catch a missing producer-side implementation.

**Distinction from existing rules:**
- BUILD #11: "A mechanical guard or CI check must include fault-injection fixtures per bypass class." BUILD #11 is about probing bypass-class inputs on a security guard. The wave-27 tautology is about a test that asserts an output signal by injecting it as an input — the author tests the consumer of a signal, not its producer. These are structurally distinct failure modes.
- OBS-W25-2 (mock concurrency tautology, HOLD): OBS-W25-2 is about in-memory mocks serializing read-then-write concurrency, so a concurrency test against a mock proves nothing. The wave-27 tautology is about fabricating an output signal in the fixture, so the test cannot detect a missing producer. Both are "tautology" sub-classes but the mechanism differs: W25-2 is about concurrency semantics; W27-1 is about producer-vs-consumer coverage.
- test-writing-principles.md §12 anti-patterns: the anti-pattern "assert the data layer was called" is related (mock-call assertions prove nothing about consumer behavior). Wave-27's variant is distinct: the fixture emits the signal the test is supposed to verify the system emits.

**Is this 2-wave?** First sighting as a named observation. No prior L-2 wave has explicitly named "test fabricates the signal it is supposed to verify the producer emits." HOLD pending second occurrence.

**Candidate principles file:** test-writing-principles.md §12 Anti-patterns or §13 Auto-updated (an implementation-level test-correctness rule; alternatively BUILD-PRINCIPLES as an implementation discipline).

**Pre-authored candidate (format-checked; DO NOT promote until 2nd sighting):**

```
### N. When testing that a system emits a signal, drive the full producer path; never inject the signal into the fixture.
Why: A fixture that pre-injects the signal cannot detect a producer that never emits it.
```

Rule: "When testing that a system emits a signal, drive the full producer path; never inject the signal into the fixture." = 104 chars (<=120). Why: "A fixture that pre-injects the signal cannot detect a producer that never emits it." = 83 chars (<=100). Exactly 2 non-empty lines. Both end in period. No forbidden tokens. FORMAT VALID (test-writing-principles Contract).

**Severity:** warning-compliance (a compliance invariant — SEC-4 export manifest — was dead at the HTTP boundary; test suite was green; caught at B-6 before CI or ship).

**Promotion status:** HOLD (first sighting; genuine distinct kernel; not covered by BUILD #11 or OBS-W25-2 or existing anti-patterns; 1-wave).

**Source artifacts:**
- `process/waves/wave-27/stages/B-6-review.md` (SEC-4 manifest header missing at controller; test fabricated header in fixture).
- `process/waves/wave-27/blocks/B/gate-verdict.md` (B-6 catch on SEC-4 tautology test).

---

### OBS-W27-2 — Inverted architectural premise in a spec is undetectable by author review alone; cross-reference the actual schema (NEW; first sighting; HOLD)

**What (P-4 catch — RLS on audit_log_entries):** The P-2 spec was built on the premise "audit_log_entries has NO RLS → hand-roll a workspace_id filter." The table has FORCE RLS. All three Phase-2 P-4 reviewers caught this against the actual migrations. The inverted premise would have been the leak vector: hand-rolling a workspace_id filter on a table with FORCE RLS either duplicates correctly or — if the hand-rolled filter is subtly wrong — silently leaks rows that RLS would have blocked.

**Why HOLD despite being caught:** The P-4 gate caught this BECAUSE it cross-referenced the actual migration files. A principle encoding "verify a spec's security premise against the schema" would be true — but the P-4 gate mandate already requires reviewers to read actual schema/migrations before approving. This is a gate working as designed, not a new agent obligation gap. The lesson is: the P-4 gate's value derives specifically from reviewers reading actual schema, not relying on spec assertions. That meta-lesson is informational rather than a new falsifiable rule.

**Potential principle framing (if a 2nd sighting occurs):** "Before authoring implementation against a security-premise claim in a spec, verify the claim against the actual migration files." Target: BUILD-PRINCIPLES.

**Severity:** informational/positive (caught at P-4 gate as designed; no implementation against the false premise occurred).

**Promotion status:** HOLD (first sighting; P-4 gate already enforces the cross-reference obligation; the lesson is process-validation rather than a new agent-authoring rule; promote only if a second wave shows the false premise slipping through P-4 into implementation).

**Source artifacts:**
- `process/waves/wave-27/blocks/P/gate-verdict.md` (P-4 Phase-2 reviewers caught RLS inversion against migrations).
- `process/waves/wave-27/stages/P-2-spec.md` (false premise: no-RLS).

---

### OBS-W27-3 — Before speccing a new surface, check whether an equivalent implementation already exists (NEW; first sighting; HOLD)

**What (security-auditor catch — duplicate export surface):** A recordkeeping export surface had already shipped in a prior wave. The wave-27 spec proposed to build a new parallel export path. The security-auditor caught the duplicate. The resolution was to extend the existing surface rather than rebuild it.

**Why HOLD:** First sighting. The pattern is: spec authored without querying existing implementation inventory. The user-journey-map (`command-center/artifacts/user-journey-map.md`) and the B-0 codebase survey are the existing mechanisms for discovering prior surfaces. A principle "check for an existing implementation before speccing a new surface" is true but the P-2 Spec stage already requires a codebase survey and the security-auditor's role includes surface-duplication detection. This is a first-sighting gate-catch, not a gap in the existing process.

**Severity:** warning (would have caused duplicate surface, increased attack surface, divergent behavior between paths; caught before implementation).

**Promotion status:** HOLD (first sighting; security-auditor role already mandates this check; 1-wave; niche to export/recordkeeping surface class).

**Source artifacts:**
- `process/waves/wave-27/stages/T-8-security.md` (security-auditor catch: duplicate export surface).

---

### OBS-W27-4 — Baseline sibling tests green before applying a fix, to detect regressions in the fix itself (NEW; first sighting; HOLD)

**What (C-1 catch — PK collision + WORM hash chain corruption):** A global-sequence primary key collision in the C-1 isolation seed caused test failures. The first fix attempt resolved the PK collision but silently corrupted the WORM hash chain (because the fix changed row ordering that the hash derivation depended on). The corruption was caught because sibling tests were baselined green before the fix was applied: when the post-fix run showed the sibling chain-verify tests going RED, it was immediately recognizable as a regression introduced by the fix, not a pre-existing failure.

**Generalizable kernel:** Before applying any fix to a failing test or seed, baseline the sibling tests as green in the unfixed state. A fix that causes a previously-green sibling to go RED is itself a bug. Without the baseline, post-fix RED siblings are ambiguous: pre-existing failure or fix regression.

**Why HOLD:** First sighting. The lesson is real and distinct. BUILD rule 9 ("run any new real-DB e2e fixture against a migrated DB with the runtime role locally before B-6 approval") covers fixture correctness pre-submission, not the "baseline before fix" discipline. T-4 rule 2 ("a real-DB parallel suite must assert only its own scoped rows") covers assertion scope. Neither covers the "establish a green baseline before applying a fix" protocol. However, at 1 sighting this is HOLD.

**Severity:** warning (fix introduced a hash-chain corruption that would have broken WORM integrity; caught in-wave by sibling baseline; no production impact).

**Promotion status:** HOLD (first sighting; distinct from existing rules; genuine kernel; 1-wave).

**Source artifacts:**
- `process/waves/wave-27/stages/C-1-pr-ci-merge.md` (PK collision in seed; first fix corrupted WORM chain; sibling baseline caught regression).

---

## Carry-forward holds recurrence audit (waves 20–27)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W26-1 Actions-minutes (CI-PRINCIPLES #3) | PROMOTED wave-26. | Closed |
| OBS-W25-2 Mock concurrency tautology (BUILD candidate X) | NON-RECURRENCE (no SELECT-then-UPDATE in-memory-mock pattern this wave; the wave-27 tautology is a distinct sub-class — producer-fabrication, not concurrency-serialization). | HOLD unchanged (first sighting; genuine kernel; 1-wave) |
| OBS-W23-2 NaN-seed in reduce (BUILD candidate X) | NON-RECURRENCE (no reduce/accumulator pattern). | HOLD unchanged |
| OBS-W20-2 readTail-RLS-exempt (BUILD candidate X, strong) | NON-RECURRENCE (no shared-infra read path touched). | HOLD unchanged |
| OBS-W26-2 MG1 docs/guard-freeze (informational/positive) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W26-3 Boot-safety startup-assert (informational/positive) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W21-3 P-0 process-theater (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W20-3 P-4 three-layer defense (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W19-4 P-4 obligation (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W18-5 T-9 journey-map skipped (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-2 Vacuous RLS (VERIFY #4 provisional) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER (BUILD #12+ provisional) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-5 SET utility-statement bind-param (informational) | NON-RECURRENCE. | HOLD unchanged |
| Remaining inherited holds (W16-2/W16-6/W14-3/W14-2/W13-1/W15-4/W15-5/W12-2/W11-1/W12-1) | All NON-RECURRENCE. | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W27-1 Test fabricates the signal it is verifying | W27 only | warning-compliance | NO (first sighting; 2-wave bar not met) | test-writing-principles §13 | HOLD (first sighting; genuine distinct kernel) |
| OBS-W27-2 Inverted architectural premise in spec | W27 only | informational/positive | NO (first sighting; P-4 gate already enforces; not a new gap) | BUILD-PRINCIPLES (provisional) | HOLD (first sighting; P-4 already catches) |
| OBS-W27-3 Duplicate-surface check before speccing | W27 only | warning | NO (first sighting; security-auditor role already covers; niche) | BUILD-PRINCIPLES (provisional) | HOLD (first sighting; 1-wave; gate-catch) |
| OBS-W27-4 Baseline siblings green before applying a fix | W27 only | warning | NO (first sighting; 2-wave bar not met) | BUILD-PRINCIPLES or T-4 (provisional) | HOLD (first sighting; genuine kernel; distinct) |

**Carry-forward queue after wave-27:**

- OBS-W27-1 — Test fabricates the signal it verifies (HOLD, first sighting; test-writing-principles candidate; distinct from BUILD #11 and OBS-W25-2; pre-authored text format-valid; promote if a second wave surfaces a test that short-circuits the producer by pre-injecting its output signal).
- OBS-W27-4 — Baseline siblings green before fix (HOLD, first sighting; genuine kernel; distinct from BUILD rule 9 and T-4 rules 1-3; promote if a second wave surfaces a fix-introduced regression caught by sibling baseline).
- OBS-W27-2 — Inverted spec premise (HOLD, first sighting; P-4 gate already enforces; promote only if false premise slips through P-4 into implementation).
- OBS-W27-3 — Duplicate-surface-before-spec (HOLD, first sighting; security-auditor already covers; promote only if second wave shows duplicate surface slipping to implementation).
- OBS-W25-2 — Mock concurrency tautology (HOLD, BUILD candidate, first sighting; no 2nd sighting this wave; carry forward unchanged).
- OBS-W26-2 — MG1 docs/guard-freeze (HOLD, first sighting; carry forward unchanged).
- OBS-W26-3 — Boot-safety startup-assert (HOLD, first sighting; carry forward unchanged).
- OBS-W23-2 — NaN-seed in reduce (HOLD, BUILD candidate, first sighting; carry forward unchanged).
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
observations_emitted: 4
promotion_grade: none
promotion_reasoning: >
  HTTP-boundary tautology (OBS-W27-1): genuine kernel, distinct from BUILD #11 and OBS-W25-2,
  but first sighting only — 2-wave bar not met. No prior wave has named "test fabricates the
  signal it is supposed to verify the producer emits." HOLD.

  Inverted-premise (OBS-W27-2): P-4 gate caught this because it already mandates
  cross-referencing actual schema. Not a new agent-authoring obligation gap. HOLD.

  Duplicate-surface (OBS-W27-3): security-auditor role already mandates this check. First
  sighting; niche. HOLD.

  Baseline-siblings-before-fix (OBS-W27-4): genuine kernel, distinct from BUILD rule 9 and
  T-4 rules 1-3, but first sighting only. HOLD.
hold:
  - OBS-W27-1 (test fabricates the signal it verifies; first sighting; test-writing-principles candidate; distinct kernel)
  - OBS-W27-2 (inverted spec premise; first sighting; P-4 gate already catches; informational/positive)
  - OBS-W27-3 (duplicate-surface-before-spec; first sighting; security-auditor already covers; niche)
  - OBS-W27-4 (baseline siblings green before fix; first sighting; genuine kernel; distinct)
obs_w25_2_concurrency_tautology_distinction: >
  OBS-W25-2 is "in-memory mock serializes concurrency — test proves nothing about concurrent
  behavior." OBS-W27-1 is "fixture pre-injects the output signal the producer was supposed to
  emit — test proves nothing about whether the producer emits it." Related sub-class but
  distinct mechanism: W25-2 is concurrency semantics; W27-1 is producer-vs-consumer coverage.
  Not a near-dup of W25-2; filed independently.
build_11_distinction: >
  BUILD #11 covers bypass-class inputs on a guard (fault-injection). OBS-W27-1 covers
  a test that fabricates its own verification signal (producer-fabrication tautology).
  Structurally distinct failure modes — not a near-dup.
build_principles_current_rule_count: 11    # rules 1-11 present entering wave-27; no new rule promoted
test_writing_principles_current_rule_count: 25   # rules 1-25 present; no new rule promoted
```
