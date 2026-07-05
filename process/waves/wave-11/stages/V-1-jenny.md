# V-1 jenny — Spec-intent vs deployed-behavior audit (wave-11, M6 compliant-outreach foundation)

**Agent:** jenny (Senior Spec-Compliance Auditor). **Mode:** independent verification — examined the DB spec-contract row, the deployed artifact (`af5b5d9` live on Railway), the shipped source at that commit, migration 0010, the CI real-DB e2e, and C-2's authed verification. **Scope:** does DEPLOYED behavior match the SPEC-CONTRACT INTENT beyond the T-block acceptance-criteria checks.

**Authoritative spec:** `tasks.description` YAML head for `102a2f00` / `e90a4a99` / `2601ba33` (fetched live from Postgres — the DB row, not the P-2 convenience copy). Deployed prod: api `https://dealflow-api-production-66d4.up.railway.app` + web `https://dealflow-web-production-a4f7.up.railway.app`, both LIVE @ `af5b5d9` (`/health` → `{"status":"ok","db":"ok","version":"af5b5d9"}` — version == deployed hash, self-confirmed this session).

---

## VERDICT: **APPROVE**

**Drift count: 0.  Gap count: 2 (both non-blocking spec-improvement notes for P-2 — neither is a code defect).**

All three specs' compliance-critical intent is honored in the deployed artifact: the pre-send gate is structurally non-bypassable and CALLED on every compose, version-binding blocks unapproved/drifted/self-approved sends, SoD (composer≠approver, compliance-only approve) is server-enforced, the template spine is versioned+immutable+audited with the required disclaimer block, no email/AI is sent or claimed, and the F16 journey renders end-to-end with honest provenance. Findings are evidence-backed below.

---

## Deployment authenticity (pre-condition — PASS)

- Live `/health` returns `version: af5b5d9` on the api's own domain — matches the deployed commit; not stale. `git log` confirms `af5b5d9` = "wave-11 C-1 PASS" (the T-9 journey doc commit `0b101e6` is `[skip ci]`, docs-only — the deployed code is `af5b5d9`).
- Migration 0010 applied live: C-2 confirmed `GET /outreach-templates` + `GET /outreach` → 200 (empty), i.e. the 3 tables exist (no relation-missing 500). I independently re-probed the anon surface: both endpoints → **401** (auth-guarded, not 404/500), POST `/outreach` anon → **401**, all consistent with a live, migrated, RBAC-guarded deployment.
- Web pages live: `/outreach-templates`, `/outreach-composer`, `/compliance-queue` all → **307** (auth-guard redirect to /login) — the routes exist and are guarded (not 404).

---

## 1. Non-bypassable pre-send gate (e90a4a99) — **HONORED**

**Spec intent (e90a4a99 AC-2 + karen P-4 note 4):** before any outreach is marked send-eligible, a SERVER-SIDE gate MUST evaluate (a) template version usable-for-send, (b) M2 rules pass, (c) required disclaimer present; verdict audited in-tx; NO client-only bypass; `send_eligible` unreachable without a passing verdict; the gate must be CALLED on EVERY compose (not merely callable).

**Deployed evidence:**
- `OutreachController.compose` (`outreach.controller.ts:97-116`) is the SOLE write path, `@Roles(...OUTREACH_WRITE_ROLES)` (advisor-only), and unconditionally delegates to `OutreachService.composeAsActor` — no branch sets status directly.
- `OutreachService.composeAsActor` (`outreach.service.ts:99-301`) derives `status` SOLELY from the gate: `const outreachStatus = verdict.allowed ? 'send_eligible' : 'blocked'` (`:277`), where `verdict` comes ONLY from `this.complianceGateService.evaluate(gateContext, tx)` (`:274`). There is NO other assignment of `'send_eligible'` anywhere in the module (grep-confirmed). This is the structural non-bypassable property, PROVEN not asserted.
- The reused gate `ComplianceGateService.evaluate` (`compliance-gate.service.ts:80-118`) has NO skip/dryRun param, runs ALL four evaluators unconditionally (`:94`), and writes the verdict to the audit log in the SAME tx BEFORE returning (`:116`) — if audit throws, tx rolls back and no verdict is returned. This is the wave-5 verified-live authority reused intact.
- **CI real-DB e2e (`test/outreach-gate.e2e-spec.ts`) proves the semantics on a real Postgres:** (A) approved+SoD-clean+hash-match → `verdict.allowed===true`, blocks length 0 → send_eligible reachable (`:246-247`); (B) not-approved → blocked with `no-approval` (`:303-304`); (C) SoD violation composer===approver → blocked `sod/sender-is-approver` (`:366-372`); (D) content drift (approved v1, re-drafted v2) → blocked `no-approval` for v2 (`:445-446`). This is the exact commit deployed (`af5b5d9`).
- **C-2 live confirmation:** a live compose against an UNAPPROVED version did NOT yield `send_eligible` (returned FK-guarded 400 on synthetic mandate/candidate UUIDs — send_eligible was not reached). Full happy-path live smoke was NOT assembled (needs the whole wave-10 sourcing + cross-user SoD chain); non-bypassability therefore relies on the CI e2e against this exact commit + C-2's live "unapproved→not-send_eligible" observation. **I concur with C-2's explicit reliance statement — this is a legitimate evidence chain, not done-theater.**

**Result:** compose ALWAYS runs the gate; `send_eligible` is unreachable without `verdict.allowed===true`. **No drift.** (See Gap-1 below re: the pre-check short-circuit nuance — a spec-improvement note, not a bypass.)

---

## 2. NO email sent / NO AI (e90a4a99 boundary + CODE-OF-CONDUCT provenance) — **HONORED**

**Spec intent:** this bundle produces the send-ELIGIBLE record only — NO actual email send, NO AI-drafting; the product must NOT imply it sent an email or has AI capability (CODE-OF-CONDUCT provenance; the wave-10 precedent; jenny P-4 AC-STRIP).

**Deployed evidence:**
- **No SDK in the artifact:** grep of `apps/api/src/modules/outreach/` for `anthropic|openai|nodemailer|sendgrid|postmark|resend|ses` → matches ONLY in comments and negative-assertion test lines (`outreach.spec.ts:1277-1295` assert the imports are ABSENT). `apps/api/package.json` → NONE of these deps present. There is physically no send/AI code path in the deployed artifact.
- **Honest UI copy (shipped):** the composer client (`OutreachComposerClient.tsx`) surfaces the CTA `Run Compliance Gate & Create Record` (`:846`) — NOT "Send"/"Schedule Send". The provenance note (`:310-312`, gated to `{isSendEligible && …}` at `:296`) reads: *"A send-eligible record has been created and logged. The actual delivery to the recipient is a separate step, available in a later release. **No email has been sent.**"* — explicitly disclaims a send; renders only AFTER a send-eligible record (correct — not on initial load).
- **AC-STRIP holds:** the forbidden strings ("Send Immediate", "Schedule Send", "AI Drafting", "upon send", "WORM storage upon send", "Generate with AI") appear in the shipped .tsx ONLY inside doc-comments describing what was stripped and inside test files as `not.toContain` assertions — never as rendered UI. C-2 independently grepped the DEPLOYED authed HTML (composer 76KB / compliance-queue 22KB / templates 22KB, web-origin session): zero forbidden send/AI CTAs, zero send buttons; the only "AI-powered" is the site-wide `<meta>` product tagline (allowed global copy, present on /login too — the wave-10 precedent).

**Result:** the deployed product neither sends nor claims to send an email, and presents no AI-drafting affordance. **No drift.**

---

## 3. Version-binding (2601ba33 + 102a2f00 invariant) — **HONORED**

**Spec intent:** a version is usable-for-send ONLY when `approval_status='approved'` AND `approved_content_hash == current content_hash`; editing an approved template mints a NEW pending version NOT send-eligible until re-approved; asserted in the SERVICE.

**Deployed evidence:**
- `TemplateService.isUsableForSend` (`template.service.ts:73-79`) encodes EXACTLY the invariant: `approvalStatus==='approved' && approvedContentHash!==null && approvedContentHash===contentHash`.
- `draftNewVersion` (`:177-240`) ALWAYS INSERTs a new row (`version_number = MAX+1`, `:198-199`) with default `approvalStatus='pending'` + `approvedContentHash=NULL` (schema default `outreach.ts:240,251`) — it NEVER mutates an approved row in place (append-style; DB partial-unique `(template_id, version_number)` at `outreach.ts:289` backstops).
- `grantApproval` (`approval.service.ts:98-102`) binds `approvedContentHash = version.contentHash` at approval time. A subsequent edit → new version with NULL approved hash → `isUsableForSend` false. `composeAsActor` calls `isUsableForSend` as pre-check (`outreach.service.ts:123`) → blocks with `version-binding` code if false.
- **e2e case D proves it end-to-end** on a real DB (approved v1 → re-draft v2 → v2 blocked). The composer UI ALSO mirrors this client-side (`page.tsx:113-124` filters the approved-version list to `approved && approvedContentHash===contentHash`) — defense-in-depth, not the authority.

**Result:** version-binding intent honored, asserted in-service, proven on real DB, deployed. **No drift.**

---

## 4. SoD — composer≠approver + compliance-only approve (2601ba33) — **HONORED**

**Spec intent:** the user who APPROVES a version must NOT be the one who composes from it (server-side, 403/blocked, audited); grant/reject is compliance-role ONLY (advisor/analyst 403).

**Deployed evidence:**
- **Composer≠approver:** `composeAsActor` (`outreach.service.ts:206-239`) blocks when `version.approvedBy === appUserId` with `sod/sender-is-approver`; also fail-closed when `approvedBy===null` (deleted approver → `sod/approver-unknown`, `:170-204`). e2e case C proves the blocked verdict on a real DB.
- **Compliance-only approve:** enforced in TWO layers — controller `@Roles(...OUTREACH_TEMPLATES_APPROVE_ROLES)` (compliance-only, sourced from the shared roleRoutes matrix, `outreach-template.controller.ts:272-282`) AND a defensive service check `if (actor.roleName !== 'compliance') throw ForbiddenException` (`approval.service.ts:79-83`, and reject `:171-175`). Belt-and-suspenders.
- **C-2 live RBAC:** anon → 401; POST `/outreach` analyst → 403, compliance → 403 (compose is advisor-only write), advisor → 400 (role passes, Zod body validation) — RBAC matrix behaves as specified on the live deployment.

**Result:** SoD fully honored server-side, two-layer, audited. **No drift.**

---

## 5. Template spine (102a2f00) — **HONORED**

**Spec intent:** ADDITIVE schema (outreach_templates + outreach_template_versions with monotonic version_number, disclaimer FK→M2, content_hash, approval_status enum, approved_content_hash); migration 0010 additive + journal-registered + .down.sql; distinct enum name; required-disclaimer-block enforced on requestApproval (400 if missing); audited; actor=app users.id.

**Deployed evidence:**
- **Migration 0010** (`0010_mighty_the_anarchist.sql`): 3 CREATE TABLE + 2 CREATE TYPE + FKs + indexes — NO ALTER of any M2/M4/M5 table (statically additive → zero-downtime). Enum named `outreach_approval_status` (distinct from M2's `approval_status` [approved|revoked] — karen collision note honored, `:1`). Journal-registered (`_journal.json` tag `0010_mighty_the_anarchist` > `0009`). `.down.sql` present (drops children-first + enums).
- **Required-block enforcement:** `requestApproval` (`template.service.ts:277-284`) resolves the disclaimer FK in-tx and throws `BadRequestException` (400) if the disclaimer row is invalid — reuses the M2 `disclaimer_templates` store (no new disclaimer store). FK `ON DELETE restrict` (`outreach.ts:273-277`) backstops referential integrity.
- **Immutable versions + audit + actor-id:** every service method audits last-in-txn via `AuditService.append` with `actorUserId = app users.id` (resolved via `getUserWithRole`, the actor-id-FK lesson) — `template-create` / `template-version-draft` / `template-approval-request` / `template-approval-grant` / `template-approval-reject` / `outreach-compose` actions all present. content_hash via the reused M2 `computeContentHash` (`template.service.ts:110,203`).
- **Shared contracts:** `outreachTemplateSchema`, `outreachTemplateVersionSchema`, `templateCreateInputSchema`, `versionDraftInputSchema`, `approvalRequestInputSchema`, `outreachComposeInputSchema` all exported from `@dealflow/shared` (`packages/shared/src/outreach.ts` + `index.ts:196-205`).

**Result:** template spine fully matches spec. **No drift.**

---

## 6. Journey continuity (F16) — **HONORED**

**Spec intent:** template → request-approval → compliance-queue-grant → compose → send-eligible; no UX dead-end; the 3 pages render.

**Deployed evidence:** the T-9 journey map (`user-journey-map.md:131-142`) documents F16 as LIVE @ af5b5d9 with the exact flow. All 3 pages return 307 (auth-guard, exist) live; C-2 fetched the authed HTML (76KB/22KB/22KB — real content, not the 10KB /login shell). The composer offers only approved+hash-matching versions (`page.tsx:113`), surfaces the gate verdict honestly (send_eligible OR blocked+reason), and the compliance-queue wires grant/reject with SoD. No dead-end observed; the flow terminates correctly at a send-ELIGIBLE record (the actual send is an explicitly-deferred bundle).

**Result:** journey continuous, honest terminal state. **No drift.**

---

## Gaps surfaced for P-2 (spec-improvement, NON-BLOCKING — spec-GAP, not code-DRIFT)

**Gap-1 (spec ambiguity — "gate audited in-txn" vs the version-binding/SoD pre-check short-circuit).** The spec (e90a4a99 AC-2) says "The verdict is AUDITED in-txn (M2 audit log)". The implementation runs version-binding + SoD as PRE-CHECKS that short-circuit to `blocked` WITHOUT calling `ComplianceGateService.evaluate()` (`outreach.service.ts:123-239`) — so for those two block classes there is NO `gate-evaluate` audit row; instead the block is captured by a synthetic GateVerdict + the `outreach-compose` audit row (`:152-160`, `:194-201`, `:229-236`). The compliance OUTCOME is still fully audited (every compose writes an `outreach-compose` audit entry with the verdict + block codes), and the record is complete — so the INTENT (every decision audited) is met. But the spec's literal phrasing implies `evaluate()` is always the audit author. This is a reasonable engineering choice (a non-usable version / SoD violation yields an incomplete GateContext — no valid content to pass the four evaluators), and the code documents it deliberately (`:24-32`). **Recommendation for P-2:** the M6 spec language should explicitly permit pre-gate short-circuit blocks that are audited via the compose action rather than the gate action, OR require the pre-checks to be folded into the evaluators array (carrying templateVersion in GateContext) so `evaluate()` remains the sole audit author for ALL block classes. karen's P-4 note (3) already flagged both designs as viable — this just makes it explicit in the acceptance criteria. Not a defect: the audit COVERAGE invariant holds.

**Gap-2 (spec silent on fail-closed deleted-approver case).** The implementation adds a `sod/approver-unknown` fail-closed block when `version.approvedBy === null` (deleted user → SoD cannot be verified → blocked, `outreach.service.ts:170-204`). This is CORRECT and MORE conservative than the spec, which does not enumerate this edge case (2601ba33 edge-cases list only "same user approves then composes" and "grant/reject by non-compliance role"). **Recommendation for P-2:** add the deleted-approver fail-closed case to the SoD acceptance criteria so future refactors preserve it. This is EXTRA (spec-under-specified), correctly implemented — surfaced only so the spec catches up to the code.

---

## Clarification needed
None. The spec contract is precise and the deployed behavior is unambiguously traceable to it.

## Agent collaboration
- The non-bypassable property is structurally proven + e2e-proven on a real DB; @task-completion-validator has independently confirmed functionality at the V-block (concur). No unnecessary complexity observed (the pre-check short-circuit is a justified, documented choice) — no @code-quality-pragmatist escalation warranted.
- The two gaps are P-2 spec-language improvements for the NEXT M6 bundle (send-path); log for L-1/L-2 consideration, not a wave-11 rework trigger.

**Bottom line:** deployed wave-11 behavior faithfully implements all three specs' compliance-critical intent. Zero spec-drift. Two non-blocking spec-improvement notes. **APPROVE.**
