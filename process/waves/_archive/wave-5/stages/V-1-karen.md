# V-1 Karen — Wave 5 (Compliance rules engine + non-bypassable pre-send gate)

**Reviewer:** Karen (Reality/Completion) — source-claim verification only (jenny owns spec-semantics).
**Scope:** Verify load-bearing CLAIMS are TRUE in the DEPLOYED state. Compliance/SoD-critical → strict.
**Repo:** main @ bdf8849 (3 commits after deployed 13e55ef are docs/test-only — no source drift on the compliance path).
**Live:** api https://dealflow-api-production-66d4.up.railway.app · web https://dealflow-web-production-a4f7.up.railway.app
**Deployed version (live /health):** `{"status":"ok","db":"ok","version":"13e55ef"}` — matches declared deploy hash.

## VERDICT: **APPROVE**

Every load-bearing claim verified true against on-disk source AND/OR live deployed state. The compliance wedge invariant (SoD = compliance ONLY, null-approver fail-closed), non-bypassability, keyless content-hash binding, in-tx audit, FK-safe actor, and anti-CSRF enforcement are all real. The gate is honestly scoped as a callable-contract-not-yet-called (M6 dependency), not over-claimed as a live send path. No done-theater found.

---

## Findings (claim → evidence)

### 1. Files exist + real — PASS
All 15 target files present with real content. `apps/api/src/db/schema/compliance-rules.ts` (338L, 4 tables + 3 pgEnums); migration `0003_giant_outlaw_kid.sql` present with 4 CREATE TABLE + 3 hand-appended partial-unique indexes; all `compliance-gate/` service + 4 evaluators present; all `compliance/` CRUD controllers+services present; `packages/shared/src/compliance-gate.ts` present; `apps/web/app/(app)/compliance/settings/page.tsx` + `_components/` present.
- NOTE: the supertokens config lives at `apps/api/src/modules/auth/supertokens.config.ts` (prompt cited `src/config/` — path differed, file is real and correct).

### 2. SoD = compliance ONLY (the wedge invariant) — PASS
`evaluators/sod.evaluator.ts`:
- `const SOD_APPROVER_ROLE = 'compliance' as const` (L41); block at L95 `if (approval.approverRole !== SOD_APPROVER_ROLE)` → `invalid-approver-role`. admin is NOT accepted.
- Approver identity from **stored row** via `repo.loadApproval(tx, ...)` (L48), never from ctx (documented L16-22; ctx carries only sender identity).
- sender≠approver: L85 `if (approval.approverUserId === ctx.senderUserId)` → `sender-is-approver`.
- **null-approver fail-closed (B-6 fix): L71** `if (approval.approverUserId === null)` → BLOCK `approver-unknown` BEFORE the self-approval check — a deleted approver (FK ON DELETE SET NULL) can no longer prove sender≠approver, so it is blocked regardless of the stored role snapshot. Migration confirms `approver_user_id uuid` (nullable) + FK `ON DELETE set null` (`confdeltype` path in schema), making this path load-bearing.
- revoked approval (`status !== 'approved'`) → blocked (L56); no approval row → `no-approval` (L51).

### 3. Non-bypassable — PASS
`compliance-gate.service.ts`:
- `evaluate(ctx, tx)` is **2-param** — no skip/dryRun/skipChecks param (L80).
- **gateContextSchema.parse(ctx) is the FIRST statement (L89)** — the B-6 ctx-validation fix; malformed ctx throws → tx rolls back, no verdict.
- Evaluators are a **private readonly const** array (L59-64) iterated unconditionally in fixed order (L95); no subset path, no independent evaluator entry point.
- **Audit-in-tx before return: L116** `await this.audit.append(this.verdictAuditEntry(parsed, verdict), tx)` — same tx, AFTER verdict, BEFORE return (L118). Append-throw rolls back tx; no verdict without its audit entry.
- Evaluators have NO HTTP surface (verified: no controller imports `ComplianceGateService`; module exports it for M6 only). Honestly scoped as callable contract — non-bypassability is structural, not over-claimed as a live send path.

### 4. Content-hash — PASS
`content-hash.ts`: `computeContentHash` uses `createHash('sha256')` (keyless, NOT createHmac) over `canonicalizeContent` (CRLF→LF, strip trailing newline, trim). `content-hash.evaluator.ts` RECOMPUTES from `ctx.content` (does NOT trust `ctx.contentHash`) and blocks `content-hash-mismatch` unless it matches the **stored** `approval.contentHash` → post-edit re-block. Migration: `content_hash text NOT NULL` on `compliance_approvals`.

### 5. CRUD audited in-tx + FK-safe actor + RBAC — PASS
- Every mutation audits in-tx via `AuditService.append(_, tx)` inside `db.transaction` (suppression.service create L88 + delete L115; rules.service 3 append sites; disclaimers.service 2 append sites). Audit-fail rolls back the mutation.
- **C-2 FK fix confirmed in all 3 controllers:** `const appUser = await this.authRepository.getUserWithRole(session.getUserId())` (suppression L74, rules L83, disclaimers L75) — actor is the FK-safe `users.id`, NOT raw `session.getUserId()`. **Verified LIVE:** `createdBy` on live 201 responses is a valid app users.id UUID (`f035dca8…`), no FK violation.
- RBAC `@Roles(...)` (compliance/admin) on every mutation endpoint.

### 6. anti-CSRF (T-5 fix) — PASS
`supertokens.config.ts` L145 `antiCsrf: 'VIA_CUSTOM_HEADER'` (NOT VIA_TOKEN, NOT NONE — comment L131 explicitly rejects NONE). `apps/web/app/(app)/_lib/apiFetch.ts`: `ANTI_CSRF_HEADER = 'rid'`, `ANTI_CSRF_VALUE = 'anti-csrf'`, injected on every call (L38-40). **Verified LIVE:** signup `front-token` JWT carries `antiCsrfToken:null` — confirms VIA_CUSTOM_HEADER live (api not minting a token).

### 7. LIVE HTTP matrix (independently reproduced by Karen — fresh unique-email role users via /auth/invite→/auth/signup, cookie jars, web-origin proxy) — PASS
| Test | Expected | Observed |
|---|---|---|
| compliance POST /compliance/suppression WITHOUT rid | 401 (CSRF enforced) | **401** `{"message":"Unauthorized"}` |
| compliance POST WITH `rid: anti-csrf` | 201 | **201** real row, `createdBy` valid users.id |
| advisor POST (with rid) | 403 | **403** Forbidden |
| analyst POST (with rid) | 403 | **403** Forbidden |
| admin POST (with rid) | 201 (admin MANAGES config) | **201** real row |
| unauth POST (with rid) | 401 | **401** Unauthorized |
| GET /compliance/settings (compliance) | 200 + 3 sections | **200** 27KB, Approval&Gating / Suppression / Jurisdiction all render |
| audit-log/verify before→after 1 config mutation | entriesChecked +1, ok:true | **24→25, ok:true both** — audited in-tx, hash-chain intact |
| disclaimer versioning (POST v1 then v2 same jurisdiction) | exactly 1 active | v1 active=false, v2 active=true → **active count = 1** (append-style, no in-place mutation) |

### 8. Deploy hash + migration + C-2 cross-check — PASS
- Live `/health` version == `13e55ef` (declared deploy hash). ✔
- Migration 0003: 4 tables (compliance_rules, suppression_list, disclaimer_templates, compliance_approvals) + 3 partial-unique indexes (`disclaimer_templates_jurisdiction_active_unique WHERE active=true`; `compliance_approvals_resource_approved_unique WHERE status='approved'`; `suppression_list_match_type_value_unique`). Live `/health db:ok` + all live CRUD/audit writes succeeding confirms migration applied on the app DB.
- **App-DB note:** `CLAUDOMAT_DB_URL` points to the brain DB (founder_bets/milestones/tasks/waves), NOT the DealFlow app DB (internal to Railway private network; no RAILWAY_TOKEN in this env). App-DB shape is therefore verified end-to-end via the live API (which exercises the real tables/indexes) rather than direct SQL — the correct available path.
- C-2 LIVE evidence cross-checked and genuine: C-2's SoD admin-approver-BLOCKED (`invalid-approver-role`) came from a one-off `evaluateStandalone` against the prod DB via a temporary Railway TCP proxy (documented as DELETED after use). This is consistent with my source review (definitive) and is the only viable proof path for the gate verdict, since the gate has no HTTP surface this wave. C-2's disclaimer 1-active and CSRF/RBAC claims independently reproduced above.

---

## Scope-honesty note (not a defect)
The SoD gate verdict itself is not HTTP-reachable this wave — the gate is a callable contract; the M6 outreach send path that CALLS `evaluate()` is out of scope and tracked as an M6 dependency (spec block-1 non-bypassability AC + P-0 reframe). This is honestly scoped, NOT over-claimed as "non-bypassable live send." The compliance-only SoD invariant, non-bypassability structure, and fail-closed paths are all present and correct in the deployed code; they will be enforced the moment M6 wires the send endpoint to the gate. Karen flags NO reality gap here — the wave claims exactly what it built.

**Findings: 8/8 PASS. VERDICT: APPROVE.**
