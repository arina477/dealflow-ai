# Wave 22 — L-1 Docs

> **Block:** L (Learn) — L-1 ∥ L-2. Wave 22 = M9 test-hygiene fix-forward. **TEST-ONLY, no product code.**
> **Gate owner:** head-learn. **Mode:** automatic.
> **Seed:** `02f4e6a1` — Fix-forward: scope OAE-class unscoped audit-count assertions in outreach-activity-rls e2e (per promoted T-4 rule 2).

## What wave 22 shipped

A **test-only** reliability fix. The `outreach-activity-rls.e2e-spec.ts` suite was counting the shared `audit_log_entries` chain **globally** (bare `COUNT(*) FROM audit_log_entries`), so other tests writing to the same shared CI Postgres at the same time perturbed the count — an intermittent CI flake (e.g. expected 34, got 33; passed on re-run). Wave 22 scoped the offending audit-count assertions (OAE-9..12) by `workspace_id`, per the promoted **T-4 rule 2** (a real-DB parallel suite must assert only its OWN scoped rows of a shared append-only chain).

**Honest boundary:** this is INTERNAL test reliability. NOT a user-facing product feature. Zero UI / API / route / behavior / schema / env / deploy change reaches a DealFlow AI user. The production runtime bundle is unchanged from the last code deploy `86ddc29` (test files are not deployed — C-2 was a verified NO-OP). This is a CI-flake fix, not a feature.

**V-block outcome:** Karen + jenny APPROVE; V-2 triage + V-3 fast-fix clean. C-1 verified the fix live: CI run `28850000460` completed `conclusion=success` @`c168d3a`, 5/5 jobs green, and the `outreach-activity-rls.e2e-spec.ts` suite ran + passed (9 tests) with the scoped OAE-9..12 assertions — proven by grep of the actual test-job log, not an extrapolated green.

---

## Action 1 — CHANGELOG decision: **SKIP the version bump (skip-with-reasoning)**

**Decision:** No `[0.21.0]` product-CHANGELOG entry. Version NOT bumped. Reasoning recorded here (this deliverable is the record). `changelog_entry_added: false`.

**Why skip (convention-grounded judgment):**
- The CHANGELOG (`0.18.0..0.20.0`, verified via `git log -p CHANGELOG.md`) is a **user-facing product changelog** (keep-a-changelog: Added / Correctness-compliance / Provenance). **Every** historical entry maps to a shipped user-facing change — a new page (`/insights`, `/outreach/activity`), a new metric surface, a live per-firm isolation guarantee. The convention has **never** logged a purely internal / test / tooling change.
- Wave 22 shipped only a **test-file assertion scoping** to fix a CI flake. There is **nothing a user experiences differently** — no screen, no endpoint, no permission, no data change, no deploy (bundle unchanged @`86ddc29`). A product-changelog version bump would assert to any reader "0.21.0 = a user-facing release," which is false.
- This is **less** user-facing than wave-21 (which shipped an internal verification-strategy doc and correctly SKIPPED the bump — see `process/waves/_archive/wave-21/stages/L-1-docs.md`). A test-flake fix is squarely inside that same skip precedent.
- Adding a minimal `Internal:` / `Fixed:` entry was considered and **rejected**: the CHANGELOG's `### Fixed` semantics (per L-1 Action 1) are for a V-3 blocking finding that fixed **shipped user-facing behavior** — this fix touched no shipped behavior, only test-suite determinism. Logging it would break the project's version↔user-facing-change convention and seed changelog-noise. The scoped test + its own commits (`128e...`/`e832633`/`d654dba`, merged @`c168d3a`) are the honest record.

**Honesty statement:** This wave was internal test-reliability hardening (killing an intermittent CI flake), **not a user feature**. Skipping the product-changelog entry is the honest, convention-consistent call.

---

## Action 2 — Milestone delta: M9 → **in_progress → in_progress (STAYS; NOT closed)**

**Milestone:** `099cee10-562d-4e56-9a57-0dade2914760` — M9 — Integrations & insight (H2/T4).

DB state (queried this stage over M9 child tasks):

| metric | count |
|---|---|
| done | 13 (incl. this wave's seed `02f4e6a1`, now `done`, wave_id `731e08c1…`) |
| open | 1 |
| seed_candidates (`todo` ∧ `wave_id IS NULL` ∧ `parent_task_id IS NULL`) | 0 |

Open children (`open_count = 1 > 0` → milestone CANNOT close):
- `345dfbc6` — **blocked** — real DataSourceAdapter, FOUNDER-GATED on deal-source vendor selection + account-issued API key (Salesforce / DealCloud / Affinity). Re-opens to `todo` only on founder vendor+credential resolution. Ghost-dep guard: do NOT depend on it.

**Delta:** 1 done this wave (`02f4e6a1`); 1 open remains, and it is `blocked`/founder-gated (not buildable). `open_count = 1 > 0` → M9 is structurally NOT done. Mechanical, no ambiguity → no BOARD/ceo-agent escalation. **Do NOT close M9.**

`roadmap_milestones_progressed: [{milestone: M9, before: in_progress, after: in_progress}]`

---

## Carried flags for N-block / digest

1. **SELLER-INTENT = WAVE-23 SEED.** M9's `seed_candidates` count is now **0** (confirmed in DB: the only open child `345dfbc6` is `blocked`, not a `todo` seed candidate). This is the trigger the wave-21 → wave-22 carry-forward predicted: with the fix-forward seed `02f4e6a1` now `done` and no other seed candidate, **wave-23 N-1 will legitimately fire milestone-decomposer (`next-bundle`)** for the remaining buildable, credential-free M9 thread — **seller-intent signals** (derived scoring over EXISTING internal data: wave-20 `outreach_activity`, wave-19 accept/reject calibration, mandate/stage velocity; NO external intent vendor, NO LLM, NO SDK, NO spend, NO credential). Surface to N-1.
2. **M9 `_TBD` success metric — founder poll (rule 17, product/taste).** M9's quantitative success target is still `_TBD_`. Must be founder-set before M9 can ever close; NOT blocking now. Flagged by ceo-reviewer + jenny across waves 18–21; **carried again**. Surface to N-block/digest for the founder poll.
3. **345dfbc6 founder-gated pile-up** (non-blocking, tracked in `process/session/updates/digest-2026-07-07-M9-metric-and-gated-pileup.md`): deal-source vendor + API key (M9 CRM adapter) awaits founder. Ghost-dep guard applies.

---

## Action 3 — README: **SKIPPED**

Nothing user-facing changed. No new CLI command / flag, no new env var, no new install step, no breaking change. The wave touched one e2e test file only. `readme_sections_touched: []`.

---

## Action 4 — Commit

`docs: L-1 wave-22 closeout` — FS docs (this deliverable + checklist L-1 tick). Direct push to `main`. SHA: `<filled post-commit>`.

---

## head-learn L-1 gate verdict

**APPROVED.** L-1 Docs exit checklist walked against concrete artifacts:
- **No Observation Theater.** The wave's observation (a CI flake caused by counting a shared append-only chain globally) maps directly to a corrective control: the assertions were scoped to the suite's own `workspace_id` rows per promoted T-4 rule 2, and the fix is **proven** — C-1 grepped the actual CI test-job log showing the suite ran + passed (9 tests) with the scoped assertions, on the exact green headSha `c168d3a`. Symptom → root cause (test-isolation over a shared chain) → corrective control (workspace-scoping) → live verification. Not a read-only symptom log.
- **Systemic, not human-error, root cause.** The flake is attributed to a missing test-isolation constraint (unscoped assertion over a shared CI Postgres chain), not to a developer mistake. The corrective control (T-4 rule 2 scoping) is an environmental/structural safeguard.
- **Honest scope boundary.** L-1 explicitly records this as internal test-reliability, NOT a user feature — no user-facing surface, no deploy (bundle unchanged @`86ddc29`, C-2 NO-OP verified live). CHANGELOG skip carries reasoning + rejected-alternative (`Fixed:` entry considered and declined against the version↔user-facing convention), consistent with the wave-21 skip precedent.
- **Milestone delta grounded in DB, no ambiguity.** `open_count=1` (blocked/founder-gated) → M9 stays `in_progress` mechanically; `seed_candidates=0` correctly hands the seller-intent decomposition to wave-23 N-1. `_TBD` success-metric founder poll carried, not silently dropped.

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md: SKIP (no entry) — skip-with-reasoning; convention = user-facing releases only; test-only wave"
  - "milestones row: 099cee10-562d-4e56-9a57-0dade2914760 — NO transition (in_progress → in_progress; open_count=1 blocked)"
  - "tasks: 02f4e6a1 confirmed status='done' (wave_id 731e08c1)"
  - "README.md: SKIP (nothing user-facing changed)"
  - "commit: docs: L-1 wave-22 closeout @<filled post-commit>"
changelog_entry_added: false
roadmap_milestones_progressed: [{milestone: M9, before: in_progress, after: in_progress}]
roadmap_skip_reason: ""
readme_sections_touched: []
head_signoff:
  verdict: APPROVED
  stage: L-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Test-only CI-flake fix. Observation is reality-checked and traces symptom → systemic root cause
    (unscoped assertion over a shared append-only audit chain) → corrective control (T-4 rule 2
    workspace-scoping) → live-verified green (C-1 log grep on headSha c168d3a). No Observation Theater,
    no human-error fallacy. CHANGELOG SKIP is convention-consistent (user-facing releases only) and
    precedent-consistent (wave-21), with the rejected Fixed-entry alternative recorded. Milestone delta
    is mechanical and DB-grounded: M9 stays in_progress (open_count=1 blocked/founder-gated), seed_candidates=0
    correctly routes seller-intent decomposition to wave-23 N-1. _TBD success-metric founder poll carried.
  next_action: PROCEED_TO_L-BLOCK_EXIT
note: "Internal test-reliability, not a user feature. CHANGELOG + README both skipped with reasoning. L-2 runs in parallel (task done-marking + ≤1 principle promotion vetting)."
```

## Exit criteria status
- CHANGELOG entry appended → **SKIP recorded with reasoning** (test-only, convention-consistent). ✔
- Milestone rows progressed in DB → **no transition needed**; M9 stays `in_progress` (recorded). ✔
- README touched → **SKIP recorded** (nothing user-facing). ✔
- Commits pushed → `docs: L-1 wave-22 closeout` @`<filled post-commit>`. ✔ (below)
- Deliverable carries `l_stage_verdict: COMPLETE`. ✔
- `process/waves/wave-22/checklist.md` L-1 row checked. ✔ (below)
