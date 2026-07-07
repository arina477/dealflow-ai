# Wave 22 — P-2 Spec (pointer)
**Source of truth:** seed 02f4e6a1 tasks.description + this contract. single-spec. design_gap false, D-skip.
**claimed_task_ids:** [02f4e6a1]
## AC (test-hygiene):
1. All ~12 shared-DB audit assertions in outreach-activity-rls.e2e-spec.ts (8 COUNT + 4 latest-action, lines ~374-614) are SCOPED by workspace_id (immune to concurrent-suite pollution in shared CI Postgres) — implementing the promoted T-4 rule 2.
2. Every scoped assertion STAYS FAULT-KILLING (a workspace-scoped count still proves exactly-one-append-per-mutation for this workspace; the workspace-scoped latest-action still proves the correct verb) — NOT weakened to vacuous.
3. The suite runs GREEN against real Postgres as dealflow_app; NO retry/serialize symptom-patch; NO other-suite change; NO product code/migration/UI.
## Load-bearing: workspace-scoped (not global), fault-killing preserved, one-suite-only.
