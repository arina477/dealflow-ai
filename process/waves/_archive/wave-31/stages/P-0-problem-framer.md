verdict: REFRAME
verdict_source: problem-framer
matched_antipatterns: [2, 7]
reasoning: |
  Symptom-vs-cause: PASS on the top-level framing — the task correctly frames a 2nd real
  DataSourceAdapter behind the EXISTING pluggable interface, mirroring the proven wave-30
  Affinity adapter (same interface, same inline robustness, same registry). Not symptom-layer;
  not re-inventing. Watch-items 1/2/4/5/6 all hold as framed.

  BUT watch-item 3 (per-connection base URL — self-hostable Twenty) is framed on a false premise
  and this is the load-bearing reframe. The task says "read the base URL from
  DataSourceConnection.config (+ validate it)". `DataSourceConnection.config` is NOT free JSONB —
  it is a STRICT, TYPED whitelist (`dataSourceConnectionConfigSchema`, `.strict()`, three keys only:
  fieldMapping / syncBatchSize / regionSlug) authored at wave-16 P-4 Finding 2 (CRITICAL) precisely
  to stop config becoming a secret/arbitrary-value sink. A `baseUrl` / `instanceUrl` key would be
  REJECTED by that strict schema today. So the framing as written cannot be implemented without a
  contract change, and it must NOT be met by re-loosening config to `z.record(z.unknown())` (that
  would re-open the exact secret-sink the boundary closed — antipattern #7 validation-theater
  inverse: removing a real boundary "to make it work"). The wrong-layer decision (antipattern #2)
  is: WHERE does a self-hostable instance URL live? Three legitimate options exist and P-1/P-2 must
  pick ONE explicitly, not assume config: (a) add `instanceBaseUrl` as a new BOUNDED, whitelisted
  field to dataSourceConnectionConfigSchema with a URL/max-length/https constraint (extends the
  existing typed boundary — the clean path, mirrors how regionSlug was added); OR (b) resolve the
  base URL from env (TWENTY_BASE_URL) alongside TWENTY_API_KEY, matching how Affinity resolves its
  secret from env and keeping the connection row URL-free; OR (c) hardcode the twenty.com cloud host
  and defer self-hosted to LATER. The task must state which, and if (a), the schema edit + its
  https/length guard is in-scope this wave. The SSRF note the task raises is real and rides on this
  choice: a config-sourced URL is admin-set (trust boundary noted) but still user-controlled input to
  a server-side fetch — whichever option is picked needs an https-only + host-shape guard, not just
  "validate it".
proposed_reframe: |
  Build a TwentyCrmDataSourceAdapter behind the existing DataSourceAdapter interface
  (apps/api/src/modules/sourcing/adapters/), providerKey 'TWENTY', registered in
  createDefaultRegistry alongside fixture + affinity. Mirror the wave-30 affinity.adapter.ts
  structure verbatim: inline pagination + 429/5xx backoff-retry + AbortController timeout +
  boundary-Zod on every inbound Twenty response + normalize → NormalizedSourceRecord[];
  TWENTY_API_KEY as env-only secret (Bearer auth), graceful no-op returning [] when absent;
  mocked-fetch tests; SDK-doc-first (author command-center/dev/SDK-Docs/Twenty/twenty.md BEFORE
  code — document REST-vs-GraphQL choice + why, companies/people endpoints, auth, Twenty's
  cursor pagination, rate limits, normalize map). FOLD the wave-30 P2-a gap: unlike affinity.adapter.ts
  (which validates inbound but NOT its own output), this adapter MUST safeParse each normalized record
  against normalizedSourceRecordSchema before returning — matching fixture.adapter.ts (lines 30, 85).
  RESOLVE the self-hostable-base-URL question EXPLICITLY at P-1/P-2 by picking ONE of:
  (a) add a new whitelisted `instanceBaseUrl` field to dataSourceConnectionConfigSchema
  (data-source-admin.ts) with an https-only + max-length URL constraint (schema edit in-scope);
  (b) resolve base URL from env (TWENTY_BASE_URL) next to the API key, connection row stays URL-free;
  or (c) hardcode twenty.com cloud, defer self-hosted. Do NOT satisfy "read from config" by
  loosening config back to free JSONB — that re-opens the wave-16 P-4 Finding 2 secret-sink boundary.
  Whichever option: apply an https-only + host-shape guard on the resolved URL (SSRF: admin-set but
  server-side-fetch input). design_gap: false (backend, reuses sourcing UI) — D-block skip stands.
escalation_reason: |
  n/a
sibling_visible: false
