# L-1 Docs — wave-29 (M10 records-VIEW; deal-activity browse; LIGHT posture)

**Shipped:** In-app records browser — a firm admin / compliance officer can BROWSE + filter its own
firm's deal/pipeline activity records in-app (read-only "Deal activity" scope on the compliance
records page), RBAC-gated, RLS-isolated, paginated. LIVE @ commit `8526999`. C-block closed @ `ea9323c`.

This is the LAST of M10's 3 light recordkeeping verticals (export + retention + records-view).

---

## 1. CHANGELOG — JUDGED: entry WARRANTED, minor bump 0.24.0 → 0.25.0

**Decision:** ADDED `## [0.25.0] — 2026-07-08 — In-app records browser (M10 — recordkeeping suite complete)`.

**Judgment rationale:**
- User-facing browse capability, directly parallel to export (0.23.0) and retention (0.24.0) — both
  took minor bumps. Consistency + Keep-a-Changelog convention → minor bump, `### Added` note.
- Additive-only: read-only view, NO migration, NO audit-log write, NO email, NO AI, NO new permission.
  Reflected honestly in the Provenance section.
- **Milestone-level note included** (as instructed): the entry surfaces that M10's light recordkeeping
  suite (export + retention + browse) is now FUNCTIONALLY COMPLETE — a milestone-level capability worth
  surfacing to the reader, with the deferred items (deletion-on-expiry, formal certification, named-regime
  posture) still explicitly held at light posture pending founder classification raise.

**Format check:** matches existing CHANGELOG structure (Added / Correctness-compliance / Provenance
sub-sections, one-line summary lead) — same shape as 0.23.0 and 0.24.0.

## 2. Milestone delta — M10 (in_progress, LIGHT posture)

**Tasks (already marked `done` by L-2 parallel stage):**
- `d573e7bf` — Build firm-admin Records view page + deal-activity list read API → **done**
- `6f86b594` — Add shared-Zod records-view / deal-activity list filter contract → **done** (sibling)
- `770ab1c4` — Author deterministic RLS-isolation + RBAC-deny tests for Records read → **done** (sibling)

**records-VIEW SHIPPED.** No milestone `status` write at L-1 (M10 STAYS `in_progress`; N-3 owns the
close per waves/milestone lifecycle). No `## Success metric` prose edit needed — the existing LIGHT-posture
metric prose already fully describes the shipped state.

**M10 light success metric — FULLY MET.** The light metric (founder 2026-07-07) required, on demand:
(a) export a complete, workspace-scoped, integrity-verifiable record in a portable format, itself
audit-logged — **shipped 0.23.0**; (b) retained records bounded by a configurable retention window —
**shipped 0.24.0**; (c) retained records viewable in-app — **shipped this wave (0.25.0)**. All three
light verticals + the 3 hardening waves are done → **M10-light is functionally COMPLETE.**

**⇒ CARRY PROMINENTLY FOR N-1 (non-mechanical milestone transition):**

**(a) M10 CLOSES at N-block.** All scope shipped, light metric met. The deferred attestation /
named-regime (SOX/FINRA) posture is founder-deferred and is NOT part of the light metric — its absence
does NOT block the close. N-3 transitions M10 `in_progress → done`.

**(b) The M10 → NEXT-milestone slot decision is NOT mechanical — route to BOARD (automatic mode) / founder.**
Neither candidate is a clean auto-activate:
  - **M9 — Integrations & insight** is `blocked`. Metric is `_TBD by founder`. Buildable credential-free
    scope was exhausted at wave-23 (17 verticals shipped: analytics / calibration / outreach-log /
    seller-intent). The only remaining child (`345dfbc6`, blocked) is a real CRM/DataSourceAdapter gated
    on a **founder data-vendor selection + account-issued API key**; remaining scope (external multi-channel
    send, matching-model retraining/LLM-spend) is likewise founder-credential/spend-gated. Honest
    external-hold — resumes only on a founder unblock.
  - **M11 — Multi-tenant SaaS platform + billing** is `todo` (H3). Metric is `_TBD by founder`
    (target: external firm self-provisions a tenant + is billed). Carries **1 BOARD-ratified blocking
    prereq** (multi-tenant provisioning; the v2+ monetization vision, explicitly out of MVP scope per brief).

  head-next routes the next-slot decision (unblock M9 vs activate M11 vs roadmap-refresh) to **BOARD**
  under automatic mode / founder. This is a genuine strategic fork, not a queue pop.

## 3. M9 `_TBD` metric + milestone pile-up (context for N-1)

- **M9 metric is still `_TBD by founder`** — its close/resume disposition cannot be decided mechanically.
- **Milestone pile-up (blocked backlog):** M5, M6, M7, M9 all `blocked`; M11, M12 `todo`; H1 `cancelled`.
  M1–M4, M8 `done`. With M10 about to close, the loop is running low on cleanly-buildable, credential-free
  milestone scope: M5/M6/M7 are blocked (earlier gating), M9 is founder-credential/spend-gated, M11/M12 are
  H3/founder-metric-`_TBD`. N-1 should surface this pile-up to BOARD/founder — a strategic review or
  roadmap-refresh may be warranted rather than another queue pop.

## 4. README — JUDGED: touch WARRANTED

Added an "**In-app records browser is live.**" paragraph to the live-features list, after the retention
policy entry, noting read-only/paginated + RLS-scoped + RBAC-refused, and that with export + retention +
browser all live the M10 light recordkeeping suite is complete.

---

## Deliverable summary (for N-1 handoff)

| Item | Result |
|---|---|
| CHANGELOG | `## [0.25.0]` added — minor bump, records-browse Added note + M10-suite-complete note |
| README | records-browser live-features paragraph added |
| M10 tasks | all 3 (`d573e7bf` + 2 siblings) `done` (via L-2) |
| M10 status | STAYS `in_progress` at L-1 → CLOSES at N-3 (light metric met) |
| Next-slot | NON-mechanical → BOARD/founder (M9-blocked vs M11-todo, both `_TBD`) |
| Pile-up | flagged: M5/M6/M7/M9 blocked, M11/M12 todo — low clean-buildable scope |

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md — new [0.25.0] section (records-browse + M10-suite-complete); commit SHA below"
  - "README.md — in-app records browser live-features paragraph"
  - "tasks d573e7bf / 6f86b594 / 770ab1c4 = done (L-2 parallel)"
  - "M10 in_progress at L-1 (N-3 closes); light metric fully met"
  - "shipped @ 8526999; C-block closed @ ea9323c"
note: "M10 light recordkeeping suite (export 0.23.0 + retention 0.24.0 + browse 0.25.0) functionally complete. M10→next-slot is a non-mechanical BOARD/founder fork (M9 blocked/_TBD vs M11 todo/_TBD); milestone pile-up flagged for N-1."
head_signoff:
  verdict: APPROVED
  stage: L-1-docs
  reviewers: {}
  failed_checks: []
  rationale: >
    All L-1 deliverables complete and consistent with prior recordkeeping releases. CHANGELOG minor
    bump is warranted (user-facing browse capability parallel to export/retention) and honestly
    provenanced (no migration/audit-write/email/AI). README updated. Milestone delta is accurate:
    records-view shipped, M10-light metric fully met, M10 stays in_progress until N-3 closes it, and
    the M10→next-slot decision is correctly flagged as a non-mechanical BOARD/founder fork rather than
    a mechanical queue pop. No observation-theater or overclaim: the deferred named-regime posture is
    stated as founder-deferred and explicitly excluded from the light metric.
  next_action: PROCEED_TO_N-block
```
