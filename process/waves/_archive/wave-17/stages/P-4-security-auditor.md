# Wave 17 — P-4 security-auditor (security-scope-tightened, iteration 1)
VERDICT: FINDINGS 4 [1 CRITICAL, 1 HIGH, 2 MEDIUM] → BLOCK (isolation-defeating). All folded into P-3 + seed-spec rework.
- **F1 (CRITICAL):** GUC tx-local but tenant READS run non-tx on pooled handle (41 modules) → FORCE-RLS bricks reads / obvious session-SET fix leaks across pooled connections. FIX: request-scoped dedicated connection + RESET-in-finally.
- **F2 (HIGH):** getUserWithRole reads users (RLS) to resolve workspace before GUC set → chicken-and-egg → every request fails closed. FIX: resolve_user_workspace SECURITY DEFINER RLS-exempt bootstrap.
- **F3 (MEDIUM):** verifyChain walks global chain; RLS-scoping → false ok:false (sequence-gap) OR vacuous ok:true entriesChecked:0. FIX: integrity walk RLS-exempt (global, ok:true) vs list/export projection RLS-scoped.
- **F4 (MEDIUM):** hash-excluded workspace_id → cross-workspace re-attribution tamper-invisible to chain; sole backstop is WORM trigger. FIX: record posture + df2f3b2f asserts WORM blocks workspace_id UPDATE.
PASSED checks: FORCE-RLS (1), fail-closed policy shape no-COALESCE (3), backfill-before-NOT-NULL (4).

# Wave 17 — P-4 security-auditor (ITERATION 2 — re-review of rework)
VERDICT: CLEAN — all 4 iteration-1 findings genuinely CLOSED (verified vs shipped code); no new medium+ isolation defect. Security gate re-review APPROVED.
- F1 CLOSED: dedicated-connection + RESET-in-finally; unset-GUC deny-all means a mis-binding DENIES not leaks (double-closed: DISCARD-in-finally + SET-on-checkout-before-any-query).
- F2 CLOSED: resolve_user_workspace SECURITY DEFINER returns caller's own workspace_id+role only; server-derived st_user_id (never client-supplied).
- F3 CLOSED: integrity walk RLS-exempt returns ONLY the boolean (no content leak); list/export projection RLS-scoped.
- F4 CLOSED: WORM trigger BEFORE-UPDATE unconditional RAISE = owner-proof; df2f3b2f asserts it blocks a workspace_id UPDATE.
CARRY-TO-B2 (advisory, non-blocking): [a] specify per-request handle-binding (AsyncLocalStorage vs request-scoped chain — ~41 repos inject the DB singleton; a naive Scope.REQUEST won't re-bind); [b] preserve server-derived-st_user_id into resolve_user_workspace; [c] prefer surgical RESET app.workspace_id over DISCARD ALL; [d] label global-verify vs scoped-projection in the export manifest.
