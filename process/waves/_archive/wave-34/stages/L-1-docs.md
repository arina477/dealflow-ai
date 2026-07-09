# L-1 Docs — Wave 34 (M6 E2E deal-loop proof + P0 SSR-500 fix)

**Stage:** L-1 Docs · **Head:** head-learn · **Date:** 2026-07-09

## Entry

```json
{
  "agent": "head-learn",
  "stage": "L-1-docs",
  "status": "gating",
  "block_state": { "observations": ["OBS-4","OBS-5","OBS-6"], "promoted_rules": [] }
}
```

## 1. CHANGELOG disposition — AUTHORED

New entry **`[0.27.0] — 2026-07-09 — The full deal loop is proven working, and a site-wide outage is fixed (M6 / H1)`** prepended to `CHANGELOG.md`.

Two user-perceptible facts framed for a non-technical founder:
- **Fixed (P0, user-facing):** every authenticated page returned an error for logged-in users; now fixed and re-verified 200 across all routes. Framed as an outage that a real run-through caught where routine tests passed it through.
- **Added / proven (milestone):** the full deal loop is verified working end-to-end on the deployed app — the core product is complete.

Sections follow the established keep-a-changelog house style (`Fixed` / `Added-proven` / `Correctness-compliance` / `Provenance`), plain language, no stage codes / paths / SQL / agent names. The documented boundary (no real outbound email; loop terminates at `send_eligible` + audit) is stated as design, not gap, in Provenance.

## 2. Milestone delta

- **M6 → done.** The E2E proof closed M6; both founder bets (ranked matching usefulness + non-bypassable compliance/SoD send) validated against deployed state.
- **H1 integrated loop → SHIPPED.** With M6 done, the H1 integrated deal loop is complete and proven. Core product complete.
- Slate for N-block: 10 milestones done; **M11** (todo, held/demoted) + **M12** (todo, deferred) remain — both intentionally held per the 2026-07-09 roadmap refresh. No `todo` milestone is active-decomposable; N-block will surface the held slate, not auto-decompose.
- Milestone `description` / `## Success metric` prose edits: none required this wave (the milestone metric was already concrete; the wave proved it rather than authored it).

## 3. Observations emitted (systemic, reality-checked) — 3

Written to `process/waves/wave-34/blocks/L/observations.md`, vetted by `knowledge-synthesizer` + `karen`:
- **OBS-4 (strongest, NEW, HELD):** a green unit/integration suite does not certify the deployed build renders; the deployed-origin E2E pass caught a server-render fault (Next.js 14 event-handlers in a Server Component → 500 on every authed page) invisible to every isolated test. Root cause traced to `AppShell.tsx` skip-link handlers; fixed by extracting `SkipLink.tsx` (`b557ac7`, deploy `bbbd7e5b`), re-verified 200. Single-wave confirmation of a NEW deployed-render failure class → HELD with a Contract-format drafted rule + pre-loaded second site.
- **OBS-5 (HELD):** no reachable role-provisioning path on the deployed app blocked the multi-role SoD proof until advisor + compliance role-users were created directly. Infra/provisioning gap.
- **OBS-6 (POSITIVE):** the M6 compliance spine is genuinely non-bypassable + SoD-correct against deployed state (gate always evaluates; sender≠approver enforced; audit `verify {ok:true, 350}`). Recorded as a health signal, not a rule; the no-outbound-email terminus documented as design boundary.

Every observation traces a symptom to a systemic gap (missing verification layer / missing safeguard), not to human error. The pass-1 speculative root cause (RSC data-fetch / env / cookie-forwarding) was explicitly corrected to the true cause (illegal event-handler prop in a Server Component) — no wrong hypothesis survives into the recorded observation.

## Stage-exit checklist (L-1 Docs)

- [PASS] Retrospective omits individual human error as root cause; identifies the missing verification layer (no deployed-origin E2E) and missing safeguard (no reachable role-provisioning).
- [PASS] Uses "how" (local rationality: isolated tests cannot render the deployed server tree) not reductionist "why → blame".
- [PASS] Acknowledges degraded-state reality: the app was silently broken behind green signals.
- [PASS] Every anomaly paired with a corrective response (SSR-500 → SkipLink extraction + re-verify; role lockout → direct role-user creation).
- [PASS] Plan-authoring/defect analysis identifies the missing signal at authoring time (a Server-Component-illegal prop shipped with no server-render sensor to catch it).
- [PASS] Precise domain vocabulary throughout (Server Component render, request-contract vs render-fault distinction, SoD, hash-chain verify).
- [PASS] Every defect traces to the introducing error AND why the harness missed it (no test renders through the production Next.js server).
- [PASS] Identifies the missing observability/sensor (no deployed-origin E2E render check).
- [PASS] Reality-check states behavior vs MVP mental model (compliance-first: loop correctly terminates at send_eligible, not a gap).
- [PASS] Decisions list alternatives + trade-offs (SkipLink client extraction chosen over removing the accessibility handlers).
- [PASS] Tactical containment (the fix) separated from strategic lesson (OBS-4 verification-layer rule).
- [N/A] No AI-generated code accepted this wave.
- [PASS] Impact metrics differentiate: the SSR-500 (existential — whole UI dead) vs the provisioning gap (high, enabling) vs the positive confirmation.
- [PASS] No architectural constraint overridden.

## Verdict

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-1-docs
  reviewers: { knowledge-synthesizer: retro/distill, karen: reality-check }
  failed_checks: []
  rationale: >
    CHANGELOG 0.27.0 authored covering both user-perceptible facts (P0 SSR-500 fix +
    loop-proven milestone) in founder-plain language on the house style, with the
    no-outbound-email terminus stated as design boundary not gap. Three systemic
    observations emitted, all reality-checked to missing-verification-layer /
    missing-safeguard root causes rather than human error, with the pass-1 speculative
    cause explicitly corrected to the true Server-Component render fault. Milestone
    delta recorded: M6 done, H1 loop shipped, core product complete; M11/M12 held for
    N-block. No observation theater — every symptom maps to a corrective action or a
    harness gap.
  next_action: PROCEED_TO_L-2
```

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md [0.27.0] entry prepended (Fixed + Added-proven + Correctness/compliance + Provenance)"
  - "process/waves/wave-34/blocks/L/observations.md — OBS-4/5/6 (3 observations)"
  - "commits referenced: b557ac7 (SkipLink extraction), bbbd7e5b (deploy); audit verify {ok:true, entriesChecked:350}"
note: "Milestone M6 done, H1 integrated loop shipped, core product complete/proven; M11 (held/demoted) + M12 (deferred) remain, both intentionally held per 2026-07-09 roadmap refresh — surfaced to N-block, not auto-decomposed."
```
