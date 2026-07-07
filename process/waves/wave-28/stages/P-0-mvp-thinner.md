verdict: OK
verdict_source: mvp-thinner
milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
milestone_title: M10 — Advanced compliance & recordkeeping (SOX/FINRA artifacts)
milestone_class: product-feature
milestone_success_metric: |
  LIGHT posture (founder 2026-07-07): a firm admin can, on demand, export a complete
  workspace-scoped, integrity-verifiable record of the firm audit log + deal activity in a
  standard portable format (the export is itself audit-logged); retained records are viewable
  in-app and bounded by a configurable retention window. No formal regulator certification
  required at this stage; raise to a named-regime target only if the compliance classification
  is later raised.
mvp_critical_status: |
  Retention vertical (metric clause 2, "bounded by a configurable retention window") not yet
  shipped — this 4-task bundle IS that vertical. Export vertical shipped (0d2c5f08 endpoint +
  f331a51c page); records-VIEW is a distinct later vertical, not in this bundle. So: the
  configurable-retention-window mvp-critical scope is 0-of-1 done, and this wave delivers it.

# Trace test applied to every proposed AC (seed d3cc1337 + 3 siblings):
#
#  AC-1  workspace_retention_policy table + RLS + ONE additive migration + WORM guardrail
#        -> KEEP (mvp-critical). "configurable retention window" has no config substrate
#           without this row; RLS is the M8 isolation floor (firm A must not read firm B).
#           Absent -> metric clause 2 unsatisfiable.
#  AC-2  shared-Zod retention-policy contracts (packages/shared)
#        -> KEEP (mvp-critical). The single bounds/validation contract both API and UI bind to;
#           removing it de-syncs server + client validation. Cheap, load-bearing.
#  AC-3  retention-policy service + RBAC-scoped API (RLS, audit-logged get/set, WORM-preserving)
#        -> KEEP (mvp-critical). "configurable" requires a set path. RBAC + config-change
#           audit-append + RLS-scoping are the compliance floor of a recordkeeping feature;
#           cutting any of them guts the value and trips OVER-CUT, not THIN. Keep whole.
#  AC-4a settings UI: view + edit the retention window (validation, save/error/empty states)
#        -> KEEP (mvp-critical). API-only does not satisfy "configurable ... window" for a
#           non-technical firm admin; the metric's usability is the admin workflow.
#  AC-4b cutoff-surfacing display (effective cutoff date + beyond/in-window summary)
#        -> KEEP. Only arguable THIN candidate: strictly, set/read the integer window already
#           satisfies "bounded by a configurable retention window," so the derived cutoff-date +
#           in/beyond summary is a surfacing enhancement, not the config itself. BUT it is not
#           split, for two reasons: (1) cheap — a derived date + a count off the SAME API call,
#           no new table/endpoint/service; (2) coherence — without it the settings screen shows a
#           raw integer with no indication of effect, gutting the UI task's stated purpose
#           ("real firm-admin workflow ... sees what's inside vs beyond the window"). It is the
#           MINIMUM surfacing that makes the window mean something; splitting it leaves a hollow
#           settings page. "records VIEW" (browse/filter retained records) is the genuinely
#           deferred surfacing vertical and is correctly already OUT of this bundle. When in
#           doubt, keep (metric-default).

ok_rationale: |
  Every AC traces cleanly to M10's mvp-critical floor: the table+RLS, shared contract, and
  RBAC/audit-logged/RLS-scoped get/set API are the irreducible substrate of "a configurable
  retention window," and the settings+cutoff UI is what makes that window usable by a firm admin
  (metric clause 2). The only THIN-arguable AC (cutoff-surfacing) is a cheap derived display off
  the same API call that completes the surfacing value; splitting it would both fragment a
  coherent vertical slice and, per the floor check below, drop the wave under its multi-spec
  floor. The deferrable surfacing (records-VIEW browse/filter) is already outside this bundle.
floor_constraint_active: true
floor_constraint_detail: |
  This is a multi-spec vertical slice (4 specs: additive migration + shared-Zod contracts +
  service/RBAC-API + settings UI) — already at/near the light-MVP minimum coherent slice. The
  sole viable THIN candidate is the cutoff-surfacing display, an estimated sub-~100-LOC derived
  view (cutoff date + in/beyond count computed from the existing get-policy response, no new
  endpoint or table). residual_loc after peeling it = current_wave_loc - ~<100, which both (a)
  strands the settings UI as a raw-integer screen (coherence loss) and (b) provides no
  standalone sibling worth a wave. Floor + slice-coherence jointly block the split; refuse THIN,
  emit OK.

sibling_visible: false
