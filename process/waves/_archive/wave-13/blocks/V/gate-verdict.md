# Wave 13 — V-3 Verdict

**Reviewer:** head-verifier (fresh spawn, agentId head-verifier-w13-v3)
**Reviewed against:** V-1-karen.md (APPROVE, 8/8 claims TRUE) + V-1-jenny.md (APPROVE, 0 drift, 1 gap) + V-1-summary.md + V-2-triage.md (0 blocking) — cross-checked against C-2-deploy-and-verify.md, T-9 gate-verdict, B-6 gate-verdict, and the deployed live system.
**Attempt:** 1 (first gate)
**Phase:** 1 (head-verifier adjudication). V-3 fast-fix loop: SKIPPED — V-2 `fast_fix_candidates: []` (DEV-2 is a >20-LOC real-DB e2e / follow-on task, structurally beyond fast-fix scope; no cosmetic-or-trivial in-scope defect exists to patch).

## Verdict
APPROVED

## Rationale

**Every load-bearing claim traces to a concrete, observable artifact in the deployed state — not inferred from a green suite or clean diff.** I re-verified the four cardinal compliance invariants and the provenance chain independently rather than on reviewer faith:

1. **Deployed == CI-tested commit (no Ghost Green).** I curled the live api: `/health` → `{"status":"ok","db":"ok","version":"2ec4953…"}` — the deployed hash. `git diff --name-only 5293045 2ec4953` returns exactly two files, BOTH under `process/` (`wave-13/checklist.md` + `stages/C-1-pr-ci-merge.md`) — zero application/schema/CI bytes. CI ran GREEN 5/5 on the exact code SHA `5293045` (run 28777726235, incl `pnpm audit --audit-level=high`). Current HEAD `ec2f3a6` = `2ec4953` + docs-only (command-center/ + process/, verified by diff). The deployed artifact IS the CI-tested code. No stale-cache / build-time mirage.

2. **Append-only HMAC hash-chain integrity — PROVEN LIVE.** C-2 self-drove `GET /compliance/audit-log/verify` → 200 `{ok:true, entriesChecked:309}` — the REAL `AuditVerifier.verifyChain` shape computed over the accumulated 309-entry production chain (not a stub/fixture). karen + jenny independently reproduced the anon-401 guard on the same route.

3. **Export appends EXACTLY ONE `export_generated` LAST-IN-TXN — PROVEN LIVE by delta, not by unit mock.** verify BEFORE export = 309; `POST .../export` → 200 downloadable package (`{entries+per-entry hashes, verifyResult{ok:true,309}, manifest{tailHash 930bfecc…, entryCount:309}}`); verify AFTER = 310 (delta +1), `export_generated` newest action. Rollback-on-audit-fail (no package without its row) holds structurally (append is the last write in the single `runInTransaction`) and is unit-backed.

4. **Server-side SoD/RBAC — PROVEN LIVE, not UI-hidden.** advisor `POST export` → 403, advisor `verify` → 403 (RolesGuard, EXPORT/VERIFY_ROLES = compliance+admin), anon → 401 (SessionGuard). advisor read → 200 with 0 own-outreach rows (service-enforced scope). This is the real server boundary exercised via an authed advisor session, not a hidden button.

5. **Read-only-zero-audit + M2 fail-closed validation — PROVEN LIVE.** `?limit=999999` → 400 clamp, `?mandateId=notauuid` → 400 BadRequest at the boundary (never 500, never unbounded). Repository is pure `.select()`; the only `AuditService.append` in the module is the export path.

6. **H1 compliance-honesty fix — CONFIRMED IN DEPLOYED CODE (read directly, not on reviewer report).** `recordkeeping.repository.ts` @ HEAD docstring (L25-31, L263-269) states plainly that gate-evaluate rows carry `resource_type='outreach-template-version'` (cross-mandate) and are *intentionally excluded* from mandate-scope, obtainable via time-range/full-chain export and provable via verifyChain — "NOT mandate-attributable via this derivation." No overclaim. I read the full `buildConditions()` mandate fragment (L272-302): the 8-branch compound-OR contains NO `outreach-template-version` branch — no lossy over-capturing branch was added. L3 (advisor+mandate narrowing, L242-261) and L4 (audit-log-export direct branch, L301) are present. The B-6 Phase-2 REWORK genuinely landed.

7. **AC-STRIP holds on the DEPLOYED authed HTML.** compliance page 179 KB (`export-panel`=1, `export-cta`=1, `integrity-badge`=1); advisor page 31.6 KB (`export-panel`=0, `export-cta`=0, download=0 — panel truly ABSENT, not merely hidden). Byte-size distinguishes the real authed page from the ~10 KB login shell; zero edit/delete/send/AI affordance on immutable rows; the only "AI" is the allowed DealFlow-AI brand tagline. This is DOM-content verification, not layout-only false-PASS.

No spec-vs-deployed semantic drift (jenny: 0 drift across all three contracts). No compliance-gate bypass. No false-green amnesia (live probes replace mocks on every load-bearing claim). No infinite fast-fix loop (fast-fix correctly skipped).

### THE DEV-2 DECISION (central call): defer to a hard-gated follow-on is ACCEPTABLE → APPROVED

The mandate-scope DERIVATION SQL (8-branch per-`resource_type` compound-OR) is unit-tested only via a mocked repo (asserts the service forwards `mandateId`), never executed against a real Postgres; C-2's live export used empty scope `{}`, so the mandate branch was not exercised live either. This is, strictly, the over-mocking anti-pattern on a regulator-facing compliance-correctness path — I weighed it as a genuine REWORK candidate. I adjudicate it a **HIGH-priority hard-gated follow-on, NOT ship-blocking**, on a proof-carrying basis:

- **It is not a cardinal-invariant gap.** All four load-bearing compliance invariants (append-only HMAC chain, export-one-last-in-txn, server-side SoD, read-only+validation) are proven LIVE at deployed-state. DEV-2 is a completeness gap on ONE optional filtered VIEW, not a bypassed or compromised invariant. My non-negotiable — "no load-bearing compliance invariant may ship structurally compromised" — is not triggered: the mandate-scoped filter is a convenience filter, not one of the cardinal invariants.
- **The load-bearing regulator path is the FULL-CHAIN export, and it is PROVEN LIVE.** A regulator receiving a subpoena gets everything via the full-chain / time-range export (no mandate filter) — captured all shipped producers, entryCount 309, verifyResult ok, proven live. The untested path is the narrower optional scoped slice, not the canonical package.
- **NO OVERCLAIM (the decisive distinction).** A *silent* completeness defect on a regulator package would be an instant REJECT. Here the H1 fix — which I confirmed in deployed code — documents the gate-evaluate exclusion as a known limitation. A documented limitation on a filtered view is honest; the "regulator misled about completeness" failure mode is mitigated. The trust model is intact.
- **Bounded, read-only blast radius; cannot corrupt the chain.** The derivation is a read path — worst case is an incomplete/over-inclusive export SLICE, and every package still ships the full-chain verifyResult that independently proves the whole chain unbroken regardless of slice content. Audit-Chain-Truncation is structurally impossible here.
- **Structurally verified + low logic-complexity.** `/review` confirmed all 8 branches, correct casts, no-double-count, injection-safe. I independently read the SQL: simple one-hop `mandate_id` FK subselects (outreach/pipeline/match_run/buyer_universe) + single-JOIN two-hop (`*_event`/`*_candidate`) + direct matches (mandate/audit-log-export). Correct-by-inspection.
- **Zero imminent exposure.** 0 DAU; no production advisor is relying on the scoped-filter view for an actual regulator request today. The window to land the real-DB test before reliance is real.
- **Genuinely follow-on-shaped, not fast-fix-shaped.** The remediation is a >20-LOC real-DB integration test (reuse the wave-12 race-safe shared migrate helper; seed multi-producer rows under one mandate). Forcing it into V-3 fast-fix would violate the fast-fix bound; kicking the whole wave to REWORK over a bounded, documented, read-only, non-load-bearing completeness gap is disproportionate.

**Binding condition on the deferral (makes it a gate, not a wish):** the mandate-scoped filtered export MUST NOT be relied upon for an actual live regulator request until the real-DB derivation integration test lands. The full-chain / time-range export ships unconditionally. karen, jenny, and head-tester independently converge on exactly this directive.

## Rework instructions
n/a — APPROVED.

## Escalation
n/a — no cardinal invariant is structurally compromised; DEV-2 is a fillable, hard-gated coverage gap within the wave's risk budget, not an architectural flaw exceeding it.

## Follow-on (tracked, non-blocking)
- **DEV-2 (HIGH-priority follow-on — N-block seed candidate):** author a recordkeeping mandate-derivation real-DB integration test (T-4 layer; reuse wave-12 race-safe shared migrate helper) that seeds multi-producer audit rows (outreach + pipeline + match + buyer-universe events) under one mandate, then asserts the mandate-scoped export INCLUDES all mandate-derivable producers AND EXCLUDES gate-evaluate (per the documented H1 limitation) — BEFORE the scoped-export view is relied upon for a live regulator request.
- **GAP-1 / producer-side gate-mandate-attribution (INFO — future M6/M10 bundle):** compliance-gate should record outreach/mandate context in its audit row so gate-evaluate becomes cleanly mandate-attributable (`process/session/updates/followon-gate-mandate-attribution.md`).
- **DEV-1 verify-route-conflict (LOW):** consolidate the duplicate (behaviorally-null) verify handler in a future wave.
- **test-cred-registry (LOW):** carry-forward noise (waves 11/12), suppressed.

## Footer
```yaml
verdict_complete: true
verdict: APPROVED
phase1_head_verifier_verdict: APPROVED
fast_fix_cycles: 0
fast_fix_in_scope: 0
rework_attempt_cap_remaining: 2
dev2_decision: defer-acceptable (HIGH-priority hard-gated follow-on; full-chain export proven live + all cardinal invariants live + H1 no-overclaim + read-only bounded blast-radius + 0 DAU; scoped-filter must not back a live regulator request until real-DB e2e lands)
deployed_commit: 2ec4953
cardinal_invariants_live_verified: [append-only-hmac-chain-verify-309, export-one-export_generated-last-in-txn-309to310, server-side-sod-advisor-403, read-only-zero-audit + M2-400-validation, ac-strip-dom-content-both-roles]
independent_spot_checks: [health-hash==2ec4953-live, diff-5293045..2ec4953=2-files-process-only, h1-fix-confirmed-in-deployed-repository.ts, no-outreach-template-version-branch-in-buildConditions]
carried_to_L: [DEV-2-mandate-derivation-realdb-e2e (HIGH), gate-mandate-attribution (INFO), verify-route-consolidation (LOW), test-cred-registry (LOW-suppressed)]
next_action: PROCEED_TO_L
```
