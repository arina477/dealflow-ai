# N-1 — Survey & triggers (wave-12)

Head: head-next (spawn-pattern block owner). Mode: automatic.

## Survey phase (Actions 1–4) — DB-verified

- **Action 1 — active milestone:** exactly one `in_progress` → **M6 — Compliant outreach & pipeline (one live mandate, end-to-end)** (`a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc`). Single-active invariant holds (1 row).
- **Action 2 — todo queue head:** 6 `todo` milestones. Highest-tier next is **M7 — Admin & settings** (`08d3053a-48fb-4562-a25b-6d99d40b0f62`), oldest `created_at`. (M5 is `blocked` on the founder LLM-spend hold — not a promotion candidate.)
- **Action 3 — M6 child-task summary:** `open_count=0`, `done_count=6`, `seed_candidates=0`. All 6 shipped: wave-11 outreach foundation (102a2f00 template spine + e90a4a99 composer/non-bypassable pre-send gate + 2601ba33 sender!=approver SoD) and wave-12 pipeline (07989285 pipeline+pipeline_events spine + d1940142 board API/RBAC/page + 45b259e1 event timeline).
- **Action 4 — unassigned queue depth:** 1 (`b1a0b2ac` — "Tighten /health spec wording", a low-priority wave-1 V-2 spec-gap follow-up, not M6-scope).

## Trigger phase (Actions 6–10)

### Action 6 — closure check (M6): WITHHELD — do NOT mark done

`open_count=0` but LLM-judged scope **NOT shipped**. M6 `## Success metric` = advisor sends a compliance-checked/approved/tracked outreach → immutable audit record → **compliance can export a verifiable recordkeeping package** → replies/opens advance pipeline (one live mandate sourcing→match→outreach→pipeline end-to-end). Send + tracking + recordkeeping-export do NOT yet exist. `## Scope` disposition (per product-decision #306):

| Scope item | State |
|---|---|
| Template library (versioned, required blocks) | ✅ shipped (wave-11) — *AI-assisted drafting portion founder-LLM-gated, deferred* |
| Outreach composer + non-bypassable pre-send gate | ✅ shipped (wave-11) |
| Compliant SEND + event tracking (email provider + webhook) | ❌ **founder-credential-gated** (#141: email-provider API key + EMAIL_WEBHOOK_SECRET) — NOT buildable |
| Compliance approval QUEUE screen | ❌ SoD *enforcement* shipped (2601ba33); dedicated queue page not built — **buildable-without-credential** |
| Audit-log + recordkeeping-EXPORT screens | ❌ not built — **buildable-without-credential** |
| Pipeline/deal-stage tracking | ✅ shipped (wave-12) |

Buildable, no-credential scope REMAINS (audit-log-export + compliance-queue pages, both designed+approved per product-decision #80). Marking M6 `done` here would be **Hallucinated Milestone Completion** (a "Done" that isn't scope-shipped). M6 stays `in_progress`. No promotion, no stockout.

### Action 7 — per-wave decomposition: FIRED (decomposition-complete)

`active_milestone` exists AND `seed_candidates=0` AND scope NOT shipped → fire milestone-decomposition, reason `decomposition-needed`, caller mode `next-bundle`. Automatic mode → spawned `milestone-decomposer` sub-agent inline (single-threaded).

**FOUNDER-CREDENTIAL GUARD enforced** — the decomposer was barred from seeding the 3 founder-gated M6 slices (compliant SEND+webhook tracking → #141 email-provider key + EMAIL_WEBHOOK_SECRET; reply/open-driven auto stage-advance → depends on that email/webhook bundle; AI-assisted drafting → LLM-spend Tier-3 per `founder-decision-llm-matching-spend.md`). Directed to the strongest BUILDABLE spend-free vertical: the audit-log / recordkeeping-EXPORT screen.

**Outcome — `decomposition-complete`.** Bundle authored (all `milestone_id=M6`, `wave_id=NULL`, `status='todo'`, verified in DB):
- **Seed** `36a17c81-3778-4594-a7d1-4b1977e5b5a0` — "Build audit-log recordkeeping API: filtered read + hash-chain integrity verify" (NestJS read+verify service/controller over the existing M2 immutable audit log; RBAC compliance-role-scoped; READ-ONLY over the HMAC-SHA256 hash-chain via AuditVerifier.verifyChain()).
- **Sibling** `20c479db-d8ba-4ae3-9a64-cd3cc7874a27` — "Generate verifiable FINRA/SOX recordkeeping export package (mandate/time-scoped)" (deterministic downloadable package: in-scope entries + hashes + verify result + manifest; the export action itself audited last-in-txn via AuditService.append).
- **Sibling** `10ee0ec4-c34d-4899-b39f-43aed12b9616` — "Ship audit-log & recordkeeping-export page (/compliance/audit-log) with filters + integrity badge" (Next.js page implementing design/audit-log-export.html; role-scoped; read-only over the log).

~2,800 net LOC, ≤~30 files. `seed_candidates` flipped 0→1 (DB-confirmed).

### Action 8 — slot promotion + stockout: N/A

`active_milestone != null` (M6 still in_progress, not closed at Action 6). No promotion. `todo` queue non-empty (6) — no stockout, no roadmap-planning.

### Action 9 — daily-checkpoint: NOT FIRED

Requires "no seed candidate AND decomposition not fired this tick." Decomposition WAS fired and returned a seed → condition fails. Not fired.

### Action 10 — routing: decomposition → milestone-decomposer sub-agent (automatic mode), completed inline. No BOARD, no ceo-agent, no founder defer.

### LLM-spend re-surface trigger — NOT met

Deferral (`founder-decision-llm-matching-spend.md`) re-surfaces only "if M6 fully ships before the founder answers." Wave-13's audit-log-export slice does NOT fully ship M6 (send/tracking still deferred) → no re-surface this wave. Carried non-blocking.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc (M6, in_progress)"
  - "todo queue head: 08d3053a (M7 — Admin & settings)"
  - "active child tasks: open=0 done=6 seed_candidates=0→1 (after decomposition)"
  - "unassigned queue depth: 1 (b1a0b2ac, non-M6, low)"
  - "closure: none (M6 scope NOT shipped — send/tracking/recordkeeping-export remain; Hallucinated-Milestone-Completion avoided)"
  - "promotion: none"
  - "decomposition fired: true (decomposition-complete)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 12
active_milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
active_milestone_child_summary:
  open: 0
  done: 6
  seed_candidates: 1
next_todo_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc, reason: decomposition-needed, decision: authored, by: milestone-decomposer, fired_at: "2026-07-05T18:24:35Z"}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "1 seed + 2 siblings authored — audit-log/recordkeeping-EXPORT vertical (36a17c81 read+verify API / 20c479db export package / 10ee0ec4 /compliance/audit-log page); ~2800 LOC; buildable-without-founder-credential confirmed", decision: decomposition-complete, by: milestone-decomposer}
loop_state: ready
note: "FOUNDER-CREDENTIAL GUARD held — 3 founder-gated M6 slices (send+webhook tracking #141, reply/open auto-advance, AI drafting LLM-spend) correctly NOT seeded; buildable spend-free audit-log-export vertical seeded instead. LLM-spend re-surface trigger NOT met (M6 not fully shipped this wave)."
```
