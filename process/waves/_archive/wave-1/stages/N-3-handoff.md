# N-3 — Handoff (wave 1)

Final stage of the wave-1 loop: increment counter, archive the wave, close the wave row, emit readiness state for wave-2 P-0. Mode: **automatic**.

## Actions

- **Action 1 — Next wave + loop state:** current wave = 1 → next = **2**. NOT pausing: N-2 emitted a valid seed (`queue_exhausted=false`), no ritual deferred to founder (decomposition completed inline under automatic). `loop_state: ready`.
- **Action 2 — Pre-create wave-2:** `process/waves/wave-2/{blocks/{P,D,B,C,T,V,L,N},stages}` created; `process/waves/wave-2/checklist.md` written (wave 2, active milestone M1, seed + siblings + claimed_task_ids pre-filled).
- **Action 3 — This deliverable** written before the archive move.
- **Action 4 — Archive:** `git mv process/waves/wave-1/ process/waves/_archive/wave-1/` + commit (see `archive_commit` below).
- **Action 5a — Close wave row:** `UPDATE waves SET status='ok'` on the running row `c086d358-e754-4982-b427-1f0f3a9adf11` (wave_number 1). Run AFTER archive.
- **Action 5b — Handoff anchor:** `process/session/.last-wave-completed.yaml` overwritten with handoff state.

## Milestone state machine snapshot

- M1 (`2c79236a-…`): `todo → in_progress` this wave (promotion — greenfield never-promoted artifact resolved). Remains **in_progress** (scope not shipped). `milestone_transition` evaluated = **no closure**; M1 stays the active milestone for wave 2.
- Decomposition authored the auth vertical slice bundle under M1 (seed e15f71dd + siblings e1c0e81e, af6cbc59) → becomes wave-2's work.

## Tech-debt / follow-up register (carried forward, not lost)

- `bfadcec1` — Tighten test-fixture typing in wave-1 health tests (M1, wave-1 V-2 follow-up, still todo).
- Unassigned queue (2): `fa23349a` (Install Playwright Chrome on host before first real UI wave — **relevant to wave-2's auth-screen E2E**), `b1a0b2ac` (Tighten /health spec wording). To be walked by wave-2 P-0's unassigned-queue assignment.
- Decomposition-deferred M1 scope: AppShell chrome, role-aware dashboard shell, full per-route RBAC enforcement → future M1 bundle.

## Archive-readiness (N-3 checklist)

- Wave-1 context is already distilled into per-stage deliverables + L-1/L-2 (STATE/DECISIONS equivalents present); no raw-log bloat carried forward.
- No secrets in docs — SuperTokens (`SUPERTOKENS_*`) / `DATABASE_URL` referenced as env-var NAMES only in the seed/decision log; no values.
- Wave-1 final merge (4cad017) matches the original scaffold+CI seed — no unauthorized scope creep.
- `next_wave_seed_task` set to the new seed; `milestone_transition` explicitly = no closure.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 2"
  - "next wave checklist: process/waves/wave-2/checklist.md"
  - "archive commit: <recorded post-move below>"
  - "waves row c086d358 closed: status=ok (wave_number 1 returned)"
prev_wave: 1
next_wave: 2
loop_state: ready
seed_task_id: e15f71dd-8f61-441c-904a-bdfa108bd6e1
bundled_sibling_ids: [e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]
claimed_task_ids: [e15f71dd-8f61-441c-904a-bdfa108bd6e1, e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]
active_milestone_id: 2c79236a-ffc0-43e2-b406-a5aa56413882
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - {milestone: "M1 (2c79236a)", from: todo, to: in_progress}
head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers: {}
  failed_checks: []
  rationale: >
    Wave-1 archived intact; context already distilled (no raw-log propagation); tech-
    debt/follow-ups registered (bfadcec1 + 2 unassigned + decomposition-deferred M1
    scope); no secrets leaked (env-var names only); wave-1 merge matches the seed (no
    scope creep). next_wave_seed_task set to e15f71dd; milestone_transition explicitly
    evaluated = no closure (M1 stays in_progress). Wave row c086d358 closed status=ok.
  next_action: PROCEED_TO_wave-2_P-0
note: "Archive commit SHA recorded in the return summary; DB close runs after the git mv per Action 5 ordering."
```
