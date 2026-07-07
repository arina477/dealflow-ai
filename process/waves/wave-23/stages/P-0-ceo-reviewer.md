# P-0 — ceo-reviewer verdict (wave-23, M9 seller-intent scoring)

```yaml
verdict: SELECTIVE-EXPANSION
verdict_source: ceo-reviewer
mode_applied: SELECTIVE-EXPANSION
mode_rationale: |
  The proposed scope (a deterministic per-mandate 0-100 seller-intent score
  synthesizing outreach touches + pipeline velocity + match dispositions) is
  the correct M9 capstone and clearly worth doing — but as specified it ships
  a STATIC number, while the task's own stated value proposition is "which of
  their live mandates are heating up vs COOLING." Advisors act on CHANGE (a
  deal just went cold / just heated) far more than on an absolute level; a
  static rank alone is the classic "vanity score nobody acts on." One cheap,
  disproportionate addition — a deterministic direction/trend indicator
  (heating / cooling / flat, a signed delta of the SAME score over a trailing
  window) — converts the score from a passive ranking into an actionable
  attention-trigger. That is exactly SELECTIVE-EXPANSION: hold the scope,
  cherry-pick the single highest-leverage addition. Not HOLD-SCOPE/PROCEED
  because a static number under-delivers the promised actionable value for
  ~1.2x cost. Not SCOPE-EXPANSION because no larger milestone or second
  capability is needed — the one trend addition suffices. Not
  SCOPE-REDUCTION/DROP because the work is high-leverage and the composite is
  already right-sized (not grandiose, not LLM).
bet_traced_to: "Integrated platform beats stitched-together tools for M&A"
milestone_traced_to: "099cee10-562d-4e56-9a57-0dade2914760 — M9 Integrations & insight (## Scope explicitly lists 'seller intent signals')"
proposed_scope_change: |
  ADD ONE cheap-but-disproportionate element to the seller-intent score:
  a deterministic DIRECTION / TREND indicator (heating / cooling / flat)
  alongside the static 0-100 value.

  - Mechanism: recompute the SAME deterministic score over a trailing window
    vs a prior window (outreach touches, pipeline_events, and match
    dispositions all carry timestamps already live in the schema), emit the
    signed delta + a categorical arrow. No new data source, no new table
    beyond what the score already needs, ZERO new credential, ZERO LLM.
    Reuses the identical inputs — marginal cost is a second windowed
    aggregation, not a second feature.
  - Why disproportionate: the task frames its entire value as "heating up vs
    cooling." Shipping the static number without direction ships the LABEL of
    the value without the thing that makes an advisor reprioritize. Direction
    is what makes the /insights surface a daily-open habit vs a one-glance
    novelty — it is the lever that actions more qualified matches per week
    (bet #1's falsifiable claim).

  HOLD THE LINE (do NOT expand further — guard against over-build):
  - Keep the composite weights as FIXED sensible defaults for v1. No
    weight-tuning UI, no configurable/learned weights, no calibration surface
    — that is over-build for a v1 prioritization signal.
  - CONFIRM the NO-LLM boundary is correct and must hold: for a
    compliance-first M&A product a reproducible, auditable, deterministic
    score beats a black-box LLM "intent" inference (explainable to a
    compliance reviewer, reconstructable from the audit trail). The LLM
    intent-inference path is founder-gated/deferred anyway. The trend addition
    stays fully deterministic (a delta of deterministic scores) — it does NOT
    reopen the LLM boundary. Explicitly OUT of scope: any LLM intent inference,
    any external intent-data provider, any model retraining.

  STRATEGIC FLAG (milestone alignment — carry to founder digest, NOT a blocker
  for this wave): this is the LAST buildable credential-free M9 vertical before
  M9 can close, and M9's QUANTITATIVE ## Success metric is still
  "_TBD by founder_" (carried since wave-18). Build proceeds this wave against
  the qualitative target + honest not-yet-tracked states (same precedent as
  M8/M9 prior bundles). But the founder poll on the M9 success metric is now
  DUE — it should be resolved before N-1 disposes M9 to done, or M9 closes on
  an unmeasured metric. Surface at this wave's close.
drop_rationale: |
  (n/a)
escalation_reason: |
  (n/a — the _TBD M9 metric is flagged for a founder poll at wave close, not
  escalated: it blocks CLOSING M9, not BUILDING this vertical.)
sibling_visible: false
```

## Reasoning summary

**Is a seller-intent score the right M9 capstone?** Yes. It is the synthesis
layer over the three prior M9 verticals (outreach-activity tracker,
pipeline/analytics, match-calibration) — collapsing them into one "which deals
to action now" prioritizer. That is the single highest-leverage insight for an
M&A advisor and it maps directly to bet #1's falsifiable claim (surface + action
10x more qualified matches per week). Buildable now, deterministic, read-only,
workspace-scoped, no credential. Not a vanity score — PROVIDED it drives
reprioritization, which is why the trend matters.

**Ambition calibration:** the static 0-100 as seeded is UNDER-calibrated for its
own stated purpose. The fix is not more scope — it is the one missing element
(direction/heating-vs-cooling) that the task description already promises.
Cheap (same inputs, windowed), disproportionate (turns a novelty into a habit).
This is the 8/10 available for ~1.2x the cost of the 3/10 static number.

**NO-LLM boundary:** agreed and load-bearing — keep it deterministic; the trend
addition does not breach it. Guard the two creep vectors: (a) LLM intent
inference, (b) weight-tuning/calibration UI. Both stay out of v1.

verdict: SELECTIVE-EXPANSION.
```
