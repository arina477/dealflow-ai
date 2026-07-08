# T-8 Security + T-9 Journey — Gate Verdict (wave-28, M10 RETENTION policy)

**Block:** T (Test) · **Stages:** T-8 Security (MANDATORY-tightened) + T-9 Journey (block-exit) · **Wave:** 28
**Branch:** `wave-28-retention-policy` · **LIVE @775cd67** (migration 0020 applied to prod, RLS enforcing)
**Gate agent:** head-tester (fresh spawn) · **CI:** run 28927123301 — all 5 jobs green
**Verdict:** **APPROVED**

Distrust-the-green posture: every check below is traced to actual shipped code / CI log artifacts read this session — NOT inherited from B-6 or the CI badge.

---

## T-8 Security — each crux verified GENUINE (fault-killing, not coverage-theater)

### 1. RLS-config-isolation (CRUX) — PASS · GENUINE
`apps/api/test/retention-policy-isolation.e2e-spec.ts`:
- **Runs as `dealflow_app`, NOT postgres.** `withWorkspace()` issues `SET ROLE dealflow_app` (line 115) with an explicit inline comment naming the 0016 false-green superuser-BYPASSRLS trap it avoids. Superuser would bypass FORCE RLS → silent false-green; this test does not.
- **RET-ISO-1 (cross-firm read isolation):** firm A seeded 2000 days, firm B 365. As `dealflow_app` under GUC=WS_A inside `workspaceAls.run`, the REAL `service.getPolicy()` returns **2000**; the negative case (GUC=WS_B) returns **365** and asserts `not.toBe(2000)` (lines 320, 335-336). A leak (A reading B's row) would fail the assertion — fault-killing, not tautological.
- **RET-ISO-2 (foreign-workspace write REJECTED — SEC-A WITH-CHECK):** as `dealflow_app` with GUC=WS_A, a direct `(repo as any).upsert(WS_B_ID, 3000, ...)` → `rejects.toThrow()` (lines 359-368). The RLS WITH-CHECK (auto-derived from the USING policy) is the fault that throws. If RLS were absent/misconfigured the write would succeed and the test would fail — genuinely fault-killing.
- **20 tests RAN, not skipped.** CI test-job log: `✓ test/retention-policy-isolation.e2e-spec.ts (20 tests) 1525ms`; skip sentinel `TEST_DATABASE_URL is not set — suite SKIPPED` grep count = 0 (`describe.skipIf(shouldSkip)` executed because CI set TEST_DATABASE_URL). A skipped suite would be ~0ms; 1525ms against real Postgres confirms live execution.
- **DB-layer proof:** CI log shows `ERROR: new row violates row-level security policy for table "workspace_retention_policy"` on the exact upsert statement — the policy actively rejecting a foreign write. Migration-0020-applied is OBSERVED at the DB, not inferred.

### 2. WORM-preservation (CRUX) — PASS · GENUINE (end-to-end boundary holds)
- **Service** (`retention-policy.service.ts`): the ONLY write to the audit log is `auditService.appendStandalone({ action: 'retention.policy.updated', ... })` (lines 118-128), fired ONLY when `newDays !== oldDays` (line 117 — no spurious no-op entries). NO delete/update/mutate of `audit_log_entries` anywhere. Actor + `contentHash(old_days→new_days)` + `payloadHash` carried (SEC-C).
- **No deletion endpoint:** controller has GET + PUT only; no DELETE handler; documented "retention policy is permanent once created."
- **DB backstop:** the wave-4 `audit_log_no_mutate` BEFORE UPDATE/DELETE/TRUNCATE trigger still guards `audit_log_entries` — deletion impossible even if attempted.
- **RET-WORM-1:** after `setPolicy({retentionPeriodDays:1825})`, audit count `=== before+1` AND `AuditVerifier.verifyChain().ok === true` (lines 404, 416) — the real verifier, not a mock. verifyChain-ok-AFTER-change confirmed.
- **RET-WORM-2:** after a `setPolicy`, count `>= before` (line 452) — proves no deletion path.
- **UI no-purge (asserted, both layers):** `page.test.tsx` asserts NO `<button>` with text matching `/purge|delete|clean/i` on the page (lines 282-288), in the form idle + loading states (lines 467-491), AND no element with `aria-label` matching that pattern (lines 493-504). The cutoff panel is `role="note"`, read-only, has zero interactive affordances (lines 451-461), and renders "Records are preserved. Deletion is not performed automatically" (lines 441-449). The WORM boundary holds from service → DB trigger → UI.

### 3. RLS-on-the-new-table is REAL — PASS
`apps/api/src/db/migrations/0020_retention_policy.sql` (a NEW table inherits no RLS):
- `ENABLE ROW LEVEL SECURITY` (line 79) + `FORCE ROW LEVEL SECURITY` (line 80) — FORCE is mandatory because the API runs as the table-owning role; without it every isolation test is a false-green.
- `CREATE POLICY "workspace_isolation" USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)` (lines 101-102) — USING-only (PG auto-derives WITH CHECK = USING), NULLIF empty-string shape → RESET-safe fail-closed (0017 pattern).
- **[SEC-B]** `GRANT SELECT, INSERT, UPDATE, DELETE ... TO dealflow_app` (line 114) — explicit per-table, no wildcard.
- **Applied + enforcing in prod:** C-2 prod deploy log `[✓] migrations applied successfully!`; CI log shows the policy rejecting a foreign write. Live-enforcing confirmed.

### 4. SEC-A/B/C — PASS
- **SEC-A** server-resolved upsert: `workspace_id = getWorkspaceId()` (service line 103); controller passes NO workspace id from the request; `setRetentionPolicySchema.strict()` in the controller `safeParse` rejects client-supplied `workspace_id`/`firmId` → 400 (RET-BOUNDS-1 lines 514-530). RLS WITH-CHECK backstops a bypass attempt (RET-ISO-2).
- **SEC-B** GRANT: migration line 114 (verified above).
- **SEC-C** audit enum + hashed old→new: `retention.policy.updated` in `auditActionEnum` (RET-AUDIT-ENUM lines 568-572); append carries `actorUserId`/`actorRole` + `contentHash({old_days,new_days})` (service lines 122-125).

### 5. RBAC — PASS (server-enforced, not client-only)
- Controller: `@UseGuards(SessionGuard, RolesGuard) @Roles(...RETENTION_ROLES)` on both GET and PUT. `RETENTION_ROLES` derived from `rolesForRoute('/compliance/retention')`; boot-assertion throws if empty (fail-closed against RBAC drift).
- `rbac.ts` line 510-511: `pattern:'/compliance/retention', allowedRoles:['compliance','admin']` — matches the isolation test's `rolesForRoute` assertions (RET-RBAC-1..4: compliance+admin present, advisor+analyst absent).
- **compliance/admin → 200; advisor/analyst → 403** (server RolesGuard) / **redirect-to-/** (page `assertRole`); **anon → 401** (SessionGuard; RET-RBAC-5) / **307→/login** (page). Live prod: api unauthed → 401, web → 307→/login (C-2). Not a client-hide: the guard rejects the token payload server-side.

### 6. No coverage gap / no regression — PASS
- CI run 28927123301 (headSha == gated main HEAD 775cd67): api **1123** / web **956** / shared **509** passed; grep for skipped/failed → empty. Zero regression.
- DB-gated RET-ISO/RET-WORM RAN (20 tests, 1525ms, skip sentinel absent) — NOT silently skipped.
- Migration 0020 additive-only (CREATE TABLE + INDEX + ENABLE/FORCE RLS + POLICY + GRANT; zero destructive DDL) applied in CI DB and prod.
- Environment: CI/e2e used `TEST_DATABASE_URL` + `SET ROLE dealflow_app` ephemeral test-seed context (disjoint UUID namespace `00000028-7e01-*`), NOT elevated long-lived prod tokens. C-2 documented no live authed prod-fixture creds exist → CI-authoritative isolation (no fabricated smoke).

### Playwright / T-5-T-6 infra-readiness note
No live Playwright E2E/layout run was gated on this wave. UI verification is via vitest + Testing Library component/page tests (jsdom, executed in CI — 956 web tests, non-zero). No T-5/T-6 stage claims a green live-browser result, so the missing-Chrome-binary ESCALATE trigger does NOT fire (there is no zero-execution false-PASS to catch — the UI assertions ran under jsdom and are behavioral: exact DOM data attributes, input values, no-purge queries).

---

## T-9 Journey — block-exit gate — PASS
- **Ephemeral test-seed credentials confirmed** (check 1): e2e ran as `SET ROLE dealflow_app` under `TEST_DATABASE_URL` with a disjoint UUID namespace — not elevated long-lived prod tokens.
- **Journey-map delta AUTHORED** (this stage's deliverable): appended `## Wave 28 — M10 RETENTION policy (LIVE @775cd67)` to `command-center/artifacts/user-journey-map.md` — the NEW `/compliance/retention` route + GET/PUT retention API + RLS-config-table + WORM-no-purge posture were absent from the canonical map; now recorded with RBAC, SEC-A/B/C, and isolation/WORM provenance.
- **End-to-end lifecycle traversal:** config surface deploy verified live (route flipped 404→307 post-deploy, anon perimeter closed, api /health db:ok, RetentionPolicyController mapped, clean NestJS boot). Retention is a synchronous config table (no BullMQ worker hand-off in scope — correctly N/A, not a missing leg).

---

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers:
    t8_security: head-tester (RLS-config-isolation + WORM-preservation + RBAC verified from shipped code + CI log)
    t9_journey: head-tester (journey-map delta authored; ephemeral-creds + lifecycle confirmed)
  failed_checks: []
  rationale: >
    Both mandatory T-8 cruxes are GENUINELY tested, not coverage-theater.
    RLS-config-isolation: the isolation e2e runs as dealflow_app (NOT postgres — the
    false-green trap is explicitly named and avoided), proves firm A cannot read firm B's
    retention policy (RET-ISO-1, real service, not.toBe fault-kill) AND that a foreign-
    workspace_id write is rejected by the RLS WITH-CHECK (RET-ISO-2, rejects.toThrow —
    the fault throws), with the CI log independently showing the workspace_isolation
    policy rejecting a foreign write; 20 tests ran (1525ms, skip sentinel absent), not
    skipped. WORM-preservation: verifyChain stays ok:true after a retention config change
    with audit count monotonic non-decreasing (RET-WORM-1/2 via the real AuditVerifier),
    the service only appends retention.policy.updated and never deletes/mutates
    audit_log_entries, the 0002 audit_log_no_mutate trigger backstops it, and the UI ships
    no purge/delete affordance (asserted by button-text + aria-label queries in idle +
    loading). RLS-on-the-new-table is explicit (ENABLE+FORCE+USING-only NULLIF policy+SEC-B
    GRANT) and applied+enforcing in prod. SEC-A (server-resolved ALS upsert + .strict 400),
    SEC-B (per-table GRANT), SEC-C (audit enum + hashed old→new actor append), and server-
    enforced RBAC (SessionGuard 401 + RolesGuard 403, fail-closed boot, compliance/admin-only)
    all hold. api 1123 + web 956 + shared 509 pass with 0 skip/fail; DB-gated suites ran in
    CI; migration 0020 applied. The T-9 journey-map delta for the new /compliance/retention
    route + API was authored this stage. No live Playwright run was gated (jsdom component
    tests executed, non-zero) so the missing-Chrome-binary ESCALATE does not apply. No cross-
    firm config leak, no audit-deletion path, no compliance-audit bypass, no coverage gap.
  next_action: PROCEED_TO_V_BLOCK

test_gate_results:
  t1_static: PASS
  t2_unit: PASS
  t3_contract: PASS
  t4_integration: PASS
  t5_e2e: PASS (jsdom component/page tests; no live-browser stage gated)
  t6_layout: N/A (no live Playwright layout stage; UI covered by component asserts)
  t7_perf: N/A
  t8_security: PASS-GENUINE
  t9_journey: PASS
journey_map_version: wave-28 (delta appended — /compliance/retention route + GET/PUT retention API)
coverage_report: "api 1123 / web 956 / shared 509 pass, 0 skip/0 fail; RET-ISO/RET-WORM 20 tests ran in CI 28927123301"
escalation_log: []
verdict_source: shipped-code + gh-ci-log (run 28927123301)
verdict_evidence:
  - "retention-policy-isolation.e2e-spec.ts:115 SET ROLE dealflow_app (not postgres)"
  - "RET-ISO-1 firm A=2000 / firm B=365 not.toBe(2000) — real service, cross-firm read isolation"
  - "RET-ISO-2 repo.upsert(WS_B) under GUC=WS_A rejects.toThrow() — RLS WITH-CHECK fault-kill"
  - "CI log: RLS policy rejected foreign write on workspace_retention_policy"
  - "RET-WORM-1 verifyChain().ok===true + count===before+1 after setPolicy (real AuditVerifier)"
  - "RET-WORM-2 count>=before — no audit deletion path"
  - "page.test.tsx no purge|delete|clean button/aria-label (idle+loading) + cutoff panel role=note, no affordances"
  - "0020_retention_policy.sql: ENABLE+FORCE RLS + workspace_isolation USING-only NULLIF + GRANT dealflow_app"
  - "controller: SessionGuard+RolesGuard @Roles(RETENTION_ROLES) fail-closed boot; rbac.ts:511 [compliance,admin]"
  - "CI 28927123301: api 1123 / web 956 / shared 509 pass, 0 skip/fail; retention suite 20 tests 1525ms, skip sentinel=0"
  - "journey-map delta appended: ## Wave 28 — M10 RETENTION policy"
```

**Verdict: APPROVED** — RLS-config-isolation-genuine (as dealflow_app, foreign-write-rejected via WITH-CHECK, 20 tests ran) + WORM-preserved-no-purge (verifyChain-ok-after-change, audit monotonic, no UI purge control, 0002 trigger backstop) + RLS-on-new-table (ENABLE+FORCE+policy+GRANT applied+enforcing) + SEC-A/B/C + server-enforced RBAC (401/403 fail-closed) + no-gap/no-regression (1123/956/509, 0 skip/fail, DB-gated suites ran) + journey-delta authored. → V-block.
