# B-6 Review — Gate Verdict (Phase 1)

**Wave:** 27 — M10 recordkeeping EXPORTS (extend existing export; endpoint + firm-admin page)
**Branch:** wave-27-recordkeeping-export
**Gate:** B-6 Review (head-builder)
**Phase:** 1 (structural + SEC-1..10 binding verification against shipped code)

---

## Verdict: **REWORK**

**Single most important finding:** SEC-4 truncation-honesty UI is broken by a frontend↔backend wire-contract drift — the client reads truncation metadata from an `x-export-manifest` response header that the API controller **never sets**, so every real export falls back to `truncated:false / entryCount:0` and renders as **`empty`**, silently presenting a truncated 50k-row export as complete. The passing frontend tests are a **mock tautology**: they fabricate the missing header.

---

## SEC-by-SEC findings

| SEC | Verdict | Evidence |
|---|---|---|
| **SEC-1 [CRIT] getDb/RLS, not rls-exempt in payload** | **PASS** | `recordkeeping.service.ts` — payload rows read via `findForExportBounded`/`findDealRowsBounded` on the RLS-scoped `tx` handle inside `runInTransaction`; `getDb(this.db)` is the RLS path. `verifyChain()` runs OUTSIDE the tx and only its boolean/summary enters `verifyResult` — never sources payload rows. `read_audit_chain_rls_exempt` appears nowhere in the payload path. No global-chain serialization into the payload. |
| **SEC-2 .strict() no workspace_id + negative test** | **PASS** | `exportScopeSchema` is `.strict()` (recordkeeping.ts:144); controller `safeParse → 400` (controller:188-193); REISO-4 negative test asserts `workspace_id`/`firmId` rejected. |
| **SEC-3 extend existing export (RLS-scoped repo)** | **PASS** | `findDealRowsBounded` LEFT JOINs pipeline→mandates (both RLS-covered); reuses existing RecordkeepingRepository. No 2nd surface. |
| **SEC-4 [HIGH] bounded + EXPLICIT truncation** | **FAIL** | Backend correct: cap 50k, 12mo default (`defaultFromDate`), cap+1 detect, COUNT for `rowsAvailable`, `manifest.truncated/rowsReturned/rowsAvailable` all populated. **BUT the frontend never receives them:** `RecordkeepingExportForm.tsx:582` reads `res.headers.get('x-export-manifest')`; controller (`recordkeeping.controller.ts:206-218`) sets only `Content-Type` + `Content-Disposition` and, for JSON, puts the manifest in the body — never in a header. `grep -rni x-export-manifest apps/api/src/` = **0 hits.** Client fallback (form:604-614) hardcodes `truncated:false, entryCount:0`, forcing state → `empty` for EVERY successful export and rendering a truncated export as complete. Direct violation of "no silent short complete file." |
| **SEC-5 CSV-injection escape** | **PASS** | `csv.serializer.ts` two-layer: Layer-1 prefix on `= + - @ / TAB / CR / LF` first-char; Layer-2 RFC-4180 quote-wrap + doubled quotes. REISO-6 covers all triggers. |
| **SEC-6 firm-local ordinal, global sequence masked** | **PASS** | `ExportAuditEntry` omits `sequenceNumber`; `firmLocalOrdinal` 1..N assigned in service; REISO-7 asserts `'sequenceNumber' in entry === false`. |
| **SEC-7 RBAC compliance+admin fail-closed** | **PASS** | Controller `@Roles(...EXPORT_ROLES)` from shared `rolesForRoute` + boot-fail assertion if `[]`; service-layer `EXPORT_ALLOWED_ROLES` re-check (advisor 403); page `assertRole('/compliance/export')` server redirect; rbac.ts route compliance+admin, no navItem. |
| **SEC-8 [HIGH] real isolation e2e as dealflow_app** | **PASS** | `recordkeeping-export-isolation.e2e-spec.ts` — `SET ROLE dealflow_app` (explicitly NOT postgres; 0016-trap comment), seeds firm A+B, runs REAL `RecordkeepingService.exportAsActor` in `workspaceAls.run` with GUC-bound handle. Asserts firm A export = 0 firm B rows across both/deal/audit scopes. Genuinely fault-killing: only audit-write + verifyChain are mocked (correct — proves payload READ isolation; if RLS were bypassed firm-B rows leak → test fails). REISO-8 confirms verifyChain boolean-only + payload RLS-scoped. |
| **SEC-9 export audit-log scope/count only** | **PASS** | `export_generated` appended LAST-IN-TXN; payloadHash over scope/format/count/range only (never the data); `actor.id` app-users UUID not raw ST id; rollback-on-audit-fail → exactly-one-or-none. |
| **SEC-10 no cross-firm joins** | **PASS** | Deal query joins only pipeline + mandates (tenant, RLS-covered); no join to roles/workspaces/app_meta. |

## Frontend / build

- RBAC-gated route + server redirect: **PASS**. IntegrityBand (ShieldCheck, not color-only): **PASS**. radiogroup ARIA + roving focus: **PASS**. Design tokens: **PASS**.
- Truncation-honesty UI **exists but is unreachable in production** (SEC-4 failure above). The `role="alert"`/`aria-live="assertive"` banner, distinct `truncated`/`empty` states, and persistent download link are all correctly authored — they simply never fire because the manifest never arrives.
- typecheck/lint/build/unit greens are **not trustworthy for SEC-4**: the frontend suite (`page.test.tsx` `makeExportFetch`, line 141) mocks `x-export-manifest` to return the manifest JSON, validating the UI against a header the backend does not emit. Coverage is green over a fabricated contract.

---

## Required rework (return to B-2 + B-3 authors)

1. **Fix the manifest wire contract (load-bearing, SEC-4).** Either:
   - (a) Backend: have the controller set `res.setHeader('x-export-manifest', JSON.stringify(pkg.manifest))` on BOTH csv and json responses (the client already parses it, and `exportManifestSchema` validates it); OR
   - (b) Frontend: for `format:'json'`, read the manifest from the response body instead of the header.
   Pick one and make the client's success/truncated/empty branching depend on the real manifest.
2. **Kill the test tautology.** Add a test that exercises the REAL header/body path (not a mock that injects the header the backend never sends) — e.g. a contract test asserting the API response actually carries the manifest, or a frontend test whose mock omits `x-export-manifest` and proves the JSON-body fallback path yields the correct truncated/empty/success state. The current SEC-4 UI tests must fail before the fix and pass after.
3. Re-run typecheck/lint/build + api/web unit + the SEC-8 e2e after the fix; resubmit for Phase-1 re-gate.

---

```yaml
head_signoff:
  verdict: REWORK
  stage: B-6
  reviewers:
    head-builder: REWORK
  failed_checks:
    - "SEC-4: frontend reads truncation manifest from x-export-manifest response header that the API controller never sets → every export falls back to truncated:false/entryCount:0 → renders as empty; a truncated export is silently presented as complete (silent-short-complete violation)"
    - "B-5 Verify: SEC-4 truncation-honesty frontend tests are a mock tautology — makeExportFetch fabricates the x-export-manifest header the backend does not emit, so the green suite validates a contract that does not exist in production"
  passed_checks:
    - "SEC-1 getDb/RLS payload read; verifyChain outside tx boolean-only; read_audit_chain_rls_exempt absent from payload path"
    - "SEC-2 .strict() + 400 + negative test"
    - "SEC-3 extends existing RLS-scoped repo"
    - "SEC-5 two-layer CSV injection escape + RFC-4180"
    - "SEC-6 firmLocalOrdinal; global sequenceNumber masked (asserted absent)"
    - "SEC-7 RBAC compliance+admin fail-closed (controller @Roles + boot-assert + service re-check + page assertRole redirect + rbac.ts route)"
    - "SEC-8 fault-killing isolation e2e as dealflow_app (not postgres); real exportAsActor in workspaceAls; firm A export = 0 firm B rows across both/deal/audit; verifyChain boolean-only"
    - "SEC-9 export audit-log scope/count-only, last-in-txn, actor.id, exactly-one-or-none"
    - "SEC-10 joins only RLS-covered tenant tables"
    - "Frontend RBAC route + IntegrityBand + radiogroup ARIA + design tokens (truncation UI correctly authored but unreachable pending SEC-4 fix)"
  rationale: >
    Nine of ten binding SEC obligations pass against the shipped code, including all three
    crux items on the backend and the isolation harness — SEC-1 (payload strictly via
    getDb/RLS, verifyChain boolean-only, no rls-exempt in the payload path), SEC-7/RBAC
    (double-guarded, boot-fail-closed), and SEC-8 (a genuinely fault-killing e2e run as
    dealflow_app, not postgres, asserting zero cross-firm leakage across all scopes). The
    backend also computes the full SEC-4 truncation manifest correctly. However the load-bearing
    SEC-4 truncation-honesty contract is broken end-to-end: the frontend reads the manifest from
    an x-export-manifest header the controller never sets, so in production every export degrades
    to the hardcoded fallback (truncated:false, entryCount:0) and renders as empty — a truncated
    export is silently presented as complete, the exact failure SEC-4 exists to prevent. The
    passing frontend SEC-4 tests do not catch this because their fetch mock fabricates the missing
    header (mock tautology). A cross-tenant leak was NOT found; the defect is a silent-truncation /
    frontend-spec-drift, and it is a hard REWORK because SEC-4 is a binding, load-bearing obligation.
  next_action: REWORK_B-2_and_B-3
```
