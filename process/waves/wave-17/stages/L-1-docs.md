# L-1 — Docs (wave 17)

**Wave:** 17 — M8 pilot-partner workspace data-isolation. Shipped LIVE @591b3f8; V-block APPROVED (Karen + jenny).
**Mode:** automatic.

## Action 1 — CHANGELOG entry

Prepended `## [0.17.0] — 2026-07-06 — Pilot-partner workspace data-isolation (M8)` above [0.16.0].

- **Range:** `CHANGELOG.md:3-18` (headline + 3 sections: ### Added / ### Correctness / compliance / ### Provenance (transparency)).
- **House style match:** headline paragraph + ≤5 bullets/section; declarative present-tense; PM-readable (rule 16); no stack/stage jargon in body.
- **Lead:** the confidentiality guarantee — a firm can only ever see its own data, enforced at the DB (deny-by-default row-level security), not app-layer; proven by the negative-read test.
- **Credited:** fail-closed non-superuser enforcement (refuses to start under an over-privileged account); audit trail intact (328 entries tagged, hash-chain still verifies live).
- **Honest scope:** pilot firm = one workspace today; full multi-tenant SaaS is a later milestone; 3 follow-up hardening items tracked, non-blocking.

## Action 2 — Milestone delta

**M8** (`9ed98c3c-8cb8-4736-8337-22dc0dae48d4`) — verified via DB, `status='in_progress'`.

Child-task counts (live query):

```
done_count | open_count
     4     |     4
```

**Decision: M8 STAYS `in_progress` — NO transition, NO DB write.** `open_count = 4 > 0`, so the `open_count = 0 → done` condition does not fire. Unambiguous mechanical progress → no BOARD/mode escalation (automatic mode).

**Delta this wave:** 4 tasks moved to `done` (the M8 FIRST vertical — 0db154ff scoping column, e45ba68c deny-by-default RLS, 96026365 request-scoped workspace propagation, df2f3b2f cross-tenant negative-read proof).

**Open children (4 — honest enumeration; the prompt anticipated 3):**

| id | status | item |
|---|---|---|
| 2867d087 | todo | GAP-2 — make data-source/settings write-path workspace assignment fail-closed (H3 hardening) |
| fd8f2860 | todo | GAP-4 — standing AC: populated-DB migration proof for any WORM/audit-table migration |
| 1a1c5855 | todo | GAP-5 — document + AC the RLS connection-split (runtime dealflow_app / migrate owner) |
| 52224877 | **blocked** | TRIAGE: postgres — migration 0014 backfill blocked by audit WORM trigger |

- The 3 `todo` rows are the V-2-INSERTed hardening follow-ups (all H3-forward, non-blocking) — matches the prompt.
- **Discrepancy flagged for L-2:** a 4th open row (52224877, `blocked`) is a TRIAGE task for the migration-0014 WORM-trigger defect. That defect was **already resolved this wave** via fix-forward (commits 58c1498 / 591b3f8 — audit_log backfill wrapped in trigger-disable; C-2 verified journal 0013→0017 applied on populated prod, verifyChain ok:true after 328-row backfill). This `blocked` TRIAGE row is therefore **stale — it should be reconciled to `done`/`cancelled` by L-2** (L-2 owns the `tasks` status pass + observation). L-1 does not mutate task status. Recorded here as an observation for L-2.

**Backlog-stockout flag:** NOT raised. Threshold is < 3 remaining open tasks/milestone (PRODUCT-PRINCIPLES fallback); M8 has 4 open (or 3 if 52224877 reconciles) — at/above threshold either way. N-1 need not treat M8 as stocked out.

**Success-metric judgment (honest):** M8 `## Success metric` — "isolated workspace, no cross-firm visibility" — is **MET for the pilot**: deny-by-default RLS is live + verified as the non-superuser `dealflow_app` role, and the adversarial negative-read proof (df2f3b2f) confirms firm A cannot read firm B's rows. The QUANTITATIVE target remains `_TBD by founder_` (carried from wave-16 close, digest-2026-07-06-M7-disposition). Core isolation is SHIPPED + live-verified; the 3 open gaps are hardening/H3-forward, not core-metric blockers. No Hallucinated-Milestone-Completion: M8 is honestly NOT closed.

## Action 3 — README touchups

**SKIPPED.** No user-facing change: isolation is transparent (no new screens, no new setup step). The `DATABASE_URL` / `MIGRATE_DATABASE_URL` split (runtime dealflow_app vs migrate owner) is a deploy/ops detail, not user-facing, and is already tracked as its own AC by GAP-5 (task 1a1c5855). No new user-facing env var. README's only env reference is the generic `cp .env.example .env`, unchanged.

## Action 4 — Commit

`docs: L-1 wave-17 closeout (changelog)` — direct push to main (project allows direct doc commits). SHA recorded in footer below.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:3-18"
  - "milestones row: 9ed98c3c-8cb8-4736-8337-22dc0dae48d4 — NO UPDATE (open_count=4>0, stays in_progress)"
  - "commit SHA: <filled post-commit>"
changelog_entry_added: true
roadmap_milestones_progressed:
  - milestone: "M8 (9ed98c3c-8cb8-4736-8337-22dc0dae48d4)"
    before: in_progress
    after: in_progress          # 4 tasks done this wave; 4 still open → no closure
roadmap_skip_reason: ""
readme_sections_touched: []
note: >
  M8 core isolation SHIPPED + live-verified (deny-by-default RLS as non-superuser dealflow_app +
  negative-read proof). Qualitative success metric MET for the pilot; QUANTITATIVE target still
  founder-TBD. 4 open children: 3 todo H3-hardening follow-ups (GAP-2/4/5) + 1 STALE blocked
  TRIAGE (52224877, migration-0014 WORM defect already fixed-forward this wave @591b3f8) —
  flagged for L-2 to reconcile to done/cancelled during its tasks-status pass. Backlog-stockout
  NOT raised. README skipped (isolation transparent; connection-split is ops-only, tracked by GAP-5).
```
