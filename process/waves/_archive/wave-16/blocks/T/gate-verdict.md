# Wave 16 — T-9 Journey Gate Verdict

**Gatekeeper:** head-tester (fresh spawn, T-block exit — spawned at T-9 for the gate verdict)
**Wave:** 16 — M7 admin-hardening (SECURITY-SCOPE-TIGHTENED: invite/user-state + config-security + compliance-default cascade)
**Deployed:** LIVE @ `d72d7cb735aff74fcdbdb28bd20f19bf711cc539` (CI run 28805234334, 5/5 jobs green; Railway api+web meta.commitHash==d72d7cb)
**Block-exit gate:** T-9

## Verdict

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9-journey
  reviewers: {}    # no re-delegation required — CI real-DB + C-2 live evidence sufficient; all findings pre-adjudicated at B-6/review + C-1
  failed_checks: []
  rationale: >
    Every T-layer (T-1..T-8) is CI-verified-and-active and every one of the six security invariants in
    the wave-16 test map has real, non-hollow, fault-killing coverage proven at BOTH the CI real-DB layer
    (postgres:18 TEST_DATABASE_URL, named non-zero counts per suite) AND live @d72d7cb (deployed-authed
    HTTP probes with concrete data assertions — status codes, exact row-key sets, row counts, grep
    results). No coverage theater, no tautological assertion, no layout-only false-PASS, no silently-skipped
    suite, no untested compliance invariant. The three findings (1 LOW, 2 INFO) are non-blocking. The C-1
    HMAC cross-suite regression was root-caused and fixed WITHOUT weakening the verifyChain assertion.
  next_action: PROCEED_TO_V
```

## Security-invariant test map — per-invariant adjudication (all NON-HOLLOW)

| # | Invariant | CI real-DB evidence | Live @d72d7cb evidence | Non-hollow? |
|---|---|---|---|---|
| 1 | **Race-safe invite dedup (advisory-lock, write-skew/TOCTOU #1)** | `admin-concurrency.e2e-spec.ts` (11) INVITE-CONC-1: two concurrent `inviteAsActor` same fresh email via `Promise.allSettled` → exactly one 409 + exactly one invite row. Calls the REAL service (does NOT re-implement the lock inline) → fails if `pg_advisory_xact_lock` removed. Expired→reinvite: predicate `consumed_at IS NULL AND expiry > now()` + unit A-7c/A-7d. | (write-path, not re-probed live — CI real-DB is authoritative for the concurrency proof) | YES — fault-killing per documented property; correctly rejected the partial unique index (would break expired→reinvite + needs non-immutable now()) |
| 2 | **Compliance-default cascade (mvp-critical spine)** | `mandate-cascade.e2e-spec.ts` (5): CASCADE-1 inherits, CASCADE-2 change-default-no-retroactive-mutation, CASCADE-3a string-provenance, **CASCADE-3b object-provenance round-trip**, CASCADE-4 null-fallback. Tx-scoped read via `findWorkspaceSettingsInTx`. | PUT workspace-settings defaultJurisdiction=US persisted; POST /mandates OMITTING jurisdiction → 201 inherited US + derived disclaimer fe1c504d end-to-end. | YES — 3b proves the object SHAPE round-trips (the /review bug was an object storing as `[object Object]`); this is exactly the JSONB-serialization defect, now fault-covered |
| 3 | **Admin-activity read-only + no-secret (Finding-3 class)** | `admin-activity.e2e-spec.ts` (6): ACT-4 read-appends-0-audit-rows (count before === after), ACT-3 forbidden-fields-absent (camelCase + snake_case: payloadHash/contentHash/entryHash/prevHash/credential), RBAC 403/401. | admin GET 200 (14 rows), keys EXACTLY {action,actor,sequenceNumber,target,timestamp}; grep for hash/credential/payloadhash/secret → NONE; advisor 403, anon 401; **entriesChecked 324 unchanged by the GET** (read-only proven). | YES — asserts DB row-count delta + field ABSENCE + tenant-safe projection, not method execution |
| 4 | **Config typed-boundary no-echo** | C-4b/C-4c: secret value ABSENT from thrown error, static message present. `.strict()` enumerated whitelist (no free-text z.string(), no z.unknown() slot); ZodError discarded, uniform static CONFIG_VALIDATION_ERROR. | POST /admin/integrations secret-shaped + unknown field → 400 uniform static, posted secret canary ABSENT from body (grep clean); legit config:{} → 201. | YES — closes the wave-15 config-leak vector; no-echo asserted at both layers |
| 5 | **Reactivate no-priv-esc** | E-1a/E-1b/E-2 non-uuid → 400 (not 500); role_id preserved (no priv-esc), audited last-in-txn under additive `user-reactivate`, already-active → 400. WORM-safe teardown (retain audit-referenced users, UPDATE not DELETE). | advisor1 POST reactivate 200 (deactivated_at→null confirmed in DB), non-uuid 400 (the /review fix, NOT 500), advisor 403, re-call 400 already-active. | YES — UUID-validated, RBAC-gated, no role mutation, WORM-safe |
| 6 | **Audit HMAC chain intact after new user-reactivate action** | `recordkeeping-gate.e2e-spec.ts` (9) verifyChain ok:true (was RED at Run-1, fixed forward). auditActionEnum additively extended. | GET /compliance/audit-log/verify → ok:true, entriesChecked 324→328 across reactivate + integration + mandate-create + cascade writes; direct-SQL cred-blank correctly did NOT touch the app chain. | YES — see C-1 fix adjudication below |

### C-1 cross-suite HMAC-key contamination — fix adjudication (CRITICAL)
- Run-1 was a GENUINE RED (`verifyChain ok:false`), NOT a flake, NOT masked. The superficial `gh run watch` exit-0 was correctly distrusted in favour of the queryable per-job `conclusion=failure`.
- Root cause: `recordkeeping-gate.e2e-spec.ts` `beforeAll` hardcoded a suite-private `AUDIT_LOG_HMAC_KEY`; wave-16's new parallel audit-writing suites wrote rows with the vitest-default key; verifyChain over the full chain recomputed foreign rows with the private key → content-hash-mismatch.
- Fix (`d72d7cb`, test-file only, 11+/2−): replaced the private key with the shared-default `??` pattern so all suites share one key. **The `expect(pkg.verifyResult.ok).toBe(true)` assertions were PRESERVED (post-fix lines 614/647) — NOT weakened, NOT converted to `ok:false`, NOT `.skip`'d.** No production source touched. This is the correct fix: it made the chain verifiable across parallel forks rather than lowering the assertion bar. **Confirmed: keys aligned, assertion intact.**

## Anti-pattern heuristics — clean sweep
- **Coverage theater / tautological assertions:** NONE. Every load-bearing test asserts DB row-count deltas, exact field sets, field absence, or status codes — B-6 confirmed real-service (no `expect(mock).toHaveBeenCalled()`).
- **Layout-only false-PASS:** NOT PRESENT. T-6 asserts on rendered column structure + server-gate status codes (advisor 307, not CSS-hidden) + no-hash/credential column; admin-activity live reads exact row keys and grep-cleans the body. Data-integrity, not container-render.
- **Silently-skipped / missing-browser false-PASS:** NOT APPLICABLE + affirmatively cleared. T-5/T-6 here are deployed-authed HTTP probes against LIVE Railway (not browser-driven Playwright), so the Chrome-binary gate does not apply. Execution counts are non-zero and named across every suite (11/9/5/6/6/4 e2e; api 768 / shared 489 / web 693 unit). The Chrome-binary hard-ESCALATE rule was checked and does not fire: no zero-execution UI suite claiming green.
- **Ghost-Green:** the `[skip ci]`-on-HEAD phantom-skip was caught pre-push and neutralized with an identical-tree CI-triggering commit (tree SHA byte-identical) — CI validated the exact shipped tree.
- **CI blindness (green-badge gating):** avoided — verdict rests on per-job conclusions + named per-suite counts + the `pnpm audit --audit-level=high` exit-0 gate, not a green badge.
- **Untested compliance invariant:** none — all four load-bearing invariants (HMAC chain, non-bypassable config/RBAC gates, SoD via admin-only reactivate/activity, cascade spine) carry adversarial API-level coverage.

## Findings disposition (3 total: 0 crit/high/med, 1 LOW, 2 INFO) — NONE BLOCK
- **Finding-1 (LOW) — hashtext 32-bit advisory-lock collision:** throughput-only, not a correctness defect. A collision makes two DIFFERENT emails briefly share a lock (extra serialization wait); it can NEVER admit a duplicate invite for the same email. Code-acknowledged. Non-blocking.
- **Finding-2 (INFO) — sequenceNumber cursor exposed to admins:** admin-trusted surface, reviewed-and-accepted risk. Non-blocking.
- **Finding-3 (INFO) — sibling reactivate/deactivate/role handlers use raw params:** pre-existing debt, NOT introduced this wave; only reactivate was in scope and it received UUID validation. Logged for future hardening. Non-blocking.

## Block-scoped state
```yaml
test_gate_results:
  T-1_static: PASS
  T-2_unit: PASS            # api 768 / shared 489 / web 693
  T-3_contract: PASS
  T-4_integration: PASS     # INVITE-CONC-1 + CASCADE-1..4(3b object round-trip) + REACTIVATE-1/2 + ACT-* + verifyChain ok:true
  T-5_e2e: PASS             # C-2 deployed-authed @d72d7cb (HTTP, non-browser) — reactivate/activity/cascade/config live
  T-6_layout: PASS          # read-only structure + server-gate status codes, data-integrity not container-only
  T-7_perf: SKIPPED         # not heavy this wave
  T-8_security: PASS        # advisory-lock write-safe + config no-echo + activity no-secret/read-only + audit chain ok:true
  T-9_journey: APPROVED
journey_map_version: regenerated-at-T-9 (/admin/activity + admin nav LIVE)
coverage_report: ci-run-28805234334 (real-DB e2e all green; per-suite named counts)
escalation_log: []
handoff: V-block
```
