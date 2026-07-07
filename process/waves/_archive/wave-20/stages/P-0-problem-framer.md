verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause: an internal manual-touch activity ledger is the correct
  causal slice of "multi-channel outreach." The cause of the advisor problem is
  "manual outreach touches (call / email / LinkedIn) leave no first-class record
  in the deal system," not "we lack an ESP integration." Logging touches
  advisors already perform is a real workflow surface, not a vanity feature, and
  it is credential-free — no external SEND, no provider API / ESP / LLM / SDK is
  smuggled in. The founder-gated external-send slice is correctly held OUT of
  scope. Framing is sound; the four tasks (mutable table -> service -> shared-Zod
  contracts -> RBAC API + /outreach UI) are a coherent vertical slice, not a
  demo-path or premature abstraction. No catalog antipattern matches.

  Audit-and-WORM invariant is framed correctly: mutations append to the M2 HMAC
  chain (audit-trailed) WITHOUT wiring outreach_activity itself into the
  immutable WORM chain — the table stays updatable (dueAt/completedAt/status),
  which is the right shape for a mutable ledger. Migration safety (additive-only,
  populated-DB test GAP-4, distinct enum names per the wave-11 cluster lesson) is
  the correct set of guards for the first mutable M9 write surface.

  /outreach is a genuine new form surface (a create/edit panel) with no existing
  design in design/ — it should carry a design_gap flag into P-1 so the D-block
  runs. This is a note for P-1 sizing, not a reframe trigger.

proposed_reframe: |
  n/a (PROCEED). One factual correction to fold into the P-2 spec so it does not
  send Build chasing a string that does not exist — see FLAG below. This does not
  change the problem framing or the verdict.

escalation_reason: |
  n/a

# ---------------------------------------------------------------------------
# FLAG — write-path isolation (the crux). Verified against migration SQL.
# ---------------------------------------------------------------------------
# STATUS: write-path fail-closed is SATISFIED by the existing M8 policies, but
# the task framing's WORDING is inaccurate and must be corrected in the spec.
#
# What the task claims: "the M8 policy copies USING -> WITH CHECK (so writes are
# gated)." What the SQL actually contains: there is NO literal WITH CHECK clause
# anywhere in migrations 0014..0017. `grep -rin "with check" *.sql` returns zero
# hits. Every workspace_isolation policy is:
#     CREATE POLICY "workspace_isolation" ON "<table>"
#         USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
#   - 0014 (apps/api/src/db/migrations/0014_workspace_isolation.sql:372-390...) —
#     USING-only, ::uuid cast.
#   - 0017 (apps/api/src/db/migrations/0017_rls_policy_empty_string_fix.sql) —
#     DROP+CREATE all 28 policies, still USING-only, NULLIF(...)::uuid.
#   - NO `FOR` clause on any policy -> PostgreSQL defaults each to FOR ALL.
#
# WHY THIS IS STILL FAIL-CLOSED ON WRITES (the security outcome the task asserts
# IS correct, the mechanism differs): For a FOR ALL policy with WITH CHECK
# OMITTED, PostgreSQL 16 DERIVES the write-time WITH CHECK from the USING
# expression (CREATE POLICY docs: "If ... no separate WITH CHECK expression is
# defined, then the USING expression will be used both to determine which rows
# are visible and which new rows will be allowed to be added"). So an INSERT or
# UPDATE that carries firm B's workspace_id while the GUC holds firm A's
# workspace_id fails the DERIVED check -> error -> row rejected. Fail-closed on
# writes holds for outreach_activity PROVIDED it is created as FOR ALL (or left
# command-unspecified, which defaults to ALL) with the same USING predicate.
#
# ACTIONABLE FOR P-2 SPEC (not a blocker; a precision requirement):
#   1. The new outreach_activity policy MUST be authored FOR ALL (or command-
#      unspecified) with USING (workspace_id = NULLIF(current_setting(
#      'app.workspace_id', true), '')::uuid) to inherit the derived write check.
#      If it is authored FOR SELECT, the derived WITH CHECK does NOT apply and a
#      cross-firm write leak IS created for this table.
#   2. The RLS negative-test spec MUST include a WRITE-path case, not only the
#      A-invisible-to-B read case: firm A's GUC set, attempt INSERT and UPDATE
#      carrying firm B's workspace_id -> expect rejection (0 rows / error). A
#      read-only RLS test will pass even if write isolation is silently broken.
#   3. The spec MUST NOT instruct Build to grep for / add a literal "WITH CHECK"
#      to match M8 — M8 has none. Adding a divergent explicit WITH CHECK here
#      would fork this table's write predicate from the other 28 tables. Match
#      the established USING-only + FOR ALL pattern exactly.
#
# This is the GAP-2 write-path-fail-closed concern (re-homed to M11): it is NOT
# a blocker HERE because the FOR ALL + USING derivation already gates writes.
# It becomes a blocker ONLY if the new policy is authored FOR SELECT or with a
# divergent WITH CHECK. Enforce via requirements (1) and (2) at P-2, verify at
# T (write-path RLS negative test) and V.

sibling_visible: false
