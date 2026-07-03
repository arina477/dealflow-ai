# V-1 Jenny — Wave 2 Semantic Spec Verification (DealFlow AI auth)

**Verdict: APPROVE** — 1 drift, 0 gaps (drift is Low-severity, non-blocking).

Method: probed LIVE deployed state (api `dealflow-api-production-66d4`, web `dealflow-web-production-a4f7`) with cookie jars + unique test emails. Authoritative spec = DB row `e15f71dd` (`tasks.description`). Semantic-intent only; source-claim truth is Karen's lane. Host Chrome absent (task fa23349a — the documented infra dependency), so real-browser steps degraded to the documented HTTP/component smoke; FINDING-2 was still confirmed decisively via the web-origin proxy + authed-`/dashboard` path.

---

## Block 1 — Data model / SDK (e15f71dd)

| AC | Verdict | Live evidence |
|---|---|---|
| SuperTokens Core reachable | **MATCHES** | Signup/signin/session/refresh/logout all functional against live api; JWT `iss=…/auth`. "Own Postgres / URI distinct from DATABASE_URL" is a config claim not externally probeable → **Karen scope** (no aliasing evidence either way). |
| NestJS inits ST SDK at boot; fail-fast if Core unreachable | **MATCHES** (partial-scope) | SDK demonstrably operational live; boot succeeded (`/health` → `db:ok`). Fail-fast-on-unreachable not live-testable without breaking Core → **source scope**. |
| Additive migration users/roles/invites (+down, no destructive DDL) | **MATCHES** (functional) | All three tables functionally exercised: invite INSERTs a row, signup creates a user, roles resolve to claims. Migration DDL / down-migration = **Karen scope**. |
| roles seeded exactly 4 (advisor/analyst/compliance/admin) | **MATCHES** | Invites created + accepted for all four roles; each reflected in `/auth/me` (`analyst`, `compliance`, `admin`, `advisor`). |
| invites cols: token(uniq), invited_by, role, expiry, consumed_at | **MATCHES** (functional) | `token`+`expiry` returned on invite; `consumed_at` enforced (reuse rejected, see B2); `role` enforced (bad role→422). `invited_by` not externally visible → source. |
| Provisioning maps user↔supertokens id 1:1 | **MATCHES** | Signup returns `userId=cbe9c492…`; signin returns ST `user.id=cbe9c492…` — identical. |
| Session JWT carries role claim | **MATCHES** | Decoded `sAccessToken` payload contains `"role":"analyst"`; `/auth/me` returns the role. |
| Invite-only: signup w/o valid invite rejected (no account) | **MATCHES** | Invalid token→400, consumed token→400, no public self-signup route. |

## Block 2 — Auth API (e1c0e81e)

| AC | Verdict | Live evidence |
|---|---|---|
| POST /auth/invite → 201 {token,expiry} | **MATCHES** | 201 `{token,expiry}`; bad role→422 "Unknown role". |
| POST /auth/signup valid invite → 2xx + session + role | **MATCHES** | 201 `{userId,email,role}` + `Set-Cookie` sAccessToken/sRefreshToken (HttpOnly, Secure, SameSite=Lax) + role claim. |
| signup invalid/expired/consumed → 4xx, no account | **MATCHES** (with 1 drift) | invalid→400, consumed→400. **DRIFT:** missing `inviteToken` field → **500 Internal Server Error** instead of a 4xx (validation gap). Low severity — no account created, no enumeration/data leak; malformed-input edge only. |
| GET /auth/me authed→200 {userId,email,role} / anon→401 | **MATCHES** | Exact shape both directions. |
| reset/request → 202 always (no enumeration) | **MATCHES** | Known email and unknown email both → `202 {status:accepted}`, byte-identical. |
| reset/confirm valid sets pw / invalid→4xx | **MATCHES** (partial) | invalid token→400. Valid-token path not live-testable (delivery stubbed/logged, no email provider this slice) → **E2E/source scope**. |
| logout invalidates session (subsequent 401) | **MATCHES** | Logout (with anti-csrf header) → 200; clears both cookies (`Expires: 1970`); `session/refresh` after logout → 401 (core revoked). Note: SuperTokens stateless-JWT default means a *captured* access token stays valid until ~1h expiry — inherent/accepted, browser drops the cleared cookie so the real-client next request is anon→401. |
| role-guard PRIMITIVE only, NOT route-enforced | **MATCHES** | No per-route 403 observed live; `/auth/me` serves every role identically; only auth routes exist this wave → nothing RBAC-gated leaked. Guard-primitive existence = **source/E2E scope**. |

## Block 3 — Auth screens (af6cbc59)

| AC | Verdict | Live evidence |
|---|---|---|
| login renders; valid→session+role-aware landing; invalid→inline generic error | **MATCHES** | `/login` renders (title, "Sign in", `type=email/password`, `aria-invalid`). Valid creds → session. **`/dashboard` authed→200 renders "Dashboard"/"Sign out"/role "advisor"** (role-aware landing). Invalid creds → generic `WRONG_CREDENTIALS_ERROR` (no enumeration). |
| accept-invite: valid→set-pw→provision+signin; invalid→error | **MATCHES** (functional) | Page renders (200); valid provisioning path confirmed via signup API. Invalid-token error-state = browser/E2E scope. |
| reset-password flows wired | **MATCHES** | Page 200; request+confirm API endpoints functional. |
| shared Zod + design-system form components (aria-invalid/describedby/focus-ring) | **MATCHES** (partial) | `aria-invalid` present in login HTML. Full Zod-contract sharing = **source scope**; note the B2 missing-field 500 hints server-side validation isn't wired for that field. |
| Playwright E2E 6/6 | **source/T-5 scope** | Host Chrome absent here (documented dependency); T-5 recorded 6/6. Intent re-confirmed live via HTTP smoke. |
| No secrets in client bundle | **MATCHES** | 8 client JS chunks scanned — no SUPERTOKENS_API_KEY / connection URI / DATABASE_URL / private keys / postgres URLs. |

---

## Key intent checks
- **FINDING-2 (browser login lands IN the app, not bounce to /login): MATCHES — FIXED.** Web-origin signup sets first-party cookies scoped to the *web* domain; web-origin `/auth/me` with that cookie → 200 + role; authed `/dashboard` → 200 rendering the role; anon `/dashboard` → 307→`/login`. Session persists first-party, same-origin.
- **No user-enumeration (reset AND login): MATCHES.** reset known==unknown (`202 {status:accepted}`); login wrong-pw==unknown-email (`WRONG_CREDENTIALS_ERROR`).
- **Role claim present + correct: MATCHES** (JWT `role` + `/auth/me` role, verified across all 4 roles).
- **RBAC enforcement NOT leaked: MATCHES** (no per-route 403; guard is primitive-only).

Deferred scope correctly absent (not flagged): SSO/MFA, full AppShell.

## Drift/gap ledger
- **DRIFT-1 (Low, spec-drift / code-wrong):** `POST /auth/signup` with missing `inviteToken` → 500 instead of 4xx. Spec: "invalid… invite returns 4xx." Recommend a follow-up validation fix (route to a backend/NestJS specialist). Non-blocking — no security-invariant violation.
- Gaps: none (no spec-silent AC found unmet).

## Recommendation
APPROVE. Auth vertical slice semantically matches the spec contract across all 3 blocks; FINDING-2 is genuinely fixed; compliance-first invariants (invite-only, no-enumeration, 4-role foundation, role claim) hold live. Log DRIFT-1 for V-2 triage as a Low-severity input-validation follow-up; do not block the wave on it. @task-completion-validator already covered via T-5 E2E; @karen owns the source-claim truth pass (own-Postgres URI distinctness, migration DDL, Zod-contract sharing, guard-primitive existence).
