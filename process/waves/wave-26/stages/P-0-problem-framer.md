verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause PASSES. Root cause is correctly identified: the RLS privilege-split
  operational contract (2 DB URLs, PATH-safe preDeployCommand, coupled rollback) emerged
  AT DEPLOY (C-2) as tribal knowledge and was never captured in spec or devops docs. Verified
  the gap is real — command-center/dev/architecture/devops.md (252 lines) contains ZERO mention
  of dealflow_app / MIGRATE_DATABASE_URL / preDeploy / coupled-rollback / NOBYPASSRLS. The fix
  (document the contract + standing deploy-AC checklist for future role-privilege migrations)
  attacks the CAUSE — undocumented-contract-will-be-re-hit — not a symptom. No antipattern match:
  not config drift (#6 — the 2 URLs already have real distinct consumers, runtime vs migration;
  documenting an existing split adds no knob), not validation theater (#7 — the coupled-rollback
  AC guards a demonstrated real failure, not an impossible one), not premature abstraction (#4 —
  the standing AC codifies a lesson from an actual deploy failure over a genuine recurring class,
  role-privilege migrations, not a speculative generalization).
concreteness_note: |
  The one live risk is that the standing AC degrades into process-theater narrative (wave-21
  lesson; BUILD #11 — a guard must be CHECKABLE, not happy-path prose). Guidance for P-2/P-1,
  NOT a reframe blocker: the 2-URL portion IS mechanically enforceable — a deploy-script / CI
  assertion that both DATABASE_URL and MIGRATE_DATABASE_URL are set AND distinct AND runtime role
  is NOBYPASSRLS. The PATH-safe preDeployCommand form and the coupled-rollback step are inherently
  documented-runbook items (acceptable for a deploy contract, but the spec should SAY SO explicitly
  and pair each with a concrete verifiable trigger/condition rather than advisory prose).
coupled_rollback_assessment: |
  Hazard is REAL and the AC correctly addresses it. Rolling back the deployment WITHOUT reverting
  DATABASE_URL from dealflow_app back to owner runs old code as the non-superuser runtime role:
  old code predates the [RLS-GUARD]/GUC session-var handling and predates any owner-privilege
  expectations, so it either (a) fails RLS-guarded reads/writes it never set the GUC for, or (b)
  attempts owner-needed operations as a non-owner and errors. The rollback MUST be atomic across
  both the code deploy and the runtime DATABASE_URL. Sound to make this a binding rollback AC.
gap3_defer_assessment: |
  Correctly DEFERRED, not attempted. A dedicated non-superuser CI DB role (letting the negative-read
  e2e connect natively instead of SET ROLE) requires pushing ci.yml, which needs Workflows:write on
  the PAT — the same constraint that blocked wave-24. Note-and-defer is the right disposition; do not
  attempt within this wave.
design_gap: false
scope_note: |
  design_gap correctly false (docs/devops, no UI). Legitimate final-M10-hardening slice: documents the
  load-bearing RLS-role-split substrate under the recordkeeping/compliance backbone. Sizing (single
  standing-AC doc wave vs any split) is P-1's call, not mine.
sibling_visible: false
