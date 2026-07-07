# N-3 — Handoff (wave 18 close → wave 19 open)

## Action 1 — Next wave + loop state

Current wave = 18. Next wave = **19**. No pause trigger fires: N-2 produced a valid buildable bundle (`queue_exhausted: false`), no stockout/decomposition deferral to founder (decomposition completed inline under automatic mode), no `.loop-paused.yaml`/`.loop-resume.yaml`, no founder message, no STATUS change, no hard-stop verdict. **loop_state: ready** — counter increments to 19.

## Action 2 — Pre-create wave-19

Created `process/waves/wave-19/{stages,blocks/{P,D,B,C,T,V,L,N}}` + `checklist.md` seeded from the DISPATCHER template, pre-filled with seed `5568ad44` + 3 siblings, active milestone M9, and carry-forward notes (founder-gated pile-up).

## Action 3–4 — Archive

wave-18 tree archived in one `git mv` to `process/waves/_archive/wave-18/` + commit. Secret scan over the wave-18 tree before archive: **clean** (no api keys / private keys / bearer tokens / hardcoded passwords).

## Action 5 — Final state emission

- **5a. Wave-close:** `UPDATE waves SET status='ok'` on the running row (wave_number 18) — see note for RETURNING.
- **5b. `.last-wave-completed.yaml`** written with the handoff state + milestone snapshot + founder-pending carry.
- **status-check.yaml ledger reconciled:** was stale at wave-17/block-C-2 (head-learn flag) → updated to wave 19, block P, stage P-0, STATUS RUNNING.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 19"
  - "next wave checklist: process/waves/wave-19/checklist.md"
  - "archive commit: see chore: N-3 archive wave-18"
  - "wave 18 waves.status: ok"
  - "status-check ledger reconciled: wave-17/C-2 → wave-19/P-0 RUNNING"
prev_wave: 18
next_wave: 19
loop_state: ready
seed_task_id: 5568ad44-3702-46d5-809a-40c1de0a2035
bundled_sibling_ids:
  - 69387b56-2366-4343-809d-3a6e75129753
  - e206a56a-b98a-4533-b31e-ba91fae6327e
  - 077974a2-9be9-4a29-a13e-6ac1d7b78e35
claimed_task_ids:
  - 5568ad44-3702-46d5-809a-40c1de0a2035
  - 69387b56-2366-4343-809d-3a6e75129753
  - e206a56a-b98a-4533-b31e-ba91fae6327e
  - 077974a2-9be9-4a29-a13e-6ac1d7b78e35
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: "M9 stays in_progress (analytics half shipped; CRM + outreach/intent/feedback threads remain). Founder-gated pile-up: M5 LLM-spend, M6/M7 #141 email/sending-domain, M9 CRM vendor+API-key (345dfbc6). Loop continues on buildable feedback-loop seed."
```

## head_signoff (block-exit)

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers: {}
  failed_checks: []
  rationale: >
    Wave 18 archived immutably with no secret leak; wave row closed status='ok' AFTER the archive
    (order preserved so a failed archive can't prematurely mark ok). Context is distilled (L-1/L-2
    already landed; no raw-log rot carried). No scope creep — the seeded bundle matches the decomposer
    definition exactly. The stale status-check ledger (wave-17/C-2, head-learn flagged) is reconciled to
    the live state. Founder-gated debt is registered to the digest, not silently propagated. Loop state
    ready; handoff clean to wave 19 P-0.
  next_action: PROCEED_TO_wave-19_P-0
```
