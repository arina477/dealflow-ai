# Wave 12 — V-3 Verdict

**Reviewer:** head-verifier (fresh spawn, agentId head-verifier-v3-w12)
**Reviewed against:** V-1-karen.md (APPROVE, 8/8 TRUE + 1 LOW) · V-1-jenny.md (APPROVE, 0 drift, 2 LOW gaps) · V-1-summary.md · V-2-triage.md (0 blocking / 4 non-blocking / 1 noise / 0 fast-fix) · T/gate-verdict.md (T-9 APPROVED) · C-1-pr-ci-merge.md · C-2-deploy-and-verify.md · B/gate-verdict.md (B-6 APPROVED)
**Attempt:** 1  (1 = first gate, 2+ = post-rework)
**Wave topic:** M6 pipeline / deal-stage tracking (fixed 7-stage board + append-only audited event timeline)
**Deployed commit:** `989fae9` (= `6b62762` + a docs-only chore; `/health` version=989fae9)

## Verdict
APPROVED

## Rationale

The single load-bearing compliance invariant of this platform — "audit append throws mid-txn → the whole mutation rolls back, no orphan pipeline / pipeline_events row" — is PROVEN against a real transaction boundary at the exact deployed commit, not inferred from a green suite. I did not take the V-1 reviewers on faith; I independently pulled the deployed-state and CI artifacts and confirmed each load-bearing claim from a concrete observable:

1. **Audit-last-in-txn / real ROLLBACK — proven, un-mocked, EXECUTED.** I read the merged service at `989fae9`: all three mutations wrap `this.repository.runInTransaction(...)` (`:132` enroll, `:270` transition, `:346` note) and `appendAudit` → `auditService.append(tx)` (`:460`) is the LAST awaited statement in each block (`:213`, `:298`, `:366`) with ZERO surrounding `try`/`catch` (grep found no catch) — so an audit throw propagates out of Drizzle's `db.transaction()` callback → real Postgres ROLLBACK. That exact un-mocked path is exercised by `pipeline-gate.e2e-spec.ts`, which I confirmed ACTUALLY RAN GREEN (not skip-collected) on the deployed SHA: I pulled CI run `28749460752` (headSha=`989fae9`, conclusion=success, all 5 jobs incl `audit` success) and its raw test-job log line `✓ test/pipeline-gate.e2e-spec.ts (4 tests) 1527ms` — a real 1.5s runtime against a real `postgres:18` service, NOT `(4 skipped)`. The B-6 history corroborates this is not accidental: B-6 attempt-1 REJECTED the hollow `vi.fn()` passthrough version of exactly this invariant, and attempt-2 replaced it with the real-repo/real-service/real-AuditService e2e that reads committed state via a separate autocommit query. Done-Theater and false-green amnesia are decisively absent on the load-bearing invariant.

2. **Deployed artifact == CI-tested commit (no Ghost Green).** Live `curl /health` → `{"status":"ok","db":"ok","version":"989fae9"}` — the served hash equals the CI-verified SHA. `git diff --stat 6b62762 989fae9` = 2 files, both under `process/` (docs-only, zero application/schema/CI bytes), so the pnpm-audit + test green on `989fae9` is genuine, not extrapolated from the parent. (git HEAD has since advanced to L-block docs commits; the deployed artifact remains the CI-tested `989fae9`, which is what matters.)

3. **H-1 cross-mandate compliance defect closed in DEPLOYED code.** I read the merged `pipeline.service.ts` @989fae9: `if (outreachRow.mandateId !== input.mandateId) throw BadRequestException('Source does not belong to mandate...')` (`:151`) fires BEFORE any INSERT, and the match_candidate branch carries the same guard — both reachable before the single `insertPipeline` call site, so it is un-bypassable. The /review-caught false-mandate-association risk (which single-mandate fixtures had hidden) is structurally closed in the shipped artifact, not merely in a test.

4. **AC-STRIP / provenance holds on the DEPLOYED surface.** I grepped the board + timeline components @989fae9: the only `send`/`email` matches are `NO send/email affordance` doc-comments (negative provenance markers) — zero real Send/Compose/Schedule/AI-draft affordances, and no `@anthropic`/email-SDK import. This corroborates C-2's self-grep of the 31.6KB rendered authed board (7 fixed columns, the only "AI" being the global DealFlow-AI brand tagline). No CODE-OF-CONDUCT false-send / false-AI claim shipped; the wave is TRACKING-only as specified. Fixed 7-stage enum confirmed at the shared source.

5. **Non-blocking findings are correctly non-blocking (no triage-noise blindness, no misclassified structural defect).** V-2 classified 4 non-blocking + 1 suppressed noise. I concur: (a) no-live-eligible-source → the full enroll→transition→note live smoke could not be assembled because prod has no `send_eligible` source (`GET /outreach` → `[]`), which needs the entire wave-10/11 sourcing→match→accept→gate→send_eligible + cross-user SoD chain — this is an ENVIRONMENTAL/planning limitation, not a coverage gap or a code defect, and the invariant SUBSTANCE is proven by the CI real-DB e2e at the exact deployed commit; (b) empty test-cred registry — documented cross-wave carry-forward, not a wave-12 regression; (c) authed visual screenshots + (d) board-join-shape spec-gap (jenny GAP-2) — cosmetic/spec-under-specification, load-bearing correct-stage-column placement holds. None touches a schema change, an external contract, or compliance-enforcing middleware, so none qualifies as a blocking structural failure. Blocking indefinitely over any of these would be a triage-discipline failure against an otherwise spec-compliant deployment.

**On the honest limitation (acceptable reliance vs REWORK):** the absence of a live prod enroll→transition→note smoke does NOT warrant REWORK. Non-bypassability and audit-rollback are proven by the un-mocked real-Postgres e2e against the EXACT deployed commit (confirmed executed, not skipped), and LIVE verification independently confirms the endpoints are present, RBAC-gated (anon 401 / analyst 403 / advisor 200 — I re-confirmed the anon 401s myself), and FK-guarded (enroll nonexistent → 404, not a relation-missing 500, proving the tables exist live). Demanding a live smoke would require seeding an eligible source through the full upstream compliance chain — an infra-seeding task, not a defect in this wave's artifact. For a TRACKING foundation whose eligible sources are not yet seeded live, the CI-real-DB-at-deployed-commit proof plus live endpoint/RBAC/FK/AC-STRIP verification is sufficient, evidence-grounded release readiness. The reliance is stated openly at every layer (B-6, C-2, T-9, V-1 karen+jenny) rather than papered over. V-2 correctly deferred the seeded live smoke to a future wave and logged it for L-1/L-2.

Every "PASS" in this verdict traces to a concrete observable artifact — the raw CI execution line at the deployed SHA, the live `/health` hash, the merged-tree guard/append-ordering source, the deployed-component grep, and live RBAC/FK probes — not to an inferred green. No load-bearing compliance invariant (non-bypassable audit last-in-txn, append-only pipeline_events, H-1 mandate provenance, RBAC write/read split) ships structurally compromised. This clears the V-block.

## Rework instructions  (only if REWORK)
- N/A

## Escalation  (only if ESCALATE)
- N/A

## Footer
- verdict_complete: true
- fast_fix_cycles: 0
- rework_attempt_cap_remaining: 2
- head_signoff:
    verdict: APPROVED
    stage: V-3
    reviewers:
      karen: "APPROVE — 8/8 claims TRUE @989fae9; 1 LOW bounded reliance (non-blocking)"
      jenny: "APPROVE — 0 spec-DRIFT, 2 LOW spec-GAPs (non-blocking)"
      head_verifier_independent: "self — CI run 28749460752 raw test-log pulled at deployed SHA 989fae9 (pipeline-gate.e2e EXECUTED 4/4 GREEN 1527ms, NOT skipped); live /health=989fae9; 6b62762..989fae9 docs-only diff; H-1 guard + audit append-last/no-catch confirmed in merged source; AC-STRIP grep clean on deployed board components; anon 401 re-confirmed live"
    failed_checks: []
    rationale: >
      The load-bearing audit-last-in-txn real-DB ROLLBACK invariant is proven (not inferred) against the exact
      deployed commit — the un-mocked pipeline-gate.e2e independently confirmed EXECUTED GREEN (4/4, 1527ms) from
      the raw CI log, and the merged service source shows appendAudit as the last awaited statement in each
      runInTransaction block with no try/catch swallow. Deployed artifact == CI-tested commit (live /health hash;
      docs-only parent diff — no Ghost Green). H-1 cross-mandate provenance guard and AC-STRIP TRACKING-only
      boundary confirmed in the deployed code. The 4 non-blocking findings are environmental/spec/cosmetic (no
      seeded eligible source in prod; cross-wave test-cred carry-forward; authed visuals; under-specified board-join
      shape) — none a structural failure; V-2 triaged correctly. The one honest limitation (no live prod
      enroll smoke) is an acceptable, openly-stated reliance on the CI-real-DB proof at the deployed commit for a
      tracking foundation whose sources are not yet seeded live — not REWORK.
    next_action: PROCEED_TO_L
