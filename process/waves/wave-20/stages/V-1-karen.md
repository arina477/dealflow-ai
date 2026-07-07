# Wave 20 — V-1 Karen Verdict (M9 outreach-activity tracker — first mutable M9 write surface)

**Verdict: APPROVE**
**Reviewer:** Karen (V-1) · **Deployed SHA:** `86ddc29` · **CI:** run 28841757352 (`conclusion:success`, `event:push`, `headSha:86ddc29fa974…`)
**Scope:** Source-claim truth against the DEPLOYED state (not the diff). Every LOAD-BEARING claim independently traced to a deployed-state artifact — live probe, source file:line, or the CI e2e that provably executed as `dealflow_app`.

---

## Verification matrix (claim → evidence)

### 1. Deploy serves 86ddc29 — TRUE
- **Claim:** `/health` → 200 `{status, db:ok, version==86ddc29}`; app still `dealflow_app`; migration 0018 applied.
- **Evidence:** Live probe `GET https://dealflow-api-production-66d4.up.railway.app/health` → `200 {"status":"ok","db":"ok","version":"86ddc29fa974e99128c436f5984910a152c77240"}`. `db:ok` proves schema consistent (0018 applied). C-2 deliverable records the migrate step ran as the release command BEFORE traffic (`[✓] migrations applied successfully!`), app runs `dealflow_app` (`DATABASE_URL=dealflow_app:…`, NO role-switch). RLS-GUARD boot line was truncated from the captured log window and noted honestly (not fabricated) — the authoritative isolation proof is the CI e2e AS `dealflow_app`, verified below.
- **Note (non-blocking):** the explicit `[RLS-GUARD]` boot line is not observable in the C-2 log window; `db:ok` + fail-closed endpoints + the CI e2e as `dealflow_app` (non-superuser) are the substituted evidence. Consistent with the honest deferral disclosed in C-2.

### 2. SF1 [HIGH] — no DEFAULT_WORKSPACE_ID leak — TRUE
- **Claim:** no `?? DEFAULT_WORKSPACE_ID` on the insert path; service throws on null `getWorkspaceId()`; repo passes `NULLIF(current_setting('app.workspace_id',true),'')::uuid`; a test rejects empty-ALS create.
- **Evidence:**
  - `grep DEFAULT_WORKSPACE_ID apps/api/src/modules/outreach-activity/*` → 4 hits, ALL in comments explicitly NEGATING its use (`NEVER: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID`). ZERO actual fallback on the insert path.
  - Service throw: `outreach-activity.service.ts:78-84` — `const workspaceId = getWorkspaceId(); if (!workspaceId) throw new ForbiddenException(...)` BEFORE any DB write (primary/belt guard).
  - Repo SQL expression: `outreach-activity.repository.ts:129` — `workspaceId: sql\`NULLIF(current_setting('app.workspace_id', true),'')::uuid\`` (secondary/suspenders); `23502` → `ForbiddenException` fail-closed (`repository.ts:147-152`).
  - Column DEFAULT: `0018_outreach_activity.sql:144-146` — `ALTER COLUMN "workspace_id" SET DEFAULT NULLIF(current_setting('app.workspace_id', true), '')::uuid`.
  - Tests: unit `OA-SF1-1` (`outreach-activity.spec.ts:167-183` — empty-ALS create → ForbiddenException, `insertActivity` NOT called) + real-DB `OAE-3` (`outreach-activity-rls.e2e-spec.ts:287-342` — real service, no `workspaceAls.run`, asserts thrown AND default-workspace row count UNCHANGED). Non-vacuous: it asserts no silent placement, not merely that a mock was invoked.

### 3. R1 own-row re-home write-check — TRUE (non-vacuous)
- **Claim:** GUC=A, A's OWN row, UPDATE SET workspace_id=B → 42501 (NOT the vacuous invisible-row variant); real service via `workspaceAls.run` as `dealflow_app`.
- **Evidence:** `OAE-1` (`outreach-activity-rls.e2e-spec.ts:230-255`) SEEDS firm-A's own visible row (`seedActivity(OAE_WS_A, userAId)`), then under `withWorkspace(OAE_WS_A)` (`SET ROLE dealflow_app` + GUC=A, lines 99-100) runs `UPDATE outreach_activity SET workspace_id=$WS_B WHERE id=$ownRow` and asserts `code === '42501'`. This is the FOR-ALL USING-derived write-check on the NEW row value — NOT the vacuous "UPDATE with firm-B id" targeting an already-invisible row. Complemented by `OAE-2` (INSERT explicit WS_B under WS_A GUC → 42501, lines 259-283). Runs as `dealflow_app` (non-superuser) so FORCE RLS applies — confirmed by `OAE-14` asserting `relforcerowsecurity=true` as `dealflow_app` (lines 689-705).

### 4. Files @86ddc29 — TRUE
- **0018 policy FOR ALL USING-only:** `0018_outreach_activity.sql:125-126` — `CREATE POLICY "workspace_isolation" ON "outreach_activity" USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);` — NO literal `WITH CHECK`, NO `FOR SELECT`. grep of the file confirms exactly one `USING`, zero `WITH CHECK`, zero `FOR SELECT`. Matched to the 28-table 0017 shape (derived write-check preserved).
- **Every service query via getDb:** repo `runInTransaction` → `getDb(this.db).transaction(...)` (`repository.ts:84-86`); `listActivities` → `getDb(this.db).select()` (`repository.ts:227`); all FK-tenancy + activity reads use the `tx` handle inside the getDb-scoped transaction.
- **createdBy server-derived:** `service.ts:87-91,142` — `actor.id` from `authRepository.getUserWithRole(supertokensUserId)`, passed as `createdBy`; never client input. Unit `OA-R3-5` (`spec.ts:280-291`) asserts INSERT receives `createdBy=APP_USER_ID`.
- **Create Zod excludes workspaceId+createdBy:** `packages/shared/src/outreach-activity.ts:82-96` — `createOutreachActivitySchema` = `.object({channel,status?,subject,notes?,dueAt?,outreachId?,matchCandidateId?,pipelineId?,mandateId?}).strict()`. NO workspaceId, NO createdBy. `.strict()` = mass-assignment guard. Update schema likewise (lines 111-122). Unit `OA-R1-1/OA-R1-2` assert workspaceId rejected.
- **All-4-FK tenancy validated:** `service.ts:96-127` (create) + `service.ts:210-231` (update) validate outreachId/matchCandidateId/pipelineId/mandateId via tx-scoped RLS reads → firm-B invisible → null → `NotFoundException`. Unit `OA-R3-1..4` + repo `findX ByIdInTx` (`repository.ts:242-285`).

### 5. Routes live — TRUE
- **Claim:** anon `GET /outreach-activity` → 401 (mounted); web `/outreach/activity` → 307/200; NOT 404.
- **Evidence:** Live probes — `GET /outreach-activity` → **401**; `POST /outreach-activity` → **401** (mounted, fail-closed via SessionGuard, NOT 404). Web `GET https://dealflow-web-production-a4f7.up.railway.app/outreach/activity` → **307** (auth redirect, NOT 404). 404 control: `/nonexistent-xyz-route` → **404** (proves the 307 is a real mounted route, not a catch-all). Controller mounts `@Controller('outreach-activity')` with `@UseGuards(SessionGuard, RolesGuard)` (`controller.ts:83-98`).

### 6. Audit-logged mutations + chain intact — TRUE
- **Claim:** service appends to M2 chain per verb; `/compliance/audit-log/verify` → 401 (not 500 — C-1 readTail-RLS-exempt fix keeps chain valid).
- **Evidence:**
  - Per-verb `auditService.append` LAST-IN-TXN: create `service.ts:146-158` (`outreach-activity-create`), update `:248-258` (`outreach-activity-update`), updateStatus `:302-313` (`outreach-activity-status-transition`), cancel `:347-357` (`outreach-activity-cancel`) — each inside the same `runInTransaction` as the business write (audit fail → rollback).
  - Tests: unit `OA-R4-1..4` (exactly-one append per verb, correct action) + real-DB `OAE-9..12` (`e2e-spec.ts:346-619` — row-count delta = +1, last entry action matches, `verifyChain().ok === true`) + `OAE-13` rollback (injected audit throw → business row NOT persisted, lines 621-685). Assertions check row-count deltas / SQLSTATE / chain state — not merely mock invocation.
  - Live: `GET /compliance/audit-log/verify` → **401** `{Unauthorized}` (NOT 500 → chain reads clean; C-1 readTail-RLS-exempt fix holds). T-9 verdict independently confirms the C-1 fix-forward #2 was a genuine bug-catch (RLS-filtered readTail → genesis 23505 collision under per-workspace first-write) fixed to RLS-exempt global tail — sound because the HMAC chain is global.

### 7. RBAC + credential-free — TRUE
- **Claim:** `@Roles` advisor+admin fail-closed; channel = pure label (no send/ESP import).
- **Evidence:** `controller.ts:59-77` — `OUTREACH_ACTIVITY_ROLES = rolesForRoute('/outreach-activity')` with fail-closed boot assertion (empty → `throw`, refuses to boot). `@Roles(...OUTREACH_ACTIVITY_ROLES)` on GET/POST/PATCH. Unit `OA-RBAC-1..4` (`spec.ts:349-369`): advisor+admin present, analyst+compliance absent. Credential-free: `OA-BNDRY-1/2` (`spec.ts:375-388`) assert service source does not import anthropic/openai/@ai-sdk/langchain/llamaindex NOR nodemailer/sendgrid/postmark/resend/@aws-sdk/client-ses. Schema docstring `SF7`: channel values are pure record labels, no downstream dispatch (`outreach-activity.ts` schema header).

---

## Findings
**Finding count: 1 (non-blocking, INFO)**

1. **[INFO] RLS-GUARD boot line not observable in deployed-state logs.** The `[RLS-GUARD]` startup line was truncated from the C-2 captured log window (disclosed honestly in C-2, not fabricated). The `dealflow_app` isolation guarantee is instead evidenced by `/health db:ok`, fail-closed 401 endpoints, and the CI e2e running AS `dealflow_app` (non-superuser) with `relforcerowsecurity=true` positive control (`OAE-14`). No isolation/security/audit impact — the substituted evidence chain is sound. No action required.

No CRITICAL / HIGH / MEDIUM findings. No Done-Theater, no vacuous R1 write-check, no DEFAULT_WORKSPACE_ID leak, no coverage theater, no spec-vs-deployed drift, no chain corruption. B-6 (head-builder APPROVED) and T-9 (head-tester APPROVED) independently corroborated; CI run 28841757352 provably executed the 9 rls + 12 migration e2e tests as `dealflow_app` with green non-zero counts.

**APPROVE — 1 finding (INFO/non-blocking) — wrote V-1-karen.md**
