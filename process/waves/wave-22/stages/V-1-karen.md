# V-1 Karen — Wave 22 (M9 test-hygiene fix: outreach-activity-rls audit-assertion scoping)

**Verdict: APPROVE** — 0 findings.

Deployed-state for a test-only wave = the fix on main + CI-green proof. Both verified against observable artifacts (git tree + gh CI run/log), not inferred from a clean diff.

## What was verified

### 1. Fix IS on main — REAL
- HEAD = `7cd0843` (on `main`), one commit past `c168d3a`; both carry the fix. Real change commit = `128ede8`, merged to main via `e832633`.
- `apps/api/test/outreach-activity-rls.e2e-spec.ts`: all **12** audit reads scoped `WHERE workspace_id = $1` with `[OAE_WS_A]` param — **8 COUNT** (L374, 409, 456, 478, 522, 547, 592, 617) + **4 latest-action** (L417, 484, 555, 625).
- `grep 'FROM audit_log_entries'` = 12 hits, **all** carry `WHERE workspace_id = $1`. **Zero unscoped reads remain.**
- Fix diff (128ead8) is surgical: every hunk adds only `WHERE workspace_id = $1` + `[OAE_WS_A]` param (+ comment tweaks). No other line touched.

### 2. CI genuinely verified it (flake-fix proof)
- Run **28850000460** @ headSha `c168d3a`: `conclusion=success`, `status=completed`, workflow=CI.
- **5/5 jobs green**: lint, audit, test, typecheck, build.
- `test` job log (id 85562717186) shows: `✓ test/outreach-activity-rls.e2e-spec.ts (9 tests) 1400ms` — suite **RAN, all 9 passed, not skipped**. Confirms the scoped assertions execute green under CI's shared-DB conditions (the exact flake surface).

### 3. NOT weakened (the key check) — PASS
- COUNT assertions still **exact**: `toBe(beforeCount + 1)` at L413, 481, 552, 622. Zero `toBeGreaterThan` / `toBeGreaterThanOrEqual` / `>=` in file.
- Latest-action assertions still **exact**: `toBe('outreach-activity-create'|'-update'|'-status-transition'|'-cancel')` at L420, 487, 558, 628.
- **No retry / skip added by the fix.** Only `.skip` in file is pre-existing `describe.skipIf(shouldSkip)` (L174, wave-20 env guard) — untouched by the 128ede8 diff. No `retryTimes` / `it.only` / `xit`.
- Scoping narrowed the *population* (workspace A only), NOT falsifiability — a stray or missing entry in workspace A still fails the exact `toBe`.

### 4. verifyChain untouched — PASS
- Fix diff touched **zero** `verifyChain` lines. All 6 global-chain verify calls (L423, 489, 560, 630, etc.) unchanged.
- `workspace_id` is hash-excluded, so the global hash-chain (`verifyChain().ok === true`) is orthogonal to the read scoping — correctly left alone. Global chain integrity assertions preserved.

## Conclusion
The flake root cause (cross-workspace audit-row contention on unscoped `COUNT(*)` / latest-action reads under a shared CI DB) is genuinely fixed by narrowing reads to workspace A. Falsifiability, exactness, fault-killing, and global-chain verification all preserved. CI proves the fix green at the fix SHA with the suite actually executing. No Done-Theater, no assertion softening, no skip. **APPROVE.**
