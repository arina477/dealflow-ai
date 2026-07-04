# N-3 — Handoff (wave 6 → wave 7)

Increment the wave counter, archive wave 6, close the wave row, emit readiness for wave-7 P-0.

## Action 1 — Next wave + loop state

Current wave `6` → next wave **`7`**. No pause condition holds: N-2 found a valid bundle (`queue_exhausted: false`), no stockout cascade, no founder-deferred ritual (automatic mode, decomposition ran inline). `loop_state: ready`.

## Action 2 — Wave-7 directory + checklist

Created `process/waves/wave-7/{blocks/{P,D,B,C,T,V,L,N},stages}` + `process/waves/wave-7/checklist.md` pre-filled with wave number 7, seed `dfa5bd56...`, sibling `345dfbc6...`, active milestone M3, and P-0 pending-ritual notes (mvp-thinner runs — M3 product-feature; D-block runs — UI wave; P-3 external-SDK research + spend-gate + MONITOR: for the real-adapter sibling).

## Action 4 — Archive

`git mv process/waves/wave-6/ process/waves/_archive/wave-6/` + commit (SHA recorded in `.last-wave-completed.yaml` / final handoff).

## Action 5 — Final emission

**5a. Close wave row (after archive):** `UPDATE waves SET status='ok'` on the `running` row (wave_number 6, id `ab074500-9825-46e8-a3f3-569e94eb5350`) → `RETURNING wave_number` = 6. Trigger auto-sets `ended_at`.

**5b. Loop-handoff anchor:** `process/session/.last-wave-completed.yaml` overwritten with the wave-7 handoff state below.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 7"
  - "next wave checklist: process/waves/wave-7/checklist.md"
  - "archive commit: recorded in .last-wave-completed.yaml (chore: N-3 archive wave-6 + seed wave-7)"
prev_wave: 6
next_wave: 7
loop_state: ready
seed_task_id: dfa5bd56-0c7e-46ed-830f-9c35e5bfd471
bundled_sibling_ids: [345dfbc6-1c96-4f6a-98aa-12ac7d61794b]
claimed_task_ids: [dfa5bd56-0c7e-46ed-830f-9c35e5bfd471, 345dfbc6-1c96-4f6a-98aa-12ac7d61794b]
active_milestone_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: "M3 stays in_progress (no milestone close, no M4 promotion). Wave 7 = M3 next bundle: sourcing-workspace entry page (seed) + first real DataSourceAdapter (sibling) — completes the M3 success metric end-to-end. Wave-6 row (ab074500) closed status=ok."
```

## Exit
→ DISPATCHER → wave-7 P-0. Wave-7 `waves` row is P-0 Action 0a's INSERT.
