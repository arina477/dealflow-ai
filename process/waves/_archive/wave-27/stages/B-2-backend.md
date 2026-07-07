# Wave 27 — B-1/B-2 (extend recordkeeping export)
Commit bcfc452. All 10 SEC honored (EXTENDS the existing recordkeeping export, no rebuild):
- SEC-1 findForExportBounded reads via tx/getDb/RLS (audit_log_entries FORCE RLS); verifyChain OUTSIDE tx = boolean/summary only; read_audit_chain_rls_exempt FORBIDDEN in payload.
- SEC-2 exportScopeSchema .strict() + format/scope enums, NO workspace_id/firmId/tenant.
- SEC-3 findDealRowsBounded (pipeline JOIN mandates — RLS-covered). SEC-10 no roles/workspaces/app_meta cross-firm join.
- SEC-4 defaultFromDate (12mo) + EXPORT_ROW_CAP 50k; cap+1 truncation detect + COUNT; manifest truncated/rowsReturned/rowsAvailable (no silent short complete).
- SEC-5 csv.serializer.ts two-layer (=+-@/TAB/CR/LF prefix-quote + RFC-4180).
- SEC-6 firmLocalOrdinal 1..N; global sequenceNumber ABSENT from payload (side-channel masked); prev_hash/entry_hash kept.
- SEC-7 EXPORT_ALLOWED_ROLES [compliance,admin] + boot-fail-closed. SEC-9 export_generated append last-in-txn, metadata only, actor.id.
- SEC-8 recordkeeping-export-isolation.e2e-spec.ts (REISO-1..8) as dealflow_app (NOT postgres): 0 firm-B rows (both/deal/audit), .strict-negative, truncation, CSV-escape, firm-local-ordinal, verifyChain-boolean-only.
- typecheck 4/4, lint 3/3, 986 pass. Deviations: none.

## B-6 rework — SEC-4 truncation-honesty gap closed (commit 1ddad90)

Defect: controller wrote the CSV/JSON body but never called `res.setHeader('X-Export-Manifest', ...)`. The browser (via the Next.js same-origin rewrite proxy) received no header → frontend fallback synthesised `manifest.truncated:false` → capped export silently presented as complete. SEC-4 invariant broken end-to-end at the HTTP boundary.

Changes:
- **Controller** (`recordkeeping.controller.ts`): `res.setHeader('X-Export-Manifest', JSON.stringify(pkg.manifest))` added BEFORE both CSV and JSON branches. `Access-Control-Expose-Headers: X-Export-Manifest` also set for cross-origin readability (direct API consumers / e2e Supertest). The manifest is computed by the service and confirmed correct by SEC-8 e2e; the fix surfaces it at the HTTP layer.
- **API integration test** (`recordkeeping.spec.ts`): new `SEC-4 HTTP CONTRACT` describe block (5 tests) verifies the controller sets `X-Export-Manifest` on CSV branch, JSON branch, with `truncated:true` for a capped export, `truncated:false` for uncapped, and `Access-Control-Expose-Headers` for cross-origin access. These tests assert the HTTP boundary specifically (not the pkg level).
- **Frontend** (`RecordkeepingExportForm.tsx`): removed the unsafe `truncated:false` synthetic fallback. Absent or invalid manifest now routes to error state with an informative message — an absent manifest cannot be assumed complete.
- **Frontend test** (`page.test.tsx`): mock-tautology killed. Added `makeExportFetchNoManifest()` helper and a new `SEC-4 tautology-kill` describe block (5 tests): absent `X-Export-Manifest` → error panel (role=alert), no "Integrity verified" text, no download link, no truncation-warning, informative error copy. The pre-fix synthetic-fallback path (absent → success) is now a failing test.

Cross-tenant isolation (SEC-1/SEC-8 — getDb/RLS, export-isolation e2e) untouched and remains SOLID.

typecheck 4/4 clean. lint 3/3 exit 0. API: 991 pass (70 in recordkeeping.spec.ts). Web: 900 pass (63 in compliance/export/page.test.tsx). SEC-8 e2e still gated (no TEST_DATABASE_URL in unit env). Deviations: none.

