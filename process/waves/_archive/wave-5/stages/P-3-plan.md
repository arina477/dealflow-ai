# P-3 Plan — Wave 5: Compliance rules engine + non-bypassable pre-send gate (M2 enforcement layer)

> **Spec (authoritative):** `tasks.description` of seed `0595a835-db62-4685-b451-1cd6c06416bf` (4-block multi-spec). Convenience copy: `process/waves/wave-5/stages/P-2-spec.md`.
> **design_gap_flag: false** (all UI covered by `design/compliance-settings.html`, adopted wave-4; DESIGN-SYSTEM §10).
> **New external SDK: NONE.** Content hashing uses the built-in `node:crypto` (`createHash('sha256')`), aligned with the wave-4 audit hash discipline. Confirmed — Action 4 below.

---

## APPROACH SECTION

### Architecture delta Δ1 — 4 rules-engine tables (additive migration `0003`)

**What's new.** Four config tables in a new Drizzle schema file `apps/api/src/db/schema/compliance-rules.ts`, re-exported from `schema/index.ts`. Migration `0003_*` created by `pnpm db:generate` (drizzle DDL) + any hand-appended raw SQL, plus a reversible `0003_*.down.sql` — following the `0002` precedent exactly (drizzle-generated DDL first, then a `-- HAND-APPENDED` block for anything drizzle-kit cannot emit).

Tables (columns detailed in Data model below):
- `compliance_rules` — policy rows (`rule_type`, nullable `jurisdiction`, `config` jsonb, `enabled`, created_at/by).
- `suppression_list` — blocked recipients (`match_type` email|domain, `value`, `reason`, created_at/by).
- `disclaimer_templates` — jurisdiction-versioned disclaimer bodies (`jurisdiction`, `body`, `version` int, `active`, created_at/by).
- `compliance_approvals` — SoD + content-hash binding (`resource_type`, `resource_id`, `content_hash`, `approver_user_id` FK users, `approver_role`, `status` approved|revoked, created_at).

**Config-table vs immutable-audit distinction (load-bearing — confirmed).** These 4 tables are **mutable policy configuration**: they hold the *current* compliance posture and are edited over time (a rule toggled, a suppression entry removed, a disclaimer re-versioned). They are therefore **standard-DML tables** — the app role holds full INSERT/UPDATE/DELETE, and there is **NO immutability trigger and NO INSERT-only GRANT** on them. That machinery is reserved for `audit_log_entries` (wave-4), which is the **immutable evidence record**. The auditability guarantee for the config tables is different in kind: every mutation is **captured as an append to the immutable audit log** via `AuditService.append` in the same tx (Δ5). So: `audit_log_entries` = immutable, hash-chained, INSERT-only-granted, trigger-protected; the 4 rules tables = mutable, but every change is audited into that immutable log. Two distinct mechanisms, deliberately. Disclaimer edits are the one exception to plain UPDATE — they are **append-style versioned** (new row, `version+1`, prior `active=false`) so the historical disclaimer text a past approval was bound to remains resolvable (spec block-3 versioning edge case).

- **Alternative A — one polymorphic `compliance_policy(kind, json)` table.** Rejected: loses typed columns for the fields we filter/join on (`suppression_list.value`, `disclaimer_templates.jurisdiction`, `compliance_approvals.content_hash`), violating databases.md reuse-principle-5 (typed columns for queried fields, jsonb only for variable payloads). Suppression lookup and content-hash binding are hot query paths — they need indexed typed columns, not jsonb extraction.
- **Alternative B — reuse the wave-4 `audit_log_entries` table to also store live policy state.** Rejected: conflates the immutable evidence record with mutable current-state config; you cannot UPDATE an audit row to disable a rule (INSERT-only + trigger). The two concerns are structurally opposed — evidence is append-only history, policy is current mutable state. Keeping them separate is the whole point of the config-vs-audit split.
- **Failure-domain impact.** Additive-only: no existing table (users/roles/invites/app_meta/audit_log_entries) is touched — same guarantee `0002` gave. FK `compliance_approvals.approver_user_id → users.id` (`ON DELETE SET NULL`, matching the audit FK precedent so approver-user deletion never blocks/cascades a compliance record). No transaction-scope change to existing modules; the gate opens its own tx.

### Architecture delta Δ2 — `ComplianceGateService.evaluate(ctx): Promise<GateVerdict>` — the SOLE send-eligibility authority + non-bypassability

**What's new.** A new module `apps/api/src/modules/compliance-gate/` with `ComplianceGateService` exposing exactly **one public method**: `evaluate(ctx: GateContext): Promise<GateVerdict>`. This is the single server-side choke point mandated by security.md §Outreach-compliance-controls + §Reusability-principle-3 ("One compliance-gate service is the only send-eligibility authority").

`GateContext` (input) = `{ senderUserId, senderRole, recipients[], jurisdiction, content, contentHash, resourceType, resourceId }`.
`GateVerdict` (output, shared type) = `{ allowed: boolean, blocks: BlockReason[], requiredDisclaimers: string[] }`.

**How "non-bypassable" is made real for THIS wave** (honest, per P-0 problem-framer carry — not over-claimed):
1. **No skip param exists.** `evaluate()` takes only `ctx`. There is no `skipChecks`, no `dryRun`, no per-check boolean. Every call runs **all four evaluators** unconditionally.
2. **All-checks-always.** The four evaluators (Δ3–Δ4) are invoked on every call in fixed order; none is guarded by a caller-supplied flag. A block from any evaluator is accumulated into `verdict.blocks`; `allowed = blocks.length === 0 && requiredDisclaimers all satisfied`.
3. **Mandatory audit-in-tx (a verdict cannot exist without its audit entry).** `evaluate()` opens a tx, runs all evaluators (reading the config tables in that tx), then calls `AuditService.append(verdictEntry, tx)` **before the tx commits and before the method returns**. If the audit append throws, the whole tx rolls back and `evaluate()` throws — no verdict is returned. This reuses the exact wave-4 atomicity contract (`append(input, tx)` composes into the caller's tx; audited action and audit row commit or roll back together). There is no code path that produces a `GateVerdict` without its audit row.
4. **Default posture — allow-with-no-rules, still audited (per security.md).** If zero rules/suppression/approval apply, the gate returns `allowed:true` **but still runs every evaluator and still writes the audit entry**. Justification: security.md frames the gate as a re-run choke point whose *coverage* (every decision audited) is the non-negotiable invariant, not a blanket deny. A hard deny-by-default would make the gate un-testable in isolation this wave (no live rules seeded) and would misrepresent "no applicable rule" as "policy violation". The *hard blocks* are the ones the spec enumerates — suppression hit, missing/invalid SoD approval, content-hash mismatch, unsatisfied jurisdiction disclaimer. Absence of those = allow. The audit entry is written regardless, so "allowed with no rules" is itself a recorded, tamper-evident decision. **Note:** SoD (Δ3) means in practice a send is *not* allowed until a valid approval row exists — so the effective posture for a real send is "deny until approved", achieved through the SoD evaluator, not through a blanket gate default.

**THIS wave vs M6 (the honest boundary).** This wave delivers the gate as an **enforced callable contract**: when called, it is the single authority and cannot be partially run or run without audit. It does **NOT** claim a live send path exists. The M6 outreach send endpoint **MUST** call `evaluate()` before any send and block on `allowed:false` — that wiring is an **explicit M6 dependency**, tracked at P-4 so "non-bypassable" is not silently downgraded to "callable but uncalled" at V. This wave tests the gate standalone (unit + integration): all evaluators invoked every call, audit written every call, no skip path reachable.

- **Alternative A — evaluators as separate injectable services each callable independently.** Rejected: independent callability *is* a bypass surface (a caller could invoke only the suppression check). Composing them behind one `evaluate()` with no sub-entry points is what makes non-bypassability structural, not conventional.
- **Alternative B — gate as a NestJS guard/interceptor on the (future) send route.** Rejected for this wave: there is no send route yet (M6). A guard would have nothing to guard and would couple the gate to HTTP. A plain injectable service is testable standalone now and callable from the M6 service layer later — the right seam.
- **Failure-domain impact.** New permission-critical service; crosses into the audit module (composes into its tx). The evaluators read the 4 config tables inside the gate's tx, so a config read and the verdict audit are one atomic unit.

### Architecture delta Δ3 — SoD + suppression evaluators (block 2)

Two composable evaluator units under `compliance-gate/evaluators/`, both **server-side, both feeding the one verdict**:
- **`suppressionEvaluator(ctx, tx)`** — for each recipient, checks `suppression_list` by **exact-email match OR domain-suffix match** (recipient domain ends with a `match_type=domain` value). Any match → push a `suppression` `BlockReason` (HARD block, not advisory). Match logic is server-side SQL against the table read in the gate tx.
- **`sodEvaluator(ctx, tx)`** — reads the `compliance_approvals` row for `(resourceType, resourceId)` **server-side**. Blocks unless a row exists with: `status='approved'` AND `approver_user_id ≠ ctx.senderUserId` (sender≠approver) AND `approver_role === 'compliance' (SoD: admin NOT a valid approver per security.md §RBAC-SoD)` (validated against the M1 role set / RolesGuard authority — DB-authoritative role, never client). A sender approving their own content, an approval by a non-compliance role, or no approval row at all → `sod` `BlockReason`. **Approver identity comes only from the stored row** — never from `ctx` or any client field.

- **Alternative — trust an `approvedBy` field passed in `ctx`.** Rejected outright: that is the classic SoD bypass (client asserts its own approver). The approver MUST be read from the persisted approval row server-side. `ctx` carries only the *sender* identity (server-verified upstream); the approver is looked up.
- **Failure-domain impact.** SoD is the load-bearing compliance invariant; it reads `compliance_approvals` + validates role against the M1 authority. No new permission primitive — reuses the M1 role model (advisor/analyst/compliance/admin) via RolesGuard; the SoD APPROVER accepted set is narrowed to `compliance` only (admin excluded per security.md §RBAC-SoD).

### Architecture delta Δ4 — disclaimers + content-hash binding evaluators (block 3)

Two more composable evaluators, same one-verdict pattern:
- **`disclaimerEvaluator(ctx, tx)`** — resolves the **active** `disclaimer_templates` row for the recipient jurisdiction(s) (`active=true`, highest `version`). If a required disclaimer for that jurisdiction is not satisfied by the content, the gate **enforces** it: either a `disclaimer` `BlockReason` OR the disclaimer id is returned in `requiredDisclaimers[]` such that `allowed` stays false until satisfied. Multiple recipient jurisdictions → each enforced. Enforced, not advisory (spec block-3).
- **`contentHashEvaluator(ctx, tx)`** — the approval binds a `content_hash`. The gate **recomputes** the hash of `ctx.content` deterministically (see below) and compares to the approved `compliance_approvals.content_hash`. Mismatch → `content-hash-mismatch` `BlockReason`. This makes a post-approval edit invalidate the approval → re-block (the approval cannot be reused for modified/different content). Also re-evaluates against disclaimer-template version drift per the block-3 stale-version edge case.

**Content-hash algorithm (no new SDK).** `sha256(content)` hex, computed with `node:crypto`'s `createHash('sha256')`, over a **canonicalized** content string using the **same canonicalization discipline** as the wave-4 audit hash (`audit.hash.ts` — deterministic field/encoding rules, explicit-null sentinel, normalized whitespace). We factor a small shared canonicalizer or mirror the discipline in `compliance-gate/content-hash.ts` so the append-time hash and the gate-recompute hash are byte-identical for identical content. HMAC is **not** required here (this is content *binding*, not tamper-evidence of a chain — the audit log already provides keyed tamper-evidence for the *decision*); a plain keyless SHA-256 is the correct primitive for "same content ⇒ same hash" equality binding, and it must match whatever hash the approval-creation path stored.

- **Alternative — bind the approval to a row id / version number instead of a content hash.** Rejected: a version number can be reused if content is edited in place; the content hash is the only binding that *detects the edit itself*. security.md §Approval-workflow explicitly specifies "the gate compares a content hash of the approved version against the version being sent."
- **Failure-domain impact.** Pure computation over `ctx.content` + a config read; no external calls.

### Architecture delta Δ5 — compliance-settings CRUD (block 4) + screen wiring

**Backend.** CRUD controllers/services for the 3 config table families under the existing compliance module (`apps/api/src/modules/compliance/`), all `@Roles('compliance','admin')` via the M1 RolesGuard, resolved from the shared `roleRoutes` matrix (the `ComplianceController` fail-closed pattern is the exemplar — `rolesForRoute(...)` at module-eval, assert non-empty). **Every mutation** (create/update/enable/disable/delete a rule; add/remove a suppression entry; edit — i.e. re-version — a disclaimer) writes an audit entry via `AuditService.append(change, tx)` in the **same tx as the config write** — a config change cannot commit unaudited (spec block-4 edge case: audit-append fail ⇒ mutation fails).

**Frontend.** Wire `/compliance/settings` (Next.js) per `design/compliance-settings.html` — three sections: **Approval & Gating Policy** (compliance_rules), **Suppression Matrix** (suppression_list), **Jurisdiction Templates** (disclaimer_templates). `nextjs-developer`, DESIGN-SYSTEM §10 (zinc/emerald, lucide-react, 4px grid).

**roleRoutes / nav (nav⊆RBAC).** `/compliance/settings` **already exists** in `roleRoutes` (`['compliance']`, no navItem yet — verified `rbac.ts` L199–202). Deltas: (a) add a `NAV_SETTINGS_COMPLIANCE` navItem for `/compliance/settings` (`['compliance']`, workspace group, lucide icon e.g. `sliders`) so it appears in the sidebar; (b) add route entries for the new CRUD API patterns (e.g. `/compliance/rules`, `/compliance/suppression`, `/compliance/disclaimers`) with `allowedRoles: ['compliance','admin']`. The nav⊆RBAC invariant holds by construction (navItem.allowedRoles references the same array as the route entry). **Distinct from wave-4 `/compliance/audit-log`** — settings = mutable rules config surface; audit-log = immutable integrity view. Two different screens, deliberately.

- **Alternative — a single generic `/compliance/settings` PUT with a big blob body.** Rejected: loses per-mutation audit granularity (block-4 requires *each* change audited) and per-resource RBAC. Separate CRUD endpoints per family give clean audit events and Zod contracts.

---

### Data model (concrete — no TBD)

New file `apps/api/src/db/schema/compliance-rules.ts`; migration `0003_*` (additive) + `0003_*.down.sql` (drops the 4 tables + any enums; existing tables untouched). Naming per databases.md (snake_case plural, `id uuid default gen_random_uuid()`, `created_at timestamptz not null default now()`).

**`compliance_rules`**
| column | type | notes |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `rule_type` | text (pgEnum `compliance_rule_type`: `blocklist_check`/`disclaimer_required`/`approval_required`/`jurisdiction_check`) | typed for filtering |
| `jurisdiction` | text NULL | nullable — global rules have none |
| `config` | jsonb | variable rule params (reuse-principle-5) |
| `enabled` | boolean not null default true | |
| `created_by` | uuid FK users.id (ON DELETE SET NULL) | |
| `created_at` | timestamptz not null default now() | |
| `updated_at` | timestamptz | `.$onUpdateFn` |
- Index: `(rule_type, enabled)` (gate/CRUD filter path).

**`suppression_list`**
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `match_type` | text (pgEnum `suppression_match_type`: `email`/`domain`) | |
| `value` | text not null | normalized lower-case email or domain |
| `reason` | text NULL | |
| `created_by` | uuid FK users.id (SET NULL) | |
| `created_at` | timestamptz not null default now() | |
- Index: `(match_type, value)`; unique `(match_type, value)` (no dup entries). Suppression lookup is the hot path.

**`disclaimer_templates`**  (append-style versioned)
| column | type | notes |
|---|---|---|
| `id` | uuid PK | one row per version |
| `jurisdiction` | text not null | |
| `body` | text not null | disclaimer text |
| `version` | integer not null | monotonic per jurisdiction |
| `active` | boolean not null default true | exactly one active per jurisdiction (enforced in service; edit = insert v+1, deactivate prior) |
| `created_by` | uuid FK users.id (SET NULL) | |
| `created_at` | timestamptz not null default now() | |
- Index: `(jurisdiction, active)` + `(jurisdiction, version)`.

**`compliance_approvals`**
| column | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `resource_type` | text not null | e.g. `outreach` |
| `resource_id` | text not null | the approved object |
| `content_hash` | text not null | binds the approval to exact content (Δ4) |
| `approver_user_id` | uuid FK users.id (SET NULL) | the SoD authority — read server-side only |
| `approver_role` | text not null | role snapshot; ONLY 'compliance' is a valid SoD approver (admin excluded) |
| `status` | text (pgEnum `approval_status`: `approved`/`revoked`) not null | |
| `created_at` | timestamptz not null default now() | |
- Index: `(resource_type, resource_id, status)` (SoD lookup path).

**Migration strategy.** Additive/online (all-new tables, no backfill, no existing-column change) — zero-downtime like `0002`. Reversible `.down.sql` drops tables + pgEnums in dependency order. Drizzle-kit generates the DDL; any GRANT/constraint drizzle-kit can't emit goes in a `-- HAND-APPENDED` block (the `0002` convention). **No INSERT-only grant and no immutability trigger on these tables** (they are mutable config — the deliberate contrast with `audit_log_entries`).

---

### API contracts (concrete)

**Gate — internal service contract (NO HTTP surface this wave).**
- `ComplianceGateService.evaluate(ctx: GateContext): Promise<GateVerdict>` — **purely a service method**, not an endpoint. There is intentionally **no `POST /compliance/gate/evaluate` route this wave**: the gate's only consumer is the M6 send path (service-to-service), and exposing an HTTP evaluate now would create a callable surface with no send behind it and an RBAC ambiguity (who may "evaluate"?). It is exercised standalone via unit + integration tests (all evaluators run, audit written, no skip path). Shared types `GateContext` / `GateVerdict` / `BlockReason` live in `@dealflow/shared`.

**CRUD endpoints (block 4) — all `@Roles('compliance','admin')`, each mutation audited in-tx, Zod-validated (`.strict()`), request/response schemas in `@dealflow/shared`.**
| Method + path | Body (Zod) | Success | Auth |
|---|---|---|---|
| `GET /compliance/rules` | — | `Rule[]` | compliance/admin |
| `POST /compliance/rules` | `ruleCreateSchema` | `Rule` 201 | compliance/admin |
| `PATCH /compliance/rules/:id` | `ruleUpdateSchema` (incl. `enabled` toggle) | `Rule` | compliance/admin |
| `DELETE /compliance/rules/:id` | — | 204 | compliance/admin |
| `GET /compliance/suppression` | — | `SuppressionEntry[]` | compliance/admin |
| `POST /compliance/suppression` | `suppressionCreateSchema` | `SuppressionEntry` 201 | compliance/admin |
| `DELETE /compliance/suppression/:id` | — | 204 | compliance/admin |
| `GET /compliance/disclaimers` | — | `DisclaimerTemplate[]` | compliance/admin |
| `POST /compliance/disclaimers` | `disclaimerCreateSchema` | `DisclaimerTemplate` 201 | compliance/admin |
| `PATCH /compliance/disclaimers/:id` | `disclaimerUpdateSchema` (edit ⇒ new version, prior deactivated) | `DisclaimerTemplate` | compliance/admin |

- Error envelope: NestJS default (403 Forbidden carries no resource/role data — the `ComplianceController` deny-envelope precedent). Deny path: SessionGuard (401 anon) → RolesGuard (403 wrong-role).
- Idempotency: creates are non-idempotent (POST); toggles/edits are PATCH (idempotent on the target state). Suppression `(match_type, value)` unique constraint makes duplicate adds fail loudly rather than silently duplicate.

**Shared-schema delta (additive).** Extend `auditActionEnum` in `packages/shared/src/audit.ts` with the new compliance-decision action values — `gate-evaluate`, `rule-change`, `suppression-change`, `disclaimer-change` — so gate verdicts and config mutations carry typed action strings through `AuditService.append`. This is an **additive enum extension** (the DB `action` column is `text`, accepts any value; the Zod enum is the shared type-safety layer). No breaking change to existing audit callers.

---

### Dependency list

**NO new third-party dependency.** Confirmed:
- Content hashing → `node:crypto` `createHash('sha256')` (built-in, already used by `audit.hash.ts`). No `bcrypt`/`hash-wasm`/etc.
- Validation → existing `zod` + `@anatine/zod-nestjs` (already in the stack).
- ORM/DB → existing Drizzle + `drizzle-kit`.
- Audit → wave-4 `AuditService` (in-repo), reused, not re-installed.
- RBAC → M1 `RolesGuard` + `@Roles` (in-repo), reused.

**SDK pre-build checklist:** N/A — no external SDK introduced. (`claudomat-brain/rules/external-sdk-integration-rules.md` not triggered.)

---

## PLAN SECTION — file-level steps by B-stage

### B-1 — Contracts (`@dealflow/shared`)
| # | Path | Op | What | Specialist |
|---|---|---|---|---|
| 1.1 | `packages/shared/src/compliance-gate.ts` | create | `GateContext`, `GateVerdict {allowed, blocks[], requiredDisclaimers[]}`, `blockReasonEnum` (`suppression`/`sod`/`disclaimer`/`content-hash-mismatch`) — Zod + types | `typescript-pro` |
| 1.2 | `packages/shared/src/compliance-rules.ts` | create | Zod for rules/suppression/disclaimer CRUD requests+responses (create/update/entry shapes), pgEnum-mirroring enums | `typescript-pro` |
| 1.3 | `packages/shared/src/audit.ts` | modify | Extend `auditActionEnum` (+`gate-evaluate`,`rule-change`,`suppression-change`,`disclaimer-change`) — additive | `typescript-pro` |
| 1.4 | `packages/shared/src/rbac.ts` | modify | Add `NAV_SETTINGS_COMPLIANCE` navItem + route entries for `/compliance/rules`,`/compliance/suppression`,`/compliance/disclaimers` (`['compliance','admin']`); attach navItem to `/compliance/settings` | `typescript-pro` |
| 1.5 | `packages/shared/src/index.ts` | modify | Re-export all new types/schemas | `typescript-pro` |

*Serial within B-1 (all touch `@dealflow/shared`; 1.5 last). One specialist, ordered chain: 1.1→1.2→1.3→1.4→1.5.*

### B-2 — Backend (schema, migration, gate, evaluators, CRUD)
| # | Path | Op | What | Specialist |
|---|---|---|---|---|
| 2.1 | `apps/api/src/db/schema/compliance-rules.ts` | create | Drizzle schema: 4 tables + pgEnums + FKs + indexes (Data model above) | `postgres-pro` |
| 2.2 | `apps/api/src/db/schema/index.ts` | modify | Re-export the 4 new tables | `postgres-pro` |
| 2.3 | `apps/api/src/db/migrations/0003_*.sql` + `0003_*.down.sql` | create | `pnpm db:generate` DDL + hand-SQL if any + reversible down; additive, no existing table touched, NO immutability trigger/INSERT-only grant (mutable config) | `postgres-pro` |
| 2.4 | `apps/api/src/modules/compliance-gate/content-hash.ts` | create | Deterministic `sha256` content hash (node:crypto), canonicalization aligned w/ `audit.hash.ts` discipline | `security-engineer` |
| 2.5 | `apps/api/src/modules/compliance-gate/evaluators/suppression.evaluator.ts` | create | Exact-email OR domain-suffix hard block | `security-engineer` |
| 2.6 | `apps/api/src/modules/compliance-gate/evaluators/sod.evaluator.ts` | create | Reads `compliance_approvals` server-side; approver≠sender, role='compliance' ONLY (SoD approver; admin excluded) | `security-engineer` |
| 2.7 | `apps/api/src/modules/compliance-gate/evaluators/disclaimer.evaluator.ts` | create | Jurisdiction→active disclaimer resolution, enforced | `security-engineer` |
| 2.8 | `apps/api/src/modules/compliance-gate/evaluators/content-hash.evaluator.ts` | create | Recompute vs approved `content_hash`, block on mismatch | `security-engineer` |
| 2.9 | `apps/api/src/modules/compliance-gate/compliance-gate.service.ts` | create | `evaluate(ctx)` — runs ALL evaluators (no skip param), writes verdict via `AuditService.append(_, tx)` in-tx BEFORE return; allow-with-no-rules default | `security-engineer` |
| 2.10 | `apps/api/src/modules/compliance-gate/compliance-gate.module.ts` | create | NestJS module; imports AuditModule (for AuditService), DB | `security-engineer` |
| 2.11 | `apps/api/src/modules/compliance/rules.controller.ts` + `rules.service.ts` | create | Rules CRUD, `@Roles('compliance','admin')`, each mutation audited in-tx | `backend-developer` |
| 2.12 | `apps/api/src/modules/compliance/suppression.controller.ts` + `suppression.service.ts` | create | Suppression CRUD, audited in-tx | `backend-developer` |
| 2.13 | `apps/api/src/modules/compliance/disclaimers.controller.ts` + `disclaimers.service.ts` | create | Disclaimer CRUD (edit=re-version), audited in-tx | `backend-developer` |
| 2.14 | `apps/api/src/modules/compliance/compliance.module.ts` | modify | Register new CRUD controllers/services; import AuditModule | `backend-developer` |

*Order: 2.1–2.3 (schema+migration) FIRST — everything reads the tables. Then two parallel batches:*
- *Batch α (gate, `security-engineer`): 2.4→2.5,2.6,2.7,2.8 (evaluators parallel-ish) → 2.9→2.10.*
- *Batch β (CRUD, `backend-developer`): 2.11, 2.12, 2.13 parallel → 2.14 (module wiring, after all three).*
- *Both batches depend on B-1 contracts + 2.1–2.3 schema; α and β are independent of each other.*

### B-3 — Frontend (`/compliance/settings`)
| # | Path | Op | What | Specialist |
|---|---|---|---|---|
| 3.1 | `apps/web/app/compliance/settings/page.tsx` (+ section components) | create | Wire the 3 sections (Approval & Gating Policy, Suppression Matrix, Jurisdiction Templates) to the CRUD API per `design/compliance-settings.html`, DESIGN-SYSTEM §10 | `nextjs-developer` |
| 3.2 | `apps/web/...nav` (sidebar consumer) | modify (if needed) | Ensure `NAV_SETTINGS_COMPLIANCE` renders via `navItemsForRole` (derives from rbac.ts — likely no code change, just the shared delta) | `nextjs-developer` |

*Serial after B-1 (needs shared CRUD types) + B-2 (needs live endpoints). Single specialist.*

### B-5 — Wiring
| # | Path | Op | What | Specialist |
|---|---|---|---|---|
| 5.1 | `apps/api/src/app.module.ts` | modify | Register `ComplianceGateModule` | orchestrator (trivial) |
| 5.2 | type-check / biome fixers | modify | Cross-package type-check pass | `typescript-pro` if failures |

### Specialist routing (validated against AGENTS.md + capability sheet)
All present in both `command-center/AGENTS.md` (per-stack executors) and `process/session/.capability-sheet.md`:
`typescript-pro` ✓, `postgres-pro` ✓, `security-engineer` ✓ (gate/SoD/content-binding — v6 Security branch), `backend-developer` ✓, `nextjs-developer` ✓. `test-automator` ✓ available for T-block (unit/integration for the gate). No missing specialist → no agent-creator run needed.

### Parallelization map
- **B-1:** serial chain 1.1→1.2→1.3→1.4→1.5 (single shared package).
- **B-2:** 2.1→2.2→2.3 serial (schema/migration first). Then Batch α (gate: 2.4→{2.5,2.6,2.7,2.8}→2.9→2.10) ∥ Batch β (CRUD: {2.11,2.12,2.13}→2.14). α and β run in parallel (different files, different specialists, both depend only on B-1 + 2.1–2.3).
- **B-3:** serial after B-1 + B-2.
- **B-5:** after B-2/B-3.
- No file appears in two parallel batches (verified).

### Self-consistency sweep
1. **Every AC → ≥1 step:**
   - Block-1: 4 tables → 2.1–2.3; single `evaluate()` sole authority → 2.9; non-bypass (all checks + mandatory audit, no skip) → 2.9 (+evaluators 2.5–2.8, audit 2.9); every verdict audited in-tx → 2.9; default posture allow-with-no-rules → 2.9; audit-append-fail⇒rollback → 2.9. ✓
   - Block-2: suppression hard block → 2.5; SoD server-side approver≠sender, compliance role → 2.6. ✓
   - Block-3: jurisdiction disclaimers enforced → 2.7; content-hash binding recompute+block → 2.4+2.8; disclaimer versioning → 2.3 schema + 2.13. ✓
   - Block-4: CRUD rules/suppression/disclaimers → 2.11–2.13; each mutation audited → 2.11–2.13 (in-tx); RBAC compliance/admin, nav consistent → 1.4 + controllers; screen wired → 3.1; audit-fail⇒mutation-fail → 2.11–2.13; disclaimer edit=new version → 2.13. ✓
2. **Every step has a specialist:** ✓ (table columns above).
3. **No file in two parallel batches:** ✓.
4. **design_gap_flag referenced:** **false** (design/compliance-settings.html covers all UI).
5. **Architecture deltas with explicit alternative trade-offs:** ✓ (Δ1–Δ5 each name 1–2 rejected alternatives).
6. **Data + API contracts concrete, no TBD:** ✓.
7. **New deps justified:** none (node:crypto) — ✓.
8. **SDK pre-build checklist:** N/A (no external SDK) — ✓.

**Invariant coverage confirmed:** non-bypass (2.9 all-checks + mandatory in-tx audit, no skip param) ✓ · SoD server-side (2.6) ✓ · content-hash-bound approvals (2.4+2.8) ✓ · suppression hard-block (2.5) ✓ · disclaimers enforced (2.7) ✓ · every verdict + config-change audited via reused wave-4 `AuditService.append` in-tx (2.9, 2.11–2.13) ✓ · mutable config tables NOT immutable-triggered — distinct from audit log (Δ1, 2.3) ✓ · reuse M1 RBAC + wave-4 audit ✓ · additive migration + down (2.3) ✓ · no new SDK ✓ · roleRoutes CRUD patterns + nav, nav⊆RBAC (1.4) ✓.

**M6 dependency called out:** the outreach send path (M6, out of scope) MUST call `ComplianceGateService.evaluate()` before any send and block on `allowed:false`. This wave delivers the gate as an enforced callable contract only; there is no live send path. Tracked at P-4 so "non-bypassable" is not downgraded to "callable but uncalled" at V.

Sweep clean — no contradictions to reconcile before P-4.

---

## P-4 remediation (jenny Phase-2 BLOCK → resolved; SoD-strictness)
1. **SoD approver = `compliance` ONLY (finding 1, CRITICAL).** sod.evaluator (Δ3 / step 2.6): block unless compliance_approvals.approver_role === 'compliance' AND approver_user_id ≠ senderUserId. admin is NOT a valid SoD approver (security.md §RBAC-SoD: "no super-role shortcut around separation of duties"). Spec block-2 AC (task 95adac6c) corrected via the seed's P-4 remediation addendum. **UNCHANGED:** compliance-settings CRUD @Roles stays `compliance,admin` (admin MANAGES config — distinct from being a valid SoD APPROVER). B-6/T assert the evaluator restricts to compliance-only.
2. **databases.md staleness (finding 4, LOW):** as-built shapes supersede the databases.md sketch (content_hash from security.md:87); L-1/L-2 reconcile (non-blocking).
