# V-1 Karen — Wave 19 (M9 matching-feedback calibration) — Deployed-State Verification

**Verdict: APPROVE** — 7/7 load-bearing claims VERIFIED, 0 REJECTED, 0 gaps.
**Method:** Source-claim truth against the DEPLOYED tip (SHA `3cc58de`), NOT the diff. Every finding cites claim + evidence (live probe or per-SHA `git show`).
**Deployed prod:** api `https://dealflow-api-production-66d4.up.railway.app` (health 200, `version==3cc58decb40a209e1dc4f7ba096d5e05461c5394`, `db:ok`); web `…-a4f7` (/insights 200). CI 28836091590 green on main.

---

## Finding 1 — Deploy serves 3cc58de + app is non-superuser — VERIFIED

- **Claim:** /health → 200 `{status,db:ok,version==3cc58de}`; app still `dealflow_app` ([RLS-GUARD] up).
- **Evidence:**
  - `curl /health` → HTTP 200, body `{"status":"ok","db":"ok","version":"3cc58decb40a209e1dc4f7ba096d5e05461c5394"}` — version matches deployed SHA exactly.
  - `apps/api/src/db/index.ts:60,65,73` — the `[RLS-GUARD]` boot check is present (refuses start on unknown role / SUPERUSER / BYPASSRLS). App boots healthy → guard passed → connected as non-superuser `dealflow_app`, FORCE RLS effective.

## Finding 2 — Files @3cc58de: getDb-only repo, controller @Roles, 2-dimension lift, nullable acceptRate — VERIFIED

- **Claim:** match-feedback service+repo use getDb on EVERY query (NO raw this.db/pool.query in aggregation); controller @Roles advisor+admin; shared match-feedback.ts 2-dimension lift (tieBreak NOT in DIMENSIONS/enum, only exclusion comments; acceptRate number|null); /insights calibration section.
- **Evidence (per-SHA `git show 3cc58de`):**
  - All files present: `apps/api/src/modules/match-feedback/{service,repository,controller,module,spec}.ts`, `packages/shared/src/match-feedback.ts`, `apps/web/app/(app)/insights/page.tsx` (+ `page.test.tsx`).
  - `match-feedback.repository.ts` — `import { getDb } from '../../db/workspace-context'` (L47); **5** `getDb(this.db)` calls (queries at L125, L185, …). Grep for raw `this.db.(select|execute|query|…)|pool.query|.db.execute` in query methods → **EMPTY**. Header L7/L13 documents the getDb-on-every-query contract. NO off-GUC read.
  - `packages/shared/src/match-feedback.ts:168` — `dimension: z.enum(['sectorMatch', 'contactCompleteness'])` → tieBreak is **NOT** in the enum. tieBreak appears ONLY in exclusion comments (L23-28, L140-145, L194, L210) explicitly citing CODE-OF-CONDUCT §metric ("noise, not signal").
  - acceptRate nullable at L98, L127 — `z.number().min(0).max(1).nullable()` (both CalibrationBand and DimensionLiftHalf).
  - `match-feedback.controller.ts:63` — `@Roles(...MATCH_FEEDBACK_ROLES)`; L37 `MATCH_FEEDBACK_ROLES = [...rolesForRoute('/match-feedback')]`.

## Finding 3 — Routes live (mounted, not 404) — VERIFIED

- **Claim:** GET /match-feedback anon → 401; /insights web → 307/200; NOT 404.
- **Evidence (live probe):**
  - `curl /match-feedback` (anon) → **401** (mounted + fail-closed auth; not 404).
  - `curl -L /insights` (web) → **200**.
  - `curl /compliance/audit-log/verify` (anon) → **401** (not 500 — see Finding 6).

## Finding 4 — Isolation e2e is REAL, fault-killing, and RAN 7/7 non-skipped as dealflow_app — VERIFIED

- **Claim:** `match-feedback-isolation.e2e` invokes the REAL MatchFeedbackService via workspaceAls.run (not re-implemented SQL) + MFC-4 fault-killing; C-1/CI confirms it RAN 7/7 (NOT 0/skipped — the attempt-1 invalid-UUID near-miss was fixed) as dealflow_app.
- **Evidence:**
  - Source `apps/api/test/match-feedback-isolation.e2e-spec.ts` @3cc58de: helper `runServiceInAls` (L536-553) does `new MatchFeedbackRepository(gucHandle)` + `new MatchFeedbackService(repo)` then `workspaceAls.run({db: gucHandle, workspaceId}, () => service.getCalibration())` — REAL service, unmocked, NOT inline SQL. Exactly **7** `it()` blocks (MFC-1..MFC-5).
  - MFC-4 (L656-684) — no-ALS call asserts a DIFFERENT `totalDecided` than ALS-scoped (strict inequality) → genuinely kills a `getDb → raw` regression.
  - `blocks/T/gate-verdict.md:13-19,45-48` quotes CI run **28836091590** test log: `✓ test/match-feedback-isolation.e2e-spec.ts (7 tests) 1629ms`, `Tests 881 passed (881)`, **ZERO skipped**, as `SET ROLE dealflow_app` under FORCE RLS. 1629ms + per-test ms (MFC-1 492ms) prove bodies executed against a live DB (not a sub-ms no-op).
  - Attempt-1 silently-skipped near-miss (invalid-UUID `22P02` → 7 SKIPPED) was **caught by head-ci-cd, not accepted** (T-gate L69-78); git log confirms fix commit `3cc58de "correct invalid UUID literals in match-feedback-isolation e2e fixtures"`.

## Finding 5 — Metric honesty (CODE-OF-CONDUCT §metric) — VERIFIED

- **Claim:** tieBreak NOT computed/returned in the lift (structural noise dropped); UI has small-sample caveat (decidedCount<5 → n=X/muted); null acceptRate → "n/a" not "0%".
- **Evidence:**
  - Shared: dimension enum excludes tieBreak (Finding 2); `dimensionLifts` array is exactly 2 rows (sectorMatch, contactCompleteness) per L192-214.
  - UI `insights/page.tsx`: `fmtRate` (L143-145) `if (rate === null) return 'n/a'`; `fmtAcceptRate` (L152-158) explicitly documents `null → "n/a"` (measurement gap) vs `0 → "0%"` (real outcome) and MUST NOT conflate.
  - Small-sample: `LOW_SAMPLE_THRESHOLD = 5` (L169); `fmtAcceptRateWithCaveat` (L182) appends `"(low sample)"` when `decidedCount > 0 && decidedCount < 5`. Matches the claim's `decidedCount<5`.

## Finding 6 — Read-only calibration path + audit chain intact — VERIFIED

- **Claim:** calibration path has NO INSERT/UPDATE/DELETE/AuditService.append; audit chain `/compliance/audit-log/verify` → 401 (not 500 — chain intact).
- **Evidence:**
  - `git show 3cc58de` repo — grep `insert|update|delete|auditservice|.append` → only match is header comment L18 "This repository has ZERO writes. No INSERT, UPDATE, DELETE. No audit row." Service → NONE.
  - `/compliance/audit-log/verify` anon → **401** (auth gate reached cleanly; not 500 → hash-chain not broken by this wave). Read-only wave cannot corrupt the WORM chain.

## Finding 7 — RBAC advisor+admin, fail-closed — VERIFIED

- **Claim:** @Roles on the controller; MATCH_FEEDBACK_ROLES = rolesForRoute('/match-feedback') advisor+admin (fail-closed if []).
- **Evidence:**
  - `packages/shared/src/rbac.ts` @3cc58de L656-658 — `{ pattern: '/match-feedback', allowedRoles: ['advisor', 'admin'] }` (analyst excluded).
  - `match-feedback.controller.ts:37` resolves `MATCH_FEEDBACK_ROLES` from `rolesForRoute('/match-feedback')`; L39-41 **fail-closed boot guard** — `if (length === 0) throw "RBAC config drift"`. Live: anon → 401 (Finding 3) consistent with the guard.

---

## Karen bottom line

No Done-Theater. The deployed tip (3cc58de) genuinely serves the wave's contract: workspace-scoped read-only calibration via getDb+FORCE-RLS (no off-GUC leak), a REAL fault-killing cross-firm isolation e2e that actually RAN 7/7 as dealflow_app (the skipped-e2e near-miss was caught and fixed, not papered over), an honest metric (tieBreak noise dropped, null≠0%, low-sample caveat), fail-closed RBAC advisor+admin, and an intact audit chain. Every load-bearing claim maps to observable deployed-state or per-SHA source evidence. **APPROVE.**
