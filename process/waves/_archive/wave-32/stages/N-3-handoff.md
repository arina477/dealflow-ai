# Wave 32 — N-3 Handoff

**Block:** N (Next) | **Stage:** N-3 | **Mode:** automatic | **Gate agent:** head-next (block-exit)

## Actions

### Action 1 — Next wave number + loop state → PAUSED
N-2 emitted `queue_exhausted: true` with no ritual in-flight that will produce work (next-slot BOARD returned APPROVE-PAUSE; decomposition could not fire; no roadmap-planning). → **Loop pauses.** Do NOT increment the wave counter; do NOT pre-create wave-33.

### Action 2 — Pause marker (not next-wave dir)
`process/session/.loop-paused.yaml` written (`paused_reason: scope-exhausted-pending-founder`). wave-33 dir intentionally NOT created (P-0 must not spin on nothing). Resume counterpart (`.loop-resume.yaml`) is worker-written on founder answer; brain consumes at DISPATCHER step 0.

### Action 3 — This deliverable (written before Action 4 archive).

### Action 4 — Archive wave-32 → `git mv process/waves/wave-32/ process/waves/_archive/wave-32/` + commit.

### Action 5 — Final state emission
- **5a. DB wave-close:** `UPDATE waves SET status='ok' WHERE id=(SELECT id FROM waves WHERE status='running' ORDER BY wave_number DESC LIMIT 1) RETURNING wave_number;` → expect `32`. Trigger auto-sets `ended_at`. `'ok'` is correct for a pause emission (the wave still completed).
- **5b. `.last-wave-completed.yaml`:** last_wave 32, next_wave paused, seed null, M9 in_progress, loop_state paused.

## Milestone-state snapshot
- **M9** (`099cee10`): in_progress — held (cannot close: `_TBD` metric + nothing live-verified). No transition this wave.
- No promotion, no closure, no decomposition. Self-host DEPLOY PACKAGE shipped to main; LIVE stand-up founder-infra-gated.

## Deliverable

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: paused"
  - "archive commit: <see chore: N-3 archive wave-32>"
  - "waves.status: 32 → ok (ended_at trigger-set; 0 running remain)"
prev_wave: 32
next_wave: paused
loop_state: paused
seed_task_id: null
bundled_sibling_ids: []
claimed_task_ids: []
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - none
note: >
  4th consecutive founder-gated wave boundary. Wave-32 shipped the M9 self-host Twenty deploy
  package (B-6 APPROVED, secret-free, on main; no app-code change). LIVE stand-up founder-gated
  on infra provisioning. Loop PAUSED (scope-exhausted-pending-founder) per next-slot BOARD 7/7
  APPROVE-PAUSE. STATUS BLOCKED. Mode flag intact (automatic). Founder ask surfaced (#1 turnkey
  stand-up with concrete consents / #2 set M11+M12 metrics / #3 roadmap-refresh / standing CI fix).

head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers: {board: "7/7 APPROVE-PAUSE"}
  failed_checks: []
  rationale: >
    Block-exit gate. Wave-32 is immutably consistent: all P→L stages complete (B-6 APPROVED
    after the pgvector rework — independently verified on disk + in the commit trail; C/T/V/L
    legitimately streamlined-N/A for an infra-package wave with no app-code change, honestly
    documented in CTVL-infra-closeout.md, not done-theater). No secret leaked into repo docs
    (B-6 leak scan clean; independently reconfirmed). No scope creep (adapter byte-identical
    to wave-31). Context distilled (no raw-log bloat). Tech debt registered: task 2867d087
    (M11 write-path fail-open) surfaced to the founder packet as a MUST-fix-before-2nd-tenant
    gate rather than buried; ops-burden of self-hosting flagged. next_wave_seed_task cleared;
    milestone_transition evaluated (M9 held, not force-closed). Wave closed status=ok, archived.
    The pause is measured (scope exhaustion at a wave boundary after wave-32 completed), NOT
    anticipatory. Every N-3 exit checkbox ticks.
  next_action: ESCALATE_TO_founder   # loop paused; founder decides next slot
```
