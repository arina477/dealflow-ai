# T-8 — Security

> **Block:** T (Test), 5th of 8 in wave loop: `P → [D] → B → C → ` **`T`** ` → V → L → N`.
> **Stages:** T-1 → T-2 → T-3 → T-4 → T-5 → T-6 → T-7 → **T-8** → T-9 (gate). Advance on stage exit: T-9.
> **Pattern:** gate-only. head-tester spawned at T-9 for verdict; reference card on demand at `~/.claude/agents/head-tester.md`.
> **Dispatcher** (skip rules, layered cascade, gate semantics, exit handoff): `claudomat-brain/blocks/test/test.md`.

## Purpose

Auth smoke, CSRF, session, rate-limit probes against the deployed wave. Fires only on auth-adjacent waves; for non-auth waves the cost/benefit is poor (probes amount to "verify nothing broke" with low yield).

## Pattern

**B — Active-execution.**

## Prerequisites

- T-7 exited (or T-6 if T-7 skipped).
- READ `command-center/principles/test-layer-principles/T-8.md` for project's security baselines.

## Skip condition

Skip unless `wave_type` includes `auth` (auth, payments, sessions, secrets, RBAC, account-creation, password-reset, OAuth, API tokens). Deliverable records wave_type and reasoning.

**Edge case — auto-promotion.** If wave doesn't classify as `auth` but touches a file in the project's auth boundary (declared in T-8 principles' `auth_boundary_paths`), promote the wave to `auth` for T-8 purposes and fire the stage. Recorded as `auto_promoted: true` in deliverable.

**Subset-of-probes for auto-promoted waves.** Run only the probes whose category applies to the wave's actual diff:

| Probe category | Apply when |
|---|---|
| Action 1 — Auth smoke | Wave modified any auth flow (signup/login/logout/MFA/password-reset/session-refresh) |
| Action 2 — CSRF / origin | Wave added or modified a state-changing endpoint (POST/PUT/PATCH/DELETE) |
| Action 3 — Session probes | Wave touched session lifecycle code |
| Action 4 — Rate limit | Wave added a new endpoint OR modified rate-limit policy |
| Action 5 — Secret grep | ALWAYS runs — never skipped |

Record applicable list in deliverable's `applicable_probes`. Exit-criteria check is "every applicable probe complete," not "every probe complete." Keeps coverage honest.

## Actions

### Action 1 — Auth smoke

For each modified auth flow (signup, login, password reset, session refresh, logout, MFA, etc.), run a positive + negative probe:

- **Positive:** valid credentials → expected success state, expected cookies/headers set, expected redirect.
- **Negative:** invalid credentials → expected error envelope, no session leak, rate-limit eventually triggers.

Use test credentials per `project.yaml: test_users.local_dev[]` (with passwords from gitignored `command-center/testing/test-accounts.md`) — never real user accounts.

### Action 2 — CSRF / origin checks

For every state-changing endpoint introduced or modified at B-2:
- Probe with valid CSRF token / origin → success.
- Probe with missing CSRF token → reject with appropriate status (typically 403).
- Probe with foreign Origin header → reject.

If project uses SameSite cookies as CSRF defense (no token), verify cookie attributes on a fresh login response: `Secure`, `HttpOnly`, `SameSite=Lax|Strict`.

### Action 3 — Session probes

- New session after login → cookie has expected expiry, HttpOnly, Secure.
- Logout → session cookie cleared on response.
- Concurrent sessions → behavior matches project policy (declared in T-8 principles).
- Session fixation: pre-login session cookie should NOT match post-login session cookie (rotation on login).

### Action 4 — Rate limit probes

For every endpoint protected by rate limits (declared in T-8 principles or inferred from B-2 code):
1. Probe at the configured limit + 1 → confirm 429 returned.
2. Probe with exponential backoff → confirm limit window resets correctly.
3. Verify rate-limit response body doesn't leak internal state (e.g., raw redis key names).

### Action 5 — Secrets / credential leak grep

Grep the wave's diff for accidentally-committed credentials:

```
git diff main..HEAD -- '*.ts' '*.tsx' '*.py' '*.rb' '*.go' '*.env*' \
  | grep -iE 'api[_-]?key|secret|token|password|bearer\s+[A-Za-z0-9]'
```

Each match is a critical finding — even false positives are worth investigating before exit.

### Action 6 — Triage findings

Per Iron Law:
- **Critical (auth bypass, session hijack, secret leaked)** → hard stop. Revert wave per C-block protocol; route to security-engineer specialist via `/investigate`.
- **High (missing CSRF on state-changing endpoint, rate-limit absent)** → re-enter B-2 to add; cap 3 cycles.
- **Medium (cookie attribute drift, error envelope leak)** → V-2 Triage decides blocking.
- **Low (informational, logging improvement)** → record in deliverable.

## Deliverable

`process/waves/wave-<N>/stages/T-8-security.md` — records probe results per category, secret-grep output, fix-up cycle log, plus YAML footer.

```yaml
test_pattern: active
skipped: false
auto_promoted: false                  # true if non-auth wave touched auth boundary
applicable_probes: [auth_smoke, csrf, session, rate_limit, secret_grep]   # populated per the auto-promotion subset matrix
auth_smoke: {positive: [...], negative: [...]}              # null if not in applicable_probes
csrf_results: [...]                                          # null if not in applicable_probes
session_results: [...]                                       # null if not in applicable_probes
rate_limit_results: [...]                                    # null if not in applicable_probes
secret_grep_findings: []              # MUST be empty for APPROVED — always applicable
fix_up_cycles: 0
findings:
  - {severity, category, description, remediation}
```

## Exit criteria

- Every probe in `applicable_probes` complete (full set on `wave_type: auth`; subset matrix on auto-promotion).
- Secret-grep returned zero matches (always runs).
- Critical findings resolved or wave reverted.
- `process/waves/wave-<N>/checklist.md` T-8 row checked.

## Next

→ `claudomat-brain/blocks/test/test.md` → T-9.
