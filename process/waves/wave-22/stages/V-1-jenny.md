# V-1 jenny — Wave 22 (M9 test-hygiene fix)

**Verdict: APPROVE**
**Tally: 5 MATCHES / 0 DRIFTS**

Spec = seed 02f4e6a1 (P-2 SCOPE head): scope all ~12 shared-DB audit assertions in `apps/api/test/outreach-activity-rls.e2e-spec.ts` by `workspace_id` per T-4 rule 2; keep fault-killing; one-suite; test-only. Fix = commit `128ede8` (single file, 27+/15-).

## Evidence

**1. Implements promoted T-4 rule 2 (own-scoped rows of shared chain) — MATCH.**
Exactly 12 shared-DB audit reads now filter `FROM audit_log_entries WHERE workspace_id = $1` with `[OAE_WS_A]` bound: 8 `COUNT(*)` + 4 `SELECT action ... ORDER BY sequence_number DESC LIMIT 1` (grep: 12 scoped reads, 12 `[OAE_WS_A]` bindings, 0 unscoped audit reads remaining). Matches P-3's 8-COUNT + 4-latest-action decomposition exactly. This is the rule-2 population-narrowing, NOT a symptom-patch: grep for `retryTimes | .only( | describe.serial | test.serial | --runInBand | maxWorkers` = NONE. No retry, no serialize.

**2. Fault-killing preserved — MATCH.**
All 4 delta assertions remain exact `toBe(beforeCount + 1)` (lines 413, 481, 552, 622) and all 4 last-action assertions remain exact-verb `toBe('outreach-activity-{create|update|status-transition|cancel}')` (lines 420, 487, 558, 628). Narrowing is the row population (this workspace), not the falsifiability — a workspace-scoped count still proves exactly-one-append-per-mutation and the scoped latest-action still proves the correct verb. NOT weakened to vacuous `>= 1` or dropped verb. Consistent with B-6 + T-9 prior verdicts (confirmed, not re-audited). The 4 `verifier.verifyChain()` calls (lines 423, 489, 560, 630) are correctly LEFT unscoped — whole-chain HMAC integrity is a distinct invariant (workspace_id is HASH-EXCLUDED per wave-17), so chain verification stays chain-wide; this is correct, not drift.

**3. One-suite HOLD-SCOPE — MATCH.**
`git show 128ede8 --stat` = 1 file changed (`outreach-activity-rls.e2e-spec.ts` only). No other-suite sweep, consistent with the ceo-reviewer no-sweep / HOLD-SCOPE call.

**4. Test-only, no product change — MATCH.**
Diff touches only test assertions (SQL WHERE clauses + comments). No product code, no migration, no UI, no controller/service/schema change. Consistent with M9 _TBD-metric reliability-fix framing.

**5. Spec-gap for next wave — MATCH (noted, not this wave).**
The CI-authoritative policy (wave-21) is the long-term owner to flag any OTHER unscoped-audit suites in the shared-DB CI Postgres. This wave correctly holds scope to the single OAE suite; a follow-up audit-sweep of remaining e2e suites for the same shared-chain hazard is a valid next-wave candidate, explicitly out of scope here. No blocking gap.

## Note
Fix is committed but the wave carries an open infra hard-stop (C-1 BLOCKED — GitHub Actions not dispatching on main pushes, commit 39b3225). That is an infra-readiness condition outside V-1's spec-match remit; the spec-vs-implementation match is clean and complete. V-1 scope = fix matches spec intent + no drift → APPROVE. Green-in-CI confirmation is the C-block/infra concern, not a spec-compliance defect.
