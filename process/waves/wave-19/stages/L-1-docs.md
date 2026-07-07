# L-1 Docs — wave 19 (M9 match-score calibration)

**Wave:** 19 · **Milestone:** M9 — Integrations & insight (099cee10-562d-4e56-9a57-0dade2914760)
**Shipped:** match-score calibration on /insights — LIVE @3cc58de · V-block APPROVED (Karen + jenny)
**Mode:** automatic

---

## 1. CHANGELOG

Prepended `## [0.19.0] — 2026-07-07 — Match-score calibration (M9)` above `[0.18.0]` in `/home/claudomat/project/CHANGELOG.md`.

- **House style match:** three sections — `### Added` / `### Correctness / compliance` / `### Provenance (transparency)` — headline-lead bold openers, declarative present tense, PM-readable (rule 16). Within the ≤5-bullets/section budget.
- **Lead:** advisor value — see whether the AI match score actually predicts your accept/reject decisions (accept-rate by score band + which factors track acceptance).
- **Honest-metric discipline credited:** the by-design random tie-breaker factor was dropped from the "which factors predict acceptance" view (uncorrelated → showing it invites reading signal into noise); small samples show "(n=X)" and are muted rather than a confident "100%" on one data point; empty band reads "n/a", never a fake "0%".
- **Per-firm isolation credited:** every calibration number is workspace-scoped on the M8/wave-17 RLS; cross-firm leak designed out + proven by a fault-killing test.
- **Honest scope:** read-only over existing match data (writes nothing, audit trail untouched, no schema/env/AI/scorer-retrain); scorer retraining on this feedback + the quantitative success target still to come, founder-dependent.

**Changelog provenance range:** `5a94273..bc406a1` (wave-19 P→C+T deliverables). Feature landed in `63d055d` (match-feedback vertical) + `3cc58de` (e2e UUID-fixture fix); deployed state @3cc58de.

## 2. Milestone delta — M9

| field | value |
|---|---|
| milestone | 099cee10-562d-4e56-9a57-0dade2914760 — M9 — Integrations & insight |
| status before | in_progress |
| status after | **in_progress** (UNCHANGED — NOT closed) |
| tasks done this wave | 4 (5568ad44 aggregation service · 69387b56 shared-Zod contracts · e206a56a RBAC API · 077974a2 dashboard section) — all `done` in DB |
| children total | 9 (7 done · 2 open) |
| open_count | **2** |

**Open M9 children (both `todo`):**
1. `345dfbc6` — Implement first real DataSourceAdapter against a selected deal-source — **FOUNDER-GATED** (deal-source vendor selection = spend hard-stop + account-issued API key; rule-6 exception). Not buildable without a founder decision.
2. `1d95cac0` — Spec-authoring + test-fixture process hardening (analytics-wave lesson) — buildable, credential-free.

**Disposition rationale:** open_count=2 > 0 → M9 STAYS in_progress. The analytics + calibration halves shipped; substantial M9 scope remains (founder-gated CRM/real adapters + unauthored multi-channel outreach + seller-intent threads). Closure not eligible.

**Milestone prose:** NOT edited. The `## Success metric` remains `_TBD_` — see flag below (a founder poll, not an L-1 write).

## 3. Flags for N-block / founder digest

- **[_TBD success-metric poll]** — M9's quantitative success metric is still unset. Both ceo-reviewer and jenny flagged that it should be **founder-polled before M9 closes**. Surfaced here to N-block/digest as a pending founder decision (product/taste per rule 17 — not auto-defaulted). Non-blocking for the loop.
- **[backlog-thin]** — open_count=2 (< 3) for M9, and only **1 of the 2 is buildable non-gated** (`1d95cac0`); `345dfbc6` is founder-gated. N-1 should treat M9 as backlog-thin and expect to fire milestone-decomposition (or surface the founder gate) to keep a buildable seed available.
- **[founder-gated pile-up, carried]** — unchanged from wave-18: deal-source vendor+API-key (M9 345dfbc6), email/DKIM #141 (M6/M7), LLM-spend (M5). All await founder decisions; loop continues on buildable work.

## 4. README

**SKIPPED.** No quick-start, env, setup-step, or new-command change — wave shipped a read-only /insights section over existing data. Per L-block skip rule (README sub-action skips when nothing user-facing changed in the README sense).

## 5. Commit

`docs: L-1 wave-19 closeout (changelog)` — FS docs (CHANGELOG.md + this deliverable) direct-push to main. SHA recorded in footer below.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md: [0.19.0] entry prepended above [0.18.0]; provenance range 5a94273..bc406a1 (feature @63d055d/@3cc58de)"
  - "milestone M9 099cee10: in_progress → in_progress (unchanged); 4 tasks done this wave; 9 children total (7 done, 2 open)"
  - "open M9 children: 345dfbc6 (FOUNDER-GATED real DataSourceAdapter) + 1d95cac0 (process-hardening, buildable)"
  - "README: skipped (no user-facing/env/quick-start change)"
  - "commit SHA: <recorded post-commit>"
head_signoff:
  verdict: APPROVED
  stage: L-1-docs
  reviewers: {}
  failed_checks: []
  rationale: >
    Every shipped surface traces to a changelog bullet in house style; the honest-metric
    discipline (dropped noise factor, small-sample caveats, n/a-not-0%) and per-firm RLS
    isolation are credited without war-story or wave-ref leakage. Milestone delta rests on
    a direct Postgres query (M9 in_progress, 7 done / 2 open), not inference. Scope is
    honestly bounded — read-only, no scorer retrain, success-metric _TBD deferred to a
    founder poll (not silently defaulted). Backlog-thin + _TBD flags surfaced to N-block.
  next_action: PROCEED_TO_N
note: "L-1 ∥ L-2; L-2 owns tasks done-marking + observations + ≤1 promotion. N-1 gated on both L-stages."
```
