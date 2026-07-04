# Wave 9 — L-block Gate Verdict

**Reviewer:** head-learn (fresh spawn, owns L-block lifetime; dies at L-block exit).
**Reviewed against:** `process/waves/wave-9/blocks/L/observations.md`, `L-2-distill.md`, the CHANGELOG `[0.9.0]` L-1 doc, and the target `command-center/principles/BUILD-PRINCIPLES.md` "Contract for new rules".
**Wave:** buyer-universe builder (M4 final) shipped + live-verified at `937ae18`, C-2 first-try.
**Mode:** automatic.

## Verdict

**APPROVED**

## L-1 Docs exit checklist

- [PASS] Retrospective omits individual human error as root cause — every observation names the missing environmental constraint / automated safeguard (missing DB UNIQUE, missing semantic-predicate guard, missing unsupported-dim provenance recording, missing tx-scoped read requirement), never a developer mistake.
- [PASS] "How"-framing over reductionist "why" — each obs traces the local rationality of the spec-authoring gap (what context was absent when the spec was drafted), not a linear blame chain.
- [PASS] Degraded-state acknowledgment — the parse-shape family (OBS-W9-4) is explicitly framed as a pre-existing latent class, now caught earlier rather than assumed absent.
- [PASS] Each anomaly paired with a corrective control — every CRITICAL maps to its fix (UNIQUE+advisory-lock, included-count guard, InTx reads, honest-provenance record, re-assemble state reset).
- [PASS] Plan-authoring defect trace present on every observation — each names the specific spec/context signal that was missing at authoring time.
- [PASS] Precise domain vocabulary (buyer_universe, mandate_id UNIQUE, pg_advisory_xact_lock, runInTransaction, partialFilter, M4/M5 boundary) — no drift to generic terms.
- [PASS] Test-harness-gap evaluation — each obs notes why unit/typecheck missed the defect (mocked repo doesn't race; mock shape hides parse-shape divergence; tx-isolation invisible to compiler).
- [PASS] Failed-sensor identification — the T-5 W9-2 404 false-positive is correctly dispositioned (Karen reproduced a live 401; deploy-propagation artifact, not a missing route), and the C-2-first-try/B-6-catch signal is credited.
- [PASS] Reality-check findings vs mental model — MVP/M4-scope constraints honored (M4/M5 boundary held live by byte-scan; no rank/score leak).
- [PASS] Decisions list alternatives / trade-offs — the honest-partial-filter fix is documented as the honest close (record unsupported dims) chosen over the silent-no-op it replaced.
- [PASS] Tactical vs strategic separation — perf (unbounded assemble) is flagged as an informational scale-envelope note, not conflated with the correctness observations.
- [PASS] AI-code rationale / impact metrics / overridden-constraint checks — N/A this wave (no accepted-because-AI-suggested code; no overridden architectural constraint); CHANGELOG differentiates the compliance-critical fixes from cosmetic residue.

## L-2 Distill exit checklist

- [PASS] Promotion queue = exactly ONE proposed principle (BUILD rule 6). No over-promotion; three genuine first-observations correctly held.
- [PASS] Matches the target Contract format exactly — single-line rule (112 chars ≤120) + single-line `Why:` (98 chars ≤100), sequential numbering (6), deterministic linter OK first attempt.
- [PASS] Free of war stories / wave refs / incident ids / cross-references — linter forbidden-token check clean; karen confirmed no prose voice.
- [PASS] Broad applicability — governs any state-advancing write in the compliance state machine, not a hyper-specific edge case.
- [PASS] `Why:` articulates the concrete failure mode — an empty universe advancing to ready-to-rank, a quantifiable M4→M5-handoff correctness risk.
- [PASS] No contradiction / duplication — karen collision-check confirmed distinct from rule 5 (client wire-format parse) and the VERIFY rules (test/review process).
- [PASS] Durable structural invariant, not a transient patch — a state-machine precondition rule, not a one-off band-aid.
- [PASS] Deterministic testable assertion ("Must guard on the semantic predicate") — not a vague qualifier.
- [PASS] Enforceable via deterministic sensors — per-guard inspection answers a binary question; no manual inferential proof required.
- [PASS] Core existential risk — a compliance-first M&A product submitting an empty ready-to-rank universe is a correctness/compliance defect, not a stylistic snack.
- [PASS] Data validated through L-1 reality-check + MVP-scale — 2-wave-confirmed against real deployed behavior at 937ae18, not web-scale theory.

## Anti-pattern scan (all clear)

- Observation Theater — cleared: every observation maps to a corrective control + a test-harness gap.
- The Snacking Trap — cleared: the one promotion is a compliance-correctness invariant, not aesthetics.
- Root Cause Fallacy — cleared: no observation stops at human error.
- Temporary Fix Promotion — cleared: rule 6 is a durable state-machine invariant, karen-vetted against over-broad scoping.
- Formatting Rebellion / Over-Promotion — cleared: exactly one rule, linter OK, format-exact.
- 2-wave-gate integrity — cleared: no first-observation was inflated to force a promotion; OBS-W9-2's W8-3→W9-2 lineage independently confirmed genuine by karen.

## Rationale

Five high-quality, reality-checked, systemic observations — each traced to a plan-authoring defect and a test-harness gap, none resting on human error. Exactly one principle promoted (BUILD rule 6), the single 2-wave-confirmed candidate (OBS-W9-2 CONFIRMS-PRIOR OBS-W8-3), format-exact and deterministically enforceable, karen-APPROVE across format / falsifiability / collision / lineage-honesty and linter-OK on first attempt. The disciplined outcome is respected: three genuine first-observations (W9-1 DB-UNIQUE container, W9-3 unsupported-filter-dim provenance, W9-5 in-tx reads) are held to carry-forward rather than force-promoted, and the parse-shape family (W9-4) is recorded as a confirming THIRD firing of the existing BUILD rule 5 — not re-promoted — with the C-2-first-try / B-6-pre-deploy-catch result correctly credited as the intended payoff of the distillation loop. M4 is structurally complete but its milestone-completion judgment is deferred to N-block (BOARD under automatic) per L-1 mode-aware routing, not hand-transitioned here.

## Footer

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-block-exit
  reviewers: { knowledge-synthesizer: synthesis, karen: promotion-vet(APPROVE) }
  failed_checks: []
  rationale: "5 systemic reality-checked observations; exactly 1 format-exact 2-wave-confirmed promotion (BUILD rule 6); 3 first-observations disciplined to carry-forward; parse-shape family confirmed 3rd wave not re-promoted; M4 completion deferred to N-block."
  next_action: PROCEED_TO_N
```
