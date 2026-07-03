# Wave 2 — L-1 Docs

Owner: head-learn (L-block). Mode: automatic.

## CHANGELOG

Added `## [0.2.0] — 2026-07-03` under `[Unreleased]` in `CHANGELOG.md` (lines 9–18),
keep-a-changelog format, headline + 4 `Added` bullets:
- Invite-only email/password auth (SuperTokens): login / accept-invite / reset-password wired to API. (#2)
- User/role/invite data model, 4 seeded roles (advisor, analyst, compliance, admin), 1:1 SuperTokens mapping + session role claim.
- Auth API — signup, `GET /auth/me`, logout, password reset — + role-aware guard primitive (per-route RBAC deferred).
- Session hardening: HttpOnly + Secure + SameSite=Lax cookies, CSRF, constant-time reset (no user-enumeration), no invite → no account.

**No `### Security` section:** all security work this wave is preventive on *new* auth flows
(CSRF, no-enumeration, cookie flags), which per L-1 Action 1 belongs in `Added` — the `Security`
section is reserved for shipped-then-patched vulnerabilities only. None this wave.

## Milestone delta

Touched milestone: **M1 — Foundation: auth, roles, app shell, data model, CI**
(`2c79236a-ffc0-43e2-b406-a5aa56413882`).

Mechanical evaluation (L-1 Action 2):
- Child-task rollup: `done=4`, `open (todo/in_progress/blocked)=2` → `open_count=2 > 0`.
- **No transition.** M1 stays `in_progress`. The auth vertical slice shipped, but M1 scope
  (AppShell chrome, role-aware dashboard shell, full per-route RBAC) remains open/undecomposed.
- No `product-decisions.md` append (no strategic decision resolved; mechanical progress only).
- **backlog-stockout flag for N-1:** M1 has 2 open tasks, below the brain-fallback threshold
  (<3 open per milestone; PRODUCT-PRINCIPLES declares no override). The 2 open rows are
  `6fe232e3` (auth-hardening, V-2 follow-up) + `bfadcec1` (wave-1 test-fixture). N-1 should
  evaluate milestone-decomposition of the remaining M1 scope (AppShell / RBAC) under reason
  `backlog-stockout`.
- M1 DB `status` already reads `in_progress` (not the stale `todo` from a prior artifact); the
  todo→in_progress transition is N-1's job, not L-1's — L-1 confirms only that no done-transition
  is warranted.

## README

Surgical touch to `README.md` § Live deployment (lines 40–42): added a 3-line note that
authentication is live and invite-only (no open sign-up; invite → set password → sign in;
screens `/login`, `/accept-invite`, `/reset-password`). Detail stays in CHANGELOG.

## Commit

- `1bc8af9` — `docs: L-1 wave-2 closeout (changelog 0.2.0, readme auth-live note)` — pushed to `main`
  (`29eb5a6..1bc8af9`). 2 files, +14.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:9-18"
  - "milestones row: 2c79236a-ffc0-43e2-b406-a5aa56413882 evaluated, no transition (open_count=2)"
  - "README.md commit: 1bc8af9"
changelog_entry_added: true
roadmap_milestones_progressed: []
roadmap_skip_reason: "M1 open_count=2 (>0); mechanical, no transition; stays in_progress"
roadmap_next_wave_flag: "backlog-stockout — M1 has 2 open tasks (<3 threshold); N-1 to consider decomposing remaining M1 scope (AppShell/RBAC)"
readme_sections_touched: ["Live deployment (auth-live / invite-only note)"]
note: "Preventive auth security kept in Added per Action 1; no Security section (no shipped-then-patched vuln)."
```
