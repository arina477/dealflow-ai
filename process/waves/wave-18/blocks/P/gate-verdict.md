# Wave 18 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, agentId head-product-w18-p4-phase1)
**Reviewed against:** process/waves/wave-18/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
The M9 advisor-insights analytics wave is the right movable slice: it delivers felt advisor value now over already-live data (mandate throughput, outreach response rates, advisor productivity, match disposition) with zero founder credential or spend, while the CRM data-source adapter that needs vendor spend + an account API key stays correctly deferred behind the founder gate. The wave's highest-risk requirement — that every firm sees only its own analytics, never another firm's — is written as a falsifiable, machine-checkable acceptance criterion, not a hope: every aggregation query must run through the request-scoped `getDb` handle under the `app.workspace_id` isolation setting with forced row-level security, raw off-isolation queries are explicitly banned, and a two-firm cross-firm negative-read test is mandated at the security test layer to prove firm A's numbers never include firm B's. I verified against the shipped code that the isolation setting name, the `getDb` handle, and forced row-level security on the underlying tables are all real and already battle-tested by the isolation work that shipped last milestone, so this wave inherits proven isolation rather than inventing it. Empty-state division-by-zero is guarded, role-based access returns proper denials (403/401), the read stays read-only, and the scope is held tight to simple metric cards with no charting library, live updates, or export. I ratify keeping all four metric families and building against the qualitative success statement with the numeric target polled before the milestone closes.

## Judged questions (recorded resolutions)

1. **Bet alignment + THIN-split ratification.** Analytics-over-live-data is the correct movable M9 slice; CRM adapter correctly founder-gated. THIN-split (thin to 2 families) is **REJECTED — keep all 4 RATIFIED.** Rationale upheld: the founder success metric is unratified/_TBD, so thinning against an unnamed bar risks under-delivering (mvp-thinner itself flagged "keep all 4 if the bar leans on productivity/disposition"); ceo-reviewer (strategic-value lens) explicitly values all 4 to "run a book"; all 4 metric-family tables exist (verified — `mandates` and siblings carry FORCE ROW LEVEL SECURITY); 4 read-only on-the-fly aggregations are NOT the gold-plating ceo-reviewer warned against (that was real-time/charts/export); keeping 4 holds the wave above the multi-spec LOC floor (thinning risked RESCOPE-AUTO-MERGE).

2. **Load-bearing isolation AC — FALSIFIABLE: CONFIRMED.** Seed AC (a5ba8068) mandates every query via `getDb(this.db)` → `app.workspace_id` GUC + FORCE RLS, with an explicit "NO raw off-GUC/module-singleton query that would bypass RLS" boundary. Cross-firm-negative-read is a **T-8 AC over 2 workspaces** (firm-A analytics exclude firm-B), reusing the proven M8 `workspace-isolation.e2e-spec.ts` fault-killing pattern (ISO-4 GUC-leak guard, INV-5 FORCE-RLS). GUC-name correction **verified real**: `app.workspace_id` is the shipped name in the interceptor + RLS policies (0014/0015 migrations); the AC explicitly flags the decomposer-prose error `app.current_workspace_id`.

3. **AC quality — falsifiable + observable: PASS.** Empty-state div-by-zero guarded (`responded/sent` guards `sent=0`); RBAC binary (403 wrong-role / 401 anon); read-only-no-write explicit; perf-cache (if ever added) must carry workspace_id + FORCE RLS.

4. **ceo-reviewer HOLD-SCOPE honored: PASS.** No charts library, no real-time/websocket, no export — explicit in the /insights AC and P-3 (`deps_new: []`); simple design-system metric cards only.

5. **_TBD metric: ACCEPTABLE.** Building against the qualitative "advisors see their throughput/response analytics on live data" is sound; numeric success metric is a founder-poll due before M9 CLOSES, not a build hard-stop this wave.

6. **security_scope_tightened: NO (standard Phase 2 + T-8 AC suffices).** The mechanical tightened-gate trigger (`wave_touches ∩ {auth, payments, sessions, csrf, rate-limit, user-creation}`) does NOT fire — this wave adds no auth/payment/session surface. Isolation is INHERITED from the already-shipped, already-tested M8 layer, not newly authored here. The falsifiable T-8 cross-firm negative-read is the correct fault-killing guard. **Call: standard Phase 2 (karen + jenny) + Gemini, with the isolation AC flagged for elevated Phase-2 scrutiny; no forced second Phase-2 iteration.** Karen should spot-check that B-block wiring uses `getDb` (not a raw pool) and that the T-8 test is a real 2-workspace proof (not a tautology).

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

---
## Phase 2 (Karen + jenny + Gemini) — merged
- **Karen:** REJECT (1 WRONG: "outreach response rate" uncomputable — outreach.status=compose/send_eligible/blocked, pre-send gate, no send/response data, send is #141-founder-gated → vanity metric) → FIX applied (metric family 2 redefined to "outreach compliance-gate outcomes": send_eligible-pass-rate + blocked-rate over outreach.status, honest label, total=0 guarded) → **Karen re-verify APPROVE** (all 4 families computable over real enums/columns; F1 mandate.status, F2 outreach.status gate-outcomes, F3 pipeline.created_by/pipeline_events.actor_id, F4 match_candidates.disposition; workspace-scoped via getDb + app.workspace_id; no new wrong claim).
- **jenny:** APPROVE (7/7 MATCHES, 0 DRIFTS — the load-bearing M8-isolation-consistency clean: analytics built ON the shipped FORCE-RLS + getDb + app.workspace_id layer, raw-off-GUC leak path explicitly rejected; CRM half correctly founder-gated; /insights clean additive surface; design_gap=false + no-gold-plating follow wave-15/16 + pilot-scope precedents; RBAC consistent; _TBD follows M8/M5/M6 precedent).
- **Gemini:** UNAVAILABLE (429 credits depleted, confirmed wave-16) → degrades, non-blocking.

## MERGED P-4 VERDICT: APPROVED (after Karen metric-correction)
Phase 1 head-product APPROVED (security-scope NOT tightened — isolation inherited from tested M8, T-8 negative-read AC suffices); Phase 2 Karen APPROVE (post metric-fix) + jenny APPROVE + Gemini UNAVAILABLE. The gate caught a real vanity-metric (uncomputable outreach response-rate) pre-build. → exit P-block to B-0. design_gap_flag=false → B (no D-block).
- verdict_complete: true
- p2_fix: "metric family 2 redefined response-rate → compliance-gate-outcomes (computable over outreach.status)"
