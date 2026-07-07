# C-1 — push→main + CI watch (wave-25 M10 auth-hardening)

**Stage:** C-1 (PR-author + CI-watch). **Mode:** automatic. **head-ci-cd gate.**

## What was done

- **Pre-push guards (all PASS):**
  - Workflow-file diff `main..wave-25-auth-hardening -- .github/workflows/` = **empty** → direct-push-to-main not rejected on workflow-scope grounds. (PAT lacks PR:write + workflow scope; direct-push is the established model.)
  - Migration `0019_rate_limit_hits.sql` audited: **purely additive** — `CREATE TABLE rate_limit_hits` (PK `(key, window_start)`), `GRANT … TO dealflow_app`, `CREATE INDEX` on `expires_at`. No `DROP`/`ALTER` of existing objects. Journaled at idx 19, tag `0019_rate_limit_hits`. Satisfies additive-only zero-downtime heuristic.
  - DB-gated security tests confirmed present + wired to run in CI: `SEC-1-DB` (real-PG concurrent atomic UPSERT → exactly one 429; `ensureMigrated` applies 0019 first) and `SEC-4-DB` (same-email/different-IP → shared bucket), both guarded by `describe.skipIf(!hasTestDb)` where `hasTestDb` derives from `TEST_DATABASE_URL`. CI `test` job sets `TEST_DATABASE_URL` (separate `dealflow_test` DB in a `postgres:18` service container) → these tests **run, not skipped**, in CI.
  - CI required jobs (`.github/workflows/ci.yml`): **lint, typecheck, test, audit (`pnpm audit --audit-level=high`), build** — 5 jobs.

- **Ghost-Green guard (CI #2) applied:** HEAD of wave-25 branch `0648744` is `[skip ci]` and its tree adds only 3 process/ deliverable docs. Built a **CI-triggering** commit `704ba83` via `git commit-tree` carrying the **real code tree** (`6476bc5`'s tree `3326456…` — migration 0019 + rate-limit middleware + trust-proxy + auth validation + DB-gated tests), parented on main `a6744df`, message is NOT `[skip ci]`, tree is non-empty. Fast-forwarded local main and **pushed**: `a6744df..704ba83 main -> main` (confirmed `origin/main = 704ba83`).

## CI dispatch result — INFRA HARD STOP (Actions withholding, recurrence)

**Verified a workflow run FIRED on the exact pushed headSha `704ba83` — it did NOT.**

- Polled ~2.5 minutes: **0 check-suites, 0 runs** on `704ba83` (`gh api …/commits/704ba83/check-suites` → `total_count=0`; `gh run list --branch main` → no run with `headSha=704ba83`).
- The CI workflow **does** trigger on `push` to main (ci.yml `on.push.branches:[main]`; every historical run is `event=push` on main).
- Repo-wide dispatch history shows runs firing normally earlier today (last: run `28864986791` @12:09:10Z on `1d48c0b`), then **stopping** — matching the founder-decision doc's signature: "Every push is accepted but produces zero test runs." This is the **second same-day recurrence** of the GitHub Actions monthly-minutes exhaustion (founder-cleared twice earlier today).
- PAT cannot read/raise Actions billing (`403 Resource not accessible by personal access token` on `actions/permissions`). Only the account owner can raise the Actions spending limit.

**No green was fabricated. C-1 did NOT pass.** The wave's entire security proof (migration-0019-applies + SEC-1-DB + SEC-4-DB ran+passed in CI) cannot be observed while Actions withholds runs. Per the always-on anti-fabrication rule and the CI #2 guard, the loop stops here rather than extrapolating a pass. C-2 (real, migration-bearing deploy) is NOT entered — deploying unverified auth-path + migration code to prod would be reckless.

## Founder action required (account-owner billing — brain/​PAT cannot do this)

On `github.com/arina477/dealflow-ai → Settings → Billing and plans → Actions usage`: **raise the Actions spending limit** (recommended — it re-exhausted same-day, so the current limit is too low for this session's pace), or wait for the monthly minutes reset. Also confirm `Settings → Actions → General` allows workflows to run. On resume, C-1 re-triggers CI on `704ba83` (already on main), watches to green (5/5, incl. migration-0019-applied + SEC-1-DB + SEC-4-DB), then proceeds to C-2 real deploy.

```yaml
ci_stage_verdict: FAIL                # CI could not run — Actions withholding (infra hard stop). NOT a fabricated PASS.
verdict_source: gh
verdict_evidence:
  - "push OK: a6744df..704ba83 main -> main (origin/main == 704ba83)"
  - "gh api repos/arina477/dealflow-ai/commits/704ba83/check-suites → total_count=0 (polled ~2.5min)"
  - "gh run list --branch main: no run with headSha 704ba83; last dispatched run 28864986791 @12:09:10Z on 1d48c0b"
  - "gh api actions/permissions → 403 (PAT cannot read/raise Actions billing)"
head_signoff:
  verdict: ESCALATE
  stage: C-1
  failed_checks:
    - "CI run FIRED on exact pushed headSha (0 check-suites / 0 runs on 704ba83 after ~2.5min)"
    - "5 required jobs green (never dispatched)"
    - "migration-0019-applies in CI DB (test job never ran)"
    - "SEC-1-DB ran+passed (test job never ran)"
    - "SEC-4-DB ran+passed (test job never ran)"
  rationale: >
    Actions is withholding runs for the second same-day recurrence (0 check-suites on the
    exact pushed headSha 704ba83; CI otherwise triggers on push→main and ran normally earlier
    today). Root cause per the founder-decision doc is exhausted monthly Actions minutes; fix is
    account-owner billing (raise spending limit), which the PAT is blocked from (403). Per the
    CI #2 anti-fabrication guard, no green may be extrapolated. C-2 (real, migration-bearing,
    auth-path deploy) is not entered without a verified-green C-1.
  next_action: ESCALATE_TO_founder
pushed_head_sha: 704ba83
branch: wave-25-auth-hardening (code tree merged to main via CI-triggering tip 704ba83)
required_checks: [lint, typecheck, test, audit, build]   # never dispatched
note: "Actions-minutes exhaustion recurrence (2nd same-day). STATUS: BLOCKED, trigger d, infra-readiness. Resume: re-trigger CI on 704ba83 once billing raised."
```

---

# C-1 RESUME (2026-07-07T15:20Z) — CI DISPATCHED + GREEN after founder raised Actions billing (3rd clear)

**Founder raised the GitHub Actions spending limit (3rd same-day clear) and replied Continue. STATUS→RUNNING.**
Per the CI #2 anti-fabrication guard I did NOT assume the raise took effect — I pushed a fresh
CI-triggering tip and VERIFIED a run dispatched on the exact headSha before proceeding. The ESCALATE
block above is **superseded** by this section.

## Fresh CI-triggering tip (real code, non-[skip ci], no workflow change)
- main `2a776bc` already carries the full wave-25 auth-hardening code (migration 0019 + rate-limit
  middleware + trust-proxy + auth validation + DB-gated SEC-1-DB/SEC-4-DB). Added a real, non-empty
  marker `process/waves/wave-25/.ci-trigger` and committed **`987ebb4`** with a **non-`[skip ci]`**
  message parented on `2a776bc`.
- **Workflow-file diff vs origin/main = empty** → PAT workflow-scope safe. Pushed `2a776bc..987ebb4 main -> main` (origin/main == `987ebb4`).

## VERIFIED — a run FIRED on the exact pushed headSha (the recurrence check)
- `gh api repos/arina477/dealflow-ai/commits/987ebb4/check-suites` → **`total_count=1`** (was 0 on the two prior blocked attempts).
- `gh run list --branch main` → run **`28876707093`** (`event=push`, workflow `CI`) matches `headSha=987ebb4`. **Actions dispatch restored** — the billing raise took effect.

## Run 28876707093 — QUERYABLE conclusion: `completed` / `success`, all 5 jobs GREEN
| job | conclusion |
|---|---|
| lint | success |
| typecheck | success |
| test | success |
| audit (`pnpm audit --audit-level=high`, exit 0) | success |
| build | success |

## Security proof (DB-gated tests RAN in CI where TEST_DATABASE_URL is set)
- **SEC-1-DB RAN + PASSED** — `src/modules/auth/rate-limit.middleware.spec.ts (48 tests) 2167ms`; slow test
  `SEC-1-DB: real Postgres concurrent atomicity — N+1 parallel requests, exactly one 429 (real PG atomic UPSERT) 1809ms` — genuine real-Postgres work, not skipped.
- **Migration 0019 APPLIES in CI** — SEC-1-DB's `ensureMigrated` applies 0019 first; a real concurrent UPSERT into `rate_limit_hits` returning exactly one 429 is only possible if the table exists ⇒ 0019 applied in the CI DB.
- **SEC-4-DB RAN + PASSED** — shares SEC-1-DB's `describe.skipIf(!hasTestDb)` guard in the same 48-test file; **zero skipped/pending tests across the entire run**, so with TEST_DATABASE_URL set the email-keying test ran.
- **All suites green, auth flow not regressed** — Test Files 5/5, 60/60, 30/30; Tests 509 + 1078 + 837 all passed, 0 failed, 0 skipped.
- **No secret leak** — log grep for railway/bearer/token strings empty; ci.yml is `permissions: contents: read`, injects no secrets.
- **Migration additive-only** — 0019 SQL = `CREATE TABLE rate_limit_hits` + `GRANT … TO dealflow_app` + `CREATE INDEX`; DROP/DELETE only in comments.

```yaml
ci_stage_verdict_RESUME: PASS
verdict_source: gh
verdict_evidence:
  - "push OK: 2a776bc..987ebb4 main -> main (origin/main == 987ebb42e48df759ca7b6b1872b48c54be5dd7fe)"
  - "gh api commits/987ebb4/check-suites → total_count=1 (DISPATCH RESTORED; was 0 on 704ba83)"
  - "run 28876707093 event=push workflowName=CI headSha=987ebb4 → status=completed conclusion=success"
  - "jobs: lint=success typecheck=success test=success audit=success build=success (5/5)"
  - "test log: rate-limit.middleware.spec.ts (48 tests) green; SEC-1-DB real-PG atomicity 1809ms PASS; 0 skipped across run (509+1078+837 tests passed)"
  - "pnpm audit --audit-level=high job=success (exit 0)"
head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: >
    After the founder raised the GitHub Actions spending limit (3rd same-day clear), a fresh non-[skip ci]
    tip 987ebb4 (real wave-25 code tree, no workflow change) was pushed and a CI run VERIFIED to dispatch on
    the exact headSha (check-suites total_count=1 — was 0 on the two prior blocked attempts). Run 28876707093
    concluded completed/success with all 5 required jobs green. The security proof is observed, not
    extrapolated: SEC-1-DB ran+passed against real Postgres (concurrent atomic UPSERT into rate_limit_hits →
    exactly one 429, proving migration 0019 applied in the CI DB), SEC-4-DB ran (0 skipped across the whole
    run), pnpm audit --audit-level=high exit 0, no secret leaked, migration additive-only. No green fabricated.
  next_action: PROCEED_TO_C-2
pushed_head_sha: 987ebb42e48df759ca7b6b1872b48c54be5dd7fe
ci_run_id: 28876707093
required_checks: [lint, typecheck, test, audit, build]   # all success
note: "Recurrence resolved — Actions dispatch restored after billing raise. Supersedes the ESCALATE block above. C-1 APPROVED → C-2."
```

## Next
→ C-2 deploy-and-verify (`process/waves/wave-25/stages/C-2-deploy-and-verify.md`) — real migration-bearing deploy.
