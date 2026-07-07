# N-3 — Handoff (wave-24 close → wave-25 open)

head-next gated APPROVED. Mode: automatic. No pause trigger fired (checked b/d/e/f: no STATUS change by another agent, no hard-stop verdict, no founder message, no `.loop-paused.yaml`). loop_state: ready.

## Action 1 — Next wave + loop state

Next wave = **25**. Loop does NOT pause: N-2 emitted a valid seed (`queue_exhausted: false`); no stockout/decomposition deferred to founder. `loop_state: ready`.

## Action 2 — Pre-created wave-25 dir + checklist

`process/waves/wave-25/{blocks/{P,D,B,C,T,V,L,N},stages}` created. `process/waves/wave-25/checklist.md` written — wave 25, seed `6fe232e3`, siblings [], active milestone M10, downstream T-8 + P-4 security-gate flags, integrity tripwire recorded.

## Action 4 — Archive

`git mv process/waves/wave-24 → process/waves/_archive/wave-24` + committed (SHA recorded in .last-wave-completed.yaml).

## Action 5a — Wave-close (DB)

`UPDATE waves SET status='ok' WHERE wave_number=24` (was `running`). `set_wave_ended_at()` trigger auto-set `ended_at`. RETURNING confirmed wave_number=24.

## Action 5b — Loop-handoff anchor

`process/session/.last-wave-completed.yaml` written: next_wave 25, seed 6fe232e3, siblings [], claimed [6fe232e3], M10 in_progress, no state transitions this wave, loop_state ready.

## Milestone-state snapshot

- M10 `033f97e0` stays `in_progress`. milestone_transition = **NONE**.
- No promotion, no closure, no decomposition this N-block.
- Carried flags (founder digest): FLAG(a) M10 recordkeeping-decomposition DUE-next; FLAG(b) M10 _TBD metric poll (batch w/ M9). Tripwire: wave-26 flips to Option B if debt/hardening-only + recordkeeping unfired.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 25"
  - "next wave checklist: process/waves/wave-25/checklist.md"
  - "archive commit: see .last-wave-completed.yaml (git mv wave-24 → _archive/wave-24)"
  - "waves.status: wave 24 running → ok (RETURNING wave_number=24)"
prev_wave: 24
next_wave: 25
loop_state: ready
seed_task_id: 6fe232e3-c639-4f6c-ad66-2889df8d9717
bundled_sibling_ids: []
claimed_task_ids: [6fe232e3-c639-4f6c-ad66-2889df8d9717]
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: "milestone_transition NONE (M10 stays in_progress). Archive secret-scan clean. Tech debt registered in L-2 held_next_wave (OBS-W24-2 guard-self-test, readTail-RLS-exempt, NaN-seed, actions-minutes). jenny 0 spec-drift. Integrity tripwire set for wave-26 N-1."
head_signoff:
  verdict: APPROVED
  stage: N-3-handoff
  reviewers: {}
  failed_checks: []
  rationale: "Context distilled (L-1 APPROVED, L-2 COMPLETE, V-1 dual-APPROVE). Tech debt registered. No scope creep (jenny 0 DRIFTS). No secrets in archive. Wave 24 closed status=ok; M10 stays in_progress; handoff to wave-25 P-0."
  next_action: PROCEED_TO_wave-25_P-0
```
