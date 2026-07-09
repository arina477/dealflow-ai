# Wave 37 — L-2 Distill

**Scope:** mark claimed tasks done (orchestrator, Action 1/2), cross-wave synthesis (knowledge-synthesizer), reality-check the deployed-build-E2E rule-in-waiting for 2-wave clearance (karen), promote AT MOST ONE Contract-exact principle.

## Actions 1–2 — Task done-marking (orchestrator)

Wave-37 claimed-task bundle marked `done` per L-2 Action 1 `UPDATE tasks SET status='done'` (seed: self-serve firm setup + admin role-grant UI). Verify per Action 2. Follow-up task `7f4d150b` (FIX migrate-on-boot) is a SEPARATE row, `parent_task_id=NULL`, and is NOT marked done — it is real open work under M7.

## Action 3 — knowledge-synthesizer

Ran against wave-37 deliverables (TV-closeout, C verify, P-2 spec) + prior L-block observations (esp. wave-33 OBS-1, wave-34 OBS-4) + VERIFY-PRINCIPLES. Output: `process/waves/wave-37/blocks/L/observations.md` — **4 observations** (OBS-A strong/promotion-ready; OBS-B, OBS-C, OBS-D held).

## Action 4 — Promotion candidates

- **OBS-A** (deploy-only fault invisible to green tests, caught only by deployed-origin E2E) — generalizable, falsifiable, cited → **candidate** (target: VERIFY-PRINCIPLES.md).
- OBS-B (P-0 reuse-verification prevents secretly-large waves) — single-wave positive signal → HELD (not VERIFY; pre-build).
- OBS-C (branch loss recoverable via git reflog) — single-wave, positive-recovery, latent gap → HELD.
- OBS-D (migration drift is a systematic deploy-readiness gap; 7f4d150b authored) — sub-kernel of OBS-A, migration-specific → HELD (OBS-A's detection rule already covers it; a post-deploy migration-state BUILD/infra principle is the future home if 7f4d150b's fix is not durable).

## Action 5 — karen promotion vetting (recurrence reality-check)

Spawned karen to adjudicate whether wave-37 is a GENUINE 2nd-wave confirmation of a held kernel or a fake meta-theme over-credit. Verdict:

- **VERIFY rule (OBS-4 / deployed-build E2E) — CONFIRMED-2X.** Wave-37 satisfies BOTH branches of OBS-4's own pre-loaded 2nd-site definition: (a) a build/deploy-only fault green isolated tests passed, and (b) proven-caught-only-by-deployed-E2E. Same kernel (deploy-only fault → live 5xx invisible to green tests), distinct sub-kernel (wave-34 server-render 500 vs wave-37 migration-not-applied 500). Only the **GENERAL** deployed-build-E2E rule form is ≥2x-confirmed; the render-specific form is confirmed once (wave-34) and would exclude the migration fault → the Why must NOT render-lock.
- **VERIFY rule (OBS-1 / external-API adapter request-contract) — STILL-HELD / NOT-APPLICABLE.** Wave-37 has zero external-API adapters / outbound request contracts / mocked-fetch live-verify. Kernel absent. Clock unchanged; Affinity remains the standing 2nd site.

knowledge-synthesizer independently returned the same CONFIRMED-2X verdict on the general form.

## Action 6 — Lint + promote

Candidate written to `process/waves/wave-37/blocks/L/candidates/VERIFY.md`.

- **Lint attempt 1 (synthesizer's draft Why):** FAIL x2 — `linter:why>100` (111 chars incl. indent) + `linter:forbidden-token` (parenthetical `(missing migration, broken server render)` = 41 chars ≥30).
- **Cap-1 karen rewrite:** returned a Contract-clean 2-line candidate (not DROP), Why generalized off render-lock, parenthetical removed, 96 chars.
- **Lint attempt 2 (rewrite):** PASS all 4 — rule ≤120, why ≤100, no forbidden tokens, exactly 2 non-empty lines.
- Dup-check vs existing VERIFY rules 1-3: orthogonal (1 = DB serialization, 2 = adversarial /review, 3 = compliance-invariant mocking; none covers deployed-build E2E). No near-dup.
- **PROMOTED as VERIFY-PRINCIPLES.md rule 4** (sequential — the file had rules 1-3; the wave-33/34 drafts' provisional "rule 5" numbering assumed both drafts would land, they did not). Candidate file renumbered to `4.` to match the audit trail.

Promoted rule (verbatim):
```
4. Run one full end-to-end pass against the deployed build every wave, not only green unit and integration suites.
   Why: A deploy-only fault passes every isolated test yet 500s live on the real deployed build.
```

## Action 7 — Observation pipeline state

Observations recorded in `process/waves/wave-37/blocks/L/observations.md`. Held cross-wave: OBS-1 (wave-33 adapter-contract) still awaiting a genuine 2nd adapter-contract site; OBS-B/C/D single-wave. Soft signal for N/founder: migration-drift (OBS-D) is a two-wave infra reliability gap (0021 + rate_limit_hits) — follow-up 7f4d150b owns it; the promoted rule 4 is the detection backstop until migrate-on-boot is fixed.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "tasks: wave-37 claimed seed bundle marked done (orchestrator Action 1/2); follow-up 7f4d150b left open (separate row)"
  - "observations: process/waves/wave-37/blocks/L/observations.md (4 observations)"
  - "principles promotions: 1 (VERIFY-PRINCIPLES.md rule 4)"
tasks_marked_done: []                    # orchestrator executes Action 1 UPDATE; ids from spec-contract claimed_task_ids
tasks_skipped_with_reason: []
observations_emitted: 4
promotion_candidates: 1
karen_verdicts:
  - {candidate_id: OBS-A, target_file: command-center/principles/VERIFY-PRINCIPLES.md, verdict: APPROVE-CONFIRMED-2X}
  - {candidate_id: OBS-1-carryforward, target_file: command-center/principles/VERIFY-PRINCIPLES.md, verdict: STILL-HELD-not-applicable}
linter_runs:
  - {candidate_id: OBS-A, target_file: command-center/principles/VERIFY-PRINCIPLES.md, attempt: 1, verdict: REJECT, rejection_code: "why>100 + forbidden-token(parenthetical)"}
  - {candidate_id: OBS-A, target_file: command-center/principles/VERIFY-PRINCIPLES.md, attempt: 2, verdict: PASS, rejection_code: ""}
candidates_dropped_by_linter: []
promotions_applied:
  - {file: command-center/principles/VERIFY-PRINCIPLES.md, line: "rule 4", rule: "Run one full end-to-end pass against the deployed build every wave, not only green unit and integration suites."}
note: "OBS-1 (wave-33 external-API adapter request-contract) NOT confirmed this wave (no adapter live-verify); stays HELD. OBS-B/C/D single-wave HELD. One promotion this wave, at the general deployed-build-E2E specificity that both wave-34 (server-render) and wave-37 (migration) incidents confirm."

head_signoff:
  verdict: APPROVED
  stage: L-2
  reviewers:
    knowledge-synthesizer: "4 observations; CONFIRMED-2X on general deployed-build-E2E form"
    karen: "recurrence reality-check CONFIRMED-2X general form / OBS-1 STILL-HELD; cap-1 rewrite Contract-clean"
  failed_checks: []
  rationale: >
    Exactly ONE principle promoted, Contract-exact and linter-clean (rule 4). The promotion rests on a
    GENUINE 2-wave-confirmed kernel — two real production incidents (wave-34 render 500, wave-37 migration
    500), both deploy-only faults invisible to a green suite and caught only by a deployed-origin E2E —
    not the non-codifiable "green-in-isolation" meta-theme, which was explicitly checked and rejected by
    both specialists. The confirmed form is the GENERAL deployed-build-E2E rule; the render-specific form
    (confirmed once) was correctly not promoted so the migration incident is not excluded. The initial Why
    line failed the deterministic linter twice (Formatting Rebellion: over-length + long parenthetical);
    the cap-1 karen rewrite passed and did not narrow the kernel. OBS-1 adapter-contract honestly held (no
    2nd site). No snacking, no temporary-fix promotion, no over-promotion (cap of 1 held; OBS-B/C/D held).
    Rule is deterministically enforceable (a mandated per-wave deployed-origin E2E) and addresses an
    existential class (silent live outages behind green CI).
  next_action: PROCEED_TO_N
```
