# Wave 30 — B-block review artifacts
**Wave topic:** M9 Affinity DataSourceAdapter — SDK doc (research-first) + the adapter (fetchCompanies: internal pagination+backoff+retry+timeout+normalize) behind the existing interface + mocked-HTTP tests. | **Block exit gate:** B-6 | **Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | (claim+branch) | done | schema SKIP; branch wave-30-affinity-adapter; D-SKIP |
| B-1/B-2 | stages/B-2-backend.md | pending | SDK doc FIRST + affinity.adapter.ts + registry + env-key + mocked tests |
| B-3 | — | SKIP | no UI (adapter feeds existing sourcing search) |
| B-4/B-5/B-6 | ... | pending | |
## BINDING (from P-4; head-builder polices):
- SDK-doc-FIRST: command-center/dev/SDK-Docs/Affinity/affinity.md (endpoints/auth[API-key-basic]/pagination[page-token]/rate-limits[429]/error-shapes/normalize-map) + registry.md row — BEFORE the adapter.
- REUSE the existing DataSourceAdapter interface (fetchCompanies(connection)→NormalizedSourceRecord[] — single method, NO cursor) + register in adapter.registry for providerKey. Match fixture.adapter.ts.
- ROBUSTNESS inline fetchCompanies: paginate ALL Affinity org pages (page-token loop) + 429 backoff (Retry-After/exp) + retry (transient 5xx/network, bounded) + timeout + partial-failure. [NOTE-3] boundary-Zod-validate Affinity responses (clean error, not crash).
- NORMALIZE Affinity orgs/persons → NormalizedSourceRecord (sourceRecordId/name/domain/contacts[]).
- SECRET: [NOTE-1] the key env var matches the interface's process.env[providerKey] resolution (providerKey e.g. AFFINITY). NEVER committed. Graceful no-op if absent (app boots + fixture search works).
- [NOTE-2] Do NOT build healthCheck/withRetry (aspirational, not shipped) — inline the robustness. Workspace-scoping INHERITED from ingestion (adapter workspace-agnostic).
- Tests: MOCKED-HTTP (Vitest vi.stubGlobal/spyOn or a new msw/nock dev-dep) — multi-page-pagination(all pages)/429-backoff-retry/5xx-retry/timeout/normalize/absent-key-noop/partial-failure/boundary-Zod. NO live HTTP.
## LOAD-BEARING: SDK-doc-first + robust-pagination-all-pages+429-backoff+retry (genuinely mock-tested) + normalize + secret-env-never-committed + graceful-no-key. LIVE-verify gated on founder key (C-2).

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-30-affinity-adapter
review_verdict: APPROVE (head-builder + /review ship — 3 crown-jewels [secret-leak/pagination/crash-without-key] pass; robustness genuine)
deliverable: [SDK-Docs/Affinity/affinity.md (research-first), affinity.adapter.ts (paginate-all+429-backoff+retry+timeout+boundary-Zod+normalize, providerKey=AFFINITY registered), affinity.adapter.spec.ts (13 mocked tests)]
new_secret_env: AFFINITY_API_KEY (env-only, requested from founder, NOT committed; graceful-no-op if absent)
app_bundle_changed: true (new adapter registered; NO migration → C-2 real deploy no-migration; LIVE affinity fetch gated on the founder's key)
ci_yml_change: false
ready_for_ci: true
live_verify_key_gated: true (C-2 — needs founder AFFINITY_API_KEY; if absent, deploy adapter registered-but-dormant + a founder-provides-key follow-up)
accepted_p2_debt: [P2-a-output-validation (pre-live-hookup), P2-b-backoff-timing-test]
```
