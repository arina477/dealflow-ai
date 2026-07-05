# Wave 11 — L-block Observations (reality-checked retro)

**Wave:** 11 — M6 compliant-outreach foundation (first bundle).
**Author:** head-learn (L-2 distill gate).
**Vetted by:** karen (rule-quality reality-check) + knowledge-synthesizer (cross-wave recurrence).
**Net promotion this wave:** 0 across all `*-PRINCIPLES.md` files. All observations are FIRST-sightings; none clears the 2-waves-recurrence bar. Cap of "at most one per file" is not reached.

Each entry is logged with wave-11 as first-sighting so the wave-12 L-1 author can detect recurrence deterministically instead of re-deriving. Recurrence in any later wave promotes on sight (subject to head-X approval + format contract), no re-litigation.

---

## What shipped

- Compliant-outreach foundation (M6 first bundle): template spine with version-binding, composer + non-bypassable compliance gate, separation-of-duties on approve/compose.
- The send-eligibility decision reuses the M2 `ComplianceGateService` as the single authority; `send_eligible` is reachable only through a passing `evaluate()` verdict.
- Deployed at `af5b5d9` = CI-green `8d7ed8b` + docs-only chore; provenance unbroken; live `/health` returns the deployed hash.
- Deferred bundles (out of scope this wave): actual send-path + tracking + pipeline; AI-drafting (behind founder LLM-spend gate).

## Systemic root-cause map (not human-blame)

The load-bearing defect this wave was NOT a coding slip — it was a **cross-module integration-contract gap** that unit-level mocking rendered invisible, then two independent safeguards (adversarial `/review` + a real-DB e2e) surfaced. The learning targets the missing safeguards, not the author.

---

## Observation ledger (first-sightings — carry-forward)

### OBS-W11-1 — Reused-authority store-binding (HIGHEST LEVERAGE; priority carry-forward)

**What:** Reusing a shared decision-authority service (M2 `ComplianceGateService`) that resolves its decision EXCLUSIVELY from one store (`compliance_approvals` via `loadApproval`), while the new outreach approval flow wrote approval state into a DIFFERENT store (`outreach_template_versions` columns) the service never reads. Result: the gate evaluated a vacuously empty set → `verdict.allowed=false` → `status` always `blocked` → `send_eligible` UNREACHABLE in prod. Fix: `ApprovalService` writes/revokes a `compliance_approvals` row for `('outreach-template-version', versionId)` in-tx (single-authority preserved).

**Root class:** Write-path wiring gap. This is a DISTINCT third failure mode, NOT covered by BUILD #6 (guards the wrong predicate) or BUILD #7 (reads via the wrong tx handle). Here the service reads the right store and evaluates the right predicate — but the inputs were never written where the authority looks. Clean space between BUILD #5 (client-parse shape) and BUILD #6 (predicate-vs-count).

**Systemic (not human):** mocked unit tests stubbed the gate, so the missing data-binding was structurally invisible. The safeguards that caught it — adversarial `/review` (B-6 Phase-2) and an un-mocked real-DB e2e — are the durable controls.

**Recurrence:** FIRST occurrence (wave-11). No prior OBS in waves 1-10. Holds in observations until a second wave confirms.

**Pre-authored BUILD #8 candidate (format-checked; DO NOT promote until wave-12 confirms):**
```
8. When reusing a shared decision authority, write the new feature's decision inputs into the exact store that authority reads.
   Why: A parallel store the authority never reads resolves to no-decision and silently blocks the guarded state.
```

### OBS-W11-2 — Mock-the-claim-away (confirming re-fire of VERIFY #1 — do NOT re-promote)

**What:** The "gate reaches `send_eligible`" claim was proven only after an UN-MOCKED integration test (real gate + repository + audit vs real Postgres) replaced a mocked-gate unit test that asserted nothing about the reused service's real data binding. An integration test that mocks the collaborator whose behavior IS the claim proves nothing.

**Recurrence / disposition:** This is a re-firing of the FakeRepo/echoing-stub family that already produced **VERIFY rule 1** ("Test any path that recomputes a value from persisted data against the real DB wire format, not an echoing stub"), origin wave-4 OBS-1. Near-dup of VERIFY #1 (Authoring-discipline grep-for-near-dup fails). No NEW rule warranted; logged as a confirming firing of the existing rule. VERIFY #1 already covers it and holds.

### OBS-W11-3 — Uncollected-test Ghost Green (Ghost Green family; infra-guard candidate)

**What:** The e2e file `*.integration-spec.ts` did not match the vitest include glob `*.{spec,test,e2e-spec}.ts` → silently never collected → "green" suite that never ran the load-bearing test. Renamed to `.e2e-spec.ts`. Caught and fixed in-gate at B-6 re-verify (never escaped).

**Root class:** Ghost Green — a toolchain emits a success signal while silently omitting a unit of work. Pattern-adjacent to **BUILD rule 4** (drizzle journal skip), but a NEW sub-class (test-runner domain vs migration domain).

**Recurrence:** FIRST occurrence of this sub-class. Holds. If it recurs, the correct home is a CI-PRINCIPLES **guard** ("fail the build when a `*-spec`-suffixed file is not matched by the runner's include glob"), a deterministic check — NOT a file-naming re-read rule. Better yet, file a CI task now.

### OBS-W11-4 — No-local-DB cascading fix-forward (REJECTED as promotable — non-falsifiable)

**What:** With no local Postgres, the un-mocked e2e surfaced bugs one CI cycle at a time (param-binding → NOT-NULL column → tx-isolation → ctor arg-order → active-disclaimer). Logged in C-1 as TEST-INFRA, never a product/gate defect; the loop cost CI cycles but produced correct code + a genuine green e2e.

**Disposition:** The proposed lesson ("comprehensive wiring/schema audit before first push") is non-falsifiable (fails the same test as the Contract's rejected "Write good error messages") and its checkable kernel is already covered by VERIFY #1 + BUILD #7 (tx-isolation was one of the five cycles). Workflow-efficiency gripe, not a systemic correctness invariant. Not promotable now or on recurrence as phrased.

---

## Promotion decision (this wave)

| Candidate | Durable/enforceable | Dup? | 2-wave bar | Verdict |
|---|---|---|---|---|
| OBS-W11-1 reused-authority store-binding | Yes (strong) | No (clean space BUILD #5/#6) | FAILS (1st wave) | HOLD-in-observations (priority carry-forward) |
| OBS-W11-2 mock-the-claim-away | Yes | Near-dup / re-fire of VERIFY #1 | FAILS | REJECT-dup (confirms VERIFY #1) |
| OBS-W11-3 uncollected-test Ghost Green | Weak (tool-specific; caught in-gate) | No (adjacent BUILD #4) | FAILS | HOLD-in-observations (→ CI guard on recur) |
| OBS-W11-4 cascading fix-forward | No (non-falsifiable) | Kernel in VERIFY #1 + BUILD #7 | FAILS | REJECT-snack |

**Promoted:** 0 to BUILD, 0 to VERIFY, 0 to CI, 0 to T-4. Every candidate is first-occurrence; the recurrence bar blocks all promotions regardless of quality. This is a valid outcome (0 is allowed when nothing clears the bar).

---

## Footer

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "karen reality-check: net promotion 0 (all first-occurrence; C2 near-dup of VERIFY #1)"
  - "knowledge-synthesizer recurrence: OBS-W11-1/3/4 first-sighting; OBS-W11-2 re-fire of VERIFY #1 (wave-4 OBS-1 lineage)"
  - "OBS-W11-1 pre-authored as BUILD #8 candidate; promotes on wave-12 recurrence"
note: "Priority carry-forward = OBS-W11-1 (reused-authority store-binding)."
```
