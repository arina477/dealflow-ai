# C-1 — PR, CI & merge (wave-24)

**Block:** C (CI/CD) · **Stage:** C-1 · **Mode:** automatic · **Gate:** head-ci-cd
**Wave:** 24 — M10 compliance-hardening: standing populated-DB migration-proof AC for WORM/audit-table migrations (seed fd8f2860). TOOLING/TEST/DOCS wave.

## Operating model — direct-push-to-main (no PR)

The project PAT (`arina477`, `github_pat_…`) lacks `PR:write` AND `workflow` scope. The wave loop's PR-based C-1 flow is therefore executed as **direct-push-to-main**; CI fires on `push: branches:[main]`. This matches wave-22 / wave-23 precedent.

**Workflow-scope push guard (pre-push):** `git diff --name-only origin/main..HEAD -- .github/workflows/` returned EMPTY → no workflow change in the pushed delta → push accepted by the workflow-scope restriction. (B-6 commit 1d61949 had already reverted the branch's earlier `ci.yml` step; enforcement rides the vitest real-tree `runCheck` in the existing `test` job, not a bespoke CI step.)

## Ghost-Green guard (CI #2) — a CI-triggering tip carrying the real code tree

- B-6 APPROVED HEAD was `1d61949` — but it is a `[skip ci]` tip. Pushing it would NOT fire CI (Ghost-Green risk).
- Action taken: fast-forwarded local `main` (`07f36ac`) → `1d61949` (clean FF, verified `git merge-base --is-ancestor origin/main HEAD` = ancestor; 22f96d4 wave-23 doc commit already in main lineage; zero commits lost), then added ONE CI-triggering, non-`[skip ci]` commit **`03a710b`** whose **tree = the full wave-24 code tree @1d61949** (NOT a `[skip ci]` tip, NOT an empty tree — the tree carries the real code: WORM-check script, test helpers, AMP/WORM specs, policy doc, package.json script entry).
- Uncommitted working-tree drift on `apps/api/scripts/check-worm-migration-tests.ts` (a Prettier line-reflow, proven whitespace-only via `tr -d '[:space:]'` diff = IDENTICAL) was **discarded** (`git checkout --`) — it was NOT part of the B-6-approved tree; folding unreviewed drift into the CI-triggering tip is not permitted.

## Push

```
git push origin main
07f36ac..03a710b  main -> main        # exit 0
origin/main == 03a710b2c896c8bee503efc3a4aac7158732788f (confirmed via fetch)
```

## Ghost-Green guard verification — a run FIRED on the exact pushed headSha

```
gh run list --json databaseId,headSha,status,event,workflowName  (filtered to headSha 03a710b)
→ { databaseId: 28863313439, headSha: 03a710b2…, event: push, workflowName: CI, status: in_progress }
gh api …/commits/03a710b…/check-suites  →  total_count: 1   (NOT 0 — Actions did NOT withhold; the twice-earlier Actions-minutes hard-stop did NOT recur)
```

## Queryable CI conclusion (authoritative — cited, not extrapolated)

`gh run view 28863313439 --json status,conclusion,headSha,event`:
```
{ conclusion: "success", status: "completed", headSha: 03a710b2…, event: "push", workflowName: "CI" }
```

**All 5 required jobs `conclusion: success`** (per-job query `gh run view --json jobs`):

| Job | Conclusion |
|---|---|
| lint | success |
| typecheck | success |
| test | success |
| audit (`pnpm audit --audit-level=high`) | success |
| build | success |

## THE KEY CHECK — standing-AC enforcement RAN + GREEN in the test job

Pulled the `test` job log (job id 85607071512) from run 28863313439 and grepped:

- **`✓ test/check-worm-migration-tests.spec.ts (61 tests) 124ms`** — the 61-test standing-AC enforcer (incl. the real-tree integration test running `runCheck` against the actual migrations + the future-WORM-table guard) **RAN (not skipped) and PASSED**. This is the mechanical enforcement point: a future WORM migration lacking populated-DB coverage → this vitest reds → CI reds.
- **`✓ test/audit-migration-populated-db.e2e-spec.ts (3 tests) 1215ms`** — the AMP populated-DB suite RAN + PASSED.
- Vitest summary groups all green with matched counts (e.g. `1011 passed (1011)`, `509 passed (509)`, `837 passed (837)`) → **zero silent skips, zero failures**.

## Fix-forward

None. First CI fire green (0 fix-up cycles).

## Local main synced

`git rev-parse HEAD == origin/main == 03a710b` — local main synced to the pushed tip. (Direct-push model: the pushed commit IS the merged commit; no separate `gh pr merge` step.)

---
```yaml
ci_stage_verdict: PASS
verdict_source: gh
verdict_evidence:
  - "push: 07f36ac..03a710b main -> main (exit 0); origin/main == 03a710b2c896c8bee503efc3a4aac7158732788f"
  - "Ghost-Green guard: run 28863313439 FIRED on exact headSha 03a710b (event=push, workflowName=CI); check-suites total_count=1 (Actions not withheld)"
  - "gh run view 28863313439: conclusion=success, status=completed @headSha 03a710b"
  - "all 5 jobs success: lint, typecheck, test, audit(pnpm audit --audit-level=high), build"
  - "KEY CHECK: test job log — check-worm-migration-tests.spec.ts (61 tests) RAN + PASSED [standing-AC enforcement]; audit-migration-populated-db.e2e-spec.ts (3 tests) PASSED; vitest zero-skip/zero-fail"
pr_number: null                      # direct-push-to-main (PAT lacks PR:write + workflow scope)
pr_url: null
branch: wave-24-populated-migration-ac
merge_model: direct-push-to-main
required_checks: [lint, typecheck, test, audit, build]
optional_checks: []
fix_up_cycles: 0
final_commit_sha: 03a710b2c896c8bee503efc3a4aac7158732788f
merge_strategy: direct-push (FF main→1d61949 + CI-triggering tip 03a710b)
merge_commit_sha: 03a710b2c896c8bee503efc3a4aac7158732788f
ci_run_id: 28863313439
rebase_cycles: 0
note: "Ghost-Green guard (CI #2) satisfied — real code tree pushed on a non-[skip ci] tip; run verified FIRED on the exact headSha before watching the queryable conclusion. Standing-AC WORM-migration guard (61 tests) mechanically enforced live in CI. No fabricated green — verdict cited from queryable gh conclusion + exact headSha + test-job log."

head_signoff:
  verdict: APPROVED
  stage: C-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Every C-1 stage-exit checkbox ticks from concrete artifacts. Commit-SHA provenance verified — the tested SHA (03a710b) is the exact pushed HEAD, and a workflow run demonstrably FIRED on it (check-suites total_count=1), defeating the Ghost-Green / Actions-withhold failure mode that hit twice earlier today. The pnpm-audit high-severity gate ran and passed. No workflow-file change in the pushed delta (PAT workflow-scope respected). No Drizzle migration in this wave (tooling/test/docs only) — destructive-migration check N/A-and-clean. Uncommitted formatting drift was discarded rather than folded into the reviewed tree. The standing-AC enforcement mechanism (check-worm-migration-tests.spec, 61 tests) is proven RAN + GREEN in the CI test job, not skipped. Verdict is cited from the queryable gh conclusion + the exact headSha + the test-job log — no stale-cache extrapolation.
  next_action: PROCEED_TO_C-2
```
