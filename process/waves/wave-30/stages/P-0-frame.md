# Wave 30 — P-0 Frame
## Discover
- wave_number 30, M9 (Integrations & insight, in_progress — founder unblocked 2026-07-08). Seed 345dfbc6 (Affinity DataSourceAdapter — the first REAL source). Founder chose Integrations→Affinity.
## Reframe
### problem-framer — PROCEED
Attacks the cause (M9 needs a real source). REUSES the existing DataSourceAdapter interface (packages/shared/src/sourcing.ts:59 — a SINGLE method fetchCompanies returning the full array) + AdapterRegistry (register the Affinity adapter). Env-secret pattern already contract-mandated (process.env[providerKey], never DB/commit). **KEY STRUCTURAL NUANCE:** the interface's fetchCompanies returns the full array with NO cursor seam → Affinity's page-token PAGINATION + 429 BACKOFF + RETRY + timeouts MUST all live INSIDE fetchCompanies (the one method). SDK-RESEARCH-FIRST (no SDK-Docs/Affinity yet — author it). D-skip (backend, reuses sourcing UI/search).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Founder-chosen direction+vendor. A robust read-only Affinity adapter feeding sourcing search = the right ~6-7/10 (write-back/webhooks/incremental-sync correctly DEFERRED; toy-fetch rejected). Traces to the integrated-platform bet + M9. Build core+mocked now, defer only live-verify to the founder's key. FLAG: M9 _TBD metric (M9 can't formally CLOSE until the founder sets it — this wave builds real scope regardless).
### mvp-thinner — OK
Metric-blocked (M9 _TBD → no formal thinness trace). The seed is already tightly scoped (core companies/contacts, robust, mocked). Pagination/rate-limit/error-handling MUST stay (a real API needs them).
### Disposition: PROCEED
Final framing → P-1/P-2/P-3:
1. **SDK-research-first:** author command-center/dev/SDK-Docs/Affinity/affinity.md (per external-sdk-integration-rules) BEFORE coding — Affinity REST API: base URL, auth (API key via HTTP basic, key as username), the entities (organizations, persons, opportunities, lists, field-values), pagination (page tokens / next-page), rate limits (+ 429 handling), error shapes, the fields needed to normalize → DealFlow companies/contacts. + a registry.md row.
2. **The Affinity DataSourceAdapter (behind the existing interface):** implement fetchCompanies (the single interface method) for provider='affinity' — INTERNALLY: paginate Affinity orgs (page tokens, all pages), 429 rate-limit backoff + retry (transient errors), timeouts, partial-failure handling; NORMALIZE Affinity organizations (+ associated persons/contacts) → DealFlow's company/contact model (the fixture adapter's output shape); register in adapter.registry. The mvp = CORE entities (organizations/companies + persons/contacts — the sourcing search's need); opportunities/lists/custom-fields = LATER.
3. **Secret:** the Affinity API key = a PLATFORM ENV SECRET (process.env, e.g. AFFINITY_API_KEY) — NEVER committed. Requested from the founder (updates/founder-request-affinity-api-key.md). The adapter reads the key from env.
4. **Workspace-scoping:** for the pilot, a single Affinity account/key (the pilot firm's) → the pilot firm's workspace. (Multi-workspace per-firm-key config = LATER — note it.)
5. **Tests:** unit-test the adapter with MOCKED Affinity HTTP responses (fetch/paginate-across-pages/normalize/429-backoff/error-handling/timeout). The LIVE e2e (real Affinity) is GATED on the founder's key.
## LOAD-BEARING: SDK-research-first (the doc) + reuse-the-existing-fetchCompanies-interface + ROBUSTNESS (pagination+429-backoff+retry+timeout INSIDE fetchCompanies) + normalize-to-DealFlow-model + secret-as-env-never-committed + key-gated-live-verify (buildable core builds now, defer only live-hookup).
## API-KEY GATE: the C-2 LIVE verification needs the founder's key. If absent by C-2 → deploy the adapter (registered; the live-pull gated behind the key presence / a flag) + a founder-provides-key follow-up; do NOT block the whole wave on the key.
## design_gap_flag: false (backend adapter; reuses the sourcing search UI). D-skip.
## FLAGS: M9 _TBD metric (founder-reserved; flag for eventual M9 close); the Affinity API key (requested); the permanent-Actions-fix.
claimed_task_ids: [345dfbc6-1c96-4f6a-98aa-12ac7d61794b]
