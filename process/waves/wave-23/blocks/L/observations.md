# Wave 23 — L-block Observations (knowledge-synthesizer)

**Wave:** 23 — M9 seller-intent scoring (deterministic scorer + workspace-scoped service + /seller-intent API + /insights UI + cross-firm isolation e2e; read-only, no migration).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 18–23 (prior observations waves 18–22 fully read; wave-22 carry-forward queue audited below).
**Net pre-promotion candidates:** 0 PROMOTIONS this wave (2 new first-sightings both on HOLD; 1 validation-only enforcement; GitHub-Actions-minutes hold: same-session incident, not independent 2-wave recurrence; honest no-promotion call).

---

## What shipped

M9 first scoring wave. Deterministic seller-intent scorer (pure function: no `Date.now()`, no LLM, no side effects), `SellerIntentService` (workspace-scoped, `getDb()` GUC path, read-only), repository (per-workspace query), controller + module, `/seller-intent` API, `/insights` UI panel, shared-Zod contracts. Two key test deliverables: `seller-intent.scorer.spec.ts` (26 unit tests — determinism, epsilon, empty-data, no-tieBreak, no-`Date.now`) and `seller-intent-isolation.e2e-spec.ts` (3 tests, REAL `SellerIntentService` as `dealflow_app`, SIT-1 fault-killing cross-firm WS_A/WS_B). B-6 /review uncovered a real latent NaN-seed bug (recency reduce seeded `''` → `Date.parse('')=NaN` → recency bonus silently zeroed for single-element lists) and triggered the lexical→chronological timestamp fix at 854bad5. C-1 hit the GitHub-Actions-minutes hard-stop (2nd occurrence in this session); founder raised spending limit; dispatch restored; run 28858565829 green (5/5 jobs, 509+950+837 tests, zero skipped/failed). No fix-forward cycles. P-0/P-2: tieBreak noise-signal removal enforced PRODUCT-PRINCIPLES #1 (visible-text slip caught + removed at 525667f).

---

## Observation ledger

### OBS-W23-1 — PRODUCT-PRINCIPLES #1 enforcement: tieBreak noise-as-signal removal (NOT a new candidate; validation)

**What:** P-2 spec authoring and B-6 phase-1 review caught and removed a `tieBreak` field that would have been displayed as a user-visible metric. The tieBreak value is structurally noise (a secondary comparator with no independent signal value). It was removed from the spec, the scorer's returned breakdown, the Zod contract, and the UI (commit 525667f removed visible-text reference caught at B-6 phase 1).

**Why this is NOT a new candidate:** PRODUCT-PRINCIPLES #1 (promoted at wave-19/20) is the governing rule: "A spec metric shown to users must have a real source column, not be noise by construction, and qualify low-n cases." This is the second explicit application of that rule (wave-19 promoted it from a scoring context; wave-23 enforces it again at P-2 authoring for a different field in the same domain). The earlier wave's spec authored the tieBreak field; the wave-23 P-0 reframe caught the recurrence at problem-framing stage, forestalling a B-block rework cycle.

**Significance:** The rule is working as intended — the P-0 frame check now fires proactively. This is the positive-case evidence that promoted rules reduce B-block rework cycles.

**Severity:** informational/positive (no user-facing defect; caught at P-2; no B-block or C-1 cost).

**Promotion status:** NOT promotable. PRODUCT-PRINCIPLES #1 is the governing rule. This is a second enforcement application confirming rule 1 is correctly scoped and applied proactively.

**Source artifacts:**
- `process/waves/wave-23/stages/B-6-review.md` §Phase 1 head-builder (SI1 no-tieBreak noted as already satisfied; the P-2 pre-removal is cited: "earlier visible-text slip caught+removed 525667f").
- `process/waves/wave-23/stages/P-2-spec.md` (tieBreak absent from score/breakdown/Zod/UI schema — enforced before B-block start).
- `command-center/principles/PRODUCT-PRINCIPLES.md` rule 1 (governing promoted rule).

---

### OBS-W23-2 — NaN-seed in reduce over timestamp strings silently zeros the computed value (NEW; first sighting; BUILD candidate; HOLD)

**What:** The B-6 /review adversarial pass flagged a timezone-smell on timestamp comparisons. Investigation found two distinct bugs:

1. **Lexical vs chronological comparison:** the `mostRecentTs` reduce used JavaScript string comparison (`a > b ? a : b`) on ISO timestamp strings. While ISO 8601 UTC strings are lexicographically sortable, this is fragile against timezone-offset variations in the DB session. Fixed by switching to `Date.parse(a) > Date.parse(b) ? a : b` at both sites (repository max-ts + scorer recency reduce). Commit 854bad5.

2. **NaN-seed real latent bug:** the recency `reduce` accumulator was seeded with the empty string `''`. `Date.parse('')` returns `NaN`. When the mandate list had exactly one element, the reduce returned `''` (the seed) because `Date.parse(candidateDate) > NaN` evaluates to `false` for every comparison value including valid dates — `NaN` comparisons always return `false`, so the reduce accumulator never advances. The effect: `mostRecentTs = ''` → `Date.parse('') = NaN` → the recency-bonus branch computed `NaN` → the recency bonus was silently zeroed for any single-element mandate list. The fix re-seeded with the first element (or null-with-guard). Net result: restored correct 40/31/100 values; no snapshot update needed (the test expectations were already correct, they had been passing against the wrong intermediate state because the lexical comparison masked this path).

**Generalizable kernel:** A `reduce` over an array of values where the comparator uses `>` must be seeded with a real representative element (or `null`/`undefined` with a guard branch), not with a type-coercible neutral value like `''`. Seeding with `''` for string comparisons is superficially plausible (empty string is "less than" any non-empty string under `>`) but breaks when the comparison is delegated to a function like `Date.parse` that returns `NaN` for the sentinel — and `NaN` comparisons always return `false`, making the accumulator sticky at the seed. The observable symptom is a computed field (score, weight, bonus) that is silently zeroed or returns the seed value on single-element inputs.

**Distinction from the lexical/chronological issue:** The lexical-vs-chronological fix is a precision/correctness improvement (fragile but not wrong on UTC strings in most cases). The NaN-seed bug is a correctness bug on a codepath that fires for single-element inputs — a real latent defect that the /review's flag happened to expose during investigation of the first issue.

**Is this 2-wave?** First sighting as a named observation. No prior L-2 wave observation covers this class. HOLD pending a second occurrence.

**Is this promotable?** Not yet. The kernel is real and generalizable (any `reduce` seeded with a type-coercible default that feeds through a `NaN`-returning converter is suspect), but one sighting is insufficient. This is distinct from BUILD-PRINCIPLES #9 (fixture vs real DB) and the existing rules.

**Pre-authored BUILD candidate (format-checked; DO NOT promote until 2nd sighting):**
```
X. Seed a reduce over sortable values with a real element, not a type-coercible sentinel like ''.
   Why: A sentinel fed to Date.parse or similar returns NaN; NaN comparisons always fail, freezing the accumulator.
```
Check: Rule = "Seed a reduce over sortable values with a real element, not a type-coercible sentinel like ''." = 94 chars (≤120). Why = "A sentinel fed to Date.parse or similar returns NaN; NaN comparisons always fail, freezing the accumulator." = 106 chars — OVER 100. Trim:
```
X. Seed a reduce over sortable values with a real element, not a type-coercible sentinel like ''.
   Why: A sentinel fed to Date.parse returns NaN; NaN comparisons always fail, freezing the accumulator.
```
Check: Rule = 94 chars (≤120). Why = "A sentinel fed to Date.parse returns NaN; NaN comparisons always fail, freezing the accumulator." = 96 chars — still over. Trim:
```
X. Seed a reduce over sortable values with a real element, not a type-coercible sentinel like ''.
   Why: A sentinel through Date.parse yields NaN; NaN comparisons always fail, freezing the accumulator.
```
Check: Rule = 94 chars. Why = "A sentinel through Date.parse yields NaN; NaN comparisons always fail, freezing the accumulator." = 96 chars — still over. Further trim:
```
X. Seed a reduce over sortable values with a real element, not a type-coercible sentinel like ''.
   Why: An empty-string seed through Date.parse yields NaN; NaN comparisons always fail, silently zeroing the result.
```
Check: Why = 113 chars — too long. Compact:
```
X. Seed a reduce over sortable values with a real element, not a type-coercible sentinel like ''.
   Why: Date.parse('') returns NaN; NaN comparisons always false, so the accumulator never advances past the seed.
```
Check: Rule = 94 chars (≤120). Why = "Date.parse('') returns NaN; NaN comparisons always false, so the accumulator never advances past the seed." = 105 chars — still over. Strip further:
```
X. Seed a reduce over sortable values with a real element, not a type-coercible sentinel like ''.
   Why: Date.parse on a sentinel yields NaN; NaN comparisons always return false, freezing the accumulator.
```
Check: Rule = 94 chars (≤120). Why = "Date.parse on a sentinel yields NaN; NaN comparisons always return false, freezing the accumulator." = 99 chars (≤100). Exactly 2 non-empty lines. No forbidden tokens. No wave refs. No em-dash. FORMAT VALID.

Note: number is X (BUILD-PRINCIPLES currently has 9 rules; if OBS-W20-2 readTail-RLS-exempt promotes first it takes #10; this candidate would slot after as the next available number at promotion time).

**Severity:** warning (a real latent bug that silently zeroed a score component for single-element inputs; caught and fixed at B-6 before CI; no production impact since the feature was not yet deployed).

**Promotion status:** HOLD (first sighting; genuine generalizable kernel; no prior named observation in this class; 1-wave; HOLD pending a second occurrence of a NaN-or-type-coercion-seed bug in a reduce/max/min accumulator pattern).

**Source artifacts:**
- `process/waves/wave-23/stages/B-6-review.md` §Phase 2 /review (finding 1: "Lexical→CHRONOLOGICAL timestamp comparison (Date.parse) at both sites…This uncovered + fixed a REAL latent bug: the mostRecentTs reduce was seeded with '' → Date.parse('')=NaN → recency bonus silently ZEROED for single-element lists; re-seeded properly → restored correct 40/31/100 values").
- Fix commit 854bad5 (lexical→chronological + NaN-seed re-seed in scorer and repository).

---

### OBS-W23-3 — GitHub Actions minutes exhaustion: same-session recurrence at C-1 (HOLD — same incident, not independent 2nd wave)

**What:** Wave-23's C-1 hit the identical GitHub-Actions-minutes-exhaustion signature as wave-22: push accepted (exit 0), workflow active (`state: active`), zero check-suites created on the pushed tip. The founder raised the spending limit; dispatch was restored; run 28858565829 fired on tip 6c22919 and went green (5/5 jobs). This is the second C-1 hard-stop from this cause within the same autonomous session.

**Held-queue entry from wave-22:** OBS-W22-2 was logged as a first sighting (meta/ops, HOLD, CI-PRINCIPLES candidate, pre-authored text format-valid). The question for wave-23 is whether this constitutes a qualifying second sighting for promotion.

**Honest assessment — SAME INCIDENT, not independent 2nd occurrence:**
- Both wave-22 and wave-23 hit the exhaustion within the SAME continuous autonomous session and the SAME billing cycle. The root event is one billing-limit exhaustion, not two independently occurring incidents separated by a billing reset.
- The 2-wave bar's purpose is to confirm a pattern recurs independently — that it is not a one-time anomaly but a systematic class. A single billing-cycle exhaustion that happened to span two waves because the autonomous loop runs multiple waves per session satisfies the letter ("two waves") but not the spirit ("two independent incidents confirming a recurring class").
- If the session had ended after wave-22 and a new session resumed in the next billing cycle with fresh minutes, the wave-23 occurrence would never have happened. The recurrence is structurally dependent on the same root cause not having been resolved between the two waves.
- Conclusion: this is one continuous incident manifested across two C-1 stages, not two independently occurring instances of the same pattern class. HOLD unchanged.

**What this DOES confirm (carry forward):** The pre-authored CI-PRINCIPLES candidate from OBS-W22-2 remains valid. If the exact same symptom (push accepted, workflow active, zero check-suites) fires in a FUTURE session after a billing reset, that is the clean independent 2nd sighting. The detection heuristic (probe for check-suite creation before treating silence as transient) is the right rule.

**Severity:** warning/operational (same as OBS-W22-2; one continuous root-cause event; no code or test defect; no production impact; both times resolved by founder billing action).

**Promotion status:** HOLD (same-session incident; same billing-cycle exhaustion; not a clean independent 2nd sighting; carry forward unchanged from OBS-W22-2 with this note added).

**Source artifacts:**
- `process/waves/wave-23/stages/C-1-pr-ci-merge.md` §Resume disposition ("The prior C-1 verdict was ESCALATE/FAIL: GitHub Actions dispatched 0 runs on the pushed tip (minutes/spending-limit hard-stop, recurrence of wave-22)… founder raised the Actions spending limit; dispatch is restored").
- `process/waves/_archive/wave-22/blocks/L/observations.md` OBS-W22-2 (first-sighting record; pre-authored candidate text confirmed format-valid).

---

## Carried-forward holds recurrence audit (waves 18–22)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W22-2 GitHub Actions minutes exhaustion (CI-PRINCIPLES X, meta/ops, 1-wave — now technically 2 waves but same-session) | SAME-SESSION RECURRENCE — not an independent 2nd sighting (see OBS-W23-3 above). | HOLD — carry forward; note session-recurrence; promote on next independent-session occurrence |
| OBS-W20-2 Global shared-infra read RLS-exempt (BUILD #X, 1-wave strong) | NON-RECURRENCE (read-only scoring wave; no new shared-infra write surface; no `readTail` or chain-append path touched). | HOLD unchanged (first-sighting, strong, load-bearing M11) |
| OBS-W21-3 P-0 process-theater avoidance (meta/informational, HOLD) | NON-RECURRENCE as a distinct defect (wave-23 P-0 tieBreak removal is a valid PRODUCT-PRINCIPLES #1 enforcement, not the process-theater pattern). | HOLD unchanged (informational, low priority) |
| OBS-W20-3 P-4 three-layer defense meta (informational) | NON-RECURRENCE (no P-4 security-auditor spawn this wave; read-only scoring, no new write surface). | HOLD unchanged (informational, low priority) |
| OBS-W19-4 P-4 obligation as lesson-forwarding (informational) | NON-RECURRENCE (no new P-4 obligation-encoding cycle distinct from prior pattern). | HOLD unchanged (informational, low priority) |
| OBS-W18-5 T-9 canonical journey-map skipped (informational) | NON-RECURRENCE (T-9 ran this wave; new /seller-intent route added to journey map). | HOLD unchanged (informational) |
| OBS-W17-2 Vacuous RLS under BYPASSRLS (VERIFY #4 provisional) | NON-RECURRENCE (read-only wave; no e2e test-role change). | HOLD unchanged |
| OBS-W17-3 Populated-DB migration trigger-protected tables (BUILD #10 provisional) | NON-RECURRENCE (no migration this wave — read-only scorer). | HOLD unchanged |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER (BUILD #11 provisional) | NON-RECURRENCE (no guard/middleware change). | HOLD unchanged |
| OBS-W17-5 SET utility-statement bind-param (informational) | NON-RECURRENCE. | HOLD unchanged |
| Other inherited holds (W16-2/W16-6/W14-3/W14-2/W13-1/W15-4/W15-5/W12-2/W11-1/W12-1) | All NON-RECURRENCE (no overlapping surface touched this wave). | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W23-1 tieBreak removal (PRODUCT-PRINCIPLES #1 enforcement) | W19 promoted + W23 enforces | informational | NOT a new candidate — PRODUCT-PRINCIPLES #1 governs it | PRODUCT-PRINCIPLES #1 validates | NOT promotable (enforcement/validation only) |
| OBS-W23-2 NaN-seed in reduce over timestamp strings | W23 only | warning | 2-wave bar NOT met; first sighting | BUILD-PRINCIPLES (X, tentative slot after #9) | HOLD (first sighting; genuine kernel; 1-wave) |
| OBS-W23-3 GitHub Actions minutes exhaustion (same session) | W22 (original) + W23 (same-session recurrence) | warning/operational | NOT an independent 2nd sighting — same billing-cycle incident | CI-PRINCIPLES (X, pre-authored at W22; format valid) | HOLD (same-session incident; not independent 2-wave; carry forward from OBS-W22-2) |

**Carry-forward queue after wave-23:**
- OBS-W22-2 / OBS-W23-3 — GitHub Actions minutes exhaustion (HOLD, meta/ops, CI-PRINCIPLES X tentative, same-session-incident-noted; promote on NEXT independent-session occurrence; pre-authored text from OBS-W22-2 remains format-valid).
- OBS-W23-2 — NaN-seed in reduce over timestamp strings (HOLD, BUILD candidate X, first-sighting, genuine kernel; pre-authored text in OBS-W23-2 above is format-valid).
- OBS-W20-2 — Global shared-infra read RLS-exempt (HOLD, BUILD #X provisional, first-sighting strong, load-bearing M11).
- OBS-W21-3 — P-0 process-theater avoidance (HOLD, meta/informational, low priority, no home).
- OBS-W20-3 — P-4 three-layer defense meta (HOLD, informational, low priority).
- OBS-W19-4 — P-4 obligation as lesson-forwarding (HOLD, informational, low priority).
- OBS-W18-5 — T-9 journey-map skipped (HOLD, informational, non-recurrence this wave).
- OBS-W17-2 — Vacuous RLS under BYPASSRLS (HOLD, VERIFY #4 provisional).
- OBS-W17-3 — Populated-DB migration trigger-protected tables (HOLD, BUILD #10 provisional).
- OBS-W17-4 — Pre-GUC guard SECURITY DEFINER (HOLD, BUILD #11 provisional).
- OBS-W17-5 — SET utility-statement bind-param (HOLD, informational).
- Remaining inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle JSONB sql-cast, W14-3 hash-excluded HMAC metadata, W14-2 differential discriminator, W13-1 mock-only derivation, W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W12-2 self-migrate race, W11-1 store-binding, W12-1 caller-FK.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 3
promotion_grade: []     # no promotion this wave — validation-only for PRODUCT-PRINCIPLES #1; two new first-sightings on HOLD; Actions-minutes same-session incident (not independent 2nd sighting)
not_promotable_this_wave:
  - OBS-W23-1 (PRODUCT-PRINCIPLES #1 enforcement/validation — tieBreak noise removal; rule already promoted; no new rule)
hold:
  - OBS-W23-2 (NaN-seed in reduce over timestamp strings; BUILD candidate X; first-sighting; genuine kernel; 1-wave)
  - OBS-W22-2/OBS-W23-3 (GitHub Actions minutes exhaustion; same-session recurrence noted; CI-PRINCIPLES X tentative; pre-authored text format-valid; hold until independent-session 2nd occurrence)
product_principles_1_enforcement_count: 2   # W19 promoted + W23 enforces (tieBreak removal at P-2/B-6)
nan_seed_bug_sightings: 1                   # W23 only; first sighting; reduce seeded '' -> Date.parse('')=NaN
actions_minutes_exhaustion_sightings: 2     # W22 (original) + W23 (same-session); counted as 1 incident
ci_principles_current_rule_count: 2         # rules 1, 2 present; next slot is #3
build_principles_current_rule_count: 9      # rules 1-9 present; next slot is #10 (or X for new candidates)
readtail_rls_exempt_hold: unchanged         # OBS-W20-2; no 2nd sighting; still 1-wave strong hold
```
