# D-block — Soft gaps (deferred)

D-block-scoped soft gaps from dry run. If a gap turns out cross-block, lift to top-level `claudomat-brain/to-fix.md` (create on second cross-cutting deferral).

---

## Gap 1 — D-block re-entry idempotency check

**Issue.** D-block re-entry mid-wave (post-3-cap `bug-design` deferral, B-stage caught missed gap) lacks instruction to read `process/waves/wave-<N>/checklist.md` for already-complete stages. Risk: re-running completed stages.

**Defer to.** `claudomat-brain/setup-tools/install.md` or future cross-block re-entry rule — pattern affects every block.

**Fix trigger.** First block needing explicit re-entry semantics (likely B-block fast-fix V-3 → B re-entry).

---

## Gap 2 — P-3 plan format / UI surface list specification

**Issue.** D-1 Action 1 greps `design/` for plan-referenced surfaces, assuming `process/waves/wave-<N>/stages/P-3-plan.md` enumerates UI surfaces in greppable form. P-3's deliverable spec doesn't pin a format.

**Defer to.** P-3 stage tightening at next P-block revision. Fix belongs in P-3.

**Fix trigger.** Next P-block revision OR first wave where D-1 audit produces false negative due to plan format ambiguity.

---

## Gap 3 — Spec contract design-follow-up claim mechanism

**Issue.** D-1 Action 1 needs to know which prior-wave design follow-up tasks are claimed by this wave's spec contract. With bug-tagging gone, the link is the spec-contract YAML head's `claimed_task_ids` list (read from the primary task's `description` prose head, per `claudomat-brain/db/SCHEMA.md` § tasks carve-out 2). D-1 reads the list and joins `SELECT * FROM tasks WHERE id = ANY($claimed_task_ids)` — no tag matching, no noise. If a wave fails to enumerate design follow-ups in `claimed_task_ids` despite touching the same surface, that's a P-2 authoring defect surfaced at V-2 triage.

**Defer to.** P-2 authoring discipline; no schema change required.

**Fix trigger.** First wave where a design follow-up task overlaps the wave's surface but isn't enumerated in the spec's `claimed_task_ids`.

---

## Gap 9 — Separate DESIGN-SYSTEM.md mutation signoff field

**Issue.** D-3 Action 5 requires Phase 1 head-designer verdict rationale to explicitly bless token addition. Footer carries `mask_mode_signoff: PASS` (whole deliverable) and `design_system_tokens_added: []` (list, not approval) — if gate-verdict didn't address a token but orchestrator added it, decisions are lumped.

**Defer to.** D-3 footer schema revision if DESIGN-SYSTEM.md drift observed in practice.

**Fix trigger.** First wave where DESIGN-SYSTEM.md token addition should not have been approved, traced to ambiguous signoff coverage.
