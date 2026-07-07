# Wave 20 — N-1 Survey & triggers

## Survey signals (Actions 1–4)

- **Action 1 — Active milestone:** M9 — Integrations & insight (`099cee10-562d-4e56-9a57-0dade2914760`, `in_progress`). Exactly one `in_progress` row — no invariant violation.
- **Action 2 — todo queue (created_at order):** M10 Advanced compliance & recordkeeping (`033f97e0`), M11 Multi-tenant SaaS + billing (`4636e74e`), M12 Deal network & predictive (`ede6e8a2`). `next_todo_id` = M10.
- **Action 3 — M9 child summary:** open=2, done=11, seed_candidates=1 (pre-fix the count was misleading; see housekeeping). The one genuine unparented `todo`/`wave_id NULL` candidate at survey time was `345dfbc6` (founder-gated CRM). `1d95cac0` did NOT count because it carried a stale non-null `wave_id`.
- **Action 4 — Unassigned queue depth:** 1.

## N-1 housekeeping (data fix)

- **DATA FIX (stale wave_id):** task `1d95cac0` (Spec-authoring + test-fixture process hardening) carried a stale `wave_id=0f32f35c` (= wave-18, status `ok`) — a leftover flagged the last two waves. `UPDATE tasks SET wave_id=NULL WHERE id='1d95cac0-...'` → **applied (UPDATE 1)**, verified `wave_id` now NULL. It is a claimable backlog seed candidate again under M9.

## Trigger phase (Actions 6–10)

### M9 `## Scope` disposition (Action 6/7 judgment)

M9 `## Scope` names five threads:
1. **CRM integration adapters** (Salesforce/DealCloud/Affinity) → FOUNDER-GATED (task `345dfbc6`: vendor spend + account-issued API key). Not credential-free.
2. **Advanced analytics & reporting** → SHIPPED (wave-18 /insights).
3. **Multi-channel outreach (LinkedIn/phone tasks)** → SHIPPED (wave-20 internal outreach-activity tracker, LIVE @86ddc29).
4. **Seller intent signals** → NOT YET BUILT; buildable credential-free over existing internal data (outreach_activity + mandate velocity + wave-19 accept/reject calibration). **The remaining buildable thread.**
5. **Matching feedback loop** → SHIPPED (wave-19 calibration, LIVE @3cc58de).

**Closure (Action 6):** NOT closure-eligible. `open_count > 0` and `## Scope` is not shipped (seller-intent remains + founder-gated CRM). M9 stays `in_progress`.

**Promotion (Action 8):** NONE. Active slot is occupied by M9 (which is NOT scope-exhausted). Promoting M10 would require illegally parking a non-exhausted `in_progress` milestone (roadmap-lifecycle invariant 2: promotion requires prior active `done`/`cancelled`). Correct call: no promotion; M10 waits.

### Decomposition (Action 7) — fired, then correctly refused; disposition adjusted

- **Fired** milestone-decomposition (automatic mode → spawned `milestone-decomposer` inline, `next-bundle`) targeting the seller-intent thread with a credential-free / RLS / audit / vertical-slice guard set.
- **Decomposer returned `validation-failed`** at Step 1 condition 4: `next-bundle` requires **0** existing seed candidates, but after the data-fix M9 had **2** unparented `todo`/`wave_id NULL` candidates (`345dfbc6` gated + `1d95cac0` rehomed). Authoring a parallel bundle is a no-op by ritual contract. **No DB writes made by the decomposer** — correct refusal (governance catch, not a reasoning failure).
- **Resolution (head-next disposition):** drove M9's seed-candidate count down cleanly:
  - `345dfbc6` (CRM adapter) → **`status='blocked'`** (legal off-path "external hold" per roadmap-lifecycle: founder vendor-spend + account-issued API key; not autonomously completable). Appended `## Blocked reason` prose. Drops out of the seed predicate; stays surfaced in the founder digest.
  - `1d95cac0` (process hardening) → left `todo`, now the **sole** unparented seed candidate. Buildable, credential-free, already authored/vetted (V-1 jenny GAP-B/C/D/E).
- **Seller-intent** is now the clear **wave-22** seed: once `1d95cac0` is claimed at B-0 (its `wave_id` set, dropping it from the predicate), M9's seed-candidate count hits 0 and wave-22 N-1 legitimately re-fires the decomposer for the seller-intent vertical slice.

### Daily-checkpoint (Action 9)

NOT fired: a seed candidate exists (`1d95cac0`) → the checkpoint trigger's "no seed candidate" precondition is not met.

### Ritual routing (Action 10)

Milestone-decomposition routed per `automatic` (spawn `milestone-decomposer` inline) → returned `validation-failed`; resolved by disposition rather than re-fire (correct — the gap was a trigger-condition mismatch, NOT milestone-prose vagueness, so roadmap-planning was NOT fired). No roadmap-planning, no daily-checkpoint.

### Non-blocking surfaces (digest)

- **M9 `_TBD` success metric** (product/taste, rule 17): already surfaced in `process/session/updates/digest-2026-07-07-M9-metric-and-gated-pileup.md`. Carried from wave-18/19/20.
- **Founder-gated pile-up:** M5 LLM-spend; M6/M7 #141 email/sending-domain; M9 CRM vendor+API-key (`345dfbc6`, now formally `blocked`). Same digest; appended a status note reflecting the new `blocked` disposition + next-wave direction.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: 099cee10-562d-4e56-9a57-0dade2914760 (M9, in_progress)"
  - "todo queue head: 033f97e0 (M10)"
  - "active child tasks: open=2 done=11 seed_candidates=1(pre-fix, gated)→1(post-disposition, 1d95cac0)"
  - "unassigned queue depth: 1"
  - "closure: none (scope not shipped — seller-intent remains)"
  - "promotion: none (M9 not scope-exhausted; slot occupied)"
  - "decomposition fired: true → validation-failed (seed candidate already existed); resolved by disposition"
  - "rituals fired: [milestone-decomposition(returned validation-failed)]"
prev_wave: 20
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_child_summary:
  open: 2
  done: 11
  seed_candidates: 1
next_todo_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
unassigned_queue_depth: 1
state_transitions_applied:
  - {milestone: none, from: null, to: null, recorded_in_decisions_log: false}
task_dispositions_applied:
  - {task: 1d95cac0, change: "wave_id 0f32f35c(stale wave-18) → NULL (re-home as backlog seed)"}
  - {task: 345dfbc6, change: "status todo → blocked (external hold: founder vendor-spend + account-issued API key)"}
slot_promotion:
  promoted_id: null
  prior_active_id: null
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: 099cee10, reason: decomposition-needed(seller-intent), decision: validation-failed→resolved-by-disposition, by: milestone-decomposer(inline), fired_at: "2026-07-07"}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "refused at Step 1 (seed candidate already existed); no DB writes; head-next dispositioned 345dfbc6→blocked, seeded 1d95cac0 as wave-21, seller-intent deferred to wave-22", decision: validation-failed, by: milestone-decomposer}
loop_state: ready
note: "M9 stays in_progress. wave-21 seed = 1d95cac0 (process-hardening, sole seed candidate after blocking the founder-gated CRM task). Seller-intent = wave-22 seed once 1d95cac0 is claimed. No M10 promotion (M9 not scope-exhausted)."
```
