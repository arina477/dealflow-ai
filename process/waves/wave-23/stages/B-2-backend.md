# Wave 23 — B-2-backend
seller-intent.scorer (PURE deterministic — NO Date.now() inside [grep-asserted], NO LLM/SDK; SI2 pinned WINDOW_DAYS=30/DIRECTION_EPSILON=5 + boundary tests; SI1 no-tieBreak asserted) + service (getDb workspace-scoped, fail-closed if GUC null, SI3 referenceInstant=max-event-ts + empty/single-event tests, read-only no-audit) + RBAC controller + module. Commit 8c27c7c. Cross-firm e2e (seller-intent-isolation): REAL SellerIntentService via workspaceAls.run as dealflow_app, SIT-1 WS_A excludes WS_B, SIT-3 fault-killing (no-ALS THROWS fail-closed). 26/26 unit. Deviations: none.
```yaml
skipped: false
deviations: []
```

## B-6 fix-up (commit 854bad5)

Two P2 correctness-relevant fixes applied in-branch per /review findings:

**Fix 1 — chronological timestamp comparison (determinism-critical path):**
Repository `seller-intent.repository.ts` (lines 205/208-210) and scorer `seller-intent.scorer.ts` (recency `mostRecentTs` reduce, ~line 314): replaced lexical string `>` / `a > b ? a : b` comparisons with `Date.parse(a) >= Date.parse(b)` for max-timestamp selection. Lexical order is only safe for UTC-only offsets; a non-UTC DB session timezone would produce wrong `referenceInstant` / wrong recency, breaking scores. Scorer seed fixed to use first element's ts (not `''`) so `Date.parse(seed)` is never `NaN`. Determinism preserved — `Date.parse` of a fixed string is pure. All 26 unit tests pass unchanged; the G-suite recency/cap tests (expected 40/31/100) confirmed the `''`-seed NaN edge case was found and resolved correctly.

**Fix 2 — epsilon direction docstring typo (comment-only):**
Line 25 of scorer docstring: `delta ≥ 5 → 'heating'` corrected to `delta > EPSILON → 'heating'; |delta| ≤ EPSILON → 'flat'`. No logic change; aligns the docstring with code (line ~423) and the SI2 constant block comment, both of which already used strict `>`.

Typecheck: clean. Scorer unit tests: 26/26 green. No snapshot drift (determinism preserved).
