# N-3 — Handoff (wave-26)

## Action 1 — next wave number + loop state

Current wave `26`. Next would be `27`. **Loop PAUSES:** N-2 emitted `queue_exhausted: true` AND no ritual is in-flight that will produce work (N-1 decomposition already fired and returned `incomplete-scope`; the unblock is a founder-reserved product decision, not an in-flight ritual). Do NOT increment the wave counter; do NOT pre-create wave-27.

This is a MEASURED pause, not anticipatory:
- **Trigger (f):** `process/session/.loop-paused.yaml` written this stage (`decomposition-pending-founder`).
- **Trigger (d) hard-stop:** the milestone-decomposition ritual's `incomplete-scope` refusal is a stage-internal hard-stop (no legal seed exists; the loop cannot advance).
- Cited in `pause_evidence` per rule 13 / automatic-mode § pause_evidence, trigger `f` (highest applicable file marker), with the decomposition hard-stop listed in `measurement`.

## Action 2 — pause marker (NOT next-wave dir)

Wrote `process/session/.loop-paused.yaml` (`paused_reason: decomposition-pending-founder`). Resume side (`.loop-resume.yaml`) is worker-owned — N-3 never writes it.

## Action 3 — this deliverable (written before Action 4 archive).

## Action 4 — archive wave-26 (single git mv + commit).

## Action 5 — final state emission

- **5a. Close wave row:** `UPDATE waves SET status='ok' WHERE id=(SELECT id FROM waves WHERE status='running' ORDER BY wave_number DESC LIMIT 1) RETURNING wave_number;` → wave 26. The current wave completed (V-block APPROVED, shipped LIVE); the loop pauses AFTER close — `'ok'` is correct even on a pausing emission.
- **5b. Rewrote `.last-wave-completed.yaml`:** `last_wave: 26`, `next_wave: paused`, `loop_state: paused`, active milestone M10 `in_progress` (no state transition this wave).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: paused (decomposition-pending-founder — M10 _TBD success metric)"
  - "pause marker: process/session/.loop-paused.yaml"
  - "archive commit: see wave-26 archive commit"
  - "wave 26 close: waves.status=ok (RETURNING wave_number=26)"
prev_wave: 26
next_wave: paused
loop_state: paused
seed_task_id: null
bundled_sibling_ids: []
claimed_task_ids: []
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: >
  Enforced founder-pause (wave-25 BOARD 7/7 disposition c). Wave 26 (M10 FINAL hardening —
  RLS connection-split) closed status=ok and archived. M10 stays in_progress: open=0 but scope
  NOT shipped (0/4 SOX/FINRA verticals implemented) + _TBD success metric → no mechanical close.
  Decomposition REFUSED (incomplete-scope, _TBD). Loop paused; founder M10 recordkeeping direction
  surfaced to the digest. Mode flag intact (automatic) — pause via .loop-paused.yaml + STATUS BLOCKED,
  not a mode change.
```
