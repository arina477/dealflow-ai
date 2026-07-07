# T-9 Journey — Gate verdict (wave-19, M9 matching-feedback calibration)

**Block:** T (Test) | **Wave:** 19 | **Topic:** M9 matching-feedback calibration (read-only, workspace-scoped) — LIVE @3cc58de
**Stage:** T-9 Journey (block-exit gate) | **Reviewer:** head-tester (fresh spawn)
**Deployed commit:** `3cc58decb40a209e1dc4f7ba096d5e05461c5394` | **CI run:** 28836091590 (5/5 green)
**Hard invariant:** post-M8 cross-firm calibration isolation (a leak undoes M8)

---

## Verdict: APPROVED

The load-bearing cross-firm calibration-isolation invariant is proven **non-hollow AND
non-skipped**: the `match-feedback-isolation.e2e` suite RAN all 7 tests with **0 skipped**
on the exact deployed SHA 3cc58de (green run 28836091590), invokes the REAL unmocked
`MatchFeedbackService` inside `workspaceAls.run` under `SET ROLE dealflow_app` FORCE RLS,
and MFC-4 is genuinely fault-killing (source-verified strict inequality
`noAlsTotalDecided !== alsTotalDecided` — a `getDb→raw this.db` regression collapses both
to the same all-tenant total and the assertion fails). The C-1 attempt-1 near-miss (invalid-UUID
fixtures crashing `seedWorkspace`, 22P02 → 7 tests SKIPPED) was **caught, not accepted as
green** — classified testing-tag, routed to backend-developer (Iron Law), fixed at a09fa7b,
re-run green per-SHA. Metric output is honest (tieBreak structural noise dropped + asserted
absent; small-sample caveat; G2 null→"n/a" not 0%). RBAC fail-closed, read-only, audit chain
intact live. The deferral is acceptable and identical to wave-18.

---

## Stage-exit checklist (T-block layers)

| Layer | Check | Result | Evidence |
|---|---|---|---|
| T-1 static | Typecheck + lint strict, no unauthorized `any` | PASS | CI 28836091590 lint+typecheck green @3cc58de |
| T-2 unit | Concrete-state assertions, not tautological; RBAC/empty-state/per-row | PASS | api 881 (match-feedback.spec 22: band-math, empty-state null path, per-row-exclusion, RBAC) + web 773 (calibration section 24) |
| T-3 contract | Shared Zod schema = FE parse expectations; G2 null-safe | PASS | shared match-feedback.ts 2-dimension lift (tieBreak-noise dropped), acceptRate `number|null` |
| T-4 integration | Real containerized DB (dealflow_app), fault-killing isolation | PASS | isolation e2e 7/7 REAL service via ALS as dealflow_app; MFC-4 strict-inequality fault-kill (source-verified L656–684); MFC-5 per-row exclusion; WORM-safe teardown |
| T-5 e2e | Live deployed-SHA probes; NO false-PASS | PASS | C-2 live @3cc58de: /match-feedback anon 401 (mounted, fail-closed), /insights 307→login, audit-verify 401 (not 500). Authed-200 deferred honestly → CI e2e authoritative |
| T-6 layout | Behavioral DOM assertions, not layout-only | PASS | web calibration 24 tests: small-sample n=X caveat, null→"n/a" (page test line 495 asserts null NOT rendered "0.0%"), tieBreak-row-absent, empty/error, RBAC-gate; design-system reuse |
| T-7 perf | — | SKIP (justified) | 2 fixed grouped queries + JS aggregation, no N+1, no perf budget at risk |
| T-8 security | Cross-firm negative-read, RBAC fail-closed, read-only, metric-honesty | PASS | cross-firm-calibration-negative-read (MFC-4 fault-killing as dealflow_app — A's calibration never includes B); RBAC 403/401; zero writes, audit intact; tieBreak-noise-dropped + small-sample caveat (CODE-OF-CONDUCT); secret-grep clean |
| T-9 journey | Ephemeral test creds; end-to-end traversal | PASS | CI e2e seeds disjoint ephemeral WS_A/WS_B + user-A/user-B (no prod tokens); journey map +/insights calibration section +/match-feedback |

---

## The crux — cross-firm calibration isolation (non-hollow + non-skipped)

**NON-SKIPPED — confirmed per-SHA on the deployed tip.** Green run 28836091590 test-job log
(direct quote, C-1 lines 32–39): `✓ test/match-feedback-isolation.e2e-spec.ts (7 tests) 1629ms`,
`Tests 881 passed (881)` with **ZERO skipped**. The 1629ms suite runtime + per-test ms timings
(MFC-1 492ms) prove the bodies executed against a live DB — an early `if (!dbReachable) return`
no-op would be sub-millisecond and MFC-1's exclusion assertion could not pass. The attempt-1 RED
(22P02 crash in `seedWorkspace`) independently confirms the DB was reachable and fixtures were
actually inserting.

**NON-HOLLOW — real service, fault-killing (source-verified, not deliverable-prose-trusted).**
`runServiceInAls()` checks out a PoolClient, `SET ROLE dealflow_app` (NOSUPERUSER, FORCE RLS),
sets `app.workspace_id`, builds `new MatchFeedbackService(new MatchFeedbackRepository(gucHandle))`
**unmocked**, runs `getCalibration()` inside `workspaceAls.run`. MFC-4 (L656–684) runs the REAL
service ALS-scoped (WS_A only) vs a no-ALS singleton (superuser BYPASSRLS → all-tenant) and asserts
`expect(noAlsTotalDecided).not.toBe(alsTotalDecided)` — a strict inequality. WS_B seeds 6 decided
candidates; a `getDb → raw this.db` regression collapses both totals to the same all-tenant value →
inequality fails → regression auto-caught. This is the wave-18 hollow-test lesson pre-empted, held.

**Every-query-via-getDb — source-verified.** Both repository query methods route through
`getDb(this.db)` (`getBandCalibration` L125, `getDimensionLifts` L185); zero raw `this.db` in any
query body (only the "NEVER use this.db directly" guard comment). Isolation enforced structurally
at the repository layer.

---

## The silently-skipped near-miss (C-1 attempt-1) — genuinely resolved

Attempt-1 (63d055d, run 28835918443) was **RED**: mnemonic UUID string literals with non-hex chars
(`mfi1`/`st-a`/`st-b`) rejected by Postgres `string_to_uuid` (SQLSTATE 22P02) → `beforeAll` throw →
suite FAIL, all 7 tests SKIPPED. This is the exact anti-pattern (load-bearing isolation e2e silently
skipped) the gate exists to catch. head-ci-cd did NOT accept skipped-as-green (CI-PRINCIPLES rule 2),
classified as testing-tag fixture defect, routed to backend-developer under the Iron Law
(assertion-preserving prompt: fix ONLY the malformed literals — no source/assertion/ALS/GUC change),
fix a09fa7b corrected the 5 literals keeping WS_A/WS_B/user-A/user-B disjoint. Attempt-2 (3cc58de,
run 28836091590) all-5-green with the isolation suite RAN 7/7 + PASSED. Green is per-SHA on the
deployed tip, NOT extrapolated from the intermediate.

---

## Metric honesty (CODE-OF-CONDUCT — the /review catch)

- **tieBreak dropped:** hash-of-row-id structural noise removed from the per-dimension lift
  (2 dimensions now); asserted absent by `expect(dims).not.toContain('tieBreak')` (isolation e2e L645).
- **Small-sample caveat:** decidedCount<5 → "n=X" shown/muted, not a confident 100% on n=1 (web 24).
- **G2 null-vs-zero:** `acceptRate number|null`; `decidedCount===0 ? null : accepted/decided`; UI
  null→"n/a", 0→"0.0%" distinct; page test line 495 asserts null is NOT rendered as "0.0%".

No misleading metric ships to M&A advisors. Coverage adequate (24 web tests incl. small-sample + tieBreak-absent + n/a-vs-0%).

---

## Findings + deferral ruling

**1 INFO finding, 0 blocking.** The live-authed calibration check deferral (no prod advisor fixtures)
is **ACCEPTABLE** — identical disposition to wave-18 (tracked by process task 1d95cac0):
- Authoritative isolation + RBAC proof is the CI `match-feedback-isolation.e2e` (7/7, 0 skipped, as
  dealflow_app under FORCE RLS, MFC-1 cross-firm exclusion + MFC-4 fault-kill) + `match-feedback.spec`
  (22: RBAC 403/401, empty-state null, per-row-exclusion) — both green on the exact deployed SHA.
- Live anon-401 (C-2) confirms the endpoint is mounted + fail-closed in prod.
- Single-tenant prod makes a 2-firm live authed test physically impossible; the deferral is honest
  (authed-200 NOT fabricated), not a papered-over gap.

**Playwright-binary gate — N/A this wave.** T-5/T-6 are Pattern A (CI-verified unit/component +
live synthetic HTTP probes), not live browser E2E requiring a Chrome binary. No zero-execution
false-PASS risk applies; the executed-test count is confirmed non-zero (881 passed, 0 skipped).

---

## Anti-pattern sweep

| Pattern | Verdict |
|---|---|
| Coverage theater / zero-assertion | CLEAR — MFC-4 strict-inequality fault-kill; page test asserts null≠"0.0%" |
| Over-mocking / tautological | CLEAR — REAL unmocked service+repo via ALS; Testcontainers-equivalent dealflow_app role |
| Hollow test (wave-18 trap) | CLEAR — pre-empted at B-6, held; fault-killing not shape-checking |
| Untested isolation invariant | CLEAR — cross-firm exclusion proven under FORCE RLS as dealflow_app |
| Silently-skipped E2E | CLEAR — attempt-1 skip CAUGHT + fixed; green is per-SHA 7/7, 0 skipped |
| Flaky-test tolerance | CLEAR — RED not re-run blindly; classified + routed (no auto-retry-to-green) |
| Metric dishonesty | CLEAR — tieBreak noise dropped, small-sample caveat, null≠0% |

---

## Failed checks

None.

---

```yaml
test_block_status:    complete
stages_run:           [T-1, T-2, T-3, T-4, T-5, T-6, T-8, T-9]
stages_skipped:       [T-7]   # perf: 2 fixed grouped queries + JS aggregation, no N+1, no budget risk
findings_total:       1
findings_critical:    0
test_gate_results:
  cross_firm_isolation:   PROVEN   # real service via ALS, MFC-4 fault-killing, 7/7 ran green @3cc58de, 0 skipped
  every_query_via_getDb:  PROVEN   # both repo methods getDb(this.db), 0 raw this.db (source-verified)
  metric_honesty:         PROVEN   # tieBreak dropped+asserted-absent, small-sample caveat, G2 null→n/a
  rbac_fail_closed:       PROVEN   # advisor/admin 200, analyst/compliance 403, anon 401 (spec + live)
  read_only_audit_intact: PROVEN   # zero writes, audit verify 401 not 500 live
  authed_deferral:        ACCEPTED # CI e2e authoritative; single-tenant prod; anon-401 live; wave-18 parity
journey_map_version:  updated  # +/insights calibration section, +/match-feedback
coverage_report:      "CI 28836091590 @3cc58de: api 881 passed / 0 skipped, web 773; isolation e2e 7/7"
escalation_log:       []

head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers:
    cross_firm_isolation: head-tester (source-verified MFC-4 fault-kill + per-SHA 7/7 non-skipped)
    metric_honesty: head-tester (tieBreak-drop asserted absent + small-sample + G2 null≠0%)
  failed_checks: []
  rationale: >
    The post-M8 cross-firm calibration-isolation invariant is proven non-hollow AND
    non-skipped: the match-feedback-isolation e2e RAN all 7 tests with 0 skipped on the
    exact deployed SHA 3cc58de (run 28836091590), invokes the REAL unmocked
    MatchFeedbackService inside workspaceAls.run under SET ROLE dealflow_app FORCE RLS,
    and MFC-4 is genuinely fault-killing — source-verified strict inequality
    (noAlsTotalDecided !== alsTotalDecided) so a getDb→raw this.db regression collapses
    both totals to the same all-tenant value and the assertion fails. Suite runtime 1629ms
    plus per-test ms timings prove bodies executed against a live DB, not dbReachable
    early-returns. The C-1 attempt-1 near-miss (invalid-UUID fixtures crashing seedWorkspace,
    22P02, 7 tests SKIPPED) was caught, not accepted as green — classified testing-tag,
    routed to backend-developer per the Iron Law, fixed at a09fa7b, re-run green per-SHA.
    Both repository query paths route through getDb(this.db) with zero raw this.db. Metric
    output is honest per CODE-OF-CONDUCT (tieBreak structural noise dropped and asserted
    absent, small-sample caveat, G2 null→"n/a" not 0% with an explicit non-conflation
    assertion). RBAC is fail-closed (advisor/admin 200, analyst/compliance 403, anon 401 —
    spec + live), the surface is read-only, and the HMAC audit chain is intact live (verify
    401 not 500). The 1 INFO live-authed deferral is acceptable — identical to wave-18: the
    CI e2e as dealflow_app is the authoritative isolation+RBAC proof, single-tenant prod makes
    a 2-firm live authed test impossible, live anon-401 confirms mount + fail-closed, and the
    deferral is honest (authed-200 not fabricated). No Playwright Chrome-binary blocker applies
    (Pattern A CI + synthetic HTTP probes; executed-test count non-zero, 0 skipped).
  next_action: PROCEED_TO_V
```
