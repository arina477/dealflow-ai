verdict: OK
verdict_source: mvp-thinner
milestone_id: c67b1610-9cc3-4cad-bcfa-1bee0573da72
milestone_title: Mandates & buyer universe (M4)
milestone_class: product-feature
seed_task_id: ba0edebf-8509-46b2-b69f-f5458ba400fd
milestone_success_metric: |
  An advisor can create a sell-side mandate with buyer criteria + a compliance
  profile, and an analyst can assemble and enrich a buyer universe for it that
  is ready to rank.
mvp_critical_status: |
  0 of milestone scope shipped — M4 freshly promoted; this seed is the first
  bundle and the load-bearing vertical for the advisor half of the metric.
  (The analyst / buyer-universe half is a later bundle, correctly out of scope.)

# OK — current scope is well-classified; every AC traces to the mvp-critical floor.
ok_rationale: |
  Every AC in this bundle is load-bearing on the LITERAL success-metric text. The
  metric's advisor clause explicitly names both "buyer criteria" AND "a compliance
  profile" as constituents of the mandate an advisor creates — so neither the
  mandate_buyer_criteria table nor the mandate_compliance_profile table can be
  peeled to a sibling without leaving the metric unsatisfiable. No gold-plating
  found: lifecycle is capped at draft/active (no extra states), criteria at the
  canonical 4 dims (industry/geo/size/deal-type, aligned to M3 fields the later
  buyer-universe builder filters on), and the compliance profile at capture-only
  (jurisdiction/disclaimer/suppression) with enforcement correctly deferred to the
  M6 pre-send gate. The list + detail surfaces were already split to siblings at
  N-2, so the seed is not over-packed. The one plausible thinness lever — thinning
  the create form to a create-shell and deferring criteria+compliance capture to
  the detail-page PATCH — was rejected: it relocates rather than removes scope, the
  detail PATCH already exists as sibling 50227055, and "create a mandate WITH buyer
  criteria + a compliance profile" makes full capture-at-create the direct
  realization of the metric (a create flow that yields a mandate lacking both is a
  weaker realization). Nothing cut here would leave the metric satisfiable.
floor_constraint_active: false
floor_constraint_detail: |
  N/A — OK emitted on the merits (every AC traces to the metric), not because a
  floor blocked a valid THIN. For the record: this is a substantial multi-spec
  bundle (3 Drizzle tables + one-txn MandateService.create/configure + POST API +
  shared Zod + create-form page), comfortably above the multi-spec floor; no split
  was warranted regardless of floor.

# AC-by-AC trace (all KEEP)
ac_trace:
  - ac: mandates table (seller/target profile + lifecycle draft/active)
    verdict: keep
    rationale: container the metric's "a sell-side mandate" refers to; absent it, nothing to create.
  - ac: mandate_buyer_criteria table (industry/geo/size/deal-type)
    verdict: keep
    rationale: metric names "with buyer criteria" explicitly; absent it, metric unsatisfiable.
  - ac: mandate_compliance_profile table (jurisdiction/disclaimer/suppression, FK M2)
    verdict: keep
    rationale: metric names "a compliance profile" explicitly; absent it, metric unsatisfiable.
  - ac: MandateService.create/configure (ONE txn writing all 3)
    verdict: keep
    rationale: the atomic write the metric's "create ... with ... and ..." requires; both siblings also depend on it.
  - ac: POST mandate API (M1 RolesGuard advisor + M2 audit last-in-txn)
    verdict: keep
    rationale: the persistence path for "an advisor can create"; RBAC+audit are compliance-first invariants, not polish.
  - ac: shared Zod contracts (@dealflow/shared)
    verdict: keep
    rationale: the create/list/detail DTO contract both siblings consume; splitting fragments the shared surface.
  - ac: mandate-new create form page
    verdict: keep
    rationale: the end-to-end vehicle that makes "an advisor can create" observable; capturing all 3 parts at create is the direct realization of "create ... with ...".

# Gold-plating scan (all clear)
gold_plating_scan:
  lifecycle: capped at draft/active — no advisor-configurable/extra states (H2 pipeline stages already deferred per product-decisions #9).
  criteria_dims: exactly the canonical 4 (industry/geo/size/deal-type) aligned to M3 fields — minimal cohesive set, not extensible-ahead-of-demand.
  compliance_fields: exactly jurisdiction/disclaimer/suppression, capture-only; enforcement deferred to M6 gate — no premature depth.
  scope_boundary: buyer-universe builder correctly NOT absorbed (matches ceo-reviewer HOLD-SCOPE and the metric's separate analyst clause).

# Siblings already correctly split at N-2 (not re-litigated; out of this seed's AC set)
already_split_siblings:
  - id: c070ca23-0a93-4432-9390-d54d54159935
    note: mandates-list — correctly its own sibling (read surface, separable from create write path).
  - id: 50227055-22b6-4457-a694-dbecff7497c3
    note: mandate-detail — correctly its own sibling; already owns the PATCH configure/edit flow, so no further detail-PATCH split is needed.

sibling_visible: false
