# Wave 3 — P-0 Frame

## Discover section
- **wave_db_id:** 57f2b2da-3ee2-4b4c-b2f7-92d29dd76bcb (wave_number 3, milestone_id backfilled M1)
- **Prior-work:** wave 1 scaffold, wave 2 auth (live — invite-only, user/role/invites, RolesGuard primitive built-but-unenforced, placeholder dashboard). This wave enforces that primitive + builds the real AppShell/dashboard shell. No prior AppShell work.
- **Roadmap milestone:** M1 (Foundation, in_progress, platform-foundation). This bundle completes M1's success metric ("invited user … lands on a role-aware dashboard shell") + the per-route RBAC deferred from wave 2.
- **Spec-contract short-circuit:** no-prior-spec (seed is prose) → full P-1..P-3.
- **Product-decision resolutions:** none new. Security-scope tightened gate WILL fire at P-4 (RBAC enforcement = auth-adjacent) + T-8 Security runs.

## Reframe section
- **Original framing:** shared AppShell chrome (Sidebar+TopBar, DESIGN-SYSTEM §10, built ONCE) + role-aware dashboard shell + enforce per-route RBAC (API+web, applying wave-2 RolesGuard primitive) + role-aware nav for the 4 roles.
- **problem-framer:** PROCEED. Cause-level + correctly sequenced (primitive + roles/claims exist → enforcement is the natural next step). AppShell built once per §10; dashboard scoped as role-aware landing (not feature content). No antipattern. **Forward note (→ P-2/P-3):** do NOT gate /auth/* login flow or the / landing when enforcing RBAC — use allowlist-by-@Roles() decoration (the guard supports it); avoid enforce-everywhere lockout.
- **ceo-reviewer:** PROCEED (HOLD-SCOPE). Correctly-sequenced table-stakes; de-risks the compliance wedge (M6 outreach SoD hard-depends on RBAC enforcement); right thin slice (shell+enforcement+nav, NO dashboard feature content — that's M4/M5/M6).
- **mvp-thinner:** n/a — skipped (M1 platform-foundation).
- **Disposition:** PROCEED.
- **Final framing:** Complete M1's foundation — AppShell (shared, §10) + role-aware dashboard shell + per-route RBAC enforcement (allowlist via @Roles, don't lock out /auth or /) + role-aware nav (4 roles). Carry problem-framer's allowlist guardrail into P-2/P-3. Security-scope gate + T-8 apply.
