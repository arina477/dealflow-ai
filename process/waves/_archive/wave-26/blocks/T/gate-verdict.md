# Wave 26 — T-block gate verdict (T-8 Security-adjacent + T-9 Journey)

**Block:** T (Test) — M10 FINAL-hardening: RLS connection-split deploy contract + `assertUrlsDistinct` startup preflight
**Wave type:** docs / devops-hardening + a small startup preflight assertion (no new API / UI / perf surface)
**State:** LIVE @0825370 | CI 28889547491 all 5 green | app BOOTED past both startup guards in prod
**Gating agent:** head-tester (fresh spawn at T-9)

---

## Verdict: **APPROVED**

Every T-8 (security-adjacent) and T-9 (journey) exit check ticks from a concrete, independently-corroborated artifact. The one load-bearing compliance invariant this wave touches — the `[RLS-GUARD]` runtime NOSUPERUSER/NOBYPASSRLS enforcement — is verified **frozen** (predicates + fail-closed throws byte-for-byte unchanged; only JSDoc/message/cross-ref wording moved). The new `assertUrlsDistinct` preflight is proven **boot-safe** by real prod behavior, not a green badge. No coverage theater, no untested invariant, no silently-skipped E2E, no journey-map drift.

---

## Check-by-check

### 1. MG1 — `[RLS-GUARD]` logic FROZEN + preflight genuinely falsifies — PASS
- B-6 diff inspection (`git diff main...HEAD`) confirms **zero removed lines** matching the guard predicates (`is_superuser`, `rolbypassrls`, `has_bypassrls`, `=== 'on'`, `current_setting`, `pg_roles`) or their fail-closed `throw`. The only `-` lines on the existing guard are JSDoc/error-message wording + a cross-ref re-point to `devops.md`. MG1's message-only carve-out satisfied.
- The `url-distinct-preflight` spec (PREFLIGHT-1 unset→no-op / PREFLIGHT-2 equal→throw / PREFLIGHT-3 distinct→ok) is **mutation-falsified**, not tautological: inverting the equality predicate (`===`→`!==`) broke PREFLIGHT-2 **and** PREFLIGHT-3. Two assertions bind to real behavior. This is not a hollow/coverage-only test.

### 2. Prod boot-past-both-guards is the load-bearing proof — PASS
- C-2 confirms the app reached "API listening" in prod. `main.ts` wires `assertUrlsDistinct()` (`NODE_ENV!=='test'`, synchronous, opens no connection) **before** `assertNonSuperuserConnection()`. Reaching "API listening" is behavioral proof that **neither guard threw** — i.e., the newly-added preflight did not brick startup and the frozen RLS guard still passes against the live NOSUPERUSER/NOBYPASSRLS role. Genuine deployed-state evidence, not inferred from a passing suite.

### 3. Contract + standing deploy-AC are CONCRETE (BUILD #11 anti-theater) — PASS
- `devops.md` documents the RLS connection-split accurately (role-split table cross-checks the `[RLS-GUARD]` JSDoc + migration 0016), corrects the stale §225-227 (MG2: "same POSTGRES_URL" removed, replaced with the accurate prod-preDeploy vs CI-test-DB 2-context split, `grep` confirms no lingering contradiction).
- The 4-item standing deploy-AC is mechanically anchored to verification mechanisms, not aspirational prose: 2-URLs-distinct → `assertUrlsDistinct()` at boot; runtime NOSUPERUSER/NOBYPASSRLS → `[RLS-GUARD]` + `GET /health` `db:ok`; PATH-safe `preDeployCommand`; rollback-plan-before-mutation. Each item is checkable.

### 4. No regression — PASS
- Wave-25 rate-limiter survived (429 smoke). 2427 tests pass / 0 fail. App boots. No auth/RLS behavior regressed — the guard is frozen and the only added code path is a fail-before-connect preflight.

### 5. T-9 Journey — journey map VALID (unchanged) — PASS
- `git diff --name-only main...HEAD` → **zero UI / route / component files** (`NO_UI_OR_ROUTE_FILES_CHANGED`). Wave is docs + one startup assertion. No screen/route/endpoint added or altered → `user-journey-map.md` stays valid, no regeneration required.
- **Playwright Chrome binary gate does NOT fire:** the silent-false-PASS ESCALATE trigger is scoped to UI code changes requiring live E2E/layout verification. There is no UI surface this wave, so T-5/T-6 are legitimately N/A — not a skipped/silently-passing suite. (Had any `.tsx`/route changed with a binary-absent green, this would be a hard ESCALATE.)

### 6. The 3 findings — acceptable / routed — PASS
- **#1 P2 (accepted):** `assertUrlsDistinct` raw-string compare could false-negative on trailing-slash/host-alias. Accepted as defense-in-depth — `[RLS-GUARD]`'s role-based `assertNonSuperuserConnection` is the *real* enforcement; the preflight is a cheap early-fail supplement, not the security boundary. Acceptable.
- **#2 INFO→founder:** enforced wave-27 founder-pause on M10 recordkeeping-scope + `_TBD` metric (founder-reserved). Correctly routed to founder — not a T-block blocker.
- **#3 INFO→founder:** Actions-billing 5th same-day withholding (cleared on the 5th) → permanent-limit-raise / self-hosted-runner recommendation offered to founder. Routed. Infra-billing, not a code/test defect.

---

## Anti-pattern scan
- **Coverage theater / tautological assertions:** NONE — preflight mutation-falsified (2 of 3 assertions fail on predicate inversion).
- **Untested compliance invariant:** NONE — `[RLS-GUARD]` frozen (verified by diff) and re-proven by live prod boot; the added preflight is itself tested.
- **Silently-skipped E2E (missing browser binary):** N/A — zero UI code changed; no E2E owed. Not a false-green.
- **CI blindness / gating on a green badge:** avoided — verdict rests on the diff, the mutation result, and the live prod boot-past-both-guards, not on `exit 0` alone.
- **Process-theater AC (BUILD #11):** avoided — every standing-AC item has a concrete runtime/artifact anchor.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: T-9
  reviewers: {}          # docs/preflight wave; corroborated by B-6 diff+mutation gate, no fresh specialist spawn warranted
  failed_checks: []
  checks:
    mg1_rls_guard_frozen: PASS          # predicates + fail-closed throws byte-for-byte unchanged; message-only diff
    preflight_falsifies: PASS           # === -> !== breaks PREFLIGHT-2 + PREFLIGHT-3 (mutation-tested, not tautological)
    boot_past_both_guards_real: PASS    # prod reached "API listening" => neither guard threw (live behavioral proof)
    contract_and_ac_concrete: PASS      # devops.md accurate + MG2 stale-section corrected + 4-item mechanically-anchored AC
    no_regression: PASS                 # rate-limiter 429 smoke survived; 2427 pass / 0 fail; app boots
    t9_journey_map_valid: PASS          # zero UI/route changes; journey map unchanged
    playwright_gate_not_applicable: PASS # no UI surface => T-5/T-6 legitimately N/A, not a silent false-PASS
    findings_routed: PASS               # P2 accepted defense-in-depth; 2 INFO routed to founder
  rationale: >
    Docs-plus-preflight hardening wave gated on concrete deployed-state evidence. The single
    load-bearing compliance invariant ([RLS-GUARD] runtime NOSUPERUSER/NOBYPASSRLS) is verified
    frozen by B-6 diff inspection and re-proven live by the prod boot reaching "API listening"
    (neither the new assertUrlsDistinct preflight nor the frozen RLS guard threw). The preflight
    test genuinely falsifies under predicate mutation — not coverage theater. The deploy contract
    and 4-item standing AC are accurate and mechanically anchored (MG2 stale section corrected).
    No auth/RLS regression; 2427 pass / 0 fail; rate-limiter survived. Zero UI/route changes, so
    the journey map stays valid and the Playwright-binary ESCALATE trigger does not fire (T-5/T-6
    legitimately N/A, not a silently-skipped suite). All 3 findings acceptable or founder-routed.
  next_action: PROCEED_TO_V-block
```
