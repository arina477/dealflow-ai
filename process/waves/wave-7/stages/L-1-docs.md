# L-1 — Docs (wave-7)

Sourcing-workspace page (`/sourcing`, M3 search entry) shipped + live-verified at `e4debc6`.

## CHANGELOG

CHANGELOG entry ALREADY authored: `[0.7.0] — 2026-07-04 — Sourcing workspace (M3 search entry)`
(top of `CHANGELOG.md`). Sections: **Added** (sourcing workspace + connection management/migration 0005),
**Fixed** (web SSR/client render hardening — read-schema PG-wire timestamps, `companySchema`
`connectionIds`/`sourceCount`, detail SSR-hydrate + no page-route collision), **Deferred** (first real
provider adapter, in-page dedupe modal, advanced facets). Matches keep-a-changelog house style;
release-note length (headline + bullets), not a file-by-file inventory. No further CHANGELOG edit needed.

## Milestone delta

Wave-7 claimed tasks are under M3 (deal-sourcing search). The CHANGELOG claims 0.7.0 "Completes M3's
success metric — search across ≥2 connected sources." Whether M3 transitions to `status='done'` is a
judgment call (structurally complete vs "really done") — under `automatic` mode this routes to BOARD
(decision-slug `L-1-roadmap-delta-wave-7`), NOT a head-learn solo decision. Flagged here for the
orchestrator's mode-routed disposition; head-learn does not unilaterally close the milestone.
Mechanical child-task terminal-status check + any transition are the orchestrator's Action-2 work.

## README

Skip — no new CLI command, env var, install step, or breaking change. The user-facing surface is a new
in-app page fully covered by the CHANGELOG 0.7.0 entry. No README touchup required.

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:3-13 ([0.7.0] Sourcing workspace — pre-authored)"
changelog_entry_added: true
roadmap_milestones_progressed: []      # M3 disposition flagged for mode-routed BOARD judgment (automatic)
roadmap_skip_reason: "M3 done-vs-partial is a judgment call; routes to BOARD under automatic mode, not head-learn"
readme_sections_touched: []
note: "CHANGELOG 0.7.0 pre-authored. README skip (no CLI/env/install/breaking change). Milestone M3 completion flagged for orchestrator BOARD routing."
```
