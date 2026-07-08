```yaml
verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Framing is sound. Symptom-vs-cause: no symptom/cause inversion — the wave
  attacks the cause layer directly (M9 needs a REAL data source; the Affinity
  adapter IS the cause-layer work, not a surface patch). The pluggable
  DataSourceAdapter interface, AdapterRegistry, ETL fan-out, and sourcing
  search all pre-exist from M3 (verified: packages/shared/src/sourcing.ts:59
  DataSourceAdapter; apps/api/src/modules/sourcing/adapters/adapter.registry.ts
  register()/getAdapter(); fixture.adapter.ts as the reference impl). The wave
  correctly implements the EXISTING interface behind the EXISTING registry — no
  parallel pipeline, no premature abstraction (concrete 1st real adapter, not a
  new framework), no wrong-layer fix. Secrets framing is already correct in the
  contract: interface docstring (sourcing.ts:65) mandates credentials resolve
  from process.env[providerKey], NEVER the DB — matches rules 2/6 (account-issued
  key = platform env secret, requested from founder). The buildable core (adapter
  + mocked unit tests) is separable from live verification, so the API-key gate
  blocks only the live e2e, not the wave. No catalog antipattern matches.
smells_but_no_match: |
  Robustness (pagination / 429-backoff / timeout / transient-retry / partial-
  failure) is the real risk surface for a first live external adapter, but it is
  an implementation-completeness concern for P-2 spec ACs + P-3 plan, NOT a
  framing defect — the framing already names it. One structural nuance the spec
  MUST resolve (flag, not reframe): the interface signature is
  fetchCompanies(connection): Promise<NormalizedSourceRecord[]> — a single call
  returning the FULL array. All of Affinity's page-token pagination + rate-limit
  backoff + retry MUST therefore be handled INTERNALLY inside fetchCompanies
  (loop until page tokens exhausted), because the interface exposes no streaming/
  cursor seam. This is exactly where "fetch page 1 and hope" hides. Not a reframe
  (interface is correct + reused); it is a load-bearing P-2 acceptance criterion.
load_bearing_for_downstream: |
  1. SDK-research-FIRST (process gate): NO command-center/dev/SDK-Docs/Affinity/
     doc exists yet (registry has only SuperTokens). Per external-sdk-integration-
     rules, the Affinity SDK doc (real endpoints persons/organizations/
     opportunities/lists/field-values; auth = API key as HTTP-basic username;
     rate limits; page-token pagination; data model + error shapes; Runtime-
     literals table) MUST be authored FIRST at P-3 approach, before adapter code.
  2. REUSE-not-rebuild: implement DataSourceAdapter + register in AdapterRegistry;
     never a parallel ingestion path. Verified interface = single fetchCompanies.
  3. Robustness INSIDE fetchCompanies: pagination-to-exhaustion, 429 backoff,
     timeout, transient retry, partial-failure — P-2 ACs.
  4. Secret-as-env: Affinity key = platform env secret via process.env[providerKey];
     request from founder (account-issued); NEVER committed/hard-coded.
  5. Key-gated live verify: build adapter + mocked unit tests autonomously; defer
     ONLY the live real-data e2e on the founder's key. Wave is NOT key-blocked.
  6. Workspace-scoping: DataSourceConnection is per-connection (config jsonb,
     createdBy); confirm the adapter runs per-workspace with that firm's
     key/config (or an explicitly-scoped pilot key) — P-2 must state which.
proposed_reframe: |
  (n/a — PROCEED)
escalation_reason: |
  (n/a — PROCEED)
design_gap: false
design_gap_reason: |
  Backend adapter behind existing sourcing UI/search — no new screen. D-block skip.
sibling_visible: false
```
