verdict: OK
verdict_source: mvp-thinner
milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
milestone_title: M7 — Admin & settings
milestone_class: product-feature
milestone_success_metric: |
  An admin can connect a data source, invite users and assign roles, and verify a
  sending domain so the firm can send compliant outreach.
  (Verbatim from M7 ## Success metric. The "verify a sending domain" clause is
  founder-gated / deferred under product-decision #141 — DKIM/SPF/DMARC record
  GENERATION + live-verify is credential-seamed and correctly NOT in this wave's
  scope per product-decision #331.)
mvp_critical_status: |
  M7 is a fresh in_progress milestone (promoted at wave-14 close). Its FIRST vertical
  shipped at wave-15 (user-mgmt invite/role/deactivate + last-admin guard + SoD;
  workspace + firm-profile + default-compliance-profile settings; data-source
  connection admin UI + encrypted-at-rest credential form) — 4 tasks status='done',
  live. This wave-16 bundle is the SECOND M7 vertical: all 5 tasks are V-1-jenny
  follow-ups (F-1/F-3/F-4/F-5/F-6) hardening that shipped-and-live surface.
  Of the metric's three verb clauses: "connect a data source" surface shipped
  (this wave adds its missing nav reachability); "invite users and assign roles"
  shipped (this wave adds dedup + reactivate depth); "verify a sending domain"
  remains founder-gated (#141), untouched by this wave. So: metric NOT yet fully
  satisfiable, but the gap is founder-credential, not buildable AC scope.

# ---------------------------------------------------------------------------
# TRACE-TEST RESULT (per-AC), then FLOOR PRE-CHECK that determines the verdict.
# ---------------------------------------------------------------------------

trace_test_classification:
  mvp_critical_keep:
    - ac: "SEED F-1 — wire firm default-compliance-profile cascade into mandate-create"
      trace: |
        Load-bearing feature gap, NOT the literal metric-verb list but the clause
        "so the firm can send COMPLIANT outreach". Wave-15 shipped workspace-settings
        that PERSIST default_jurisdiction/default_disclaimer/default_suppression, but
        NOTHING consumes them — MandateService never reads the firm default when a
        mandate form omits a field. Absent this AC, a shipped M7 setting is inert:
        the admin configures firm compliance defaults that never reach a mandate.
        That directly undermines the metric's compliance-outreach clause. Keep.
    - ac: "F-3 — admin nav entry / in-app link to /admin/integrations (+ confirm users/settings nav-reachable)"
      trace: |
        Traces to "connect a data source". /admin/integrations renders + is RBAC-gated
        but has NO nav item and no in-page link — reachable ONLY by typing the URL.
        Absent this AC, the "connect a data source" clause is not satisfiable THROUGH
        the product (journey dead-spot). Keep.
  nice_to_have_would_split:
    - ac: "F-4 — invite duplicate/existing-user handling (409 or idempotent)"
      trace: |
        Metric clause "invite users and assign roles" is satisfiable WITHOUT this.
        users_email_unique already prevents duplicate ACCOUNTS (jenny: safety net
        holds, "not load-bearing"). The stated AC is unmet, but its absence does not
        break "an admin can invite users" — a redundant invite is ugly, not a metric
        failure. Trace test = Yes (still satisfiable) → nice-to-have.
    - ac: "F-5 — reactivate / undo path for soft-deactivated users"
      trace: |
        No metric clause requires reactivation. Deactivate already works (soft-delete
        shipped wave-15). "Invite users and assign roles" is satisfiable without an
        undo path. Depth/polish on the user-mgmt surface. Trace test = Yes → nice-to-have.
        NOTE: the EMBEDDED prod-cleanup obligation (restore advisor1@example.com left
        deactivated_at non-null; purge/neutralize the 3 KAREN-V1-SENTINEL throwaway
        prod records WORM-safe) is a LIVE prod-hygiene DEBT, not an AC — it must NOT
        be deferred with the feature and must ride whichever wave executes.
    - ac: "F-6 — guard config JSONB blob against raw secrets"
      trace: |
        No metric clause requires it. jenny: "Low today (admin-only)... forward-looking."
        Admin-only surface, defense-in-depth ahead of demand; the AES-256-GCM
        encrypted-at-rest invariant already covers the dedicated encrypted_credentials
        field. Metric fully satisfiable without it. Trace test = Yes → nice-to-have.

# ---------------------------------------------------------------------------
# The trace test WOULD yield THIN (split F-4/F-5/F-6, keep SEED + F-3).
# The mandatory floor pre-check REFUSES that split. Verdict is therefore OK.
# ---------------------------------------------------------------------------

ok_rationale: |
  A pure trace-to-metric read would peel F-4/F-5/F-6 into siblings and keep only the
  SEED (compliance-default cascade) + F-3 (integrations nav) as mvp-critical. BUT the
  mandatory floor-awareness pre-check refuses that split: the residual wave (2 small
  tasks) collapses far below the minimum size floor, forcing a RESCOPE-AUTO-MERGE at
  P-1 — the exact outcome the floor exists to prevent. F-4/F-5/F-6 are cheap, same-
  surface hardening ACs (all Low/Med, all reading shipped-and-live wave-15 M7
  surfaces) that are materially cheaper to ship together now than to re-wave later.
  All 5 ACs are appropriately-scoped M7 admin-hardening that belongs together; the
  three nice-to-haves are held in by the floor, not by metric-criticality. No cross-
  milestone move is warranted (all 5 are M7-native). No new ACs proposed.
floor_constraint_active: true
floor_constraint_detail: |
  Wave type: multi-spec (5 claimed_task_ids; clears neither the LOC>2,500 nor the
  >=6-task multi-spec trigger automatically — a modest V-2 follow-up bundle).
  Would-have-split ACs: F-4 (invite dedup, Low/Med) + F-5 (reactivate path + UI, Low)
  + F-6 (config JSONB secret guard, Low). Combined these are the bulk of the bundle's
  net LOC; F-4/F-5/F-6 together are the wave's weight.
  Residual after the proposed split = SEED F-1 (MandateService unset-field fallback to
  workspace_settings + one mandate-inherits-firm-default test, est. ~150-300 net LOC)
  + F-3 (admin-only nav section linking 3 admin pages + reachability confirm, est.
  ~80-150 net LOC) ≈ 230-450 net LOC across 2 tasks.
  Floor threshold: a 2-task residual sizes as single-spec → floor is net LOC > 1,500.
  Residual (~230-450) is roughly 3-6x UNDER that floor. The split is refused; the
  three nice-to-haves stay in-wave. head-product may override via the escalation path
  if it judges the floor is genuinely blocking the right call — mvp-thinner's read is
  that it is NOT (the hardening ACs are same-surface and cheap; batching is correct).

sibling_visible: false
