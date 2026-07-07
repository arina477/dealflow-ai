verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
seed_task: 02f4e6a1
reasoning: |
  Symptom-vs-cause CONFIRMED CORRECT. Symptom = intermittent CI RED ("expected 34 got 33")
  in outreach-activity-rls.e2e-spec.ts. Root cause = the audit assertions read the GLOBAL
  audit_log_entries chain (all workspaces/suites), so a concurrent audit-writing suite in the
  shared CI Postgres shifts the count between the before/after snapshot OR owns the global-latest
  row. The proposed fix (scope each assertion by workspace_id/action, or assert a within-test
  DELTA of THIS workspace's rows, not an absolute/global count-or-latest) attacks the cause and
  directly implements promoted T-4 rule 2 ("a real-DB parallel suite must assert only its own
  scoped rows of a shared append-only chain"). It is NOT a symptom-patch — a retry or
  suite-serialization would mask the flake and violate the parallel-suite premise the rule exists
  to protect. No antipattern from the catalog matches; this is a rule-conformance fix.

  SCOPE COMPLETENESS — the whole ~12-site class must be covered, not just the 8 COUNTs:
  - 8 COUNT(*) FROM audit_log_entries sites (lines 374/408/453/474/516/540/583/607). Current
    guard is `beforeCount + 1` (a global delta). A global delta is resilient to rows that
    ALREADY existed, but NOT to rows a concurrent suite INSERTs BETWEEN the before and after
    snapshots — that is the live flake. Must become a workspace_id-scoped delta.
  - 4 latest-action reads `ORDER BY sequence_number DESC LIMIT 1` (lines 415/479/547/614) are
    ALSO pollution-vulnerable, and MORE fragile than the COUNTs: they read the GLOBAL newest
    entry, so under any concurrent writer the last row may be another suite's mutation, not this
    test's. `.toBe('outreach-activity-create')` etc. will intermittently read the wrong action.
    These MUST be scoped too (filter by workspace_id AND/OR the expected action for this test's
    workspace). Fix must cover the full ~12-site class.
  - Verified enabler: audit_log_entries HAS a workspace_id column WITH an index
    (apps/api/src/db/schema/audit-log.ts:168,175) — so workspace-scoped predicates are directly
    available and cheap. The fix is mechanically clean.

  ASSERTION-POWER (fault-killing) — no weakening risk if done right, but this is the ONE guardrail
  for B/T: the scoped assertion MUST still PROVE the mutation appended exactly one audit entry for
  THIS workspace+action. `COUNT(*) WHERE workspace_id = OAE_WS_A` delta of exactly +1, and the
  latest-action read scoped to `WHERE workspace_id = OAE_WS_A ORDER BY sequence_number DESC LIMIT 1`
  asserting the specific action, both stay fault-killing (a missing/duplicate/wrong-action append
  still reds the test). A vacuous rewrite (e.g. `>= beforeCount`, or dropping the action assertion,
  or asserting only `verifyChain.ok`) would be an OVER-CORRECTION that loses coverage — flag for
  B/T review but not a framing defect. Note: the OAE-1/OAE-2 REJECTED-path assertion at line 341
  (`toBe(beforeCount)` unchanged) is the same class and should be scoped too for consistency,
  though a rejected write appends nothing so it is lower-risk.

  WORTH THE LOOP — yes. A flaky test that intermittently reds CI on a shared-DB parallel suite is
  a real reliability defect (it erodes trust in the gate and can mask real regressions). It was the
  ready seed (02f4e6a1). Tiny, well-scoped, single-file, test-only. Legitimate fix-forward wave.
proposed_reframe: |
  (n/a — PROCEED)
escalation_reason: |
  (n/a — PROCEED)
sibling_visible: false
