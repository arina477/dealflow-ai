# Wave 22 — P-0 Frame
## Discover
- wave_number 22, milestone M9 (in_progress). Seed 02f4e6a1 (the OAE-3-class test-hygiene fix-forward). Tiny backend-test-only wave. Seller-intent = wave-23.
## Reframe
### problem-framer — PROCEED
Root cause: outreach-activity-rls.e2e-spec.ts asserts over the GLOBAL audit chain (unscoped). The causal fix (implementing promoted T-4 rule 2): scope EVERY audit assertion by workspace_id (audit_log_entries has an INDEXED workspace_id column → mechanically clean; workspace-scoped counts/latest are immune to concurrent-suite rows — even a global before/after delta is polluted by a concurrent insert BETWEEN snapshots, so scoping-by-workspace_id is the correct fix, NOT a delta). Whole ~12-site class (8 COUNT at 374/408/453/474/516/540/583/607 + 4 latest-action `ORDER BY sequence_number DESC LIMIT 1` at 415/479/547/614 — the global-latest reads are strictly MORE pollution-vulnerable). Scoped assertions MUST stay fault-killing (workspace-scoped +1 delta / workspace-scoped latest must still prove exactly-one-append-for-this-workspace, not vacuous). NOT a symptom-patch (no retry/serialize).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Fixing the flake is worth it (a false-RED on the audit-ISOLATION suite can MASK a genuine RLS regression — real trust/signal cost). Keep to the ONE suite; do NOT sweep other suites (T-4 rule 2 + the CI-authoritative policy own that repo-wide). Keep fault-killing.
### mvp-thinner — OK (whole-class atomic, no split)
The 8 COUNT + 4 latest-action share ONE pollution class; peeling the latest-action reads leaves the flake partially live (OVER-CUT). _TBD metric → no product-AC trace; a P-1 execution call.
### Disposition: PROCEED
Scope all ~12 audit assertions by workspace_id (immune to concurrent pollution), keep fault-killing, ONE suite. design_gap false, D-skip, single-spec.
claimed_task_ids: [02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762]
