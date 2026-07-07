# B-2 Backend — wave-23 seller-intent scoring

**Tasks:** 9e54cc11 (scorer + service + repository), 12947422 (controller + RBAC)
**Branch:** wave-23-seller-intent
**Commit:** 8c27c7c

## Deliverables

### apps/api/src/modules/seller-intent/seller-intent.scorer.ts

Pure deterministic scorer. Exported constants and function:

```typescript
export const WINDOW_DAYS = 30;
export const DIRECTION_EPSILON = 5;
export const MS_PER_DAY = 86_400_000;
export function scoreMandateIntent(input: SellerIntentScorerInput): SellerIntentScorerOutput
```

Signals:
- outreachEngagement (0-40): baseScore(min(completed×5, 25)) + channelScore(min(channels×3, 12)) + recencyBonus(3/1/0)
- pipelineVelocity (0-35): stageScore(min(maxDepth×5, 25)) + velocityScore(10/6/3/0 for 3+/2/1/0 transitions)
- matchDisposition (0-25): round(positiveRatio × 25) where positive = accepted + flagged

Direction: windowed delta (recent window vs prior window, both WINDOW_DAYS wide), threshold DIRECTION_EPSILON.

### apps/api/src/modules/seller-intent/seller-intent.repository.ts

Workspace-scoped read-only repository. Single `getAll()` method using `getDb(this.db)`.
Four batch queries:
- Q1: mandates (workspace-scoped via FORCE RLS)
- Q2: outreach_activity WHERE mandate_id IN (ids) AND mandate_id IS NOT NULL
- Q3: pipeline_events INNER JOIN pipeline WHERE pipeline.mandate_id IN (ids)
- Q4: match_candidates INNER JOIN match_run WHERE match_run.mandate_id IN (ids)

SI3 referenceInstant: max of all event timestamps; fallback to mandate max createdAt; sentinel '1970-01-01T00:00:00.000Z' for empty workspace.

### apps/api/src/modules/seller-intent/seller-intent.service.ts

Orchestrator. Fail-closed: throws if getWorkspaceId() === null. Groups raw data by mandateId, calls scoreMandateIntent per mandate. Stable ordering: createdAt ASC, id ASC. READ-ONLY (zero writes, zero audit rows).

### apps/api/src/modules/seller-intent/seller-intent.controller.ts

GET /seller-intent. @UseGuards(SessionGuard, RolesGuard). @Roles(advisor, admin). Fail-closed at boot: rolesForRoute('/seller-intent').length === 0 → throws.

### apps/api/src/modules/seller-intent/seller-intent.module.ts

imports: [AuthModule]. providers: [dbProvider, SellerIntentRepository, SellerIntentService].

### apps/api/src/app.module.ts (EDITED)

SellerIntentModule registered.

### apps/api/src/modules/seller-intent/seller-intent.scorer.spec.ts

26 unit tests — all pass. Coverage:
- A: Determinism (snapshot, time-invariance)
- B: NO Date.now() call / NO Math.random() call (grep via comment-stripped source)
- C: [SI1] NO tieBreak in breakdown, Zod schema shape exact
- D: [SI2] direction heating/cooling/flat + epsilon boundary (delta === EPSILON → flat, delta === EPSILON+1 → heating)
- E: [SI3] empty-data boundary (score=0, all in notApplied, direction=flat)
- F: [SI3] single-event boundary (no crash)
- G: Signal weights (outreachEngagement=40 cap, completionScore=25 cap, withdrawn excluded, matchDisposition math)
- H: RBAC contract (advisor+admin in, analyst+compliance out)

### apps/api/test/seller-intent-isolation.e2e-spec.ts

Cross-firm e2e via REAL SellerIntentService + workspaceAls.run (mirrors analytics-isolation.e2e-spec.ts pattern):
- SIT-1: WS_A results contain WS_A mandate IDs; WS_B mandate IDs fully absent + raw-SQL secondary proof
- SIT-2: Positive control — WS_A results non-empty; mandate A1 outreachEngagement > 0
- SIT-3: Fault-killing — no-ALS call THROWS with 'fail-closed' message

Skipped when TEST_DATABASE_URL is unset. Teardown: outreach_activity → mandates (FK-safe order, WORM-safe).

## SI Invariant Confirmations

| Invariant | Status | Evidence |
|-----------|--------|---------|
| SI1: NO tieBreak | CONFIRMED | `sellerIntentBreakdownSchema.shape` has no `tieBreak` key; scorer output breakdown has no `tieBreak` field; test C asserts both |
| SI2: WINDOW_DAYS + DIRECTION_EPSILON as named constants | CONFIRMED | Exported constants in scorer.ts; test D asserts epsilon boundary |
| SI3: referenceInstant = workspace max-event-ts | CONFIRMED | Repository derives max from all event timestamps, falls back to mandate createdAt; scorer never calls Date.now(); test B asserts grep |
| Cross-firm: REAL service through workspaceAls.run | CONFIRMED | e2e SIT-1 uses REAL SellerIntentService, fault-killing in SIT-3 |
| READ-ONLY: zero mutations, zero audit rows | CONFIRMED | Repository has no INSERT/UPDATE/DELETE; service has no AuditService call |

## Typecheck

`pnpm -w typecheck` → 4/4 tasks successful (0 errors).

## Unit test result

26/26 pass in `apps/api/src/modules/seller-intent/seller-intent.scorer.spec.ts`.

## Deviations

None. All SI1/SI2/SI3 invariants met. No tieBreak anywhere. Pure scorer. Workspace-scoped. Read-only.
