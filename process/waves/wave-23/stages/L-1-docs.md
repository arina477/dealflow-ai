# L-1 — Docs (wave 23 · M9 seller-intent scoring)

**Block:** L (Learn) · **Stage:** L-1 (∥ L-2) · **Gate owner:** head-learn · **Mode:** automatic
**Shipped:** LIVE @6c22919 (both services deployed, C-2 PASS, V-block APPROVED — Karen + jenny)

---

## Action 1 — CHANGELOG entry

**Added:** `## [0.21.0] — 2026-07-07 — Seller-intent scoring (M9)` prepended ABOVE `[0.20.0]`.
**Location:** `CHANGELOG.md` lines 3–18.
**Sections (house style — matches 0.18/0.19/0.20 insights waves):** `### Added` (3 bullets) · `### Correctness / compliance` (2 bullets) · `### Provenance (transparency)` (2 bullets). Headline-first, declarative present-tense, PM-readable (rule 16).

Credited, honestly:
- **Advisor value (lead):** per-mandate 0–100 seller-intent score + a heating / cooling / flat direction, sorted hottest-first, so the deals worth a call today rise to the top; 3-signal breakdown (outreach engagement · pipeline velocity · match disposition) explains each score.
- **Deterministic, NO-AI, auditable:** fixed published formula over existing internal signals; identical inputs → identical output; no LLM, no black-box, no clock-dependence → reproducible + auditable (the right call for a compliance-first M&A product). AI-based intent inference deliberately held (founder-gated).
- **Metric honesty:** the low-signal tie-break-only dimension was deliberately left OUT rather than shown as if it meant something (our metric-honesty discipline — same lineage as 0.19's dropped tie-breaker).
- **Per-firm isolation:** workspace-scoped on the M8 RLS layer; cross-firm-leak proven impossible by a fault-killing isolation test. Read-only (writes nothing, audit trail untouched). RBAC-gated (advisor + admin). NO schema change, NO deploy migration.
- **Honest scope boundary:** read-only over existing data; AI-based intent inference + the founder-gated CRM connection (which would sync an outside CRM's signals in) still to come; the M9 numeric success target still founder-owned.

**Version-bump rationale:** waves 21/22 were internal (test-hygiene / process) → skipped the bump; wave 23 ships a real user-facing /insights capability → 0.20.0 → 0.21.0 (minor).

## Action 2 — Milestone delta

**M9 — Integrations & insight** (`099cee10-562d-4e56-9a57-0dade2914760`)

DB-verified state after L-2 marked the 4 seller-intent tasks done:

| field | value |
|---|---|
| status (before → after) | `in_progress` → `in_progress` (UNCHANGED) |
| done_count | 17 |
| blocked_count | 1 (`345dfbc6` — real DataSourceAdapter / CRM, FOUNDER-GATED on vendor + API key) |
| buildable open (todo + in_progress) | **0** |
| open_total (todo + in_progress + blocked) | 1 |

**Transition decision:** M9 STAYS `in_progress`. `open_total = 1` (the blocked CRM task) → the milestone CANNOT close (a non-terminal child remains). No `UPDATE milestones` issued. Mechanical, unambiguous — no BOARD/ceo escalation required at L-1 (routing table: no judgment call, milestone does not transition).

**Buildable scope EXHAUSTED.** All four insight verticals under M9 have shipped: analytics (0.18) · calibration (0.19) · outreach activity log (0.20) · seller-intent scoring (0.21). `buildable_open = 0` and the sole remaining open child is the founder-gated CRM adapter → there is **no buildable seed candidate left under M9**.

## Action 3 — README

**SKIPPED.** Seller-intent is a new capability on the existing /insights page but introduces no new quick-start step, no new env var, no new CLI command/flag, and no breaking change — an additive read over existing data. Same disposition as the 0.18 / 0.19 / 0.20 insights waves. Detailed change lives in CHANGELOG 0.21.0.

## Action 4 — Commit

FS docs (CHANGELOG + checklist + this deliverable) committed to `main`, direct push:
`docs: L-1 wave-23 closeout (changelog)` — SHA recorded in footer post-commit.

---

## ▶ N-block flags (surface prominently to N-1 + digest)

1. **M9 buildable scope EXHAUSTED → milestone-transition decision is N-1's.** M9 stays `in_progress` (blocked on founder-gated CRM `345dfbc6`) but has zero buildable seed candidates. N-1 must decide the transition — likely **PROMOTE M10** (`033f97e0` — Advanced compliance & recordkeeping, SOX/FINRA; the next `todo` milestone, verified DB-present) since the active milestone offers no buildable seed and the blocked CRM waits on the founder. (M11 multi-tenant SaaS + billing, M12 deal network follow in the todo queue.)
2. **M9 _TBD quantitative success metric poll is now genuinely DUE.** Seller-intent was M9's LAST buildable vertical — before M9 can be considered complete the founder must set its numeric success target. This has been deferred across 0.18/0.19/0.20 as "still to come"; it is no longer deferrable. Founder-facing product poll (rule 17). Surface to N-block + digest.

---

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-1-docs
  reviewers: {}          # L-1 carries no reviewer matrix; head-learn gates directly
  failed_checks: []
  rationale: >
    CHANGELOG 0.21.0 leads with the advisor value (which deals are heating vs cooling),
    credits the deterministic-NO-AI/auditable design and the honest no-filler-dimension
    metric, and states the per-firm isolation + read-only boundary — all matching the
    V-block-verified reality (no observation theater, no overselling; deterministic-not-AI
    is truthfully framed, not dressed as an AI capability per CODE-OF-CONDUCT). House
    style matches the 0.18-0.20 insights entries exactly. Milestone delta is mechanical
    and DB-verified (M9 stays in_progress; open_total=1 blocks close; buildable=0). README
    skip justified. The two N-block flags (M10-promotion + _TBD-metric-poll-DUE) are recorded
    for N-1. No L-1 exit check failed.
  next_action: PROCEED_TO_block-exit   # L-block exits once L-2 also exits (per dispatcher § Parallelization)
```

## Deliverable footer

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:3-18"
  - "milestones row NO-UPDATE: 099cee10-562d-4e56-9a57-0dade2914760 (stays in_progress; open_total=1)"
  - "README.md: SKIPPED (additive /insights read; no new env/quick-start/CLI/breaking-change)"
  - "commit SHA: 22f96d4 (docs: L-1 wave-23 closeout — pushed 9df066b..22f96d4 origin/main)"
changelog_entry_added: true
roadmap_milestones_progressed:
  - {milestone: "M9 — Integrations & insight", before: in_progress, after: in_progress}
roadmap_skip_reason: ""
roadmap_note: "M9 buildable scope EXHAUSTED (17 done / 1 blocked-founder-gated CRM 345dfbc6 / 0 buildable). Stays in_progress on open blocked child; no buildable seed left."
readme_sections_touched: []
n_block_flags:
  - "M9-buildable-exhausted → N-1 milestone transition (likely PROMOTE M10 033f97e0 — next todo milestone)"
  - "M9 _TBD quantitative success-metric poll DUE — last buildable vertical shipped; founder product poll before M9 completes"
note: "Mode automatic; milestone delta mechanical (no BOARD/ceo escalation). No b/d/e/f pause trigger fired."
```
