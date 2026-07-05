# Wave 12 — L-block Gate Verdict

**Reviewer:** head-learn (fresh spawn, agentId head-learn-l-w12)
**Reviewed against:** L-1-docs.md (COMPLETE) · L-2 distill (this gate) · B/C/V gate-verdicts + C-1/C-2/V-2 stage outputs · wave-11 observation ledger (recurrence baseline)
**Wave topic:** M6 pipeline / deal-stage tracking (fixed 7-stage board + append-only audited event timeline)
**Deliverables:** `process/waves/wave-12/blocks/L/observations.md` · 0 principle promotions

## Verdict
APPROVED

## Rationale

The L-block cleanly discharges both its responsibilities: honest, systemic, reality-checked observations (L-1 Docs quality) and a disciplined, bar-respecting distillation that promotes AT MOST ONE principle per file — here, correctly, ZERO.

**L-1 Docs quality — PASS.** The retro identifies the two load-bearing findings as SAFEGUARD gaps, not human error: (1) OBS-W12-1's caller-supplied-FK provenance defect is traced to single-mandate fixtures rendering a cross-row inconsistency structurally unreachable, with the durable control named (adversarial `/review` at B-6 Phase-2); (2) OBS-W12-2's migration race is traced to a test-infra concurrency hazard, not an author slip. Every observation pairs a symptom with the safeguard that caught it and the corrective control (no Observation Theater). The plan-authoring-defect lens is applied to OBS-W12-1 (the fixture-authoring gap that hid the defect). No first-story / human-blame framing survives.

**L-2 Distill — the hard constraint held. 0 promotions, and that is the CORRECT outcome, not a snack-avoidance shortcut.** knowledge-synthesizer and karen were both spawned. They DISAGREED, and the adjudication is the load-bearing work of this gate:
- knowledge-synthesizer ruled all four candidates first-sightings → 0.
- karen APPROVED candidate A (BUILD FK-provenance) and B (CI advisory-lock) on rule QUALITY (format-clean, falsifiable, existential-impact), rejected C.
- The decisive test is this project's HARD 2-wave recurrence bar (Contract Authoring-discipline: "wave-specific 'broke once' stays in observations until a second wave confirms"; wave-11 promoted net-0 on exactly this bar). karen assessed quality, NOT recurrence — and she explicitly flagged that B's "2nd occurrence" claim must be checked against the wave-11 ledger. Verified: wave-11 OBS-W11-3 is the Ghost-Green/glob-collection sub-class, NOT a migration race. The migration race is architecturally impossible until a second self-migrating suite exists — it is FIRST-sighted this wave, not a re-fire. B therefore drops per karen's own stated fallback. A is likewise a genuine first-sighting (clean space vs BUILD #5/#6/#7 and vs any wave-5 FK id-space observation).
- The wave-11 carry-forward (OBS-W11-1 reused-authority store-binding, pre-authored BUILD #8) did NOT recur: wave-12 wired M2 AuditService CORRECTLY to `audit_log_entries` (its own store), proven by the real-DB rollback e2e. Correctly applying a pattern is not a re-fire; it stays HOLD.

Result: every candidate is a first-occurrence or a confirmed non-recurrence. All four are logged with wave-12 as first-sighting; the two strongest (OBS-W12-1 FK-provenance → pre-authored BUILD #8, OBS-W12-2 migration-race → pre-authored CI-PRINCIPLES #1) are format-checked and karen-quality-APPROVED so a later wave promotes on sight without re-litigation. This avoids both failure modes: no Over-Promotion Rule Fatigue (0, not 2, promoted off single incidents) AND no snacking (the high-leverage compliance-provenance and CI-race lessons are captured, ranked, and pre-formatted, not discarded).

**Format / file integrity — PASS.** No append was made to any `*-PRINCIPLES.md` (0 promotions). BUILD-PRINCIPLES ends at rule 7, CI-PRINCIPLES has zero rules — both confirmed untouched. The two pre-authored candidates sit in `observations.md` in strict 2-line Contract form (verified: ≤120/≤100 chars, no forbidden tokens, no em-dash, no wave refs, exactly 2 non-empty lines) but are NOT promoted — the file authority is preserved.

**Task done-marking — L-1 authoritative.** The 3 claimed tasks (07989285 spine / d1940142 board / 45b259e1 timeline) are recorded `done` per L-1-docs.md; the V-block APPROVED the deployed state (`989fae9`) they represent. No partial-completion follow-up was inserted at V-2 (0 blocking findings). No task marked done that the deployed state does not back.

## Stage-exit checklist (L-2 Distill)
- [PASS] Promotion queue contains 0 proposed principles (≤1 per file satisfied; 0 is valid).
- [PASS] No format violation possible — nothing appended; pre-authored candidates verified Contract-conformant in-ledger.
- [PASS] No war stories / wave refs / cross-refs in the pre-authored candidate lines.
- [PASS] Candidates that WOULD promote (A, B) are broadly-applicable structural invariants, not edge cases — but bar-blocked.
- [PASS] `Why:` lines map to concrete failure modes (forged audit-trail association; CI flake).
- [PASS] No candidate duplicates/contradicts an existing rule (clean space confirmed by both specialists).
- [PASS] Both promotable candidates are durable invariants + deterministically enforceable (source-of-truth re-projection check; advisory-lock serialize check).
- [PASS] Candidate A addresses an existential compliance risk (audit-trail provenance integrity), not a stylistic snack.
- [PASS] Rests on data validated through L-1 reality-check + the real-DB e2e at the deployed commit.

## Rejected-approach lineage (recorded per block-exit requirement)
- OBS-W12-3 (immutable-log teardown): REJECTED-snack — single-occurrence, narrow surface, ambiguous home. Stays in observations.
- Candidates A + B: quality-APPROVED, bar-BLOCKED (first-sighting). Pre-authored + ranked for next-wave promotion-on-recurrence.
- OBS-W12-4 (wave-11 reused-authority BUILD #8 carry-forward): NON-RECURRENCE this wave. Remains HOLD.

## Escalation
- N/A — no unresolvable check, no compliance-gate degradation, no over-promotion requiring consolidation.

## Footer
```yaml
head_signoff:
  verdict: APPROVED
  stage: L-block-exit
  reviewers:
    knowledge_synthesizer: "all four candidates first-sighting / non-recurrence → 0 promotions"
    karen: "A (FK-provenance) + B (advisory-lock) format+impact APPROVE, C REJECT-snack; A/B recurrence-bar-blocked by head-learn"
  failed_checks: []
  rationale: >
    L-1 observations are systemic, reality-checked, and safeguard-focused (no human-blame framing).
    L-2 promoted 0 principles across all files — the correct, disciplined outcome: every candidate is a
    first-sighting or a confirmed non-recurrence under this project's hard 2-wave bar. Specialist disagreement
    (synthesizer 0 vs karen A+B) was adjudicated on the recurrence gate: karen assessed quality not recurrence,
    and her B "2nd occurrence" claim fails against the wave-11 ledger (OBS-W11-3 is Ghost-Green, not a migration
    race; the race is first-sighted this wave). wave-11 OBS-W11-1 did not recur (AuditService wired correctly).
    The two strongest candidates are pre-authored in Contract form and ranked for promotion on genuine next-wave
    recurrence. No *-PRINCIPLES.md file was mutated; file authority preserved.
  next_action: PROCEED_TO_N
observations_emitted: 4
principles_promoted: []
promotion_candidates_held: [OBS-W12-1 (BUILD #8 pre-authored), OBS-W12-2 (CI-PRINCIPLES #1 pre-authored)]
tasks_marked_done: [07989285, d1940142, 45b259e1]   # per L-1-docs.md (authoritative)
```
