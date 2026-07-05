# V-1 Karen — Wave 11 (M6 compliant-outreach foundation) reality verdict

**Verdict: APPROVE**
**Merge commit:** main @ `af5b5d9` (code == `8d7ed8b` + docs chore)
**Deployed:** api `dealflow-api-production-66d4` `/health` → `{status:ok,db:ok,version:af5b5d9}`; web `dealflow-web-production-a4f7` (307→/login, auth guard).
**Scope of review:** the load-bearing CLAIMS of the wave, verified against the repo at the merge commit AND the deployed reality — not the diff.

Every one of the 7 claim clusters is TRUE with cited evidence. Zero contradicted claims. Findings below are enumerated as VERIFIED (confirmed true) or NOTE (true, with a reliance/nuance the reader should know). No REJECT-grade findings.

---

## CLAIM 1 — Files exist on main@af5b5d9 — VERIFIED

`git cat-file -e af5b5d9:<path>` succeeded for all 10 backend files:
- `apps/api/src/modules/outreach/{outreach.service,template.service,approval.service,outreach.controller,outreach-template.controller,outreach.repository,outreach.module}.ts` — all OK
- `apps/api/src/db/schema/outreach.ts` — OK
- `packages/shared/src/outreach.ts` — OK
- `apps/api/test/outreach-gate.e2e-spec.ts` — OK

Migrations present: `apps/api/src/db/migrations/0010_mighty_the_anarchist.sql` + `0010_mighty_the_anarchist.down.sql` + `meta/0010_snapshot.json`.

Web pages present (all three, page + client + test):
- `apps/web/app/(app)/outreach-templates/{page,_components/TemplatesLibraryClient,page.test}.tsx`
- `apps/web/app/(app)/outreach-composer/{page,_components/OutreachComposerClient,page.test}.tsx`
- `apps/web/app/(app)/compliance-queue/{page,_components/ComplianceQueueClient,page.test}.tsx`

**Evidence:** `git ls-tree -r --name-only af5b5d9`. No file claimed-but-missing.

## CLAIM 2 — Exports/functions exist — VERIFIED

Grepped the real files at af5b5d9:
- `OutreachService.composeAsActor` — `outreach.service.ts:96` (async, ST-id→app-id translation, tx-scoped).
- `TemplateService.isUsableForSend` — `template.service.ts:73`; `draftNewVersion` — `:177`; `listTemplates` calls `repository.listTemplatesWithVersions` — `template.service.ts:327` (repo method exists — `outreach.repository.ts`, used by e2e test C-2).
- `ApprovalService.grantApproval` — `approval.service.ts:69` (writes `compliance_approvals` via `insertComplianceApproval` at `:109`); `reject` — `:160` (revokes via `revokeComplianceApproval` at `:196`).
- `OutreachRepository.insertComplianceApproval` — `outreach.repository.ts:283`; `revokeComplianceApproval` — `:312`; `updateVersionApproval` — state-guarded: `.where(and(eq(id,versionId), eq(approvalStatus,'pending')))` + zero-rows → `ConflictException` (fail-closed M-2 concurrent-state guard). Not a blind UPDATE.

Shared contracts (`packages/shared/src/outreach.ts`): `outreachTemplateSchema:46`, `outreachTemplateVersionSchema:63` (with `approval_status`+`content_hash`+`approved_content_hash`), `templateCreateInputSchema:128`, `versionDraftInputSchema:156`, `approvalRequestInputSchema:176`, `outreachSchema:105`, `gateVerdictRecordSchema:92`. All present.

## CLAIM 3 — THE NON-BYPASSABLE GATE — VERIFIED (the load-bearing invariant)

**Exactly ONE executable assignment of `status='send_eligible'`**, gated solely on a passing `evaluate()` verdict:
- `outreach.service.ts:277`: `const outreachStatus = verdict.allowed ? ('send_eligible' as const) : ('blocked' as const);`
- Grep for `send_eligible` across the whole module returns only: this line, doc-comments, `outreach.repository.ts:506` (a TYPE literal `status: 'send_eligible' | 'blocked'`), and an `approval.service.ts:107` comment. No second assignment path.
- `verdict` originates ONLY from `this.complianceGateService.evaluate(gateContext, tx)` (`outreach.service.ts:~271`). There is no path that constructs `send_eligible` without that call.
- The version-binding and SoD **pre-checks short-circuit to hard-coded `status: 'blocked'`** WITHOUT calling `evaluate()` (documented, intentional — an incomplete/invalid context can't be gated). This does NOT weaken the invariant: the pre-checks can only produce `blocked`, never `send_eligible`. The claim "`send_eligible` gated solely on a passing `evaluate()` verdict" is literally true.

**The M2 compliance_approvals binding (the B-6-rework claim) — VERIFIED in code, not on faith:**
- `grantApproval` (`approval.service.ts:109`) inserts a `compliance_approvals` row for `resourceType:'outreach-template-version'`, `resourceId:versionId`.
- The insert (`outreach.repository.ts:293`) writes the EXACT M2 columns: `resource_type`, `resource_id`, `content_hash`, `approver_user_id`, `approver_role`, `status:'approved'` — matching the canonical `compliance_approvals` table in `apps/api/src/db/schema/compliance-rules.ts` (columns `resource_type`/`resource_id`/`content_hash`/`approver_user_id`/`approver_role`/`status` `approvalStatusPgEnum`).
- The M2 gate CONSUMES this row: `compliance-gate.repository.ts:96` `loadApproval(tx, resourceType, resourceId)` SELECTs `compliance_approvals` by `(resourceType, resourceId)`. The loop closes — approval written by ApprovalService is the exact row the gate's SoD/content-hash evaluators read. Without it (per the C-1 FIX comment) `verdict.allowed` could never be true. This is the real bridge, confirmed both ends.
- `evaluate()` itself (`compliance-gate.service.ts`) parses ctx against the canonical schema FIRST, runs ALL evaluators unconditionally in fixed order ("No skip, no subset"), and `await this.audit.append(...)` BEFORE `return verdict`. No skip param, mandatory audit-before-return, fail-closed. Non-bypassable authority confirmed.

## CLAIM 4 — Migration 0010 applied to the deployed DB — VERIFIED

- Deployed anon probes (my own, this session): `GET /outreach-templates → 401 {Unauthorized}`, `GET /outreach → 401`. Not a 500 relation-does-not-exist → the routes resolve past routing into the auth guard; app boots with the module wired.
- Stronger live evidence from C-2 (authed advisor session, invite→signup): `GET /outreach-templates → 200 {"templates":[]}` and `GET /outreach → 200 {"outreach":[]}` — a list query that TOUCHES the tables returned 200, proving `outreach_templates` / `outreach_template_versions` / `outreach` EXIST live with no relation-missing error. `POST /auth/signup → 500` reproduced by me — CORRECT by design (invite-only).
- Journal ordering: `_journal.json` at af5b5d9 → `0010_mighty_the_anarchist when=1783641600000` > `0009 when=1783555200000`. Registered and monotonic.
- Migration is additive-only: `0010_*.sql` = `CREATE TYPE outreach_approval_status`, `CREATE TYPE outreach_status`, `CREATE TABLE outreach/outreach_template_versions/outreach_templates`; the `ALTER TABLE ... ADD CONSTRAINT` lines are FK constraints on the NEW `outreach` table (→ mandates/match_candidates/users), NOT alters of any M2/M4/M5 table. `.down.sql` drops ONLY the 3 new tables + 2 new types. Deployed via synchronous `preDeploy drizzle-kit migrate` before traffic (per C-2).

**NOTE:** I did not independently assemble an authed advisor session (requires the wave-10 sourcing seed chain); the authed-200 table-existence rests on C-2's head-ci-cd evidence, corroborated by my own anon-401 (route present, not relation-500) and the af5b5d9 deployed hash. Reliance is bounded and stated.

## CLAIM 5 — Deploy hash match — VERIFIED

`/health` on the api's own domain → `{"status":"ok","db":"ok","version":"af5b5d9"}` — serves the merge commit. Web root → 307→/login (auth guard; Next has no /health, redirect is expected). C-2 records the stale `GIT_SHA` env var (57449b6) was corrected to af5b5d9 + redeployed; deployed code was always the af5b5d9 build (immutable commitHash). Both services on af5b5d9.

## CLAIM 6 — The e2e proof actually RAN GREEN (6 tests, not skipped) — VERIFIED (NOT a Ghost Green)

- `apps/api/test/outreach-gate.e2e-spec.ts` is REAL and un-mocked: header states it replaced a mocked spec; `beforeAll` self-applies drizzle migrations (`drizzle-orm/node-postgres/migrator`) making it CI-infra-independent; it constructs the REAL `ComplianceGateService(auditSvc, complianceRepo)`, REAL `AuditService(keyring, auditRepo)`, REAL `OutreachRepository` — no `jest.mock`/vi.mock of the gate.
- 6 `it()` blocks: A (grantApproval→real gate `allowed=true`, **send_eligible reachable**), B (not-approved→blocked no-approval), C (SoD composer=approver→blocked sender-is-approver), D (content drift v2→blocked), M-2 (double-approve→ConflictException), C-2 (listTemplatesWithVersions pending visible).
- **Ghost-Green risk investigated:** the suite is `describe.skipIf(shouldSkip)` where `shouldSkip = !TEST_DATABASE_URL`. If CI didn't set that var, all 6 would skip-collect green. **Refuted:** `.github/workflows/ci.yml` provisions a `postgres:18` service + sets `TEST_DATABASE_URL: postgres://postgres:test@localhost:5432/dealflow_test` (distinct from `DATABASE_URL`). So `shouldSkip=false` in CI.
- **Actual execution proven from the CI run** (28740703914, main@8d7ed8b, conclusion=success): log shows `✓ test/outreach-gate.e2e-spec.ts (6 tests) 1707ms` and the named test `✓ ... A. grantApproval writes compliance_approvals → real gate returns allowed=true (send_eligible reachable) 429ms` — 429ms wall time, i.e. it RAN against a real DB, not 0ms skip. Final api project summary: `Test Files 32 passed (32)`, zero `skipped (N≥1)` lines. The two immediately prior runs (1cb033b, 40b3fbe) FAILED on real DB issues before this one passed — further proof the test exercises real behavior, not a decorative green.

This is the load-bearing proof that `send_eligible` is reachable through a passing gate, and it is genuine.

## CLAIM 7 — Antipattern sweep — VERIFIED (deferred work honestly absent + documented)

- **No email/AI deps:** `apps/api/package.json` at af5b5d9 has zero of nodemailer/sendgrid/postmark/resend/@aws-sdk/ses/@anthropic/anthropic/openai.
- **No forbidden imports** in the outreach module — every grep hit is a doc-comment or a NEGATIVE-assertion test (`outreach.spec.ts` tests 37–38 assert the imports are absent). Deferral is documented in-code (`outreach.service.ts:34-35`, `outreach.module.ts:20-21`, `approval.service.ts:25`).
- **AC-STRIP holds in the repo:** no live "Send Immediate", "Schedule Send", "AI Drafting", "upon send", "WORM", "Generate with AI" CTAs in the shipped `.tsx`; all grep hits are doc-comments describing the strip + negative-assertion page tests. C-2 independently grepped the DEPLOYED authed HTML (web-origin session): zero forbidden send/AI CTAs, compose CTA = "Run Compliance Gate & Create Record", "No email has been sent" copy correctly gated to the post-compose success block.
- **Enum-collision avoided:** the new enum is `outreach_approval_status` (`0010_*.sql:1`, shared `:27`), DISTINCT from M2's `approval_status` — exactly the P-4 karen note. `outreach_status` = `compose|send_eligible|blocked`, no `sent` value (send is a later bundle).
- Deferred capabilities (actual email-send + AI-drafting) are HONESTLY absent and documented as deferred, not silently faked.

---

## Antipattern catalog result
- Claimed-but-fake: NONE.
- Ghost Green / decorative test: NONE — the load-bearing e2e ran green with 6 tests executing on a real DB (429ms on the critical case), refuted by CI-log inspection.
- Done-Theater / send_eligible-without-gate: NONE — single gated assignment, M2 approval bridge closed both ends.
- Deferred-but-undocumented: NONE — send + AI-drafting are documented deferrals with negative-assertion tests and clean deps.
- Spec-vs-deployed drift: NONE — deployed hash == merge commit; live tables reachable; enum name matches P-4 directive.

## Reliance statements (bounded)
1. Live table-existence via authed 200 rests on C-2's head-ci-cd session; independently corroborated by my anon-401 (route present, not relation-500) + deployed-hash match. A full happy-path live `send_eligible` smoke was NOT assembled live (needs the wave-10 sourcing+cross-user-SoD chain) — non-bypassability's live proof is the C-1 CI e2e (6/6 real-DB) against this exact commit, which I verified from the run log.

**FINAL: APPROVE. 7/7 claim clusters TRUE, 0 contradicted.**
