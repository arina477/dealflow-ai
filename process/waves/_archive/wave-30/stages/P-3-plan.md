# Wave 30 — P-3 Plan (M9 Affinity DataSourceAdapter)
## Approach — SDK-research-first, then the adapter behind the existing interface
### Action 1 — Deliverables
1. **[SDK-research-FIRST] command-center/dev/SDK-Docs/Affinity/affinity.md** (per external-sdk-integration-rules template): Affinity REST API v1/v2 — base URL (https://api.affinity.co), auth (API key as HTTP Basic username, empty password), core endpoints (GET /organizations [list, search, paginate], GET /persons, /opportunities, /lists, /field-values), pagination (page_size + page_token / next_page_token), rate limits (+ 429 Retry-After handling), error shapes (4xx/5xx), the org/person fields → DealFlow company/contact normalization map. + a registry.md row (Affinity added). Research from Affinity's public API docs (WebFetch the docs if reachable; else document the well-known v1 shape + mark assumptions to verify at live-hookup).
2. **The Affinity adapter** (apps/api/src/modules/sourcing/adapters/affinity.adapter.ts) implementing the existing DataSourceAdapter interface (fetchCompanies — the single method, matching fixture.adapter.ts's shape): INSIDE fetchCompanies — an Affinity HTTP client (fetch/undici) reading AFFINITY_API_KEY from env; PAGINATE all org pages (page_token loop); 429 backoff (Retry-After / exponential) + retry (transient 5xx/network, bounded); timeouts (per-request); NORMALIZE Affinity organizations (+ associated persons where cheap) → the DealFlow company shape the fixture adapter returns; partial-failure handling (log + return what succeeded, or fail cleanly). Register in adapter.registry for provider='affinity'.
3. **Config/secret:** AFFINITY_API_KEY via process.env (NEVER committed; requested from founder). If the key is UNSET, the adapter registers but fetchCompanies returns empty/no-op OR is skipped gracefully (so the app boots + the sourcing search works with the fixture adapter until the key arrives — do NOT crash if the key is absent).
4. **Tests:** unit-test the adapter with MOCKED Affinity HTTP (nock/msw/fetch-mock): multi-page pagination (fetches ALL pages, not just page 1), 429→backoff→retry→success, 5xx-retry, timeout, the normalize mapping (Affinity org → DealFlow company), empty/absent-key no-op, partial-failure. NO live HTTP in unit tests.
### Action 2 — Data model: NONE (reuses the sourcing company/contact model + ETL fan-out). No migration.
### Action 3 — API: none new (the adapter feeds the existing sourcing search via the registry). Shared: reuse the DataSourceAdapter interface + the company shape.
### Action 4 — Deps: an HTTP client (undici/native fetch — prefer native; no heavy dep) + a test HTTP-mock (msw or nock — dev-dep). NO new runtime SDK (Affinity has no official Node SDK; use REST). Secret: AFFINITY_API_KEY (env).
## Plan (by B-stage)
**B-0 Schema:** SKIP.
**B-1 Contracts:** reuse the existing DataSourceAdapter interface + company shape (packages/shared/src/sourcing.ts). Add any Affinity-response types (internal to the adapter).
**B-2 Backend** (backend-developer, external-sdk-integration-rules): author the Affinity SDK doc FIRST → then the affinity.adapter.ts (fetchCompanies: paginate+backoff+retry+timeout+normalize) + registry wiring + env-key handling (graceful if absent) + the mocked unit tests. NO real HTTP in tests; NO key committed.
**B-3 Frontend:** SKIP (no UI — the sourcing search page exists; the adapter feeds it).
**B-4/B-5/B-6:** head-builder polices SDK-doc-authored-first + reuse-the-interface + robustness (pagination-all-pages + 429-backoff + retry + timeout, tested) + normalize-correct + secret-as-env-never-committed + graceful-if-key-absent + the mocked tests genuinely exercise pagination/backoff.
### Action 6 — Specialist: backend-developer (external-SDK integration). Serial.
### Action 8 — Self-consistency CLEAN. External-SDK → SDK-doc gate. C-2 live-verify gated on the founder's key.
```yaml
deps_new: [http-client (native fetch/undici — prefer native), test-http-mock (msw/nock, dev-dep)]
schema_change: false
new_secret: true   # AFFINITY_API_KEY (env platform secret — requested from founder, NEVER committed)
new_sdk: affinity (REST, no official Node SDK — SDK doc authored)
specialists: [backend-developer]
compliance_invariants: [sdk-doc-authored-first, reuse-existing-DataSourceAdapter-interface, robust-pagination-all-pages + 429-backoff + retry + timeout (inside fetchCompanies), normalize-affinity-to-dealflow-model, api-key-env-secret-never-committed, graceful-no-op-if-key-absent (app boots without key), mocked-http-unit-tests-no-live]
hard_boundaries: "the Affinity DataSourceAdapter behind the EXISTING interface (fetchCompanies single method — pagination+429-backoff+retry+timeout ALL inside it) + the SDK doc (research-first) + normalize Affinity orgs/persons → DealFlow company/contact + register in adapter.registry + AFFINITY_API_KEY env-secret (NEVER committed, graceful-no-op if absent) + mocked-HTTP unit tests. MVP = core companies/contacts; opportunities/lists/custom-fields + write-back + webhooks + incremental-sync + multi-workspace-per-firm-key = LATER. NO migration/UI. LIVE-verify gated on the founder's key (C-2)."
design_gap_flag: false
self_consistency: clean
```
