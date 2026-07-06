# Wave 16 — V-1 Karen (deployed-state reality check)

**Reviewer:** Karen (V-1, DealFlow AI wave-16 · M7 admin-hardening)
**Scope:** Verify LOAD-BEARING CLAIMS are TRUE **in the DEPLOYED state** (not the diff — that was B-6).
**Deployed SHA:** `d72d7cb735aff74fcdbdb28bd20f19bf711cc539` · main @ `d72d7cb` (HEAD verified `git rev-parse`).
**Prod:** api `https://dealflow-api-production-66d4.up.railway.app` · web `https://dealflow-web-production-a4f7.up.railway.app`.
**Iron Law honored:** no fixes attempted. Findings only.

## VERDICT: APPROVE

All 8 load-bearing claim-clusters confirmed true. Every source-existence claim grep-confirmed at `d72d7cb`; deployed `/health` serves the exact deployed hash (no stale Ghost-Green); every wave-16 route is registered + live and auth-gated; the no-secret response projection is a hard structural whitelist proven at source; the migration journal carries no stray migration; the C-1 HMAC fix preserved (not weakened) the `verifyResult.ok===true` assertion.

**One scope note (not a defect, no severity):** the three fully-authed *runtime response-body* assertions — activity-data returning a real 200 row-set grep-clean of secrets, non-UUID→live-400, and `audit-log/verify`→`{ok:true}` — could NOT be re-executed live by V-1 because no prod admin credentials are stored in the repo (`command-center/testing/test-accounts.md` is an unpopulated template; `project.yaml: test_users.local_dev[]` is empty). These were executed by C-2 head-ci-cd against a live authed session and documented with concrete per-check results (C-2 §Verify LIVE rows 6/7/11). V-1 independently confirms the *deployed enforcement scaffolding* for each (route live + auth-gated + source-level guarantee) and finds C-2's authed evidence internally consistent and corroborated by source. This is disclosed honestly, not rubber-stamped — see Findings 3, 4, 7.

---

## Findings

### F1 — File/function existence @d72d7cb — CONFIRMED
- **user-management.service.ts** exists (`apps/api/src/modules/admin/user-management.service.ts`, 20170 bytes).
  - `inviteAsActor` present (:153) with `pg_advisory_xact_lock` as FIRST tx statement: `SELECT pg_advisory_xact_lock(hashtext(${normalizedEmail})::bigint)` (:164) — race-safe per-email guard.
  - `reactivateAsActor` present (:404); role PRESERVED — `roleId: users.roleId` selected (:415), doc "role_id is preserved — we do NOT change it" (:394,:435); sets `deactivated_at = NULL` only.
- **data-source-admin.service.ts** exists (`apps/api/src/modules/admin/data-source-admin.service.ts`).
  - `validateConfigOrThrow` (:121) throws `BadRequestException(CONFIG_VALIDATION_ERROR)` (:126) — uniform static constant (:105), ZodError discarded (no echo). Called before tx at :181 and :264.
- **admin-activity module** exists (`apps/api/src/modules/admin-activity/`): service/controller/module + specs.
  - `findAdminActivity` lives on the EXISTING **AuditRepository** (`apps/api/src/modules/audit/audit.repository.ts:158`), called by the service (`admin-activity.service.ts:96`). NOT a forked reader — confirmed the only INSERT path is `insertEntry`; find/count are read-only.
- **mandate.service.ts + mandate.repository.ts** exist.
  - `findWorkspaceSettingsInTx(tx)` (`mandate.repository.ts:94`) reads `workspace_settings` off the passed tx snapshot (`tx.select().from(workspaceSettings).limit(1)`) — tx-scoped (BUILD rule 7), not module-level.
  - **suppressionScope no `sql` cast after /review fix:** write-path `insertComplianceProfile` sets `suppressionScope: input.suppressionScope` as a plain value (`mandate.repository.ts` insert block ~:442), and read/return path `suppressionScope: complianceProfile.suppressionScope ?? null` (`mandate.service.ts:442`) — no `sql\`...\`` cast on the column. Confirmed.

### F2 — Deployed serves d72d7cb (no stale Ghost-Green) — CONFIRMED
- `GET /health` → `{"status":"ok","db":"ok","version":"d72d7cb735aff74fcdbdb28bd20f19bf711cc539"}`. Exact deployed hash. The C-2 GIT_SHA repin (stale f5455d6 → d72d7cb) took — no stale-mirage. web `/` → `307` (login redirect), app live.

### F3 — Routes registered + live — CONFIRMED (enforcement scaffolding live; authed 200 path per C-2)
- `POST /admin/users/:id/reactivate`: anon → **401** (both valid-shaped and non-UUID `:id`). Auth guard fires before validation (correct ordering). Route registered.
  - **non-UUID→400-not-500 proven at source:** handler (`admin-users.controller.ts:162-176`) runs `adminReactivateParamsSchema.parse({id})` inside try/catch → `throw new BadRequestException('id must be a valid UUID')` BEFORE `reactivateAsActor`. A malformed id never reaches the DB → structurally cannot 500. The `@Roles(...ADMIN_USERS_ROLES)` decorator (:165) is the advisor-403 guard. Live authed 400/403/200 documented by C-2 row 7.
- `GET /admin/activity-data`: anon → **401** `{"message":"Unauthorized","statusCode":401}`. Route registered; `@Get('activity-data')` + `@Roles(...ADMIN_ACTIVITY_ROLES)` (`admin-activity.controller.ts:73,75`) with fail-closed boot guard (:40-45) that refuses to boot if the route resolves to `[]` roles. Live authed 200/advisor-403 documented by C-2 row 6.
- **Negative control:** genuinely nonexistent `GET /admin/nonexistent-route-xyz` → **404**, distinguishing registered-but-auth-gated (401) from unregistered (404). The 401s are real route hits, not catch-all rejections.

### F4 — Admin-activity response carries NO secret — CONFIRMED (structural whitelist, stronger than a grep)
- Response projection (`admin-activity.service.ts` map block ~:139-167) is an EXPLICIT object-literal whitelist returning ONLY `{ sequenceNumber, actor, target, action, timestamp }`. `payloadHash`/`contentHash`/`entryHash`/`prevHash`/`chainVersion`/`actorRole`/`resourceType`/`resourceId`/`mandateId`/credential are structurally absent from the returned shape — cannot leak regardless of input row contents. C-2 row 6 corroborates on the live 200 body (14 rows, keys exactly `{action,actor,sequenceNumber,target,timestamp}`, grep for `hash|credential|payloadhash|encrypted|secret|password|content_hash|prev_hash` → NONE).

### F5 — auditActionEnum additively extended — CONFIRMED
- `packages/shared/src/audit.ts`: `'user-reactivate'` appended at **:234**, at the END of the enum (after wave-15's `'deactivate'` :205 and all prior actions: `user-invite` :193, `role-change` :199). No reordering of existing members — additive only (wave-15 Inv-6 honored). Doc note at :232 "Mirrors the wave-15 'deactivate' action."

### F6 — No un-journaled migration (schema_skipped) — CONFIRMED
- `apps/api/src/db/migrations/meta/_journal.json`: 14 entries, idx 0→13, **MAX IDX = 13** (`0013_safe_union_jack`, when `1783900800000`). No stray `0014`. On-disk `.sql` set ends at `0013_safe_union_jack.sql` (+ `.down.sql`). Matches P-3 `schema_change: false` and B-6 verdict ("`git diff main..HEAD -- apps/api/drizzle/` empty"). No Ghost-Green migration.

### F7 — Audit chain intact — CONFIRMED-via-C-2 (route live @ V-1; authed body per C-2)
- `GET /compliance/audit-log/verify` route registered + live: anon → **401** (`audit-log.controller.ts:55` `@Get('audit-log/verify')`, fail-closed boot guard :41-47, roles `['compliance','admin']`). V-1 cannot mint an authed compliance/admin session (no stored creds). C-2 row 11 documents the authed result: `{ok:true}`, entriesChecked 324→328 across all admin writes (reactivate + integration + mandate-create + cascade); the direct-SQL cred-blank cleanup correctly did NOT touch the app audit chain. Source: the C-2 handler is a pure read (`verifyChain()`, :59) — no write side-effect that could corrupt the chain.

### F8 — C-1 HMAC cross-suite fix preserved verifyResult.ok, not weakened — CONFIRMED
- `git show d72d7cb -- apps/api/test/recordkeeping-gate.e2e-spec.ts`: the ONLY change is swapping the suite-private hardcoded HMAC key for the `??`-default (`process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod'`) so all three parallel e2e suites (recordkeeping-gate, admin-activity, admin-concurrency) share one key against the shared TEST_DATABASE_URL — fixing cross-suite content-hash-mismatch, not the assertion.
- **Assertion PRESERVED:** `expect(pkg.verifyResult.ok).toBe(true)` remains at :614 AND :647; `entriesChecked` assertions intact (:615). No `expect` line touched by the diff. Commit body claims "No assertion weakened" — verified true by reading the test.

---

## Cross-references (deployed-state corroboration used)
- B-block gate: `process/waves/wave-16/blocks/B/gate-verdict.md` — APPROVED, all 6 verticals code-read.
- C-2 deploy: `process/waves/wave-16/stages/C-2-deploy-and-verify.md` — head-ci-cd APPROVED; live authed probes (rows 4-12), GIT_SHA repin, WORM-safe prod-cleanup, temp DB proxy self-deleted.
- P-3 plan: `process/waves/wave-16/stages/P-3-plan.md` — `schema_change:false`, P-4 security-rework (Finding1 advisory-lock / Finding2 config no-echo / Finding3 read-only-no-secret).

## Recommendations (prevent future false completions)
1. **Populate `command-center/testing/test-accounts.md` with prod admin/advisor/compliance fixture creds** (gitignored) so V-1 Karen can independently re-run authed runtime assertions rather than relying on C-2's authed session. Today the deepest authed checks (activity-data body, live 400, verify {ok:true}) are single-sourced to C-2 — corroborated by source but not independently re-executed at V-1.
2. Keep the structural-whitelist projection pattern (F4) as the canonical no-secret defense — it is provably leak-proof at source, unlike response-grep which only samples one response.

---
```yaml
karen_verdict: APPROVE
finding_count: 8
findings_confirmed: 8
findings_rejected: 0
deployed_sha: d72d7cb735aff74fcdbdb28bd20f19bf711cc539
independent_live_checks: [health-version, web-307, reactivate-401+404-negctl, activity-data-401, audit-verify-401-route-live]
source_confirmed: [inviteAsActor-advisory-lock, reactivateAsActor-role-preserved, validateConfigOrThrow-uniform-static, findAdminActivity-on-AuditRepository, findWorkspaceSettingsInTx-tx-scoped, suppressionScope-no-sql-cast, no-secret-structural-whitelist, non-uuid-400-not-500, auditActionEnum-additive, journal-max-idx-13, hmac-verifyResult-ok-preserved]
authed_body_single_sourced_to_C2: [activity-data-200-rowset, reactivate-live-400/403/200, audit-verify-ok-true]
iron_law_honored: true
```
