# Wave 13 — P-3 Plan (multi-spec: recordkeeping read+verify API + export package + page — M6 recordkeeping-export)

## Approach

### Action 1 — Architecture deltas
**New module `apps/api/src/modules/recordkeeping/`** (mirrors wave-11/12 module shape; a READ/VERIFY/EXPORT surface over the existing M2 audit log).
- **RecordkeepingService** — `listAsActor` (filterable/paginated/role-scoped read over audit_log_entries; READ-ONLY, emits ZERO audit rows) / `verifyChainAsActor` (delegates to the EXISTING AuditVerifier.verifyChain(); returns the real {ok,entriesChecked,firstBreakAt?,reason?}) / `exportAsActor` (assembles the deterministic package: in-scope entries+hashes + full-chain verify result + manifest; appends EXACTLY one export_generated audit row LAST-IN-TXN via M2 AuditService.append; actor=getUserWithRole app users.id).
  - *Alt considered:* re-implement chain verification in this module — REJECTED: reuse the existing AuditVerifier (single source of tamper-evidence truth; a fork = a second, drift-prone verifier). *Alt:* verify only the scoped slice — REJECTED: a hash-chain slice can't be verified in isolation; verify the FULL chain + prove the slice sits inside it (the spec's design).
- **RecordkeepingController** — GET /compliance/audit-log (read), GET /compliance/audit-log/verify, POST /compliance/audit-log/export. @Roles (compliance-reviewer/compliance-officer/audit-lead/admin; advisor own-outreach read + NO export). route-ordering static-before-dynamic; DrizzleError.cause.code unwrap.
- **Failure-domain:** read + verify = pure reads (no writes, no audit rows). export = one txn (reads chain read-only + appends one export_generated audit row last-in-txn, rollback-on-audit-fail). RBAC add: /compliance/audit-log routes.
- **Web:** /compliance/audit-log page (SSR-hydrated, per design/audit-log-export.html) — filter/sort table + integrity badge + export panel; role-scoped (advisor no export); read-only (no edit/delete); /compliance/audit-log-data proxy; apiFetch rid.
- **BOUNDARIES:** read-only over the immutable chain; NO schema change; NO email/webhook/LLM/send/new-SDK/credential.

### Action 2 — Data model
- **NO schema change; NO migration (B-0 = definite SKIP).** karen P-4 confirmed the DB `action` column is `text` (audit-log.ts:63) → `export_generated` needs NO migration. BUT the shared Zod `auditActionEnum` (audit.ts) rejects unknown values → `AuditService.append({action:'export_generated'})` throws until added to the shared enum — a **B-1 contract delta** (additive enum value), NOT a schema/migration. The "maybe pgEnum → migration 0012" branch is KILLED.
- **Mandate-scope derivation (karen P-4 WRONG fix — load-bearing):** `audit_log_entries` has NO `mandate_id` column, only `resource_type`/`resource_id`. Mandate-scoped read/export MUST resolve each row's mandate via a **per-resource_type derivation** (else it silently omits the mandate's outreach/pipeline/gate activity, catching only mandate-* rows — gutting the package): mandate-* events → `resource_id`=mandate; outreach events → `resource_id`=outreach.id → join `outreach.mandate_id`; pipeline events → `resource_id`=pipeline.id → join `pipeline.mandate_id`; gate/approval → via their resource's mandate. Defined precisely at B-1; must capture ALL producers' rows for the mandate. Time-range/actor/type are direct-column filters (clean). A NEW **filtered/paginated read repository method** is required — the existing `audit.repository` only has `readChainAscending()` (full-chain), NOT reusable for the filtered read.

### Action 3 — API contracts
- **GET /compliance/audit-log** (?mandateId&type&actor&from&to&limit&offset) → paginated entries (+ sequence_number/prev_hash/entry_hash); compliance/admin org-wide, advisor own; passthrough. READ-ONLY (asserts no audit row emitted).
- **GET /compliance/audit-log/verify** → {ok, entriesChecked, firstBreakAt?, reason?} (real AuditVerifier shape); compliance/admin.
- **POST /compliance/audit-log/export** (scope {mandateId?, from?, to?}) → deterministic downloadable package (entries+hashes + full-chain verify + manifest); appends export_generated audit row last-in-txn; compliance/admin only (advisor 403).
- Errors → Nest exceptions; DrizzleError.cause.code unwrap; read-passthrough.

### Action 4 — Dependencies
NONE new. Reuses drizzle/NestJS/Zod/Next + M2 AuditService + AuditVerifier + M1 RolesGuard/getUserWithRole. NO Anthropic, NO email SDK, NO new secret, NO new SDK. No external-SDK checklist.

## Plan (file-level steps)
**B-0 Schema** (backend-developer): **DEFINITE SKIP** — no table/column/migration change (action column is text; export_generated is a shared-enum value added at B-1, not a DB change).
**B-1 Contracts** (backend-developer/typescript-pro): shared/recordkeeping.ts (auditLogEntryReadSchema passthrough + listFilter/exportScope inputs .strict() + exportManifestSchema) — **RE-EXPORT the EXISTING `auditVerifyResponseSchema` from @dealflow/shared/audit.ts (do NOT mirror a new copy — drift risk, karen note)** + add `'export_generated'` to the shared `auditActionEnum` (additive) + rbac (/compliance/audit-log compliance-reviewer/compliance-officer/audit-lead/admin org-wide + advisor-own read, advisor NO export; + NAV; nav⊆RBAC) + confirm the mandate→audit-row derivation map (per resource_type) as a documented contract for B-2.
**B-2 Backend** (backend-developer): recordkeeping module {module,controller,service,repository,spec} — read (role-scoped filter + the mandate→audit-row DERIVATION per resource_type [join outreach/pipeline for their mandate; mandate-* via resource_id], new filtered/paginated repo method, READ-ONLY, zero-audit-row asserted) + verify (reuse AuditVerifier) + export (deterministic package + export_generated audit last-in-txn + actor-id); tx-scoped reads (rule 7); DrizzleError-unwrap; di-boot spec. Register in app.module. Reuse AuditModule (exports AuditService + AuditVerifier) + AuthModule.
**B-3 Frontend** (nextjs-developer): /compliance/audit-log page (filter/sort table + integrity badge [real verify shape] + export panel + role-scoped no-advisor-export + read-only) per design/audit-log-export.html; /compliance/audit-log-data proxy; SSR-hydrate; apiFetch rid; read-passthrough; NO send/AI/edit-delete affordance.
**B-4 Wiring** + **B-5 Verify** + **B-6 Review** (head-builder polices: read-only-no-audit-row, export-appends-exactly-one-last-in-txn, verify-uses-real-AuditVerifier, RBAC advisor-no-export, immutable-no-edit-delete, boundaries).

### Action 6 — Specialist routing (validated against AGENTS.md)
backend-developer (B-0/B-1/B-2), typescript-pro (B-1 if split), nextjs-developer (B-3). All present.

### Action 7 — Parallelization map
B-0(maybe-skip) → B-1 → B-2 (read+verify+export) → B-3 (page). Serial (B-3 consumes B-2). read/verify/export independently unit-testable; the export determinism + exactly-one-audit-row + read-no-audit-row are the key structural tests.

### Action 8 — Self-consistency sweep: CLEAN
Every AC → ≥1 step: read+verify (36a17c81 → B-1/B-2 + B-3 table/badge); export package + one-audit-row (20c479db → B-2 export + B-3 export panel); page (10ee0ec4 → B-3). design_gap_flag FALSE (audit-log-export.html). No new dep/SDK/secret; likely no migration (only a possible additive enum value). Wave-4..12 lessons embedded (M2 audit-last-in-txn + actor-id + DrizzleError-unwrap + tx-scoped-reads rule 7 + read-passthrough rule 5 + SSR-hydrate + page-route-collision-avoidance). Reuse the REAL AuditVerifier (no fork). Scope-held (real-verifier-shape + one-export-format v1).

```yaml
deps_new: []
schema_change: false   # action column is text (no migration); export_generated is an additive shared-enum value at B-1. B-0 = definite SKIP. Mandate-scope = per-resource_type derivation (no mandate_id column).
new_secret: false
new_sdk: false
specialists: [backend-developer, typescript-pro, nextjs-developer]
reuse: [M2 AuditService.append + AuditVerifier.verifyChain (the tamper-evidence authority), M1 RolesGuard/getUserWithRole, audit_log_entries (immutable), wave-3 AppShell, wave-5 apiFetch]
compliance_invariants: [read-only-zero-audit-rows, export-appends-exactly-one-last-in-txn, verify-reuses-real-AuditVerifier, advisor-no-export-RBAC, immutable-no-edit-delete, deterministic-export]
hard_boundaries: "read-only over the immutable hash-chain; NO credential/send/webhook/LLM/new-SDK; additive-only"
design_gap_flag: false
self_consistency: clean
```
