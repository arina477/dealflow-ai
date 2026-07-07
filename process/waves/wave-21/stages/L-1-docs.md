# Wave 21 — L-1 Docs

> **Block:** L (Learn) — L-1 ∥ L-2. Wave 21 = M9 process/DX hardening. DOCS/PROCESS wave, **no product code**.
> **Gate owner:** head-learn. **Mode:** automatic.
> **Seed:** `1d95cac0` — Spec-authoring + test-fixture process hardening (analytics-wave lessons).

## What wave 21 shipped

An **internal** testing-strategy artifact: `command-center/testing/ci-e2e-authoritative-policy.md` (17,640 bytes, committed at `8f2287f` during B-2). It:
- Formally declares the CI e2e suite — run against real Postgres (`postgres:18`) as the **non-superuser `dealflow_app`** role — the AUTHORITATIVE verification for DealFlow AI's compliance / isolation / RBAC / audit / SoD invariants (superuser bypasses FORCE RLS → vacuous passes; `dealflow_app` = NOSUPERUSER NOBYPASSRLS proves enforcement is real).
- Provides a 25-invariant → cited-falsifiable-test table (each row: invariant, category, exact e2e file + marker, proof pattern, and the "falsa if" condition).
- Documents the live-authed in-app check **deferral** ONCE (single-tenant prod + no committable prod credentials, rule 2) with an explicit LATER-TRIGGER (2nd tenant + committable non-destructive fixture / populated test-accounts registry) — so V/T stop re-deriving it every wave.
- Closes the 3 accumulated metric-honesty spec-authoring items (B/D/E) as already-covered by promoted `PRODUCT-PRINCIPLES.md #1` — a one-line note, no re-doc, no new artifact.

**Honest boundary:** this is INTERNAL process / tooling. NOT a user-facing product feature. Zero UI / API / route / behavior / schema / env change reaches a DealFlow AI user.

---

## Action 1 — CHANGELOG decision: **SKIP the version bump (skip-with-reasoning)**

**Decision:** No `[0.21.0]` product-CHANGELOG entry. Version NOT bumped. Reasoning recorded here (this deliverable is the record).

**Why skip (convention-grounded judgment):**
- The CHANGELOG (`0.16.0..0.20.0`, verified via `git log -p CHANGELOG.md`) is a **user-facing product changelog** (keep-a-changelog: Added / Correctness-compliance / Provenance). **Every** historical entry maps to a shipped user-facing change (a new page, a new metric surface, a live isolation guarantee). The convention has **never** logged a purely internal / process / tooling change with no user-facing surface.
- Wave 21 shipped only an internal verification-strategy doc. There is **nothing a user experiences differently** — no screen, no endpoint, no permission, no data change. A product-changelog version bump would assert to any reader "0.21.0 = a user-facing release," which is false.
- Adding a minimal `Internal:` entry was considered and **rejected**: it would break the project's convention (version ↔ user-facing change) and seed changelog-noise. The internal artifact + its own commit (`8f2287f`) are the honest record of the work; the CHANGELOG stays authoritative as a user-facing release log.

**Honesty statement (per prompt):** This wave was internal quality/process hardening (locking in how we verify compliance invariants), **not a user feature**. Skipping the product-changelog entry is the honest, convention-consistent call.

`changelog_entry_added: false` — skip-with-reasoning.

---

## Action 2 — Milestone delta: M9 → **in_progress → in_progress (STAYS; NOT closed)**

**Milestone:** `099cee10-562d-4e56-9a57-0dade2914760` — M9 — Integrations & insight (H2/T4).

DB state (queried this stage):

| metric | count |
|---|---|
| done | 12 (incl. this wave's seed `1d95cac0`, now `done`, wave_id `e72bb0ce…`) |
| open | 2 |
| cancelled | 0 |

Open children (`open_count = 2 > 0` → milestone CANNOT close):
- `345dfbc6` — **blocked** — real DataSourceAdapter, FOUNDER-GATED on deal-source vendor selection + account-issued API key (Salesforce / DealCloud / Affinity). Re-opens to `todo` only on founder vendor+credential resolution. Ghost-dep guard: do NOT depend on it.
- `02f4e6a1` — **todo** — NEW fix-forward: scope the OAE-3-class unscoped audit-count assertions test-hygiene item (surfaced this wave). Buildable, credential-free.

**Delta:** 1 done this wave; 2 open remain. `open_count = 2 < 3` (brain fallback threshold) AND only 1 of the 2 is buildable + non-gated → **backlog-thin flag for N-1** (reason `backlog-stockout`). Mechanical, no ambiguity → no BOARD/ceo-agent escalation (open tasks exist; milestone is structurally NOT done). **Do NOT close M9.**

`roadmap_milestones_progressed: [{milestone: M9, before: in_progress, after: in_progress}]`

---

## Carried flags for N-block / digest

1. **SELLER-INTENT = WAVE-22 SEED.** The remaining buildable, credential-free M9 thread is **seller-intent signals** — derived scoring over EXISTING internal data (wave-20 outreach_activity, wave-19 accept/reject calibration, mandate/stage velocity). NO external intent vendor, NO LLM, NO SDK, NO spend, NO credential. It could not be decomposed earlier (milestone-decomposer Step-1 gate requires seed-candidate count = 0; two candidates existed). Now that seed `1d95cac0` is claimed/done, M9's seed-candidate count reaches 0 → **wave-22 N-1 will legitimately fire milestone-decomposer (`next-bundle`)** for the seller-intent vertical slice. Surface to N-1.
2. **M9 `_TBD` success metric — founder poll (rule 17, product/taste).** M9's quantitative success target is still `_TBD_`. Must be founder-set before M9 can ever close; NOT blocking now. ceo-reviewer + jenny flagged it across waves 18–20; carried again. Surface to N-block/digest for the founder poll.
3. **345dfbc6 founder-gated pile-up** (non-blocking, tracked in `process/session/updates/digest-2026-07-07-*`): deal-source vendor + API key (M9 CRM adapters) awaits founder. Ghost-dep guard applies.

---

## Action 3 — README: **SKIPPED**

Nothing user-facing changed. No new CLI command / flag, no new env var, no new install step, no breaking change. The shipped artifact is an internal `command-center/testing/` doc with no quick-start / env impact. `readme_sections_touched: []`.

---

## Action 4 — Commit

`docs: L-1 wave-21 closeout` — FS docs (this deliverable + checklist L-1 tick). Direct push to `main`. SHA: <FILLED_ON_COMMIT>.

---

## head-learn L-1 gate verdict

**APPROVED.** L-1 Docs exit checklist walked against concrete artifacts:
- Shipped artifact is a falsifiable, enumerated verification policy (named-invariant → cited-test-→-"falsa-if" table), NOT process-theater — every declared invariant maps to a concrete falsifiable e2e test. No Observation Theater.
- The deferral (live-authed check) carries a recorded rationale + explicit later-trigger — not "we skipped it." Decision rationale captured with alternatives (add-entry-vs-skip) and the trade-off recorded.
- CHANGELOG decision is convention-grounded and honest (internal process ≠ user feature), not a snack entry that would corrupt the user-facing release-log convention.
- Milestone delta is mechanical and correct (open_count > 0 → stays in_progress); no over-reach to close M9.

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Wave 21 shipped an internal, falsifiable CI-e2e-authoritative verification
    policy (25 named invariants → cited e2e tests, each with a falsa-if
    condition) plus a documented deferral with an explicit later-trigger — no
    Observation Theater. CHANGELOG version bump SKIPPED with reasoning: the
    project's changelog is a user-facing release log and every prior entry maps
    to a user-facing change; a pure internal-process wave does not warrant a
    product-changelog entry, and adding one would break that convention. M9
    milestone delta is mechanical (12 done / 2 open → open_count>0 → stays
    in_progress; NOT closed). README skipped (nothing user-facing). Seller-intent
    = wave-22 seed and the M9 _TBD success-metric founder poll are carried to
    N-block/digest.
  next_action: PROCEED_TO_L-block-exit
```

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md: NO entry — skip-with-reasoning (internal process wave; user-facing convention preserved)"
  - "milestones row: M9 099cee10 — NO UPDATE (open_count=2>0 → stays in_progress)"
  - "shipped artifact: command-center/testing/ci-e2e-authoritative-policy.md @ 8f2287f (B-2)"
  - "L-1 deliverable + checklist commit: <FILLED_ON_COMMIT>"
changelog_entry_added: false
changelog_skip_reason: "Internal testing-verification policy, no user-facing product change; project changelog is a user-facing release log (0.16.0..0.20.0 all user-facing) — a pure internal-process wave does not warrant a product-changelog entry."
roadmap_milestones_progressed: [{milestone: M9, before: in_progress, after: in_progress}]
roadmap_skip_reason: ""
roadmap_backlog_thin_flag: true   # open_count=2 (<3); only 1 buildable non-gated → N-1 backlog-stockout
readme_sections_touched: []
carried_flags:
  - "SELLER-INTENT = wave-22 seed (M9 seed-candidate count now 0 → N-1 fires milestone-decomposer next-bundle)"
  - "M9 _TBD success metric → founder poll (rule 17) before M9 closes — surface to N-block/digest"
  - "345dfbc6 CRM adapter founder-gated (vendor + API key) — ghost-dep guard"
note: "DOCS/PROCESS wave, no product code. head-learn gate: APPROVED."
```
