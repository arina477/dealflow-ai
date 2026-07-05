# Wave 12 — P-4 Verdict

**Reviewer:** head-product (agentId: head-product-wave12-P4)
**Attempt:** 1
**Phase:** 1

## Verdict

**APPROVED**

## Rationale

The wave-12 P-block (M6 pipeline / deal-stage tracking — the pipeline half of M6, built over the wave-11 compliant-outreach foundation) clears every P-4 stage-exit check. Reuse claims were independently verified live against the codebase (not inferred from the plan text): M2 `AuditService.append(input, tx)` at `apps/api/src/modules/audit/audit.service.ts:75` is HMAC-SHA256 prev_hash→hash chained and tx-composing (last-in-txn is achievable, rollback-on-audit-failure holds); M1 `getUserWithRole` at `apps/api/src/modules/auth/auth.repository.ts:154` maps SuperTokens id → app `users.id` + role over the 4-role enum (`advisor|analyst|compliance|admin`); `outreach_status` pgEnum carries `send_eligible`; `match_run.ready_for_outreach` exists as the M6 handoff sentinel; migration 0010 is the current head so 0011 is the correct next additive number; and the two proposed pgEnums `pipeline_stage` / `pipeline_event_type` do NOT collide with any of the 11 existing enums (the wave-11 collision lesson is honored).

**Bet alignment + ambition (check PASS):** This advances M6 ("advance a buyer through pipeline stages, audited, end-to-end"). It is NOT a generic CRM-kanban — every stage transition and every note is an append-only, HMAC-chained M2 audit event. Per the P-0 ceo-reviewer (the ambition authority), that audited recordkeeping trail IS the compliance-first M&A wedge, and the spec makes it a hard invariant rather than an aspiration.

**Scope discipline (check PASS):** 3-task bundle (~3200 LOC) clears the multi-spec floor comfortably. The P-0 mediation rejecting mvp-thinner's THIN split is correctly reasoned: (1) ceo-reviewer named the audited event timeline as the compliance differentiator (recordkeeping = M&A value), so splitting it out weakens the wedge; (2) mvp-thinner self-flagged its own residual as floor-marginal (~2400-2500 AT the floor); (3) keeping the bundle whole clears the floor and preserves the vertical. The audited timeline is genuinely mvp-critical, not orthogonal padding — the THIN precedence correctly does not win here.

**Spec-contract quality — the five COMPLIANCE invariants are all falsifiable + observable ACs (check PASS):**
- `audit-last-in-txn` — enroll+transition+note each write M2 append LAST-IN-TXN; edge case "audit append throws mid-txn → rolls back, no orphan row" is a fault-injection contract assertion (zero-orphan-rows observable).
- `append-only-events` — "notes append-only (no edit/delete path)" + edge "note edit/delete attempt → no such endpoint"; falsifiable by route-absence + schema (no update/delete path).
- `idempotent-enroll` — pinned to DB UNIQUE + fail-on-conflict (structural, per the wave-9 double-universe race lesson — rejected the service-level find-or-insert); observable via 409 + row-count=1.
- `eligible-source-guard` — enroll only from `send_eligible` outreach OR accepted `match_candidate` under `ready_for_outreach=true`; two explicit negative edge cases; server-side, 400/409 observable.
- `fixed-enum-transition-guard` — illegal stage rejected SERVER-SIDE ("400 even if UI allowed"), not merely UI-hidden; actor = app `users.id`.

RBAC negatives are explicit across all three tasks (anon 401, analyst/wrong-role 403). Edge coverage is honest: concurrent transitions (last-write-wins, server re-read), empty pipeline (columns render empty no crash), audit-rollback (both transition and note), empty-text note (400, Zod min 1). No vague/untestable AC found — no subjective adjectives, no implementation-leakage in the ACs (behaviors + HTTP codes, not algorithms).

**Boundaries honest (check PASS):** Deferrals stay OUT and correctly scoped — actual send/webhook (needs email key + `EMAIL_WEBHOOK_SECRET`, product-decision #141) and AI-drafting (LLM-spend, founder-gated). Schema is additive-only (2 new tables + 2 new enums, no ALTER of any shipped M4/M5/M6 table). Zero ghost deps — verification confirmed every reuse surface is shipped-and-live. No new dep / SDK / secret / spend.

**Plan soundness (check PASS):** New `pipeline` module mirrors the wave-11 outreach module shape; migration 0011 additive with distinct enum names + `.down.sql` + journal-when->0010; reuses M2 audit + M1 RBAC. Every AC traces to a file-level B-step (self-consistency sweep CLEAN). Migrations precede API logic (B-0 schema → B-1 contracts → B-2 backend → B-3 frontend, correctly serial as B-3 consumes B-2 endpoints). Specialists (backend-developer, typescript-pro, nextjs-developer) all present in AGENTS.md. Every claimed_task_id traces back to the M6 P-0 bet.

**Security-scope-tightened gate — call: NOT TRIGGERED.** `wave_touches ∩ {auth, payments, sessions, csrf, rate-limit, user-creation}` = ∅. The wave reuses M1 RolesGuard/@Roles and M2 audit on new `/pipeline` routes but builds NO new auth/session/CSRF/rate-limit/user-creation/payment machinery. Applying an existing guard to new routes is not new security machinery. The RBAC surface is still fully covered by explicit negative ACs regardless.

Confirming per the return contract: the five compliance invariants (audit-last-in-txn, append-only, idempotent-enroll, eligible-source, fixed-enum) are all falsifiable, observable, server-side ACs, and the deferral boundaries (send/webhook, AI-drafting) are honestly OUT with additive-only schema and zero ghost deps.

## Footer

```yaml
verdict_complete: true
rework_attempt_cap_remaining: 3
```

---

# Wave 12 — P-4 Verdict (Phase 2 — karen + jenny + Gemini)
**Attempt:** 1  **Phase:** 2
## Merge
- **karen: APPROVE** — all 8 load-bearing PLAN claims VERIFIED against main: M2 AuditService.append(input,tx) HMAC last-in-txn (audit.service.ts:75); M1 getUserWithRole→app users.id (auth.repository.ts:154); reuse surfaces live (outreach send_eligible, match_run.ready_for_outreach + accepted, mandates); migration head 0010→0011 journal; distinct enum names (no pipeline_stage/pipeline_event_type collision); design/pipeline.html exists; specialists in AGENTS.md; antipattern-clean (enrolling send_eligible/accepted deals is real progression state, not "tracking nothing").
- **jenny: APPROVE** — all spec items MATCH: stage enum #137 (fixed 7, configurable H2-deferred); /pipeline #80 (designed screen, journey row 11); deferrals #141 honored (no send/webhook/LLM sneak-in); eligible sources match F16 send-eligible + wave-10 accept→ready; compliance-first audit thread consistent. No drift, no contradictions.
- **Gemini: UNAVAILABLE** (HTTP 429 rate-limit; helper retried once) — degrades, NON-BLOCKING per P-4 Action 3. Gate proceeds on karen+jenny.
## NON-BLOCKING build note (both reviewers): design/pipeline.html carries the board+note+timeline PATTERN but illustrative/partial stage labels (predate #137's 7-value enum). design_gap_flag stays FALSE (pattern exists); **B-3 MUST instantiate the 7 fixed columns (shortlisted→contacted→engaged→diligence→offer→closed→withdrawn), not the mockup's illustrative labels**; head-builder/head-designer confirm the adaptation at B-6. Carried into B-block.
## Footer
```yaml
verdict_complete: true
phase1_head_product: APPROVED
phase2: {karen: APPROVE, jenny: APPROVE, gemini: UNAVAILABLE-429-degraded}
gate: PASSED
rework_attempt_cap_remaining: 3
build_note: "B-3 render the 7 fixed pipeline_stage enum columns (pipeline.html labels are illustrative/partial)"
```
