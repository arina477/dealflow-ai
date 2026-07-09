# N-3 — Handoff (wave-37 → wave-38)

Head-next N-block. Mode: automatic. Close wave-37, archive, hand off to wave-38 P-0.

## Actions

**Action 1 — next wave + loop state:** current wave = 37 → next = 38. Loop does NOT pause: N-2 produced a valid seed (`7f4d150b`); no queue-exhaustion; no ritual deferred to founder. `loop_state: ready`.

**Continue-vs-pause (rule 13):** none of the 4 measured pause triggers fire —
- (b) STATUS unchanged by another agent (stale RUNNING mirror; no other-agent write).
- (d) no hard-stop verdict / monitor wait / infra-readiness failure. DB reachable; L-2 verdict was PROCEED_TO_N.
- (e) no founder message this turn.
- (f) no `.loop-paused.yaml` present.
A clear, buildable, non-controversial infra seed exists → anticipatory pause is forbidden. **CONTINUE.** No `.loop-paused.yaml` written.

**Action 2 — pre-create wave-38 dir + checklist:** done (blocks P/D/B/C/T/V/L/N + stages; checklist pre-filled with seed `7f4d150b`, 0 siblings, milestone M7).

**Action 3 — this deliverable** written before the archive move.

**Action 4 — archive** `git mv process/waves/wave-37/ → _archive/wave-37/` + commit.

**Action 5a — close wave row:** `UPDATE waves SET status='ok' WHERE id=(running, wave_number DESC LIMIT 1)` → wave 37 (id `6ab4638c`). `ended_at` trigger-set.

**Action 5b — anchor** `.last-wave-completed.yaml` rewritten: last_wave 37, next_wave 38, seed 7f4d150b, loop_state ready.

## Tech-debt register (carried forward, not lost at merge)

- **Prod migrate-drift (RECONCILED for wave-37; ROOT FIX is the wave-38 seed):** migration `0021_self_serve_firm_bootstrap.sql` did NOT auto-apply on deploy despite `MIGRATE_DATABASE_URL` set; applied MANUALLY (commit e73e524). `rate_limit_hits` (0019) also un-applied → rate-limit degrades to in-process. The migrate-on-boot mechanism is broken → every future migration at risk. Tracked by seed `7f4d150b` (now the next wave).
- **DB task-state sync gap (process defect, not code):** the wave-37 claimed seed `6235baf7` was never flipped by B-0's claim-batch (`wave_id` stayed NULL) nor by L-2's Action-1 close (`status` stayed `todo`), though L-2 recorded it done. Reconciled at N-1. Root cause = the orchestrator's B-0/L-2 `UPDATE tasks` did not land in the DB; if it recurs, task-status will keep drifting from wave reality. Flag for the next L-block to verify its Action-1 UPDATE returns rows.
- **DEFAULT_WORKSPACE_ID fail-open fallback** (carried from wave-34; inert at 1 tenant; bind fail-closed before M11 opens).

No secrets/credentials/webhook secrets written to any archived doc.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: 38"
  - "next wave checklist: process/waves/wave-38/checklist.md"
  - "archive commit: <filled post-commit>"
  - "waves.status: wave 37 -> ok"
prev_wave: 37
next_wave: 38
loop_state: ready
seed_task_id: 7f4d150b-409f-4936-a09f-12fe46d5b90c
bundled_sibling_ids: []
claimed_task_ids: [7f4d150b-409f-4936-a09f-12fe46d5b90c]
active_milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
active_milestone_status: in_progress
state_transitions_applied_this_wave:
  - {milestone: M7, from: in_progress, to: in_progress}   # no transition; M7 stays in_progress
note: >
  wave-37 closed (status=ok). M7 stays in_progress (DKIM/SPF/DMARC sending-domain verify metric owed;
  4 open tasks). Next wave 38 seeds 7f4d150b (fix prod migrate-on-boot) — pilot-blocking infra fix,
  buildable now, no product/taste decision, automatic-mode CONTINUE. Migrate-drift tech-debt registered;
  0021 applied manually for wave-37, root fix is the wave-38 seed. Loop continues; not paused.

head_signoff:
  verdict: APPROVED
  stage: N-3
  reviewers: {}
  failed_checks: []
  rationale: >
    Wave archive is immutably consistent: L-2 APPROVED (PROCEED_TO_N), the shipped seed reconciled to
    done, context distilled into the archived L-block deliverables, tech-debt (migrate-drift + task-sync
    gap + fail-open fallback) explicitly registered so nothing is lost at merge, and no secrets leaked.
    No scope creep vs the wave-37 spec (feature merged as specified per B-6 + /review). Wave row closed
    last (after archive) per the FS-independent close contract. Next slot is a clean buildable seed under
    automatic mode with no measured pause trigger → CONTINUE. milestone_transition explicitly evaluated:
    M7 not closed (metric owed), M11/M12 not promoted (founder-held).
  next_action: PROCEED_TO_wave-38-P-0
```
