# Wave 31 — P-0 Frame
## Discover
- wave_number 31, M9 (Integrations, in_progress). Task 1eb63a40 (Twenty CRM DataSourceAdapter — founder redirect from Affinity). Mirrors the proven wave-30 Affinity adapter.
## Reframe
### problem-framer — REFRAME (base-URL resolution)
Top-level framing SOUND (mirror wave-30 affinity.adapter.ts, SDK-research-first, P2-a-output-validation-fold confirmed). BUT the per-connection-base-URL premise is FALSE: dataSourceConnectionConfigSchema (packages/shared/src/data-source-admin.ts:48-121) is a STRICT 3-key whitelist (wave-16 P-4 Finding-2 secret-sink boundary — NO baseUrl slot). Must NOT re-loosen it. → P-1/P-2 pick a host-resolution: (a) whitelist an https-bounded instanceBaseUrl field, (b) resolve from env, (c) hardcode-cloud+defer. **DECISION: (b) resolve TWENTY_BASE_URL + TWENTY_API_KEY from ENV** (single pilot instance; config UNTOUCHED — respects the wave-16 boundary; matches the env-secret pattern). Per-firm-config-URL (multi-instance) = LATER (like Affinity's multi-workspace-key). + https-validate the base URL (SSRF guard — it's an admin/env-set trusted value, but validate the scheme/shape).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Founder-pinned Twenty redirect + proven wave-30 read-only-adapter pattern = right ~6-7/10. Keep-both (Affinity dormant, 2nd connector) + buildable-core+key-gated-live-verify confirmed. Twenty open-source = full API + no lock-in + self-hostable (compliance-first fit). FLAG: M9 _TBD metric (this is M9 progress, not an M9-closing wave).
### mvp-thinner — OK
Minimum coherent single-task slice mirroring the OK-sized wave-30 Affinity adapter. THIN candidates (opportunities/custom-objects, dual-API, write-back/webhooks) already out of scope; CORE reliability + base-URL-resolution + output-validation retained (no OVER-CUT). _TBD → OK+flag.
### Disposition: PROCEED (base-URL from env)
Final framing → P-1/P-2/P-3:
1. **SDK-research-first:** author command-center/dev/SDK-Docs/Twenty/twenty.md (Twenty is OPEN-SOURCE — full public docs): pick REST (simpler for a read adapter — document why over GraphQL) — the companies + people endpoints, auth (API key Bearer), pagination (Twenty's cursor/starting_after model), rate limits, error shapes, the normalize map (Twenty company/person → NormalizedSourceRecord). + registry.md row.
2. **The Twenty adapter** (twenty.adapter.ts, providerKey='TWENTY', registered): mirror affinity.adapter.ts — fetchCompanies(connection): read TWENTY_API_KEY + TWENTY_BASE_URL from ENV (graceful no-op if EITHER absent — app boots, fixture/Affinity search works); **https-validate the base URL** (scheme + shape, SSRF-guard); INTERNAL pagination (Twenty cursor loop, all pages) + backoff/retry (429/5xx transient, bounded) + timeout (AbortController) + boundary-Zod (Twenty responses) + normalize; register 'TWENTY' in createDefaultRegistry.
3. **[FOLD wave-30 P2-a] OUTPUT self-validation:** the adapter safeParses its OWN output against normalizedSourceRecordSchema (matching fixture.adapter.ts:30/85 — the Affinity adapter's P2-a gap; do it right here — skip+log invalid records).
4. **Secret:** TWENTY_API_KEY + TWENTY_BASE_URL via env ONLY (NEVER committed; requested from founder — key + instance URL). Config schema UNTOUCHED (wave-16 boundary).
5. **Tests:** MOCKED-HTTP unit tests (mirror affinity.adapter.spec) — multi-page pagination, 429/5xx-backoff-retry, timeout, normalize, absent-key/URL no-op, boundary-Zod, output-validation (a malformed normalized record → skipped), base-URL-https-validation. NO live HTTP.
## LOAD-BEARING: SDK-research-first (Twenty doc) + reuse-wave-30-pattern + robustness (pagination+backoff+retry+timeout+boundary-Zod INSIDE fetchCompanies) + base-URL-from-env-https-validated (config untouched — wave-16 boundary) + OUTPUT-self-validation (P2-a fold) + secret-env-never-committed + graceful-no-key/URL. LIVE-verify key-gated (founder's Twenty key + instance URL).
## design_gap_flag: false (backend adapter; reuses sourcing search). D-skip.
## FLAGS: M9 _TBD metric; the Twenty key+URL requested; the Affinity adapter stays dormant (2nd connector); permanent-Actions-fix.
claimed_task_ids: [1eb63a40]
