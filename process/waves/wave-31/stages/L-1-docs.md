# L-1 — Docs (wave-31 M9 Twenty CRM DataSourceAdapter — built + deployed DORMANT)

> Gate: head-learn (spawn-pattern, automatic mode). Owns L-1 stage-exit verdict.
> Wave shipped b1f81d79: Twenty CRM adapter BUILT (SDK-doc-first + mirror-wave-30-Affinity +
> base-URL-from-env-https + P2-a-output-validation FOLDED) + DEPLOYED (registered, DORMANT — returns []
> without TWENTY_API_KEY/TWENTY_BASE_URL; app boots clean; deploy 986c1b1d, commitHash b1f81d79).
> NOT released to users. Live data flow awaits founder's TWENTY_API_KEY + TWENTY_BASE_URL (no-new-code env set).

## Stage entry

```json
{ "agent": "head-learn", "stage": "L-1", "status": "gating",
  "block_state": { "observations": [], "promoted_rules": [] } }
```

Mode: `automatic`. Pause-trigger scan (rule 13): STATUS `RUNNING` (unchanged — verified against
status-check.yaml); no gate hard-stop for L-1; no founder message; no `.loop-paused.yaml`.
(`.loop-resume.yaml` present — wave-31's own opening mailbox, not an L-1 pause trigger.) No trigger fires — L-1 proceeds.

---

## Action 1 — CHANGELOG entry — JUDGMENT: SKIP (deferred to the LIVE-hookup wave)

**Decision: NO CHANGELOG entry this wave.** No versioned user-facing entry is appended.

**Reasoning (systemic, not vibe — mirrors the wave-30 Affinity dormant precedent exactly):**
- The keep-a-changelog convention here records **user-perceptible releases** — every prior H2 feature that
  shipped a user-facing capability earned a version bump (`0.23.0` export, `0.24.0` retention, `0.25.0`
  records-browser). Each changed what a firm user can *do* on ship day.
- The Twenty adapter is **deployed DORMANT**: registered in `adapter.registry.ts` (new code live at
  b1f81d79) but graceful-no-op — `fetchCompanies` lazily reads `TWENTY_API_KEY`/`TWENTY_BASE_URL`, finds
  them absent (or base-URL non-https), returns `[]` + warns, no throw (`twenty.adapter.ts:365-401`).
  Independently confirmed by V-block (Karen 6/6 + jenny 0-drift APPROVE) and C-2 (`/health` 200
  `{status:ok, db:ok}`; module graph incl. Twenty adapter initialized without the key; zero 5xx).
- **No real Twenty company reaches sourcing search until the founder sets the key + instance URL.** Nothing
  a user perceives this wave. A user-facing `Added` entry would misrepresent a dormant capability as a live
  one — CHANGELOG integrity (entry = what actually changed for users) forbids it.
- **Deploy ≠ release.** The code is deployed; the feature is not released. The CHANGELOG tracks releases.
- **The user-facing entry is DEFERRED to the LIVE-hookup wave** — when the key + URL arrive, real Twenty
  companies flow into `/sourcing/*`, and *that* wave earns the version-bumped `Added` line. Because M9 now
  has TWO dormant connectors (Affinity from wave-30 + Twenty from wave-31), the deferred live-hookup entry
  should read as a single CRM-connect capability ("Connect your CRM — Twenty or Affinity — into deal
  sourcing"), authored when the first of the two is keyed live, not a per-adapter drip.

**Considered and rejected — a combined dormant "Changed"/internal note** ("internal: Twenty CRM connector
added, pending activation; 2nd dormant connector after Affinity"). Rejected for the same reason as wave-30:
the CHANGELOG here is user-facing release-note prose, not an internal engineering log; a "pending
activation" line adds no user value and risks a reader mistaking dormant for live. The deploy is fully
captured in the C-2 deliverable + the feat merge b1f81d79 + the founder-key follow-up file
(`process/session/updates/founder-request-twenty-api-key.md`). No CHANGELOG surface is the honest record.
Consistency with the wave-30 SKIP is deliberate — two dormant connectors, one deferred release entry.

---

## Action 2 — Milestone delta — M9 (Integrations & insight) — PROGRESS, STRUCTURALLY CANNOT CLOSE

Milestone resolved via `tasks.milestone_id` on claimed task `1eb63a40` (Twenty adapter):

- **M9** `099cee10-562d-4e56-9a57-0dade2914760` — "M9 — Integrations & insight", status `in_progress`,
  `## Class: product-feature`, `## Tier: T4`, `## Horizon: H2`.
- `## Success metric: _TBD by founder_` — "advisors sync to their existing CRM and see response/throughput
  analytics." **Founder-reserved; not synthesizable by the brain.**

Child-task rollup (DB-verified this wave): **19 done, 0 open** (task `1eb63a40` marked done at L-2 Action 0).

**M9 CANNOT CLOSE this wave — two independent blockers, no L-1 delta beyond progress-recording:**
1. **Success metric is `_TBD` (founder-reserved).** A milestone whose success metric is unauthored cannot
   be evaluated as met; the brain does not synthesize a founder-reserved metric (would fabricate the close
   criterion).
2. **Both CRM adapters are key-gated / dormant.** Affinity (wave-30) and Twenty (wave-31) are both deployed
   but return `[]` absent their keys. The metric ("advisors sync to their existing CRM and see analytics")
   is structurally unmeasurable until at least one connector is keyed LIVE and real records flow — which is
   a founder action, not a code action.

**Structural progress this wave:** M9 now carries the ≥2-sources direction concretely — Fixture + Affinity
+ Twenty adapters all registered behind the sourcing interface. This is genuine milestone *progress*
(second real external CRM adapter), NOT closure. **N-block owns M9 disposition + next-slot pick** — which,
per the wave-30 precedent (scope-exhausted BOARD 7/7 pause), is likely founder-gated again (either the
live-hookup key arrives, or the founder redirects M9's next connector/scope).

## Action 3 — README touchups — SKIP

No user-facing surface changed (dormant backend adapter only; no new route, page, or CLI). README
sub-action skip condition met per L-block dispatcher.

---

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-1
  reviewers: {}
  failed_checks: []
  rationale: >
    CHANGELOG SKIP is the honest record for a dormant deploy (deploy != release; mirrors wave-30
    Affinity), with the user-facing CRM-connect entry consciously deferred to the live-hookup wave and
    scoped to cover both dormant connectors as one capability. Milestone delta correctly records M9 as
    PROGRESS (2nd external CRM adapter, 19/19 child tasks done) but NOT closable — success metric is
    founder-reserved (_TBD) and both adapters are key-gated/dormant, so the metric is structurally
    unmeasurable; N-block owns disposition. No human-error root cause invoked; the only systemic note is
    the deliberate dormant-vs-live distinction, faithfully carried. README skip is correct (no user
    surface changed).
  next_action: PROCEED_TO_L_2   # L-1 and L-2 run in parallel; both must exit before N-block
```

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "merge b1f81d79 (Twenty adapter) — CHANGELOG intentionally untouched (dormant deploy)"
  - "M9 099cee10 in_progress; 19 child tasks done / 0 open (DB-verified); success_metric _TBD founder-reserved"
  - "V-1-summary: Karen 6/6 + jenny 0-drift APPROVE — dormant deploy honestly matches spec"
note: >
  CHANGELOG disposition = SKIP (deferred to live-hookup wave; combined Twenty+Affinity CRM-connect entry).
  M9 cannot close (metric _TBD + both connectors dormant/key-gated). N-block owns M9 disposition + next
  slot (likely founder-gated, same as wave-30 scope-exhausted pause).
```
