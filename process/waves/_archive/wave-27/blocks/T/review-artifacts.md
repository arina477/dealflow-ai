# Wave 27 — T-block review artifacts (SECURITY-SCOPE-TIGHTENED; product-feature + UI)
**Wave topic:** M10 recordkeeping EXPORTS — extended export (CSV+deal/pipeline+cap/truncation, RLS-scoped) + firm-admin /compliance/export page. LIVE @ff29cf4. | **Block exit gate:** T-9
**wave_type:** product-feature (data export) + UI | **T-8 Security stage: MANDATORY (cross-tenant isolation crown-jewel)**
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI @ff29cf4 lint+typecheck GREEN |
| T-2 | unit | A (CI) | done | api 1103 + web 900 pass; recordkeeping suite 70 (incl SEC-4 contract), export page 63 |
| T-3 | contract | A (CI) | done | exportScopeSchema .strict + exportManifestSchema (truncated/rowsReturned/rowsAvailable); SEC-4 X-Export-Manifest contract test |
| T-4 | integration/DB | A (CI) | done | **SEC-8 recordkeeping-export-isolation.e2e RAN+PASSED 17/17 (0 skipped) as dealflow_app — firm A export=0 firm B rows (both/deal/audit); no rls-exempt in payload; the CROSS-TENANT proof** |
| T-5 | e2e | A (CI) | done | web export page flow tests |
| T-6/T-7 | layout/perf | partial | done | UI adopted D-3 design; perf N/A (cap-bounded 50k) |
| T-8 | SECURITY (MANDATORY-tightened) | active | pending | head-tester: the SEC-1..10 proof (esp SEC-1 getDb-not-exempt + SEC-8 isolation + SEC-4 truncation-honesty) genuinely tested; RBAC; secret-grep |
| T-9 | journey | active | pending | head-tester gate: journey delta (+/compliance/export route + the export endpoint) |
