# V-1 Karen — Reality Verification (wave-13 · M6 audit-log / recordkeeping EXPORT)

**Scope:** Load-bearing CLAIMS of wave-13 verified against DEPLOYED reality + repo @ merge, NOT the diff (B-6 covered the diff).
**Merge/code commit:** `2ec4953` (B-6 gate 5293045; current branch HEAD `ec2f3a6` = T-9 journey doc-only `[skip ci]`, no code delta).
**Deployed LIVE:** api `https://dealflow-api-production-66d4.up.railway.app` → `/health` = `{"status":"ok","db":"ok","version":"2ec495377273b5944a3455ebdfab8c32bef437c1"}` (== `2ec4953`). web `https://dealflow-web-production-a4f7.up.railway.app`.

**VERDICT: APPROVE** — all 8 load-bearing claims are TRUE against deployed state + code @ `2ec4953`. One carried-forward MEDIUM (DEV-2) surfaced for V-2; it does not contradict any claim.

---

## Claim-by-claim

### CLAIM 1 — Files exist @ 2ec4953, NO new migration (B-0 skipped) — TRUE
`git ls-tree -r 2ec4953` shows all seven files present:
- `apps/api/src/modules/recordkeeping/{recordkeeping.service,recordkeeping.repository,recordkeeping.controller,recordkeeping.module,recordkeeping.spec}.ts`
- `packages/shared/src/recordkeeping.ts`

Migration set caps at `0011_brainy_the_liberteens.sql`. `git log 5f2283b..2ec4953 -- apps/api/src/db/migrations/` returns **EMPTY** — zero migration files touched across the wave-13 commit range. B-0 skip confirmed; spec HARD BOUNDARY "additive, no schema change" holds.

### CLAIM 2 — Exports exist — TRUE
`recordkeeping.service.ts`: `RecordkeepingService.listAsActor` (L~110), `verifyChainAsActor` (L~150), `exportAsActor` (L~185). Mandate-derivation lives in `recordkeeping.repository.ts` `buildConditions()` (the per-`resource_type` compound-OR SQL fragment). Export appends `export_generated` via `AuditService.append` inside `runInTransaction`.

### CLAIM 3 — Read-only invariant (list + verify emit NO audit row) — TRUE
`listAsActor` calls only `authRepository.getUserWithRole` + `repository.findFiltered` — no `auditService` reference. `verifyChainAsActor` calls only `getUserWithRole` + `auditVerifier.verifyChain()`. The ONLY `auditService.append` call site in the whole module is inside `exportAsActor`'s transaction. Repository (`recordkeeping.repository.ts`) contains zero INSERT/UPDATE/DELETE — pure `.select()` reads. Read path emits ZERO audit rows.

### CLAIM 4 — Export appends exactly-one `export_generated` LAST-IN-TXN — TRUE
`exportAsActor`: `verifyChain()` runs OUTSIDE the tx (stateless full-chain read); then `runInTransaction` reads in-scope entries (tx-scoped), assembles manifest, and `auditService.append({action:'export_generated', resourceType:'audit-log-export', ...}, tx)` is the **last** write in the tx closure. Single append. If append throws, the tx rolls back and the exception propagates (no package returned) — the exactly-one-or-none invariant is structurally enforced.

### CLAIM 5 — `export_generated` added to shared `auditActionEnum` (additive, no migration) — TRUE
`packages/shared/src/audit.ts:186` `'export_generated'` under the `// --- Wave-13 recordkeeping-export actions (additive; serialization order preserved) ---` block, appended AFTER wave-12 pipeline actions (serialization order preserved). `action` column is text (enum is app-level Zod validation, not a DB type), so additive with zero migration. `audit.test.ts:47` asserts `auditActionEnum.parse('export_generated')` and `:78` asserts wave-12 order precedes wave-13.

### CLAIM 6 — Recordkeeping API LIVE; deploy hash == 2ec4953 — TRUE
Independently reproduced:
- `GET /health` version = `2ec495377273b5944a3455ebdfab8c32bef437c1` == `2ec4953`. Match.
- `GET /compliance/audit-log` (anon) → **401**
- `GET /compliance/audit-log/verify` (anon) → **401**
- `POST /compliance/audit-log/export` (anon) → **401**

All three endpoints are live and enforce auth (401 anon, per spec + RBAC). Controller (`recordkeeping.controller.ts`) declares `@Get('audit-log/verify')`, `@Post('audit-log/export')`, `@Get('audit-log')` — static sub-routes registered BEFORE the bare read (avoids route shadowing), each `@UseGuards(SessionGuard, RolesGuard)` + `@Roles(...)` sourced from shared `rolesForRoute` with a config-drift guard. The authed C-2 evidence (`C-2-deploy-and-verify.md:33-34`) records the real `AuditVerifier` shape `{ok:true, entriesChecked:309}` and the export delta `verify 309 → export → verify 310` (+1) with `export_generated` as newest action + `Content-Disposition: attachment` package `{entries, manifest, verifyResult}`. I could not re-drive the authed path (no credential), but the anon-401 live-confirm + C-2 authed evidence + structural code match are consistent and adequate.

### CLAIM 7 — H1 fix: repository docstring HONEST about gate-evaluate; NO lossy outreach-template-version→mandate branch — TRUE
`recordkeeping.repository.ts` docstring states plainly: *"gate-evaluate rows are intentionally excluded from the mandate-scope derivation... Adding an outreach-template-version→mandate branch would over-capture gate decisions that belong to other mandates that share the same template version... they are NOT mandate-attributable via this derivation."* The `buildConditions()` mandate fragment contains NO `outreach-template-version` branch — confirmed by inspection of the full compound-OR (mandate / outreach / pipeline / pipeline_event / match_run / match_candidate / buyer_universe / buyer_universe_candidate / audit-log-export only). The B-6 REWORK (compliance-completeness honesty) landed: docstring no longer claims gate-evaluate is captured, and no lossy over-capturing branch was added.

### CLAIM 8 — Antipattern sweep — CLEAN, with DEV-2 flagged MEDIUM
- **Deferred scope honestly absent + documented:** No PDF, multi-format, multi-regulation presets, background jobs, or `export_templates` anywhere in the module. Export produces ONE JSON package (`{entries, manifest, verifyResult}`). Deferral is documented in-spec ("SCOPE-HELD") and reflected in code (single deterministic format). Honest.
- **No edit/delete of audit rows:** Repository is read-only + single append; zero mutation of existing `audit_log_entries`. UI (C-2 evidence) shows zero edit/delete/send/AI affordance on immutable rows.
- **No claimed-but-fake:** every method delegates to real M2 primitives (`AuditVerifier.verifyChain`, `AuditService.append`, `AuthRepository.getUserWithRole`) — no stubs, no fabricated shapes. verify returns the REAL `{ok, entriesChecked, firstBreakAt?, reason?}`, not an invented `{anomalies[]}`.

---

## FINDINGS

### FINDING 1 (MEDIUM — DEV-2, carried forward for V-2): mandate-derivation SQL is unit-mocked only; never executed against a real DB
`file: apps/api/src/modules/recordkeeping/recordkeeping.repository.ts` (`buildConditions` mandate fragment) + `recordkeeping.spec.ts`.

Evidence:
- `recordkeeping.spec.ts` header states verbatim: *"MANDATE-DERIVATION: repo.findFiltered receives mandateId when provided... **Tested via repository mock**"* and *"Architecture: **all DB calls are mocked via the repository mock**."* The unit test asserts the *service* passes `mandateId` through — it does NOT execute the derivation SQL.
- No integration/e2e test file touches recordkeeping: `git grep -li recordkeeping 2ec4953 -- apps/api/test/` returns nothing; no `recordkeeping.*int/e2e` file exists in the tree.
- The live C-2 export used an **empty scope** (`POST .../export` body `{}`) → `mandateFragment` is `null` in that path, so the multi-JOIN mandate-derivation branch was **also NOT exercised live**.

Net: the complex per-`resource_type` OR/JOIN subquery fragment (8 branches, `::uuid` / `::text` casts, two-hop joins) has never run against Postgres in any automated OR live check. A silent defect (wrong `resource_type` literal, cast mismatch, missing/extra JOIN row) in a mandate-scoped export could drop or duplicate entries in the exported slice with no test catching it.

**Karen's read (severity = MEDIUM, not blocking):** This is a genuine claimed-but-structurally-unverified risk, correctly identified by the orchestrator and routed to V-2. It is NOT a REJECT because: (1) it contradicts no load-bearing claim — the claims assert the code *exists and is read-only/atomic/additive*, all TRUE; (2) blast radius is bounded — the derivation is read-only and CANNOT corrupt the immutable chain; worst case is an incomplete/over-inclusive **export slice**, and every package still ships the FULL-chain `verifyResult` that independently proves the whole chain unbroken regardless of slice content; (3) the B-6 `/review` structural verification + C-2 live read/verify/export confirm the surface is wired and live. The gap is **execution coverage of the mandate-scoped read path**, not a functional-completeness or false-completion defect. Adequate to ship this wave; V-2 should log it as tech debt and the next wave that touches recordkeeping should add an integration test that seeds cross-`resource_type` rows for one mandate and asserts the derivation captures exactly the expected set.

No Critical or High findings. No False-green, no spec-vs-deployed drift, no compliance-gate bypass detected.

---

## Cross-agent
- **@jenny (V-1):** confirm the deployed surface satisfies the 3-task multi-spec acceptance criteria (esp. advisor own-outreach scoping + advisor-403-on-export, which I verified structurally + via C-2 evidence, not via authed re-drive).
- **@head-verifier (V-3):** DEV-2 (FINDING 1) is the sole item to weigh for the V-block verdict — recommend ACCEPT-AS-TECH-DEBT with a next-wave integration-test action, not REWORK.
