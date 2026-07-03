# L-2 — Distill (wave 5)

**Block:** L (Learn) · **Stage:** L-2 (∥ L-1) · **Mode:** automatic · **Owner:** head-learn

## Action 1/2 — Claimed tasks marked done + verified

All 4 wave-5 claimed tasks were already `done` (V-block/prior stages closed them); verified live:

| task_id | status | title (abbrev) |
|---|---|---|
| 0595a835-db62-4685-b451-1cd6c06416bf | done | Build compliance rules engine schema + non-bypassable pre-send gate |
| 95adac6c-25cb-4c67-bd78-a401477143ad | done | Enforce suppression-list + approval-SoD checks |
| 034463b1-7abb-4417-8e34-7f6184a0c8db | done | Enforce jurisdiction disclaimers + approval-version binding |
| 34cb1d18-9bff-4302-8f7e-c508ac5fef99 | done | Wire compliance-settings screen |

No status guard mismatch; no skipped/stale ids.

## Action 3 — knowledge-synthesizer

Spawned `knowledge-synthesizer` against `process/waves/wave-5/` + all prior archived observations (waves 1–4) + current principles files. Output: **5 observations** written to `process/waves/wave-5/blocks/L/observations.md`, each cited (file:line), severity-ranked, cross-wave-lineage reconciled.

Observation roster:
- **OBS-1** (strong, VERIFY) — FK-cross-id-space: external identity token used directly as an FK; mocked DB never fires the FK; live POST 500. 4th firing of the real-persistence-boundary family.
- **OBS-2** (strong, T-5) — authenticated mutating POST 401s under SuperTokens anti-CSRF; caught only by real-browser T-5. 3rd firing of the real-browser auth family.
- **OBS-3** (informational, none) — P-4 multi-iteration gate caught SoD-authority drift (admin-as-approver) before B-block; 3rd consecutive firing; gate-validation only, no new principle (consistent with wave-3/4 OBS-3 conclusion).
- **OBS-4** (warning, BUILD) — NestJS guard DI: consuming module must export the injected repository; 3rd firing; wave-5 adds `compliance.di-boot.spec.ts` regression test.
- **OBS-5** (warning, BUILD) — non-bypassable-by-construction enforcement-gate pattern (4 structural properties); FIRST-OBSERVATION, deferred.

## Action 4 — Filter to promotion candidates

Three observations met generalizable + falsifiable + cited, targeting three different files: OBS-4→BUILD, OBS-1→VERIFY, OBS-2→T-5. OBS-3 (no candidate file) and OBS-5 (FIRST-OBSERVATION, needs a 2nd wave) filtered out.

## Action 5 — karen vetting

Spawned `karen` to vet all three against their target contracts (format + falsifiability + LOGICAL DUPLICATION against existing rules). Verdicts:

| candidate | target | karen verdict | key finding |
|---|---|---|---|
| OBS-4 | BUILD-PRINCIPLES.md | APPROVE | orthogonal to rule 1 (DI boundary vs pnpm audit); 2-wave confirmed; format-legal |
| OBS-1 | VERIFY-PRINCIPLES.md | APPROVE | distinct from rule 1 (write/FK-namespace vs read/serialization); not a re-skin |
| OBS-2 | test-layer-principles/T-5.md | APPROVE | distinct axis vs rule 1 (spec-content vs trigger); non-redundant |

## Action 6 — head-learn stack-rank + lint + promote (≤1 per file, spirit ≤1 per wave)

**head-learn decision: PROMOTE ONE — OBS-4 → BUILD-PRINCIPLES rule 2.**

Although karen APPROVED all three AND the per-file cap technically permits three (three different files), head-learn HELD OBS-1 and OBS-2 to guard against over-promotion / rule-fatigue:
- OBS-1 (VERIFY) and OBS-2 (T-5) are companion-refinements to already-promoted PARENT rules (VERIFY rule 1 already drives real-DB testing on the correct paths; T-5 rule 1 already mandates the real-browser E2E that caught the CSRF defect). Both are technically distinct but near-neighbors; the marginal enforcement gain does not justify two more same-family rules in one wave.
- OBS-4 is categorically stronger: a 2-wave-HELD candidate (wave-3 explicitly deferred it awaiting confirmation), a genuinely orthogonal durable structural invariant, deterministically CI-enforced by a shipped regression test (`compliance.di-boot.spec.ts`), landing in a BUILD file whose single existing rule is unrelated.

OBS-1 and OBS-2 remain CONFIRMED-AND-READY in observations.md with a HELD note; they promote cleanly next wave if the family re-fires or if no stronger candidate competes.

**Linter run on OBS-4 candidate (`process/waves/wave-5/blocks/L/candidates/BUILD-PRINCIPLES.md`):**
- Attempt 1: `linter:why>100` — pre-vetted Why line was 104 chars incl. 3-space indent.
- Cap-1 karen rewrite: Why trimmed to "…at the consuming module boundary, not where defined." (98 chars).
- Attempt 2: `linter:OK` (rule 117 ≤120, Why 98 ≤100, exactly 2 lines, no forbidden tokens).

**Promoted (BUILD-PRINCIPLES.md rule 2):**
```
2. When a NestJS guard injects a repository, that repository must be exported by every module that imports the guard.
   Why: NestJS DI resolves constructor tokens at the consuming module boundary, not where defined.
```

Commit `9ac945b` — `docs(principles): L-2 promote rule 2 to BUILD-PRINCIPLES from wave-5` (principles file + candidate audit-trail file). Pushed.

## Action 7 — Observation pipeline state

observations.md emitted (5 observations, always). HELD candidates (OBS-1, OBS-2) recorded with lineage for next-wave promotion. OBS-5 (non-bypassable-by-construction) flagged as a strong FIRST-OBSERVATION BUILD candidate awaiting a 2nd-wave confirmation. No founder-checkpoint soft-signal required.

---

## head-learn stage-exit checklist (L-2 Distill)

- Promotion queue = exactly ONE proposed principle promoted (three vetted, two HELD by stack-rank): PASS
- Promoted principle matches Contract format exactly (single-line rule + single-line Why, sequential #2, linter PASS): PASS
- No war stories / wave refs / incident ids / cross-refs in the promoted text: PASS
- Applies broadly across the NestJS stack (not a hyper-specific edge case): PASS
- Why maps to a concrete failure mode (boot-time UnknownDependenciesException / deploy crash): PASS
- No contradiction / duplication with existing BUILD rule 1 (pnpm) — karen collision check clean: PASS
- Durable structural invariant, not a transient patch (3-wave DI family; regression-test-encoded): PASS
- Deterministic testable assertion; enforceable by a DI-boot unit test (computational sensor), not a manual step: PASS
- Rests on L-1/V-1 reality-checked data (C-2 boot logs, karen Finding 5), stress-tested at MVP scale: PASS
- Over-promotion guarded: 2 karen-approved near-neighbor candidates HELD rather than dumped into their files: PASS

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-2-distill
  reviewers: {knowledge-synthesizer: emitted-5-observations, karen: approved-3-vetted-1-rewrite}
  failed_checks: []
  rationale: >
    Five cited, severity-ranked observations emitted. Three met the promotion filter and karen
    APPROVED all three across three files. head-learn promoted exactly ONE — OBS-4 (guard-injected
    repository must be exported by every consuming module) to BUILD-PRINCIPLES rule 2 — as the single
    durable, orthogonal, deterministically-enforceable, 2-wave-confirmed lesson. The two remaining
    karen-approved candidates (OBS-1 VERIFY FK-id-space; OBS-2 T-5 mutating-POST) were HELD by
    head-learn stack-rank to prevent over-promotion / rule-fatigue: both are companion-refinements to
    already-promoted parent rules and promote cleanly next wave. Candidate passed the deterministic
    linter after one cap-1 karen rewrite. Commit pushed with its candidate file as audit trail.
  next_action: PROCEED_TO_L-block-exit

l_stage_verdict: COMPLETE
verdict_evidence:
  - "tasks: 0595a835 done, 95adac6c done, 034463b1 done, 34cb1d18 done"
  - "observations: process/waves/wave-5/blocks/L/observations.md (5 observations)"
  - "principles promotions: 1 (BUILD-PRINCIPLES.md rule 2), commit 9ac945b"
tasks_marked_done: [0595a835-db62-4685-b451-1cd6c06416bf, 95adac6c-25cb-4c67-bd78-a401477143ad, 034463b1-7abb-4417-8e34-7f6184a0c8db, 34cb1d18-9bff-4302-8f7e-c508ac5fef99]
tasks_skipped_with_reason: []
observations_emitted: 5
promotion_candidates: 3
karen_verdicts:
  - {candidate_id: OBS-4, target_file: command-center/principles/BUILD-PRINCIPLES.md, verdict: APPROVE}
  - {candidate_id: OBS-1, target_file: command-center/principles/VERIFY-PRINCIPLES.md, verdict: APPROVE}
  - {candidate_id: OBS-2, target_file: command-center/principles/test-layer-principles/T-5.md, verdict: APPROVE}
linter_runs:
  - {candidate_id: OBS-4, target_file: command-center/principles/BUILD-PRINCIPLES.md, attempt: 1, verdict: REJECT, rejection_code: "linter:why>100"}
  - {candidate_id: OBS-4, target_file: command-center/principles/BUILD-PRINCIPLES.md, attempt: 2, verdict: PASS, rejection_code: ""}
candidates_dropped_by_linter: []
candidates_held_by_head_learn:
  - {candidate_id: OBS-1, target_file: command-center/principles/VERIFY-PRINCIPLES.md, reason: "karen-APPROVED companion-refinement to VERIFY rule 1; held to avoid over-promotion; CONFIRMED-AND-READY next wave"}
  - {candidate_id: OBS-2, target_file: command-center/principles/test-layer-principles/T-5.md, reason: "karen-APPROVED companion-refinement to T-5 rule 1; held to avoid over-promotion; CONFIRMED-AND-READY next wave"}
promotions_applied:
  - {file: command-center/principles/BUILD-PRINCIPLES.md, line: "rule 2", rule: "When a NestJS guard injects a repository, that repository must be exported by every module that imports the guard."}
note: "OBS-5 (non-bypassable-by-construction enforcement-gate pattern) is a strong FIRST-OBSERVATION BUILD candidate; deferred pending a 2nd-wave confirmation in a different gate implementation."
```
