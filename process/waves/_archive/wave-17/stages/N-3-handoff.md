# N-3 — Handoff (wave 17)

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 18"
  - "next wave checklist: process/waves/wave-18/checklist.md"
  - "archive commit: see chore: N-3 archive wave-17"
  - "waves row 17 closed status='ok' (RETURNING wave_number=17)"
  - "secret scan: clean (dealflow_app password Railway-env-only, never committed; no literal secret in archive)"
prev_wave: 17
next_wave: 18
loop_state: ready
seed_task_id: a5ba8068-2e1b-48ea-83d9-6da739a41e2b
bundled_sibling_ids:
  - 9e05828b-38dd-475c-9f82-cd5ac4565fff
  - 4b014689-8e12-4560-95c9-5b0ae4d2f4fc
claimed_task_ids:
  - a5ba8068-2e1b-48ea-83d9-6da739a41e2b
  - 9e05828b-38dd-475c-9f82-cd5ac4565fff
  - 4b014689-8e12-4560-95c9-5b0ae4d2f4fc
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760   # M9 — Integrations & insight
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - {milestone: "M8 (9ed98c3c)", from: in_progress, to: done}
  - {milestone: "M9 (099cee10)", from: todo, to: in_progress}
note: >
  Wave 17 shipped M8 pilot-partner data isolation (deny-by-default workspace-scoped FORCE RLS, live @591b3f8,
  verified as the non-superuser dealflow_app role). BOARD (7/7 APPROVE-A, 0 HARD-STOP, strict Tier-3 bar cleared)
  disposed M8 done on its written pilot scope; the 3 open follow-ups were re-homed before close (GAP-2 write-path
  fail-closed → M11 as a BLOCKING multi-tenant pre-req; GAP-4 populated-DB migration AC + GAP-5 RLS connection-split
  doc → M10). M9 promoted; its first bundle is a buildable, credential-free analytics/insights vertical (seed
  a5ba8068 + shared-Zod API sibling + /insights page sibling). The pre-existing M9 task 345dfbc6 (first real
  DataSourceAdapter) is a founder VENDOR spend-decision + account-issued-credential hard-stop — left queued under
  M9, NOT seeded, surfaced to the founder digest. Wave-17 code is already ON main (direct-push C-1 mechanism);
  git clean apart from expected N-block additions. loop_state ready — no measured pause trigger (b/d/e/f) fired.
```
