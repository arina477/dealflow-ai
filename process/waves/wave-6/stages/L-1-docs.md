# L-1 — Docs (wave 6 — deal-sourcing data spine)

**Stage:** L-1 (Learn block; runs concurrent with L-2)
**Head:** head-learn (owns L-block; issues stage verdict)
**Mode:** automatic (STATUS: RUNNING; no pause trigger fired)

---

## Action 1 — CHANGELOG entry

Added `## [0.6.0] — 2026-07-04` under `[Unreleased]` in `CHANGELOG.md` (lines 9–17): headline paragraph + 4 `Added` bullets, keep-a-changelog format, plain-language, terse (≤5 bullets). Matches the terse house style of 0.3.0–0.5.0.

Content: deal-sourcing data spine — pluggable data-source connectors + on-demand sync into staging; deterministic de-duplication promoting staged records to canonical companies/contacts; source provenance (company- AND contact-level) on every canonical record; a never-auto-merge review queue + the companies-and-contacts screen.

No `Fixed` / `Security` sections: the two C-2 defects (DI boot crash, fixture-asset dist gap) were caught pre-production in this same wave and never shipped to users, so they do not warrant a user-facing `Fixed`/`Security` entry (per L-1 Action 1: Security section is for shipped-then-patched vulnerabilities only). They are captured as L-2 observations instead.

## Action 2 — Milestone delta

Wave-6 claimed tasks all belong to milestone **M3** (`b372bbf7-09f3-4eb0-87df-28b5ec52bfc2`, "M3 — Deal sourcing & company/contact data", `in_progress`).

M3 task counts after L-2 done-marking:
- done_count = 4 (this bundle: ff378a95 seed + 0241222b, db274731, f5771d13 siblings)
- open_count = 3 (`todo`: AppShell placeholder pages; Auth hardening rate-limiting/CSRF; tighten wave-1 health-test fixture typing — all re-parented M1 follow-ups)
- total = 7

`open_count = 3 ≠ 0` → **NO milestone transition.** M3 stays `in_progress`.

**Record:** the deal-sourcing data spine (M3's first vertical-slice bundle — connection store + pluggable adapter → on-demand ingestion into raw_companies → deterministic dedupe into canonical companies/contacts with company- and contact-level provenance → companies-contacts view/clean screen) is shipped LIVE (deploy `918dbf0`). More M3 bundles remain → future waves: the sourcing-workspace search-and-trigger page, real provider adapters (fixture adapter shipped this wave), scheduled/cron sync, and contact enrichment.

Backlog-stockout threshold check: 3 open M3 tasks; brain-fallback threshold is `< 3` open tasks. 3 is NOT below 3 → no `backlog-stockout` flag raised for N-1 on M3 grounds.

No milestone DB write executed (mechanical progress, no transition).

## Action 2b — product-decisions append (SKIPPED — no new decision)

No new Tier-3 / scope decision resolved in the L-block this wave. The one real wave-6 decision — the databases.md schema reconcile (staging→canonical two-tier) + contact-level provenance PRESERVED — was already logged at P-4 remediation (`command-center/product/product-decisions.md` lines 218–220, dated 2026-07-03). Not duplicated here.

## Action 3 — README touchup

`README.md` § Live deployment: added a "Deal sourcing is live." note in the same voice/style as the existing auth / audit-log / compliance-gate live-feature notes. Points analysts at `/sourcing/companies`; describes connectors → staging → deterministic dedupe → canonical universe with provenance → never-auto-merge review queue. Surgical; detail stays in CHANGELOG.

## Action 4 — Commit

FS docs (CHANGELOG.md + README.md + this deliverable + L-2 artifacts) committed in the wave-6 L-block closeout commit and pushed to `main`. SHA recorded in the footer below post-commit.

---

## Deliverable footer

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:9-17 (0.6.0 entry)"
  - "milestones M3 b372bbf7: NO transition (open_count=3); stays in_progress"
  - "README.md: Live deployment section — deal-sourcing-live note added"
changelog_entry_added: true
roadmap_milestones_progressed: []          # M3 progressed in task-completion but did NOT transition status
roadmap_skip_reason: "M3 has 3 open child tasks (open_count=3 != 0); first M3 bundle shipped, more bundles remain; no status transition"
readme_sections_touched: ["Live deployment"]
note: "M3 stays in_progress; deal-sourcing data spine (first M3 bundle) shipped LIVE @ 918dbf0. Remaining M3 bundles: sourcing-workspace page, real provider adapters, scheduled sync, contact enrichment. product-decisions NOT appended (databases.md reconcile + contact-provenance already logged at P-4)."
```
