# V-1 Jenny — Spec-Compliance Verification (Wave 27, M10 recordkeeping EXPORTS, LIGHT)

**Verdict: APPROVE** — MATCHES 15 / DRIFTS 0

Verified against seed `0d2c5f08` (REWORKED P-2 SCOPE + SEC-1..10, DB), P-3-plan (reworked, sole source), blocks/B/gate-verdict.md (Phase-1 REWORK → resolved) + B-6-review.md (final APPROVE) + shipped code on `wave-27-recordkeeping-export`.

---

## 1. Corrected premise honored — MATCH

The P-4 Phase-2 correction (audit_log_entries HAS FORCE RLS; export via getDb/RLS is the load-bearing guard; read_audit_chain_rls_exempt FORBIDDEN in the payload) is faithfully implemented:
- `recordkeeping.service.ts:301` — explicit "FORBID read_audit_chain_rls_exempt here — RLS is the load-bearing guard"; payload rows read on the RLS-scoped tx handle; verifyChain runs outside-tx, boolean/summary only (:292).
- `recordkeeping.repository.ts:272` — payload path RLS-scoped, rls-exempt forbidden.
- Export EXTENDS the existing recordkeeping module (`apps/api/src/modules/recordkeeping/{controller,service,repository}.ts`) — NOT a 2nd surface. New deltas only: `csv.serializer.ts`, deal/pipeline scope, cap/truncation, firm-admin UI page.
- Note: the pre-REWORK YAML head of the seed still carries the inverted "audit_log_entries has NO RLS / explicit workspace_id filter / RBAC admin-only" text, but the authoritative "P-2 SCOPE — REWORKED" block below it supersedes it, and the shipped code follows the reworked block. Not a drift — the reworked block is the binding source per P-3-plan.

## 2. SEC-1..10 delivered — MATCH (all 10)

- **SEC-1** getDb/RLS not rls-exempt in payload: PASS (service.ts:292/301, verifyChain boolean-only).
- **SEC-2** `.strict()` no client workspace_id: PASS (`packages/shared/src/recordkeeping.ts:144` exportScopeSchema `.strict()`; workspace_id/firmId/tenant forbidden → 400; REISO-4 negative test).
- **SEC-3** extend existing (RLS-scoped repo): PASS (reuses RecordkeepingRepository; deal join to RLS-covered pipeline+mandates only).
- **SEC-4** bounded + EXPLICIT truncation: PASS — **and the Phase-1 P1 is genuinely fixed.** Backend: `EXPORT_ROW_CAP=50_000`, cap+1 fetch → `{truncated, rowsReturned, rowsAvailable}`, COUNT on cap-hit (`repository.ts:266-320`). Wire contract fixed (commit 1ddad90): controller sets `X-Export-Manifest` on BOTH CSV+JSON branches (`controller.ts:218`) + `Access-Control-Expose-Headers` (:219); frontend errors on absent/invalid manifest, never silent-complete; the mock-tautology tests replaced with real fails-before/passes-after contract tests (`recordkeeping.spec.ts:941+`, `page.test.tsx:656`).
- **SEC-5** CSV-injection escape: PASS (`csv.serializer.ts` two-layer: prefix `= + - @ /tab/CR/LF` + RFC-4180 quote-wrap).
- **SEC-6** firm-local ordinal, global seq masked: PASS (`service.ts:349` firmLocalOrdinal idx+1; sequenceNumber omitted; REISO-7 asserts absent).
- **SEC-7** RBAC compliance+admin fail-closed: PASS (controller @Roles + boot-assert + service re-check + page assertRole redirect + rbac.ts route). Reconciled to compliance+admin, correcting the pre-REWORK "admin-only."
- **SEC-8** fault-killing isolation e2e as dealflow_app: PASS — `recordkeeping-export-isolation.e2e-spec.ts` SET ROLE dealflow_app (explicitly NOT postgres, 0016-trap guarded, :135-137/365), REAL exportAsActor in workspaceAls, firm A export = 0 firm B rows across both/deal/audit (REISO-1/2/3), payload does not use rls-exempt. Genuineness proven by the RED#1 collision→17-skipped→suite-FAILED cycle (harness cannot false-pass on 0 execution).
- **SEC-9** export audit-log scope/count-only: PASS (export_generated last-in-txn; payloadHash over scope/format/count/range, never data; actor.id app-users UUID).
- **SEC-10** no cross-firm joins: PASS (deal query joins only pipeline+mandates, both RLS-covered).

## 3. LIGHT posture — MATCH

Delivers a well-built, integrity-verifiable, audit-logged export in standard portable formats (CSV/JSON) — NOT a regulator-certified attestation package. Consistent with the founder 2026-07-07 LIGHT decision (product-decisions "compliance-regime = none / features still built"; roadmap-note "M10 posture LIGHT, recordkeeping exports first"). Spec Why-section states this explicitly.

## 4. First M10 recordkeeping vertical (exports) — MATCH, no scope-creep

Seed is the exports-first bundle (`96ff16b` + `bd829db` 2-task M10 bundle under milestone `033f97e0`). Hard-boundaries explicitly exclude retention/records-view/certification, and the shipped code adds none. Consistent with the milestone-decomposer bundle (retention + records-view are LATER verticals).

## 5. Success metric (light) — MATCH; clean spec-gap for next wave

The on-demand-export half of M10's light success metric is MET: a firm admin can export a complete, workspace-scoped, integrity-verifiable record in a standard format. Journey delta APPLIED (+/compliance/export + extended POST /compliance/audit-log/export).

**Spec-gap for next wave (not a defect):** the RETENTION vertical (retention-policy enforcement) + the records-VIEW vertical remain unbuilt — correctly deferred per the milestone bundle. Next M10 wave should decompose the retention vertical.

---

## Findings summary

No DRIFTS. No conflicting prior decision. The single Phase-1 REWORK item (SEC-4 truncation-honesty wire-contract) is verified fixed in code + tests on the merged branch; isolation (the crown jewel) is solid with a fault-killing, genuinely-executing e2e. Deliverable matches spec intent and the corrected premise.

**APPROVE — MATCHES 15 / DRIFTS 0.**
