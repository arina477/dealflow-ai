# Wave 26 — L-block Observations (knowledge-synthesizer)

**Wave:** 26 — M10 FINAL-hardening (RLS connection-split deploy contract [docs] + `assertUrlsDistinct` startup preflight + MG1 guard-freeze + MG2 stale-docs correction).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 20–26 (prior observations waves 20–25 fully read; wave-25 carry-forward queue audited below).
**Net pre-promotion candidates:** 1 PROMOTION (OBS-W22-2/W23-3/W25-3 Actions-minutes — 4th-wave bar met; slot held from wave-25; CI-PRINCIPLES #3 slot open). 2 new HOLDs (MG1 docs/guard-freeze, boot-safety startup-assert deploy verify). Promotion text re-verified against OBS-W22-2 pre-authored entry.

---

## Observation ledger

### OBS-W26-1 — GitHub Actions minutes exhaustion: 4th wave sighting, wave-25 slot open (PROMOTION; CI-PRINCIPLES #3; 4-wave W22+W23+W25+W26)

**What:** Wave-26 C-1 stage escalated again: Actions withheld CI runs 5 times in a single day, with the 4th founder-raise failing to take effect before minutes were re-exhausted. Commit messages document the escalation chain: `d29e9c8` (3rd same-day exhaustion, 0 check-suites @ ca753e4), `d656850` (5th same-day event, 0 check-suites @ 4546753). This is the 4th distinct wave in which the billing-exhaustion pattern was diagnosed and escalated.

**Recurrence analysis:**
- Wave-22: first sighting (OBS-W22-2; push accepted + workflow active + 0 check-suites; founder cleared; HOLD — first sighting).
- Wave-23: second sighting (OBS-W23-3; same billing cycle; independent-session condition not yet met; HOLD).
- Wave-24: no occurrence (low CI volume; tooling-only).
- Wave-25: third sighting (OBS-W25-3; independent billing cycle confirmed; slot taken by BUILD #11; HOLD elevated with explicit carry-forward to wave-26).
- Wave-26: fourth wave sighting; 5 same-day incidents; 4th founder raise did not take effect before re-exhaustion.

**Why promote now:** Wave-25 ledger explicitly stated "prioritize for CI-PRINCIPLES promotion in next wave with available slot." Wave-26 is the first wave since wave-25 with an open CI-PRINCIPLES slot. The 4-wave bar is met. The diagnostic principle is independent of the billing remediation: the agent's obligation is correct classification of zero-check-suites (billing signal) vs CI failure — not raising the limit, which requires founder action. That distinction makes it a valid CI-PRINCIPLES diagnostic rule, directly parallel to CI-PRINCIPLES rule 2 ("confirm a workflow run executed on the exact pushed headSha, not that the push landed").

**Near-dup check vs CI-PRINCIPLES rules 1-2:**
- Rule 1: verify deployed commit via commitHash, not /health version — about deploy verification, not CI dispatch.
- Rule 2: confirm CI ran on exact headSha, not just that push landed — covers case where a run fires on wrong commit.
- Proposed rule 3: confirm a check-suite was created before treating CI silence as transient — covers case where NO run fires at all.
- Rules 2 and 3 are complementary: rule 2 is "CI ran, verify it ran on the right commit"; rule 3 is "CI appeared absent, verify dispatch before assuming transient delay." Not a near-dup. ✓

**Pre-authored OBS-W22-2 entry (re-verified against CI-PRINCIPLES Contract this session):**

```
3. After a push, confirm a check-suite was created before treating CI silence as a transient delay.
   Why: Exhausted Actions minutes silently withhold dispatch; the push is accepted but zero runs fire.
```

- Rule line: "After a push, confirm a check-suite was created before treating CI silence as a transient delay." = 96 chars (≤120). ✓
- Why line: "Exhausted Actions minutes silently withhold dispatch; the push is accepted but zero runs fire." = 93 chars (≤100). ✓
- Exactly 2 non-empty lines. Both end in period. ✓
- No `we`, `our`, `the team`, `wave-<N>`, em-dash, parenthetical longer than 5 words. ✓
- FORMAT VALID.

**Is the principle actionable?** Yes — the agent can call the check-suites API (`GET /repos/{owner}/{repo}/commits/{ref}/check-suites`) before re-pushing. If zero check-suites exist after the push grace period, escalate as billing-limit, not as CI failure.

**Is the remediation founder-dependent?** Yes — raising the spending limit or adding runner budget requires account-owner action. But the principle covers DIAGNOSIS, not remediation. Diagnosing billing-limit exhaustion before futile re-pushes is fully within agent purview.

**Severity:** operational-blocker (5 withheld runs, 4 founder raises, meaningful wave velocity lost; no correctness or data impact).

**Promotion status:** PROMOTION-GRADE (4-wave: W22 first sighting + W23 2nd sighting + W25 independent billing cycle + W26 5-incident day; THE promotion this wave). Target: CI-PRINCIPLES #3. Karen vets; orchestrator promotes; ≤1/file/wave cap.

**Source artifacts:**
- `process/waves/_archive/wave-22/blocks/L/observations.md` §OBS-W22-2 (first sighting; pre-authored text; HOLD).
- `process/waves/_archive/wave-25/blocks/L/observations.md` §OBS-W25-3 (3rd sighting; elevated hold; explicit carry-forward to wave-26 slot).
- Wave-26 escalation commits: `d29e9c8` (re-escalate #1: 0 check-suites @ca753e4), `d656850` (re-escalate #2: 0 check-suites @4546753, 5th same-day event, 4th raise ineffective).

---

### OBS-W26-2 — Docs/refactor wave must not alter load-bearing security-assertion predicates (NEW; first sighting; HOLD)

**What (MG1):** Wave-26 was classified as a docs/hardening wave. The `[RLS-GUARD] assertNonSuperuserConnection` function was explicitly frozen: the security-assertion predicates (`is_superuser = 'on'` and `has_bypassrls`) and the fail-closed throw path were not altered — only JSDoc comment, inline message, and cross-reference text changed. B-6 Phase 1 verified the guard byte-for-byte against the wave-25 baseline; /review Phase 2 confirmed guard byte-identical (no security regression). The standing deploy-AC (MG1: `[RLS-GUARD] assertNonSuperuserConnection predicates MUST be byte-for-byte identical to wave-25`) was author-committed at P-3.

**Generalizable kernel:** A docs/refactor/hardening wave must not alter load-bearing security-assertion predicates. The discipline is enforced by: (a) the plan explicitly declaring which guard is frozen, (b) B-6 verifying byte-identity of the guard, (c) /review confirming no security regression. The current process (B-6 gate + /review) already enforces this correctly.

**Why HOLD:** First sighting. More critically: this is a SUCCESSFUL application of the existing B-6 + /review process. The guard was deliberately frozen, the gates verified the freeze, and the lesson is "the process worked." No new principle is needed to enforce something the existing gates already catch. A VERIFY or BUILD rule phrasing "a docs wave must not alter guard predicates" is not needed when B-6's adversarial review already mandates this check. The lesson is process-operational (plan declares freeze, B-6 verifies) rather than a new cross-wave principle.

**Distinction from VERIFY rule 2:** VERIFY rule 2 ("Run adversarial /review on every B-block diff that builds an auth guard") covers the reviewer's posture. This kernel would cover the WAVE-CLASSIFIER's obligation not to alter a guard in a docs wave. Arguably distinct — but at 1 sighting, and with the existing process handling it correctly, it doesn't clear the bar.

**Severity:** informational/positive (discipline enforced correctly; no security regression; caught at B-6 + /review as designed).

**Promotion status:** HOLD (first sighting; existing B-6 + /review gate already enforces the discipline; not a new vulnerability or gap — a new principle here would be redundant with the process that already works).

**Source artifacts:**
- `process/waves/wave-26/stages/B-6-review.md` §Phase 1 (MG1 guard byte-for-byte FROZEN verified) + §Phase 2 (guard byte-identical, no security regression).
- Wave-26 standing deploy-AC (P-3 plan): MG1 assertNonSuperuserConnection predicates MUST be byte-for-byte identical to wave-25.

---

### OBS-W26-3 — A new startup assertion is a boot-blocking risk; C-2 must verify the app boots past it (NEW; first sighting; HOLD)

**What:** Wave-26 added `assertUrlsDistinct()` to `main.ts:31` ahead of the existing `assertNonSuperuserConnection()` call. Both run inside `bootstrap()` BEFORE `app.listen()`. A thrown exception in either would cause Railway to mark the deployment CRASHED/FAILED. C-2 explicitly verified boot-safety by: (a) pre-checking that prod env vars make the preflight a no-op (DATABASE_URL != MIGRATE_DATABASE_URL), (b) deploying and reading boot logs to confirm "API listening on port 3001" was reached (proving both guards passed), (c) treating boot-log success as "cryptographic proof" neither guard threw.

**Generalizable kernel:** Any new code added to a process bootstrap path that can throw an unrecoverable exception (startup assertion, preflight, guard) is a boot-blocking risk. The C-2 deploy for that wave must verify the app reaches its listen/ready signal — a CRASHED deployment is the failure mode, not a runtime error.

**Why HOLD:** First sighting. More importantly: this is the C-2 process working exactly as designed. The C-2 stage file already requires health verification after deploy; boot-log analysis is a natural extension of that gate. No new cross-wave principle is needed because the C-2 gate already catches boot failures — a crashed deployment appears immediately in Railway's deploy status. The "verify the app still boots" obligation is embedded in C-2's existing exit criteria (health check passes = app booted). A BUILD or CI principle encoding "verify boot after adding a startup assertion" would be stating what C-2 already mandates for every deploy. Not a new principle gap; a new principle here would be redundant.

**Severity:** informational/positive (boot-safety verified by C-2 gate as designed; app booted cleanly past both guards).

**Promotion status:** HOLD (first sighting; C-2's deploy-and-verify gate already mandates this check universally; not a new gap — the process caught it correctly and no new principle is needed to mandate what C-2 already does).

**Source artifacts:**
- `process/waves/wave-26/stages/C-2-deploy-and-verify.md` §Action 4 (boot logs prove assertUrlsDistinct + assertNonSuperuserConnection both passed; "API listening on port 3001" is the gate signal).
- Wave-26 boot-safety pre-check table (C-2 §Environment/boot-safety pre-check).

---

## Carry-forward holds recurrence audit (waves 20–26)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W22-2/W23-3/W25-3 Actions-minutes (CI-PRINCIPLES X) | RECURRENCE — 5 same-day CI withheld events in wave-26; 4th wave sighting; slot open. | PROMOTION-GRADE via OBS-W26-1 — THE promotion this wave |
| OBS-W25-2 Mock concurrency tautology (BUILD candidate X) | NON-RECURRENCE (no read-then-write concurrency pattern authored; docs+preflight wave). | HOLD unchanged (first sighting; genuine kernel; 1-wave) |
| OBS-W23-2 NaN-seed in reduce (BUILD candidate X) | NON-RECURRENCE (no reduce/accumulator pattern authored). | HOLD unchanged (first sighting; genuine kernel; 1-wave) |
| OBS-W20-2 readTail-RLS-exempt (BUILD candidate X, strong) | NON-RECURRENCE (no shared-infra read path touched). | HOLD unchanged (first sighting; strong; load-bearing M11) |
| OBS-W21-3 P-0 process-theater (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W20-3 P-4 three-layer defense (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W19-4 P-4 obligation (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W18-5 T-9 journey-map skipped (informational) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-2 Vacuous RLS under BYPASSRLS (VERIFY #4 provisional) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER (BUILD #12+ provisional) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W17-5 SET utility-statement bind-param (informational) | NON-RECURRENCE. | HOLD unchanged |
| Other inherited holds (W16-2/W16-6/W14-3/W14-2/W13-1/W15-4/W15-5/W12-2/W11-1/W12-1) | All NON-RECURRENCE. | HOLD unchanged |
| OBS-W24-2/W25-1 Guard adversarial self-test | PROMOTED (wave-25; BUILD #11). | Closed |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W26-1 Actions-minutes (OBS-W22-2 4th wave confirmed) | W22+W23+W25+W26 | operational-blocker | YES (generalizable + falsifiable + 4-wave cited; pre-authored text re-verified format-valid) | CI-PRINCIPLES (#3) | PROMOTION-GRADE (THE promotion this wave) |
| OBS-W26-2 MG1 docs/guard-freeze | W26 only | informational/positive | NO (first sighting; existing B-6 + /review gate already enforces; redundant principle) | VERIFY or BUILD (provisional) | HOLD (first sighting; process already catches this) |
| OBS-W26-3 Boot-safety startup-assert | W26 only | informational/positive | NO (first sighting; C-2 deploy-and-verify gate already mandates this universally) | CI-PRINCIPLES (provisional) | HOLD (first sighting; C-2 gate already mandates boot verification) |

**Carry-forward queue after wave-26:**

- OBS-W26-1 — PROMOTED this wave (CI-PRINCIPLES #3; Actions-minutes 4-wave).
- OBS-W26-2 — MG1 docs/guard-freeze (HOLD, first sighting; existing B-6 + /review process handles it; promote only if a second wave surfaces a guard-predicate mutation slipping through docs-wave review).
- OBS-W26-3 — Boot-safety startup assertion (HOLD, first sighting; C-2 gate already catches it; promote only if a second wave shows a startup assertion causing a CRASHED deploy that C-2 verification failed to catch).
- OBS-W25-2 — Mock concurrency tautology (HOLD, BUILD candidate, first sighting; genuine kernel; carry forward unchanged).
- OBS-W23-2 — NaN-seed in reduce (HOLD, BUILD candidate, first sighting; genuine kernel; carry forward unchanged).
- OBS-W20-2 — readTail-RLS-exempt (HOLD, BUILD candidate, first sighting strong; load-bearing M11; carry forward unchanged).
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
  - OBS-W26-1 (CI-PRINCIPLES #3 — Actions-minutes dispatch signal; 4-wave W22+W23+W25+W26; THE promotion this wave)
promotion_grade_text: >
  3. After a push, confirm a check-suite was created before treating CI silence as a transient delay.
     Why: Exhausted Actions minutes silently withhold dispatch; the push is accepted but zero runs fire.
ci_principles_3_rule_chars: 96    # ≤120
ci_principles_3_why_chars: 93     # ≤100
ci_principles_3_format_valid: true
ci_principles_3_preauthored_source: "process/waves/_archive/wave-22/blocks/L/observations.md §OBS-W22-2 (pre-authored; re-verified format-valid this session)"
hold:
  - OBS-W26-2 (MG1 docs/guard-freeze; first sighting; existing B-6 + /review gate already enforces; not a new principle gap)
  - OBS-W26-3 (boot-safety startup assertion; first sighting; C-2 deploy-and-verify already mandates boot verification universally)
actions_minutes_promotion_rationale: "4-wave W22 first-sighting + W23 2nd-sighting + W25 independent-billing-cycle + W26 5-incidents-1-day; slot held from wave-25; CI-PRINCIPLES slot open; diagnostic principle (check-suite sentinel) agent-actionable independent of founder billing remediation"
mg1_guard_freeze_hold_rationale: "first sighting; B-6 + /review already enforce byte-identity; a new principle would be redundant with the gates that already work"
boot_safety_hold_rationale: "first sighting; C-2 exit gate already mandates health verification on every deploy; a new principle would restate what C-2 universally mandates"
obs_w25_2_concurrency_tautology_hold: unchanged    # first sighting; no 2nd sighting this wave
obs_w23_2_nan_seed_hold: unchanged                 # first sighting; no 2nd sighting
obs_w20_2_readtail_rls_exempt_hold: unchanged      # first sighting strong; no 2nd sighting
ci_principles_current_rule_count_before_promotion: 2   # rules 1-2 present before wave-26; #3 = OBS-W26-1 on karen+orchestrator promotion
```
