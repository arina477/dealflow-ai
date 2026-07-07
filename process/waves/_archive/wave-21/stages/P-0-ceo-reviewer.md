verdict: SCOPE-REDUCTION
verdict_source: ceo-reviewer
mode_applied: SCOPE-REDUCTION
mode_rationale: |
  Not HOLD-SCOPE: 3 of the seed's 4 items (B verify-metric-computable, D predictive-vs-noise,
  E low-n-caveat) are ALREADY captured verbatim-in-substance by promoted PRODUCT-PRINCIPLES #1
  ("must have a real source column, not be noise by construction, and qualify low-n cases").
  Re-authoring them as fresh spec-hardening rules is process-theater against an already-live
  principle. Not SCOPE-EXPANSION: the CRM is founder-blocked and seller-intent needs next-wave
  decomposition, so there is no adjacent product capability to reach for here. Not DROP: item (C)
  — the live-authed-check deferral — is a genuine, thrice-recurring V/T limitation (waves 18-20,
  test-accounts.md confirmed empty) that costs real rediscovery each wave and traces to the
  compliance backbone. The right move is to strip the wave to (C) plus a one-line pointer that
  B/D/E are covered by PRODUCT #1, not to re-litigate the covered three.
bet_traced_to: Compliance-first outreach is a durable wedge for M&A advisory
milestone_traced_to: 099cee10-562d-4e56-9a57-0dade2914760 — M9 — Integrations & insight (in_progress)
proposed_scope_change: |
  KEEP the wave (idle is the only alternative — CRM founder-blocked, seller-intent not yet
  decomposable), but reduce its content to a single load-bearing deliverable:

  (C) Resolve the recurring live-authed-check deferral by DECLARING CI-e2e-authoritative for the
      isolation / RBAC / SoD invariants, up front, as a written testing-strategy statement in
      command-center/testing/test-writing-principles.md (§ 14 already points at test-accounts.md).
      This stops V/T from re-discovering "no authed fixture, defer the live check" every wave.

  AMBITION FLOOR for (C) — this is the correct 6-8/10, and the floor should NOT be raised:
    - DO NOT provision real prod/staging authed credentials this wave. Committable fixtures cannot
      carry prod secrets (always-on rule 2); a real advisor+admin authed fixture against prod auth
      is credential-constrained and risky. That is over-ambitious for a process wave and would
      couple a de-risking wave to a secret-management hazard.
    - DO make the declaration falsifiable: name WHICH invariants CI-e2e is authoritative for
      (tenant isolation, RBAC allow/deny, SoD separation, audit-log HMAC chain), and state the
      explicit condition under which a real authed fixture WOULD be required later (e.g., a
      prod-only invariant CI cannot exercise). A bare "we'll rely on CI" with no invariant list or
      trigger is under-ambitious and will not stop the next rediscovery.

  B/D/E: reduce to a one-line cross-reference to PRODUCT-PRINCIPLES #1 in the same doc; do NOT
  author new principle rows for them (L-2 promotes AT MOST ONE rule/wave anyway, and #1 already
  holds the ground). Guard against the seed's own risk note — no re-authoring of shipped specs.
drop_rationale: |
  (n/a — the wave is worth keeping at reduced scope; only the B/D/E re-authoring is dropped, not
  the wave.)
escalation_reason: |
  (n/a)
sibling_visible: false
