# Wave 30 — P-block review artifacts
**Block:** P (Product) | **Wave topic:** M9 Integrations — the FIRST real DataSourceAdapter = **Affinity** (founder-chosen). Implement the Affinity concrete adapter BEHIND the existing pluggable DataSourceAdapter interface (a fixture adapter already ships from M3): fetch companies/contacts/deals from Affinity's REST API → normalize into DealFlow's model → feed the existing ETL fan-out + sourcing search. SDK-research-first (author the Affinity SDK doc). Serves M9 (integrations) + M3's "≥2 connected sources" metric. | **Block exit gate:** P-4
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
## Block-specific context
- **claimed_task_ids:** [345dfbc6 (the Affinity DataSourceAdapter)]
- **Founder decision (2026-07-08):** Integrations → Affinity. No NEW spend gate (the founder already uses Affinity — connecting to their existing account). The Affinity API key is REQUESTED (account-issued; founder provides via Affinity Settings→API) — set as a PLATFORM SECRET (never committed).
- **REUSE (not rebuild):** the pluggable DataSourceAdapter interface + the fixture adapter + the ETL fan-out + the sourcing search ALREADY exist (M3). This wave adds the Affinity CONCRETE implementation behind that interface. Do NOT rebuild the interface/pipeline.
- **LOAD-BEARING:** SDK-RESEARCH-FIRST (author command-center/dev/SDK-Docs/Affinity/affinity.md per external-sdk-integration-rules: endpoints [persons/organizations/opportunities/lists], auth [API key], rate limits, pagination, the data model + a registry row) BEFORE coding. The adapter: robust (pagination, rate-limit/backoff, error-handling, timeouts) + normalizes Affinity → DealFlow model + workspace-scoped (a firm's Affinity data → its own workspace). Secrets: the API key is a PLATFORM ENV SECRET (never in code/commits). Tests: unit-test the adapter with MOCKED Affinity responses (fetch/normalize/map/pagination/error); the LIVE e2e (real Affinity) is GATED on the founder's API key — build+unit-test autonomously, defer live-verify.
- **API-KEY GATE:** the C-2 LIVE verification (pulling real Affinity data) needs the founder's API key. If not provided by C-2 → deploy the adapter (registered but the live-pull gated behind the key/feature-flag) + a MONITOR/founder-provides-key step for the live hookup; do NOT block the whole wave on the key (the adapter + mocked tests are the buildable core).
- **design_gap_flag:** likely FALSE (backend adapter; reuses the existing sourcing UI/search). D-skip likely.
- Autonomous mode: automatic.
## Gate verdict log
<appended by head-product at P-4>

## P-4 Phase 2: karen APPROVE (6/6 VERIFIED — fetchCompanies(connection)→NormalizedSourceRecord[] single-method-no-cursor interface [pagination internal], NormalizedSourceRecord shape, process.env[providerKey]-never-DB secret, connection=config-not-key, SDK-Docs/Affinity absent [template exists], Vitest-mockable [msw/nock new dev-dep]) + jenny APPROVE (6/6 MATCHES — Affinity-per-founder, reuse-interface, secret env-only-never-committed-requested, workspace-scoping-inherited-from-ingestion [correct M8], key-gated-live-verify, mvp-scope + M9-_TBD-flagged). Both: 1 non-blocking drift (healthCheck/withRetry aspirational-not-shipped → NOTE-2).
## MERGED P-4 VERDICT: APPROVED. → B-block (D-skip). NOTE-1 (env-var naming ↔ providerKey), NOTE-2 (no healthCheck/withRetry — inline robustness), NOTE-3 (boundary-Zod keep), workspace-scoping-inherited folded.
**Status:** gate-passed
