# P-3 Plan — Wave 4: Tamper-evident HMAC hash-chain audit log (M2 compliance backbone)

> Pointer to source of truth: the full spec contract lives in `tasks.description` of seed
> `ec1f279d-ea8a-44db-977b-cb6891972c1f` (multi-spec, 4 blocks + 4 tamper-evidence sharpening notes).
> Convenience copy: `process/waves/wave-4/stages/P-2-spec.md`. `design_gap_flag: false`.
>
> **Ground truth read for this plan:** `command-center/dev/architecture/security.md` §Audit-log security &
> integrity (HMAC-SHA256 hash-chain, INSERT-only grant + BEFORE UPDATE/DELETE trigger, in-transaction write,
> versioned canonical serialization); product-decisions #6/#7 (additive / append-only, compliance-first
> MVP-core); `.env.example` (`AUDIT_LOG_HMAC_KEY` + `AUDIT_LOG_HMAC_KEY_VERSION` placeholders present);
> M1 code — `apps/api/src/db/{index.ts,db.provider.ts,schema/}`, `apps/api/src/db/migrations/0001_*.{sql,down.sql}`,
> `apps/api/drizzle.config.ts`, the wave-3 RBAC guard (`apps/api/src/modules/auth/guards/roles.guard.ts` +
> `@Roles`), the compliance module (`apps/api/src/modules/compliance/*`), the shared `roleRoutes` single source
> (`packages/shared/src/rbac.ts`), the `(app)` route-group layout + AppShell
> (`apps/web/app/(app)/{layout.tsx,_components/AppShell.tsx,_lib/assertRole.ts}`), `design/audit-log-export.html §Integrity Validation`
> + DESIGN-SYSTEM §10.

---

## APPROACH

### Architecture deltas

#### Δ1 — `audit_log_entries` table + DB-layer immutability (block ec1f279d)

**What's new.** A new append-only table `audit_log_entries` in the app DB (Drizzle schema module
`apps/api/src/db/schema/audit-log.ts`, re-exported via the barrel), plus a **raw-SQL immutability layer**
appended to its migration: (a) `REVOKE UPDATE, DELETE, TRUNCATE` + `GRANT INSERT, SELECT` to the app role;
(b) a `BEFORE UPDATE OR DELETE` trigger function that unconditionally `RAISE EXCEPTION`s.

**Why this approach over alternatives.**
- **Alternative A — app-layer only (no UPDATE/DELETE code path).** Rejected as *sole* control: the whole
  point of tamper-evidence is defence against an actor with DB access, not just against a forgetful
  developer. App-layer discipline is necessary but not sufficient; security.md mandates DB-layer defence in
  depth. We keep the app-layer discipline (the append service only ever `INSERT`s) **and** add the DB layer.
- **Alternative B — grant-only (REVOKE UPDATE/DELETE from the app role).** Rejected as *sole* DB control: a
  grant binds to a specific role. A privileged/superuser connection (migrations run, an ops console, a
  compromised admin DB credential) bypasses grants entirely — `postgres`/table-owner is not constrained by
  its own grants. The **trigger** is the layer that catches *every* role including superuser, because
  `BEFORE UPDATE/DELETE` triggers fire regardless of the connecting role's privileges (Postgres evaluates
  the trigger before applying the row change; only `session_replication_role = replica` or `DISABLE TRIGGER`
  can suppress it, both of which are themselves privileged, auditable, non-default operations and out of the
  app's reach). **Chosen: grant + trigger together** — grant blocks the app role at the privilege layer;
  trigger blocks *everyone* (incl. superuser) at the row layer. Two independent DB-layer controls.
- **Alternative C — separate least-privileged DB role for audit writes.** Deferred (noted as upgrade path):
  the app connects as a single role via `DATABASE_URL` (`apps/api/src/db/index.ts` — one `Pool`, one
  connection string, no per-table role switching). Introducing a second connection/role is an infra change
  beyond this thin slice and is not required to satisfy the immutability ACs (grant + trigger already block
  the app role and every other role). Recorded as a future hardening.

**How the grant is applied given the app connects as one role (`DATABASE_URL`).** The migration runs
`drizzle-kit migrate` using `DATABASE_URL` (or `DATABASE_URL_UNPOOLED` if a pooler is used) — i.e. as the
**same app role** the runtime uses. The grant is therefore expressed against that role. Because the migration
does not know the literal role name at author time, the migration derives it at apply time:
`GRANT INSERT, SELECT ON audit_log_entries TO CURRENT_USER; REVOKE UPDATE, DELETE, TRUNCATE ON
audit_log_entries FROM CURRENT_USER;` — `CURRENT_USER` inside the migration transaction *is* the app role
(migrations connect as the app role). If a deployment later runs migrations as a distinct owner role, the
grant target is parameterised via a documented `AUDIT_APP_ROLE` fallback in the migration comment; for MVP
(single-role Railway deploy) `CURRENT_USER` is correct and self-adjusting. The **REVOKE** is explicit and
belt-and-suspenders — a freshly created table grants no UPDATE/DELETE to non-owners by default, but the
REVOKE makes the intent auditable and covers the case where the app role *is* the table owner (owners hold
implicit full rights, so REVOKE-from-owner is a no-op at the privilege layer — which is exactly why the
**trigger** is the load-bearing control for the owner/superuser case).

**How the trigger blocks even a superuser.** `CREATE TRIGGER audit_log_no_mutate BEFORE UPDATE OR DELETE ON
audit_log_entries FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();` where the function body is
`RAISE EXCEPTION 'audit_log_entries is append-only: % blocked', TG_OP;`. `BEFORE` row triggers execute for
the connecting role **whatever its privileges** — Postgres has no "superuser skips triggers" path; the only
escapes (`ALTER TABLE ... DISABLE TRIGGER`, `SET session_replication_role = replica`) are themselves
privileged, non-default, and would be visible/auditable operations, not something the app or a
DB-write-capable attacker performs silently in the normal path. This is the AC-3 "blocks EVERY role including
privileged/superuser" guarantee.

**Failure-domain impact.** New table only — **no existing table touched** (`users`/`roles`/`invites`/
`app_meta` untouched → additive per product-decisions #6/#7). No transaction-scope change to existing paths.
The grant/trigger are new DB objects the down-migration drops cleanly. FK to `users(id)` is
`ON DELETE SET NULL` on a **nullable** `actor_user_id` (system/genesis events have no actor; a user deletion
must never cascade-delete or block an immutable audit row).

#### Δ2 — HMAC-SHA256 hash-chain append service (block a8b2b5a2)

**What's new.** A new `audit` module `apps/api/src/modules/audit/` with:
- `audit-hash.ts` — pure crypto core: canonical serialization + `entry_hash = HMAC-SHA256(key,
  canonical(...))` via `node:crypto` `createHmac('sha256', key)`. **No new dependency** — `node:crypto` is a
  Node built-in (confirmed below).
- `audit.keyring.ts` — env-sourced key resolution + **boot-time fail-fast assertion** (mirrors the
  SuperTokens no-alias / env-present assertion pattern in the codebase): asserts `AUDIT_LOG_HMAC_KEY` is
  present and non-empty at module init; throws (refuses to boot) if missing — no unsigned entries can ever be
  written. Exposes a **`chain_version → key` map** keyed by `AUDIT_LOG_HMAC_KEY_VERSION` (v1 only today, but
  the map shape supports rotation: the verifier selects the key by each entry's stored `chain_version`).
- `audit.service.ts` — the single `AuditService.append(entry, tx)` write authority (security.md
  "one audit-write service" reusability principle). Owns canonical serialization, chain linkage, genesis
  anchor, and transactional composition.
- `audit.repository.ts` — Drizzle data access (tail read + insert), always given a tx handle.

**Genesis anchor.** The first (sequence-1) entry links to a well-defined constant `prev_hash`
(`GENESIS_PREV_HASH = '0'.repeat(64)` — 64 hex zeros, matching the SHA-256 hex width), documented + unit
tested, so the chain has a defined, reproducible root.

**Write atomicity (sharpening note 4).** `append(entry, tx)` takes a **Drizzle transaction handle** as a
required parameter so a caller can compose the audit write into the *same* `db.transaction(async (tx) => {
… businessWrite(tx); await auditService.append(evt, tx); })` — the audited action and its audit row commit
or roll back **together**. There is no fire-and-forget path and no separate connection. (This wave has no
real audited business action yet — see API contracts — so the transactional API is exercised by
tests/harness that open a tx and call `append`; real call-sites wire in at M6+.)

**Concurrent-append single chain (sharpening note / edge-case).** Two concurrent appends must not read the
same tail and fork `prev_hash`. We serialize the *chain-tail read → compute → insert* critical section with a
**transaction-level Postgres advisory lock** (`pg_advisory_xact_lock(<audit_chain_lock_key>)`) taken at the
top of `append`, so only one appender holds the tail at a time; the lock releases at tx commit/rollback.
- **Alternative — `SELECT … FOR UPDATE` on the tail row.** Considered; weaker for the *empty-log→genesis*
  race (no tail row to lock when the table is empty, so two genesis inserts could both compute sequence-1's
  prev_hash). The advisory lock covers the empty-log case (it locks a constant key, not a row) and the
  IDENTITY column still guarantees strict monotonic `sequence_number`. **Chosen: `pg_advisory_xact_lock`**
  on a fixed key, scoped to the append tx. Documented so future high-throughput needs can revisit (e.g. a
  dedicated single-writer outbox).

**Key handling (sharpening note 2).** Key read from `AUDIT_LOG_HMAC_KEY` (Railway env) **only** — never
written to the DB, never logged (the keyring never appears in log lines; entries carry only hashes, no
plaintext secret). Boot-assert present. `chain_version` column stores `AUDIT_LOG_HMAC_KEY_VERSION` so rotation
is verifier-transparent.

**Threat-model boundary (sharpening note 1 — documented, accepted).** The keyed HMAC chain makes tampering
**evident to any verifier without the key** and detects app-layer tampering + read-only-DB-access tampering
(an attacker who can read/alter rows but lacks the key cannot forge a valid continuation). An attacker with
**both** DB write access **and** the HMAC key could re-chain undetectably — this boundary is **documented as
accepted** for the compliance-recordkeeping threat model (key isolated in Railway env, separate trust zone
from the DB; DB-layer immutability trigger further raises the bar even for a key-holder because silent
in-place edits are trigger-blocked, forcing a detectable table-level operation). Noted upgrade path:
asymmetric signature / HSM-held key so even a full-DB-compromise can't re-sign. **No integrity claim beyond
this boundary is made.**

**Failure-domain impact.** New module; no change to existing services. The transactional API means callers
*expand* their transaction scope to include the audit write — by design (atomicity). No cross-service
boundary crossed (audit lives in-process in the API).

#### Δ3 — Chain-integrity verifier + verification endpoint (block e6a4cbfe)

**What's new.** `audit.verifier.ts` in the audit module + a `GET /compliance/audit-log/verify` route on the
existing `ComplianceController` (or a sibling controller in the compliance module — see file steps),
`@UseGuards(SessionGuard, RolesGuard) @Roles(...rolesForRoute('/compliance/audit-log/verify'))`, reusing the
**wave-3 RBAC guard verbatim** and sourcing roles from the shared `roleRoutes` map (single source of truth —
mirrors the `/compliance/summary` exemplar exactly).

**Verifier algorithm.** Walk `audit_log_entries` in `sequence_number` ASC. For each entry: (1) select the key
by that entry's `chain_version` (rotation-safe); (2) recompute `entry_hash` from the canonical serialization
and compare to the stored `entry_hash` → **content-tamper detection**; (3) assert `prev_hash` equals the
prior entry's stored `entry_hash` (genesis: assert against `GENESIS_PREV_HASH`) → **link-break detection**;
(4) assert `sequence_number` is contiguous (no gap vs. the prior entry's sequence + 1) → **deletion/gap
detection** at the specific break point. Return `{ ok, entriesChecked, firstBreakAt?, reason? }` at the first
break (report the offending `sequence_number` + a machine-stable `reason`). Empty log → `{ ok: true,
entriesChecked: 0 }` (vacuously intact).

**Why walk-and-recompute (vs. store-a-running-verification-flag).** Recompute from source is the only
tamper-*evident* design — a cached "verified" flag is itself mutable and would be the first thing an attacker
flips. The verifier is deliberately stateless and derives its verdict purely from the (immutable) rows + the
env key. Cost is O(n) per verify; acceptable for MVP volumes and run on-demand (+ future background job per
security.md, out of this thin slice).

**Failure-domain impact.** New read-only endpoint behind existing RBAC; no write path, no new permission
model (reuses the guard). Detecting a break is a *reported* state, not an exception.

#### Δ4 — Compliance-settings integrity-view screen (block 031d79fc)

**What's new.** A new `(app)`-group route `apps/web/app/(app)/compliance/audit-log/page.tsx` rendering the
audit-log integrity view per `design/audit-log-export.html §Integrity Validation` + DESIGN-SYSTEM §10 (AppShell chrome inherited
from `(app)/layout.tsx`; zinc/emerald tokens). Consumes `GET /compliance/audit-log/verify`. Shows chain
status (verified / broken), entries count, last-verified, and a **"verify now"** action. A **broken chain is
a persistent, prominent compliance signal — NOT a dismissible toast** (AC): a fixed status banner/panel
showing `firstBreakAt` + reason that stays on screen.

**RBAC — `roleRoutes` update (nav ⊆ RBAC).** `packages/shared/src/rbac.ts` **already contains** a route entry
`{ pattern: '/compliance/audit-log', allowedRoles: ['compliance'] }` (present from wave-3) — but it has **no
`navItem`**, so the screen is currently unreachable from the sidebar. This wave **adds a `NAV_COMPLIANCE_SETTINGS`
nav item** (group `workspace` or `config` per §10; `allowedRoles: ['compliance']`) and attaches it to that
existing route entry, keeping the nav-item `allowedRoles` **identical** to the route entry's `allowedRoles`
(the file's invariant: same array reference → nav ⊆ RBAC by construction). Enforcement path: server layout
authenticates; `assertRole('/compliance/audit-log', me.role)` at the page top denies non-compliance (redirect
to `/`); the sidebar renders the item only for `compliance` via `navItemsForRole`.

> **Scope note — verify endpoint RBAC (compliance + admin) vs. settings screen (compliance only).** The spec
> gates the **verify endpoint** to `compliance` + `admin` (an admin can run an integrity check) but the
> **settings screen** to `compliance` (per the existing `/compliance/audit-log` entry + design). These are two
> different `roleRoutes` patterns: `/compliance/audit-log/verify` (endpoint, `['compliance','admin']`) and
> `/compliance/audit-log` (screen, `['compliance']`). B-1 adds the endpoint pattern and attaches the nav item
> to the screen pattern — both consistent with the pinned matrix; nav ⊆ RBAC preserved because the nav item
> hangs off the `['compliance']` screen entry, not the endpoint entry.

**Why a persistent panel over a toast.** Compliance evidence integrity is a standing state, not a transient
event — a toast that auto-dismisses would let a broken chain scroll off screen unacknowledged. The design
system already distinguishes standing status surfaces (AuditLogRow integrity indicator, ComplianceCheckPanel)
from ephemeral toasts; a broken chain uses the standing surface. (head-designer pack calls out
"non-dismissible compliance UI" explicitly.)

**Failure-domain impact.** New page segment inside the existing shell; no change to the shared layout or
other routes. One additive nav item + one additive `roleRoutes` endpoint pattern in the shared package.

---

### Data model

**New table — `audit_log_entries`** (`apps/api/src/db/schema/audit-log.ts`, additive; barrel-exported):

| column            | type / DDL                                             | notes |
|-------------------|--------------------------------------------------------|-------|
| `sequence_number` | `BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY`      | strict monotonic ordering + PK; DB-assigned, not app-assigned |
| `actor_user_id`   | `uuid NULL REFERENCES users(id) ON DELETE SET NULL`    | nullable — system/genesis events have no actor; SET NULL so user deletion never mutates/blocks an immutable row |
| `actor_role`      | `text NOT NULL`                                        | role at time of action (snapshot; not FK) |
| `action`          | `text NOT NULL`                                        | action enum (shared Zod), e.g. compose/approve/send/verify… (values land as callers wire in; column present now) |
| `resource_type`   | `text NOT NULL`                                        | audited object type |
| `resource_id`     | `text NULL`                                            | audited object id (nullable for non-object events) |
| `content_hash`    | `text NOT NULL`                                        | hash of communication payload — **kept DISTINCT from `payload_hash`** (AC) |
| `payload_hash`    | `text NOT NULL`                                        | hash of the structured event payload — distinct from `content_hash` |
| `prev_hash`       | `text NOT NULL`                                        | prior entry's `entry_hash`; genesis = `GENESIS_PREV_HASH` (64 hex zeros) |
| `entry_hash`      | `text NOT NULL`                                        | `HMAC-SHA256(key, canonical(content_hash‖payload_hash‖prev_hash‖sequence_number‖action‖resource‖actor‖created_at))` |
| `chain_version`   | `integer NOT NULL`                                     | = `AUDIT_LOG_HMAC_KEY_VERSION`; verifier selects key per entry (rotation) |
| `created_at`      | `timestamptz NOT NULL DEFAULT now()`                   | server clock |

Index: `sequence_number` is the PK (walk order). No additional index needed for MVP (verify walks the whole
chain in PK order).

**Migration strategy — additive + reversible.** New drizzle-kit migration `0002_*.sql`:
1. `CREATE TABLE audit_log_entries (...)` (drizzle-kit generated from the schema module).
2. **Raw-SQL appended** to the same migration (drizzle-kit emits table DDL; grant/trigger are hand-added,
   following the wave-2 precedent where the partial-unique index was hand-added to `0001_*.sql`):
   - `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log_entries FROM CURRENT_USER;`
   - `GRANT INSERT, SELECT ON audit_log_entries TO CURRENT_USER;`
   - `CREATE FUNCTION audit_log_block_mutation() RETURNS trigger … RAISE EXCEPTION …;`
   - `CREATE TRIGGER audit_log_no_mutate BEFORE UPDATE OR DELETE ON audit_log_entries FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();`
3. **Down-migration `0002_*.down.sql`** drops **only** the new objects (trigger → function → table); no
   existing table, grant, or trigger touched. Additive-only; re-run idempotent (`IF NOT EXISTS` / `OR REPLACE`
   where drizzle allows; trigger guarded with `DROP TRIGGER IF EXISTS` before create in the forward file if
   re-run safety is needed).

No existing tables/columns changed. `users`/`roles`/`invites`/`app_meta` untouched.

---

### API contracts (concrete)

#### `GET /compliance/audit-log/verify`

- **Method / path:** `GET /compliance/audit-log/verify`
- **Auth:** authenticated session (SuperTokens) **AND** `@Roles(...rolesForRoute('/compliance/audit-log/verify'))`
  → `['compliance', 'admin']` via the wave-3 `RolesGuard` (DB-authoritative role). Guard order:
  `SessionGuard` (401 anon) → `RolesGuard` (403 wrong role). Roles sourced from the shared `roleRoutes` map,
  **never hardcoded** (mirrors the `/compliance/summary` exemplar; module-load non-empty assertion for
  fail-closed-on-drift).
- **Request:** no body, no params (verifies the whole chain for MVP).
- **Response 200 (shared Zod `auditVerifyResponseSchema` in `@dealflow/shared`):**
  ```jsonc
  {
    "ok": true,              // boolean — chain intact
    "entriesChecked": 42,    // int >= 0
    "firstBreakAt": 17,      // optional bigint (sequence_number) — present only when ok=false
    "reason": "content-hash-mismatch" // optional enum-ish string — present only when ok=false
                                       // one of: content-hash-mismatch | prev-hash-mismatch | sequence-gap
  }
  ```
  Empty log → `{ ok: true, entriesChecked: 0 }`.
- **Errors:** `401` unauthenticated (no session); `403` authenticated wrong role (advisor/analyst) — NestJS
  `ForbiddenException` default body, no data/role leak.
- **Idempotency / retry:** pure read, side-effect-free, safely retryable. (The self-audit "verification-is-
  itself-an-audit-event" behaviour from security.md is **deferred** — this wave builds the read-only verifier;
  writing a verify-result audit event needs the append service wired to a real call-site, an M6+ concern.)

#### Append call-sites — is anything actually audited this wave?

**No real audited business action is wired this wave.** The append service + verifier are **built and tested
standalone**: unit + integration tests open a Drizzle transaction and call `AuditService.append(evt, tx)`
directly to exercise genesis, chaining, atomicity, concurrent-append serialization, and then the verifier
detects seeded tampering (content edit via a privileged/bypass path, deletion, reorder) and passes an
untampered chain. **Real call-site integration** (auditing compose/approve/send/gate/suppression events) is
**M6+** (compliant-outreach milestone) — stated explicitly here and in the spec (P-0 thin-slice guardrail;
rules engine + pre-send gate deferred). The transactional `append(entry, tx)` API is designed now so those
later call-sites compose it into their business transaction without re-plumbing.

---

### Dependencies

**No new third-party dependency. Confirmed.** HMAC-SHA256 is provided by **`node:crypto`**
(`createHmac('sha256', key)`) — a Node.js built-in, already available in the NestJS runtime; the spec's
`sdk: ["node:crypto createHmac('sha256', key)"]` is a built-in, not an external SDK. Therefore **no external
SDK integration and no `external-sdk-integration-rules.md` pre-build checklist applies** (Action 4 / Action 8
item 8: N/A — no external SDK). Existing deps reused: `drizzle-orm` + `pg` (data access + migrations), `zod`
(shared contracts), `@nestjs/*` (module/guards), the wave-3 `RolesGuard`/`SessionGuard`, `next` (App Router),
`lucide-react` (nav icon).

---

## PLAN

File-level steps grouped by B-stage. Specialists validated against `command-center/AGENTS.md` +
`process/session/.capability-sheet.md` (all six present: `postgres-pro`, `security-engineer`,
`backend-developer`, `nextjs-developer`, `typescript-pro`, `test-automator`).

### B-1 — Contracts (shared types + RBAC matrix)

| # | Path | Op | What changes | Specialist | Order |
|---|------|----|--------------|-----------|-------|
| 1.1 | `packages/shared/src/audit.ts` | create | Shared Zod + types: `auditActionEnum`, `auditEntrySchema` (the append input shape: actor, role, action, resource_type/id, content_hash, payload_hash), `auditVerifyResponseSchema` (`{ ok, entriesChecked, firstBreakAt?, reason? }`) + `AuditVerifyResponse`, `auditBreakReasonEnum` (content-hash-mismatch \| prev-hash-mismatch \| sequence-gap), `GENESIS_PREV_HASH` constant | `typescript-pro` | parallel batch B1 |
| 1.2 | `packages/shared/src/rbac.ts` | modify | (a) ADD route entry `{ pattern: '/compliance/audit-log/verify', allowedRoles: ['compliance','admin'] }`; (b) ADD `NAV_COMPLIANCE_SETTINGS` nav item (`allowedRoles: ['compliance']`) and attach it to the EXISTING `/compliance/audit-log` entry (same array ref → nav ⊆ RBAC). Add to `ALL_NAV_ITEMS`. | `typescript-pro` | parallel batch B1 |
| 1.3 | `packages/shared/src/index.ts` | modify | Barrel-export the new audit types/schemas/const from `audit.ts` | `typescript-pro` | serial after 1.1 |

### B-2 — Backend (schema/migration + service + verifier + endpoint)

| # | Path | Op | What changes | Specialist | Order |
|---|------|----|--------------|-----------|-------|
| 2.1 | `apps/api/src/db/schema/audit-log.ts` | create | Drizzle `audit_log_entries` table (columns per Data model): `sequence_number` bigint identity PK, nullable `actor_user_id` FK→users ON DELETE SET NULL, `actor_role`, `action`, `resource_type`, `resource_id`, `content_hash`, `payload_hash` (distinct), `prev_hash`, `entry_hash`, `chain_version` int, `created_at` timestamptz | `postgres-pro` | serial head of B2 |
| 2.2 | `apps/api/src/db/schema/index.ts` | modify | Add `export * from './audit-log';` to the barrel (drizzle-kit sees the new table) | `postgres-pro` | serial after 2.1 |
| 2.3 | `apps/api/src/db/migrations/0002_*.sql` | create | drizzle-kit generated CREATE TABLE + **hand-appended** REVOKE UPDATE/DELETE/TRUNCATE + GRANT INSERT/SELECT to `CURRENT_USER` + `audit_log_block_mutation()` function + `BEFORE UPDATE OR DELETE` trigger (immutability for every role incl. superuser) | `postgres-pro` | serial after 2.2 |
| 2.4 | `apps/api/src/db/migrations/0002_*.down.sql` | create | Drops ONLY the new trigger → function → table (additive-reversible; nothing existing touched) | `postgres-pro` | serial after 2.3 |
| 2.5 | `apps/api/src/modules/audit/audit-hash.ts` | create | Pure crypto: canonical serialization (fixed field order, versioned) + `entry_hash = HMAC-SHA256(key, canonical)` via `node:crypto createHmac`. No I/O, no key storage. | `security-engineer` | parallel batch B2b |
| 2.6 | `apps/api/src/modules/audit/audit.keyring.ts` | create | Env key resolution + **boot fail-fast assert** `AUDIT_LOG_HMAC_KEY` present (SuperTokens-assert pattern); `chain_version → key` map keyed by `AUDIT_LOG_HMAC_KEY_VERSION`; never logs/persists the key | `security-engineer` | parallel batch B2b |
| 2.7 | `apps/api/src/modules/audit/audit.repository.ts` | create | Drizzle DA: read chain tail (for prev_hash + sequence contiguity), insert entry — both accept a `tx` handle | `backend-developer` | serial after 2.1 |
| 2.8 | `apps/api/src/modules/audit/audit.service.ts` | create | `AuditService.append(entry, tx)`: `pg_advisory_xact_lock` (single-chain serialization) → read tail → genesis-or-link prev_hash → compute entry_hash (2.5) with key (2.6) → insert (2.7), all in the caller's tx (write atomicity) | `security-engineer` | serial after 2.5/2.6/2.7 |
| 2.9 | `apps/api/src/modules/audit/audit.verifier.ts` | create | Walk in sequence order; recompute entry_hash (key by entry's chain_version) + compare; check prev_hash link + sequence contiguity; return `{ ok, entriesChecked, firstBreakAt?, reason? }`; empty→ok | `security-engineer` | serial after 2.5/2.6/2.7 |
| 2.10 | `apps/api/src/modules/audit/audit.module.ts` | create | NestJS module: providers (keyring, repository, service, verifier), imports `AuthModule` (for `SessionGuard`/`RolesGuard`/`AuthRepository` in consuming context — mirrors ComplianceModule DI-boot lesson), exports `AuditService` + verifier | `backend-developer` | serial after 2.5–2.9 |
| 2.11 | `apps/api/src/modules/compliance/audit-log.controller.ts` | create | `GET /compliance/audit-log/verify` → `@UseGuards(SessionGuard, RolesGuard) @Roles(...rolesForRoute('/compliance/audit-log/verify'))` (module-load non-empty assert), calls verifier, returns `AuditVerifyResponse`. Mirrors `compliance.controller.ts` exemplar exactly. | `security-engineer` | serial after 2.9 + 1.2 |
| 2.12 | `apps/api/src/modules/compliance/compliance.module.ts` | modify | Register `AuditLogController`; import `AuditModule` so the verifier resolves | `backend-developer` | serial after 2.10/2.11 |
| 2.13 | `apps/api/src/app.module.ts` | modify | Register `AuditModule` (+ ensure `ComplianceModule` still imported) so the new controller/service boot | `backend-developer` | serial after 2.10 |

### B-3 — Frontend (compliance-settings integrity screen + nav)

| # | Path | Op | What changes | Specialist | Order |
|---|------|----|--------------|-----------|-------|
| 3.1 | `apps/web/app/(app)/compliance/audit-log/page.tsx` | create | Server component in the `(app)` group; `assertRole('/compliance/audit-log', me.role)` (compliance-only, redirect `/` on deny); fetches `GET /compliance/audit-log/verify` (cookie-forwarded, no-store); renders integrity view per `design/audit-log-export.html §Integrity Validation` + §10 tokens: chain status (verified/broken), entries count, last-verified, "verify now" action; **broken chain = persistent non-dismissible panel** (firstBreakAt + reason), NOT a toast | `nextjs-developer` | parallel batch B3 (after B1 shared build) |
| 3.2 | `apps/web/app/(app)/compliance/audit-log/_components/IntegrityPanel.tsx` | create | Client component for the "verify now" action + status rendering (verified-OK / broken states); consumes `AuditVerifyResponse` shared type; standing status surface (design-system integrity indicator, not toast) | `nextjs-developer` | serial after 3.1 |

> Nav item appears automatically in the sidebar for `compliance` via `navItemsForRole` once B-1 step 1.2
> lands (no per-page nav wiring — `Sidebar.tsx`/`AppShell.tsx` read `roleRoutes`/`navItemsForRole`; no
> frontend nav file edit needed → nav ⊆ RBAC preserved by construction).

### B-5 — Wiring

| # | Path | Op | What changes | Specialist | Order |
|---|------|----|--------------|-----------|-------|
| 5.1 | Env (`.env.example` already has `AUDIT_LOG_HMAC_KEY` + `_VERSION`) | verify | Confirm placeholders present (they are); real value generated via `openssl rand -base64 32` + set in Railway per service (always-on rule 6) at deploy — **not committed**. No code change; keyring (2.6) reads env. | orchestrator | after B2 |
| 5.2 | Type-check / barrel fixups across `apps/api` + `apps/web` + `packages/shared` | modify | Resolve any TS import/type breakages introduced by the new shared exports | `typescript-pro` | last, after B2/B3 |

> **Tests** (unit / integration / RBAC-matrix / immutability) are authored in the **T-block** (T-1..T-8) per
> the wave loop, routed to `test-automator` + `security-engineer` (T-8 Security). Immutability tests
> (app-role UPDATE/DELETE rejected; privileged UPDATE/DELETE trigger-blocked), append-atomicity,
> concurrent-append single-chain, genesis, gap-detection, verifier-detects-tampering, and the
> endpoint 401/403/200 RBAC matrix all land there. Listed here for traceability; B-block delivers the code
> those tests target.

### Specialist routing (validated against AGENTS.md + capability sheet)

- `typescript-pro` — shared Zod/types + rbac.ts matrix + type-check fixups. ✅ present.
- `postgres-pro` — table schema + migration + grant + trigger + down. ✅ present.
- `security-engineer` — HMAC crypto core, keyring/fail-fast, append service, verifier, RBAC-guarded endpoint (security-critical surface). ✅ present.
- `backend-developer` — module wiring / DI / repository / app-module registration. ✅ present.
- `nextjs-developer` — compliance-settings integrity screen + client panel. ✅ present.
- `test-automator` — T-block test authoring (referenced, not B-block). ✅ present.

No missing specialist → no agent-creator route needed.

### Parallelization map

- **B-1:** parallel batch B1 = {1.1 `audit.ts`, 1.2 `rbac.ts`} (independent files, different concerns).
  Serial: 1.3 barrel after 1.1.
- **B-2:** serial chain head = 2.1 → 2.2 → 2.3 → 2.4 (schema → barrel → migration → down; migration depends on
  the finalized schema). Parallel batch B2b = {2.5 `audit-hash.ts`, 2.6 `audit.keyring.ts`} (independent pure
  modules) + 2.7 `audit.repository.ts` (depends only on 2.1 schema). Serial: 2.8 service + 2.9 verifier after
  {2.5,2.6,2.7} → 2.10 module → {2.11 controller (also needs 1.2), 2.12 compliance-module, 2.13 app-module}.
- **B-3:** parallel batch B3 = {3.1 page} after B-1 shared package builds; 3.2 panel serial after 3.1.
- **B-5:** 5.1 (env verify) after B2; 5.2 (type-check) last.
- No file appears in two parallel batches (checked).

### Self-consistency sweep (Action 8)

1. **Every AC → ≥1 step.**
   - *ec1f279d (table/immutability):* additive migration + columns → 2.1/2.3; INSERT+SELECT-only grant → 2.3;
     BEFORE UPDATE/DELETE trigger blocking every role → 2.3; additive + down drops only new objects →
     2.3/2.4. ✅
   - *a8b2b5a2 (HMAC service):* entry_hash HMAC-SHA256 + chain → 2.5/2.8; genesis anchor → 1.1
     (`GENESIS_PREV_HASH`)/2.8; key from env never DB/logs + fail-fast + chain_version rotation → 2.6; write
     atomicity (same-tx composable) → 2.8 (`append(entry, tx)`); concurrent single chain → 2.8 (advisory
     lock); threat-model boundary documented → Δ2 (this doc, carried into code comments). ✅
   - *e6a4cbfe (verifier + endpoint):* walk + recompute + prev_hash link → 2.9; gap/deletion detection → 2.9;
     RBAC-guarded endpoint (compliance/admin, 401/403) → 2.11 + 1.2; detects seeded tampering → T-block tests
     targeting 2.9. ✅
   - *031d79fc (screen):* `(app)` route + RBAC compliance per roleRoutes + nav → 3.1 + 1.2; consumes verify
     endpoint → 3.1/3.2; broken = persistent non-dismissible signal → 3.1/3.2; design-system + AppShell →
     3.1 (inherited layout). ✅
2. **Every file-level step has a specialist.** ✅ (table above).
3. **No file in multiple parallel batches.** ✅.
4. **`design_gap_flag` referenced:** **false** — `design/audit-log-export.html §Integrity Validation` + DESIGN-SYSTEM §10 exist;
   integrity view rendered against them, no new design needed (no D-block).
5. **Architecture deltas have explicit alternative trade-offs.** ✅ (Δ1 grant-vs-trigger-vs-separate-role;
   Δ2 advisory-lock vs FOR UPDATE; Δ3 recompute vs cached-flag; Δ4 persistent-panel vs toast).
6. **Data + API contracts concrete, no TBD.** ✅ (full DDL table + `GET /compliance/audit-log/verify`
   req/resp/status/RBAC).
7. **New deps justified.** ✅ — none (node:crypto built-in); no external SDK.
8. **SDK pre-build checklist:** **N/A** — no external SDK (node:crypto is a Node built-in). Confirmed.

**Four sharpening notes coverage:** (1) threat-model boundary → Δ2 documented + carried to code; (2) key in
env never DB → 2.6 keyring; (3) genesis + gap-detection → 1.1/2.8 (genesis) + 2.9 (gap); (4) write atomicity →
2.8 (`append(entry, tx)` tx-composable). All four covered. Concurrent-append single chain, genesis, gap
detection, key-in-env, threat-boundary, append-atomicity — all present. Additive-schema + no-new-SDK
confirmed. **Sweep clean.**

---

## P-4 remediation (jenny Phase-2 BLOCK → resolved; plan-correction, no AC-substance change)
1. **Δ4 integrity-view screen RETARGETED (finding 4b, HIGH):** route `/compliance/audit-log` (NOT `/compliance/settings`) + design `design/audit-log-export.html` §Integrity Validation (NOT compliance-settings.html — that is the DEFERRED Rules Engine, journey row 17, zero integrity UI). Matches journey-map row 16 "Audit-log service". B-1 attaches the new nav item to the `/compliance/audit-log` roleRoutes entry (currently `['compliance']`, no navItem). Persona pinning identical (compliance-only). `/compliance/settings` Rules-Engine screen stays deferred.
2. **Self-consistency sweep item 4 CORRECTED:** the "integrity view rendered against design/compliance-settings.html" claim was FALSE (that file has no integrity UI) → now `design/audit-log-export.html` §Integrity Validation.
3. **chain_version pins BOTH key-version AND canonical-serialization-order-version (item 1):** B-block adds a code comment + a T-8 golden-vector test asserting serialization field-order stability.
4. **Same-tx write chosen over outbox (item 6):** append(entry, tx) is the write-atomicity mechanism this wave; security.md's outbox fallback is documented + deferred to async-sourced call-sites (M6+).
