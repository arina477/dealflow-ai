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
  0 of 3 tasks done — this is M6's FIRST bundle (M6 freshly in_progress, 0 pre-existing
  child rows). No M6 scope shipped yet. This slice targets the "compliance-checked,
  approved" + "recorded immutably in the audit log" clauses of the metric; the "send,"
  "tracked," "recordkeeping export," and "pipeline" clauses are explicitly deferred to
  later M6 bundles (already documented in product-decisions 2026-07-04 M6-bundle entry).

# OK — current scope is well-classified; every AC traces to the compliance-first slice
# the metric names. The load-bearing invariants (version-binding, SoD, non-bypassable
# server-side pre-send gate) are the moat and are correctly KEPT. The only two ACs that
# looked splittable (compliance-queue UI, richer template metadata) are NOT in scope —
# they are ALREADY deferred to later M6 bundles per the seed/sibling HARD boundaries.
# Nothing in the proposed 3-task scope is gold-plating relative to the slice metric.
ok_rationale: |
  Every AC in the 3-task bundle traces to the slice's mvp-critical floor — "a versioned
  approved compliance-safe template + a non-bypassable server-side pre-send gate composing
  from it + SoD." I found NO splittable AC: the candidates flagged for weighing are either
  (a) load-bearing compliance invariants that the metric's "compliance-checked, approved"
  clause depends on and that default-to-KEEP under the moat rule, or (b) already deferred
  out of this bundle by the seed/sibling HARD boundaries. This is a well-classified,
  minimum-coherent compliance slice — not over-packed. Detailed per-AC trace below.
floor_constraint_active: false
floor_constraint_detail: |
  n/a — OK was NOT floor-blocked. This is a genuine "already-thin, well-classified" OK,
  not a THIN suppressed by the floor. (For reference: bundle est. ~3,000–4,500 net LOC /
  ≤~50 files per the decomposition log — comfortably above the multi-spec 2,500 LOC / ≥6-spec
  floor, so a THIN would have been permissible on size grounds had a splittable AC existed.
  None did.)

# ── Per-AC trace test (kept for head-product; every AC judged against the metric) ──
per_ac_trace:
  seed_102a2f00:
    - ac: "outreach_templates + outreach_template_versions schema (version_number, subject/body, content_hash, required-compliance-block FK→M2 disclaimer_templates, approval_status, approval-version-binding column)"
      trace: KEEP
      why: "This IS the approved-template container the metric's 'approved' clause reads. Absent it, no compliant message can be composed — metric unsatisfiable. The approval-version-binding column + content_hash are not metadata polish; they ARE the version-binding invariant's storage. mvp-critical."
    - ac: "TemplateService create/draftNewVersion/requestApproval + version-binding invariant ASSERTED IN SERVICE (edited approved body mints new version, invalidates approval; usable-for-send only when approved AND hash matches)"
      trace: KEEP
      why: "Compliance-critical moat. This is the exact mechanism that stops an edited-but-unapproved body reaching a send-eligible draft. A UI-only guard would be wrong-layer/validation-theater on a server-side send path. Default-to-KEEP under the moat rule; also directly gates the metric's 'approved' clause."
    - ac: "required-compliance-block enforcement at draft time (cannot requestApproval without the mandate/jurisdiction required disclaimer block from M2)"
      trace: KEEP
      why: "Weighed as a possible sibling — refused. 'compliance-checked, approved' in the metric means the approved artifact ALREADY carries its required disclaimer; deferring this would let a template be approved WITHOUT its mandatory compliance block, breaking the mvp-critical claim for THIS slice (an approved template that is NOT compliance-safe). It reuses the shipped M2 table (no new store), so it is cheap and load-bearing, not gold-plating. mvp-critical."
    - ac: "RBAC via M1 RolesGuard (advisor/analyst draft; compliance approves — approver-is-compliance-role guard) + every mutation audited via M2 AuditService.append LAST-IN-TXN with actor id"
      trace: KEEP
      why: "The audit half directly satisfies the metric's 'recorded immutably in the tamper-evident audit log' clause. The approver-is-compliance-role guard is the standing precedent (product-decisions: admin cannot approve). Both mvp-critical."
    - ac: "templates-library page (list + per-version status + version-history view + draft/new-version editor showing required-block presence + request-approval action)"
      trace: KEEP (do NOT thin the editor out)
      why: "Weighed the sharpest candidate: 'defer the draft editor, ship version-history-view only.' REFUSED. The metric requires an APPROVED template to exist; approval cannot happen without a create/draft + request-approval surface. A read-only version-history view alone cannot PRODUCE the approved template the composer reads — it would leave the metric unsatisfiable with no server-authoring alternative in this bundle. The editor is the minimum surface that produces the approvable artifact, and the required-block-presence display is what makes the compliance enforcement legible at draft time. mvp-critical, not polish."
  sibling_e90a4a99:
    - ac: "outreach_messages/draft + compliance_gate_verdicts schema; OutreachComposerService.composeFromTemplate (reads approved-AND-hash-matched version, populates from M5 deterministic shortlist, per-recipient personalization, persists draft)"
      trace: KEEP
      why: "The composer is what turns an approved template into a to-a-shortlist message — the metric's 'to a shortlist' clause. Reading only an approved+hash-matched version re-enforces the moat invariant at compose time. mvp-critical."
    - ac: "ComplianceGateService.evaluate — structurally NON-BYPASSABLE, SERVER-SIDE, consumes M2 rules engine, writes pass/block verdict to M2 audit log IN-TXN; draft cannot become send-eligible except through a passing verdict"
      trace: KEEP (the load-bearing wedge — do NOT thin)
      why: "This is THE compliance-first wedge and the metric's 'compliance-checked' clause. Non-bypassability + server-side enforcement is the whole point of the slice; thinning the gate would gut the milestone's reason to exist. Absolute mvp-critical."
    - ac: "outreach-composer page (pick approved template + ready-for-outreach shortlist, preview personalized, run pre-send check, see pass/block verdict with per-rule reasons, non-dismissible on block)"
      trace: KEEP (weighed 'thin the composer UI, keep the server gate' — REFUSED)
      why: "The candidate to make the composer UI thinner while keeping only the server gate was considered. REFUSED: the metric's actor is 'an advisor' who must be able to compose-and-check — there is no other surface in this bundle where that happens. The non-dismissible block-verdict display is the compliance UX contract (a dismissible block would defeat the gate at the presentation layer). This is the minimum operator surface for the gate, not decoration. mvp-critical."
  sibling_2601ba33:
    - ac: "Separation of Duties asserted SERVER-SIDE (approver != composer/sender; admin cannot self-approve), enforced in service layer, self-approval rejected + audited"
      trace: KEEP (weighed 'defer full SoD, rely on seed's approver-is-compliance-role guard' — REFUSED)
      why: "The metric names 'approved' outreach; the seed's approver-is-compliance-role guard ensures the RIGHT ROLE approves but NOT that a DIFFERENT PERSON approves — a single compliance-role advisor could self-approve their own send without the sender!=approver assertion. That would make 'approved' meaningless for the compliance-first slice. Full sender!=approver is the mvp-critical completion of the approval invariant, and product-decisions + the wave-10-close BOARD conditions demanded it AT SPEC TIME. Do NOT defer. mvp-critical."
    - ac: "Template version-binding enforced at compose + send-eligibility (composer and gate refuse any version whose content_hash != approved-against hash; mid-flight edit cannot leak unapproved body)"
      trace: KEEP
      why: "Defense-in-depth re-assertion of the seed's invariant at the two downstream read points. Compliance-critical moat; the edited-body-leak is a real breach path. mvp-critical."
    - ac: "Extend composer + library UI to surface approver-identity / version-match state / 're-approval required' state, non-dismissible where compliance-blocking"
      trace: KEEP
      why: "This is the visible enforcement of the two invariants above — the operator must SEE that approval is invalidated or that approver differs from composer. It is the presentation contract for compliance controls that already exist server-side this bundle, not net-new scope. mvp-critical (thin, and coupled to invariants shipping in the same bundle)."

# ── Candidates explicitly weighed for SPLIT and why NONE qualified ──
split_candidates_rejected:
  - candidate: "compliance-queue (standalone approval-queue screen)"
    disposition: "NOT in this bundle's scope — already deferred to a later M6 bundle by all three tasks' HARD boundaries. The SoD ENFORCEMENT lands here; the dedicated queue UI is later. Nothing to split."
  - candidate: "richer template metadata / approval states beyond pending/approved/rejected"
    disposition: "Not present. Approval_status is exactly pending/approved/rejected; version metadata is exactly version_number/content_hash/approval-binding. No gold-plating to peel."
  - candidate: "templates-library editor -> version-history-view-only"
    disposition: "REFUSED (see seed trace) — the editor is the minimum surface that produces the approvable artifact the metric requires; a read-only view cannot satisfy 'approved template exists.'"
  - candidate: "composer UI thinner, keep only server gate"
    disposition: "REFUSED (see sibling-1 trace) — 'an advisor' in the metric needs the compose+check surface; non-dismissible block display is the compliance UX contract."
  - candidate: "defer full sender!=approver SoD, keep seed's approver-is-compliance-role guard"
    disposition: "REFUSED (see sibling-2 trace) — approver-is-compliance-role does not prevent self-approval; sender!=approver is the mvp-critical completion of 'approved,' demanded at spec time."
  - candidate: "compliant SEND + email-provider SDK + tracking / recordkeeping-export / pipeline"
    disposition: "NOT in scope — deferred to later M6 bundles (own external-SDK + spend gate for send). These are the metric's 'send / tracked / export / pipeline' clauses, correctly NOT part of THIS first slice. Cross-bundle, not an AC to peel."

sibling_visible: false
