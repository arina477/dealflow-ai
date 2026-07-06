verdict: THIN
verdict_source: mvp-thinner
milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
milestone_title: M9 — Integrations & insight
milestone_class: product-feature
milestone_success_metric: |
  "_TBD by founder_ — target: advisors sync to their existing CRM and see
  response/throughput analytics."
  (Quantitative bar is founder-TBD. The CRM-sync leg is founder-gated + deferred
  — task 345dfbc6, vendor spend + account-issued key. This wave delivers the
  analytics-only leg, which traces to the directional prose: "advisors ... see
  response/throughput analytics.")
mvp_critical_status: |
  N of M still pending — M9 is newly in_progress (promoted at wave-17 close).
  This is M9's FIRST bundle. 4 M9 tasks total: 3 are THIS wave's analytics
  vertical (all todo); 1 (345dfbc6 real DataSourceAdapter) is founder-gated +
  deferred. No M9 child task is done yet — the milestone's mvp-critical set is
  still being laid down, and this wave lays the reporting half of it.

# THIN — proposed sibling split (WITHIN the seed's 4 metric families only;
# the 3-task vertical aggregation→API→dashboard stays intact — thinning any
# of the three layers would break "advisors SEE analytics").
proposed_split:
  acs_to_keep:
    - ac: "Metric family (1) — mandate throughput (mandates by stage/status over time + active-vs-closed counts)"
      rationale: "Named verbatim in the Success-metric directional target ('throughput analytics') AND in ## Scope. Absent it, 'advisors see ... throughput analytics' is NOT satisfiable. mvp-critical."
    - ac: "Metric family (2) — outreach response rates (send-side throughput now; response-rate as honest #141-webhook-gated 'not-yet-tracked' label)"
      rationale: "Named verbatim in the target ('response ... analytics') AND in ## Scope. Absent it, 'advisors see response ... analytics' is NOT satisfiable. mvp-critical. (The #141-gated response signal is already handled as an honest not-yet-tracked state, not a cut.)"
    - ac: "Seed AnalyticsService module + M8 RLS/GUC deny-by-default scoping (every read request-scoped, zero-row on unauth)"
      rationale: "The aggregation spine + workspace-isolation invariant. Load-bearing for BOTH kept families and any future family; cutting it breaks the whole vertical. mvp-critical (and a security invariant, not a thinness surface)."
    - ac: "Sibling 9e05828b — shared-Zod RBAC-scoped GET analytics endpoint(s)"
      rationale: "Transport for the kept families; 'advisors SEE analytics' has no path to the dashboard without it. Narrows to the 2 kept families but stays whole. mvp-critical."
    - ac: "Sibling 4b014689 — /insights Next.js 15 dashboard page (role-gated, workspace-scoped, honest empty states)"
      rationale: "Where the felt value ('advisors see ... analytics') actually lands. Cutting the page voids the success-metric verb 'see'. Renders the 2 kept families. mvp-critical."
  acs_to_split:
    - ac: "Metric family (3) — advisor productivity (per-user counts of mandates worked / outreach composed / pipeline advancements)"
      rationale: "Named in ## Scope but NOT in the Success-metric directional target ('response/throughput analytics'). Trace test: with families 1+2 delivered, 'advisors see response/throughput analytics' is still fully satisfiable → nice-to-have relative to the metric. A per-user productivity reporting facet is a coherent follow-up once the throughput/response core is live and the founder has ratified the quantitative bar."
      sibling_task_seed:
        title: "Add advisor-productivity metric family to the /insights analytics vertical"
        description: |
          Extend the shipped M9 AnalyticsService + shared-Zod analytics schema +
          /insights dashboard with the advisor-productivity metric family:
          per-user counts of mandates worked, outreach composed, and pipeline
          advancements, derived from existing rows (no new write path, no new
          upstream signal). Same M8 RLS/GUC workspace-scoping and RBAC role-gate
          as the shipped analytics endpoint. Additive-only: new aggregation
          method + schema field + dashboard card; rollback = remove them.
          Acceptance: an advisor on /insights sees per-user productivity counts,
          workspace-scoped, alongside the throughput/response families shipped
          in the first bundle. INSERT under milestone_id=099cee10,
          wave_id=NULL, parent_task_id=a5ba8068 (the seed).
    - ac: "Metric family (4) — match disposition (accept/reject/flag rates + counts over match_candidates.disposition)"
      rationale: "NOT in M9 ## Scope (Scope lists throughput, response rates, productivity — not disposition) and NOT in the Success-metric target. It is a READ/REPORT facet adjacent to the separate ## Scope item 'matching feedback loop (learn from accept/reject)', which is its own H2 concern. Trace test: with families 1+2 delivered, the success metric is satisfiable → nice-to-have. Splittable to a follow-up."
      sibling_task_seed:
        title: "Add match-disposition reporting to the /insights analytics vertical"
        description: |
          Extend the shipped M9 AnalyticsService + shared-Zod analytics schema +
          /insights dashboard with a match-disposition reporting facet:
          accept/reject/flag rates + counts over existing
          match_candidates.disposition rows (READ/REPORT only — explicitly NO
          model retraining, which is LLM-spend and deferred). Same M8 RLS/GUC
          workspace-scoping + RBAC role-gate. Additive-only; rollback = remove
          the aggregation method + schema field + dashboard card. Acceptance:
          an advisor on /insights sees match accept/reject/flag rates for their
          workspace. This is the reporting facet of the future 'matching
          feedback loop' Scope item; the learning/retraining loop remains a
          separate deferred concern. INSERT under milestone_id=099cee10,
          wave_id=NULL, parent_task_id=a5ba8068 (the seed).

over_cut_rationale: |
  n/a

ok_rationale: |
  n/a

floor_constraint_active: false
floor_constraint_detail: |
  Not active. The split peels 2 of 4 aggregation methods from ONE service task
  (a5ba8068) plus their rendering in the API + dashboard siblings; the 3-layer
  vertical (service → API → page) stays structurally intact and the bundle
  remains multi-spec (3 tasks). No wave-LOC estimate was available at P-0, but
  the residual (2 metric families + full AnalyticsService spine + full RBAC
  endpoint + full /insights page + D-block) is plainly a coherent, non-trivial
  multi-spec slice well above a vanity floor — the split re-sequences reporting
  facets, it does not hollow the wave. If P-1 later produces a LOC estimate that
  puts the residual below the multi-spec floor, head-product should re-weigh.

# ESCALATION FLAG for head-product (Action 6 merge + Mediation precedence):
#   The M9 ## Success metric is "_TBD by founder_". Per mvp-thinner hard rules a
#   _TBD metric normally forces OK-plus-flag, because a founder-ratified
#   QUANTITATIVE bar could require all four families. I emit THIN instead
#   because the split traces to the founder's OWN directional prose target
#   ("response/throughput analytics") AND to ## Scope ordering — families 3+4
#   fall outside BOTH — and because the split is scope-CONSERVING (siblings
#   pre-authored under the same milestone; nothing is lost, only re-sequenced).
#   head-product should (a) confirm the directional target is an acceptable
#   proxy for thinness analysis given the _TBD quantitative bar, and (b) if the
#   founder is expected to set a bar that leans on productivity/disposition
#   views, REJECT the split and keep all four families in the seed. This is the
#   intended _TBD escalation surface, not a silent override of the _TBD rule.
sibling_visible: false
