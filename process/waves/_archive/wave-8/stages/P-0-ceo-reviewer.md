```yaml
verdict: PROCEED
verdict_source: ceo-reviewer
mode_applied: HOLD-SCOPE
mode_rationale: |
  The mandate data spine is the load-bearing vertical for the whole M4 milestone
  and the M4→M5→M6 critical path — no buyer-universe, no matching, no compliant
  outreach can exist before a sell-side mandate (container carrying seller/target
  profile + buyer criteria + compliance profile) is persistable. So this is the
  correct FIRST bundle, not a timid one (rules out SCOPE-EXPANSION). It is a clean
  vertical slice — three co-created tables in one transaction + service + guarded
  API + shared Zod + one create form + two read pages — and cannot be trimmed
  without breaking coherence: MandateService.create configures the criteria and
  compliance-profile rows, so those tables must ship with it (rules out
  SCOPE-REDUCTION / DROP). Buyer-universe is a substantial separate module
  (assemble from sources/prior deals → filter → enrich contacts → submit to
  matching) that depends on this spine AND M3 canonical companies; folding it into
  wave 8 would be a horizontal over-bundle carrying real risk, not a cheap
  high-leverage add (rules out SELECTIVE-EXPANSION). Scope is exactly right; the
  bar is execution quality.
bet_traced_to: |
  Primary: "Integrated platform beats stitched-together tools for M&A" — the
  mandate is the single deal container that collapses the five-tool stitched
  workflow; the whole one-live-mandate H1 loop hangs off it.
  Reinforcing: "Compliance-first outreach is a durable wedge for M&A advisory" —
  capturing jurisdiction + disclaimer template + suppression scope at mandate
  creation (FK into the M2 compliance_rules / disclaimer_templates /
  suppression_list tables) binds compliance context to the deal container up
  front, so the M6 pre-send gate enforces per-mandate. That per-mandate compliance
  binding is the compliance-native design and a real differentiator versus
  DealCloud's process-level (non-per-mandate-outreach) compliance.
milestone_traced_to: c67b1610-9cc3-4cad-bcfa-1bee0573da72 — M4 "Mandates & buyer universe" (in_progress, product-feature, T2)
proposed_scope_change: |
  None. HOLD-SCOPE.
drop_rationale: |
  N/A
escalation_reason: |
  N/A
sibling_visible: false
```

## Strategic notes (non-binding, for P-2 spec / D-block)

1. **Not demo-hollow.** A configured sell-side mandate (seller/target profile +
   buyer criteria + compliance profile) with list + detail views is
   standalone-valuable: engagement/mandate management is table-stakes for M&A CRM
   (DealCloud, Affinity), and this ships at parity on that axis. Deferring
   buyer-universe to a later M4 bundle carries low strategic risk — the mandate is
   usable on its own; it does not require the universe builder to justify the wave.

2. **Make the differentiator visible.** The one place value can leak: the
   compliance profile is captured/stored only (enforcement is M6), so it risks
   reading as dead data this wave. Recommend (spec/design detail, not a scope
   change) that mandate-detail surface the captured jurisdiction / disclaimer /
   suppression prominently — the compliance-first wedge should be *seen* at mandate
   level now, even though the gate that enforces it lands in M6. Correct
   build-ordering (M2 tables already exist; M6 reads them); no reason to pull M6
   enforcement forward.

3. **Ambition is calibrated, not thin.** This is a CRUD-minus-update slice
   (create + list + detail). Deferring mandate edit / lifecycle activation
   (draft→active transition) to the next bundle is acceptable — it does not meet
   the cheap-but-disproportionate bar and would dilute the vertical.
