```yaml
verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause (MANDATORY): the framing treats the CAUSE, not a symptom.
  "One partner firm cannot see another firm's rows" is the goal; app-layer
  WHERE-clause filtering is the symptom-layer shortcut (catalog #1/#2) that leaks
  the moment one query forgets the predicate. The BOARD's guardrail — DB-level
  deny-by-default Postgres RLS keyed on workspace_id, proven by a negative-read
  test — is the correct causal layer: the isolation invariant lives in the DB
  and holds for every query path regardless of ORM discipline. This is the
  textbook fix FOR the multi-tenant-leak antipattern, not an instance of one.
  Scope ("isolation primitive for ONE firm now, not full multi-tenant SaaS") is
  correctly bounded: workspaces anchor + workspace_id column + RLS + per-request
  propagation is the MINIMUM correct isolation set — not premature H3 SaaS
  (no billing/provisioning/self-serve tenancy), and not a false-economy
  half-measure (RLS is the non-leaky floor). The 4-task vertical is coherent and
  correctly layered: schema (1) → policy (2) → the load-bearing session
  propagation (3) → adversarial proof (4). Grounded against the shipped schema:
  adding workspace_id across the tenant tables is additive-compatible with the
  existing single-tenant design, and every task targets the right layer.
proposed_reframe: |
  n/a — PROCEED. The framing is sound. Three non-blocking correctness flags are
  handed forward to P-1/P-2 as spec-contract obligations (NOT reframes; the
  problem is framed right, these are edge/wrong-layer traps the ACs must close so
  the wave doesn't ship a false-green):

  (A) OWNER-BYPASS TRAP — load-bearing, must be an explicit AC. The API runs as
      the TABLE-OWNING Postgres role (migration 0002_steep_boom_boom.sql documents
      "the app role IS the table owner" under Railway's single-role deploy;
      CURRENT_USER = owner). PostgreSQL RLS is BYPASSED by table owners unless
      `ALTER TABLE ... FORCE ROW LEVEL SECURITY` is set. Deny-by-default policies
      WITHOUT force would let the production (owner) connection silently read every
      workspace while a negative-read test run under a NON-owner role passes green —
      classic demo-path false-green (catalog #3). Task 2's AC must require FORCE
      RLS on every scoped table, and task 4's negative-read test MUST execute over
      the SAME role/connection the runtime uses (owner), not a purpose-made
      low-priv role, or the proof is tautological.

  (B) AUDIT-LOG × RLS × WORM INTERACTION — the seed task lists audit_log among the
      tables to add workspace_id + RLS to. audit_log_entries already carries two
      immutability controls (INSERT/SELECT-only grant + BEFORE UPDATE/DELETE/TRUNCATE
      triggers) and a HMAC-SHA256 hash-chain whose preimage is a FIXED, versioned
      field set (chain_version). Adding workspace_id here must be HASH-EXCLUDED
      (follow the exact wave-14 mandate_id precedent: nullable, NOT in
      HashableEntryFields, byte-identical entry_hash over the mixed old/new chain)
      OR chain_version must bump — the spec must pick one explicitly. Also: RLS
      SELECT policies must not break the chain VERIFIER's full-chain walk
      (verification reads across all rows in sequence order); a per-workspace SELECT
      policy that hides rows would make gap-detection see phantom deletions. The
      spec must resolve whether audit verification runs in a policy-exempt context.

  (C) BACKFILL OF EXISTING ROWS — every existing row in users/mandates/
      data_source_connections/outreach/pipeline/audit_log predates workspace_id.
      The migration must backfill to a single default (pilot) workspace and make
      the column NOT NULL only AFTER backfill, else deny-by-default RLS renders all
      pre-existing data invisible/inaccessible on cutover. This is a P-1 sizing
      input, not a scope error (flagged below).
escalation_reason: |
  n/a
sizing_signal: |
  NOT a RESCOPE-AUTO-SPLIT verdict (the vertical is coherent and correctly
  ordered), but P-1 should weigh this as a potentially large wave: RLS + FORCE +
  policy authoring across ~6-8 tenant tables, plus a data backfill migration, plus
  the request-scope propagation plumbing (which does NOT exist today — grep
  confirms zero `current_setting` / `SET LOCAL` / session-var usage anywhere in
  apps/api/src). Task 3 is greenfield plumbing, not a tweak. P-1 owns any split.
sibling_visible: false
```
