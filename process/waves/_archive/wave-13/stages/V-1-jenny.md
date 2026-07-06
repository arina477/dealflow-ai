# V-1 jenny — spec-INTENT vs DEPLOYED behavior (wave-13, M6 audit-log / recordkeeping-EXPORT)

Reviewer: jenny (spec-compliance auditor). Deployed commit: `2ec4953` (git HEAD `ec2f3a6` = 2ec4953 + T-9 docs-only chore). LIVE @ api `dealflow-api-production-66d4` + web `dealflow-web-production-a4f7`.

Authoritative spec = the three `tasks.description` YAML contracts (36a17c81 read+verify, 20c479db export, 10ee0ec4 page) + the wave-13 spec body SCOPE-HELD / HARD-BOUNDARY clauses. Method: DB spec pull + own live anon probes + full source read of the deployed recordkeeping module, page components, and shared contracts + C-2's authed live verification (invite-only app — I could not mint authed sessions myself; I relied on C-2's live read/verify/export evidence for the authed surface and say so explicitly where used).

## VERDICT: APPROVE — spec-DRIFT: 0 · spec-GAP: 1 (gate-evaluate mandate-attribution, honestly handled) · coverage-directive: 1 (DEV-2)

The deployed behavior honors the INTENT of all three spec contracts beyond the ACs the T-block tested. No code-is-wrong drift found. One genuine spec-GAP (the spec assumed a producer was mandate-derivable that structurally is not) was discovered during build and handled honestly (documented exclusion, no overclaim). DEV-2 is a real but fillable test-coverage gap on a filtered path, not a correctness defect — acceptable-with-a-test-directive, consistent with head-tester's MEDIUM carry-forward.

---

## 1. Read-only + real verify shape (36a17c81) — HONORED

Spec (36a17c81 AC-1/AC-2, SCOPE-HELD §1): read endpoint READ-ONLY (emits ZERO audit rows); verify returns the REAL `AuditVerifier.verifyChain()` shape `{ok, entriesChecked, firstBreakAt?, reason?}` — NOT an invented `{ok, anomalies[]}`.

- Deployed READ-ONLY invariant honored in code: `recordkeeping.service.ts:116-132` (`listAsActor`) and `:148-156` (`verifyChainAsActor`) contain NO `auditService.append` call under any branch; both go through `RecordkeepingRepository` which is pure `db.select()` (`recordkeeping.repository.ts:136-206`, no INSERT). The only `append` in the module is the export path. Unit-asserted: `recordkeeping.spec.ts:5-6` (list + verify emit ZERO `AuditService.append` calls).
- Real verify shape honored: `verifyChainAsActor` delegates directly to `this.auditVerifier.verifyChain()` (`:155`) — the single existing tamper-evidence source, no re-implementation/fork. Return type `AuditVerifyResponse`. UI `IntegrityBadge.tsx:71-173` renders exactly `{ok, entriesChecked, firstBreakAt, reason}` — emerald "All entries verified (N)" on ok, amber "N entries — break at #K (reason)" on ok:false — the REAL shape, not `anomalies[]`.
- Live evidence (C-2 §Verify): `GET /compliance/audit-log/verify` → `200 {ok:true, entriesChecked:309}` over the real 309-entry production chain (not a stub/fixture). My own anon probe: `GET .../verify` → `401` (SessionGuard, matches AC-3 edge-case). Web page anon → `307` → /login (AC edge-case honored).
- RBAC (AC-3): verify/read guarded by `SessionGuard + RolesGuard`; READ_ROLES/VERIFY_ROLES sourced fail-closed from shared `rolesForRoute` with boot assertions (`recordkeeping.controller.ts:73-103`). Advisor own-outreach scoping enforced server-side in the service (`:122-128`), not just the guard. C-2: advisor read 200 with 0 own-outreach rows; advisor verify 403; anon 401.

Note on 10ee0ec4 AC-(a) prose "N anomalies detected": the same AC pins "(real `{ok,entriesChecked,firstBreakAt,reason}`)" in the parenthetical, and the SCOPE-HELD §1 is explicit. The deployed badge matches the real shape. Not a drift — the loose "anomalies" wording is sketch prose; the formal contract and the code agree.

## 2. Export = deterministic verifiable package + one-audit-last-in-txn (20c479db) — HONORED

Spec (20c479db AC-1..AC-4, SCOPE-HELD §2): package = in-scope entries + full-chain verify + manifest for offline re-verify; ONE deterministic format; the export ACTION appends EXACTLY ONE `export_generated` row LAST-IN-TXN; compliance/admin only, advisor 403.

- Package shape honored: `recordkeeping.service.ts:213-254` assembles `{manifest, verifyResult, entries}` — entries carry stored `sequenceNumber/prevHash/entryHash` (read passthrough, never recomputed, `:46`); `verifyResult` is the full-chain `verifyChain()` (`:210`, computed OUTSIDE the tx, read-only); manifest `{scope, generatedAt, generatingActor, chainRoot=GENESIS_PREV_HASH, tailHash, entryCount}` (`:224-231`) enables offline re-verification. Matches AC-1 (a)(b)(c) exactly.
- One-audit-last-in-txn honored: single `runInTransaction` (`:213`), the `auditService.append({action:'export_generated', ...}, tx)` is the LAST write (`:251`); if append throws the whole tx rolls back → no package without its row (exactly-one-or-none, AC-3 edge-case). Unit-asserted: `recordkeeping.spec.ts:15-19` (append fires exactly once; rollback-on-throw). Live-proven (C-2): verify BEFORE export = 309, AFTER = 310 (delta +1), `export_generated` newest action — the export action itself is audited.
- Determinism (AC-2) honored with an HONEST caveat documented in code (`:39-46, 180-188`): scoped entries stable (sequence ASC, DB hashes); manifest scope/chainRoot/tailHash/entryCount deterministic; `generatedAt`/`generatingActor` and full-chain `entriesChecked` vary per call by design (verify is full-chain, grows as the log grows). This is a correct reading of "deterministic (same scope → byte-identical package)" — the entries+hashes are stable; the intentionally non-deterministic fields are the timestamp/actor the AC already excludes and the full-chain length that the full-chain-verify design necessitates. Not a drift.
- One format honored: single JSON attachment (`Content-Disposition: attachment; filename="audit-log-export.json"`, `controller.ts:162`). No PDF/multi-format (deferral, §5).
- RBAC/SoD (AC-4) honored: `EXPORT_ALLOWED_ROLES = {compliance, admin}` in the service (`:91, :196-198`) AND EXPORT_ROLES fail-closed from shared matrix at the controller (`:97-103`). Advisor 403 proven server-side (C-2), not merely UI-hidden.

## 3. Mandate-scope DERIVATION (the P-4/B-6 concern) — INTENT HONORED; DEV-2 = coverage-directive

Spec (36a17c81 contracts.api + spec body): mandate is DERIVED per `resource_type` (NO `mandate_id` column), and "must capture ALL producers' rows for the mandate, not just mandate-* rows"; gate-evaluate "honestly excluded (documented)".

- The deployed derivation is NOT a naive `resource_id = mandateId` filter (the exact P-4-karen WRONG-fix, `P-4-karen.md:22-28`). `recordkeeping.repository.ts:270-303` implements the full 8-branch per-resource_type derivation: `mandate` (direct), `outreach`/`pipeline`/`match_run`/`buyer_universe` (one-hop FK join), `pipeline_event`/`match_candidate`/`buyer_universe_candidate` (two-hop join), `audit-log-export` (direct) — capturing all cleanly-mandate-derivable producers. This directly resolves the load-bearing P-4 concern; the code honors the INTENT (no silent row-dropping).
- The exclusion is HONEST and ACCURATE (I verified the producer, not just the doc): the repo doc (`:24-31, 263-269`) claims gate-evaluate rows carry `resource_type='outreach-template-version'` (cross-mandate) and are intentionally excluded. Confirmed against the real producer: the outreach compose path builds the gate context with `resourceType:'outreach-template-version'` (`outreach/outreach.service.ts:268`) and `compliance-gate.service.ts:144` writes the gate-evaluate audit row with `resourceType: ctx.resourceType`. So gate-evaluate is genuinely keyed to the reusable cross-mandate template version — adding a template-version→mandate branch WOULD over-capture other mandates' decisions. The exclusion is the correct call and is truthfully documented (no overclaim).
- DEV-2 classification: **coverage-directive, NOT drift, NOT gap.** The 8-branch SQL is only UNIT-tested via a mocked repo (`recordkeeping.spec.ts:7-10, 109-117` — `findFiltered`/`findForExport` are `vi.fn()`; no real Drizzle/PGlite in the suite, confirmed by grep = 0 real-DB hits). So the assertion "a mandate export captures ALL mandate-derivable producers and excludes gate-evaluate" is structurally verified (/review) + honestly documented but never executed against a real schema; C-2's live export used empty scope `{}` (full chain), so the mandate filter was not exercised live either. The code is correct-by-inspection (correct casts, joins, no double-count, injection-safe params) — this is a verification-layer gap on a compliance-correctness path, not a code defect. Endorse head-tester's directive (`T/gate-verdict.md:22`): author a real-DB mandate-derivation integration test (reuse the wave-12 race-safe migrate helper) seeding multi-producer rows under one mandate, asserting inclusion of all derivable producers + exclusion of gate-evaluate, BEFORE the scoped-export view is relied on for an actual regulator request. Fillable, well-scoped — not ship-blocking.

## 4. Page /compliance/audit-log (10ee0ec4) — HONORED; F11 continuity intact

- Table + real-shape badge + export panel: `page.tsx:227` (IntegrityBadge, real shape), `:231-236` (AuditLogTable, SSR-hydrated initial 50, deep-links `?mandate_id/?from/?to` forwarded `:171-181, 232-235`), `:242-247` (ExportPanel). C-2 self-grep of DEPLOYED authed HTML: compliance page 179 KB with `data-testid` export-panel=1/export-cta=1 + integrity-badge=1 + 27 filter markers.
- Advisor NO export (AC-2), server-authoritative + UI defense-in-depth: `ExportPanel.tsx:62-65` returns null for advisor/analyst; server 403 is the real boundary (§2). C-2: advisor page 31.6 KB, export-panel testid=0, export-cta=0, download=0 — panel truly ABSENT, not merely hidden.
- Read-only, no send/AI (AC-3, AC-edge, HARD-BOUNDARY): AuditLogTable has zero edit/delete affordance (`:27` doc + C-2 grep 0 edit/delete on rows). No send/email/AI: my grep of the recordkeeping module + page found the only email/LLM/webhook strings are NEGATIVE boundary comments and a test assertion that no email button renders (`page.test.tsx:422/566/787`). C-2 confirmed 0 interactive send/email/AI affordance on both deployed pages; the "AI" hits are the allowed DealFlow-AI brand tagline (CODE-OF-CONDUCT compliant).
- Journey continuity (F11): T-9 regen confirms `/compliance/audit-log` enhanced (filters+badge+export) with 0 critical regressions, auth backbone unchanged (`T-9-journey.md:3-9`).

## 5. Deferrals honored — YES

SCOPE-HELD §2 / HARD-BOUNDARY: DEFER PDF/multi-format/multi-regulation presets/background-jobs/export_templates/forensic; ZERO send/webhook/LLM/new-SDK/founder-credential. Confirmed in deployed code: single JSON format only; no `anthropic`/mailer/webhook/pdf import in the module (grep = only negative-boundary comments in `recordkeeping.module.ts:20-21`); no schema migration (C-2 §"NO migration this wave" — export_generated is an additive shared-enum value on the existing TEXT `action` column). Matches the scope-hold. No founder credential consumed.

## 6. Spec-GAP surfaced by deployed behavior (log for a future bundle)

**GAP-1 (spec-GAP, correctly handled) — gate-evaluate is not cleanly mandate-attributable.** The 36a17c81 contract listed "gate/approval via their resource's mandate", implicitly assuming every producer is mandate-derivable. Build discovered that gate-evaluate rows are keyed to the cross-mandate reusable template version (`resource_type='outreach-template-version'`), so they cannot be attributed to a single mandate without over-capturing other mandates' compliance decisions. The spec's completeness assumption was incomplete for this one producer. The implementation handled it correctly (exclude + document, no overclaim), and the CANONICAL regulator export — the full-chain export with no mandate filter — DOES capture gate-evaluate (proven live at entryCount 309). Net effect: only the OPTIONAL mandate-scoped filtered slice omits gate-evaluate, and it says so. This is a spec-GAP, not a code defect. Recommend a future bundle either (a) add a producer-side mandate-attribution field for gate-evaluate (the INFO follow-on already logged at `T/findings-aggregate.md`), or (b) formally narrow the "capture ALL producers" claim in the mandate-scoped contract to "all cleanly-mandate-derivable producers; gate-evaluate obtainable via time-range/full-chain export."

---

## Findings summary

| # | Type | Severity | Spec ref | Deployed evidence | Disposition |
|---|------|----------|----------|-------------------|-------------|
| DEV-2 | coverage-directive | Medium | 36a17c81 contracts.api (mandate derivation) | 8-branch SQL `recordkeeping.repository.ts:270-303` unit-only (mocked repo `recordkeeping.spec.ts:109-117`); C-2 live export used empty scope | Non-blocking. Author real-DB mandate-derivation integration test before live regulator reliance on scoped export. Carry to L. |
| GAP-1 | spec-GAP | Low/Info | 36a17c81 "capture ALL producers" | gate-evaluate `resource_type='outreach-template-version'` (`outreach.service.ts:268` + `compliance-gate.service.ts:144`); honestly excluded+documented `repository.ts:24-31,263-269`; full-chain export still complete | Non-blocking. Log producer-side gate-attribution for a future bundle; optionally narrow the contract wording. |

No spec-DRIFT (code-is-wrong) found. All three contracts' shipped INTENT is honored in deployed behavior.

## Recommendation
APPROVE the V-block spec-compliance lane. The M6 recordkeeping-export vertical delivers what the specs promised: read-only filtered read, real-shape full-chain verify, deterministic self-verifiable export with exactly-one audited action last-in-txn, honest mandate derivation, and a role-gated read-only page — all proven live at `2ec4953`. Route DEV-2 (test directive) and GAP-1 (future-bundle log) as non-blocking carry-forwards. Recommend @task-completion-validator only if V-2 wants the DEV-2 real-DB test authored in-wave rather than carried.

```yaml
v1_jenny_verdict: APPROVE
spec_drift_count: 0
spec_gap_count: 1
coverage_directive_count: 1
blocking: false
carried_to_v2:
  - "DEV-2 (MEDIUM coverage-directive): mandate-derivation 8-branch SQL unit-only (mocked repo); author real-DB integration test asserting all-derivable-producers-in + gate-evaluate-out before scoped-export regulator reliance"
  - "GAP-1 (LOW/INFO spec-gap): gate-evaluate not cleanly mandate-attributable (resource_type=outreach-template-version, cross-mandate); honestly excluded+documented, full-chain export complete; log producer-side attribution for future bundle"
deployed_commit: 2ec4953
live_evidence: "own anon probes (verify 401, page 307, /health version==2ec4953) + C-2 authed live (verify {ok:true,309}, export delta 309->310, advisor-403, M2-400, AC-STRIP both roles) + full source read of deployed recordkeeping module/page/shared contracts"
```
