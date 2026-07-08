# Wave 30 — P-2 Spec (pointer)
**Source of truth:** seed 345dfbc6 tasks.description + this contract. single-spec. design_gap false, D-skip. External-SDK (Affinity).
**claimed_task_ids:** [345dfbc6]
## AC (M9 Affinity DataSourceAdapter):
1. **SDK doc FIRST:** command-center/dev/SDK-Docs/Affinity/affinity.md (endpoints, auth [API key basic], pagination, rate-limits, error shapes, normalize map) + registry row — authored BEFORE the adapter.
2. **The adapter** (affinity.adapter.ts, provider='affinity', behind the existing DataSourceAdapter interface): fetchCompanies INTERNALLY paginates ALL Affinity org pages + 429-backoff + retry (transient) + timeout; NORMALIZES Affinity orgs/persons → DealFlow company/contact; registered in adapter.registry.
3. **Secret:** AFFINITY_API_KEY via env (NEVER committed; requested from founder); graceful no-op if absent (app boots + fixture-adapter search still works).
4. **Tests:** MOCKED-HTTP unit tests — multi-page pagination (all pages), 429→backoff→retry, 5xx-retry, timeout, normalize mapping, absent-key no-op, partial-failure. NO live HTTP.
5. **Live-verify (C-2):** gated on the founder's key — deploy the adapter (registered; live-pull gated on key presence); if key absent by C-2, a founder-provides-key follow-up (do NOT block the wave).
## Load-bearing: SDK-doc-first + reuse-interface + robust(pagination-all-pages+429-backoff+retry+timeout) + normalize + secret-env-never-committed + graceful-no-key + mocked-tests. → C-2 live-verify key-gated. FLAGS: M9 _TBD metric; the Affinity key requested; permanent-Actions-fix.
