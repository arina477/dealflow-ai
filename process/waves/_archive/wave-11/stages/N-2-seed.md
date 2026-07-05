# N-2 — Seed (wave 11 → wave 12)

Pick the next bundle under active milestone M6 (`a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc`). N-1 fired decomposition (Action 7); the bundle exists in the DB. N-2 identifies only; never writes status.

## Action 1 — Pick the seed
`SELECT ... WHERE milestone_id=M6 AND status='todo' AND wave_id IS NULL AND parent_task_id IS NULL ORDER BY created_at LIMIT 1`:
- **seed `07989285-7e64-4f26-a3de-1954ba89a5c7`** — "Build pipeline + pipeline_events spine + PipelineService (enroll + stage transitions)".
- Exactly one seed candidate (recount confirmed 1). No ambiguity, no re-order needed.

## Action 2 — Load siblings
`SELECT ... WHERE parent_task_id='07989285...' AND status='todo' AND wave_id IS NULL`:
- `d1940142-e962-48cd-b1eb-26d0c79e98dd` — "Ship pipeline board API + RBAC + interactive pipeline page"
- `45b259e1-d0d4-40b1-b09b-aeab25971700` — "Ship per-deal pipeline event timeline (notes + transition history, audited)"
- `bundled_sibling_ids` = [d1940142, 45b259e1].

## Action 3 — Validate the bundle (re-queried live DB, NOT taken on decomposer's word)
Per-row check on `[07989285, d1940142, 45b259e1]`:

| id | status | wave_id | milestone_id | parent_task_id | verdict |
|---|---|---|---|---|---|
| 07989285 (seed) | todo | NULL | a068dc3d (M6) | NULL | PASS |
| d1940142 (sib) | todo | NULL | a068dc3d (M6) | 07989285 | PASS |
| 45b259e1 (sib) | todo | NULL | a068dc3d (M6) | 07989285 | PASS |

Validation PASS. No concurrent-write race.

## Bundle-quality assessment (N-2 seed-pick checklist)
- **Vertical slice, not horizontal:** seed = DB spine (pipeline + pipeline_events) + PipelineService; sib-1 = board API + RBAC + interactive page; sib-2 = per-deal event timeline. All on the SAME pipeline module — DB→service→API→UI for ONE user workflow (advance a deal-target through pipeline stages). NOT a DB-only or API-only horizontal layer. PASS.
- **No ghost dependencies:** reads only already-shipped-and-live surfaces — `outreach` (send_eligible records, wave-11 live af5b5d9), match_run/match_candidates (wave-10 live 0075a20), mandates (wave-8), M2 audit-log (wave-4), M1 RBAC (wave-1). No unmerged-PR dep. PASS.
- **No credential/spend gate:** NO transactional-email SDK, NO email-provider key, NO webhook ingestion, NO Anthropic/LLM call, NO new spend, NO new external SDK. Buildable inline. PASS.
- **No dependency-deadlock bundling:** siblings extend the seed's persisted state (board/timeline READ + transition the seed's tables); no sibling requires a schema the seed hasn't authored. Coherent single-session build. PASS.
- **Sized for one session:** ~3,200 net LOC, ≤60 files, 1 seed + 2 siblings — within the P-1 rubric. PASS.
- **Compliance/audit posture:** every stage transition + event audited via M2 AuditService.append last-in-txn; RBAC via M1 RolesGuard. Consistent with compliance-first M6. PASS.

## Action 5 — Emit claimed_task_ids
`claimed_task_ids = [07989285-7e64-4f26-a3de-1954ba89a5c7, d1940142-e962-48cd-b1eb-26d0c79e98dd, 45b259e1-d0d4-40b1-b09b-aeab25971700]`. Propagates to N-3 handoff, wave-12 B-0 claim batch, wave-12 L-2 close batch.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 07989285-7e64-4f26-a3de-1954ba89a5c7"
  - "bundled siblings: 2"
  - "validation: pass"
seed_task_id: 07989285-7e64-4f26-a3de-1954ba89a5c7
seed_task_title: "Build pipeline + pipeline_events spine + PipelineService (enroll + stage transitions)"
bundled_sibling_ids:
  - d1940142-e962-48cd-b1eb-26d0c79e98dd
  - 45b259e1-d0d4-40b1-b09b-aeab25971700
claimed_task_ids:
  - 07989285-7e64-4f26-a3de-1954ba89a5c7
  - d1940142-e962-48cd-b1eb-26d0c79e98dd
  - 45b259e1-d0d4-40b1-b09b-aeab25971700
active_milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
queue_exhausted: false
validation_failed: false
note: "Clean vertical spine-bundle. No ghost deps, no credential/spend gate, no horizontal bundling."
```
