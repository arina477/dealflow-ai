verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
symptom_vs_cause: |
  Ran (mandatory). Not a symptom fix — this is a net-new capability (M10's first
  recordkeeping-export vertical), not a patch over a surface symptom. The framing
  operates at the correct layers: DB (RLS-scoped read via getDb), API (RBAC-gated
  controller alongside the existing compliance surface), integrity (M2 verifyChain),
  and UI (D-block firm-admin page). No wrong-layer, no demo-path-only, no premature
  abstraction, no config-drift, no validation theater, no backwards-compat shim. The
  seed's cited code locations were verified against reality and all exist as described.
reasoning: |
  The problem is framed right. Every cited surface is real and the causal design is
  sound: getDb() returns the RLS-bound ALS handle in-request and a fail-closed
  singleton (NULL workspace_id -> 0 rows) out-of-request; recordkeeping.repository
  reads deal/pipeline activity through getDb (workspace-safe); RolesGuard is
  fail-closed (empty @Roles() denies); audit.service.append is the single chain
  authority and the export-is-audit-logged AC is in scope. This is a PROCEED, not a
  REFRAME — the endpoint goal, layer, and connections are all correct. But three
  security constraints are load-bearing for a security-sensitive export and must be
  carried into P-2 spec as explicit ACs; the sharpest (chain-vs-export scope tension)
  is genuinely under-specified in the seed and would silently produce EITHER a
  cross-tenant leak OR a false "verified" signal if the spec resolves it wrong.
carry_into_spec_p2:
  - id: LOAD-BEARING-1-workspace-scope-vs-global-chain
    severity: critical
    finding: |
      The export has TWO data sources with OPPOSITE scoping, and the seed does not
      name the tension. (a) Deal/pipeline activity + the firm's own audit rows must be
      workspace-scoped — read via getDb (RLS), correct as cited. (b) BUT verifyChain()
      -> repository.readChainAscending() reads FROM read_audit_chain_rls_exempt(...),
      an intentionally RLS-EXEMPT walk over the SINGLE GLOBAL cross-workspace hash
      chain (audit_log_entries has NO RLS policy / RLS not enabled — confirmed:
      pg_policies returns 0 rows for audit%; the chain is one global sequence_number
      IDENTITY serialized by advisory lock). This is CORRECT for integrity verification
      (the HMAC chain interleaves all firms, so you cannot verify a per-firm sub-slice
      in isolation) but it is a DIRECT cross-tenant leak vector for the EXPORT PAYLOAD.
      Spec MUST split the two concerns explicitly: export DATA = getDb/RLS-filtered to
      the caller's workspace ONLY; integrity VERIFICATION = may walk the global chain
      but MUST return only a boolean/verify-result (ok / firstBreakAt / reason), and
      MUST NOT emit any other workspace's rows, hashes, actor_user_ids, or resource_ids
      into the export. A naive "export the verified chain" that serializes the
      readChainAscending() result into the file = full cross-firm leak of every firm's
      audit metadata. This is the #1 catch.
  - id: LOAD-BEARING-2-unbounded-export-dos
    severity: high
    finding: |
      readChainAscending() is unbounded (reads sequence 1 .. 9223372036854775807 into
      memory as result.rows). Seed AC says "large exports handled without loading the
      whole set into memory unbounded" — good that it is named, but for the AUDIT/chain
      path the only existing reader is the unbounded global walk. Spec must require a
      bounded/streamed export (streaming CSV/JSON writer, cursor/keyset pagination, OR
      a mandatory date-range bound) for the workspace-scoped data path, and must NOT
      reuse the unbounded global-chain read as the export data source (see LOAD-BEARING-1).
  - id: LOAD-BEARING-3-csv-injection
    severity: high
    finding: |
      Security-sensitive CSV export -> formula/CSV injection. Any cell whose value
      begins with = + - @ (or tab/CR) is executed as a formula when the file opens in
      Excel/Sheets. Audit rows carry attacker-influenceable free text (action strings,
      resource ids, actor-supplied fields). Spec MUST require CSV field sanitization
      (prefix-escape dangerous leading chars with a quote/apostrophe, or RFC-4180 quote
      + neutralize) at the serializer boundary. JSON path: ensure well-formed, no
      injection via unescaped strings (native JSON.stringify is safe; do not hand-roll).
  - id: RBAC-role-value
    severity: medium
    finding: |
      Seed says "firm-admin only." The live RolesGuard uses role strings ('admin',
      'compliance'); the existing compliance summary route uses COMPLIANCE_SUMMARY_ROLES
      = ['compliance','admin']. Spec MUST pin the EXACT role set for export and confirm
      it is intentional that an analyst/advisor CANNOT export the firm's full records —
      export of the complete firm record is strictly more sensitive than the compliance
      summary, so 'admin'-only (NOT the broader compliance set) is the likely-correct
      choice; make it explicit and fail-closed (present-but-empty @Roles() already
      denies at the guard — keep that invariant, and add the RBAC-rejection test the
      seed AC already lists).
  - id: export-append-same-tx
    severity: low
    finding: |
      The export-is-audit-logged row must go through audit.service.append (the single
      chain authority) as a normal append; it is a plain chain extension and does not
      break the HMAC chain. Confirmed append() acquires the advisory chain lock and
      serializes — no special handling needed beyond calling the existing authority.
design_gap_confirmed: true
design_gap_note: |
  Sibling f331a51c establishes a NEW firm-admin export page (no existing apps/web
  compliance/admin page today). design_gap = TRUE -> D-block required this wave. The
  sibling's ACs correctly demand: RBAC-hidden for non-admins, format picker, explicit
  export + download, VISIBLE HMAC integrity result (verified / chain-broken), and
  empty/zero-activity + error + loading states (edge-case coverage present, not
  demo-path-only). Confirm D-block runs.
light_posture_confirmed: true
light_posture_note: |
  Aligned to founder decision 2026-07-07 (M10 LIGHT). The seed is a well-built,
  standard-format, integrity-verifiable export — NOT gold-plated into a
  regulator-certified attestation package. No over-engineering flagged; the three
  load-bearing items above are baseline security hygiene for a data-export feature,
  not scope inflation.
sizing_note: |
  Deferred to P-1. Seed + 1 sibling (API + UI). Not flagging RESCOPE-AUTO-SPLIT —
  the pairing is a legitimate vertical slice (endpoint + its firm-admin UI), not
  scope-creep coupling.
sibling_visible: false
