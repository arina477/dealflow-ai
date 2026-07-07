# Wave 23 — B-6 Review gate verdict (Phase 1)

**Block:** B (Build) | **Stage:** B-6 Review | **Wave topic:** M9 seller-intent vertical (pure scorer + workspace-scoped service + shared-Zod contracts + RBAC API + /insights UI)
**Branch:** wave-23-seller-intent
**Attempt:** 1
**Gate agent:** head-builder (fresh spawn)
**claimed_task_ids:** 9e54cc11 (scorer+service), 1188e7da (contracts), 12947422 (RBAC API), 6840c25d (/insights UI)

---

## Stage-entry gate

Prior stages B-0..B-5 all `done` per review-artifacts.md. B-0 schema SKIP (read-only aggregation over existing columns — outreach_activity / pipeline_events / match_candidates). Entry accepted.

```json
{
  "agent": "head-builder",
  "stage": "B-6",
  "status": "gating",
  "block_state": {
    "claimed_task_ids": ["9e54cc11", "1188e7da", "12947422", "6840c25d"],
    "contracts_frozen": true,
    "test_gate_results": { "api": "857 pass / 93 skip", "web": "837 pass", "shared": "pass", "scorer_unit": 26, "cross_firm_e2e": "CI real-DB (dealflow_app)" },
    "reviewer_verdicts": {}
  }
}
```

---

## P-4 OBLIGATION VERIFICATION (SI1–SI4) — each traced to shipped code

### SI1 — NO tieBreak surfaced (PRODUCT #1) — **PASS**
- `packages/shared/src/seller-intent.ts` `sellerIntentBreakdownSchema` (lines 62-70): fields are exactly `{ outreachEngagement, pipelineVelocity, matchDisposition, total, notApplied }`. NO `tieBreak` key.
- `seller-intent.scorer.ts` return breakdown (lines 429-435): same 5 fields, no tieBreak.
- Order-stabilization is query/service-layer only: `seller-intent.service.ts` (lines 116-122) sorts by `(mandate.createdAt ASC, mandate.id ASC)` — NOT a scored dimension; repository Q1 (lines 106-110) fetches mandates for that order.
- Tests assert absence: `seller-intent.scorer.spec.ts` group C (lines 202-238) — `expect('tieBreak' in out.breakdown).toBe(false)`, `expect(schemaKeys).not.toContain('tieBreak')`, and exact-key-set assertion.
- UI: grep of `apps/web/app/(app)/insights/page.tsx` shows every `tieBreak` reference is a code comment asserting it is NEVER surfaced (lines 31, 39, 220, 326, 654, 712, 948). NO user-visible "tie-break" text. Commit `525667f` shows an earlier B-3 attempt DID surface visible tie-break text — caught and removed under SI1 (the gate obligation worked as intended).

### SI2 — window/epsilon pinned + tested — **PASS**
- Named constants in `seller-intent.scorer.ts`: `WINDOW_DAYS = 30` (line 63), `DIRECTION_EPSILON = 5` (line 70), `MS_PER_DAY = 86_400_000` (line 73) — all `export const`, deterministic (MS_PER_DAY explicitly NOT Date.now()).
- Direction = sign of (recentWindowScore − priorWindowScore) with epsilon guard (lines 421-423): `delta > EPSILON → heating`, `delta < -EPSILON → cooling`, else `flat`. |delta| ≤ EPSILON → flat (flat at exactly EPSILON via strict `>`/`<`).
- Epsilon-boundary tests: spec group D (lines 244-345) — heating/cooling paths + `delta === DIRECTION_EPSILON → 'flat'` (lines 273-296) + `delta === EPSILON+1 → 'heating'` + a direct boundary assertion (lines 337-344).
- Minor doc nit (non-blocking): the JSDoc on line 68 says "delta = EPSILON → 'flat'; delta = EPSILON+1 → 'heating'" which matches the code; an earlier informal comment fragment reads "delta ≥ 5 → heating" (line 25) — the executable code and the authoritative test (line 342) both confirm flat-at-EPSILON. No behavioral defect. Logged as a cosmetic docstring cleanup for L-block, not REWORK.

### SI3 — referenceInstant + empty-data — **PASS**
- referenceInstant derived by the service/repository layer (scorer never calls Date.now(); it is passed IN): `seller-intent.repository.ts` `getAll()` (lines 190-211) computes workspace max-event-ts across activity(completedAt ?? createdAt) / pipeline_events.createdAt / match_candidates.createdAt, with documented fallback to mandate max createdAt when no events, and a sentinel `1970-01-01T00:00:00.000Z` for the zero-mandate workspace (lines 112-122). Documented in the SI3 header block (lines 27-33) and scorer input JSDoc (lines 131-140).
- Empty/single-event → defined score/direction, no crash/div-by-zero: scorer guards each signal on `.length === 0` → notApplied (lines 302-304, 337-338, 366-368); disposition guards `candidates.length === 0` (line 253). Tests: spec group E (empty → score 0, all notApplied, direction flat, `not.toThrow()`, lines 351-374) + group F (single-event boundaries: 1 activity, 1 enrolled event, 1 pending candidate — all no-crash, lines 380-433).

### SI4 — log wave-23 decomposer decision in product-decisions.md — **DOWNSTREAM (not B-6-blocking)**
- P-4 obligation SI4 is explicitly "before N-3", not a B-6 gate condition. Verified present as a downstream obligation; product-decisions.md carries prior decomposer entries. Carried forward to N-block — NOT a B-6 blocker. head-next must confirm the wave-23 seller-intent decomposer decision is appended before N-3 archive.

---

## LOAD-BEARING invariant verification

### Pure + deterministic scorer (the hard boundary) — **PASS**
- `grep -rniE "anthropic|openai|@ai-sdk|fetch\(|axios|http|bullmq|llm|claude"` over scorer+service+repo → NONE (excluding comments). NO Math.random, NO Date.now() inside the scorer executable path (only `Date.parse` of caller-supplied fixed ISO strings — deterministic, not current time; documented lines 164-173).
- Determinism test present: spec group A (lines 140-170) — byte-identical output for repeat calls + time-invariance via fixed referenceInstant. Group B (lines 176-196) grep-asserts the scorer SOURCE (comments stripped) contains no `Date.now(` and no `Math.random(` — guards future regressions.
- Genuinely pure: no I/O, no side effects — scorer takes plain arrays + a string in, returns an object. Service delegates all scoring to it.

### Workspace-scoped + cross-firm negative-read (REAL, fault-killing) — **PASS**
- Every repository query via `getDb(this.db)` (lines 104, 108, 128, 152, 174) → ALS GUC-bound dedicated pg Client → FORCE RLS under dealflow_app. Service is fail-closed: `getWorkspaceId() === null` → THROWS (service lines 60-66) rather than falling back to the all-tenant singleton.
- `apps/api/test/seller-intent-isolation.e2e-spec.ts` invokes the REAL `SellerIntentService` (NOT re-implemented SQL) via `workspaceAls.run` after `SET ROLE dealflow_app` + `set_config('app.workspace_id', ...)` (lines 360-402). SIT-1: WS_A mandate IDs present, WS_B absent (lines 406-433). SIT-2: positive control — A1 outreachEngagement > 0 (lines 437-453). **SIT-3 fault-killing**: no-ALS `getList()` → `rejects.toThrow('fail-closed')` (lines 467-489) — proves the null-check is active; if removed AND getDb bypassed, SIT-1 catches the leak. Runs in CI real-DB per B-5.

### Read-only — **PASS**
- Write-op sweep over the module → NO `.insert(`/`.update(`/`.delete(`/`AuditService.append` in executable code (only a comment asserting no audit append). Service + repository issue SELECT-only queries. Correctly computable over real columns (outreach_activity status/channel/completedAt, pipeline_events, match_candidates.disposition). Read-only surface → no audit row required (same class as analytics/match-feedback).

### RBAC advisor+admin — **PASS**
- `packages/shared/src/rbac.ts` (lines 704-707): `{ pattern: '/seller-intent', allowedRoles: ['advisor', 'admin'] }`. Controller resolves roles at boot and refuses to boot on `[]` drift (lines 38-45); guarded by `SessionGuard` (401 anon) + `RolesGuard` (403 wrong role). Spec group H asserts advisor+admin included, analyst+compliance excluded (lines 545-557).

---

## General B-6 checks

- **No schema change** — B-0 SKIP confirmed (read-only aggregation over existing tables). No migration.
- **No over-engineering / no scope creep** — three named scoring signals, pinned constants, plain procedural scorer. No speculative generality, no abstract repository. Maps directly to ACs + SI1–SI4.
- **Contracts (shared-Zod)** — `z.infer` used throughout; READ shapes `.passthrough()` (server-may-add-fields convention); response validated at the UI boundary with `.safeParse` (page.tsx line 175 — not throwing `.parse`).
- **UI** — /insights renders score + direction chip (heating/cooling/flat) + 3-signal breakdown with notApplied "—" handling; empty + error states present; no tieBreak, no gold-plating. Two `SellerIntentSection` renders are in mutually-exclusive branches (empty-analytics early-return vs main return) — not a duplicate.
- **Wiring** — SellerIntentModule registered (app.module.ts:46); GET /seller-intent + web /seller-intent proxy + /insights section + rbac all present; B-4 typecheck 4/4, no drift.
- **Test gate (no hollow tests)** — scorer 26 unit tests carry semantic assertions (state values, boundary deltas, cap values, no-crash); the cross-firm e2e drives the REAL service (not mocked SQL). api 857 pass / web 837 pass / shared pass; lint 3/3; build 3/3.
- **Commit-per-spec** — B-1 contracts (d7ae070), B-2 scorer+service+API (8c27c7c), B-3 UI + SI1 tie-break-text removal (525667f), B-5 a11y/lint fix (5e69d7a). Clean lineage.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  reviewers: {}   # Phase-1 gate walked from concrete artifacts; no re-delegation required — all checks tickable
  failed_checks: []
  rationale: >
    Every SI1–SI4 obligation and every load-bearing invariant is verified against shipped
    code, not inferred. The scorer is genuinely pure + deterministic (no LLM/SDK/network/
    randomness, no Date.now() in the executable path — referenceInstant + trend windows are
    passed in and grep-asserted absent by a source-level test). SI1 holds: no tieBreak in the
    scorer output, the shared Zod breakdown, or the UI (only comments), with tests asserting
    absence — an earlier B-3 attempt that surfaced visible tie-break text was caught and
    removed (525667f). SI2 pins WINDOW_DAYS=30 / DIRECTION_EPSILON=5 with an epsilon-boundary
    test (flat at exactly EPSILON). SI3 derives referenceInstant as workspace max-event-ts with
    documented empty/zero-event fallbacks and empty/single-event no-crash tests. The cross-firm
    negative-read e2e is REAL and fault-killing: it drives the actual SellerIntentService via
    workspaceAls.run as dealflow_app under FORCE RLS (WS_A present, WS_B absent), and SIT-3
    proves the fail-closed no-ALS throw. The service is strictly read-only (no writes, no audit
    append) over real columns, gated advisor+admin (401/403). SI4 (product-decisions log) is a
    pre-N-3 obligation, not a B-6 blocker, and is carried forward to head-next. One cosmetic
    docstring inconsistency in the scorer (line-25 fragment vs authoritative line-68 doc + the
    boundary test) is non-behavioral — logged for L-block cleanup, not REWORK.
  next_action: PROCEED_TO_C-block
  downstream_obligations:
    - SI4: append the wave-23 seller-intent decomposer decision to command-center/product/product-decisions.md before N-3 (head-next to confirm).
    - L-block cosmetic: reconcile scorer JSDoc line-25 "delta ≥ 5 → heating" fragment with the authoritative flat-at-EPSILON contract (line 68 + spec line 342). Non-behavioral.
```
