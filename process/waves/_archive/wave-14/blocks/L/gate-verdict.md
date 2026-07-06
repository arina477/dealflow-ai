# Wave 14 — L-block Verdict (L-2 Distill gate)

**Reviewer:** head-learn (fresh spawn, block-exit gate) + agentId `arina-5ywq3s`
**Reviewed against:** L-1 Docs (CHANGELOG 0.14.0 + tasks-done, COMPLETE) + B-6 (APPROVED) + C-1/C-2 (PASS) + V-3 (APPROVED) + the wave-11/12/13 held-candidate ledger.
**Specialists:** karen (rule-quality + recurrence-honesty) + knowledge-synthesizer (cross-wave recurrence) — independent, concurrent, converged. Pivotal Candidate-A call additionally confirmed IN-SOURCE.
**Attempt:** 1 (first gate)

## Verdict
APPROVED

## Rationale

L-1 Docs are COMPLETE and honest: the retro traces every load-bearing outcome to a concrete deployed-state artifact or source path (hash-chain intact after 0012 via live verifyChain {ok:true,310}; DEV-2 lifted by a REAL migrated-DB e2e; gate no-regression), correctly separates the shipped hardening from the still-deferred SEND (the true M6-completion blocker), and attributes the two in-gate defects to safeguard gaps (missing journal registration; a green-but-tautological differential test), not human error — the head-builder gate and B-6 `/review` are named as the durable controls. No observation theater.

L-2 Distill is disciplined and correct at **net promotion 0** — a valid outcome, identical in shape to waves 11/12/13. Three candidate lessons, adjudicated with two independent specialists whose verdicts matched exactly:

1. **Ghost-Green migration-journal → RE-VALIDATES BUILD #4 (not re-promotable).** 0012 hand-authored, not in `_journal.json`, `mandate_id` absent on a fresh DB → Ghost Green. This IS BUILD #4's kernel ("hand-authored drizzle migration must appear in `_journal.json` with a `when` greater than all prior entries; drizzle skips a missing/stale `when` while reporting success"); head-builder diagnosed it in BUILD #4 terms and gated the wave until 0161e57 registered `idx:12` (`when 1783814400000 > 0011`). A rule already in the file cannot be re-promoted — this is a healthy recurrence proving BUILD #4 is load-bearing.

2. **Test-distinguishes-by-wrong-key (M1) → DISTINCT FIRST-SIGHTING (HOLD, not a VERIFY #3 recurrence).** The dispositive test: VERIFY #3's kernel is execution-venue (was the derivation RUN against real Postgres vs a param-forwarding mock). The wave-14 e2e ran REAL against migrated Postgres THROUGHOUT — VERIFY #3's check PASSES on the pre-M1 test, so M1 cannot be its recurrence. M1's kernel is orthogonal: fixture-discriminator design (the two isolation cases differed by an INCIDENTAL attribute — distinct template versions — so the assertion was tautological w.r.t. the `mandate_id` column the feature relies on; it would pass even under a resource_id-keying regression). CONFIRMED IN-SOURCE: `recordkeeping-gate.e2e-spec.ts` test F discriminates A/B by `VERSION_A_ID`/`VERSION_B_ID` (incidental); test I (the M1 fix, 9009abb) shares `SHARED_VERSION_ID` and isolates ONLY by the `mandate_id` column, fault-killing (count=2 under regression, count=0 if the branch is removed). The wave-13 ledger explicitly pre-warned that VERIFY #3's recurrence clock is for the mock-only PATTERN re-firing, NOT a downstream real-DB test being deficient in some other way — folding M1 in would be that fake recurrence. First-sighting of its own kernel; HOLD, pre-authored as a VERIFY candidate.

3. **Hash-excluded additive metadata → DISTINCT FIRST-SIGHTING (HOLD, durable-not-snack).** Extending the immutable HMAC log with `mandate_id` OUTSIDE the hashed preimage (byte-identical prior hashes, verifyChain green) is a genuine, mechanically-checkable structural invariant (grep `HashableEntryFields` for absence + verifyChain over a mixed chain) — NOT the non-falsifiable docstring-honesty snack class, and no BUILD 1-7 rule covers it. But it is the FIRST occurrence (a "did it right once"), the thinnest possible promotion basis; the 2-wave bar blocks it. HOLD, pre-authored as a BUILD candidate.

All five prior held candidates (W11-1 store-binding, W12-1 caller-FK, W12-2 self-migrate race, W13-1 mock-only derivation, W13-2 read-path completeness) were checked against wave-14 and NONE recurred — each stays HOLD unchanged.

**Anti-pattern sweep — none fire.** No Observation Theater (every symptom traces to a control/defect). No Snacking Trap (both new kernels are existential — compliance audit-trail integrity + regulator-facing test fidelity — not stylistic). No Root-Cause Fallacy (defects framed as systemic safeguard gaps, not author blame). No Over-Promotion / Rule Fatigue (net 0; nothing crammed). No Formatting Rebellion (0 promotions to lint; both pre-authored candidates format-checked for the future). No Temporary-Fix Promotion (nothing promoted). No fake-recurrence over-credit (the M1-vs-VERIFY#3 collapse was caught and rejected with a dispositive test + in-source confirmation).

## Block-exit contract check (block-exit stage)
- At most ONE principle promoted: SATISFIED — ZERO promoted (0 ≤ 1 per file).
- Contract-format match on any promotion: N/A (no promotion). The two pre-authored future candidates were format-checked (2 lines, char limits, no forbidden tokens / wave refs / em-dash / cross-refs) but written into `observations.md`, NOT appended to any `*-PRINCIPLES.md`.
- Rejected-approach lineage recorded: YES (observations.md § promotion decision + OBS-W14-1..4 with full rationale and non-recurrence audit of all five held candidates).

## Cascade
- **Stages that must re-run:** none (APPROVED).
- **Next block:** N (Next) — receives the explicit ZERO-promotion signal + the archive-ready observation set (two new first-sighting candidates with 2-wave clocks; DEV-2 lifted; SEND still deferred as the M6-completion blocker).

## Footer

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-2
  reviewers:
    karen: "A (M1) DISTINCT-FIRST-SIGHTING HOLD (not VERIFY #3); B (hash-excluded metadata) DISTINCT-FIRST-SIGHTING HOLD (durable, not snack)"
    knowledge_synthesizer: "migration-journal RE-VALIDATES BUILD #4; M1 + hash-excluded metadata DISTINCT first-sightings; 0 held candidates recurred"
    in_source_confirmation: "recordkeeping-gate.e2e-spec.ts — test F incidental-version discriminator; test I shared-version mandate_id-only isolation (fault-killing)"
  failed_checks: []
  rationale: >
    L-1 Docs COMPLETE + honest (outcomes traced to deployed artifacts, systemic-not-human root causes,
    SEND correctly deferred as the M6-completion blocker). L-2 net promotion 0 — disciplined and correct.
    Ghost-Green migration-journal RE-VALIDATES the existing BUILD #4 (head-builder gate enforced it; not
    re-promotable). M1 is a DISTINCT first-sighting, NOT a VERIFY #3 recurrence: the wave-14 e2e ran REAL
    against real Postgres throughout, so VERIFY #3's mock-vs-real check passes on the pre-fix test and M1
    (a fixture-discriminator/tautological-differential kernel) cannot be its recurrence — confirmed
    in-source (test F incidental version vs test I shared-version mandate_id-only isolation). Hash-excluded
    additive-metadata is a durable, mechanically-checkable new kernel but a first occurrence, bar-blocked.
    Both specialists converged independently; all five prior held candidates non-recurrent. Zero principles
    appended to any *-PRINCIPLES.md; two future candidates pre-authored + format-checked in observations.
    Block-exit contract satisfied (0 ≤ 1 per file; lineage recorded).
  next_action: PROCEED_TO_N
verdict_complete: true
promoted_count: 0
promoted_rules: []
l_block_status: complete
```
