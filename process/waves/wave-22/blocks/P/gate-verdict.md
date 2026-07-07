# Wave 22 — P-4 Gate Verdict (Phase 1, Attempt 1)

**Gate:** P-4 (Product block exit)
**Agent:** head-product (fresh spawn)
**Wave:** 22 — M9 test-hygiene fix-forward (OAE-3 flake class)
**Type:** single-spec, backend-test-only. design_gap=false, D-skip.
**claimed_task_ids:** [02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762]

## VERDICT: APPROVED

Proceed to B-block.

## Ground-truth verification (read the actual spec, not just the deliverables)

Confirmed against `apps/api/test/outreach-activity-rls.e2e-spec.ts`:
- **8 unscoped `COUNT(*) FROM audit_log_entries`** at lines 374, 408, 453, 474, 516, 540, 583, 607 — no `WHERE workspace_id`.
- **4 unscoped latest-action `... ORDER BY sequence_number DESC LIMIT 1`** at lines 415, 479, 547, 614 — no `WHERE workspace_id`.
- = **12-site class**, matching the reconciled count in P-0/P-1/P-2/P-3 (not 4, not 8).
- The 3 `outreach_activity` COUNTs (312/337/652) are ALREADY `WHERE workspace_id = $1` scoped → correctly OUT of the flake class, correctly untouched by the plan.

## Judge (the 4 checks)

**1. Causal + correct fix — CONFIRMED.**
The current pattern is a GLOBAL before/after delta: snapshot `beforeCount` global → mutate → `afterCount` global → `expect(afterCount).toBe(beforeCount+1)` (lines 373-411). This is precisely the still-polluted anti-fix problem-framer named: a concurrent audit-writing suite inserting a row BETWEEN the two snapshots breaks `+1`. The approved fix scopes by the indexed `workspace_id` column (`WHERE workspace_id = OAE_WS_A`) — immune to concurrent-suite rows because every test seeds + mutates within `OAE_WS_A`. This directly implements the promoted T-4 rule 2 (own-scoped-rows). It is NOT a symptom-patch: no retry, no serialize. Scope-by-workspace_id (not delta) is the correct causal fix. PASS.

**2. Fault-killing preserved — CONFIRMED (the load-bearing check).**
- Scoped COUNT stays a `+1` assertion on `WHERE workspace_id=OAE_WS_A` (before AND after) → still proves the mutation appended exactly ONE entry for THIS workspace. Not weakened to "0 or more" / not vacuous.
- Scoped latest-action becomes `WHERE workspace_id=OAE_WS_A ORDER BY sequence_number DESC LIMIT 1` → still proves the exact verb (`outreach-activity-create` / `-update` / `-status-transition`). Not vacuous.
- `verifyChain()` (lines 420/483/…) is correctly left GLOBAL and untouched — workspace_id is HMAC-EXCLUDED (wave-17), the hash-chain is global; scoping there would be wrong. Spec + plan explicitly do not touch it.
P-2 AC-2 and P-3 both state assertions MUST stay fault-killing and explicitly forbid vacuous/tautological rewrites. PASS.

**3. Scope: one suite, whole 12-site class — CONFIRMED.**
HOLD-SCOPE: ONE file only, no other-suite sweep (ceo-reviewer + T-4 rule 2 + CI-authoritative policy own repo-wide). Whole-class: all 12 (8 COUNT + 4 latest-action) — mvp-thinner correctly held them atomic (the 4 latest-action reads are strictly MORE pollution-vulnerable than the COUNTs; peeling them = OVER-CUT leaving the flake partially live). PASS.

**4. No product change — CONFIRMED.**
Test-only. schema_change=false, no migration, no UI, no product code. B-0/B-1/B-3 SKIP. _TBD milestone metric → correctly NO product-AC (this is a reliability fix, not a feature). PASS.

## Stage-exit / P-4 checklist
- [x] All audit-log-touching ACs are binary, observable, machine-checkable (`COUNT(...) WHERE workspace_id = X == before+1`; `MAX-sequence action WHERE workspace_id=X == <verb>`).
- [x] Reviewer verdicts (problem-framer PROCEED, ceo-reviewer PROCEED/HOLD-SCOPE, mvp-thinner OK/no-split) logged, resolved, integrated into the spec contract.
- [x] Every claimed_task_id (02f4e6a1) traces to the M9 milestone bet (OAE-3 flake fix-forward, wave-20 test surfaced wave-21 C-1).
- [x] Machine-readable + end-to-end traceable → gate does NOT default to No-Go.
- [x] Compliance posture: fix HARDENS the audit-ISOLATION suite's signal (a false-RED here could MASK a genuine RLS regression) without weakening any fault-killing assertion.

## head_signoff
```yaml
head_signoff:
  verdict: APPROVED
  stage: P-4
  phase: 1
  attempt: 1
  reviewers:
    problem-framer: PROCEED
    ceo-reviewer: PROCEED (HOLD-SCOPE)
    mvp-thinner: OK (whole-class atomic, no split)
  failed_checks: []
  rationale: >
    Causal fix confirmed against the real spec — scope all 12 shared-DB audit
    assertions (8 COUNT + 4 latest-action) by the indexed workspace_id column per
    promoted T-4 rule 2, replacing the still-pollutable global before/after delta.
    Fault-killing is preserved: scoped +1 COUNT still proves exactly-one-append-
    for-this-workspace, scoped latest-action still proves the exact verb, and the
    global verifyChain (HMAC-excluded workspace_id) is correctly untouched. Scope
    held to one suite, whole 12-site class, no retry/serialize symptom-patch, no
    product/migration/UI. All P-4 checks machine-readable + traceable to M9.
  next_action: PROCEED_TO_B
```
