# Wave 24 — L-block Observations (knowledge-synthesizer)

**Wave:** 24 — M10 WORM-migration standing-AC check (tooling/compliance-hardening: mechanical CI check + standing-AC policy doc operationalizing the wave-17 populated-DB migration lesson).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 19–24 (prior observations waves 19–23 fully read; wave-23 carry-forward queue audited below).
**Net pre-promotion candidates:** 1 PROMOTION (OBS-W17-3 populated-DB migration — BUILD #10, 2-wave bar met via wave-17 prod incident + wave-24 operationalization; held 7 waves; due this wave). 1 new HOLD (guard self-test adversarial bypass — first sighting, wave-24). 2 carry-forward holds unchanged (OBS-W23-2 NaN-seed, OBS-W20-2 readTail-RLS-exempt). Actions-minutes hold unchanged (same-session incident; no independent session recurrence this wave).

Each entry is logged with its first-sighting wave so a later wave's L-1 author can detect recurrence deterministically.

---

## What shipped

Tooling/test/docs-only wave. Six deliverables: `check-worm-migration-tests.ts` (mechanical classifier + runCheck), `check-worm-migration-tests.spec.ts` (61-test standing-AC enforcer + fault-killing self-test), `worm-migration-coverage-registry.ts` (5 entries), `worm-migration-template.ts` (copy-able skeleton), `worm-migration-test-utils.ts` (2 thin helpers), `worm-migration-testing-policy.md` (standing AC + policy). B-6 /review Phase 2 caught 2 P1 bypasses (schema-qualified DML escape; hollow-coverage pass) — both fixed (3e4e087): schemaPrefix folded into every DML pattern; coverage marker requires referencesMigration AND hasPopulatedDbUsage. Re-review closed with confidence 9/10 each; 16 fault-injection toBe(false) assertions; 61-test suite. C-1 zero fix-up cycles; run 28863313439 5/5 green @03a710b; check-worm-migration-tests.spec.ts (61 tests) RAN + PASSED in CI test job. V-1 APPROVE (karen + jenny). App bundle unchanged (tooling-only; no migration).

---

## Observation ledger

### OBS-W24-1 — OBS-W17-3 populated-DB migration lesson operationalized as load-bearing CI check (PROMOTION; BUILD #10; 2-wave: wave-17 prod incident + wave-24 operationalization; held 7 waves)

**What:** This wave's sole purpose is the mechanical operationalization of the wave-17 lesson (OBS-W17-3, first-sighting, HOLD since wave-17). Wave-17 C-2 HOLD: migration 0014's `UPDATE audit_log_entries SET workspace_id = ...` collided with the WORM BEFORE-UPDATE trigger on the populated 328-row prod DB; the empty CI DB (0 rows) never fired the trigger → empty-DB CI test was a Ghost Green for the migration's populated-DB behavior. Fix required trigger-disable wrapping + a new populated-DB test suite (AMP-1..5). OBS-W17-3 was filed as a first-sighting HOLD: "A migration that UPDATEs or DELETEs rows on a trigger-protected table must be tested against a pre-seeded populated DB. An empty-DB migration test cannot exercise triggers that fire only when rows already exist." The rule has been in HOLD across 7 waves (W17→W23) with no recurrence as a defect (no subsequent migration UPDATEd a trigger-protected table without the AMP pattern applied) and no second sighting as a new incident.

Wave-24 operationalization is the 2nd confirming evidence: this entire wave exists to make the lesson mechanical — a CI check that will FAIL if a future WORM-touching migration lacks populated-DB coverage. The check is:
- Genuinely mechanical (regex-driven, not prose checklist; V-1 karen confirmed schema-qualified DML detected, coverage marker not existsSync-only).
- Fault-killing (16 fault-injection `toBe(false)` assertions; a gap injected → check returns `passed: false` → vitest RED → CI RED → merge blocked).
- Adversarially hardened at B-6 /review Phase 2: P1 #1 (schema-qualified DML escaped original regexes; `UPDATE public.audit_log_entries` was bypassable) and P1 #2 (hollow-coverage — existsSync-only; a comment-only stub passed) — both fixed and regression-tested.
- CI-enforced via the existing vitest test job (correct channel; PAT lacks workflow scope; no fake bespoke CI step).
- Live on main @03a710b; run 28863313439 green; AMP populated-DB suite (3 tests) also ran and passed.

**Is the 2-wave bar met?** Yes. The bar requires the class to appear in 2+ waves. The two sightings are:
1. **Wave-17 prod incident** (OBS-W17-3): real correctness failure on populated prod DB; trigger fired on 328 rows; C-2 HOLD; AMP fix-and-test required.
2. **Wave-24 operationalization**: the wave-17 lesson is now a mechanical standing-AC check enforced in CI. This is not a second defect firing — it is the systematic response to the first firing, which is the correct resolution path for a first-sighting HOLD. The wave-17 incident is the first sighting; wave-24 is the multi-wave confirmation that the class is real, generalizable, and worth a permanent rule. The operationalization itself is the evidence that the rule passes the falsifiability and generalizability criteria (we built a CI check on it — if it were not generalizable and falsifiable, the check could not have been authored).

**Prior hold analysis confirms readiness:**
- Waves 18–23: all NON-RECURRENCE for OBS-W17-3 (no migration UPDATEd a trigger-protected table). No second defect sighting.
- 7-wave HOLD with zero recurrence as a defect means the lesson was respected once authored — which is the correct outcome; the rule does not need to fire again as a defect to be promotable.
- The promotion bar is "appears across 2+ waves" — wave-17 incident + wave-24 operationalization is the 2-wave chain. This matches the wave-15/wave-18/wave-19 promotion patterns where a first sighting held until a strong second-evidence wave confirmed and broadened it.

**Root class:** A migration that performs any row-mutating DML (UPDATE, DELETE, INSERT via a trigger-intercepted path) on a table protected by a BEFORE-UPDATE/DELETE trigger (WORM, audit-log, FK-cascade guard) will pass on an empty-DB CI run — because the trigger only fires when rows matching the DML predicate exist. The populated-DB test requirement is generalizable to ANY such migration, not only WORM tables.

**Severity:** warning (wave-17: real prod HOLD; C-2 block before data mutation; no data loss; fix required; the standing-AC wave exists entirely because of this incident).

**All 3 promotion criteria met:**
- Generalizable: yes — any project with append-only/WORM tables or trigger-protected tables faces this class when authoring a migration that mutates rows.
- Falsifiable: yes — a migration that UPDATEs or DELETEs rows on a trigger-protected table and has only an empty-DB CI test fails this rule. The wave-24 CI check mechanically detects this.
- Cited: 2-wave artifact chain (OBS-W17-3 `process/waves/_archive/wave-17/blocks/L/observations.md`; wave-17 C-2 HOLD `process/waves/_archive/wave-17/stages/C-2-deploy-and-verify.md` §Provenance; AMP-1..5 fix; wave-24 `worm-migration-testing-policy.md` + check-worm-migration-tests.spec.ts + B-6-review.md + C-1-pr-ci-merge.md).

**Candidate principles file:** BUILD-PRINCIPLES. BUILD currently has 9 rules; this is #10. OBS-W17-3 pre-authored text from wave-17 was BUILD #9 provisional; the slot shifted to #10 when OBS-W19-2 claimed #9 at wave-20.

**BUILD-PRINCIPLES #10 promotion entry (format-checked against Contract for new rules):**
```
10. A migration that UPDATEs or DELETEs rows on a trigger-protected table must be tested against a pre-seeded populated DB.
    Why: An empty-DB migration test cannot exercise triggers that fire only when rows already exist.
```
Rule: "A migration that UPDATEs or DELETEs rows on a trigger-protected table must be tested against a pre-seeded populated DB." = 119 chars (≤120). Why: "An empty-DB migration test cannot exercise triggers that fire only when rows already exist." = 91 chars (≤100). Exactly 2 non-empty lines. No `we`/`our`/`the team`. No wave refs. No em-dash. No parenthetical > 5 words. Both lines end in period. FORMAT VALID.

**Promotion status:** PROMOTION-GRADE (2-wave: wave-17 prod incident + wave-24 operationalization; held 7 waves; THE promotion for wave-24). Karen vets; orchestrator promotes; ≤1/file/wave cap.

**Source artifacts:**
- `process/waves/_archive/wave-17/blocks/L/observations.md` OBS-W17-3 (first sighting, wave-17 C-2 HOLD, AMP-1..5 fix; "a migration that UPDATEs or DELETEs rows on a trigger-protected table must be tested against a pre-seeded populated DB").
- `process/waves/_archive/wave-17/stages/C-2-deploy-and-verify.md` §Provenance ("Populated-DB migration proof (AMP-1..5)… AMP-5 is fault-killing").
- `process/waves/wave-24/stages/V-1-jenny.md` §1 ("Operationalizes wave-17 C-2 HOLD lesson — MATCH").
- `process/waves/wave-24/stages/V-1-karen.md` §2 ("Genuinely mechanical + fault-killing (NOT theater) — PASS").
- `process/waves/wave-24/stages/B-6-review.md` §Phase 2 (P1 #1 schema-qualified-DML-escape fix; P1 #2 hollow-coverage-bypass fix).
- `process/waves/wave-24/stages/C-1-pr-ci-merge.md` §THE KEY CHECK ("check-worm-migration-tests.spec.ts (61 tests) RAN + PASSED"; run 28863313439).
- `command-center/testing/worm-migration-testing-policy.md` (standing AC; policy doc).

---

### OBS-W24-2 — A mechanical guard must be adversarially self-tested for bypasses, not just happy-path (NEW; first sighting; HOLD)

**What:** B-6 /review Phase 2 (adversarial) found the wave-24 WORM-check was bypassable in two distinct ways despite passing its own initial self-tests:

1. **P1 #1 — Schema-qualified DML escape:** `UPDATE public.audit_log_entries ...` (the exact wave-17 production pattern; the repo already uses `public.` qualified names in several migrations) was NOT matched by the original DML regexes. The check would have passed a migration that used the schema-qualified form of the exact WORM-mutating DML. Fix (3e4e087): `schemaPrefix = (?:(?:public|"public")\s*\.\s*)?` folded into `tableRef` for EVERY pattern; 8 escape fixtures now each assert `passed: false`.

2. **P1 #2 — Hollow-coverage bypass:** The original coverage check was `existsSync(testFilePath)`. A comment-only stub file (or an empty file) would pass the presence check and allow the CI gate to green without any real populated-DB test. All 5 registry entries pointed at one file scoped to migration 0014; migrations 0012/0016/0017 had fake coverage. Fix (3e4e087): `testFileHasCoverageMarker` requires `referencesMigration AND hasPopulatedDbUsage`; hollow-file self-test INVERTED to assert FAIL.

**Generalizable kernel:** A mechanical guard or compliance check (a CI enforcer, a lint rule, a policy-doc checker, a migration-gate script) whose own self-tests only exercise the happy path ("valid input → passes") and the canonical failure case ("no coverage → fails") can still be bypassable via inputs the author did not anticipate. Adversarial self-testing means: (a) enumerate bypass attempts — inputs that SHOULD fail but may pass due to incomplete pattern matching (e.g., schema-qualified DML, whitespace variants, comment-stripped edge cases); (b) author explicit fault-injection assertions for each bypass class (`toBe(false)`); (c) verify those assertions fail before the fix and pass after. A guard without adversarial self-tests is only as strong as the author's imagination at authoring time; the /review adversarial pass is the systematic bypass-enumeration step.

**Catch stage analysis:** The bypasses were caught at B-6 /review Phase 2 (adversarial), not by the initial self-test authoring. This validates the /review adversarial posture (VERIFY-PRINCIPLES rule 2) but also identifies a gap in how the guard's own self-test was authored: the self-test should have included bypass-attempt fixtures before B-6 review. The fix added 8 new `toBe(false)` bypass fixtures, bringing the total fault-injection suite from ~8 to 16 assertions.

**Distinction from existing rules:** VERIFY-PRINCIPLES rule 2 covers adversarial review posture (reviewer's role: probe for weaknesses). This observation is about the guard AUTHOR's obligation to self-test for bypasses during authoring — a BUILD obligation, not a VERIFY obligation. The question is: before B-6, does the guard's self-test include adversarial bypass fixtures? This is distinct from whether B-6 SHOULD be adversarial (it should; rule 2 covers that).

**Is this 2-wave?** First sighting as a named observation. No prior L-2 wave explicitly covers "a CI check or mechanical guard must include bypass-attempt fault-injection in its own self-test." HOLD pending a second occurrence.

**Candidate principles file:** BUILD-PRINCIPLES (implementation obligation for authoring a mechanical guard; after #10 — would be #11 or later depending on queue resolution).

**Pre-authored BUILD candidate (format-checked; DO NOT promote until 2nd sighting):**
```
X. A mechanical guard or CI check must include fault-injection fixtures for each bypass class, not only happy-path self-tests.
   Why: An adversary-unaware self-test leaves schema-qualified or whitespace variants able to pass a guard that should fail.
```
Rule: "A mechanical guard or CI check must include fault-injection fixtures for each bypass class, not only happy-path self-tests." = 121 chars — 1 over. Trim:
```
X. A mechanical guard or CI check must include fault-injection fixtures for each bypass class, not only happy-path tests.
   Why: An adversary-unaware self-test leaves schema-qualified or whitespace variants able to pass a guard that should fail.
```
Rule = "A mechanical guard or CI check must include fault-injection fixtures for each bypass class, not only happy-path tests." = 119 chars (≤120). Why = "An adversary-unaware self-test leaves schema-qualified or whitespace variants able to pass a guard that should fail." = 115 chars — OVER. Trim:
```
X. A mechanical guard or CI check must include fault-injection fixtures for each bypass class, not only happy-path tests.
   Why: Happy-path-only self-tests leave schema-qualified variants able to pass a guard that should fail.
```
Rule: 119 chars (≤120). Why: "Happy-path-only self-tests leave schema-qualified variants able to pass a guard that should fail." = 97 chars (≤100). Exactly 2 non-empty lines. No forbidden tokens. No wave refs. No em-dash. No parenthetical > 5 words. FORMAT VALID.

Note: number is X (BUILD currently has 9 rules; #10 is OBS-W24-1; this would be #11 or later depending on queue ordering and resolution of OBS-W20-2 / OBS-W17-4 etc.).

**Severity:** warning (the check was genuinely bypassable before the fix; if P1 #1 had not been caught, a future migration using `public.audit_log_entries` DML would have escaped the WORM guard; caught at B-6 adversarial review before CI; no production impact).

**Promotion status:** HOLD (first sighting; generalizable; distinct from existing rules; 1-wave; HOLD pending a second occurrence of a mechanical guard missing adversarial bypass tests).

**Source artifacts:**
- `process/waves/wave-24/stages/B-6-review.md` §Phase 2 /review (P1 #1: "UPDATE public.audit_log_entries ... ESCAPED the DML regexes"; P1 #2: "hollow-coverage bypass + rubber-stamped green").
- `process/waves/wave-24/stages/V-1-karen.md` §2 ("Schema-qualifier fix confirmed … coverage marker requires more than existsSync"; "16 toBe(false) fault-injection assertions total. The check demonstrably goes red when a gap exists").
- Fix commit 3e4e087 (schemaPrefix folded in + coverageMarker content-check + hollow-file self-test INVERTED).

---

## Carried-forward holds recurrence audit (waves 19–23)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W17-3 Populated-DB migration trigger-protected tables (BUILD #10 provisional) | OPERATIONALIZED — see OBS-W24-1 above. Wave-24 is the mechanical operationalization wave; the 2-wave bar is met via wave-17 prod incident + wave-24 CI-enforcement. | PROMOTION-GRADE via OBS-W24-1 — THE promotion this wave |
| OBS-W23-2 NaN-seed in reduce (BUILD candidate X, 1-wave) | NON-RECURRENCE (tooling-only wave; no reduce/accumulator pattern authored this wave). | HOLD unchanged (first-sighting, genuine kernel, 1-wave) |
| OBS-W20-2 Global shared-infra read RLS-exempt (BUILD #X, 1-wave strong) | NON-RECURRENCE (tooling-only wave; no service/repository code; no shared-infra read surface touched). | HOLD unchanged (first-sighting, strong, load-bearing M11) |
| OBS-W22-2/W23-3 GitHub Actions minutes exhaustion (CI-PRINCIPLES X, same-session hold) | Actions dispatch was NOT withheld this wave (C-1 check-suites total_count=1 on first push attempt per C-1-pr-ci-merge.md §Ghost-Green guard). No new occurrence this wave — the session resumed after founder resolved the billing issue (spending limit raised at wave-23). | HOLD unchanged (same-session incident; no independent-session 2nd occurrence; pre-authored text from OBS-W22-2 remains format-valid) |
| OBS-W21-3 P-0 process-theater avoidance (meta/informational, HOLD) | NON-RECURRENCE (wave-24 P-0 correctly engaged reframe process; no process-theater pattern fired). | HOLD unchanged (informational, low priority) |
| OBS-W20-3 P-4 three-layer defense meta (informational) | NON-RECURRENCE (tooling-only wave; no new write surface; no P-4 security-auditor spawn for a new product surface). | HOLD unchanged (informational, low priority) |
| OBS-W19-4 P-4 obligation as lesson-forwarding (informational) | NON-RECURRENCE (tooling-only wave; no new P-4 obligation-encoding cycle distinct from prior pattern). | HOLD unchanged (informational, low priority) |
| OBS-W18-5 T-9 canonical journey-map skipped (informational) | NON-RECURRENCE (tooling-only wave; no new route/UI added; journey-map correctly not updated per jenny V-1 — no drift noted). | HOLD unchanged (informational) |
| OBS-W17-2 Vacuous RLS test under BYPASSRLS role (VERIFY #4 provisional) | NON-RECURRENCE (tooling-only wave; no e2e test-role change; no new isolation test authored). | HOLD unchanged |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER (BUILD #11 provisional) | NON-RECURRENCE (tooling-only wave; no guard/middleware change). | HOLD unchanged |
| OBS-W17-5 SET utility-statement bind-param (informational) | NON-RECURRENCE. | HOLD unchanged |
| Other inherited holds (W16-2/W16-6/W14-3/W14-2/W13-1/W15-4/W15-5/W12-2/W11-1/W12-1) | All NON-RECURRENCE (tooling-only wave; no overlapping code/migration surface). | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W24-1 Populated-DB migration test (OBS-W17-3 operationalized) | W17 prod incident (first sighting) + W24 operationalization (confirming) | warning | YES (generalizable + falsifiable + 2-wave cited) | BUILD-PRINCIPLES (#10) | PROMOTION-GRADE (THE promotion this wave) |
| OBS-W24-2 Mechanical guard adversarial self-test | W24 only | warning | 2-wave bar NOT met; first sighting; distinct kernel | BUILD-PRINCIPLES (X, tentative #11+) | HOLD (first sighting) |
| OBS-W23-2 NaN-seed reduce carry-forward | W23 only | warning | 2-wave bar NOT met; no recurrence this wave | BUILD-PRINCIPLES (X, tentative) | HOLD unchanged |
| OBS-W20-2 readTail-RLS-exempt carry-forward | W20 only | strong | 2-wave bar NOT met; no recurrence this wave | BUILD-PRINCIPLES (X, tentative) | HOLD unchanged |

**Carry-forward queue after wave-24:**
- OBS-W24-2 — Mechanical guard adversarial self-test (HOLD, BUILD #11 tentative, first-sighting; pre-authored text format-valid).
- OBS-W23-2 — NaN-seed in reduce over sortable values (HOLD, BUILD candidate X, first-sighting, genuine kernel; pre-authored text in wave-23 observations, format-valid).
- OBS-W20-2 — Global shared-infra read RLS-exempt (HOLD, BUILD #X provisional, first-sighting strong, load-bearing M11).
- OBS-W22-2/W23-3 — GitHub Actions minutes exhaustion (HOLD, CI-PRINCIPLES X tentative, same-session incident; promote on next independent-session occurrence; pre-authored text from OBS-W22-2 format-valid).
- OBS-W21-3 — P-0 process-theater avoidance (HOLD, meta/informational, low priority, no home).
- OBS-W20-3 — P-4 three-layer defense meta (HOLD, informational, low priority).
- OBS-W19-4 — P-4 obligation as lesson-forwarding (HOLD, informational, low priority).
- OBS-W18-5 — T-9 journey-map skipped (HOLD, informational, low priority).
- OBS-W17-2 — Vacuous RLS under BYPASSRLS (HOLD, VERIFY #4 provisional).
- OBS-W17-4 — Pre-GUC guard SECURITY DEFINER (HOLD, BUILD #11+ provisional; renumbers as queue resolves).
- OBS-W17-5 — SET utility-statement bind-param (HOLD, informational).
- Remaining inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle JSONB sql-cast, W14-3 hash-excluded HMAC metadata, W14-2 differential discriminator, W13-1 mock-only derivation, W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W12-2 self-migrate race, W11-1 store-binding, W12-1 caller-FK.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 2
promotion_grade:
  - OBS-W24-1 (BUILD-PRINCIPLES #10 — populated-DB migration test for trigger-protected tables; 2-wave W17-incident+W24-operationalization; held 7 waves; THE promotion this wave)
promotion_grade_text: >
  10. A migration that UPDATEs or DELETEs rows on a trigger-protected table must be tested against a pre-seeded populated DB.
      Why: An empty-DB migration test cannot exercise triggers that fire only when rows already exist.
build_10_rule_chars: 119    # ≤120
build_10_why_chars: 91      # ≤100
build_10_format_valid: true
hold:
  - OBS-W24-2 (mechanical guard adversarial self-test; first sighting; BUILD candidate X; distinct kernel; 1-wave)
obs_w17_3_hold_waves: 7     # W17 through W23 inclusive; operationalized at W24
obs_w17_3_promotion_rationale: "2-wave: W17 prod incident (C-2 HOLD, 328-row trigger collision) + W24 operationalization (mechanical CI check proving rule is falsifiable and enforceable)"
nan_seed_hold: unchanged    # OBS-W23-2; no 2nd sighting; 1-wave; BUILD candidate X
readtail_rls_exempt_hold: unchanged   # OBS-W20-2; no 2nd sighting; 1-wave; strong
actions_minutes_hold: unchanged       # OBS-W22-2/W23-3; no independent-session 2nd sighting; same billing-cycle incident
build_principles_current_rule_count_after_promotion: 10   # rules 1-9 present; #10 = OBS-W24-1 on karen+orchestrator promotion
```
