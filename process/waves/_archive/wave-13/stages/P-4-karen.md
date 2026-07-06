# Wave 13 — P-4 Karen (claim-verification of spec + P-3 plan)

PLAN review (before build). Per-claim verdicts against real code.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | AuditVerifier.verifyChain() → {ok, entriesChecked, firstBreakAt?, reason?}; reasons [content-hash-mismatch\|prev-hash-mismatch\|sequence-gap]; empty→{ok:true,entriesChecked:0} | **VERIFIED** | `apps/api/src/modules/audit/audit.verifier.ts:52-121`; shape pinned in `packages/shared/src/audit.ts:258-277` (auditVerifyResponseSchema.strict); reason enum `audit.ts:17-21` |
| 2 | M2 AuditService.append(input, tx) last-in-txn (export_generated reuse target) | **VERIFIED** | `audit.service.ts:75` `append(input, tx)`; doc lines 7-16 (composes into caller tx, last-in-txn). AuditModule exports it: `audit.module.ts:39` |
| 3 | audit action column is TEXT not pgEnum → no DB migration | **VERIFIED (with correction)** | `db/schema/audit-log.ts:63` `action: text('action').notNull()`. NO DB migration ever needed. BUT the SHARED Zod `auditActionEnum` (`audit.ts:31`) IS an enum and REJECTS unknown values (`audit.test.ts:46-47`) — so `append({action:'export_generated'})` throws unless 'export_generated' is added to the enum additively. Plan B-1 lists this; but P-3 Action 2 / B-0's "maybe pgEnum → migration 0012" branch is a PHANTOM — there is no pgEnum, B-0 is a definite SKIP, and the required change is a shared-package enum add, not a migration. |
| 4 | audit_log_entries has sequence_number, prev_hash, entry_hash (+ actor, action, timestamp, **mandate association**) | **PARTIAL — mandate association WRONG** | Tamper-evidence cols VERIFIED: `sequence_number`(48), `prev_hash`(90), `entry_hash`(96), `actor_user_id`(57), `actor_role`(60), `action`(63), `created_at`(106), `resource_type`(66), `resource_id`(69). **There is NO mandate_id column.** Only `resource_type`/`resource_id`. |
| 5 | M1 getUserWithRole → app users.id (actor) | **VERIFIED** | `auth.repository.ts:154` (AuthRepository.getUserWithRole); reused across pipeline/sourcing/compliance |
| 6 | design/audit-log-export.html exists (design_gap_flag false) | **VERIFIED** | 641 lines present |
| 7 | Specialists backend-developer / typescript-pro / nextjs-developer in AGENTS.md | **VERIFIED (thin)** | backend-developer = first-class row `AGENTS.md:70`; typescript-pro + nextjs-developer appear only as parenthetical per-stack examples `AGENTS.md:91`. All three ARE spawnable agent types. Registration is thin but present. |
| 8 | Antipattern sweep | see below | |

## Antipattern sweep (claim 8)
- **Premature export?** NO — refuted by code: real producers write real rows (outreach.service `resourceType:'outreach'`, approval, pipeline, gate-evaluate, mandate-create). verifyChain is real. Genuine data exists. Not premature.
- **Fake reuse?** verifyChain is REAL and full-chain; plan correctly REJECTS scoped-slice-verify (structurally impossible) and verifies full chain + proves slice inside. No fake reuse on the verify path.
- **READ-emits-zero-audit-rows consistent?** YES — read/verify are pure repository reads (no AuditService.append); only export appends one row. Structurally sound.
- **Minor:** spec proposes a NEW `auditVerifyResponseSchema` in recordkeeping.ts "mirroring the REAL" one — the real schema already exists exported from `@dealflow/shared` (`audit.ts:277`). Re-export it; do not mirror (drift risk).

## THE load-bearing gap — mandate scoping has no schema backing
`mandate_id` filtering is in the read AC AND the export scope `{mandateId?}` (sibling 20c479db's headline "mandate-scoped verifiable recordkeeping package") AND the manifest. But audit_log_entries carries NO mandate_id. Mandate association is INDIRECT and per-event-type:
- mandate-create/mandate-configure: `resource_id` = mandate id (test fixture `resourceId:'mandate-123'`).
- outreach events: `resource_id` = outreachId (`outreach.service.ts:328-329`), mandate lives on the outreach row, NOT the audit row.
- pipeline / gate / approval: `resource_id` points at their own resource, mandate reachable only via a join.

A naive `WHERE resource_id = :mandateId` catches ONLY the mandate-* events and MISSES the outreach/pipeline/gate/approval entries for that mandate — i.e. a "mandate-scoped export" would silently omit most of the mandate's real activity. The plan (Action 3, export scope) lists `?mandateId` as if it were a column filter and never describes the derivation/join map. This is the one UNVERIFIED load-bearing claim.

Also: audit.repository has NO filtered/paginated read — only `readChainAscending()` (full chain). The recordkeeping module must build its own filtered read repository method (expected build work; flagged so it isn't assumed-reused).

## Verdict
Reuse spine (verifyChain shape, append last-in-txn, TEXT action = no migration, tamper-evidence columns, getUserWithRole, design, module exports) all VERIFIED. **One WRONG + one UNVERIFIED claim must be resolved at B-1 before build:**
1. **WRONG (claim 4):** "mandate association" column — does not exist. Define the mandate→audit-row derivation (which resource_type/resource_id map, or a documented join per event type) OR narrow the mandate-scope AC to what the schema can actually back. Determinism + completeness of a "mandate-scoped package" depends on this.
2. **CORRECTION (claim 3):** kill the phantom "pgEnum migration 0012" branch — B-0 is a definite SKIP; the only additive delta is 'export_generated' in the shared `auditActionEnum`.

Not blockers, address at B-1: re-export existing auditVerifyResponseSchema (no mirror); build filtered/paginated read in the new module's own repository.
