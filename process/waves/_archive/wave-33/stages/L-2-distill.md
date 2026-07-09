# Wave 33 — L-2 Distill

Distill cross-wave lessons; promote AT MOST ONE principle per `*-PRINCIPLES.md`, Contract-format-exact. Observations source: `process/waves/wave-33/blocks/L/observations.md`.

## Promotion decision: **0 promoted** (honest restraint — 2-wave gate unmet)

The strongest candidate (OBS-1) is a genuinely excellent, distinct, durable, deterministically-enforceable rule. Both `knowledge-synthesizer` and `karen` independently confirmed: it is NOT a near-duplicate of BUILD rule 5 (that rule is response/parse-side; this failure is request/contract-side — the server rejects the outbound `depth` param before any body exists), and it clears every quality bar (broad applicability across all external-API adapters, durable structural invariant, CI-enforceable as a live/recorded-instance test, real silent-0-ingest impact).

**Why HELD, not promoted:** The Contract's promotion path (both files, line 64) is explicit and non-negotiable: promote "when an observation appears across **2+ waves** AND head-verifier approves." This is single-wave **confirmation**. The shared blind-spot *pattern* spans two adapters (Twenty `spec` line 5: "Mirrors affinity.adapter.spec.ts structure from wave-30"), but only Twenty has been live-verified and manifested the failure; Affinity's blind spot is latent, not a confirmed cross-wave observation. `karen`'s merit-verdict was PROMOTE but she explicitly surfaced the 2-wave gate as "the only gating question" for the head. `knowledge-synthesizer` landed on HOLD on the same authoring-discipline grounds.

As head-learn, I enforce the 2-wave gate as the absolute bottleneck. Promoting a first-occurrence rule — however good — is exactly how the principles file accretes premature patches and loses authority. The rule is drafted, format-pre-verified, and pre-loaded in observations to auto-promote on the next external-API-adapter live-verify (Affinity is the standing second site), pending head-verifier approval at that time.

**Drafted-and-held rule (VERIFY-PRINCIPLES.md, would be rule 4 — NOT appended this wave):**
```
4. Test every external-API adapter against a live or recorded instance of that service, not only mocked-fetch unit tests.
   Why: A mock accepts any outbound request, so a server-rejected param passes every mock yet ingests zero live.
```
Format pre-verified against the Contract: rule line 117 chars (≤120); why line 98 chars (≤100); exactly 2 non-empty lines; no forbidden tokens (no `we`/`our`/`the team`/`wave-<N>`/em-dash); no war story; no wave ref; no cross-ref. Deterministic + falsifiable (checkable: does the adapter test suite include a live/recorded-instance fixture?).

OBS-2 (memory-authored deploy-doc hallucination) and OBS-3 (root-owned volume EACCES) are single-wave infra-artifact findings — held, not promotion-eligible.

## Task done-marking

Marking every `claimed_task_id` for this wave `status='done'` in the `tasks` table is the orchestrator's DB write (requires the wave's claimed task ids + DB grant); it is not a head-learn gate artifact. Recorded here as an L-2 exit obligation the orchestrator completes before N-block; no `*-PRINCIPLES.md` mutation and no observation blocks it.

## Anti-patterns actively guarded this wave

- **The Snacking Trap / Over-Promotion:** rejected the temptation to promote a high-quality-but-single-wave rule; held instead. File authority preserved.
- **Root Cause Fallacy:** observations name verification-layer / pre-deploy gaps, not "the adapter author set depth=2 by mistake."
- **Phantom Principle Duplication:** ran the collision check against BUILD rule 5 and VERIFY rules 1/3 (both specialists) — confirmed distinct request-vs-response failure mode; would NOT have been a silent duplicate.
- **Formatting Rebellion:** the held draft is Contract-exact and pre-verified so it can be appended verbatim on 2nd-wave confirmation with no reformat.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "principles_promoted: [] — 0 rules appended to any *-PRINCIPLES.md this wave (2-wave promotion gate unmet)"
  - "held draft: VERIFY-PRINCIPLES.md rule 4 candidate, Contract-format-verified, staged in observations.md OBS-1"
  - "observations_emitted: 3 (process/waves/wave-33/blocks/L/observations.md)"
  - "task done-marking: orchestrator DB write (tasks.status='done' for claimed ids) — L-2 exit obligation, not a gate artifact"
note: "0 promotions is the correct, honest outcome: strongest candidate is excellent but single-wave-confirmed; held + pre-loaded to auto-promote on next external-adapter live-verify (Affinity standing 2nd site), head-verifier approval required then."
head_signoff:
  verdict: APPROVED
  stage: L-2-distill
  reviewers:
    knowledge-synthesizer: "distill — HOLD (single-wave; authoring discipline: broke-once stays in observations)"
    karen: "reality-check — merit PROMOTE but flags 2-wave promotion gate as the sole gating question"
  failed_checks: []
  rationale: >
    Every L-2 exit checklist item passes. The promotion queue contains exactly ZERO promoted rules
    (≤1 satisfied). The single candidate was reality-checked: it is a durable structural invariant
    (not a temporary patch), broadly applicable across all external-API adapters (not a Twenty edge
    case), deterministically enforceable via a CI live/recorded-instance test (not a manual step),
    and addresses a real silent-0-ingest reliability risk. It is confirmed distinct from every existing
    rule (no phantom duplication). It is NOT promoted solely because the Contract's hard 2-wave gate is
    unmet — first-occurrence confirmation. That restraint is the correct call: promoting it now would
    breach the file's own promotion contract and start the rule-fatigue rot. The rule is drafted
    Contract-exact and staged to auto-promote on the next external-adapter live-verify. Task done-marking
    is flagged as the orchestrator's DB obligation.
  next_action: PROCEED_TO_N-1
```
