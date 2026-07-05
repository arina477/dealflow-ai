# V-1 Karen — Wave 12 (M6 pipeline / deal-stage tracking) reality check

**Verdict: APPROVE**
**Scope:** Load-bearing CLAIMS of wave-12, verified against DEPLOYED reality + repo at merge commit `989fae9` (NOT the diff — B-6 owned that).
**Merge/deploy:** `main @ 989fae9d9d821935f5425f08d33e6b358d694195`. Live: api `https://dealflow-api-production-66d4.up.railway.app` (`/health` → `{status:ok,db:ok,version:989fae9}`) + web `https://dealflow-web-production-a4f7.up.railway.app`.
**Method:** git cat-file/show @989fae9 (not working tree), independent live curl probes, CI run-log inspection on the exact deployed SHA. No claim taken on faith from a sibling deliverable without an independent corroborating signal.

---

## Claim-by-claim findings (8 claims, all TRUE)

### Claim 1 — Files exist @ 989fae9 — **TRUE**
`git cat-file -e 989fae9:<path>` succeeded for every claimed file:
- API module: `apps/api/src/modules/pipeline/{pipeline.service,pipeline.repository,pipeline.controller,pipeline.module,pipeline.spec}.ts` — all 5 present.
- Schema: `apps/api/src/db/schema/pipeline.ts` present.
- Migrations: `apps/api/src/db/migrations/0011_brainy_the_liberteens.sql` + `.down.sql` + `meta/0011_snapshot.json` present.
- Tests: `apps/api/test/pipeline-gate.e2e-spec.ts` + `apps/api/test/_helpers/ensure-migrated.ts` present.
- Shared: `packages/shared/src/pipeline.ts` present.
- Web: `apps/web/app/(app)/pipeline/{page.tsx, page.test.tsx, _components/PipelineBoardClient.tsx, _components/DealTimelinePanel.tsx, _lib/pipeline-types.ts}` present.

### Claim 2 — Exports exist — **TRUE**
Grep of the real files @989fae9:
- `pipeline.service.ts`: `enrollAsActor` (L115), `transitionStageAsActor`, `addNoteAsActor` all declared; eligible-source guard (`outreach.status==='send_eligible'`, L141) + mandate-consistency H-1 check (L151) present.
- `pipeline.repository.ts`: `insertPipeline` (L167, catches `23505`→ caller maps to 409 ConflictException, L164/L193), `insertPipelineEvent` (L272, append-only), `updatePipelineStageInTx` (L245). Plus `findOutreachByIdInTx` (L120) + `findMatchCandidateEligibilityInTx` (L137) used by the H-1 guard.

### Claim 3 — Audit-last-in-txn (rollback-on-audit-fail) — **TRUE**
All 3 mutations wrap `this.repository.runInTransaction(async (tx) => {...})` and call `this.appendAudit(tx, ...)` as the FINAL statement before `return`:
- `enrollAsActor` (`pipeline.service.ts:132`): INSERT pipeline (L194) → INSERT pipeline_events 'enrolled' (L203) → `appendAudit` LAST (L211).
- `transitionStageAsActor` (`:270`): UPDATE stage (L280) → INSERT pipeline_events 'stage_changed' (L288) → `appendAudit` LAST (L297).
- `addNoteAsActor` (`:346`): INSERT pipeline_events 'note' (L355) → `appendAudit` LAST (L365).
`appendAudit` (`:460`) calls `this.auditService.append(auditInput, tx)` — same tx handle. Because audit is the last statement, an audit throw propagates out of the transaction callback → Drizzle `db.transaction()` ROLLBACK → zero orphan pipeline/pipeline_events rows. Confirmed in code, not on faith.

### Claim 4 — H-1 mandate-consistency (the /review-caught fix) — **TRUE**
`enrollAsActor` reads the source's own mandate via the tx-scoped repo methods, then rejects a mismatch BEFORE any INSERT:
- outreach branch: `if (outreachRow.mandateId !== input.mandateId) throw BadRequestException('Source does not belong to mandate...')` (`pipeline.service.ts:151-155`).
- match_candidate branch: same guard on `match_run.mandate_id` vs `input.mandateId` (documented L108, guard L134-135 "verify eligibility first, then verify the source's mandate_id matches input.mandateId").
This is the H-1 cross-mandate provenance guard flagged at B-6 Phase-2 REWORK and resolved in `687f6e6`. Present and correct in the merged code.

### Claim 5 — Migration 0011 applied to the deployed DB — **TRUE (code-side fully proven; LIVE proven with one bounded reliance, stated)**
Code-side: `0011_brainy_the_liberteens.sql` is ADDITIVE-ONLY — `CREATE TYPE pipeline_event_type` + `CREATE TYPE pipeline_stage` (7 values exactly: shortlisted, contacted, engaged, diligence, offer, closed, withdrawn), `CREATE TABLE pipeline` + `pipeline_events`, FKs into existing mandates/outreach/match_candidates/users, partial UNIQUE indexes for idempotent enroll (`pipeline_outreach_id_unique_idx`, `pipeline_match_candidate_id_unique_idx`). ZERO `DROP`/`ALTER COLUMN` on any existing table. Journal: `0011` `when: 1783728000000` > `0010` `when: 1783641600000`. Distinct enum names confirmed.

LIVE (independent probes I ran):
- `GET /pipeline` anon → **401** `{"message":"Unauthorized","statusCode":401}` (NOT 500 relation-does-not-exist, NOT 404 route-missing).
- `POST /pipeline`, `PATCH /pipeline/:id/stage`, `POST /pipeline/:id/notes`, `GET /pipeline/:id/events` anon → all **401**. Routes present, SessionGuard-first.
- `/health` → `db:ok` (live Postgres connectivity).

**Bounded reliance (honestly flagged, not papered over):** SessionGuard fires BEFORE the DB query, so my anon-401 alone does not by itself prove the `pipeline` table exists in the prod DB. The definitive authed `GET /pipeline` → **200 `{byStage:{}}`** grouped-by-stage (table-exists proof) was performed by the C-2 owner (head-ci-cd) via a minted invite→signup advisor session; I did not re-mint that session (requires the full SuperTokens antiCsrf `rid` + web-origin cookie chain). I corroborate the table-exists claim through convergent evidence: (a) 0011 in journal + additive DDL; (b) api preDeploy runs `drizzle-kit migrate` synchronously before serving — the identical one-shot mechanism that applied live-and-serving 0009/0010; (c) `/health db:ok`; (d) the C-1 e2e self-migrated the SAME 0011 schema to green (Claim 7). This is a reliance, not a gap — it does not block APPROVE.

### Claim 6 — Deploy hash match — **TRUE**
`GET /health` → `{"status":"ok","db":"ok","version":"989fae9"}` — version == merge/deploy SHA. Web root → 307→/login (Next.js auth-guard; no /health endpoint, expected). Independently re-curled.

### Claim 7 — The e2e (C-1's compliance proof) is REAL and ACTUALLY RAN GREEN — **TRUE (load-bearing — fully verified)**
- REAL wiring: `pipeline-gate.e2e-spec.ts` instantiates `new PipelineService(new PipelineRepository(db), new AuditService(new AuditKeyring(...), new AuditRepository(db)), authRepo)` against a real `pg.Pool` — un-mocked service+repo+audit. Self-migrates via `ensureMigrated(db, apiMigrationsFolder(__dirname))` (the shared helper). The single `vi.spyOn(auditService,'append').mockRejectedValueOnce(...)` is the deliberate audit-throw injection to FORCE the ROLLBACK path — it is the proof mechanism, not a mock of the business logic. 4 `it()` tests.
- Skip guard: `describe.skipIf(shouldSkip)` where `shouldSkip = !TEST_DATABASE_URL`. CI workflow `.github/workflows/ci.yml` provisions a `postgres:18` service and sets `TEST_DATABASE_URL=postgres://postgres:test@localhost:5432/dealflow_test` — so the suite does NOT skip in CI.
- ACTUALLY RAN GREEN on the exact deployed SHA: CI run `28749460752` (event=push, headSha=`989fae9`, conclusion=success). Run-log line: **`✓ test/pipeline-gate.e2e-spec.ts (4 tests) 1527ms`** — 4 tests executed and passed, NOT skipped, NOT 0-run. This is the audit-rollback proof and it is genuine.

### Claim 8 — Antipattern sweep — **TRUE (nothing claimed-but-fake)**
- Deferred email-send / webhook / AI-drafting HONESTLY absent: the only nodemailer/anthropic/openai/webhook string hits in the pipeline surfaces are (a) NEGATIVE assertions in `pipeline.spec.ts` boundary test (`expect(importLines).not.toMatch(/@anthropic-ai/)` etc., L708-720) and (b) doc-comment exclusions in `pipeline.module.ts` header. Filtering to REAL `import ... from` statements: ZERO forbidden runtime imports (matches were substring false-positives inside `RequestWithSession`/`SessionGuard`/`useState`/`pipelineEventsResponseSchema`). `apps/api/package.json` @989fae9 has NO nodemailer/sendgrid/resend/postmark/@aws-sdk/@anthropic/openai dependency.
- Deferrals documented: H2 configurable-stages deferred (P-3-plan.md:9, product-decision #137); send + AI-drafting exclusions in module header + spec HARD BOUNDARIES.
- Board = 7 FIXED columns (not the mockup's partial labels): `PIPELINE_STAGES = pipelineStageEnum.options` (7 values); `PipelineBoardClient.tsx` renders `PIPELINE_STAGES.map(...)` with all 7 labels (Shortlisted…Withdrawn). C-2's self-grep of the DEPLOYED authed HTML confirmed all 7 `data-stage` columns render with zero send/schedule/email/AI-draft affordances.

---

## Bullshit-detector summary
No Done-Theater found. The single load-bearing compliance invariant (audit last-in-txn + real-DB rollback → no orphan rows) is proven by a genuinely un-mocked e2e that verifiably ran green (4/4) on the exact deployed commit. Files, exports, migration, H-1 fix, and deploy-hash all check out against `989fae9`, not the working tree. The one honest boundary — a full live enroll→transition→note smoke was NOT assembled (prod has no `send_eligible` source; would need the whole wave-10/11 sourcing+SoD chain) — is explicitly stated in C-2 and does not undermine the verified claims: the code path is proven in CI against real Postgres, and live endpoints are present + RBAC-guarded + FK-guarded (no relation-missing 500).

## Severity ledger
- Critical: 0
- High: 0
- Medium: 0
- Low: 1 — Claim 5 LIVE table-exists rests on the C-2-owner's authed-200 probe + convergent evidence rather than a Karen-independent authed-200 (SessionGuard-first makes anon-401 insufficient alone). Bounded, non-blocking; recommend V-block note it as a reliance, not a defect.

## Verdict
**APPROVE** — all 8 load-bearing claims verified TRUE against deployed state + repo @989fae9. One Low-severity bounded reliance recorded (not a gap).
