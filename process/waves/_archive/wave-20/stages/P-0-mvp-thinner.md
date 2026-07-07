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
  This wave does NOT trace to that directional prose at all; it delivers a
  DIFFERENT ## Scope thread — "multi-channel outreach (LinkedIn/phone tasks)" —
  in its credential-free / spend-free form: an INTERNAL manual outreach-activity
  tracker. The wave's mvp-critical claim is therefore qualitative and self-
  standing: an advisor can log the manual touches (call/email/LinkedIn) they
  already make as internal records, and see their open ones.)
mvp_critical_status: |
  N of M still pending — this is M9's THIRD bundle. Two prior M9 bundles are
  fully DONE and live: the analytics/insight vertical (seed a5ba8068 + 9e05828b
  + 4b014689, wave-18) and the match-calibration feedback vertical (seed
  5568ad44 + 69387b56 + e206a56a + 077974a2, wave-19). This wave lays a NEW
  vertical — the internal outreach-activity tracker — as a fresh 4-task bundle:
  seed d45c73b5 (mutable table + additive migration) + 3 siblings: c3776cac
  (shared-Zod contracts), 5c12ac3a (RLS + audit-logged service), b2acf4ce
  (RBAC API + /outreach panel) — all todo. The CRM-sync leg (345dfbc6) stays
  founder-gated + deferred; a spec/test-hardening follow-up (1d95cac0) is open
  but does not advance defining scope. This bundle's own mvp-critical set is
  being laid down now.

# OK — the 4-task vertical (table -> contracts -> service -> API+UI) is the
# minimum coherent slice for "advisors log + see their manual touches";
# thinning any of the 4 transport layers breaks the claim. WITHIN the seed's
# field/link/index richness, no element is a safe split against (a) the _TBD/
# UNRATIFIED metric and (b) the near-zero build cost / high re-thread cost of
# the only candidate columns. This mirrors the wave-19 OK, not the wave-18 THIN
# — the cost profile is inverted (see rationale).

ok_rationale: |
  Every AC traces cleanly to the wave's own mvp-critical floor. The 4 tasks form
  a standard vertical spine (mutable table + additive migration -> shared-Zod
  contracts -> RLS + audit-logged service -> RBAC API + /outreach panel); each
  is load-bearing. Cut the service, API, or UI and "advisors can log + SEE their
  touches" is unsatisfiable; cut the table and there is nothing to log against.
  The 4-task spine is not a thinness surface — it is the minimum coherent slice.

  The only real thinness surface is WITHIN the seed (d45c73b5), across its field
  / link / index richness. I evaluated each candidate against the wave's mvp
  claim — "create a touch with a channel + status + optional due date, and see my
  open ones":

    FLOOR (mvp-critical, keep):
      - channel enum [call|email|linkedin|other], status enum
        [planned|completed|cancelled], subject NOT NULL, dueAt, completedAt,
        createdBy, workspaceId (RLS FK), timestamps. This is the irreducible
        ledger. Cut any of these and the tracker is uselessly thin (an OVER-CUT).
      - (workspace_id, status, due_at) "my open touches" index. This directly
        implements the success verb "see my OPEN ones" — the read that
        distinguishes a useful ledger from a write-only log. It is ONE index()
        line. Cutting it is OVER-CUT territory, not thinning. mvp-critical.

    CANDIDATE SPLIT SURFACE (examined, DECLINED):
      - The 3-way 0-or-1 deal-target link (outreachId / matchCandidateId /
        pipelineId, all nullable) + the separate nullable mandateId. This is the
        one place a "3-way when 1 would do" gold-plating argument could land. I
        decline to propose splitting it, for four reasons that mirror the wave-19
        precedent (where an analogous within-seed THIN was declined and the OK
        held at P-4):
          1. _TBD/UNRATIFIED metric. My hard rule: a _TBD founder metric forces
             OK-plus-flag. A ratified bar could lean on cross-object touch
             linkage (e.g. "touches per pipeline deal"). Thinning links against
             an unnamed bar risks under-delivery.
          2. Near-ZERO incremental build cost NOW. Three nullable FK columns are
             three `references()` lines inside ONE additive CREATE TABLE. They
             add no CHECK complexity (the seed already relaxes the pipeline-table
             exactly-one CHECK to a soft 0-or-1). Building all three now is
             essentially free.
          3. HIGH re-thread cost LATER. Splitting two of the three FKs to a
             sibling converts a free column into a second additive migration
             (ALTER TABLE ADD COLUMN + FK) PLUS shared-Zod contract churn + service
             field + API field + UI wiring to re-thread the link end-to-end. That
             is re-sequencing overhead, not scope reduction — the exact inversion
             of the wave-18 THIN's cost profile (there, whole metric FAMILIES with
             self-contained aggregate+render facets fell outside the directional
             target; here, individual free columns inside one table).
          4. Product coherence / OVER-CUT risk. An advisor logs a touch against
             whichever deal object is in front of them — sometimes a pipeline
             row, sometimes a match candidate, sometimes a composed-outreach
             thread. "A link to a deal target" is in the wave's OWN problem
             statement. Forcing ONE arbitrary target type at MVP hollows that
             claim and pushes toward OVER-CUT. The 0-or-1 (not 1-of-3-required)
             semantic is already the maximally-lax form; there is nothing left to
             relax without removing linkage capability entirely.

  Net: the wave is well-classified as-is. No sibling split proposed. This is a
  DELIBERATE OK — same direction as wave-19, opposite the wave-18 THIN — because
  the wave-18 split candidates were whole additional metric families outside both
  the directional target and ## Scope ordering (cheap to defer, expensive to
  keep speculatively), whereas THIS wave's only candidates are free nullable
  columns inside one CREATE TABLE (cheap to keep, expensive to defer).

floor_constraint_active: false
floor_constraint_detail: |
  Not the reason for OK. This OK is driven by the _TBD-metric hard rule +
  near-zero-build / high-re-thread cost + OVER-CUT risk on the only candidate
  columns — NOT by a floor computation. No wave-LOC estimate exists at P-0; P-1
  owns sizing. For completeness: even setting the metric aside, the only
  candidate split (2 of 3 deal-target FK columns) would peel a handful of
  nullable-column lines off ONE task while leaving a near-identical residual
  wave (full 4-task spine + table + 1 link + index + D-block), so the split
  would be immaterial to wave size regardless. The split's problem is
  under-delivery + re-thread waste, not floor.

# ESCALATION FLAG for head-product (Action 6 merge + Mediation precedence):
#   The M9 ## Success metric is "_TBD by founder_" (unratified quantitative bar),
#   AND this wave does not even trace to its directional prose — it delivers a
#   DIFFERENT ## Scope thread (internal outreach-activity tracker) whose
#   mvp-critical claim is qualitative and self-standing. Per my hard rules a _TBD
#   metric forces OK-plus-flag; I return OK (not THIN), deliberately matching the
#   wave-19 direction and reversing the wave-18 THIN, because the only within-seed
#   candidate (2 of 3 deal-target FK columns) is (a) near-free to build alongside
#   the rest of the table, (b) high-cost to re-thread if deferred, and (c) at real
#   OVER-CUT risk since "link to a deal target" is the wave's own stated capability.
#   head-product should note: if ceo-reviewer proposes SCOPE-EXPANSION on the same
#   wave, there is no mvp-thinner THIN to mediate against — I concur the current
#   4-task / full-field-and-link scope is the right minimum coherent slice. Per
#   the Mediation precedence rule, M9 still has open child tasks under active
#   mvp-critical scope (this whole bundle is todo), which favors mvp-thinner on
#   ties — but there is no tie to resolve here since I emit OK. If the founder
#   later ratifies a quantitative bar that leans AWAY from cross-object touch
#   linkage, a future wave may revisit; that is metric-ratification, not a
#   thinness cut to make now.
sibling_visible: false
