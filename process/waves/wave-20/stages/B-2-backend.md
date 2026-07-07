# Wave 20 — B-2 Backend (tasks 5c12ac3a + b2acf4ce)

**Status: DELIVERED**

---

## Files created

### Module
`apps/api/src/modules/outreach-activity/outreach-activity.module.ts`
- Imports: AuditModule, AuthModule
- Providers: dbProvider, OutreachActivityRepository, OutreachActivityService
- Controller: OutreachActivityController

### Repository
`apps/api/src/modules/outreach-activity/outreach-activity.repository.ts`

Methods:
- `runInTransaction<T>(work)` — transaction helper (getDb() ALS-scoped)
- `insertActivity(tx, input)` — INSERT with `workspaceId: sql\`NULLIF(...)\`` (SF1 HIGH, no DEFAULT_WORKSPACE_ID)
- `findActivityByIdInTx(tx, id)` — SELECT by id (tx-scoped, RLS)
- `updateActivityInTx(tx, id, fields)` — partial UPDATE (tx-scoped, RLS; throws NotFoundException)
- `listActivities(filter?)` — SELECT with optional status filter (getDb ALS-scoped)
- `findOutreachByIdInTx(tx, id)` — FK tenancy validation for outreach (R3/SF4)
- `findMatchCandidateByIdInTx(tx, id)` — FK tenancy validation for match_candidates (R3/SF4)
- `findPipelineByIdInTx(tx, id)` — FK tenancy validation for pipeline (R3/SF4)
- `findMandateByIdInTx(tx, id)` — FK tenancy validation for mandates (R3/SF4)

### Service
`apps/api/src/modules/outreach-activity/outreach-activity.service.ts`

Methods: `create`, `list`, `update`, `updateStatus`, `cancel`

**SF1 guard:** `create()` calls `getWorkspaceId()` and throws `ForbiddenException` if null. No `?? DEFAULT_WORKSPACE_ID` anywhere.

**R3/SF4 pattern:** every provided deal-target FK (outreachId, matchCandidateId, pipelineId, mandateId) validated inside the tx via RLS-scoped read. If null (firm-B row invisible) → throws NotFoundException. `createdBy` is set from `authRepository.getUserWithRole(supertokensUserId).id` — NEVER from client input.

**R4/SF5 pattern:** every mutation calls `this.appendAudit(tx, {...})` as the LAST await inside `runInTransaction`. Audit failure → rollback (no business row persisted).

| Method | Audit action |
|---|---|
| create | 'outreach-activity-create' |
| update | 'outreach-activity-update' |
| updateStatus | 'outreach-activity-status-transition' |
| cancel | 'outreach-activity-cancel' |

### Controller
`apps/api/src/modules/outreach-activity/outreach-activity.controller.ts`

Endpoints:
- `GET /outreach-activity` — advisor, admin
- `POST /outreach-activity` — advisor, admin (201 Created)
- `PATCH /outreach-activity/:id` — advisor, admin (200 OK)

PATCH routing: status='cancelled' → service.cancel() (distinct audit verb); status='completed'/'planned' with NO other fields → service.updateStatus(); else → service.update().

Fail-closed boot assertions: if `rolesForRoute(...)` returns empty array → throws at module load time (refuses to boot).

---

## Test files created

### Unit tests (DETERMINISTIC-TEST-SPEC-FIRST)
`apps/api/src/modules/outreach-activity/outreach-activity.spec.ts`

19 tests — ALL PASS:
- OA-SF1-1: create() + null workspace → ForbiddenException, no INSERT
- OA-R1-1/2: createSchema + updateSchema reject workspaceId
- OA-R3-1/2/3/4/5: cross-firm FK NotFoundException + createdBy=actor.id
- OA-R4-1/2/3/4: per-verb audit action string assertions
- OA-RBAC-1/2/3/4: advisor+admin allowed, analyst+compliance excluded
- OA-BNDRY-1/2: no AI/LLM or email SDK imports
- OA-DI-1: service instantiation smoke

### E2E write-path tests (fail-first)
`apps/api/test/outreach-activity-rls.e2e-spec.ts`

Tests (require TEST_DATABASE_URL + 0018 migration):
- OAE-1 (R1): own-row UPDATE SET workspace_id=WS_B → 42501
- OAE-2 (R1): INSERT with explicit WS_B workspace_id under WS_A GUC → 42501
- OAE-3 (SF1): service.create() with empty ALS → ForbiddenException, row NOT in default workspace
- OAE-9 (R4/SF5): create() appends 'outreach-activity-create' + verifyChain ok
- OAE-10 (R4/SF5): update() appends 'outreach-activity-update' + verifyChain ok
- OAE-11 (R4/SF5): updateStatus() appends 'outreach-activity-status-transition' + verifyChain ok
- OAE-12 (R4/SF5): cancel() appends 'outreach-activity-cancel' + verifyChain ok
- OAE-13 (R4/SF5 rollback): audit throw → business row NOT persisted
- OAE-14 (R2/SF3): relrowsecurity AND relforcerowsecurity true as dealflow_app

---

## Module registration

`apps/api/src/app.module.ts` — `OutreachActivityModule` added after `OutreachModule`:
```typescript
OutreachModule,
// Wave-20 (task 5c12ac3a / b2acf4ce): outreach-activity tracker (M9).
OutreachActivityModule,
PipelineModule,
```

---

## Typecheck: CLEAN (4/4 packages)
## Unit tests: 19/19 PASS
