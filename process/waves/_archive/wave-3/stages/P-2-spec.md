# Wave 3 — P-2 Spec (pointer)

**Source of truth:** spec contract in `tasks.description` of seed **1931b452-c7d5-43a0-9657-7e7cd1728203** (YAML head + prose). DB wins on divergence.

**wave_type:** multi-spec (3 blocks). **design_gap_flag:** false. **claimed_task_ids:** [1931b452 (AppShell+dashboard), 2ecc4a7b (per-route RBAC), 2dc00409 (role-aware nav)].

## Acceptance criteria (copy)
### Block 1 — AppShell + dashboard shell (1931b452)
AppShell built ONCE as shared components (Sidebar+TopBar, §10); every authed page uses it; role-aware dashboard SHELL/landing (identity+role, not feature content); unauth→/login; a11y (keyboard/focus/aria).
### Block 2 — per-route RBAC enforcement (2ecc4a7b)
Apply wave-2 RolesGuard via @Roles metadata; deny→403 (API)/redirect-or-403 (web); **ALLOWLIST: /auth/*, /health, / NOT gated (don't break live login)**; 4 roles each get permitted routes + denied others; role from server-verified session claim; graceful web denial.
### Block 3 — role-aware nav (2dc00409)
Nav shows only permitted items per role; CONSISTENT with RBAC (one role→routes source, no drift); per-role deterministic; active-route highlight + keyboard-accessible.

## Security-scope
RBAC enforcement = auth-adjacent → P-4 security-scope tightened gate + T-8 Security run. Compliance-first: the 4-role SoD substrate becomes ENFORCED (wedge dependency). Allowlist guardrail is load-bearing (regression guard: don't re-break wave-2 login).
