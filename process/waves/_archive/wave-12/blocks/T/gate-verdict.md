# Wave 12 — T-9 Verdict

**Reviewer:** head-tester (fresh spawn, agentId head-tester-t9-w12)
**Reviewed against:** process/waves/wave-12/blocks/T/review-artifacts.md (T-1..T-8 manifest) + findings-aggregate.md + T-1..T-8 deliverables + C-1-pr-ci-merge.md + C-2-deploy-and-verify.md + B/gate-verdict.md
**Attempt:** 1  (1 = first gate, 2+ = post-rework)
**Wave topic:** M6 pipeline / deal-stage tracking (fixed-stage board + audited event timeline)
**wave_type:** [ui, backend, auth(RBAC/audit)]
**Deployed commit:** 989fae9 (= 6b62762 + docs-only chore, 2 files under process/, zero code/schema/CI bytes)

## Verdict
APPROVED

## Rationale

The single load-bearing compliance invariant of this platform — "audit append throws mid-txn → the whole mutation rolls back, no orphan pipeline/pipeline_events row" — is PROVEN, not asserted. I independently pulled the raw CI test-job log for run 28749460752 at the EXACT deployed SHA 989fae9 and confirmed the anti-pattern this gate exists to catch (silently-skipped E2E masquerading as green) is decisively absent: the job runs `CREATE DATABASE dealflow_test`, sets `TEST_DATABASE_URL`, and executes `✓ test/pipeline-gate.e2e-spec.ts (4 tests) 1527ms` — a green run with a real 1.5s runtime against real Postgres, NOT a skip-collected `(4 skipped)`. This is not a fabricated or inferred green; run conclusion is `success`, the `test` job (with an "Initialize containers" step = real PG service) is `success`, and the `audit` (pnpm-audit) job is `success` (5/5). The e2e is collected because it carries the `.e2e-spec.ts` suffix matched by the vitest glob (the wave-11 uncollected-test lesson held); locally `describe.skipIf` skips clean, in CI it self-migrates in `beforeAll` and runs all 4.

The B-block earned this. B-6 attempt-1 REJECTED the first submission precisely because `runInTransaction` was a `vi.fn()` passthrough calling `work({})` — hollow-test theater on exactly the invariant this gate protects, with the real `db.transaction()` ROLLBACK path exercised by zero tests. Attempt-2 replaced it with a real-repository/real-service/real-AuditService e2e in which ONLY `auditService.append` is spied to reject; the rejection propagates out of Drizzle's transaction callback → a genuine Postgres ROLLBACK, after which the test reads committed state via a SEPARATE autocommit query and asserts `count(pipeline)===0` AND `count(pipeline_events)===0`. That is the textbook cure for coverage theater — the seam providing the guarantee is no longer mocked, and the assertions are on committed row state, not tautological mock-call checks.

Compliance-invariant test map — each adjudicated adequate + non-hollow:
1. **Audit-last-in-txn / real ROLLBACK / zero orphan** — GENUINE. pipeline-gate.e2e 4/4 GREEN vs real Postgres @ 989fae9 (enroll + addNote rollback proofs read AFTER via autocommit; happy-path exactly-one-event + audit_log_entries +1 per action from `.returning()` values, not tautologies). Confirmed executed (1527ms), not skipped, from the raw CI log.
2. **Idempotent enroll → 409** — GENUINE. Real partial-unique index → 23505 → ConflictException with unchanged row count (e2e proof 4) + unit. Rides the DB constraint, not a service-level find-first race.
3. **Fixed-enum transition + append-only events + eligible-source guard** — ADEQUATE. Server-side re-guard vs `pipelineStageEnum.options`; pipeline_events has no update/delete path (grep-verified); eligible-source guard rejects ineligible source with 400. pipeline.spec 44.
4. **H-1 cross-mandate (the /review-caught HIGH)** — CLOSED. The strongest quality signal in the wave: /review Phase-2 caught a real false-mandate-association hole that single-mandate fixtures had hidden, it was routed to backend-developer, fixed IN-TX before the SINGLE `insertPipeline` call site (reachable only after both guards → un-bypassable), and re-verified with 2 divergent-mandate spec tests (source mandate A + enroll mandate B → 400, insertPipeline not-called) across both source types. The false-mandate risk in the audit trail is closed.
5. **RBAC write/read split + AC-STRIP** — ADEQUATE. RBAC split PINNED with `toEqual` completeness (fails CI on role-widening — not a subset assertion), 5 sub-routes + exact roles in the matrix; live C-2: anon 401, analyst enroll 403 (advisor-only write), advisor read 200. AC-STRIP self-grepped on the 31.6KB DEPLOYED authed HTML (behavioral DOM assertion, not layout-only): all 7 fixed columns render, ZERO send/schedule/email/AI-draft affordances, only AI = the allowed global DealFlow-AI brand meta tagline. No client-side-only guard: the RBAC rejection is proven at the API, not by a hidden button.

Playwright-binary false-PASS gate: NOT triggered as a risk. T-5/T-6 did not claim a green live Playwright browser run with zero executed tests; they relied on the CI real-DB e2e (proven executed, 1527ms) + the self-grepped deployed-authed HTML (31.6KB real board, not the /login shell). No zero-execution E2E was signed off as green.

Known gaps, weighed honestly and judged NON-BLOCKING for this wave:
- **[LOW] Full interactive enroll→move→note→timeline journey not assembled on deployed prod.** Root cause is environmental, not a coverage gap: prod has no eligible source (`GET /outreach` → `[]`), and seeding one requires the entire wave-10/11 sourcing→match→accept→outreach→send_eligible + cross-user SoD chain. The invariant SUBSTANCE is proven by the CI real-DB e2e at the EXACT deployed commit + web-453 UI unit tests (board 7-column, timeline panel, error-state) + C-2's deployed-authed board render. For a TRACKING foundation whose sources are not yet seeded, this reliance is acceptable and is stated explicitly (not papered over). A seeded live smoke is correctly deferred to V-1 / a future seeded run — it does NOT warrant REWORK, because no compliance invariant is left unproven and no layer is untested.
- **[MEDIUM] Deployed test-cred registry empty + no eligible source in prod** — documented cross-wave carry-forward (same as wave-11 finding #1); deferred to V-block, not a wave-12 regression.
- **[LOW] Authed mobile/detail visual screenshots not captured** — structure verified via authed HTML + web component tests + pipeline.html mockup; unchanged design surface.
- **[LOW] Cookie-attr/session-rotation not freshly probed** — auth backbone unchanged by wave-12 (pipeline module only, no session-lifecycle code touched); inherited from wave-2.

secret_grep CLEAN over the wave diff (zero credential/token matches). Migration 0011 additive-only (2 new tables + 2 enums + FKs into existing tables, zero DROP/ALTER COLUMN) — no destructive-migration test risk. Every T-layer that should run, ran; every compliance invariant that must be proven, is proven against a real transaction boundary at the deployed commit. Nothing hollow, tautological, layout-only, or silently-skipped remains. This clears the T-block.

## Rework instructions  (only if REWORK)
- N/A

## Cascade
- N/A (APPROVED)

## Escalation  (only if ESCALATE)
- N/A

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2
- head_signoff:
    verdict: APPROVED
    stage: T-9
    reviewers: { compliance_invariant_map: "head-tester (self) — CI test-job raw-log independently pulled at deployed SHA 989fae9; pipeline-gate.e2e confirmed executed 4/4 GREEN (1527ms real PG), NOT skip-collected; H-1 cross-mandate fix + RBAC toEqual-pin + AC-STRIP deployed-HTML all verified" }
    failed_checks: []
    rationale: >
      All five compliance invariants (audit-last-in-txn real ROLLBACK, idempotent-409,
      fixed-enum + append-only + eligible-source, H-1 cross-mandate, RBAC write/read split
      + AC-STRIP) are proven non-hollow against a real transaction boundary at the exact
      deployed commit 989fae9. The load-bearing audit-rollback e2e was independently confirmed
      EXECUTED GREEN (not skipped) from the raw CI log — the silently-skipped-E2E and
      coverage-theater anti-patterns are decisively absent (B-6 caught + fixed the hollow-mock
      version in attempt-1). Residual gaps are environmental (no eligible source seeded in prod)
      or unchanged-backbone, all non-blocking and correctly deferred to V. No layer untested.
    next_action: PROCEED_TO_V

---

## T-block exit
```yaml
test_block_status:    complete
stages_run:           [T-1, T-2, T-3, T-4, T-5, T-6, T-8, T-9]
stages_skipped:       [T-7 (not heavy; additive 2-table module)]
findings_total:       4
findings_critical:    0
findings_evidence_dir: process/waves/wave-12/stages/
findings_aggregate:   process/waves/wave-12/blocks/T/findings-aggregate.md
ready_for_verify:     true
```
→ next block: claudomat-brain/blocks/verify/verify.md
