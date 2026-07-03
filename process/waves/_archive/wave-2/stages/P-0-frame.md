# Wave 2 — P-0 Frame

## Discover section
- **wave_db_id:** 6d382ddb-36b0-44df-bcdf-a4076d4f0529 (wave_number 2, milestone_id backfilled to M1)
- **Prior-work citation:** Wave 1 (archived) shipped the monorepo scaffold + /health + CI + live Railway deploy — the infra substrate this wave builds identity on. No prior auth work. SuperTokens + auth approach pre-decided at onboarding (product-decisions #11 SuperTokens own Postgres, #12 app-DB=DATABASE_URL, #6/#7 additive/append-only migration discipline).
- **Roadmap milestone:** M1 (Foundation: auth, roles, app shell, data model, CI) — status in_progress (promoted at wave-1 N-1), class `platform-foundation`. This wave is the auth vertical slice's seed.
- **Spec-contract short-circuit verdict:** **no-prior-spec** — the seed task (e15f71dd) description is prose (Problem/Scope/Acceptance-sketch/References), no fenced YAML head. Full P-1..P-3 authoring required.
- **Product-decision resolutions:** none new this wave. SuperTokens (#11), app-DB (#12), additive/append-only (#6/#7) already decided. Security-scope tightened gate WILL fire at P-4 (wave touches auth / user-creation / sessions / cookies per CLAUDE.md trigger).

## Reframe section
- **Original task framing:** Auth backbone + user/role/invite data model — SuperTokens Core (own Postgres) + NestJS SDK (EmailPassword+Session), invite-only signup, 4 roles (advisor/analyst/compliance/admin), role-as-session-claim, SuperTokens↔app-user id mapping, additive reversible migration, pre-code test specs. Seed of a 3-task bundle (+ auth API sibling e1c0e81e + auth screens sibling af6cbc59).
- **problem-framer verdict:** PROCEED. Cause-level (real identity foundation, not symptom), correctly layered, scope-disciplined (audit-log + RBAC *enforcement* rightly deferred), serves both live founder bets. No antipattern match. **Non-blocking flag:** P-2 must NOT let RBAC *enforcement* leak into this wave's acceptance criteria — this wave lands the role *claim* + data model; enforcement guards are a later slice.
- **ceo-reviewer verdict:** PROCEED (HOLD-SCOPE). Auth is the correctly-sequenced next investment (M1 required-by all downstream; unbuildable-around). Calibrated ambition: the 4-role + invite-only + role-claim slice lands exactly the SoD/audit-attribution substrate that de-risks the compliance wedge (bet #2), while correctly deferring enterprise SSO/MFA (M8/M11, not pilot) and AppShell/full-RBAC (follow-up bundle). Not under- nor over-ambitious.
- **mvp-thinner verdict:** n/a — skipped (M1 class = platform-foundation, not product-feature).
- **Mediation outcome:** n/a (no disagreement).
- **Sibling task IDs created:** none this stage (bundle already authored by wave-1 N-1 milestone-decomposer).
- **Disposition:** PROCEED.
- **Final framing P-block will use:** Land the auth identity foundation for M1 — SuperTokens (isolated Postgres) + NestJS SDK wiring + invite-only signup + additive users/roles/invites schema + role-as-session-claim + id-mapping, with pre-code tests for invite-only enforcement / role-claim presence / id-mapping. Carry problem-framer's guardrail into P-2: acceptance criteria cover the role *claim* + data model, NOT RBAC enforcement. Auth-screens sibling will likely set design_gap_flag at P-1 (login/accept-invite/reset — check design/ for existing canonical mockups).
