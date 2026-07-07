# Wave 21 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | P2 (flake) | C-1 | PRE-EXISTING wave-20 test-isolation flake: OAE-3 in outreach-activity-rls.e2e-spec.ts uses a GLOBAL `COUNT(*) FROM audit_log_entries` assertion (expected 34 got 33) polluted by concurrent audit-writing suites in shared CI Postgres. VIOLATES the promoted T-4 rule 2 (a real-DB parallel suite must assert only its OWN scoped rows of a shared append-only chain). Passed on re-run (flake, zero wave-21 delta). FIX-FORWARD: scope the OAE-3 assertion by workspace_id/action. → V-2 fix-forward task. IRONIC: the wave-21 doc codifies exactly this anti-pattern. |
## Docs wave: the deliverable (ci-e2e-authoritative-policy.md) is the artifact — head-builder B-6 verified it FALSIFIABLE (25 invariants → cited real e2e, all exist). No code/test/UI added → no new test coverage needed.
findings_total: 1 (0 crit/high, 1 P2-flake → V-2 fix-forward)
