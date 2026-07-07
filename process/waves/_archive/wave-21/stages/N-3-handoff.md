# N-3 — Handoff (wave-21 → wave-22)

## Action 1 — Next wave number + loop state

Current wave = 21. Next wave = **22**. Loop state = **ready** (no pause condition: N-2 emitted a valid seed, no ritual deferred to founder, no stockout).

## Action 2 — Pre-created next-wave directory + checklist

- `process/waves/wave-22/blocks/{P,D,B,C,T,V,L,N}` + `stages/` created.
- `process/waves/wave-22/checklist.md` written: seed `02f4e6a1`, 0 siblings, active milestone M9, carry-forward notes (seller-intent → wave-23, P-2 site-count reconcile, founder-gated pile-up, M9 _TBD metric, tech-debt holds).

## Action 3 — This deliverable (written before archive move).

## Action 4 — Archive

`git mv process/waves/wave-21/ process/waves/_archive/wave-21/` + commit `chore: N-3 archive wave-21`. Secret-scan over wave-21 tree before archive: **clean** (no API keys / private keys / bearer tokens / hardcoded passwords / DSN-with-password; only base64-looking match was a git commit SHA in a health-check payload).

## Action 5 — Final state emission

- **5a. DB wave-close:** `UPDATE waves SET status='ok'` on the current `running` row (wave 21). See note field for RETURNING result.
- **5b. FS handoff anchor:** `process/session/.last-wave-completed.yaml` overwritten with the wave-21→22 snapshot.

Also reconciled `process/session/status-check.yaml` → `current_wave: 22`, `current_block: P`, `current_stage: P-0-frame`, `STATUS: RUNNING` (cross-wave transition; no b/d/e/f pause trigger fired).

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 22"
  - "next wave checklist: process/waves/wave-22/checklist.md"
  - "archive commit: see git log (chore: N-3 archive wave-21)"
  - "waves.status wave-21 → ok (RETURNING wave_number=21)"
prev_wave: 21
next_wave: 22
loop_state: ready
seed_task_id: 02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762
bundled_sibling_ids: []
claimed_task_ids:
  - 02f4e6a1-4b67-4bb1-80e8-ac1d3be3f762
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: "M9 stays in_progress (no closure — open_count=2; no promotion — slot occupied). Seed 02f4e6a1 = single-task test-hygiene fix-forward; seller-intent = wave-23 seed. head-next APPROVED. Loop continues to wave-22 P-0."
```
