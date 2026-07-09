# L-1 — Docs (wave-38)

> Block: L (Learn) — L-1 ∥ L-2. Wave-38 topic: prod migrations not auto-applying on
> deploy (drizzle journal timestamp drift + broken migrate-on-boot). Mode: automatic.
> V-block exited APPROVED (Karen APPROVE + jenny APPROVE + head-verifier APPROVED).

## Action 0 — head-learn

head-learn owns this L-block (spawned at L-block entry, this instance). Gating L-1
against the § Stage-Exit Checklist (L-1 Docs exit). No orchestrator-mask substitution.

## Action 1 — CHANGELOG entry

- **File / lines:** `CHANGELOG.md:3-13` — new section `## [0.28.1]`.
- **Version bump:** 0.28.0 → **0.28.1** (patch). House style = keep-a-changelog; this is
  a pure infra/correctness fix with no new user-facing feature, so a patch bump is correct
  (a feature would warrant a minor bump per the 0.2x history).
- **Section:** **Fixed** — a defect that shipped in prior waves (migrations 0019/0020/0021
  silently skipped; the wave-37 self-serve-firm function + the rate-limit table never
  reached the live DB) is patched in this wave. Correct per L-1 Action 1's "V-3 `bug-*`
  finding / prior-shipped defect → Fixed" routing.
- **Content:** headline paragraph + 3 bullets (within the ≤5-bullet cap). Operator-facing,
  present-tense, plain language; no file paths / commit SHAs / drizzle internals in the
  founder-facing copy (those live in the commit + C-2 reconciliation). Authored as
  Claudomat.
- **Root-cause honesty (L-1 checklist):** the entry names the systemic cause — a stale
  ordering in the migration journal that let the deploy step report success while applying
  nothing ("Ghost Green") — not an individual's mistake. The second broken mechanism
  (migrate-on-boot pointed at an empty dir, fail-loud-aborting deploys) is captured in the
  third bullet as a durable-path consolidation. Both map to concrete corrective controls
  (corrected ascending timestamps; single reliable preDeploy path), satisfying the
  "every symptom paired with a corrective control" gate. Deeper systemic observation +
  any principle candidate are L-2's concern (observations.md / karen vet).

## Action 2 — Milestone delta

Claimed task `7f4d150b-409f-4936-a09f-12fe46d5b90c` → milestone **M7 (Admin & settings,
id 08d3053a-48fb-4562-a25b-6d99d40b0f62)**, already marked `done` by L-2's task-status pass.

- **M7 child status:** 14 `done` / 3 open (`open_count = 3`).
- **Transition decision:** `open_count ≠ 0` → **M7 does NOT transition; stays `in_progress`.**
  No `UPDATE milestones`. The 3 open siblings are deferred M7 scope: admin transfer/demote,
  full member CRUD, onboarding polish.
- **Escalation:** none. This is mechanical (milestone plainly incomplete — no judgment call),
  so no BOARD `L-1-roadmap-delta-wave-38` decision is convened under `automatic`.
- **Soft signal for N-1:** M7's open queue is at the brain-level backlog threshold
  (`< 3 remaining open` per PRODUCT-PRINCIPLES § Roadmap fallback). 3 open == the boundary,
  not below it → **NOT yet `backlog-stockout`**, but flagged here so N-1 Action 7 evaluates
  whether M7 needs a fresh bundle decomposed (or the 3 deferred siblings promoted) before
  the queue actually empties next wave.

## Action 3 — README touchups

**SKIP.** Nothing user-facing changed — this is an infra/deploy-reliability fix with no new
CLI command, flag, env var, install step, or breaking change. `README.md` is project-meta
(deploy overview + file map) and carries no per-feature version list or migration runbook
that this fix alters. Skip recorded per Action 3 skip condition.

## Action 4 — Commit

Batched FS commit to `main` (project allows direct doc commits): `docs: L-1 wave-38 closeout (changelog)`.
Commit SHA recorded in the footer `verdict_evidence`.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:3-13"                     # [0.28.1] Fixed — migrations apply reliably on deploy
  - "milestones: NO UPDATE (M7 08d3053a stays in_progress; 14 done / 3 open)"
  - "README.md: SKIP (nothing user-facing changed)"
  - "commit: fd18654"                # docs: L-1 wave-38 closeout (changelog)
changelog_entry_added: true
version_bump: "0.28.0 -> 0.28.1 (patch; infra/correctness fix)"
roadmap_milestones_progressed: []          # M7 did not transition
roadmap_skip_reason: "M7 open_count=3 (>0) — milestone not complete; no transition"
readme_sections_touched: []
backlog_soft_signal: "M7 at backlog threshold (3 open == boundary, not < 3). Not stockout yet; flag for N-1 Action 7."
note: "Root cause named as systemic (journal-ordering Ghost Green + broken migrate-on-boot), not human error; both paired with corrective controls. Deeper observation + principle candidate belong to L-2."
```
