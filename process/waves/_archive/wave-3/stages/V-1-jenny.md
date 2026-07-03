# V-1 jenny — Semantic spec-vs-DEPLOYED verification (Wave 3: AppShell + RBAC LIVE)

**Agent:** jenny (semantic-spec lane; Karen runs source-claim independently)
**Wave:** 3 — Shared AppShell + role-aware dashboard shell + per-route RBAC enforcement + role-aware nav
**Spec source of truth:** `tasks.description` of seed `1931b452-c7d5-43a0-9657-7e7cd1728203` (YAML head + prose + P-4 remediation addendum + pinned role→route/nav matrix)
**Deployed under test:** api `https://dealflow-api-production-66d4.up.railway.app` · web `https://dealflow-web-production-a4f7.up.railway.app` (same-origin `/auth` proxy) · deploy `935b847`
**Method:** LIVE black-box probing. Minted 4 real role users via `POST /auth/invite` → `POST /auth/signup` (real SuperTokens sessions), probed the deployed API + web with per-role cookie jars / access-token JWTs. Playwright unavailable (no chromium on any MCP instance) — web AppShell + nav verified via server-rendered Next.js HTML (App Router renders the shell + role-aware sidebar server-side; sufficient for semantic verification of nav sets, identity/role landing, redirects, and a11y attributes).

**Test identities minted (LIVE):**
- compliance `v1-compliance-1783096839@example.com` (uid dab12c3f…)
- advisor `v1-advisor-1783096839@example.com` (uid 62d3e80c…)
- analyst `v1-analyst-1783096839@example.com` (uid c18c6399…)
- admin `v1-admin-1783096839@example.com` (uid 0ceb2117…)

---

## VERDICT: **APPROVE**

**Counts: drift = 0 · gap = 2** (both LOW; spec-silent, not code-wrong; neither blocks the wave's claimed scope).

The three claimed blocks match spec intent against deployed behavior on every load-bearing AC. Login lands the user in the app at a role-aware `/` shell (no bounce); RBAC genuinely gates (advisor + analyst cannot reach the compliance exemplar); role-aware nav is faithful to the pinned matrix / journey-map persona columns per role; `/` is correctly authed (unauth→/login) per the P-4 route reconciliation; no RBAC bypass and no nav item shown that RBAC denies.

---

## Block 1 — Shared AppShell + role-aware dashboard shell (1931b452)

| AC | Verdict | LIVE evidence |
|---|---|---|
| AppShell built ONCE (Sidebar+TopBar §10); every authed page inside it | **MATCHES** | Authed `/` HTML renders a single `<nav>` sidebar (DealFlow AI logomark + Workspace group) + TopBar (User-menu, Search, Notifications buttons). Built via the `(app)` route-group layout so the chrome is composed once, not per-page. |
| Signed-in user landing on dashboard sees canonical chrome | **MATCHES** | Authed GET `/` (compliance token) → HTTP 200, 18.6 KB shell HTML; sidebar + topbar present. |
| Dashboard is role-aware SHELL/landing (identity+role, NOT feature content) | **MATCHES** | Rendered text: "Welcome back / Signed in as v1-compliance-…@example.com / Role: Compliance Officer / Compliance features ship with the M6 milestone… when they launch / Pending items 0". Explicit landing/empty-state, not real compliance feature content. Admin/analyst/advisor render their own role landing. |
| Unauth access to any AppShell page → /login | **MATCHES** | Unauth GET `/` → **307 → /login** (both default + `Accept: text/html`). |
| AppShell accessible (keyboard/focus/aria) | **MATCHES (semantic)** | `aria-current` (active-route highlight) present; 9× `aria-label` incl. User-menu button `aria-label="User menu: …(compliance)"`, Search, Notifications; interactive elements are real `<button>`/`<a>`. Full keyboard-trap / focus-ring visual audit is T-6/T-8 territory; attributes are present. |

**Block 1: MATCHES (5/5).**

---

## Block 2 — Per-route RBAC enforcement (2ecc4a7b)

Exemplar endpoint this wave: `GET /compliance/summary` (allowed = compliance, admin).

| AC | Verdict | LIVE evidence |
|---|---|---|
| RolesGuard primitive now APPLIED via @Roles(); deny→403, no data leak | **MATCHES** | advisor→`GET /compliance/summary` = **403** `{"message":"Forbidden","statusCode":403}` (no body data leak). analyst→**403**. compliance→**200** `{"pendingCount":0,"items":[]}`. admin→**200**. |
| ALLOWLIST-safe: `/auth/*` + `GET /health` ungated; `/` authed; login not broken | **MATCHES** | `/health`→200; `/auth/signin` (empty body)→400 (validation, NOT RBAC 401/403); `/auth/invite`→201 anon; `/auth/reset/request`→202 anon. Live login end-to-end: SuperTokens `POST /auth/signin` with real creds → 200 + session; post-login `/auth/me`→correct identity, `/compliance/summary`→200. **Login regression guard HOLDS.** |
| Each of 4 roles gets permitted routes, denied others (per role) | **MATCHES** | compliance 200 / admin 200 (both in allowedRoles) · advisor 403 / analyst 403 (neither in allowedRoles) — exact match to matrix row `/compliance/summary → {compliance, admin}`. |
| Role from SERVER-VERIFIED session claim; app-DB users.role authoritative | **MATCHES (code-verified + LIVE-consistent)** | `GET /auth/me` per role returns role from server session (compliance/advisor/analyst/admin all correct). `roles.guard.ts:111-122` re-resolves role via `resolveRoleBySupertokensUserId` (app-DB), authorizing off the DB value not the raw claim. The *DB-downgrade window-close* is not independently black-box-proven (no app-DB write channel; Railway CLI forbidden) — it is code-verified + consistent with the live matrix. Flagged to T-8 Security / Karen source-claim for the DB-reverify invariant. |
| Web denial graceful (redirect/403, not crash/blank) | **MATCHES (partial scope)** | Unauth authed-page → 307 /login (graceful). Web pages for other roles' routes are not built this wave (404 — see GAP-1); the only web-page live this wave (`/`) is all-roles, so there is no web same-role-denied page to exercise yet. API denial is 403 (graceful). |

**Block 2: MATCHES (5/5).** No RBAC bypass observed; fail-closed + allowlist behave exactly as specified live.

---

## Block 3 — Role-aware AppShell navigation (2dc00409)

| AC | Verdict | LIVE evidence (nav sets rendered per role) |
|---|---|---|
| Sidebar renders ONLY permitted nav items per role; 4 roles correct sets | **MATCHES** | **compliance**: {Dashboard, Compliance} · **advisor**: {Dashboard, Mandates, Compliance} · **analyst**: {Dashboard, Mandates, Sourcing} · **admin**: {Dashboard, Team, Settings}. Exact match to the pinned matrix / journey-map persona columns. |
| Nav CONSISTENT with RBAC — no shown item RBAC would 403 (one source, no drift) | **MATCHES** | Nav hrefs: compliance→`/`,`/compliance/queue`; advisor→`/`,`/mandates`,`/compliance/queue`; analyst→`/`,`/mandates`,`/sourcing`; admin→`/`,`/admin/settings`,`/admin/users`. Every href's route has the viewing role in `roleRoutes.allowedRoles` (advisor IS in `/compliance/queue` allowedRoles = {compliance, advisor} — no drift). Nav + enforcement derive from the single `roleRoutes` array (`packages/shared/src/rbac.ts`), so nav⊆RBAC by construction. Negative check: compliance page leaks NO admin/analyst-only item (Team/Settings/Sourcing/Mandates absent). |
| Switching identity → that role's nav set (deterministic per role) | **MATCHES** | Four distinct sessions each render their own deterministic nav set (above). |
| Active-route highlight + keyboard-accessible | **MATCHES** | `aria-current` present on the active nav item; nav items are real `<a href>` (keyboard-focusable). |

**Block 3: MATCHES (4/4).**

---

## Key intent checks (jenny's don't-rubber-stamp questions)

1. **Does login LAND the user in the app AND does RBAC actually gate?** — YES. Live signin → session → authed `/` role-aware shell (HTTP 200, no bounce). advisor + analyst genuinely CANNOT reach `/compliance/summary` (403). Not a paper guard.
2. **Is role-aware nav faithful to journey-map persona columns / pinned matrix per role?** — YES, exact per-role match for all 4 roles.
3. **Is `/` correctly authed now (unauth→/login) per P-4 reconciliation?** — YES (307→/login). Wave-1 public health-landing at `/` is superseded; `GET /health` (api) remains the health surface (200).
4. **No RBAC bypass; no nav item shown that RBAC denies?** — Confirmed. Fail-closed on deny, allowlist intact, nav⊆RBAC by construction (single `roleRoutes` source).

---

## Findings (drift / gap tags)

- **GAP-1 (LOW, spec-silent — NOT drift).** Unauth requests to not-yet-built authed pages (`/mandates`, `/sourcing`, `/admin/users`, `/compliance/queue`) return **404**, not a redirect to `/login`. The Block-1 AC says "unauth access to any AppShell page → /login" — but those pages do not exist this wave (matrix: "route stubs later M3+"), so there is no AppShell page there to guard; 404 is the Next.js default for an unrouted path. When those pages land (M3+) they must inherit the `(app)` group's unauth→/login guard. Spec-silent on 404-vs-redirect for unbuilt routes → gap, not code-wrong. No action required this wave; note for M3+ page authors + T-9 journey reconciliation.
- **GAP-2 (LOW, verification-coverage — NOT drift).** The DB-authoritative role *re-verification window-close* AC (guard authorizes off app-DB `users.role`, not the stale session claim) is code-verified (`roles.guard.ts`) + consistent with the live per-role matrix, but not independently black-box-proven (no app-DB write channel available to jenny; Railway CLI forbidden by brain policy). Routed to **T-8 Security** + **Karen** (source-claim) to confirm the downgrade-takes-effect-next-guarded-request invariant. Live evidence shows role IS read server-side and gates correctly; only the *staleness-close* edge is unproven here.

**No DRIFT found** (zero code-wrong deviations from spec intent on deployed behavior).

---

## Cross-agent notes
- **@karen** (source-claim, independent): please confirm the DB-reverify invariant (GAP-2) at the source level + that `roleRoutes` is the sole enforcement source (no scattered per-route checks drifting from the matrix).
- **T-8 Security**: black-box the role-downgrade window (GAP-2) and confirm the `/auth/invite` anon-201 (admin-gating deferred per spec comment) is an accepted deferral, not a live exposure.
- **T-9 Journey**: reconcile map row 4 (`/` stays Dashboard) + the unbuilt-route 404 behavior (GAP-1) when M3+ pages land.

**VERDICT: APPROVE — drift 0 / gap 2 (both LOW).**
