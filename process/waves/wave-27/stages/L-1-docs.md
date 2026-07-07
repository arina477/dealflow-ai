# Wave 27 — L-1 Docs (M10 recordkeeping EXPORTS)

**Block:** L (Learn), L-1 ∥ L-2. **Mode:** automatic. **Gate owner:** head-learn (fresh spawn).
**Shipped LIVE @ff29cf4** — firm-admin/compliance recordkeeping export at `/compliance/export` (CSV/JSON, workspace-RLS-scoped, HMAC-chain integrity-verifiable, export itself audit-logged). First of M10's 3 light recordkeeping verticals.
**V-block verdict:** APPROVED (head-verifier Phase-1; karen + jenny APPROVE; cross-tenant isolation fault-killing-proven SEC-8 17/17 as dealflow_app).

---

## Action 1 — CHANGELOG decision: **ADD `### Added` note + minor version bump 0.22.0 → 0.23.0**

**Decision: JUDGED user-facing → warrants a CHANGELOG entry.** Unlike the internal devops/tooling SKIPS of waves 21/22/24/26 (no user-perceptible surface), this wave shipped a REAL user-facing capability: a new export page (`/compliance/export`) + an extended export endpoint that a firm admin or compliance officer directly operates. This is closest in kind to wave-25's user-facing auth-hardening (0.22.0) — a real, perceptible product surface + a compliance-first selling point ("the record you hand a regulator, on demand"). Minor bump under SemVer (additive, backward-compatible feature).

**Reality-check basis (no observation theater):** the CHANGELOG claims trace to independently verified deployed state, not to a green badge — head-verifier re-probed `/health` 200 @ff29cf4 + unauthed `POST .../export` → 401 perimeter this tick; jenny 15 MATCH / 0 DRIFT on shipped source; karen live-probed. Cross-tenant isolation (the load-bearing claim) is fault-killing-proven (SEC-8 17/17 as `dealflow_app`, RED#1 skip→FAILED baseline confirms the harness cannot false-pass). Truncation-honesty (SEC-4) fixed end-to-end + tautology killed. The "you only ever export your own firm's records" and "tamper-evident integrity result" lines in the entry are backed by observable deployed-state evidence, not inference.

- **CHANGELOG.md** — new `## [0.23.0] — 2026-07-07 — Firm recordkeeping export (M10)` section prepended above `[0.22.0]`. Sections: headline paragraph + `### Added` (2 bullets: CSV/JSON export page + truncation-honesty) + `### Correctness / compliance` (per-firm isolation proven + tamper-evident integrity) + `### Provenance (transparency)` (extends existing module, no new DB/setup/permission; export half only, retention + records-view deferred, light posture). House-style-matched to the terse recent entries (0.18–0.22).

## Action 2 — Milestone delta: **M10 STAYS `in_progress` (exports vertical shipped; scope NOT yet complete)**

Wave-27 claimed tasks (both `done`, marked by L-2 in parallel), both `milestone_id = 033f97e0` (M10):
- `0d2c5f08` — Firm-admin recordkeeping export endpoint (CSV/JSON, HMAC-verifiable) → **done**
- `f331a51c` — Firm-admin recordkeeping export page (format picker, download, integrity result) → **done**

M10 child-task rollup: **done=5, open=0, cancelled=0**.

**Judgment — NO transition (mechanically clear, no BOARD escalation):** `open_count=0` mechanically suggests the Action-2 `→ done` transition, BUT the `milestones` status contract requires "all child tasks `done` **AND** LLM-judged scope shipped (strict)". M10's `## Scope` names 3 verticals in build order — (1) EXPORTS [**shipped this wave**], (2) RETENTION [not built], (3) records VIEW [not built] — and the `## Success metric` explicitly requires all three ("export … **retained records are viewable in-app and bounded by a configurable retention window**"). Scope is **NOT shipped** (2 of 3 verticals remain). This is not the ambiguous "is it really done?" case that routes to BOARD — the metric is objectively unmet, so the resolution is unambiguous: **M10 stays `in_progress`; no milestone DB write.**

- **`## Success metric` — on-demand-export half now MET.** The metric's first clause ("a firm admin can, on demand, export a complete workspace-scoped, integrity-verifiable record of the firm audit log + deal activity in a standard portable format (the export is itself audit-logged)") is satisfied and live. The second clause (retention window + in-app records view) remains.
- **Metric is now SET (light posture).** The wave-26 enforced founder-pause was resolved 2026-07-07 (compliance posture = LIGHT); M10's `## Success metric` is no longer `_TBD`. Consequence: the **next N-block decomposition will SUCCEED** (no repeat of the wave-26 incomplete-scope refusal) — the next M10 vertical = **RETENTION policy** (then records-VIEW) is a concrete, testable, anchorable bundle that no longer requires the founder-reserved regime decision.
- **No `product-decisions.md` append** — no milestone transition occurred (append is only for state changes per roadmap-lifecycle § State recording).

## Action 3 — README decision: **ADD (user-facing, live-feature list pattern)**

README's "Live deployment" section lists each live user-facing capability with a short paragraph (auth, shell, audit log, compliance gate, sourcing). The export feature is a genuine new user-facing surface (`/compliance/export`) consistent with that pattern → added a surgical "**Firm recordkeeping export is live.**" paragraph after the sourcing entry. Detail stays in CHANGELOG.

## Action 4 — Commit

FS docs (CHANGELOG + README + this deliverable + L-2/V untracked deliverables) committed to `main`: `docs: L-1 wave-27 closeout`. Direct push (project allows direct doc commits).

---

## head-learn L-1 gate — stage-exit checklist

- [x] Retrospective omits individual human error as root cause — N/A (clean wave, 0 blocking; the 2 C-1 RED cycles were systemic harness catches — seed-PK collision + WORM-chain-corruption — resolved under Iron Law, logged as INFO, not blamed on a person).
- [x] Observations traced to corrective controls, not symptom-listing — the SEC-4 silent-truncation P1 (B-6 catch) traces to a validation-harness gap (mock tautology) that was killed, not just patched.
- [x] Reality-check findings vs deployed state — CHANGELOG/README claims backed by independent live re-probes (head-verifier + karen), not green-badge inference. No observation theater.
- [x] Decisions record alternatives + rationale — CHANGELOG add-vs-skip justified against the wave-21/22/24/26 skip precedent + wave-25 add precedent; milestone no-transition justified against the strict scope-shipped contract.
- [x] Compliance gate intact — audit-log immutability, RLS isolation, RBAC (compliance+admin) all verified structurally intact on the live hash; no degradation for speed.
- [x] AI-code-without-comprehension — N/A (no AI-generated acceptance this wave).

**No principles promotion at L-1** (that is L-2's ≤1-per-wave concern; L-1 owns docs only).

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:3-19 (## [0.23.0] section — headline + Added + Correctness/compliance + Provenance)"
  - "README.md:66-72 (Firm recordkeeping export is live. paragraph)"
  - "milestone 033f97e0 (M10): NO UPDATE — stays in_progress (open=0 but scope not shipped, 2/3 verticals remain); on-demand-export metric-half MET"
  - "commit: docs: L-1 wave-27 closeout (SHA recorded below post-commit)"
head_signoff:
  verdict: APPROVED
  stage: L-1
  reviewers: {}
  failed_checks: []
  rationale: >
    Genuine user-facing export capability shipped LIVE @ff29cf4, independently reality-checked
    by the V-block (not green-badge inference). CHANGELOG add + 0.23.0 bump justified against the
    skip/add precedent; README add consistent with the live-feature pattern; milestone correctly
    held in_progress against the strict scope-shipped contract (export vertical shipped, retention +
    records-view remain). Metric now SET (light) — next decomposition will succeed. No observation
    theater, no root-cause fallacy, no snacking. Clean L-1 exit.
  next_action: PROCEED_TO_block_exit
changelog_entry_added: true
changelog_version: "0.23.0"
roadmap_milestones_progressed:
  - {milestone: "M10 (033f97e0)", before: "in_progress", after: "in_progress", note: "exports vertical shipped; on-demand-export metric-half MET; retention + records-view remain; NO transition"}
roadmap_skip_reason: ""
readme_sections_touched: ["Live deployment — Firm recordkeeping export is live."]
note: >
  Next M10 vertical = RETENTION policy (then records-VIEW). M10 ## Success metric now SET at light
  posture (founder 2026-07-07) — the next N-block decomposition will SUCCEED (no wave-26-style
  incomplete-scope pause). No BOARD escalation (milestone no-transition is mechanically unambiguous).
```
