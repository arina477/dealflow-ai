# Wave 31 — P-2 Spec (pointer)
**Source of truth:** task 1eb63a40 description + this contract. single-spec. design_gap false, D-skip. External-SDK (Twenty). Mirrors wave-30 Affinity.
**claimed_task_ids:** [1eb63a40]
## AC (M9 Twenty CRM DataSourceAdapter):
1. **SDK doc FIRST:** command-center/dev/SDK-Docs/Twenty/twenty.md (REST endpoints companies/people, auth Bearer, cursor pagination, rate-limits, normalize map) + registry row — before the adapter.
2. **The adapter** (twenty.adapter.ts, providerKey='TWENTY', registered, mirrors affinity.adapter.ts): fetchCompanies INTERNAL cursor-pagination(all pages)+429/5xx-backoff+retry+timeout+boundary-Zod; base-URL+key from ENV (TWENTY_BASE_URL https-validated + TWENTY_API_KEY; config UNTOUCHED); NORMALIZE Twenty company/people → NormalizedSourceRecord.
3. **[P2-a FOLD] OUTPUT self-validation:** safeParse the adapter's output vs normalizedSourceRecordSchema (skip+log invalid — match fixture.adapter.ts). (This closes the wave-30 Affinity P2-a gap.)
4. **Secret + graceful:** TWENTY_API_KEY + TWENTY_BASE_URL env-only, NEVER committed; graceful no-op if either absent (app boots + fixture/Affinity search works).
5. **Tests:** MOCKED-HTTP — cursor-pagination(all)/429-backoff/5xx-retry/timeout/normalize/absent-key/absent-URL-noop/boundary-Zod/OUTPUT-validation/base-URL-https. NO live HTTP.
6. **Live-verify (C-2):** key-gated on the founder's Twenty key + instance URL — deploy registered-dormant; a founder-provides-creds follow-up (do NOT block the wave).
## Load-bearing: SDK-doc-first + mirror-wave-30 + base-URL-from-env-https-validated (config untouched) + OUTPUT-self-validation (P2-a) + robust + secret-env-never-committed + graceful-no-key/URL. → C-2 live-verify key-gated. FLAGS: M9 _TBD; Twenty key+URL requested; Affinity dormant 2nd connector.
