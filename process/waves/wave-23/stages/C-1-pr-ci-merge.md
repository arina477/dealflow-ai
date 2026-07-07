# C-1 — PR, CI & merge (wave-23 seller-intent)

## Summary

Direct-push-to-main model (PAT lacks PR:write; CI fires on `push: branches:[main]`).
Squash-merged `wave-23-seller-intent` (B-6 APPROVED code tree @854bad5; the `[skip ci]`
B-6-close tip 445b3cb differs from 854bad5 by process-docs ONLY — apps/ tree identical)
into main as a **CI-triggering commit** (message NOT `[skip ci]`), carrying the real
seller-intent code tree (deterministic scorer + workspace-scoped service + repository +
controller + module + /seller-intent API + /insights UI + shared-Zod contracts + the two
KEY test files). Pushed to origin/main: `1e78421..a1bc858`.

**NO migration this wave** — verified: `git diff --name-only main wave-23-seller-intent --
apps/api/src/db/migrations/` returns 0 files. Additive-only Drizzle static-analysis check
passes vacuously (nothing destructive because nothing schema-changed). App already runs as
non-superuser `dealflow_app`; DATABASE_URL unchanged.

## Ghost-Green guard (CI #2) — the decisive verification

Pushed a real code tree on a non-`[skip ci]` tip, then verified whether a workflow run
actually FIRED on the exact pushed headSha (webhook-independent commits API), NOT merely
that the push landed. **It did not fire.**

- Pushed headSha: `a1bc85819fa71815002296c7dc837179e01fc806` (origin/main tip, confirmed).
- GitHub confirms receipt: repo `pushed_at: 2026-07-07T09:27:52Z` matches the push.
- `GET /repos/arina477/dealflow-ai/commits/a1bc858/check-suites` → **`total_count: 0`**
  (re-queried across ~90s + a final poll; stayed 0).
- `GET .../commits/a1bc858/check-runs` → **`0`**.
- `gh run list` newest run repo-wide remains `28850000460 @c168d3a` (07:42Z, the wave-22
  green tip) — **nothing has fired since the wave-23 push**.
- Workflow `CI` id=306022757 is `state: active`; `ci.yml` present on tip; actor `arina477`
  identical to the last-firing run — so this is NOT a `[skip ci]` / disabled-workflow /
  actor / workflow-file issue. Check-suites are simply not being CREATED on push.

**Diagnosis:** identical signature to the wave-22 C-1 GitHub-Actions-minutes / spending-limit
hard-stop (founder-cleared earlier today, now recurred). Actions accepts pushes but dispatches
zero runs. `GET /repos/.../actions/permissions` returns **HTTP 403** for this PAT — the brain
cannot confirm or clear the billing/spending state; that is an account-owner (money) action.

## The 5 required jobs (would-be checks; UNRUN)

`ci.yml` defines: **lint, typecheck, test (postgres:18), audit (`pnpm audit --audit-level=high`),
build**. The KEY deliverable-verification suites — the `seller-intent-isolation.e2e-spec`
(cross-firm scoping via the REAL SellerIntentService as dealflow_app, SIT-3 fault-killing) and
the `seller-intent.scorer.spec` (26 tests: determinism + epsilon + empty-data + no-tieBreak +
no-Date.now) — run inside the `test` job. Both files are present in the pushed tree
(`apps/api/test/seller-intent-isolation.e2e-spec.ts`,
`apps/api/src/modules/seller-intent/seller-intent.scorer.spec.ts`), but **CI never executed**,
so their green is UNOBTAINABLE. Iron Law forbids fabricating or extrapolating one.

## Iron Law disposition

This is NOT a code defect → NO B-stage route. It is an infra-readiness hard-stop (money /
account-owner decision). head-ci-cd verdict: **FAIL / ESCALATE**. C-1/C-2 checklist rows left
unchecked; C-2 NOT entered. origin/main tip is `a1bc858` (code physically on main but
UNVERIFIED by CI — tip presence is NOT a green).

```yaml
ci_stage_verdict: FAIL
verdict_source: gh
verdict_evidence:
  - "gh api repos/arina477/dealflow-ai/commits/a1bc858/check-suites -> total_count: 0"
  - "gh api .../commits/a1bc858/check-runs -> 0"
  - "gh run list newest run repo-wide still 28850000460 @c168d3a (07:42Z, wave-22 tip) — nothing fired since wave-23 push"
  - "repo pushed_at 2026-07-07T09:27:52Z confirms push receipt; 0 suites created"
  - "workflow CI id=306022757 state=active; ci.yml on tip; actor arina477 (same as last-firing run)"
  - "gh api repos/.../actions/permissions -> HTTP 403 (PAT cannot confirm/clear billing)"
pr_number: null                   # direct-push-to-main model (PAT lacks PR:write)
pr_url: null
branch: wave-23-seller-intent
pushed_head_sha: a1bc85819fa71815002296c7dc837179e01fc806
required_checks: [lint, typecheck, test, audit, build]   # DEFINED in ci.yml; UNRUN (0 suites dispatched)
optional_checks: []
fix_up_cycles: 0
final_commit_sha: null            # no CI-green commit — CI never ran
merge_strategy: squash            # squash-merged wave-23 branch into main
merge_commit_sha: a1bc85819fa71815002296c7dc837179e01fc806
rebase_cycles: 0
migration_this_wave: false        # verified 0 migration files in main..wave-23 delta
note: "GitHub Actions dispatched ZERO runs on the pushed tip a1bc858 (0 check-suites / 0 check-runs, webhook-independent API, ~90s+ waited). Signature of exhausted Actions minutes / spending-limit — recurrence of the wave-22 C-1 hard-stop. PAT gets 403 on actions/permissions so the brain cannot confirm/clear it: account-owner GitHub billing action required (money decision -> founder). NO fabricated/extrapolated green (Iron Law). BLOCKED terminal until founder clears the Actions block; on resume, C-1 re-fires a CI-triggering push (or the already-pushed a1bc858 will dispatch once minutes are restored) and watches the 5 jobs — esp. the test job's seller-intent-isolation e2e + scorer.spec — to green on the exact headSha, THEN proceeds to C-2."
```

## head_signoff

```yaml
head_signoff:
  verdict: ESCALATE
  stage: C-1
  reviewers: {}
  failed_checks:
    - "[STABLE] CI run's tested commit SHA matches PR/main HEAD — UNVERIFIABLE: 0 runs dispatched on a1bc858."
    - "pnpm audit --audit-level=high exit 0 — UNRUN (audit job never dispatched)."
    - "seller-intent-isolation.e2e-spec RAN + GREEN — UNRUN (CI never executed)."
    - "seller-intent.scorer.spec (26 tests) RAN + GREEN — UNRUN (CI never executed)."
  rationale: >
    GitHub Actions accepted the push to main (tip a1bc858) but created ZERO check-suites /
    check-runs (webhook-independent commits API, confirmed across ~90s + final poll; newest
    run repo-wide is still the wave-22 07:42 tip). The workflow is active, ci.yml is present,
    and the actor is unchanged, so this is not a config/[skip ci]/actor issue — it is the
    recurrence of the wave-22 GitHub-Actions-minutes / spending-limit withholding. The wave's
    KEY deliverable-verification (seller-intent isolation e2e + scorer.spec green in CI) is
    UNOBTAINABLE; no green may be fabricated or extrapolated per the Iron Law. The PAT gets
    HTTP 403 on actions/permissions, so the brain cannot confirm or clear the billing state —
    it is an account-owner money decision that only the founder can take.
  next_action: ESCALATE_TO_founder
```
