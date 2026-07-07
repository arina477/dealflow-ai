verdict: PROCEED
verdict_source: ceo-reviewer
mode_applied: HOLD-SCOPE
mode_rationale: |
  Not SCOPE-EXPANSION: no live bet implies "make the test suite bigger" — sweeping
  every other suite for the same unscoped-global-audit anti-pattern is a repo-wide
  test refactor with unbounded blast radius, exactly the make-work-into-refactor
  trap. Not SELECTIVE-EXPANSION: there is no single cheap-but-disproportionate
  addition — the disproportionate-value lever (catching the OTHER offending suites)
  is already owned by promoted T-4 rule 2 + the CI-authoritative policy, which
  enforce the pattern going forward without spending a wave. Not SCOPE-REDUCTION /
  DROP: this is a REAL reliability cost (an intermittent false-RED on the
  audit-ISOLATION suite is the worst kind — it can mask a genuine cross-tenant
  regression or burn fix-forward cycles on a healthy build), so the fix is worth
  doing and cannot be trimmed below "scope the ~12 assertions." Scope is exactly
  right: HOLD-SCOPE at maximum rigor.
bet_traced_to: "integrated sourcing→matching→compliant-outreach platform beats stitched tools (compliance-first data isolation is the load-bearing trust surface)"
milestone_traced_to: "099cee10 — M9 Integrations & insight (this is the M9 test-hygiene fix-forward on the shipped outreach-activity vertical)"
proposed_scope_change: ""
drop_rationale: ""
escalation_reason: ""
sibling_visible: false

# Notes (non-schema)
# - Worth-doing test: YES. This suite proves the M8/M9 workspace-isolation invariant
#   (deny-by-default RLS + audit-chain integrity) — the single most bet-critical
#   surface for a compliance-first M&A platform. A flaky isolation test is not
#   cosmetic debt; a false-RED there is a trust + signal-integrity cost (masks a
#   real regression OR wastes cycles), and it was the ONLY claimable seed (CRM
#   founder-gated, seller-intent needs decomposition). Clearing it now is sensible,
#   not low-value make-work.
# - Ambition check: a straight scope-the-assertions-to-own-rows fix IS the right
#   6-8/10. It fixes the flake AND keeps every assertion fault-killing (per T-4
#   rule 2 — the assertions must still fail when isolation genuinely breaks; a lazy
#   "delete the count assertions" fix would be a 3/10 that guts the test's value —
#   flag that to P-2 as the acceptance bar). Do NOT expand into a suite-wide sweep.
# - Hard guardrail for P-1/P-2: keep scope to outreach-activity-rls.e2e-spec.ts only.
#   If B-block discovers a second suite with the identical anti-pattern IN this
#   wave's diff path, log it as a tracked follow-up seed — do not in-line a
#   repo-wide refactor (scope-creep containment).
