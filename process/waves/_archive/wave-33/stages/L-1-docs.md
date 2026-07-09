# Wave 33 — L-1 Docs

Live-ops + hotfix wave: self-hosted Twenty stood up on Railway (5 services), wired into DealFlow sourcing, verified end-to-end. Source of truth: `process/waves/wave-33/stages/B-2-provision.md`.

## CHANGELOG — AUTHORED (0.26.0)

Prior integration work (Affinity/Twenty adapters) was DORMANT and correctly skipped from the user-facing CHANGELOG in earlier waves. This wave is the first time the Twenty integration is **LIVE + user-perceptible**: a real connection can be created and real companies flow from a self-hosted CRM into the sourcing workspace (9 companies verified in DealFlow's `companies` table). A user-facing entry is therefore warranted.

- New entry: `CHANGELOG.md` `## [0.26.0] — 2026-07-09 — Connect your CRM: self-hosted Twenty sourcing (M9)`.
- Format matches the established house style: headline paragraph + `### Added` / `### Correctness / compliance` / `### Provenance (transparency)`.
- Founder-facing language (rule 16): plain, outcome-first; no stack names, no env vars, no HTTP/depth internals, no wave/stage codes, no agent names. The request-contract fix is described as "proven against the real service, not a stand-in ... a mismatch automated tests alone could not surface" without leaking `depth`/HTTP 400.
- Provenance honesty preserved: no DB change, no email, no AI; the one-time CRM sign-up boundary is disclosed.

## README

No README touch-up warranted — no top-level run/setup/stack surface changed for a reader of the repo README. Skip (per block dispatcher's README sub-action skip rule).

## Milestone delta (M9 — Integrations)

- M9 now has a **LIVE, verified** integration (Twenty → sourcing) and **0 open tasks**.
- M9 **cannot mechanically close**: its `## Success metric` is still `_TBD_` (founder-reserved). Milestone disposition/closure is an N-block concern (head-next), NOT resolved here. Flagged for N-block; no milestone `status` transition written at L-1.
- No `milestones.description` prose edit made (the `_TBD_` success metric is founder-reserved; L-1 does not author it).

## Reality-checked observations (systemic)

Full set in `process/waves/wave-33/blocks/L/observations.md`. Vetted by `knowledge-synthesizer` + `karen`. Count: **3**.

- **OBS-1 (strongest, promotion candidate, HELD):** Mocked adapter tests cannot certify an external **request** contract; a live-verify against the real running instance is what catches it. 18 mocked tests green + green deploy → silent 0-ingest in production; live-verify caught `depth=2` HTTP-400 rejection; fix re-synced 9 companies. Distinct from BUILD rule 5 (response/parse-side) and VERIFY rules 1/3 — confirmed by both specialists. Systemic (verification-layer gap), not human error.
- **OBS-2:** Deploy docs authored from memory hallucinate vendor image names/paths → silent zero-log deploy failure (`twentyhq/*` → real `twentycrm/twenty`). Fixed in-wave; committed package now accurate.
- **OBS-3:** Root-owned Railway volume → EACCES for non-root container; fix `RAILWAY_RUN_UID=0` (masked entirely by the S3 path). Infra-provisioning gap.

Each observation traces symptom → systemic gap (missing verification layer / missing pre-deploy check), never to individual error. Meta-pattern: green-in-isolation ≠ green-against-reality; this wave's live-verify discipline is the durable asset.

## Hotfix reconciliation flag (for N-block)

The `depth=2→depth=1` fix (commit **6f6b126**; root cause Twenty v2.19 HTTP 400 max-depth-1; 1048 tests pass; deployed + verified) landed on `main` **OUTSIDE the standard wave-loop** as a live-verification hotfix. Reconcile into the wave-loop ledger at N-block (head-next). Recorded here so it is not lost.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md — new entry [0.26.0] 2026-07-09 (Connect your CRM: self-hosted Twenty sourcing)"
  - "process/waves/wave-33/blocks/L/observations.md — 3 systemic observations, karen+knowledge-synthesizer vetted"
  - "README: skipped (no top-level surface change) per block dispatcher README sub-action skip"
  - "M9 milestone: LIVE integration + 0 open tasks; success metric still _TBD_ (founder-reserved) -> cannot mechanically close; disposition deferred to N-block"
note: "depth=2->1 hotfix (commit 6f6b126) landed on main OUTSIDE the wave-loop; flagged for N-block ledger reconciliation."
head_signoff:
  verdict: APPROVED
  stage: L-1-docs
  reviewers:
    knowledge-synthesizer: "retro/distill — 3 systemic observations, promotion candidate distinct from BUILD-5"
    karen: "reality-check — evidence structurally supports OBS-1; distinct failure mode; PROMOTE-on-merit but flags 2-wave gate"
  failed_checks: []
  rationale: >
    Every L-1 exit checklist item is satisfied. Observations omit human error and name the
    missing verification layer / missing pre-deploy check as root cause (systemic, not first-story).
    Each symptom (0-ingest, hallucinated image, EACCES) is paired with the corrective control and
    traces to the plan-authoring/verification gap that let it through — not observation theater.
    The plan-authoring defect (memory-authored deploy doc) is traced to the specific missing
    verification input (vendor canonical compose). Decisions carry recorded rationale (S3->local->UID=0,
    depth=2->1) not "the AI suggested it". CHANGELOG disposition is deliberate and honest: the
    now-LIVE user-perceptible integration warrants an entry where dormant adapters did not. M9 delta
    is captured but its founder-reserved _TBD_ success metric correctly blocks mechanical closure
    (disposition is N-block's, not L-1's). Hotfix-reconcile flag recorded for N-block.
  next_action: PROCEED_TO_L-2
```
