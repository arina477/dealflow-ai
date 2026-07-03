# L-2 — Distill (wave-4)

## Action 1/2 — Tasks marked done + verified

All 4 claimed tasks were already `done` from the prior L-2 bookkeeping pass. Idempotent guarded
UPDATE returned 0 rows (status guard correctly skipped already-done rows). Verification SELECT
confirms all four `status='done'`:

- `ec1f279d-ea8a-44db-977b-cb6891972c1f` — done
- `a8b2b5a2-18c5-46a3-a430-bb36e492500f` — done
- `e6a4cbfe-121b-4fdc-8ae4-85db7e434378` — done
- `031d79fc-7513-4571-b0c9-8f43590fc9bf` — done

## Action 3 — knowledge-synthesizer

Spawned against `process/waves/wave-4/` + all three prior archived observation sets
(`_archive/wave-{1,2,3}/blocks/L/observations.md`) + current principles files. Emitted **5
observations** to `process/waves/wave-4/blocks/L/observations.md`, cited and severity-ranked, with
cross-wave lineage reconciled. Two prior candidates recorded as NON-FIRING (absence of stimulus, not
new confirmation): wave-3 OBS-4 NestJS-guard-DI-export (AuditModule reused the exported-provider
pattern cleanly, no DI crash) and the pnpm-workspace override (no new SDK; `node:crypto` is built-in;
already promoted as BUILD rule 1 in wave-3).

## Action 4 — Promotion candidate filter

| Obs | Candidate file | Severity | Confirmation | head-learn disposition |
|---|---|---|---|---|
| OBS-1 stub/FakeRepo masks DB serialization divergence | VERIFY | strong | CONFIRMED-AND-READY (3rd firing of real-boundary family) | **PROMOTE (selected)** |
| OBS-5 adversarial /review catches integrity CRITICALs | VERIFY | strong | CONFIRMS-PRIOR wave-3 OBS-1 | HOLD (near-dup root of OBS-1; same file; cap=1) |
| OBS-4 same-origin proxy for cookie-guarded fetch | BUILD | warning | CONFIRMS-PRIOR wave-2 OBS-2 | HOLD (warning; snacking risk if promoted alongside strong VERIFY) |
| OBS-2 BEFORE trigger is load-bearing immutability control | BUILD | strong | FIRST-OBSERVATION | HOLD (first firing; 2-wave rule) |
| OBS-3 P-4 multi-iteration gate catches route/design drift | none | warning | CONFIRMS-PRIOR wave-3 OBS-3 | No candidate file (validates brain gate spec); corroboration only |

**Head-learn selection rationale — ONE promotion this wave:**
- **OBS-1 chosen over OBS-5** for the single VERIFY slot: OBS-1 is the more deterministically
  enforceable, more falsifiable rule (a reviewer can mechanically check whether a real-DB-wire-format
  regression test exists on the integrity path), it has the deepest cross-wave generality (3rd firing
  of the real-boundary family across waves 2/3/4), and OBS-5 shares its root ("test evidence is
  contaminated on integrity paths") so promoting both risks phantom duplication in one file.
- **OBS-4 held** — promoting a warning-severity build-config convenience alongside a strong VERIFY
  rule is the snacking trap; one existential rule per wave beats flooding two files.
- **OBS-2 held** — FIRST-OBSERVATION; awaits a second wave introducing DB-level immutability.
- **OBS-3** — no principle to author (validates the existing P-4 gate spec); recorded as corroboration.

## Action 5 — karen vetting

Spawned karen on the single OBS-1 candidate vs the VERIFY "Contract for new rules" + wave-4 evidence.
**Verdict: APPROVE.** Format PASS, falsifiability strong, evidence-vs-claim matched (no overreach),
distinct from T-5 rule 1 (browser E2E vs DB serialization round-trip), existential (the masked bug
meant the compliance audit-log chain NEVER verified live while 347 unit tests were green). Karen
flagged one non-blocking risk: the deterministic linter counts the 3-space continuation indent in
`length($0)`, so the original Why line (103 with indent) would trip `linter:why>100`. Applied karen's
proposed tightening pre-lint.

## Action 6 — Lint + promote

Candidate: `process/waves/wave-4/blocks/L/candidates/VERIFY-PRINCIPLES.md`. Deterministic linter
**PASS** (`linter:OK`): rule line 114 ≤ 120, Why line 100 ≤ 100, exactly 2 non-empty lines, no
forbidden tokens. Appended as VERIFY-PRINCIPLES.md rule 1 under `## Rules` (replaced the empty
placeholder). Committed with the candidate file as audit trail.

Promoted rule:
```
1. Test any path that recomputes a value from persisted data against the real DB wire format, not an echoing stub.
   Why: A stub returning the stored value verbatim cannot detect app-vs-DB serialization divergence.
```

## Action 7 — Observation pipeline state

5 observations recorded. 4 held for future waves (OBS-2 awaits 2nd DB-immutability firing; OBS-4 and
OBS-5 remain confirmed-and-ready for a future wave where the per-file cap permits; OBS-3 is gate
corroboration). Soft signal for next checkpoint: the "real-boundary testing" family and the
"adversarial /review on integrity surfaces" gate are both now strong, recurring patterns — OBS-5 and
OBS-4 are prime next-wave promotion candidates.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "tasks: ec1f279d done, a8b2b5a2 done, e6a4cbfe done, 031d79fc done"
  - "observations: process/waves/wave-4/blocks/L/observations.md (5 observations)"
  - "principles promotions: 1 (command-center/principles/VERIFY-PRINCIPLES.md rule 1)"
tasks_marked_done: [ec1f279d-ea8a-44db-977b-cb6891972c1f, a8b2b5a2-18c5-46a3-a430-bb36e492500f, e6a4cbfe-121b-4fdc-8ae4-85db7e434378, 031d79fc-7513-4571-b0c9-8f43590fc9bf]
tasks_skipped_with_reason: []          # all already done from prior L-2 pass; guarded UPDATE no-op
observations_emitted: 5
promotion_candidates: 4                 # OBS-1, OBS-4, OBS-5 (file candidates) + OBS-3 (no-file corroboration)
karen_verdicts:
  - {candidate_id: OBS-1, target_file: command-center/principles/VERIFY-PRINCIPLES.md, verdict: APPROVE}
linter_runs:
  - {candidate_id: OBS-1, target_file: command-center/principles/VERIFY-PRINCIPLES.md, attempt: 1, verdict: OK, rejection_code: ""}
candidates_dropped_by_linter: []
promotions_applied:
  - {file: command-center/principles/VERIFY-PRINCIPLES.md, line: 1, rule: "Test any path that recomputes a value from persisted data against the real DB wire format, not an echoing stub."}
note: "At most ONE principle promoted (VERIFY rule 1). OBS-5/OBS-4 held to respect ≤1-existential-rule-per-wave and avoid snacking/phantom-duplication; OBS-2 held as FIRST-OBSERVATION."
```
