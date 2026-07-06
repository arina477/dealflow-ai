```yaml
verdict: SELECTIVE-EXPANSION
verdict_source: ceo-reviewer
mode_applied: SELECTIVE-EXPANSION
mode_rationale: |
  Not HOLD-SCOPE: the 5-task bundle is sound and worth doing, but one seed task
  (the compliance-default cascade) is materially higher-stakes than the other four
  and the bundle under-weights it — this is a coherence gap, not a polish gap, so a
  blanket PROCEED would mis-signal the bundle's center of gravity. Not SCOPE-EXPANSION:
  the milestone itself does not need to grow — its one genuinely-blocking gap
  (sending-domain DKIM/SPF/DMARC verify) is correctly #141-credential-gated and cannot
  be built now, so proposing wider scope would only re-import a known stockout. Not
  SCOPE-REDUCTION/DROP: none of the five is a "real bug that doesn't matter" — each
  closes a trust or coherence hole on a LIVE admin surface. The single cheap-but-
  disproportionate move is to elevate the cascade task from "one of five follow-ups"
  to the bundle's mvp-critical spine and require an explicit inherited-default proof,
  because a compliance-first product whose admin-set compliance defaults are inert is
  a credibility hole that directly undercuts the live "compliance-first wedge" bet.

bet_traced_to: "Compliance-first outreach is a durable wedge for M&A advisory" (primary) + "Integrated platform beats stitched-together tools for M&A" (secondary)
milestone_traced_to: 08d3053a-48fb-4562-a25b-6d99d40b0f62 — M7 Admin & settings (in_progress)

proposed_scope_change: |
  HOLD the 5-task M7 hardening bundle as scoped (seed 904a3c25 + siblings 6f1a96da /
  c54db02d / 042cf4e6 / 2560fecc). ONE elevation, not an addition:

  Promote seed 904a3c25 (firm default-compliance-profile cascade → mandate-create) to
  the bundle's mvp-critical spine, and require its acceptance criteria to prove the
  cascade END-TO-END on deployed state, not just that the fallback code path exists:
    - admin sets firm default jurisdiction/disclaimer/suppression in workspace-settings;
    - a NEW mandate created with those fields unset INHERITS the firm defaults
      (asserted against the M2 disclaimer/suppression/jurisdiction tables mandates read);
    - a mandate with the fields SET is untouched (no override of explicit input);
    - NO retroactive mutation of existing mandates;
    - the inheritance is covered by a real T-block test (jenny flagged the T-block had
      none) — no tautological assertion.

  Rationale for elevation over flat treatment: wave-15 shipped the cascade SELECTOR live
  but nothing CONSUMES it. In a compliance-first product this is the worst failure class —
  an admin believes they have set a firm-wide compliance guardrail that silently does
  nothing. That is not a "real bug that doesn't matter"; it is the bug that most directly
  falsifies the wedge bet. The other four siblings are correctly-scoped trust/coherence
  fixes and stay as-is (nav for the orphaned /admin/integrations page; invite 409/
  idempotent; reactivate path for soft-deactivated users; JSONB raw-secret guard) — none
  warrants expansion, none warrants dropping.

  Explicitly NOT expanded (guardrails, so the bundle stays a coherent hardening wave and
  does not balloon into a monster):
    - sending-domain DKIM/SPF/DMARC record-generation + live-verify — correctly deferred
      with product-decision #141 (per decisions #331/#342/#343). Do NOT re-surface it as
      buildable work this wave; it is founder-credential-gated, and attempting it re-imports
      the same stockout that blocks M6. The founder-facing signal ("M7 admin is coherent and
      trustworthy, but 'verify a sending domain' in the success metric remains blocked on the
      email-provider credential #141") belongs in the N-block founder digest / pending queue,
      NOT as an in-wave scope item — this reviewer flags it for surfacing, does not author it.

  On the "reactivate path premature?" question: NOT premature. Wave-15 shipped soft-
  deactivate live; a soft-delete with no undo is an incomplete admin primitive that will
  strand real users the moment an admin mis-clicks. It stays in-scope. (Its prod-cleanup
  obligation is an execution detail for P-3/B-block, not a strategic-scope concern.)

drop_rationale: |
  n/a — no task is dropped. All five close a live-surface trust or coherence gap.

escalation_reason: |
  n/a — no strategic conflict beyond this seat's authority. The one founder-gated item
  (sending-domain verify / #141) is already correctly deferred and merely needs re-
  surfacing in the founder digest, which is the N-block's job, not an escalation.

sibling_visible: false
```

## Answer to the framed question

**Is finishing/hardening M7 the RIGHT next move (vs jumping to M8 or unblocking M6/M5)?**
Yes. M8 (pilot-partner data-isolation) is H2/T4 and its `## Success metric` is still `_TBD by founder_` — advancing to it now would build isolation on top of an admin surface that still has a live credibility hole (inert compliance defaults). M5/M6 are both externally blocked (LLM-spend; email-credential #141) and the brain cannot unblock them without founder action. M7 is the highest-tier `in_progress` milestone, on the critical path to eventually unblocking M6's compliant send, and serves BOTH live bets. Closing its buildable-without-credential coherence gaps before moving on is unambiguously the highest-value next move.

**Ambition calibration:** this is a legit ~8/10 "make the M7 admin surface actually coherent and trustworthy" bundle, NOT 3/10 cosmetic polish — the cascade-consumption fix alone lifts it out of polish territory because it converts a silently-broken compliance guardrail into a working one. It is correctly NOT over-expanded into a monster: the one thing that WOULD make the milestone fully shippable (sending-domain verify) is founder-gated and correctly held out. Nothing in the bundle is a bug-that-doesn't-matter; nothing achievable-for-1.2x-cost is being left on the table within the credential boundary.

**Missing / to surface:** the M7 `## Success metric` ("verify a sending domain so the firm can send compliant outreach") will remain UNMET after this wave — that is the honest state, and it should be surfaced to the founder in the N-block digest as the standing #141 blocker, not silently absorbed.
