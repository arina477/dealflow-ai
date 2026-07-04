# N-3 — Handoff (wave 9 → wave 10)

**Head:** head-next. **Mode:** automatic.

## Actions

- **Action 1 — next wave + loop state:** next wave = 10. Loop NOT pausing (seed exists, no ritual pending-founder, no queue-exhaust). `loop_state: ready`.
- **Action 2 — pre-create wave-10:** `process/waves/wave-10/{blocks/{P,D,B,C,T,V,L,N},stages}` + checklist.md pre-filled (seed 47ed7ddd + 2 siblings, active milestone M5, pending P-0 flags).
- **Action 3 — this deliverable** written before the archive move.
- **Action 4 — archive:** `git mv process/waves/wave-9/ → process/waves/_archive/wave-9/` + commit.
- **Action 5a — close waves row:** UPDATE the running row (wave 9) → `status='ok'` (trigger sets ended_at).
- **Action 5b — write `.last-wave-completed.yaml`** handoff anchor.

## Archive-readiness verification (N-3 exit checklist)
- Context distilled: L-1 (CHANGELOG 0.9.0 + 5 observations) + L-2 (1 principle, DECISIONS in observations.md/L-2-distill.md), head-learn APPROVED. PASS.
- Tech debt registered: auth-hardening→M10 (security-debt flag), AppShell 404→M7, M5 wave-10 carry-forwards — all in product-decisions.md. PASS.
- Migration verified: 0008 additive, applied live @ C-2, mandate_id UNIQUE live-enforced. PASS.
- E2E via browser (not mocks): T-5 14/14 + C-2 live payoff in real headless-chromium post-hydration DOM. PASS.
- next_wave_seed cleared + milestone_transition evaluated: M4→done + M5→in_progress applied; seed handed to wave-10. PASS.
- No secret leaks: T-8 secret_grep_findings [], head-next heuristic scan on wave-9 artifacts clean. PASS.
- Exit criteria match seed, no unauthorized scope creep: V-1 Karen 0 drift, V-3 CLOSE, M4/M5 boundary byte-scan 0 leak. PASS.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 10"
  - "next wave checklist: process/waves/wave-10/checklist.md"
  - "archive commit: <see git log — chore: N-3 archive wave-9>"
prev_wave: 9
next_wave: 10
loop_state: ready
seed_task_id: 47ed7ddd-f384-490c-9529-6143dd4701da
bundled_sibling_ids:
  - fb82d339-27dd-4c5d-9819-9bf72e3baa9b
  - f74dce45-a644-4ffc-a931-44383fcebe24
claimed_task_ids:
  - 47ed7ddd-f384-490c-9529-6143dd4701da
  - fb82d339-27dd-4c5d-9819-9bf72e3baa9b
  - f74dce45-a644-4ffc-a931-44383fcebe24
active_milestone_id: d72b4510-0ddb-4cf6-b494-ccbaa64aa633
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - {milestone: M4 (c67b1610-9cc3-4cad-bcfa-1bee0573da72), from: in_progress, to: done}
  - {milestone: M5 (d72b4510-0ddb-4cf6-b494-ccbaa64aa633), from: todo, to: in_progress}
note: "M4 honestly closed (both metric halves live-verified); M5 promoted + first deterministic bundle seeded (no LLM/SDK/spend). LLM-rationale is a future M5 bundle; SDK+spend gated to wave-10 P-3/P-4 as non-blocking flags."
```
