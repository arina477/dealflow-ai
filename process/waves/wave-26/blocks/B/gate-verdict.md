# Wave 26 — B-block gate verdict (B-6 Review)

**Block:** B (Build) — M10 FINAL-hardening: RLS connection-split deploy contract + preflight
**Branch:** `wave-26-rls-connection-split-docs`
**Gate:** B-6 Review — Attempt 1 (Phase 1)
**Gate SHA:** b663615
**Gating agent:** head-builder (fresh spawn)

---

## Verdict: **APPROVED**

Every B-6 stage-exit check ticks from a concrete artifact. The two binding must-gates (MG1 guard-logic-frozen, MG2 stale-section-corrected) are independently verified against the diff. The preflight is correct, wired in the right order, and its test genuinely falsifies under mutation. GAP-3 is deferred with zero workflow changes. All CI signals are green and re-verified live in this gate (not taken on the author's word).

---

## Check-by-check evidence

### 1. MG1 — [RLS-GUARD] logic FROZEN (load-bearing security) — PASS
`assertNonSuperuserConnection` (`apps/api/src/db/index.ts:57-85`) — the predicate SQL (`current_setting('is_superuser')`, `rolbypassrls FROM pg_roles`), the two predicate branches (`is_superuser === 'on'`, `has_bypassrls`), and the fail-closed `throw` on each are **byte-for-byte unchanged**. Diff verification:
- `git diff main...HEAD` shows **NO removed lines** matching `is_superuser | rolbypassrls | has_bypassrls | === 'on' | current_setting | pg_roles`.
- The only `-` (removed) lines in the guard are JSDoc/error-message wording — the cross-ref text was re-pointed from "Railway C-2 hand-off notes" to `devops.md § "RLS connection-split..."`. Message-only, per MG1's explicit carve-out.
- **The diff for the existing guard is doc/message-only. No predicate or throw weakened. MG1 satisfied.**

### 2. 2-URLs-distinct preflight (`assertUrlsDistinct`) — PASS
`apps/api/src/db/index.ts:105-120`:
- `MIGRATE_DATABASE_URL` unset → early `return` (no-op) — protects local/test/single-URL. Confirmed by PREFLIGHT-1.
- both set + equal → throws `[RLS-GUARD] ... identical`. Confirmed by PREFLIGHT-2.
- both set + distinct → no-op. Confirmed by PREFLIGHT-3.
- **Wiring:** `main.ts:30-32` calls `assertUrlsDistinct()` under `NODE_ENV !== 'test'`, **before** `assertNonSuperuserConnection()` (`main.ts:43-45`) — correct order (fail before any DB connection is opened). Synchronous, opens no connection.
- **Test genuinely falsifies (mutation-tested by gate):** inverting the equality predicate (`===` → `!==`) broke PREFLIGHT-2 (equal no longer throws) AND PREFLIGHT-3 (distinct now throws). Both assertions bind to real behavior — NOT a hollow/coverage-only test. Mutation cleanly reverted; `index.ts` confirmed clean post-restore.

### 3. MG2 — stale devops.md §225-227 corrected — PASS
- The old claim — migrations run as "a one-shot Railway job... uses the **same** `POSTGRES_URL`" — is **removed** (confirmed present as a `-` line in the diff).
- Replaced with the accurate 2-context split: **prod preDeploy** (`preDeployCommand`, owner via `MIGRATE_DATABASE_URL`) vs **CI test-DB** (`ensureMigrated()` against ephemeral `TEST_DATABASE_URL`, superuser, never touches prod).
- `grep "same POSTGRES_URL"` on the current file → **NONE**. No lingering contradiction; devops.md is internally consistent.

### 4. Contract is ACCURATE (not fabricated) — PASS
The `devops.md § "RLS connection-split & role-privilege deploy contract"` cross-checks against the real code/env-schema:
- Role split table (`DATABASE_URL`=dealflow_app NOSUPERUSER NOBYPASSRLS / `MIGRATE_DATABASE_URL`=owner) matches the `[RLS-GUARD]` JSDoc + migration 0016 reference.
- PATH-safe `preDeployCommand` gotcha (`bash -lc` PATH-reset → `pnpm: command not found`, wave-17 deploy #1) is a documented real failure, and the bare env-prefix fix matches the preflight/guard runtime expectations.
- Coupled-rollback (revert deployment AND runtime `DATABASE_URL`→owner when target predates `[RLS-GUARD]`; additive-only migrations → no DB downgrade) is consistent with the guard's fail-closed contract.

### 5. Standing deploy-AC is CONCRETE/checkable (BUILD #11 anti-theater) — PASS
The 4-item checklist (`devops.md:299-302`) is mechanically anchored, not vague prose:
- 2-URLs-distinct → verified at boot by `assertUrlsDistinct()`.
- runtime NOSUPERUSER NOBYPASSRLS → verified by `[RLS-GUARD]` `assertNonSuperuserConnection()`; `GET /health` `db:ok` is the positive proof.
- PATH-safe preDeployCommand (no login-shell wrapper).
- rollback-plan-before-mutation (known-good deployment ID + commit SHA, coupled DATABASE_URL revert).
Each item has a concrete verification mechanism or artifact — checkable, not aspirational.

### 6. GAP-3 deferred correctly — PASS
Documented as a follow-up in two places (`devops.md § GAP-3` + Risk R-7) with the reason (PAT lacks `Workflows:write` → `ci.yml` commit blocked). **`git diff --name-only main...HEAD` shows zero `.github/workflows` changes.** No ci.yml touched.

### 7. CI signals — PASS (re-verified live in this gate)
- **typecheck:** `turbo run typecheck` → 4/4 successful (FULL TURBO).
- **lint:** `turbo run lint` → 3/3 successful, exit 0 (the "error state" strings surfaced are test-file comments, not lint findings).
- **build:** `turbo run build` → 3/3 successful.
- **unit:** `@dealflow/api` vitest → **986 passed / 95 skipped (1081 total)**, 46 files passed / 15 skipped. Preflight spec: 3/3 pass.

---

## Anti-pattern scan
- **Hollow AI Test Suite:** NOT present — preflight test mutation-falsified (2 of 3 assertions fail when predicate inverted).
- **Silent Audit Bypass / Direct SDK Coupling / Unbounded LLM Trust:** N/A — docs + preflight wave, no mutating endpoint, no SDK, no LLM path touched.
- **[RLS-GUARD] weakening:** explicitly checked — NONE. The load-bearing security guard is frozen.
- **Over-engineering:** the preflight is ~15 lines of direct, explicit logic — no speculative generality.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  attempt: 1
  gate_sha: b663615
  reviewers: {}
  failed_checks: []
  checks:
    mg1_rls_guard_logic_frozen: PASS   # doc/message-only; predicates + fail-closed throw unchanged
    preflight_correct_and_wired: PASS  # main.ts before assertNonSuperuserConnection, NODE_ENV!=test
    preflight_test_falsifies: PASS     # mutation-tested: === -> !== breaks PREFLIGHT-2 + PREFLIGHT-3
    mg2_stale_section_corrected: PASS  # 'same POSTGRES_URL' removed; 2-context split; no lingering contradiction
    contract_accurate: PASS            # cross-checks against [RLS-GUARD]/env-schema/C-2
    standing_ac_concrete: PASS         # 4-item checklist mechanically anchored
    gap3_deferred_no_ci_yml: PASS      # zero .github/workflows changes
    typecheck_4_4: PASS
    lint_exit_0: PASS
    build_3_3: PASS
    unit_986_pass: PASS                # 986 passed / 95 skipped
  rationale: >
    Docs-plus-preflight hardening wave verified end-to-end against concrete artifacts.
    MG1 confirmed frozen by diff inspection (only JSDoc + error-message + cross-ref wording
    changed on the existing guard; is_superuser/rolbypassrls predicates and fail-closed
    throws byte-for-byte preserved). MG2 stale 'same POSTGRES_URL' claim removed and
    replaced with the accurate 2-context split; no lingering contradiction. assertUrlsDistinct
    is correct, wired before the RLS guard under NODE_ENV!=test, and its test genuinely
    falsifies under predicate mutation (not coverage theater). Contract and standing AC are
    accurate and mechanically checkable. GAP-3 deferred with zero ci.yml change. typecheck 4/4,
    lint exit 0, build 3/3, 986 unit pass all re-verified live in the gate.
  next_action: PROCEED_TO_C-1
```
