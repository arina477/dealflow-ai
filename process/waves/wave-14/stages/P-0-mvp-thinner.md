verdict: OK
verdict_source: mvp-thinner
milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
milestone_title: "M6 — Compliant outreach & pipeline (one live mandate, end-to-end)"
milestone_class: product-feature
milestone_success_metric: |
  An advisor can send a compliance-checked, approved, tracked outreach to a shortlist;
  every message is recorded immutably in the tamper-evident audit log; compliance can
  export a verifiable recordkeeping package; replies/opens advance buyers through the
  pipeline — i.e. ONE live mandate flows sourcing to match to compliant outreach to
  pipeline end-to-end.
mvp_critical_status: |
  M6 is in_progress with 9 of 12 tasks done; this bundle (3 tasks: 07bd1e1a seed +
  487b0f0c, f5074df8 siblings) is the buildable-without-credential compliance-hardening
  remainder. The DEFERRED M6 scope (compliant SEND + email SDK + webhook tracking, LLM
  drafting) remains founder-gated and correctly out of scope — those are the milestone's
  genuinely-blocked mvp-critical items, not this bundle's concern.

ok_rationale: |
  Every AC in this bundle traces cleanly to an M6 success-metric clause. The seed e2e
  (07bd1e1a) + gate-attribution fix (487b0f0c) are a LINKED, unambiguously mvp-critical
  pair for the "compliance can export a verifiable recordkeeping package" clause: the
  e2e is HARD-GATED (the mandate-scoped export must not back a live regulator request
  until it lands) and the gate-fix is what makes the gate-evaluate allow/block decision
  mandate-attributable so the e2e's capture assertion can be true — together they make
  the mandate-scoped export TRUSTWORTHY, which is the compliance wedge's defensibility
  proof. Neither is deferrable without leaving the export claim unverified.

  The ONE AC that survives the trace test as a candidate to split is f5074df8
  (/compliance/queue approval-queue page). The sender!=approver SoD ENFORCEMENT already
  shipped server-side (wave-11 task 2601ba33), so a message can be approved and become
  send-eligible without this dedicated screen — the metric clause "send a
  compliance-checked, APPROVED, tracked outreach" is already satisfiable at the
  enforcement layer. The queue is a genuinely-NEW distinct page (not a duplicate of the
  shipped audit-log or compliance-settings screens) but it is a first-class review
  CONVENIENCE surface over already-persisted pending-approval records — nice-to-have by
  the trace test, and thus a candidate to peel into a sibling.

  BUT THE FLOOR BLOCKS THE PEEL. See floor_constraint_detail. Peeling f5074df8 pushes
  the residual wave below its multi-spec floor, leaving a test-heavy 2-task remainder
  (a test + a targeted producer change) that would trip RESCOPE-AUTO-MERGE at P-1. The
  three tasks also form a coherent compliance-hardening vertical (export trustworthiness
  + the last M6 approval-review surface), and thinning here would fragment that slice
  without shrinking total wave size (which is P-1's authority, not mine). No THIN.
floor_constraint_active: true
floor_constraint_detail: |
  wave_type: multi-spec (claimed_task_ids.length == 3).
  Applicable floor (P-1-decompose § Minimum size floor): net LOC > 2,500 OR
  claimed_task_ids >= 6 (whichever first).
  current_wave_loc_estimate: ~2,800 net LOC / ~20 files (head-next estimate).
  would-have-split AC: f5074df8 (/compliance/queue page) — full role-scoped page
    (sibling of design/audit-log-export.html, 641-line HTML ref) + GET queue endpoint
    + approve/reject mutation endpoints + M1 RolesGuard RBAC + sender!=approver SoD
    assertion + M2 AuditService audit-in-txn + tests. Estimated ~900-1,200 net LOC.
  residual_after_split: ~2,800 - ~1,000 = ~1,600-1,900 net LOC across 2 tasks
    (07bd1e1a e2e [test — small alone] + 487b0f0c gate-fix [targeted producer change]).
  floor_threshold: 2,500 net LOC (multi-spec). residual ~1,800 < 2,500 → BELOW FLOOR.
    claimed_task_ids also drops 3 → 2 (< 6, the alternative floor). Both floor branches
    fail. The split would force a RESCOPE-AUTO-MERGE at P-1 — refuse per mvp-thinner
    § Floor-awareness (mandatory pre-check). If head-product judges the floor to be
    genuinely blocking the right call, it may override; mvp-thinner defers to P-1's
    size authority and emits OK.

sibling_visible: false
