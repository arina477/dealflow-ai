# V-1 Karen — Wave 27 (M10 recordkeeping EXPORTS, security product-feature)

**VERDICT: APPROVE** — 0 blocking findings. Deliverable is REAL, LIVE @ff29cf4, and genuinely isolated.

Deployed hash **ff29cf44bcf78557c8a86bbe291d778f3afb500d**. HEAD is 753449c (T-deliverables commit); ff29cf4 is a direct ancestor and the recordkeeping/web/shared/e2e paths are **byte-identical** between ff29cf4 and HEAD (empty `git diff --stat`) — the inspected working tree IS the deployed code.

## 1. Deliverable exists on main @ff29cf4 — REAL
- API module: `apps/api/src/modules/recordkeeping/{service.ts (23.7K), repository.ts (23.0K), controller.ts (14.0K), csv.serializer.ts (2.6K)}` — all present, all touched at ff29cf4.
- Shared contract: `packages/shared/src/recordkeeping.ts` (extended — `exportManifestSchema` with `truncated`/`rowsReturned`/`rowsAvailable` at lines 195-204).
- Web page: `apps/web/app/(app)/compliance/export/page.tsx` + `_components/RecordkeepingExportForm.tsx`.
- SEC-8 e2e: `apps/api/test/recordkeeping-export-isolation.e2e-spec.ts` (37K, 17 `it/test` blocks = the 17/17).

## 2. SEC-1 getDb-not-exempt (isolation guard) — CONFIRMED
- Payload rows are sourced via `repository.findForExportBounded(..., tx)` using the **tx handle** (getDb/RLS path; `audit_log_entries` has FORCE RLS). `runInTransaction` = `getDb(this.db).transaction(...)` (repository.ts:451).
- `read_audit_chain_rls_exempt` is used **only** for the `verifyChain` boolean (`AuditVerifier.verifyChain()`, service.ts:295) — a stateless integrity check, NOT a payload source. Grep confirms **zero** non-comment calls to the exempt function anywhere in the recordkeeping module; the only real call sites live in `audit/audit.repository.ts` (the chain verifier). Deal/pipeline rows (SEC-3) also route via the tx/RLS path (`exportDealPipelineBounded`, repository.ts:369).

## 3. SEC-4 truncation-honesty — CONFIRMED (both branches + fail-loud frontend)
- Controller sets `res.setHeader('X-Export-Manifest', manifestJson)` at controller.ts:218 **before** the CSV/JSON format branch → header set on **both** branches; also exposes it via `Access-Control-Expose-Headers`.
- Frontend (`RecordkeepingExportForm.tsx:588-608`): reads `x-export-manifest`, parses via `exportManifestSchema.safeParse`; if the header is **absent or invalid**, sets `errorMsg` + `setExportState('error')` — it does **NOT** fall back to `truncated:false`. Absent manifest = error state, never silent success. `truncated===true` → prominent `role="alert"` amber banner (line 370). Matches the B-6 fix (SEC-4 P1 caught by /review + head-builder).

## 4. LIVE — INDEPENDENTLY CONFIRMED
- `GET https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"ff29cf44bcf78557c8a86bbe291d778f3afb500d"}` — version == ff29cf4 exactly. **Independently confirmed.**
- Perimeter: unauthed `POST /compliance/audit-log/export` → **401**. **Independently confirmed.** Matches controller guards (SessionGuard + RolesGuard; compliance/admin only, advisor 403). Web route `/compliance/export` enforces `assertRole('/compliance/export')` (advisor/analyst redirect to `/`).
- No prod firm-admin creds → cross-tenant isolation proof rests on CI SEC-8 17/17 per CI-e2e-authoritative-policy.

## 5. No secret in diff + SEC-8 runs as dealflow_app (not the false-green trap) — CONFIRMED
- Secret scan of the ff29cf4 feature diff (recordkeeping/web/shared/e2e paths): **no** password/api-key/token/private-key/hardcoded-DSN in added lines. `git show ff29cf4:...e2e-spec.ts` has no inline postgres creds (uses `TEST_DATABASE_URL` env).
- SEC-8 exercises the export path under `SET ROLE dealflow_app` (NOSUPERUSER NOBYPASSRLS → FORCE RLS applies; helper at e2e:135-143), with an explicit comment flagging the **postgres = false-green (0016 trap)**. Superuser GUC is used **only** for seeding fixtures, never the exercised path.

## Non-blocking notes
- CI SEC-8 17/17 green on ff29cf4 is taken as authoritative for the cross-tenant *behavioral* proof (no prod creds to re-run live); code-side guards (SEC-1/3/4/8) independently confirmed above, so the CI dependency is on execution evidence, not design.
