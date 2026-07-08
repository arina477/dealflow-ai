# Wave 31 — P-block review artifacts
**Block:** P (Product) | **Wave topic:** M9 Integrations — the Twenty CRM DataSourceAdapter (founder redirect 2026-07-08: use twenty.com). A 2nd real DataSourceAdapter behind the EXISTING interface (the Affinity adapter [wave-30] stays registered-dormant). Twenty = OPEN-SOURCE CRM (GraphQL + REST). Fetch companies/people → normalize → sourcing search + ETL. Serves M9 + M3's "≥2 connected sources". | **Block exit gate:** P-4
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
## Block-specific context
- **claimed_task_ids:** [1eb63a40 (Twenty CRM DataSourceAdapter)]
- **Founder decision (2026-07-08):** CRM = Twenty (redirect from Affinity). Affinity adapter STAYS (2nd connector). Twenty is the primary/live CRM.
- **PROVEN PATTERN (wave-30 Affinity):** reuse the DataSourceAdapter interface (fetchCompanies(connection)→NormalizedSourceRecord[]) + register in adapter.registry; SDK-research-first; internal pagination + retry/backoff + timeout + boundary-Zod + normalize; env-secret + graceful-no-key + mocked tests; key-gated live-verify. Apply the SAME.
- **TWENTY-SPECIFIC:**
  - **Open-source** → full public API docs (twenty.com/developers, GitHub). Twenty has a REST API + a GraphQL API — pick one (REST is simpler for a read adapter; document the choice). Core objects: companies, people, opportunities.
  - **Self-hostable** → the instance BASE URL is per-connection config (DataSourceConnection.config), NOT hardcoded (unlike Affinity's fixed api.affinity.co). The founder is on twenty.com cloud OR self-hosted → the base URL comes from connection.config (requested).
  - Auth: Twenty API key (Bearer token) → env secret (TWENTY_API_KEY per the providerKey convention). 
  - **[FOLD wave-30 P2-a lesson]:** the Twenty adapter MUST safeParse its OWN output against normalizedSourceRecordSchema (matching the fixture adapter — the Affinity adapter's P2-a gap; do it right here).
- **LOAD-BEARING:** SDK-research-first (Twenty doc) + reuse-interface + robustness (pagination+backoff+retry+timeout+boundary-Zod INSIDE fetchCompanies) + per-connection-base-URL (not hardcoded) + normalize + output-self-validation (P2-a fold) + secret-env-never-committed + graceful-no-key. LIVE-verify key-gated (founder's Twenty key + instance URL).
- **design_gap_flag:** false (backend adapter; reuses sourcing search). D-skip.
- Autonomous mode: automatic.
## Gate verdict log
<appended by head-product at P-4>

## P-4 Phase 2: karen APPROVE (6/6 VERIFIED — affinity.adapter.ts mirror-target real; dataSourceConnectionConfigSchema .strict-no-baseUrl-slot [wave-16 secret-sink]; P2-a real gap [affinity safeParses inbound-only, fixture safeParses output]; env-secret pattern; vi.stubGlobal mock; SSRF-guard feasible) + jenny APPROVE (6 MATCHES / 1 non-blocking DRIFT-1: task PROSE "base-URL-in-config" contradicts the HEAD's env-only — HEAD is source-of-truth [rule 7], on the boundary-respecting side; clarified via P-4 NOTE). Gemini N/A.
## MERGED P-4 VERDICT: APPROVED. → B-block (D-skip). BINDING: base-URL-from-env (TWENTY_BASE_URL, config UNTOUCHED — DRIFT-1 clarified), mirror-wave-30, P2-a-output-validation-fold, secret-env-never-committed, graceful-no-key/URL, key-gated-live-verify.
**Status:** gate-passed
