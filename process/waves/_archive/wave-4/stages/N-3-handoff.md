# N-3 — Handoff (wave 4 → wave 5)

Final stage of the wave-4 loop. Not pausing (seed exists, no stockout, no founder-deferred ritual under `automatic`).

## Actions

- **Action 1 — next wave + loop state:** next wave = **5**. No pause condition (N-2 `queue_exhausted: false`; no strict-mode founder defer). `loop_state: ready`.
- **Action 2 — pre-create wave-5:** `process/waves/wave-5/{blocks/{P,D,B,C,T,V,L,N},stages}` + `checklist.md` created, pre-filled with seed 0595a835, siblings, active milestone M2, and the wave-5 P-4 security-scope-tightened + SoD/RBAC gate flag.
- **Action 3 — this deliverable** written before Action 4 archive.
- **Action 4 — archive:** `git mv process/waves/wave-4/ → process/waves/_archive/wave-4/` (single move) + commit. product-decisions.md (N-1 decomposition append) committed in the same commit.
- **Action 5a — close wave row:** `UPDATE waves SET status='ok'` on the running row (wave_number 4, id 71dddb0b-5a10-41d6-9d08-2349d4995136). `set_wave_ended_at()` trigger auto-sets `ended_at`. Runs AFTER archive.
- **Action 5b — loop-handoff anchor:** `process/session/.last-wave-completed.yaml` overwritten with the handoff state below.

## Milestone state snapshot

- M2 `2f116b9b-0338-421d-a9ad-899a11403aff` — `in_progress` (unchanged; no transition this wave). Audit-log half shipped (4 done); rules-engine + pre-send-gate half is the wave-5 bundle.
- No milestone status transitions applied in wave 4's N-block.

## Head-next gate — N-3 stage-exit checklist

- Raw logs compacted into DECISIONS/observations — PASS (L-1/L-2 already distilled; N-block adds no raw log).
- Architectural compromise / deferred req logged as tech debt — PASS (rules-engine deferral was tracked from wave-4 spec; now converted into the wave-5 bundle rather than lost).
- New migrations verified vs platform config — PASS (wave-4 migration 0002 applied LIVE, verified at C-2; no new migration in N-block).
- End-to-end functionality via real browser — PASS (wave-4 T-5 7/7 real-browser; C-2 live chain-verify).
- `next_wave_seed_task` set + `milestone_transition` explicitly evaluated — PASS (seed 0595a835; transition = none, M2 stays in_progress).
- No plaintext secrets written to docs during archival — PASS (decomposer briefed to keep secrets out; product-decisions append + deliverables contain none).
- Completed wave exit criteria match original seed, no scope creep — PASS (wave-4 shipped exactly the audit-log backbone; rules engine correctly NOT smuggled into wave 4).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 5"
  - "next wave checklist: process/waves/wave-5/checklist.md"
  - "archive commit: see git log (chore: N-3 archive wave-4 + seed wave-5)"
prev_wave: 4
next_wave: 5
loop_state: ready
seed_task_id: 0595a835-db62-4685-b451-1cd6c06416bf
bundled_sibling_ids:
  - 95adac6c-25cb-4c67-bd78-a401477143ad
  - 034463b1-7abb-4417-8e34-7f6184a0c8db
  - 34cb1d18-9bff-4302-8f7e-c508ac5fef99
claimed_task_ids:
  - 0595a835-db62-4685-b451-1cd6c06416bf
  - 95adac6c-25cb-4c67-bd78-a401477143ad
  - 034463b1-7abb-4417-8e34-7f6184a0c8db
  - 34cb1d18-9bff-4302-8f7e-c508ac5fef99
active_milestone_id: 2f116b9b-0338-421d-a9ad-899a11403aff
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: "Wave 4 shipped M2's audit-log backbone (LIVE cd06e8a). M2 stays in_progress; wave 5 seeds M2's rules-engine + non-bypassable pre-send-gate half. Compliance-critical → wave-5 P-4 security-scope-tightened + SoD/RBAC gate expected."

head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers: {}
  failed_checks: []
  rationale: "Wave 4 archived immutably as a single move; wave-4 waves row closed status=ok (ended_at trigger-set). Milestone state snapshot correct: M2 stays in_progress, no transition, rules-engine half handed to wave 5 as a validated vertical-slice bundle. No context rot carried forward (L-2 already distilled), no scope creep into wave 4, no secrets in archived docs. Loop ready for wave-5 P-0."
  next_action: PROCEED_TO_wave-5-P-0
```
