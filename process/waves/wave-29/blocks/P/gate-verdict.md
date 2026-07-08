# Wave 29 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, P-4 gate Phase 1)
**Reviewed against:** process/waves/wave-29/blocks/P/review-artifacts.md
**Attempt:** 1  (first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
The wave 29 spec (M10 records-VIEW, the last light vertical — the deal/pipeline-activity browse half) is a clean EXTENSION of two shipped, code-verified patterns rather than a rebuild, and every load-bearing security AC is binary, observable, and falsifiable. I verified the reuse claims directly against source: `findFiltered` (recordkeeping.repository.ts:188) is the paginated browse shape (`limit ?? 50` / `offset ?? 0`, via `getDb`/RLS) to reuse; `findDealRowsBounded` (repository.ts:367) is genuinely export-only (`cap = EXPORT_ROW_CAP = 50_000`, no limit/offset — repository.ts:77), confirming the deal-activity paginated browse is a real gap, not a duplicate surface; the pipeline→mandates join is RLS-covered under FORCE RLS with no global-table joins (repository.ts:395); the isolation harness `recordkeeping-export-isolation.e2e-spec.ts` already exists and runs `SET ROLE dealflow_app` inside `workspaceAls.run()` asserting "firm A sees ZERO firm B rows" (REISO-1/2/3) — the exact fault-killing test the spec mandates reusing; and the RBAC "mirror the export deal-scope" lens is grounded — `/compliance/audit-log/export` is compliance/admin ONLY (advisor 403) with a fail-closed roleRoutes boot assertion. The spec correctly holds READ-ONLY (no audit row, no mutation/purge), paginates at a browse page size (~25–50, explicitly NOT the 50k export cap), and descopes the page-unification redesign (mvp-thinner) to a sibling, closing the M10-light "viewable in-app" metric without over-build. Sizing clears the single-spec floor on the upper band (~1000–2300 LOC residual after unification split); mvp-thinner's floor-proximity flag is dispositioned: the deal-activity API + browse page + Zod contract + RLS/RBAC/read-only tests carry sufficient net LOC to hold the single-spec floor, so the unification sibling stays split. All six P-4 stage-exit checks pass: audit-log/compliance/RBAC ACs are binary + machine-readable; reviewer verdicts (problem-framer PROCEED, ceo-reviewer PROCEED HOLD-SCOPE, mvp-thinner THIN) are logged and integrated; every claimed_task_id traces to the M10 metric via P-0.

## Load-bearing confirmations
- **REUSE-not-rebuild:** CONFIRMED. Spec extends `findFiltered` browse shape + `findDealRowsBounded` RLS join (adds a paginated DESC variant); does NOT rebuild. Unification-redesign correctly descoped to sibling under d573e7bf.
- **Workspace-RLS-scoping (crux):** CONFIRMED load-bearing + falsifiable. Reads via getDb/FORCE RLS, reuses the RLS pipeline→mandates join (no raw/admin path). Blocking AC-2: firm A sees ZERO firm B deal-activity rows, as dealflow_app in workspaceAls — the wave-18/27 harness, verified present.
- **PAGINATION-not-export-cap:** CONFIRMED. Browse-shaped limit/offset, page size ~25–50; explicitly NOT EXPORT_ROW_CAP (50k). Separate shared-Zod contract from the export cap.
- **READ-ONLY (WORM):** CONFIRMED. No audit row emitted on read, no mutation/deletion/purge path (matches shipped audit-log browse; verified read-path emits zero audit rows).
- **RBAC fail-closed:** CONFIRMED correct lens. compliance/admin (mirrors the export deal-scope gate + records-VIEW compliance framing), NOT the broader /pipeline advisor/analyst lens — right call, since this is the compliance records lens. roleRoutes boot-fail-closed assertion (established RBAC-drift-guard).
- **D-1 assess routing:** CONFIRMED correct. Likely a scope/tab extension of the existing compliance/audit-log page reusing AuditLogTable → light D-block or D-skip. Not forcing a full D-block for a scope toggle is the right disposition; D-1 judges.
- **Completes M10-light:** CONFIRMED. Closes the "records viewable in-app" metric (deal-activity was the unshipped half; audit-log ships). No over-build — no purge, no mutation, no new export format, no migration. M10 closes mechanically at next N-block.

## security_scope judgment + Phase-2 routing
**Call: STANDARD Phase-2 (karen + jenny), NO security-auditor tightened gate.** This is a READ-ONLY, RLS-scoped browse that reuses an already-shipped and already-security-reviewed RLS pipeline (wave-27 SEC-3 + the isolation harness) — no new migration, no auth/session/CSRF/rate-limit/user-creation surface, no write path. The `wave_touches ∩ {auth, payments, sessions, csrf, rate-limit, user-creation}` set is empty, so the P-4 "Security-scope tightened gate" trigger does not fire. The residual risk is concentrated entirely in ONE falsifiable AC (firm A = 0 firm B rows, as dealflow_app) which the reused harness already enforces and which T-8 will exercise. Standard karen (verify the reuse claims + RLS-join-not-raw hold in the built code) + jenny (drift check vs user-journey-map + product-decisions LIGHT-posture) is sufficient. Gemini cross-review runs degradable per stage default.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2
