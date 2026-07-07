# L-1 — Docs — wave 20

**Wave:** 20 (id `1a22b3aa-17cd-423e-a238-1eaec33fa3d9`, running) — M9 outreach-activity log — shipped LIVE @86ddc29, V-block APPROVED (Karen + jenny).
**Mode:** automatic. Milestone delta was mechanical (open_count > 0, no "is it really done" judgment) → no BOARD escalation required.

## Action 1 — CHANGELOG entry (DONE)

Prepended `## [0.20.0] — 2026-07-07 — Outreach activity log (M9)` above [0.19.0].

- **Range:** `CHANGELOG.md:3-18`
- **Sections:** Added (2 bullets) / Correctness · compliance (2 bullets) / Provenance (transparency) (2 bullets) — matches house style; ≤5 bullets/section; declarative present-tense, PM-readable (rule 16).
- **Lead:** advisor value — log and track your manual outreach touches (calls / follow-up emails / LinkedIn) in one place, with channel + status + optional due date + optional deal link; create form + "my open touches" list.
- **Credited:** per-firm write-isolation (only your own firm's log, built on M8 RLS, write side proven by a fault-killing test) + audit-trailed create/edit/status-change mutations (first outreach WRITE surface — exercises the audit trail on the write path) + honest boundary (logs touches, does NOT send anything).
- **Honest scope:** external send + seller-intent + the M9 quantitative _TBD success target still to come, founder-dependent.

## Action 2 — Milestone delta (DONE — M9 STAYS in_progress)

M9 `099cee10-562d-4e56-9a57-0dade2914760` — Integrations & insight (H2/T4).

| | before | after |
|---|---|---|
| M9 status | in_progress | in_progress (unchanged — do NOT close) |

Child-task counts under M9 after L-2 marked this wave's 4 tasks done:
- **done_count = 11**, **open_count = 2** → `open_count > 0` → M9 does NOT transition to done.
- This wave marked its 4 outreach-activity tasks done: `d45c73b5` (table + migration), `c3776cac` (shared-Zod contracts), `5c12ac3a` (service RLS + audit-logged mutations), `b2acf4ce` (RBAC API + UI panel). All confirmed `status='done'` in DB.

**2 open M9 children remaining:**
1. `345dfbc6-1c96-4f6a-98aa-12ac7d61794b` — "Implement first real DataSourceAdapter…" — todo, seed (parent_task_id NULL), **FOUNDER-GATED** on deal-source vendor selection (spend hard-stop) + account-issued API key. Not buildable without founder decision.
2. `1d95cac0-b396-40b7-8904-be0fa42aa3ab` — "Spec-authoring + test-fixture process hardening…" — todo, **STALE wave_id = `0f32f35c` (= wave-18, status ok)** — leftover flagged by N-block last wave for re-home. Buildable, non-gated.

No `UPDATE milestones` executed (no transition). No `product-decisions.md` append (no milestone-state change).

## Action 3 — README touchups (SKIPPED)

Skip reason: additive `outreach_activity` table only — no new env var, no new quick-start step, no new CLI command/flag, no breaking change. Nothing README-relevant changed. CHANGELOG carries the user-facing detail.

## Action 4 — Commit (DONE)

FS docs (CHANGELOG only; README skipped) committed to main: `docs: L-1 wave-20 closeout (changelog)`.
- **SHA:** b3b67e0

## Flags for N-1 / N-block / digest

- **BACKLOG-THIN (N-1, reason `backlog-stockout`):** M9 open_count = 2 < 3 threshold, and only 1 of the 2 (`1d95cac0`) is buildable/non-gated (the other, `345dfbc6`, is founder-gated). N-1 should decompose the next M9 bundle (multi-channel-outreach thread has remaining scope: external send, seller-intent) or re-home/claim `1d95cac0`.
- **STALE wave_id (milestone hygiene):** `1d95cac0` still carries `wave_id=0f32f35c` (wave-18). Not a valid seed as-is; a planning/checkpoint pass should re-home (clear wave_id → NULL) or claim it. Carried from wave-18/19; still unresolved.
- **M9 _TBD success metric (founder poll):** the M9 quantitative success target is still `_TBD_` and MUST be founder-polled before M9 can ever close. Carried from wave-18/19 — surface to N-block / founder digest (`digest-2026-07-07-M9-metric-and-gated-pileup.md`). NOT blocking this wave.

## Deliverable footer

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:3-18"
  - "milestones row UPDATE: none (M9 stays in_progress; open_count=2>0)"
  - "README.md: skipped (no user-facing README change — additive table, no new env/quick-start)"
  - "commit: b3b67e0"
changelog_entry_added: true
roadmap_milestones_progressed:
  - {milestone: "M9 (099cee10-562d-4e56-9a57-0dade2914760)", before: in_progress, after: in_progress}
roadmap_skip_reason: ""
readme_sections_touched: []
note: "4 M9 outreach-activity tasks marked done (11 done / 2 open). M9 NOT closed. Backlog-thin (2<3, 1 buildable) + stale-wave_id(1d95cac0=wave-18) + M9 _TBD-metric founder-poll flags carried to N-1/digest."
```
