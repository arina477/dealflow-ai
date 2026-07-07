verdict: OK
verdict_source: mvp-thinner
milestone_id: 099cee10-562d-4e56-9a57-0dade2914760
milestone_title: M9 — Integrations & insight
milestone_class: product-feature
milestone_success_metric: |
  "_TBD by founder_ — target: advisors sync to their existing CRM and see
  response/throughput analytics."
  (Quantitative bar is founder-DEFERRED/UNRATIFIED. The CRM-sync leg is
  founder-gated + deferred — task 345dfbc6, vendor spend + account-issued key.
  This wave delivers the ## Scope item "matching feedback loop (learn from
  accept/reject)" — the calibration/insight half. The wave's mvp-critical claim
  is qualitative: advisors see whether the deterministic match score predicts
  their accept/reject decisions.)
mvp_critical_status: |
  N of M still pending — M9's analytics/insight thread. The first M9 bundle
  (analytics vertical: seed a5ba8068 + siblings 9e05828b + 4b014689) is DONE and
  live (wave-18). This wave lays a NEW vertical (match-calibration feedback) as a
  fresh 4-task bundle: seed 5568ad44 (aggregation) + 3 siblings — 69387b56
  (shared-Zod contracts), e206a56a (RBAC API), 077974a2 (/insights section) —
  all todo. The CRM-sync leg (345dfbc6) stays founder-gated + deferred. This
  bundle's own mvp-critical set is being laid down now.

# OK — current scope is well-classified. The 4-task vertical
# (aggregation → contracts → API → dashboard-section) is the minimum coherent
# slice for "advisors SEE the calibration"; thinning any of the 4 transport
# layers breaks the success-metric verb "see". WITHIN the seed's 3 calibration
# metric families, no family is a safe split against the (a) _TBD/UNRATIFIED
# metric and (b) the "calibration" mvp-critical claim itself.

ok_rationale: |
  Every AC traces cleanly to the wave's mvp-critical floor. The 4 tasks form a
  standard vertical spine (aggregation service → shared-Zod contracts → RBAC API
  → /insights section); each of the four is load-bearing — cut the API or the
  dashboard section and "advisors SEE whether the score predicts their
  decisions" is unsatisfiable. The only real thinness surface is WITHIN the seed
  (5568ad44), across its three calibration metric families:
    (1) acceptance rate bucketed by fit_score band — the OVERALL "does the score
        predict accept/reject" correlation. This IS the mvp floor for the claim.
        mvp-critical.
    (2) per-score-dimension lift — mean sectorMatch / contactCompleteness /
        tieBreak contribution among accepted vs rejected candidates. This is the
        candidate split surface.
    (3) reviewed-vs-pending coverage — how much reviewed data underlies (1). A
        cheap denominator/honesty stat that keeps (1) from misleading.
        mvp-critical (honest-not-yet-tracked posture is a hard M9 acceptance
        criterion per product-decision line 400).
  I decline to propose splitting family (2) — a THIN here is UNSAFE, for four
  reasons that mirror the wave-18 precedent (where an analogous THIN split on the
  sibling analytics vertical was REJECTED at P-0 and ratifiable at P-4):
    1. The M9 ## Success metric is "_TBD by founder_". My hard rule: a _TBD /
       unratified metric forces OK-plus-flag, because a founder-ratified bar
       could depend on the very family I'd propose to cut. Thinning against an
       unnamed bar risks under-delivering.
    2. The data for all three families EXISTS and is LIVE — score_breakdown JSONB
       (sectorMatch/contactCompleteness/tieBreak) shipped + RLS-scoped in
       wave-17. All three are buildable NOW over the same join.
    3. Per-dimension lift is NOT gold-plating. It is the SAME
       match_candidates⋈match_run join with one additional GROUP-BY over the same
       rows — trivial incremental cost. Splitting it would peel a near-free
       aggregation off ONE service task while adding a second wave's contract +
       API + dashboard-section churn to re-thread it later. That is
       re-sequencing overhead, not scope reduction.
    4. Per-dimension lift is arguably PART OF the "calibration" mvp-critical claim
       rather than adjacent to it. "Which score dimension actually tracks
       acceptance" is the substance of calibration insight; family (1) alone
       ("higher band → higher acceptance?") answers a shallower question. Cutting
       (2) risks OVER-CUT (hollowing the calibration claim to a single-axis
       correlation), which is the opposite failure mode from the one I exist to
       prevent. The mvp floor here is plausibly all three families, not the
       band-only cut.
  Net: the wave is well-classified as-is. No sibling split proposed.

floor_constraint_active: false
floor_constraint_detail: |
  Not the reason for OK. This OK is driven by the _TBD-metric hard rule + the
  calibration-claim / OVER-CUT risk (reasons 1 and 4 above), NOT by a floor
  computation. No wave-LOC estimate exists at P-0; P-1 owns sizing. Note for
  completeness: the only candidate split (family (2) per-dimension lift) is a
  single additional GROUP-BY aggregation within one service task — peeling it
  would leave a near-identical residual wave (full spine + 2 of 3 families + full
  contracts/API/section + D-block), so even setting the metric aside the split
  would be immaterial to wave size. The split's problem is under-delivery risk,
  not floor.

# ESCALATION FLAG for head-product (Action 6 merge + Mediation precedence):
#   The M9 ## Success metric is "_TBD by founder_" (unratified quantitative bar).
#   Per my hard rules, a _TBD metric forces OK-plus-flag — I cannot do thinness
#   analysis against an unnamed bar without risking under-delivery. I return OK
#   (not THIN) here, DELIBERATELY reversing the direction the wave-18 THIN took on
#   the sibling analytics vertical — because on THIS wave the only candidate split
#   (per-dimension lift) is (a) near-free to build alongside the band correlation,
#   (b) plausibly part of the mvp-critical "calibration" claim itself rather than
#   adjacent to it, and (c) backed by the SAME four rejection factors that led
#   P-0/P-4 to REJECT the wave-18 split (unratified metric + all data live +
#   not gold-plating + coherent-slice). head-product should note: if
#   ceo-reviewer proposes SCOPE-EXPANSION on the same wave, there is no
#   mvp-thinner THIN to mediate against — I concur the current 4-task /
#   3-family scope is the right minimum coherent slice. If the founder later
#   ratifies a quantitative bar that leans AWAY from per-dimension calibration
#   (e.g. band-correlation-only), a future wave may revisit; that is a
#   metric-ratification concern, not a thinness cut to make now.
sibling_visible: false
