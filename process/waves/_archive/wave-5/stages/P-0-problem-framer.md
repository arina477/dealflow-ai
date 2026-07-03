verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause (mandatory): the seed does NOT fix at the symptom layer. The
  symptom would be "an outreach send occasionally went out non-compliant." The
  cause is "there is no single server-side send-eligibility authority, so every
  send path can re-implement (and skip) compliance checks." The seed attacks the
  cause directly — ONE ComplianceGateService.evaluate() as the sole authority that
  outreach MUST call and never re-implements (security.md §Reusability principle 3
  / line 114), backed by the four rules-engine tables that make the policy
  configurable rather than hard-coded. That is the correct layer.

  Wrong-layer / client-side-check antipattern (#2): explicitly avoided. SoD is
  asserted server-side in the send path from approver_user_id != sender_user_id
  reusing the M1 RolesGuard/assertSenderIsNotApprover primitive (security.md
  line 65/104), not client-suppliable. Suppression, disclaimer presence, and
  approval-version match are all evaluated INSIDE the single gate call at send
  time (siblings 95adac6c/034463b1), not advisory compose-time hints. Content-hash
  binding (line 87) prevents approval reuse across modified content — a
  post-approval edit invalidates the approval. Each of these is a hard-block +
  audit, not a soft warning — so validation-theater/advisory-gate antipatterns do
  not apply; these guards sit at a genuine system boundary (the send path).

  Audit integration is correctly framed as an invariant, not an afterthought: the
  gate MUST write its pass/block verdict + rules-fired via the already-shipped
  AuditService.append (a8b2b5a2) in the SAME transaction/outbox as the recorded
  action (security.md line 78/84), closing the "send the thing, forget to log it"
  path. This is the recordkeeping cause, not a symptom bolt-on.

  Non-bypassability over-claim check (the sharpest risk here): the seed does NOT
  over-claim. It is honest that the outreach call-site is M6 and that this wave
  builds the gate as a CALLABLE CONTRACT (the sole authority), with the actual
  "no send path can skip it" enforcement landing when M6 wires every send through
  it. Structural non-bypassability = (a) the gate is the single callable + (b) the
  send endpoint re-runs it server-side at send time (security.md line 84, an M6
  endpoint) + (c) the same-transaction audit write. This wave delivers (a) and the
  gate's half of (c); (b) is correctly deferred to the M6 send endpoint. The seed's
  NOTE ("this is compliance-critical; author ACs that DEMAND non-bypassability +
  SoD but do NOT build that gate here" — i.e. the P-4 security-scope-tightened +
  SoD/RBAC review is deferred to the gate stage, not skipped) keeps the claim
  scoped to what a callable-contract wave can honestly assert. No premature-
  abstraction (#4): the four tables + one service are concrete instances the
  milestone's success metric names, not a speculative DSL.

  Sequencing is correct: building the gate SERVICE + rules CRUD before the M6
  send call-site is the right order — M6's non-bypass wiring has nothing to wire
  through until the callable exists (milestone "Required by: M6, M10"). No
  scope-creep-through-coupling (#5): the four tasks form one vertical slice of
  ONE milestone success metric ("suppression/disclaimer/approval rules are
  configurable AND enforced by a callable pre-send check"), not unrelated changes
  bundled "while we're in there."

  Thin-slice check on the config UI (34cb1d18): correctly scoped to compliance-
  role CRUD for rules/suppression/disclaimers on the EXISTING settings shell
  (031d79fc) — not the full M6 outreach composer. This closes the milestone's
  "configurable" half without pulling M6 scope forward.

  One note for downstream stages (not a reframe — framing is sound, flag for P-2/
  P-4 acceptance-criteria authoring): the honest non-bypassability claim depends
  on the M6 send endpoint actually calling this gate and re-running it server-side
  at send time. P-2 should author the seed's acceptance criteria so the gate
  exposes NO "skippable" fast path (no compose-time-only mode, no caller-supplied
  "already checked" bypass flag), and P-4's security-scope-tightened review should
  record that the send-path enforcement is a tracked M6 dependency so
  "non-bypassable" is not silently downgraded to "callable but uncalled" at
  V-block. This is a healthy carry-forward, not a defect in this wave's framing.
proposed_reframe: |
  n/a — PROCEED. No reframe required.
escalation_reason: |
  n/a
sibling_visible: false
