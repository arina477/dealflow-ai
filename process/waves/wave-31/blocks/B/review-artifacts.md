# Wave 31 — B-block review artifacts
**Wave topic:** M9 Twenty CRM DataSourceAdapter — SDK doc + twenty.adapter.ts (mirror affinity.adapter.ts + base-URL-from-env + P2-a-output-validation) + mocked tests. | **Block exit gate:** B-6 | **Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | (claim+branch) | done | schema SKIP; branch wave-31-twenty-adapter; D-SKIP |
| B-1/B-2 | stages/B-2-backend.md | pending | Twenty SDK doc FIRST + twenty.adapter.ts + registry + env-key/URL + mocked tests |
| B-3 | — | SKIP | no UI |
| B-4/B-5/B-6 | ... | pending | |
## BINDING (from P-4; head-builder polices):
- SDK-doc-FIRST: command-center/dev/SDK-Docs/Twenty/twenty.md (REST companies/people, auth Bearer, cursor-pagination, rate-limits, normalize-map) + registry.md row — BEFORE the adapter.
- MIRROR affinity.adapter.ts: fetchCompanies(connection)→NormalizedSourceRecord[], register 'TWENTY' in createDefaultRegistry; INTERNAL cursor-pagination(all)+429/5xx-backoff+retry+timeout+boundary-Zod.
- BASE-URL from ENV: TWENTY_BASE_URL (https-validate — SSRF/misconfig guard) + TWENTY_API_KEY. Config schema (dataSourceConnectionConfigSchema) UNTOUCHED (wave-16 secret-sink boundary — DRIFT-1: the prose "connection.config" is SUPERSEDED). Env-only.
- [P2-a FOLD] OUTPUT self-validation: safeParse the adapter's output vs normalizedSourceRecordSchema (skip+log invalid — match fixture.adapter.ts:85; closes the wave-30 Affinity gap).
- SECRET: TWENTY_API_KEY + TWENTY_BASE_URL env-only NEVER committed (.env.example name-only); graceful no-op if EITHER absent (app boots + fixture/Affinity search works).
- Tests: MOCKED-HTTP (vi.stubGlobal) — cursor-pagination(all)/429-backoff/5xx-retry/timeout/normalize/absent-key/absent-URL-noop/boundary-Zod/OUTPUT-validation/base-URL-https. NO live HTTP.
## LOAD-BEARING: SDK-doc-first + mirror-wave-30 + base-URL-from-env-https-validated (config untouched) + P2-a-output-validation + robustness-tested + secret-env-never-committed + graceful-no-key/URL. LIVE-verify key-gated (founder Twenty key + instance URL).

## Block exit handoff
```yaml
build_block_status: complete
branch: wave-31-twenty-adapter
review_verdict: APPROVE (head-builder + /review ship — crown jewels [secret/cursor-pagination/crash-safe/SSRF/config-untouched/P2-a] all pass)
deliverable: [SDK-Docs/Twenty/twenty.md (research-first), twenty.adapter.ts (mirror wave-30 + base-URL-from-env-https + P2-a-output-validation, providerKey=TWENTY registered), twenty.adapter.spec.ts (18 mocked tests)]
new_secret_env: [TWENTY_API_KEY, TWENTY_BASE_URL] (env-only, requested from founder, NOT committed; graceful-no-op if absent)
config_schema_change: false (data-source-admin.ts 0-diff — wave-16 boundary respected)
app_bundle_changed: true (new adapter registered; NO migration → C-2 real deploy no-migration; LIVE Twenty fetch gated on founder key+URL)
ci_yml_change: false
ready_for_ci: true
live_verify_key_gated: true (C-2 — needs founder TWENTY_API_KEY + TWENTY_BASE_URL; deploy registered-dormant + founder-provides-creds follow-up)
accepted_p3_debt: [cursor-repeat-guard-cross-adapter, email-completeness-pre-live-hookup]
p2a_gap_from_wave30: CLOSED (Twenty validates output; consider back-porting to Affinity)
```
