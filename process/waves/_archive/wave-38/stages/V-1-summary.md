# Wave 38 — V-1 summary (orchestrator)

Karen (source-claim) and jenny (semantic-spec) ran in parallel, no shared context. Both APPROVE.

## Karen — APPROVE
All 5 load-bearing claims independently verified TRUE against repo tree + deployed prod (not trusted
from the reconciliation doc):
1. Journal timestamps strictly ascending (0018<0019<0020<0021).
2. `runMigrationsOnBoot` removed from `apps/api/src/` (only in wave-38 docs); `git show e79f944` = 73 lines removed.
3. Deploy `bd65486e` SUCCESS, commitHash `e79f944` = HEAD of main; prior `865f628e` FAILED as claimed; health 200 `db:ok`.
4. **Mechanism proven cryptographically** — each migration file's SHA256 matches the drizzle-recorded
   hash in `__drizzle_migrations` (22 rows) at the corrected journal timestamps (0018→id19 … 0021→id22).
   Clears the "claimed-applied-but-actually-manual" antipattern: drizzle-kit applied the real SQL via preDeploy.
5. Migration SQL files exist (0019 rate_limit_hits; 0021 create_firm_workspace SECURITY DEFINER, search_path='').

## jenny — APPROVE
All 5 acceptance criteria satisfied against deployed prod. Core semantic check (durability): preDeploy
command is `drizzle-kit migrate` against `src/db/migrations` (not the empty `dist/` that broke the
original attempt); 22 journal entries = 22 recorded migrations at ascending timestamps → the next
migration (0022+) applies automatically. Not just the two known-missing objects patched.

## Findings (raw → V-2 classifies)
- **F1 (non-blocking hygiene, flagged by BOTH):** `/health` `version` field reports stale SHA
  `a6ad02cb` (wave-30) ≠ deployed `e79f944`. Railway deploy commitHash is authoritative and confirms
  the correct artifact serves — this is a stale build-time version string, NOT a wrong-artifact deploy.
  Recommend wiring `version` to the real build SHA so it can't later be misread as a rollback.
- **F2 (spec gap, non-blocking, jenny):** spec wording implied a `main.ts` migrate-on-boot /
  `MIGRATE_DATABASE_URL`-on-boot mechanism; delivered fix uses preDeploy (strictly better: owner-role,
  once-per-deploy, before traffic). Spec wording stale, not a missing deliverable.

```yaml
karen_verdict: APPROVE
karen_findings_count: 1
karen_false_positives_documented: 0
jenny_verdict: APPROVE
jenny_findings_count: 2
spec_drift_count: 0
spec_gap_count: 1
jenny_false_positives_documented: 0
findings:
  - id: F1
    kind: hygiene-non-blocking
    desc: /health version field reports stale SHA (a6ad02cb) vs deployed e79f944; not a wrong-artifact deploy
  - id: F2
    kind: spec-gap-non-blocking
    desc: spec framed migrate-on-boot; delivered preDeploy (strictly better)
```
