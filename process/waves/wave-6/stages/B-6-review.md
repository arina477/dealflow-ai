# Wave 6 — B-6 Review (Build block-exit gate)
## Phase 1 — head-builder: attempt-1 REWORK (candidate-path not idempotent — promoteStaging re-inserted dedupe_candidates every re-sync); FIXED (b3a12d8: partial-unique WHERE status='pending' + promoteStaging exclusion + onConflictDoNothing + test g red→green). attempt-2 APPROVED. + commit-discipline mapping recorded.
## Phase 2 — /review: 4 CRITICAL dedupe-correctness bugs found + FIXED (dbee1d0):
1. false-positive merge ('co' strip → distinct companies auto-merged) → name-only never auto-merges (domain agreement only).
2. lost contact-provenance on human-merge → mergeRawIntoCanonical delegates to mergeInto (shared impl).
3. non-atomic resolve double-apply → FOR UPDATE + conditional UPDATE (ConflictException single-winner).
4. missed-review (name+domain-conflict → silent new canonical) → explicit review-queue candidate.
+ INFO normalize/re-read fixes. All regression-tested.
## Commit-discipline: PASS (mapping in review-artifacts; all 4 task_ids covered).
## Final verdict: APPROVE. Fix cycles: b3a12d8 (idempotency), dbee1d0 (4 dedupe CRIT).
```yaml
phase1_head_builder_verdict: APPROVED  # attempt-2 (attempt-1 REWORK resolved)
phase2_review_invocations: 1
findings_critical: []  # 1 REWORK + 4 /review, all fixed + regression-tested
fix_up_commits: [b3a12d8, dbee1d0]
final_verdict: APPROVE
