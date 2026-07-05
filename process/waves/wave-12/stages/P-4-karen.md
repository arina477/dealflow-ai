# Wave 12 — P-4 karen (Phase 2 claim-verification, PLAN review)

Verdict: **APPROVE** (all load-bearing reuse claims VERIFIED; one MINOR design-fidelity note, non-blocking).

## Per-claim results

1. **M2 AuditService.append(input, tx) — HMAC-SHA256 last-in-txn chain** — **VERIFIED**.
   `apps/api/src/modules/audit/audit.service.ts:75` `async append(input: AuditEntryInput, tx: Tx): Promise<AuditLogEntry>`. Composes into caller's tx; advisory-lock serialized; keyed HMAC (`computeEntryHash`). Exactly the reuse target the plan names. `appendStandalone` also present.

2. **M1 getUserWithRole → app users.id** — **VERIFIED**.
   `apps/api/src/modules/auth/auth.repository.ts:154` `getUserWithRole(supertokensUserId): Promise<{ id: string; roleName: string } | null>`. Returns app `users.id` (never raw ST id); null-on-miss with fail-closed contract documented. Actor-id translation the plan reuses is real.

3. **Reuse surfaces shipped-and-live (zero ghost deps)** — **VERIFIED (all)**.
   - `apps/api/src/db/schema/outreach.ts` — `outreachStatusPgEnum` (line 98) includes `'send_eligible'` (line 100) as a real enum value; `outreach` table + `id` PK (line 332).
   - `apps/api/src/db/schema/matching.ts` — `match_run.ready_for_outreach` boolean (M6 handoff sentinel, line ~102); `matchCandidateDispositionPgEnum` includes `'accepted'` (line 77); `matchCandidates` table + `id` PK (line 225).
   - `apps/api/src/db/schema/mandate.ts` — exists.
   No ghost deps; every column/table the plan reads exists on main.

4. **Migration head is 0010 → new is 0011; journal when > 0010** — **VERIFIED**.
   `_journal.json` latest idx=10 `0010_mighty_the_anarchist` when=1783641600000. New drizzle-generated 0011 timestamp is necessarily > 1783641600000. Correct.

5. **Distinct enum names pipeline_stage / pipeline_event_type (wave-11 collision lesson)** — **VERIFIED**.
   Grep of `apps/api/src/db/schema/` + `packages/shared/src/` returns ZERO existing `pipeline_stage` / `pipeline_event_type`. Names are free; discipline correctly applied (mirrors the `outreach_approval_status` DISTINCT-name lesson visible in outreach.ts).

6. **design/pipeline.html exists (design_gap_flag false)** — **VERIFIED with a MINOR note (see below)**.
   File exists, 571 lines. Covers board/column/stage + note + timeline pattern.

7. **Specialists in AGENTS.md** — **VERIFIED**.
   `backend-developer` explicit (AGENTS.md:70); `typescript-pro` + `nextjs-developer` covered by the per-stack executor row (AGENTS.md:91) and present as installed agent cards (`~/.claude/agents/{typescript-pro,nextjs-developer,backend-developer}.md`) + capability sheet. All three routable.

8. **Antipattern sweep** — **CLEAN**.
   "Tracking before there's anything to track" does NOT apply: the plan enrolls deals that are ALREADY at a real progression state (outreach `send_eligible` = gate passed; accepted match_candidate under `ready_for_outreach` run). There IS state to track. Manual fixed-stage pipeline over shipped send-eligible/accepted records is coherent (ceo-reviewer wedge: audited transitions = compliance value). No claimed-but-fake reuse found.

## MINOR note (non-blocking — route to D-block / head-designer, not a REWORK)

`design/pipeline.html` is framed as an **inbound-reply triage** surface ("Triage Inbound Reply", "Incoming Message", "Request NDA", advisor cards Vista/Thoma Bravo/Insight/etc.) and does NOT render the fixed 7-stage vocabulary as columns: of {shortlisted, contacted, engaged, diligence, offer, closed, withdrawn}, only contacted/diligence/closed appear as text; shortlisted/engaged/offer/withdrawn are absent. The mockup carries the board+note+timeline *pattern* but not the exact 7-column stage taxonomy the spec fixes (product-decision #137).

- The plan ALREADY acknowledges this: P-1 line 23 "B-block adapts pipeline.html to the fixed 7-stage enum." So it is a KNOWN adaptation, not an undisclosed gap.
- `design_gap_flag: false` remains defensible at the P-1 gate: the surface pattern (stage-columned board + per-deal timeline + notes) is mocked; the B-3 nextjs-developer step must instantiate the 7 fixed columns. Recommend head-designer/D-block confirm the 7-column adaptation at build rather than treating pipeline.html as pixel-exact.

## Bottom line
No UNVERIFIED or WRONG load-bearing claims. All reuse targets (AuditService.append, getUserWithRole, send_eligible, ready_for_outreach, accepted, mandates), migration head, distinct-enum discipline, and specialist routing are real and shipped. **APPROVE.**
