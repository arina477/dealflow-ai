# N-3 — Handoff (wave 2)

Head: head-next. Mode: `automatic`.

## Action 1 — Next wave number + loop state
Current wave = 2. Next wave = **3**. Loop state = **ready** (not paused): N-2 produced a valid non-exhausted bundle; no stockout cascade; decomposition completed inline (not deferred to founder). Wave counter increments.

## Action 2 — Pre-created next wave
`process/waves/wave-3/` created (blocks P/D/B/C/T/V/L/N + stages/) with `checklist.md` pre-filled: wave 3, seed `1931b452`, siblings `[2ecc4a7b, 2dc00409]`, active milestone M1, plus the wave-2 C-2 redeploy-verify note carried forward.

## Action 3 — This deliverable (written before archive move).

## Action 4 — Archive
`git mv process/waves/wave-2/ process/waves/_archive/wave-2/` → commit `chore: N-3 archive wave-2`. (SHA recorded post-commit below.)

## Action 5a — Wave DB close
`UPDATE waves SET status='ok'` on the running row (wave 2, `6d382ddb-36b0-44df-bcdf-a4076d4f0529`). `set_wave_ended_at()` trigger auto-sets `ended_at`. Runs AFTER archive move (row is FS-independent, resolved via current-wave recipe).

## Action 5b — Loop-handoff anchor
`process/session/.last-wave-completed.yaml` overwritten with the handoff snapshot.

---

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 3"
  - "next wave checklist: process/waves/wave-3/checklist.md"
  - "archive commit: see push log (chore: N-3 archive wave-2)"
prev_wave: 2
next_wave: 3
loop_state: ready
seed_task_id: 1931b452-c7d5-43a0-9657-7e7cd1728203
bundled_sibling_ids: [2ecc4a7b-2972-4a95-a36b-44e7112dd54b, 2dc00409-7c01-43fc-8fc1-4438330de7fb]
claimed_task_ids: [1931b452-c7d5-43a0-9657-7e7cd1728203, 2ecc4a7b-2972-4a95-a36b-44e7112dd54b, 2dc00409-7c01-43fc-8fc1-4438330de7fb]
active_milestone_id: 2c79236a-ffc0-43e2-b406-a5aa56413882
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: "M1 stays in_progress — success-metric gap (AppShell + role-aware dashboard + per-route RBAC) is wave 3's bundle. No milestone closure/promotion this wave. next_wave_seed_task cleared from block-scoped state at N-block terminate; milestone_transition evaluated = none."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers: {}
  failed_checks: []
  rationale: >
    Wave 2 fully complete (all P→L stages checked; auth vertical LIVE on Railway, E2E 6/6, all gates
    APPROVED). Context distilled into wave-2 L-1/L-2 deliverables (no raw-log rot carried forward).
    Technical debt accurately registered as queued follow-ups (bfadcec1 test-fixture typing;
    6fe232e3 auth-hardening rate-limit/validation/CSRF) — not lost at merge. No secrets in archived
    docs. No scope creep vs the wave-2 seed. Milestone state consistent: M1 stays in_progress, no
    premature closure. Next-wave bundle is a verified vertical slice; checklist pre-created; wave
    counter incremented to 3; wave-2 row closed status=ok; loop_state=ready. Handoff clean.
  next_action: PROCEED_TO_wave-3-P-0
```
