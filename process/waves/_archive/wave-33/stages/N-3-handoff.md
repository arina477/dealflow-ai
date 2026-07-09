# Wave 33 — N-3 Handoff

## Action 1 — Next wave number + loop state
Current wave `33`. Loop **PAUSES**: N-2 emitted `queue_exhausted: true` and no ritual is in-flight that will produce work (decomposition can't fire on founder-gated / `_TBD` scope; roadmap-refresh is a founder decision, not an auto-ritual under automatic without a founder metric input). Do NOT increment the wave counter. `next_wave: paused`.

## Action 2 — Pause marker (no next-wave dir)
`process/session/.loop-paused.yaml` written. Wave-34 directory intentionally NOT created.

## Action 3 — This deliverable written before the archive move.

## Action 4 — Archive `process/waves/wave-33/` → `_archive/` (single git mv + commit).

## Action 5 — Final state
- **5a.** `UPDATE waves SET status='ok'` on the running wave-33 row (trigger sets `ended_at`).
- **5b.** `process/session/.last-wave-completed.yaml` overwritten: `last_wave 33`, `next_wave paused`, `loop_state paused`, M9 `in_progress`.

---

## Wave-33 distilled handoff (knowledge-synthesizer)

**What shipped + verified.** Self-hosted Twenty CRM is live on Railway (5 services: server, worker, db, redis, proxy). A real admin account (arina) exists (0 app-users existed before). The DealFlow Twenty adapter is wired, synced, and confirmed: **9 real companies flow from Twenty into DealFlow's `companies` table** and surface in sourcing search. Verified end-to-end via real browser signup + live sync. M9 gains its first live CRM integration; milestone stays `in_progress` (success metric founder-reserved).

**Key decisions (ADR-style).**
- **Image name corrected** — prior `twentyhq/twenty-server` was hallucinated (does not exist); correct image is `twentycrm/twenty`. Fixed in `b6cc893` with `/healthz` + `yarn worker:prod`.
- **Storage: S3/MinIO dropped → local volume** — MinIO caused a signup crash; switched to local filesystem storage on a Railway volume (`a171c0d`).
- **`RAILWAY_RUN_UID=0`** — root-owned volume caused EACCES on first write (`7b0a058`). Check mount ownership before first write on future Railway volume work.
- **API-key boundary is manual + intentional** — Twenty v2.19 has no headless signup / programmatic key issuance; founder does a one-time manual signup + key issuance, everything downstream is automated. A permanent limitation of this Twenty version, not a gap.

**RECONCILED TECH-DEBT — depth=2→1 hotfix (already deployed, no rework).** The Twenty adapter queried with `depth=2`; Twenty v2.19's max query depth is 1, so the API silently returned HTTP 400 and ingested ZERO companies with no error in the sync log. Fix: `depth=2 → depth=1` (commit `6f6b126`), tested (1048 pass), deployed, live-verified. **This landed on `main` OUTSIDE the wave-loop as a live hotfix** — recorded here for traceability. No further rework needed; it is the direct cause of the now-working 9-company sync.

**Held VERIFY-PRINCIPLES rule-4 (pre-loaded, not promoted this wave).** Draft: *"Test every external-API adapter against a live or recorded instance of that service, not only mocked-fetch unit tests."* Contract-format-verified; HELD on the 2-wave promotion gate (single-wave confirmation). Auto-promotes on the next external-adapter live-verify (Affinity = standing 2nd site). The depth silent-0-ingest failure is exactly what this rule catches.

**Cascading patterns for future waves.**
- **Hallucinated external artifact names** (`twentyhq/twenty-server`): verify Docker images / npm packages / API paths against an authoritative registry before referencing — a single registry lookup catches it pre-deploy.
- **Silent-zero-ingest on mocked tests**: mocks accept any outbound request, so a server-rejected param (`depth=2`) passes every mock yet ingests zero live. Assert on **record count**, not just HTTP 2xx, in integration smoke tests against a live / recorded instance — especially for adapters with configurable query params.

---

## M9 disposition (judgment call)
M9's theme (Integrations & insight) is **substantially delivered + live-verified** — a working self-hosted CRM integration syncing real companies. BUT `## Success metric = _TBD by founder` (reserved, blank). head-next did NOT force-close (Hallucinated-Milestone-Completion) and did NOT set the metric. **M9 stays `in_progress`** and its near-complete status is the CENTERPIECE of the founder escalation: confirming "≥1 live CRM integration syncing companies" as M9's metric closes it immediately on today's evidence.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "next wave: paused"
  - "archive commit: see chore: N-3 archive wave-33"
  - "waves.status=ok for wave 33 (ended_at trigger-set)"
prev_wave: 33
next_wave: paused
loop_state: paused
seed_task_id: null
bundled_sibling_ids: []
claimed_task_ids: []
active_milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
active_milestone_status: in_progress
state_transitions_applied_this_wave: []
note: >
  Wave-33 closed (waves.status=ok). M9 stays in_progress (cannot close — founder-reserved _TBD metric,
  though integration is live-verified). Loop paused: 4th consecutive founder-gated scope-exhaustion
  (waves 29/31/32/33). Depth=2→1 hotfix (6f6b126) recorded as reconciled tech-debt: landed on main
  outside the loop, deployed + verified, no rework. No secret written to any archived doc.
head_signoff:
  verdict: APPROVED
  stage: N-3-handoff
  reviewers:
    BOARD: "7/7 APPROVE-PAUSE; no HARD-STOP"
    knowledge-synthesizer: "wave-33 handoff distilled (PR+ADR shape); depth hotfix flagged as reconciled tech-debt"
  failed_checks: []
  rationale: >
    Wave-33 archived immutably; waves.status closed to ok. Context aggressively compacted into a distilled
    handoff (no raw logs). The reconciled depth=2→1 hotfix is explicitly logged as tech-debt (deployed +
    verified, no rework). No plain-text secrets in archived docs (admin creds live under gitignored
    process/session/secrets/). next_wave_seed cleared (null); milestone_transition evaluated — M9 held
    in_progress, not force-closed. Loop pauses with a decisive founder escalation. Every N-3 exit checkbox
    ticks from concrete artifacts.
  next_action: ESCALATE_TO_founder
```
