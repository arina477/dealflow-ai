# Wave 26 — P-0 Frame
## Discover
- wave_number 26, M10 (in_progress). Seed 1a1c5855 (RLS connection-split deploy ACs). The EXPLICITLY-FINAL M10 hardening wave (wave-25 BOARD 7/7). wave-27 = enforced founder-pause on recordkeeping-scope.
## Reframe
### problem-framer — PROCEED
Root cause correctly targeted: the RLS privilege-split deploy contract (2 DB URLs, PATH-safe preDeployCommand, coupled-rollback) is TRIBAL KNOWLEDGE that emerged at C-2 (verified ABSENT from the 252-line architecture/devops.md) → a future role-privilege migration re-hits the same deploy failures. Coupled-rollback hazard REAL + addressed (rolling back code without reverting DATABASE_URL→owner runs old code as dealflow_app — old code lacks [RLS-GUARD]/GUC handling → breakage). GAP-3 correctly DEFERRED (PAT lacks Workflows:write). CONCRETENESS NOTE: make the 2-URL/distinct/NOBYPASSRLS portion a MECHANICAL check; pair each runbook item with a verifiable trigger (BUILD #11).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Bounded-final, load-bearing RLS privilege-split debt-closure that a future role-migration will silently re-break; the RLS role-split is the substrate under the compliance/recordkeeping backbone. Stay STRICTLY out of founder-reserved recordkeeping. Make the deploy-AC MECHANICALLY CHECKABLE, not prose.
### mvp-thinner — OK
Doc-contract + standing deploy-AC checklist = one atomic docs/devops unit (prose without the checkable AC = process-theater). GAP-3-defer is a PAT-block not a thinness cut. _TBD metric → OK+flag.
### Disposition: PROCEED
Deliverable (→ P-1/P-2/P-3):
1. **Document the RLS connection-split contract** in command-center/dev/architecture/devops.md: (a) DATABASE_URL=dealflow_app (runtime, NOSUPERUSER NOBYPASSRLS) vs MIGRATE_DATABASE_URL=owner (preDeploy migrations); (b) the PATH-safe preDeployCommand form (the bash -lc-wrapper-resets-PATH → pnpm-not-found gotcha that failed deploy #1); (c) coupled-rollback (revert BOTH the deployment AND runtime DATABASE_URL→owner — old code has no [RLS-GUARD]/dealflow_app expectations).
2. **A standing deploy-AC (checklist)** for any future migration touching role privileges — the 3 items above as checkable ACs.
3. **MECHANIZE the checkable portion** (BUILD #11 — not pure prose): a preflight/startup assertion that BOTH URLs are set + DISTINCT + the runtime URL's role is NOBYPASSRLS (the app ALREADY has the [RLS-GUARD] startup check that fails-closed if the runtime role is superuser/bypassrls — document + strengthen that as the mechanical enforcement of the runtime-role half; add a preflight that MIGRATE_DATABASE_URL is set + distinct from DATABASE_URL for role-privilege migrations, where feasible without ci.yml changes).
## LOAD-BEARING: the ACs are CONCRETE + (where mechanizable) machine-checked — the runtime-role-NOBYPASSRLS half is already enforced by [RLS-GUARD] (document it as the mechanical anchor); the 2-URLs-distinct is a preflight assertion; the coupled-rollback + PATH-safe-preDeploy are documented runbook ACs (inherently runbook, stated as such). NOT vague process-theater.
## GAP-3 DEFER: dedicated non-superuser CI DB role → needs ci.yml Workflows:write (PAT-blocked, same as wave-24) → documented as a deferred follow-up, NOT attempted.
## design_gap_flag: false (docs/devops hardening, no UI). D-skip.
## FLAGS (→ N/founder): wave-27 ENFORCED founder-pause (M10 recordkeeping-scope + _TBD metric — founder-reserved); M9+M10 _TBD polls; the pile-up. STAY OUT of recordkeeping scope.
claimed_task_ids: [1a1c5855-b8f8-4d86-93ea-7948e6881c10]
