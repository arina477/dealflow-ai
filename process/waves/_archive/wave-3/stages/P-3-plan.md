# P-3 — Plan (Wave 3)

**Wave topic:** Shared AppShell chrome + role-aware dashboard shell + per-route RBAC enforcement + role-aware nav (M1 success-metric slice).
**Specs (authoritative in DB):** seed `1931b452` (AppShell + dashboard shell) · `2ecc4a7b` (per-route RBAC) · `2dc00409` (role-aware nav). Convenience copy: `process/waves/wave-3/stages/P-2-spec.md`.
**design_gap_flag:** `false` (carried from P-1; DESIGN-SYSTEM §10 defines the canonical chrome, `design/dashboard.html` + the ~20 authed-page mockups exist — no new design work required this wave).
**Mode during P-block:** automatic.

---

## APPROACH

### Architecture delta 1 — Shared AppShell chrome (built ONCE)

**What's new:** A single set of shared chrome components in `apps/web` — `<AppShell>` composing `<Sidebar>` + `<TopBar>` + `<NavItem>`, plus the base primitives the shell needs. Rendered ONCE via a Next.js **route-group layout** that wraps every authed page. No page re-implements the chrome (DESIGN-SYSTEM §10 is the authority; the placeholder `/dashboard/page.tsx` inline card is retired into a shell-hosted landing).

**Structure per §10:**
- Sidebar `w-64 bg-zinc-900 text-zinc-50`: emerald-600 logomark + `network` lucide icon + "DealFlow AI" wordmark; group **Workspace** → Dashboard (`layout-dashboard`), Mandates (`briefcase`), Sourcing (`database`), Compliance (`shield-check`); group **Config** → Team (`users`), Settings (`settings`); footer user button (initials + name + role). Active item: `bg-zinc-800` + emerald-600 left rail + `text-emerald-500` icon.
- TopBar `h-16` white sticky `border-b border-zinc-200`: breadcrumb/title left · search + notifications + user right.
- Icons `lucide-react` ONLY; primary `bg-emerald-600 hover:bg-emerald-700`; palette zinc + emerald + 5 status tokens only; 4px grid.

**Why route-group layout over per-page wrapper (alternatives + trade-off):**
- **Chosen — Next.js route-group `app/(app)/layout.tsx`** wrapping all authed routes. The App-Router `layout.tsx` renders the shell once and persists it across navigations within the group (no chrome remount / flfor on route change); it is the framework-native "render chrome once" seam and is exactly the §10 "implement ONCE" mandate.
  Trade-off accepted: requires physically moving `/dashboard` into the `(app)` group, and the layout must resolve the session/role server-side (see delta 2 + 4) so the shell can render role-aware nav on first paint.
- **Rejected — per-page `<AppShell>{children}</AppShell>` wrapper.** Each page imports and wraps itself. Trade-off: re-invites the exact drift §10 forbids (a new page can forget the wrapper or pass different props), remounts chrome per navigation, and duplicates the session/role fetch per page. Violates "build ONCE."
- **Rejected — root `app/layout.tsx` global shell.** Would force chrome onto `/login`, `/accept-invite`, `/reset-password` and `/` which §10 explicitly says get NO sidebar. A route group scopes the shell to authed pages only.

**Failure-domain impact:** Front-end render-path only; no service boundary crossed, no transaction scope change. The layout adds a server-side session read on every authed navigation (same call the placeholder dashboard already makes to `GET /auth/me`).

---

### Architecture delta 2 — Per-route RBAC ENFORCEMENT (allowlist-safe)

**What changes:** The wave-2 `RolesGuard` primitive (`apps/api/src/modules/auth/guards/roles.guard.ts`) — currently applied to ZERO routes — becomes **applied** to protected API handlers via `@UseGuards(RolesGuard)` + `@Roles(...)` metadata. A matching **web route-protection** mechanism denies protected pages to users lacking the role.

**CRITICAL allowlist design (load-bearing — P-0 problem-framer guardrail):**
- Enforcement is **opt-in by decoration**, never a global enforce-everything guard. The guard already no-ops when a route carries no `@Roles()` metadata (verified in guard code: `if (!required || required.length === 0) return true;` — line 54). So a route is restricted ONLY where `@Roles()` is explicitly added. This is the low-blast-radius rollout shape.
- **Never gated** (must stay reachable with NO session/role — the live wave-2 login must NOT break):
  - `POST /auth/signin`, `/auth/signup`, `/auth/session/refresh`, `/auth/signout`, `/auth/user/password/*` (SuperTokens auto-routes) + the custom `/auth/invite`, `/auth/signup`, `/auth/reset/request`, `/auth/reset/confirm`, `/auth/logout`, `GET /auth/me` (SessionGuard authn only, NO `@Roles()`).
  - `GET /health` (anon).
  - Web `/` (landing/health), `/login`, `/accept-invite`, `/reset-password`.
- **What gets `@Roles()` this wave:** the compliance controller is the enforced exemplar this wave (RBAC's raison d'être = the M6 separation-of-duties wedge hard-depends on enforced RBAC). Because no feature controllers beyond auth/health exist yet, this wave delivers RBAC as an **enforced, tested substrate** by applying `@Roles()` to a real protected surface. Concretely: add a thin **`GET /compliance/summary`** protected endpoint decorated `@UseGuards(SessionGuard, RolesGuard)` + `@Roles('compliance', 'admin')`, returning a role-appropriate shell payload the dashboard's compliance card consumes. This gives RBAC a live route to enforce + a per-role 403 to test (each of the 4 roles verified: `compliance`/`admin` → 200; `advisor`/`analyst` → 403), without inventing feature scope. The role→routes source of truth (delta 3) drives which roles this endpoint requires.

**Enforcement reads role from server-verified session claim only (delta 4):** `RolesGuard` reads the role from `session.getAccessTokenPayload().role` via SuperTokens `getSession` — never a client header/body. Web route-protection reads the same server-verified session (via `GET /auth/me`, cookie forwarded server-side) — the app-DB `users.role` is authoritative and mirrored into the claim at login (wave-2).

**Web route-protection mechanism (alternatives + trade-off):**
- **Chosen — server-side check inside `app/(app)/layout.tsx`** (React Server Component): resolve `GET /auth/me` once; if no session → `redirect('/login')`; then check the role against the route's required-roles from the shared map (delta 3); on deny → `redirect` to an allowed landing (`/dashboard`, always permitted) or render a `403` state. Because the layout already fetches the session for the shell, this adds no extra round-trip and keeps authn+authz in one server seam.
  Trade-off accepted: layout-level check is coarse (per route-group + per-page); fine-grained per-segment gating would need each protected segment to also assert its own required-roles. Handled by having each protected page segment read the shared map for its own path (thin `assertRole(path, role)` helper), so a nested page cannot be reached without its own check.
- **Rejected — Next.js `middleware.ts` (edge).** Middleware runs at the edge without the Node cookie/SuperTokens SDK and cannot cheaply re-verify the session claim server-side; it would either trust an unverified cookie (violates delta 4) or add a fetch hop on every request. Server-component check keeps verification server-side and colocated with the shell fetch.
- **Rejected — client-side guard.** Client cannot be the authorization boundary (role is client-visible, bypassable). API `@Roles()` remains the true enforcement; the web check is UX (graceful deny, no blank screen), and the API is the backstop.

**Failure-domain impact:** This **changes a permission check** on the API (auth-adjacent → P-4 security-scope tightened gate + T-8 Security this wave). Blast radius is bounded by the allowlist: only `@Roles()`-decorated routes change behavior; `/auth/*`, `/health`, `/` are untouched. Regression guard: an explicit test asserts the login flow + `/auth/*` stay reachable with no session (edge-case in spec block-2).

---

### Architecture delta 3 — SINGLE role→routes/nav source of truth (no drift)

**What's new:** ONE map, consumed by BOTH the RBAC route-roles AND the role-aware nav — so a visible nav item can NEVER lead to a route RBAC would 403 (spec block-3 invariant).

**Shape:** a `roleRoutes` structure (in `@dealflow/shared`, so both API and web import the same source) mapping each route/nav-key → the set of roles permitted, plus nav-presentation metadata (label, lucide icon name, group, href, order). Derived selectors:
- `navItemsForRole(role): NavItem[]` — used by `<Sidebar>` to render only permitted items (delta 1 + spec block-3).
- `rolesForRoute(path): Role[]` — the required-roles the API `@Roles()` uses and the web route-protection asserts (delta 2).

Because `@Roles()` on the compliance endpoint and the nav's Compliance item both derive from the SAME map entry, they cannot drift. A contract test (T-3) asserts: for every nav item a role sees, `rolesForRoute(item.href)` permits that role (nav ⊆ RBAC-allowed) — encoding the invariant as an executable check.

**Why shared-package map over two hand-kept lists (trade-off):**
- **Chosen — single map in `@dealflow/shared`.** One edit updates both surfaces; the invariant is testable across the boundary.
  Trade-off: adds a shared type both apps depend on; the Role enum already lives there (`packages/shared/src/auth.ts`), so this is consistent placement.
- **Rejected — nav list in web + route-roles in API, kept in sync by convention.** Guaranteed drift over time (a nav item shown but RBAC-denied is a defect per spec block-3). Rejected outright.

**Failure-domain impact:** Contract-layer addition; no runtime boundary change. Reduces future permission-drift risk.

---

### Architecture delta 4 — Role read from server-verified session claim only

**What's new:** Nothing structurally new — this is a constraint enforced across deltas 1–3. Every authorization decision (API guard, web route-protection, nav rendering) reads role from the SERVER-verified session (`getAccessTokenPayload().role` on API; `GET /auth/me` server-side on web), never a client-supplied value. App-DB `users.role` is authoritative; the claim is a login-time mirror (wave-2). No client component receives role as a trust boundary — the shell's role display and nav are computed server-side and passed down as already-authorized data.

**Failure-domain impact:** Preserves the wave-2 security posture; no new trust surface.

---

### Data model

**NONE.** No schema change this wave. RBAC + role-aware nav use the EXISTING `users.role` column (wave-2) and the EXISTING session role-claim (wave-2). No added/renamed/removed columns, no migration, no index change, no FK/constraint change. Stated explicitly per P-2 spec ("uses existing users.role + session claim").

---

### API contracts (concrete)

**Modified — none of the existing 6 `/auth` routes change** (allowlist: they stay ungated; regression-guarded).

**Added — one enforced RBAC exemplar endpoint:**

| Field | Value |
|---|---|
| Path + method | `GET /compliance/summary` |
| Request schema | none (no body/params); session cookie required |
| Response (success) | `200` — `complianceSummaryResponseSchema` (new Zod in `@dealflow/shared`): `{ pendingCount: number, items: [] }` (role-appropriate shell payload; empty landing state — NOT feature content per M1 slice) |
| Response (error) | `401` (no/invalid session — SessionGuard) · **`403` on role deny** — envelope: NestJS `ForbiddenException` default `{ statusCode: 403, message: "Forbidden", error: "Forbidden" }` — **no data leak in body** (spec block-2 AC) |
| Auth model | **role-gated** — `@UseGuards(SessionGuard, RolesGuard)` + `@Roles('compliance', 'admin')` (roles sourced from the shared `roleRoutes` map) |
| Idempotency | GET, safe/idempotent; `cache: 'no-store'` |

**Allowlist set (ungated — regression-guarded, no `@Roles()`):**
`/auth/signin`, `/auth/signup`, `/auth/session/refresh`, `/auth/signout`, `/auth/user/password/*`, `POST /auth/invite`, `POST /auth/signup`, `GET /auth/me` (SessionGuard authn only), `POST /auth/reset/request`, `POST /auth/reset/confirm`, `POST /auth/logout` (SessionGuard authn only), `GET /health`; web `/`, `/login`, `/accept-invite`, `/reset-password`.

**403 deny envelope (concrete):** the NestJS `ForbiddenException` JSON above; body carries no requested-resource data. Web deny → `redirect` to `/dashboard` (always-permitted) or a rendered 403 state; never a raw crash or blank screen (spec block-2 AC).

---

### Dependencies

**NONE new.** Confirmed:
- No new external SDK this wave — SuperTokens was integrated in wave-2 and is reused as-is (session read, role claim). **No SDK pre-build checklist required** (`claudomat-brain/rules/external-sdk-integration-rules.md` not triggered).
- `lucide-react` is already the mandated icon lib (DESIGN-SYSTEM §10, `lucide-react` in code); confirm it is already a `apps/web` dependency during B-1 (if absent it is a first-party UI dep, not an external service SDK — no checklist, pin to current stable). No other runtime deps added.
- No bundle/runtime/license concern introduced.

---

## PLAN (file-level steps, grouped by B-stage)

Notation per step: **path** · operation · what changes · specialist · order.

### B-1 — Contracts (types / Zod / shared source of truth)

| # | Path | Op | Change | Specialist | Order |
|---|---|---|---|---|---|
| 1 | `packages/shared/src/rbac.ts` | create | The single `roleRoutes` map (route key → { roles: Role[], nav: {label, icon, group, href, order} }) + selectors `navItemsForRole(role)` + `rolesForRoute(path)` + `NavItem` type. THE single source of truth (delta 3). Imports `Role` from `./auth`. | `typescript-pro` | first — B-2/B-3 depend on it |
| 2 | `packages/shared/src/index.ts` | modify | Re-export `rbac.ts` symbols so `@dealflow/shared` exposes `roleRoutes` / `navItemsForRole` / `rolesForRoute` / `NavItem`. | `typescript-pro` | after #1 |
| 3 | `packages/shared/src/compliance.ts` | create | `complianceSummaryResponseSchema` + `ComplianceSummaryResponse` type (`{ pendingCount, items: [] }`) for the enforced RBAC endpoint. | `typescript-pro` | parallel with #1 |
| 4 | `packages/shared/src/index.ts` | modify | Re-export `compliance.ts` (fold into #2 edit — single index edit). | `typescript-pro` | after #3 (merge with #2) |

### B-2 — Backend (RBAC enforcement + guard wiring + exemplar route)

| # | Path | Op | Change | Specialist | Order |
|---|---|---|---|---|---|
| 5 | `apps/api/src/modules/compliance/compliance.controller.ts` | create | `GET /compliance/summary` handler; `@UseGuards(SessionGuard, RolesGuard)` + `@Roles(...rolesForRoute('/compliance'))` (roles from shared map). Returns `ComplianceSummaryResponse`. | `security-engineer` | after B-1 #1 |
| 6 | `apps/api/src/modules/compliance/compliance.service.ts` | create | Thin service returning the role-appropriate shell payload (empty landing state; NOT feature content). | `backend-developer` | with #5 |
| 7 | `apps/api/src/modules/compliance/compliance.module.ts` | create | Module wiring controller + service; imports `SessionGuard` + `RolesGuard` + `Reflector` (reuse from AuthModule exports or re-provide). | `backend-developer` | after #5, #6 |
| 8 | `apps/api/src/app.module.ts` | modify | Register `ComplianceModule` in `imports[]`. | `backend-developer` | after #7 |
| 9 | `apps/api/src/modules/auth/guards/roles.guard.ts` | modify | Update the built-but-unapplied header comment to reflect ENFORCED status (guard is now applied); optionally re-verify claim against app-DB `users.role` per the guard's own security note if cheap — else leave claim-read (documented fast-path). No behavior regression to the no-`@Roles()` no-op path (allowlist safety). | `security-engineer` | after #5 (context) |

### B-3 — Frontend (AppShell chrome + dashboard shell + role-aware nav + web route-protection)

| # | Path | Op | Change | Specialist | Order |
|---|---|---|---|---|---|
| 10 | `apps/web/app/(app)/_components/NavItem.tsx` | create | Presentational nav item: lucide-react icon + label + active-state (`bg-zinc-800` + emerald left rail + `text-emerald-500`); keyboard-accessible, visible focus ring, `aria-current` on active. | `nextjs-developer` | after B-1 #1,#2 |
| 11 | `apps/web/app/(app)/_components/Sidebar.tsx` | create | `w-64 bg-zinc-900` sidebar per §10: logomark (`network`) + wordmark, Workspace/Config groups, footer user button; renders ONLY `navItemsForRole(role)` (role-aware, delta 3); consumes `<NavItem>`. | `nextjs-developer` | after #10 |
| 12 | `apps/web/app/(app)/_components/TopBar.tsx` | create | `h-16` white sticky top bar per §10: breadcrumb/title left; search + notifications + user right. | `nextjs-developer` | parallel with #11 |
| 13 | `apps/web/app/(app)/_components/AppShell.tsx` | create | Composes `<Sidebar role=…>` + `<TopBar>` + `{children}` grid; the ONE shell (delta 1). Receives already-authorized `role` (server-verified). | `nextjs-developer` | after #11, #12 |
| 14 | `apps/web/app/(app)/layout.tsx` | create | Route-group layout: server-side `GET /auth/me` (cookie forwarded) → no session → `redirect('/login')`; renders `<AppShell role={me.role}>`. Single render-once seam (delta 1 + 4). | `nextjs-developer` | after #13 |
| 15 | `apps/web/app/(app)/dashboard/page.tsx` | create (move) | Role-aware dashboard SHELL/landing: shows identity + role + role-appropriate empty/landing state; consumes `GET /compliance/summary` only when role permits (guarded by shared map). NOT feature content. Replaces old `app/dashboard/page.tsx`. | `nextjs-developer` | after #14 |
| 16 | `apps/web/app/dashboard/page.tsx` | delete | Retire the wave-2 placeholder (moved into `(app)` group). Update `dashboard/page.test.tsx` path accordingly. | `nextjs-developer` | with #15 |
| 17 | `apps/web/app/(app)/_lib/assertRole.ts` | create | Thin `assertRole(path, role)` helper for per-segment web route-protection: reads `rolesForRoute(path)`; on deny → `redirect('/dashboard')` or 403 state (delta 2, graceful deny). | `nextjs-developer` | after B-1 #1,#2 |

### B-4 — Wiring (deps / config / type-check fixers)

> Stage-name note: the P-3 schema labels the wiring stage "B-5"; this project's checklist uses **B-4 Wiring** (B-5 = Verify, B-6 = Review). Steps below run at the project's **B-4 Wiring** stage.

| # | Path | Op | Change | Specialist | Order |
|---|---|---|---|---|---|
| 18 | `apps/web/package.json` | modify (if needed) | Ensure `lucide-react` is a dependency (pin current stable) if not already present. No external SDK. | `nextjs-developer` | before B-3 render steps |
| 19 | repo-wide typecheck reconciliation | modify | Fix any import/type breaks from the `@dealflow/shared` additions + the `/dashboard` move; keep repo typecheck green (per wave-2 precedent 57161c0). | `typescript-pro` | last |

**Frontend folds into B-3** (the schema's "B-4 Frontend" maps to the B-3 rows above; this project's B-4 stage is Wiring). No DB migration ⇒ **no B-0 Schema DB files** (B-0 Branch & schema creates the branch only; B-1 here is contracts-only).

---

### Specialist routing (validated against `command-center/AGENTS.md`)

| Specialist | Exists in AGENTS.md? | Role this wave |
|---|---|---|
| `typescript-pro` | Yes (row 91 per-stack executors — `typescript-pro` named) | shared contracts / rbac map / typecheck |
| `security-engineer` | Yes (row 82) | RBAC enforcement (`@Roles()` application, guard, deny envelope) — auth/RBAC branch |
| `backend-developer` | Yes (row 70, universal executor) | compliance service/module wiring |
| `nextjs-developer` | Yes (row 91 per-stack executors — `nextjs-developer` named) | AppShell chrome, dashboard shell, role-aware nav, web route-protection |
| `test-automator` | Yes (row 83) | (T-block; not spawned at B, listed for continuity) |

All specialists present in the catalog — no `agent-creator` install needed, no silent substitution.

---

### Parallelization map

- **B-1 parallel batch:** { `packages/shared/src/rbac.ts` (#1) } ‖ { `packages/shared/src/compliance.ts` (#3) } — independent files, both by `typescript-pro`. `index.ts` (#2/#4) serializes AFTER both (single shared file — appears in ONE batch only).
- **B-2 serial chain:** #5 (`compliance.controller`) → #6 (`compliance.service`, can start with #5) → #7 (`compliance.module`) → #8 (`app.module` register). #9 (guard comment/verify) parallel to the chain (independent file). Compliance controller depends on B-1 #1 (shared map).
- **B-3 chains:**
  - Chain A (shell): #10 `NavItem` → #11 `Sidebar` ‖ #12 `TopBar` → #13 `AppShell` → #14 `layout` → #15 `dashboard page` (‖ #16 delete old).
  - Independent: #17 `assertRole` (parallel with chain A, depends only on B-1 map).
  - All B-3 depends on B-1 #1/#2 (shared map + exports).
- **B-4 (Wiring):** #18 before B-3 render; #19 last (global). No file appears in two parallel batches.

---

### Self-consistency sweep (Action 8)

**1. Every acceptance criterion → ≥1 file-level step:**

*Block 1931b452 (AppShell + dashboard shell):*
- AC "AppShell ONCE as shared components, every authed page inside it" → #10–#14 (shell built once, route-group layout wraps all authed pages). ✔
- AC "signed-in user sees canonical chrome per §10, zinc/emerald, 4px, lucide-react" → #11,#12,#13 (Sidebar/TopBar/AppShell per §10). ✔
- AC "dashboard = role-aware SHELL/landing, NOT feature content" → #15 (empty/landing state; #6 service returns empty items). ✔
- AC "unauth access → redirect /login; auth renders shell" → #14 (layout server-side me → redirect). ✔
- AC "accessible: keyboard nav, focus ring, aria, no trap" → #10 (NavItem a11y) + #11/#13. ✔
- Edge "expired session → redirect /login (no crash)" → #14. ✔ · Edge "role missing → safe default, no elevated nav, no crash" → #11 via `navItemsForRole` default + #17. ✔ · Edge "narrow viewport usable" → #13 responsive. ✔

*Block 2ecc4a7b (per-route RBAC):*
- AC "RolesGuard now APPLIED via @Roles(); role deny → 403 no data leak" → #5 (`@Roles` + guard) + API contract 403 envelope. ✔
- AC "ALLOWLIST-safe — /auth/*, /health, / NOT gated; login not broken" → allowlist set in API contracts + #9 preserves no-op path; regression covered by T-layer (login-reachable test). ✔ **[allowlist covered]**
- AC "each of 4 roles allowed/denied per role, verified" → #5 roles from shared map; per-role 403/200 tested at T-3/T-4. ✔
- AC "role from SERVER-verified session claim, never client; app-DB authoritative" → #5 guard reads `getAccessTokenPayload().role`; #14/#17 read server-side me (delta 4). ✔
- AC "web deny graceful (redirect/403), not crash/blank" → #17 `assertRole` + #14. ✔
- Edge "login + /auth/* reachable with NO session (regression guard)" → allowlist + #9 no-op path. ✔ · Edge "role has A not B" → shared map per-route roles. ✔ · Edge "valid session, role not permitted → 403 not 401/500" → #5 guard order (Session then Roles). ✔ · Edge "no duplicated inconsistent check web vs API (single source)" → #1 shared map (delta 3). ✔ **[nav↔RBAC single-source invariant covered]**

*Block 2dc00409 (role-aware nav):*
- AC "Sidebar renders ONLY permitted nav items; 4 roles correct set" → #11 via `navItemsForRole` (#1). ✔
- AC "nav CONSISTENT with enforced RBAC — no visible item leads to 403; one source of truth" → #1 shared map feeds BOTH nav + `@Roles()`; contract test asserts nav ⊆ RBAC-allowed. ✔ **[nav↔RBAC single-source invariant covered]**
- AC "re-login as another role shows that role's nav" → #11 role-driven render + #14 server role. ✔
- AC "active-route highlight; keyboard-accessible focus" → #10 NavItem. ✔
- Edge "minimal role still gets dashboard/home item (never empty sidebar)" → #1 map: Dashboard permitted to all roles. ✔ · Edge "nav map + RBAC route-roles must not drift" → #1 single source + contract test. ✔

**2. Every file-level step has a specialist:** ✔ (all 19 rows carry a specialist; all validated in AGENTS.md).
**3. No file in multiple parallel batches:** ✔ (`index.ts` serialized after both B-1 creates; each file appears once).
**4. `design_gap_flag` referenced:** ✔ **false** — DESIGN-SYSTEM §10 + `design/dashboard.html` + authed-page mockups exist; no D-block work needed (carried from P-1).
**5. Architecture deltas with explicit alternative trade-offs:** ✔ (deltas 1–2 each name chosen + 2 rejected with trade-off; delta 3 names chosen + 1 rejected).
**6. Data + API contracts concrete, no TBD:** ✔ (data model = NONE stated; API = concrete path/method/schema/auth/403 envelope + allowlist set).
**7. New deps justified:** ✔ **none new** — no external SDK; `lucide-react` is the mandated first-party UI lib (confirm-present only).
**8. SDK pre-build checklist:** **N/A — no new external SDK this wave** (SuperTokens reused from wave-2). Confirmed not triggered.

**Sweep result: CLEAN.** No contradictions to reconcile before P-4.

---

## Exit criteria status
- Architecture deltas + trade-offs: ✔ (4 deltas) · Data + API concrete: ✔ · Deps justified: ✔ (none) · SDK checklist: N/A ✔ · Every in-scope file has step + specialist: ✔ (19) · Every specialist in AGENTS.md: ✔ · Parallelization map: ✔ · Self-consistency sweep: ✔ clean · checklist P-3 box: ticked below.

→ Next: **P-4 Gate** (security-scope tightened — RBAC is auth-adjacent).

---

## P-4 remediation (jenny Phase-2 BLOCK → resolved; doc-level, no P-0/P-1 rework)
1. **Canonical dashboard route = `/`** (authed, `(app)` group index; unauth `/`→/login). NOT `/dashboard`. Public allowlist corrected to `/auth/*` + `GET /health` ONLY (`/` is authed; wave-1 public landing superseded). Login success redirect → `/`. T-9 reconciles journey map (row 4 `/` canonical; drop stale `/dashboard` note). Logged in product-decisions.md.
2. **Concrete role→route/nav matrix PINNED** from journey-map persona columns (see the spec addendum table on task 1931b452). B-1 authors `packages/shared/src/rbac.ts` `roleRoutes` FROM that table (not improvised); B-2 `@Roles()` + B-3 nav both consume it. Roles: Dashboard `/`=all4; Mandates `/mandates*`=advisor,analyst (new/matches=advisor); Sourcing `/sourcing`,`/companies`=analyst; Templates=analyst,compliance; Compliance `/compliance/*`=compliance(+advisor for queue); `/compliance/summary` exemplar=compliance,admin; Admin `/admin/*` (Team+Settings)=admin. Nav items for not-yet-built routes render role-appropriately → placeholder (no inconsistent 404/403); T-3 nav⊆RBAC test enforces fidelity.
