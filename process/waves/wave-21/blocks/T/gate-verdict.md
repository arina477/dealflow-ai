# T-9 Journey — Gate Verdict (Wave 21 · M9 process/DX hardening · DOCS-ONLY)

**Block:** T (Test) · **Stage:** T-9 Journey (block-exit gate)
**Gate:** head-tester (fresh spawn)
**Wave type:** docs-only (single artifact: `command-center/testing/ci-e2e-authoritative-policy.md` + `test-writing-principles.md` §pointer)
**Branch merged:** `wave-21-ci-authoritative-policy` → main tip `ed9899b`
**Deployed app hash:** `86ddc29` (wave-20 tip, byte-identical; docs not in app bundle)

---

## Gate framing — a docs-only wave has NO test-coverage obligation

Wave-21 added **zero** code / API / UI / migration / e2e. `git diff 86ddc29..ed9899b -- apps/** packages/**` = EMPTY (verified this stage). There is therefore nothing new that requires a test suite: the "coverage" of a policy document is its **falsifiability**, not a line/mutation score. That falsifiability was verified at B-6 (head-builder, APPROVED) by direct grep spot-check — all 8 cited test files exist and 10 spot-checked markers resolve to real assertions, each with an explicit "Falsa if" condition. T-1..T-8 are correctly N/A for a doc except: T-1 (md-lint/typecheck GREEN @ed9899b) and T-8 (security review confirmed NO prod-creds/secrets committed; the artifact enumerates — does not weaken — the isolation/RBAC/audit/SoD invariants). This is the right disposition: gating a doc on a test suite it does not carry would be coverage theater in reverse.

---

## Check 1 — No test-coverage gap for a docs-only wave

**PASS.** Nothing executable was added → no new invariant → no new test owed. The deliverable IS the artifact; its correctness criterion is falsifiability, discharged at B-6 against the real committed test corpus on HEAD. Confirmed independently this stage that the cited proofs are real assertions, not comments (e.g. OAE-9 exactly-one audit append + verifyChain ok; ISO-4 RESET→0-rows fail-closed; AMP-4/MFC-4 fault-killing no-ALS≠ALS). No hollow "named invariant with no proof" row found.

## Check 2 — The artifact is a SOUND, non-hollow test-strategy map

**PASS.** `ci-e2e-authoritative-policy.md` §2 enumerates 25 named compliance/isolation invariants — isolation READ (ISO-1/2/4) + WRITE-path (OAE-1/2/3, 42501), FORCE-RLS (OAE-14), audit-append + verifyChain (OAE-9..12) + rollback (OAE-13, pipeline-gate), populated-DB WORM (AMP-2/4/5), RBAC 403/401 + DB-authoritative (CRITICAL-1/1b), SoD (cross-referential RBAC + WORM + verifyChain), analytics/match-feedback getDb ALS fault-killers — each cited to a REAL existing e2e under the non-superuser `dealflow_app` role, each with a falsifiability condition. §1 correctly states the load-bearing rationale (superuser bypasses FORCE RLS → vacuous passes; `dealflow_app` NOSUPERUSER NOBYPASSRLS makes isolation real). §3 fixes the recurring value defect: it names "Live-authed check deferred — CI-authoritative" as the sanctioned V/T disposition with two concrete structural constraints (single-tenant prod + no-committable-prod-creds) and a two-condition later-trigger, so V/T stops re-deriving the deferral every wave. §4 closes B/D/E as a pointer to PRODUCT-PRINCIPLES #1, not re-documented process. **No coverage-theater: every named invariant is backed by a cited real proof.** The artifact makes CI-authoritative falsifiable rather than asserted — a genuine improvement to the compliance-invariant test map.

## Check 3 — OAE-3 flake adjudication

**FLAKE CONFIRMED · PRE-EXISTING · CORRECTLY ROUTED AS NON-BLOCKING V-2 FIX-FORWARD.**

- **Defect is real (verified this stage, not inferred).** `outreach-activity-rls.e2e-spec.ts:408-411`: `SELECT COUNT(*)::text FROM audit_log_entries` (UNSCOPED — no `WHERE workspace_id`/action) then `expect(afterCount).toBe(beforeCount + 1)`. Under shared CI Postgres, concurrent audit-writing suites append rows between the before/after snapshots → off-by-one (`expected 34 to be 33`). The same unscoped-global-chain pattern recurs at lines 453/474, 516/544, 583/611 — OAE-3 is merely the row that lost the race this run; the anti-pattern class is broader.
- **Violates promoted T-4 rule 2** (confirmed verbatim): "A real-DB parallel suite must assert only its own scoped rows of a shared append-only chain, not the full chain." Ironically the wave-21 doc codifies exactly this anti-pattern class.
- **NOT a wave-21 change.** Zero app/test delta (`git diff 86ddc29..ed9899b -- apps/**` empty). Origin is wave-20 (`cc48c34`). Flake confirmed by C-1's second CI observation: run `28844136406` @ `ed9899b` GREEN on the byte-identical code tree that run `28844022367` @ `11e2671` failed RED on — non-determinism, not a deterministic break.
- **Adjudication:** Blocking a docs wave that changed no code on a pre-existing wave-20 test-isolation defect would be scope-inversion. It is correctly NON-BLOCKING for wave-21. It is NOT a false-green to wave through: C-1 root-caused it (Iron Law honored — not papered over by retry-until-green; the green came from an independent real-diff push, and the RED was diagnosed before acceptance). It IS a real CI-reliability defect that must be fixed — routing it to V-2 as a fix-forward task (scope the `COUNT(*)` by `workspace_id`/action, or capture the delta under the same GUC — and sweep the sibling unscoped assertions at lines 453/516/583) is the right call, not a block/escalate. Recommend the V-2 task explicitly cover ALL unscoped `COUNT(*) FROM audit_log_entries` assertions in this file, not just OAE-3, since the whole class is flaky-under-parallelism.

---

## Journey-layer (T-9 stage-exit) applicability

**N/A for a docs-only wave.** T-9's live end-to-end deal-flow traversal + ephemeral-test-seed-credential checks presuppose a UI/API/flow change to exercise. Wave-21 shipped no product surface; the app is byte-identical to the already-verified wave-20 tip. The journey map requires no regeneration (no route/endpoint/flow added). No Playwright binary gate applies — no E2E/layout stage ran or was owed (T-5/T-6 N/A, zero UI delta), so there is no zero-executed-test false-PASS risk to escalate on.

---

## Verdict

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers: {}   # docs-only artifact gate; falsifiability verified at B-6 + re-confirmed by direct grep this stage
  failed_checks: []
  rationale: >
    Wave-21 is a genuine docs-only wave that added zero code/API/UI/migration/e2e
    (git diff 86ddc29..ed9899b -- apps/** packages/** = empty), so it carries NO
    test-coverage obligation: the deliverable is the CI-e2e-authoritative policy
    artifact, whose correctness criterion is falsifiability — discharged at B-6 and
    re-confirmed this stage against the real committed test corpus (all cited markers
    resolve to real assertions, no hollow rows). The artifact is a SOUND, non-hollow
    test-strategy map: 25 named compliance/isolation invariants each cited to a real
    dealflow_app-role e2e with a falsifiability condition, plus a concrete live-authed
    deferral policy that stops per-wave rediscovery and makes CI-authoritative
    falsifiable rather than asserted. No coverage theater. The OAE-3 finding is a REAL
    but PRE-EXISTING (wave-20 cc48c34) shared-DB global-COUNT(*) audit-chain isolation
    flake — verified at outreach-activity-rls.e2e-spec.ts:408-411, violating promoted
    T-4 rule 2, with the same unscoped pattern recurring at lines 453/516/583. It was
    root-caused (not papered over) at C-1 and confirmed a non-deterministic flake by a
    green re-run on the byte-identical tree; with zero wave-21 delta it is correctly
    NON-BLOCKING for this docs wave and correctly routed as a V-2 fix-forward
    (scope the count by workspace_id/action; sweep the sibling unscoped assertions).
    Journey-layer live traversal is N/A (no product surface changed); no Playwright
    binary gate applies (no E2E/layout owed, zero UI delta) so no false-PASS risk.
  next_action: PROCEED_TO_V
```

---

## Block-scoped state (T-9 exit)

```yaml
test_gate_results:
  T-1: PASS        # md-lint/typecheck GREEN @ed9899b
  T-2: N/A         # no code
  T-3: N/A         # no contract change
  T-4: N/A         # no integration surface (artifact IS the integration-test map)
  T-5: N/A         # no e2e surface; no Playwright gate owed (zero UI delta)
  T-6: N/A         # no UI
  T-7: N/A         # no code
  T-8: PASS        # docs artifact reviewed — no prod-creds/secrets committed
  T-9: APPROVED    # docs-only: no coverage gap; artifact falsifiable/non-hollow; OAE-3 flake correctly routed
journey_map_version: unchanged   # no route/endpoint/flow added this wave
coverage_report: n/a-docs-only   # falsifiability (B-6 grep spot-check) is the coverage criterion for a policy artifact
escalation_log: []               # none — OAE-3 is a non-blocking V-2 fix-forward, not an escalation
fix_forward_tasks:
  - id: OAE-3-scope-count
    layer: T-4/e2e
    severity: P2-flake
    file: apps/api/test/outreach-activity-rls.e2e-spec.ts
    defect: "Unscoped SELECT COUNT(*) FROM audit_log_entries (lines 408-411, 453/474, 516/544, 583/611) → shared-DB parallel count pollution; violates promoted T-4 rule 2"
    origin: wave-20 (cc48c34)   # NOT a wave-21 change
    fix: "Scope the count by workspace_id/action or capture delta under same GUC; sweep ALL unscoped audit_log_entries COUNT(*) assertions in the file"
    routed_to: V-2
    blocking: false
```

---
*head_signoff appended by head-tester at T-9 · fresh spawn · docs-only wave. OAE-3 verified against the real test source (outreach-activity-rls.e2e-spec.ts:408-411) and promoted T-4 rule 2 confirmed verbatim; zero wave-21 app/test delta confirmed by git diff.*
