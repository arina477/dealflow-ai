verdict: OK
verdict_source: mvp-thinner
milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
milestone_title: M7 — Admin & settings
milestone_class: product-feature
milestone_success_metric: |
  An admin can connect a data source, invite users and assign roles, and verify a
  sending domain so the firm can send compliant outreach.
mvp_critical_status: |
  0 of M7's tasks done — this is M7's FIRST vertical (promoted todo→in_progress at
  wave-14 close, product-decision #330). The success metric's three admin clauses map:
  (1) "connect a data source" → 41c017f7 (buildable-without-credential half: add/enable
  + encrypted-credential store; live connection-test is #-deferred, credential-seamed);
  (2) "invite users and assign roles" → 82ec8724 (seed); (3) "verify a sending domain"
  → correctly NOT in this bundle (ESP-minted DKIM/SPF/DMARC record generation + live-
  verify is credential-seamed with product-decision #141, same stockout blocking M6 send).
  Two of three buildable metric clauses are load-bearing in THIS bundle; the third is
  honestly deferred.

# OK — every AC traces to the M7 mvp-critical floor; the one genuinely deferrable AC
# is blocked from splitting by the multi-spec LOC floor (see floor_constraint_detail).

ok_rationale: |
  Three of four ACs trace cleanly to the M7 success metric and are mvp-critical:
  82ec8724 (user-management seed) satisfies "invite users and assign roles" verbatim;
  41c017f7 (data-source connection admin) satisfies "connect a data source" (the
  buildable-without-credential half — the live connection-TEST is correctly deferred,
  not the connection/credential store itself); 648a86a6 (workspace + firm-profile +
  DEFAULT COMPLIANCE PROFILE cascade) is retained under the in-doubt-keep rule — the
  default-compliance-profile cascade is what makes new mandates "compliant-by-default,"
  tracing to the metric's "send COMPLIANT outreach" clause, so it is load-bearing for
  the compliance wedge rather than polish. The ONLY genuinely deferrable AC is d7f716b4
  (AppShell placeholder pages for unbuilt role-nav routes + TopBar per-route title) — a
  V-2-triage carry-forward, self-described "Non-blocking," which passes the trace test as
  a nice-to-have (an admin can connect a source / invite users / assign roles regardless
  of whether an unbuilt nav item renders "coming soon" vs a raw 404). A THIN peeling
  d7f716b4 was the indicated call — BUT it is blocked by BOTH the multi-spec LOC floor
  (below) AND partial coupling: d7f716b4's compliance-relevant half (the DB-authoritative
  RBAC role re-verify black-box test) is ALREADY fused to the seed per product-decision
  #340 and appears verbatim in 82ec8724's P-4 flags. Only the ~150-250 LOC placeholder/
  title-polish remainder is separable, and peeling it drops the wave under floor. No
  cross-milestone move is warranted; no AC belongs elsewhere.
floor_constraint_active: true
floor_constraint_detail: |
  wave_type: multi-spec (claimed_task_ids.length == 4). Applicable floor: net LOC > 2,500
  OR >= 6 specs (per P-1-decompose § Minimum size floor). Spec-count floor not in play
  (4 < 6), so the LOC floor governs.
  current_wave_loc_estimate: ~2,650 net LOC (seed 82ec8724 ~900 [additive users column +
    UserManagementService + last-admin locking-count guard + SoD + RBAC + WORM audit +
    admin-users page + Zod DTOs]; 648a86a6 ~800 [workspace_settings + default_compliance_
    profile schema + service + cascade validation + admin-workspace-settings page];
    41c017f7 ~700 [encrypted_credentials column + envelope-encryption + admin service +
    admin-integrations page + masked credential form]; d7f716b4 ~250 [placeholder route +
    coming-soon component + route→title map]).
  would-have-split (d7f716b4 polish remainder only, RBAC re-verify excluded as seed-fused):
    ~150-250 LOC.
  residual_after_split: ~2,400-2,500 LOC — AT OR BELOW the 2,500 multi-spec floor.
  floor_threshold: 2,500 net LOC (multi-spec).
  conclusion: The peel-off pushes residual to/under floor, which would force P-1
  RESCOPE-AUTO-MERGE to re-author a replacement sibling — net-zero to negative. The
  founder-correct outcome is to KEEP d7f716b4 riding with the seed (its admin-users /
  admin-workspace-settings pages replace exactly the "Team"/"Settings" nav placeholders
  it describes, and the seed's live role-mutation flow is the very path it flagged for the
  RBAC re-verify). Floor blocks the split; emitting OK per the floor-awareness mandate.

sibling_visible: false
