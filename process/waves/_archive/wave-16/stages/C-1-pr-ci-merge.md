# C-1 — PR, CI & merge (wave-16 · M7 admin-hardening)

**Head:** head-ci-cd (fresh spawn, C-block lifetime).
**Branch:** `wave-16-admin-hardening`.
**Repo:** `arina477/dealflow-ai`. **Merge mechanism:** direct-push-to-main (established wave-11..15 — this repo's PAT lacks PR:write + Workflows:write; `main` is NOT PR-protected; CI runs on `push → main`). No `gh pr create` attempted (would 403 on this PAT).

## Push → main (fast-forward, provenance-verified)

- Pre-push verification: `git merge-base --is-ancestor origin/main HEAD` → origin/main was ancestor of branch HEAD (fast-forward clean; main only ever fast-forwards, never force).
- **Ghost-Green / phantom-skip caught before push:** branch HEAD `3b0d037` carried `[skip ci]` in its message. Pushing it directly to `main` would have SKIPPED the entire CI run (GitHub honors `[skip ci]` on the head commit of a push) — a fabricated green. Mitigation: appended an empty commit `67f3bba` with a clean CI-triggering message whose **tree SHA is byte-identical** to `3b0d037` (`fa45770...` == `fa45770...`), so CI validates the exact same code tree while actually running.
- Secret scan of the 21-commit diff (Railway bearer / private-key / cloud-token patterns) → clean, no leak.

Two pushes to `main` (both fast-forward):

| Push | main range | Head SHA | Reason |
|---|---|---|---|
| 1 | `42e8769..67f3bba` | `67f3bba` | Initial CI-triggering push (tree == B-block HEAD `3b0d037`) |
| 2 | `67f3bba..d72d7cb` | `d72d7cb` | Fix-forward push (cycle 1 — see below) |

## CI runs (authoritative, on `push → main`)

CI = 5 jobs: `lint`, `typecheck`, `test` (postgres:18 service + TEST_DATABASE_URL → real-DB e2e suites), `audit` (`pnpm audit --audit-level=high` — security gate), `build`.

### Run 1 — RED (real failure, not flake)
- Run `28804487561`, `headSha=67f3bba` (== main HEAD at the time — provenance verified).
- Run-level `conclusion=failure`. `gh run watch --exit-status` returned 0 (superficial) but the queryable API conclusion was `failure` — verified per-job, did NOT trust the watch signal.
- Per-job: lint ✓ · typecheck ✓ · **test ✗** · audit ✓ · build ✓.
- Failure: `apps/api` `@dealflow/api#test` → `test/recordkeeping-gate.e2e-spec.ts` lines 605 (test G) + 638 (test H), both `expect(pkg.verifyResult.ok).toBe(true)` → received `false`. The HMAC-SHA256 audit-log hash-chain `verifyChain` returned `ok:false`. `@dealflow/web#test` passed. NOT a WORM-teardown P0001, NOT a migration Ghost-Green — a genuine cross-suite HMAC-key contamination exposed by wave-16 adding a new parallel audit-writing e2e suite.

### Fix-forward cycle 1 (Iron Law — routed, not self-fixed)
- Classified: real e2e regression on the load-bearing compliance invariant (audit hash chain). Routed to `backend-developer` (originating B-2 specialist) via fresh spawn with the exact failure (spec + line numbers + blast radius).
- Root cause (specialist): `recordkeeping-gate.e2e-spec.ts` `beforeAll` hardcoded a **suite-private** `AUDIT_LOG_HMAC_KEY`. Wave-16's new `admin-activity.e2e-spec.ts` (+ `admin-concurrency.e2e-spec.ts`) write audit rows to the shared `dealflow_test` DB using the vitest-default key. Vitest 3.x runs e2e files in parallel forks; when `recordkeeping-gate`'s `verifyChain` walks the FULL chain it recomputes the foreign rows' HMAC with its private key → `content-hash-mismatch` → `ok:false`.
- Fix (`d72d7cb`, test-file only, 11+/2−): replace the private key with the `??` shared-default pattern (matching admin-concurrency + admin-activity) so all suites share one key and the chain verifies regardless of parallel interleave. **`verifyResult.ok` assertions preserved** (lines 614, 647 post-fix) — NOT weakened. No production source touched.

### Run 2 — GREEN (authoritative)
- Run `28805234334`, `headSha=d72d7cb` (== current origin/main HEAD — provenance verified).
- Run-level `conclusion=success`. Per-job (all 5): **lint ✓ · typecheck ✓ · test ✓ · audit ✓ · build ✓**.
- Package summaries: web `44 passed (44)`, shared `28 passed (28)`, api `5 passed (5)` e2e block.
- **Privileged real-DB e2e suites (postgres:18 TEST_DATABASE_URL) all ✓:**
  - `test/admin-concurrency.e2e-spec.ts (11 tests)` ✓ — INVITE-CONC-1 advisory-lock exactly-one + REACTIVATE-1/2 + wave-15 CONC/SEC still green.
  - `test/recordkeeping-gate.e2e-spec.ts (9 tests)` ✓ — the previously-RED G+H `verifyChain {ok:true}` now green (the fix).
  - `test/mandate-cascade.e2e-spec.ts (5 tests)` ✓ — CASCADE-1 inherits-default (named ✓), CASCADE-2 change-default-doesnt-mutate, CASCADE-3a string + CASCADE-3b object round-trip (the /review fix), CASCADE-4.
  - `test/admin-activity.e2e-spec.ts (6 tests)` ✓ — ACT-1 read-only newest-first excludes-non-admin (named ✓), read-appends-0-audit-rows + RBAC 403/401 + no-secret-in-row + ACT-6 DI-boot (named ✓).
  - `test/outreach-gate.e2e-spec.ts (6 tests)` ✓, `test/pipeline-gate.e2e-spec.ts (4 tests)` ✓ (prior-wave suites, still green).
  - admin.spec C-4 config-boundary (secret-absent-from-error) + E-1a/E-1b/E-2 reactivate-uuid ran in the api unit/e2e run within the green `test` job.
- Security gate `audit` (`pnpm audit --audit-level=high`) exit 0 — no high/critical CVE.

## Local main sync
- `git checkout main && git pull` → local main at `d72d7cb` (== origin/main).

## Deliverable footer

```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "push → main (ff): 42e8769..67f3bba, then 67f3bba..d72d7cb"
  - "green run: 28805234334 conclusion=success headSha=d72d7cb — https://github.com/arina477/dealflow-ai/actions/runs/28805234334"
  - "5/5 jobs green: lint, typecheck, test (postgres:18 real-DB e2e), audit (pnpm audit --audit-level=high exit 0), build"
  - "privileged e2e proven: admin-concurrency (11) INVITE-CONC-1+REACTIVATE-1/2, recordkeeping-gate (9) verifyChain ok:true, mandate-cascade (5) CASCADE-3a/3b round-trip, admin-activity (6) read-appends-0-audit + no-secret"
  - "prior RED run: 28804487561 conclusion=failure (recordkeeping-gate G/H verifyChain ok:false) — fixed forward, NOT masked"
pr_number: null                       # direct-push-to-main; PAT lacks PR:write (no PR object)
pr_url: null
branch: wave-16-admin-hardening
required_checks: [lint, typecheck, test, audit, build]
optional_checks: []
fix_up_cycles: 1                       # backend-developer d72d7cb — HMAC cross-suite key alignment (test harness)
final_commit_sha: d72d7cb735aff74fcdbdb28bd20f19bf711cc539   # green commit on main
merge_strategy: fast-forward-to-main   # direct-push mechanism (waves 11-15)
merge_commit_sha: d72d7cb735aff74fcdbdb28bd20f19bf711cc539
rebase_cycles: 0
note: "direct-push-to-main; e2e ran privileged incl CASCADE-3b object round-trip + INVITE-CONC-1 + admin-activity read-only. Ghost-Green [skip ci]-on-HEAD caught before push (identical-tree CI-triggering commit). Run-1 RED (audit hash-chain verifyChain ok:false) routed to backend-developer per Iron Law; fix-forward d72d7cb (test-harness HMAC-key alignment, assertion preserved) → Run-2 all-5-green."
```

## Head-CI-CD C-1 stage-exit signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: { backend-developer: "fix-forward d72d7cb accepted — root-caused, assertion preserved, no prod source touched" }
  failed_checks: []
  rationale: >
    Every C-1 exit checkbox tickable from concrete gh artifacts. CI tested commit SHA (d72d7cb)
    matches origin/main HEAD exactly — no stale/cached green. The [skip ci]-on-HEAD phantom-skip
    was caught and neutralized with an identical-tree CI-triggering commit (provenance intact).
    pnpm audit --audit-level=high gate passed exit 0. Drizzle migrations in the wave are
    additive-only (rollback = drop added column/index/endpoint per bundle theme). The lone RED run
    was a real compliance-invariant regression (audit hash-chain verifyChain ok:false), routed per
    Iron Law to backend-developer — NOT self-fixed, NOT masked; the fix preserves the verifyChain
    assertion. Authoritative green verified via queryable run-level + per-job conclusions, not the
    superficial `gh run watch` exit code (which returned 0 on the RED run).
  next_action: PROCEED_TO_C-2
```
