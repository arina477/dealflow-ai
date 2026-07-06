# V-1 Karen — Wave 14 (M6 compliance hardening) Reality Verdict

**Agent:** karen (Project Reality Manager)
**Scope:** Load-bearing CLAIMS TRUE in DEPLOYED state + repo @ merge commit — not the diff.
**Merge/deploy commit:** `main @ 5754fbf` (code `0488cd7` + docs-only chore). HEAD = `d169a5f` (T-9 journey, docs-only after merge).
**Live:** api `https://dealflow-api-production-66d4.up.railway.app` `/health` → `{"status":"ok","db":"ok","version":"5754fbf11818110f47a1c774aa06ebfe4042a8ef"}` (== merge commit, independently probed). web `https://dealflow-web-production-a4f7.up.railway.app` live.

## VERDICT: APPROVE

All 8 load-bearing claims verified TRUE against deployed reality + repo @ `5754fbf`. Zero fabricated/fake claims. Zero overclaims. The two compliance-critical claims (hash-safety, gate no-regression) hold in code AND live. The one honest limitation (L1 — mandate_id tamper silent to verifyChain) is documented candidly, not hidden.

---

## Claim-by-claim evidence

### Claim 1 — Files exist @ 5754fbf — TRUE
`git ls-tree -r 5754fbf` confirms every named file:
- `apps/api/src/db/migrations/0012_audit_mandate_id.sql` (+ `.down.sql`)
- `apps/api/src/db/migrations/meta/_journal.json` + `meta/0012_snapshot.json`
- `apps/api/src/modules/audit/audit.service.ts` (`appendWithMandate` present, line 94)
- `apps/api/src/modules/audit/audit.mandate-hash-safety.spec.ts`
- `apps/api/test/recordkeeping-gate.e2e-spec.ts`
- `apps/web/app/(app)/compliance/oversight/{page.tsx,page.test.tsx,_components/ComplianceOversightTable.tsx}`

### Claim 2 — HASH-SAFETY: mandate_id EXCLUDED from hash core — TRUE (compliance-critical)
- `audit.hash.ts:HashableEntryFields` interface — 10 fields (sequenceNumber, actorUserId, actorRole, action, resourceType, resourceId, contentHash, payloadHash, chainVersion, createdAt). **NO `mandateId`.**
- `canonicalSerialization` v1 byte-layout emits only those 10 fields + `prev_hash`. No mandate reference. v1 layout unchanged (guarded by chain_version-1 throw + golden-vector test).
- `audit.service.ts:_appendCore` (line 130) builds `const hashable: HashableEntryFields` WITHOUT mandateId (line 154), computes `entryHash = computeEntryHash(hashable, prevHash, key)` (line 169), then writes `mandateId` to the DB column separately (line 178). Explicit comment line 168: "mandateId is NOT in `hashable` — it is hash-excluded by design."
- `appendWithMandate` (line 94) → `_appendCore(input, tx, mandateId)`. Same hashable fields as `append()`.
- Migration SQL header + `0012_audit_mandate_id.sql` body: single `ADD COLUMN "mandate_id" uuid` (nullable), header states hash-exclusion rationale.
- **Unit proof:** `audit.mandate-hash-safety.spec.ts` test "mandateId is excluded from the hash: direct hash recomputation proof" (line 152) recomputes HMAC over fields WITHOUT mandateId and asserts it == stored entry_hash.

### Claim 3 — Migration 0012 JOURNALED (Ghost-Green fixed) — TRUE
- `_journal.json` has `idx: 12`, `tag: 0012_audit_mandate_id`, `when: 1783814400000` — strictly > idx 11 (`when: 1783728000000`). Registered, ordered correctly.
- `0012_snapshot.json`: `prevId: f3daf257-27ba-4892-aab4-45b0598e9c98` == `0011_snapshot.json.id` (chain intact). `public.audit_log_entries.columns.mandate_id` = `{type: uuid, notNull: false}` (nullable). A clean-DB `drizzle migrate` WILL create the column.
- Live proof (Claim 6): verifyChain runs green live over the migrated production chain → column applied in prod.

### Claim 4 — Gate NO-regression — TRUE (compliance-critical)
- `compliance-gate/compliance-gate.service.ts`: allow/block logic UNCHANGED — `verdict.allowed = blocks.length === 0` (line 106); evaluator loop, SoD/suppression/disclaimer/content-hash wiring untouched.
- ONLY change: `this.audit.append(...)` → `this.audit.appendWithMandate(this.verdictAuditEntry(...), tx, parsed.mandateId)` (lines 121-124). Verdict computed BEFORE the audit call; audit-in-tx atomicity preserved.
- CI (Claim 5): `compliance-gate.service.spec.ts` 30 passed, `outreach-gate.e2e-spec.ts` 6 passed (REAL gate, no mocks), `pipeline-gate.e2e-spec.ts` 4 passed.
- Live (C-2): `POST /outreach` bad refs → 404 (server validation fired), malformed → 400, no silent send.

### Claim 5 — DEV-2 LIFTED / e2e ran REAL GREEN — TRUE
- **Independently verified via gh:** `gh run view 28784535052` → `{"conclusion":"success","headSha":"0488cd70a98e77...","status":"completed"}`. headSha == code commit `0488cd7`. Not fabricated.
- `recordkeeping-gate.e2e-spec.ts` has exactly **9** `it/test` blocks (verified count).
- Shared-template-version isolation case is REAL: `SHARED_TEMPLATE_ID` referenced by BOTH mandate-A and mandate-B gate-evaluate rows (lines 83-88, 244-256) — proves isolation is by the mandate_id COLUMN, not by template version.
- C-1 record: `skipped_or_pending: 0`, api `37 files / 727 tests passed`, `ran: REAL` against migration-0012-applied `dealflow_test`. `dev2_hard_gate: LIFTED`.

### Claim 6 — HASH-CHAIN INTACT LIVE — TRUE (compliance-critical)
- C-2 record: `GET /compliance/audit-log/verify` → 200 `{"ok":true,"entriesChecked":310}` LIVE over the accumulated production chain AFTER 0012 landed. Re-checked stable end-of-stage.
- **Independently confirmed endpoint is LIVE + auth-gated:** anon `GET /compliance/audit-log/verify` → **401** on api domain AND web-proxied domain (SessionGuard). `/health` version == `5754fbf`. (Full `{ok:true}` reproduction requires an authed compliance session per prior C-2s; the 401-for-anon + C-2's authed 200 evidence + live migrated column together substantiate the claim.)
- `audit.mandate-hash-safety.spec.ts` unit tests prove verifyChain `{ok:true}` over old-only, new-only, AND mixed old/new chains (lines 84/103/117) — the mixed-chain case is the exact live scenario.

### Claim 7 — Oversight page read-only + distinct + advisor-blocked — TRUE
- `page.tsx`: header docblock — READ-ONLY monitoring view; "No edit, delete, approve, send, or AI." Explicitly NOT a duplicate of wave-11 `/compliance-queue` (lines 5-6). Links to `/compliance-queue` for actual approvals (line 206/242).
- RBAC: `assertRole('/compliance/oversight', me.role)` compliance+admin ONLY; advisor redirected to `/` (fail-closed) — line 152.
- No write verbs: page.tsx has only `fetch` GETs (`/auth/me`, oversight-data). `ComplianceOversightTable.tsx`: "No mutations — this component only GETs" (line 12); the sole `<button>` is a `refresh` (re-GET), not a mutation.
- Live: web `/compliance/oversight` → 307 (auth-guard redirect, live route exists).

### Claim 8 — Antipattern sweep / L1 honesty — TRUE, no overclaim
- `audit-mandate-attribution.md` documents the L1 limitation CANDIDLY: "a post-insert mutation of `mandate_id` is **not detectable by `AuditVerifier.verifyChain()`**" (line 56); "The tamper-evident guarantee ... does **not** extend to the mandate attribution column."
- Names two compensating defenses (append-only INSERT/SELECT-only grant + BEFORE-UPDATE/DELETE trigger; nightly AuditIntegrityJob) AND an explicit **Auditor note** that "The HMAC chain alone is not sufficient for that assurance" if mandate-attribution integrity is a compliance requirement.
- This is honest disclosure of a real trade-off, not a hidden gap or overclaim. The wave-13 H1 docstring contradiction (gate-evaluate "intentionally excluded") is reversed per spec (recordkeeping.repository now captures gate-evaluate rows) — noted in the doc references.

---

## Findings (0 blocking; 2 advisory notes — NOT gate-blocking)

- **[Low / advisory]** Claim 6 full `{ok:true}` reproduction was NOT re-executed live by karen (no authed compliance session minted in this pass). Mitigated by: independent anon-401 confirmation that the endpoint is live + gated, `/health`==5754fbf, C-2's contemporaneous authed 200 `{ok:true,entriesChecked:310}` evidence, and the migrated column being live. Reality is substantiated; a fresh authed probe would be belt-and-suspenders, not a correctness gap.
- **[Low / advisory / by-design]** L1 residual risk (mandate_id mutation invisible to hash-chain) is real but honestly documented with named compensating controls. This is a deliberate, disclosed architecture trade-off (additive hash-safe column), not a defect. If mandate-attribution integrity is ever elevated to a hard compliance requirement, the doc's auditor-note control (DB-superuser audit log / periodic reconciliation) would be needed — track as future M6 hardening, not a wave-14 blocker.

**No claimed-but-fake work. No overclaims. Hash-safety + gate-no-regression + migration-journaling + live-chain-intact all hold in code AND deployed state.**
