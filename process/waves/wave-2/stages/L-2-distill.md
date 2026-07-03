# Wave 2 — L-2 Distill

Owner: head-learn (L-block). Mode: automatic.

## Task done-marking (Actions 1–2)

All 3 claimed tasks were already `done` on entry (marked at prior stage). Verified via
`SELECT id, status FROM tasks WHERE id::text LIKE ...`:
- `e15f71dd-8f61-441c-904a-bdfa108bd6e1` (SuperTokens + user/role data model) — done
- `e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38` (auth API: signup/session/reset) — done
- `af6cbc59-ffcb-43ca-810d-4860d6e6bf64` (auth screens) — done

No re-run needed; status guard satisfied.

## Observation synthesis (Actions 3–4)

`knowledge-synthesizer` spawned against `process/waves/wave-2/` + the wave-1 archive
(`process/waves/_archive/wave-1/blocks/L/observations.md`), with the 2-wave-confirmation
rule as the explicit eligibility gate. Output: **5 observations** →
`process/waves/wave-2/blocks/L/observations.md`.

| Obs | Title (abbrev) | Severity | File | Confirmation |
|---|---|---|---|---|
| OBS-1 | pnpm-workspace.yaml overrides for transitive HIGH-sev audit advisories | warning | BUILD | CONFIRMS-PRIOR (wave-1 OBS-1/OBS-4) |
| OBS-2 | Real-browser E2E required for CORS/cookie auth defects | strong | T-5 | CONFIRMS-PRIOR (wave-1 OBS-5) |
| OBS-3 | NestJS: SuperTokens.init() before NestFactory.create() | strong | BUILD | FIRST-OBSERVATION |
| OBS-4 | TS `import type` erases DI metadata; use value imports | warning | BUILD | FIRST-OBSERVATION |
| OBS-5 | `gh run watch --exit-status` unreliable as merge signal | warning | CI | FIRST-OBSERVATION |

Head-learn gate check on synthesizer output: citations trace to real artifacts (C-1 nodemailer
override; T-5 two-critical-catch; T gate-verdict; C-2 root-cause; V-1-karen). Both CONFIRMS-PRIOR
calls are sound (OBS-1 = different SDK/advisory, structural; OBS-2 = literal vindication of wave-1
OBS-5's "real flows go unverified" prediction). FIRST-OBSERVATIONs correctly deferred.

**Promotion candidates (generalizable + falsifiable + cited + 2-wave-confirmed):** OBS-1, OBS-2.

## Promotion decision (Actions 5–6) — head-learn ONE-per-wave gate

Both candidates target different files (BUILD, T-5); the per-file cap alone would permit both.
Head-learn holds the block's hardest constraint — **at most ONE principle promoted per wave** —
and promotes the single most existential rule, deferring the other confirmed-and-ready.

- **OBS-2 → T-5.md rule 1 — PROMOTED.**
  - karen: **APPROVE** (format verbatim + evidence structurally supports claim, no hallucinated gap + falsifiable/generalizable; optional "browser cookie jar" tweak declined — would push Why to 102 > 100 chars).
  - linter: **OK** — rule line 93 chars (≤120), Why line 98 chars (≤100), exactly 2 non-empty lines, zero forbidden tokens.
  - Rule: `Run real-browser E2E on every wave touching auth, sessions, CORS, or cross-origin cookies.`
    `Why: Curl and unit tests skip CORS preflight and the cookie jar, hiding login-breaking defects.`
  - Commit `5c0eb6b` (pushed) — carries candidate file `blocks/L/candidates/T-5.md` as audit trail.

- **OBS-1 → BUILD — DEFERRED (not promoted this wave).** Clears the 2-wave gate and is format-legal,
  but ranks below OBS-2 (warning hygiene vs strong reliability). Existential beats hygiene when one
  must be chosen. Confirmed-and-ready: promotable to BUILD-PRINCIPLES next BUILD-touching wave with
  no further confirmation. Recorded in observations.md § Head-learn disposition with a pre-vetted
  2-line form.

## Head signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-2-distill
  reviewers: { knowledge-synthesizer: ran, karen: APPROVE (OBS-2) }
  failed_checks: []
  rationale: >
    All 3 claimed tasks confirmed done. Synthesizer produced 5 cited, severity-ranked
    observations; two cleared the 2-wave-confirmation gate. Exercised the ONE-principle-per-wave
    bottleneck: promoted only the strong, existential, deterministically-enforceable T-5 rule
    (karen APPROVE, linter OK, correct 2-line Contract format, no war stories/wave refs), and
    deferred the warning-level BUILD hygiene rule as confirmed-and-ready. No observation theater,
    snacking, root-cause fallacy, over-promotion, or format violation.
  next_action: PROCEED_TO_N-1
```

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "tasks: e15f71dd done, e1c0e81e done, af6cbc59 done"
  - "observations: process/waves/wave-2/blocks/L/observations.md (5 observations)"
  - "principles promotions: 1 (command-center/principles/test-layer-principles/T-5.md rule 1)"
  - "promotion commit: 5c0eb6b (pushed to main)"
tasks_marked_done: [e15f71dd-8f61-441c-904a-bdfa108bd6e1, e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]
tasks_skipped_with_reason: []
observations_emitted: 5
promotion_candidates: 2
karen_verdicts:
  - {candidate_id: OBS-2, target_file: "command-center/principles/test-layer-principles/T-5.md", verdict: APPROVE}
linter_runs:
  - {candidate_id: OBS-2, target_file: "command-center/principles/test-layer-principles/T-5.md", attempt: 1, verdict: OK, rejection_code: ""}
candidates_dropped_by_linter: []
promotions_applied:
  - {file: "command-center/principles/test-layer-principles/T-5.md", line: 1, rule: "Run real-browser E2E on every wave touching auth, sessions, CORS, or cross-origin cookies."}
promotions_deferred:
  - {obs: OBS-1, target_file: "command-center/principles/BUILD-PRINCIPLES.md", reason: "head-learn one-per-wave gate; confirmed-and-ready for next BUILD wave"}
note: "Per-file cap would allow 2 promotions; head-learn ONE-per-wave bottleneck promoted the strongest (OBS-2) and deferred OBS-1."
```
