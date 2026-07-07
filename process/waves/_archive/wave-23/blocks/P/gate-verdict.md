# Wave 23 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, P-4 gate Phase 1)
**Reviewed against:** process/waves/wave-23/blocks/P/review-artifacts.md
**Attempt:** 1  (first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
This is M9's last buildable vertical — a pure, deterministic, read-derived per-mandate seller-intent score (0-100) + 3-signal breakdown + heating/cooling/flat direction over existing internal tables, workspace-scoped and read-only. The one load-bearing product risk was PRODUCT-PRINCIPLES #1 (noise-as-signal): the decomposer seed had folded a hash-of-id `tieBreak` into the score and surfaced it in the breakdown — the exact wave-19 mistake. That is now correctly and falsifiably closed: the authoritative DB spec (seed 9e54cc11) carries a top-of-file "P-0 CORRECTIONS (OVERRIDE the prose below)" block plus a machine-checkable `specs:` acceptance-criteria set that both remove tieBreak from the score AND the user-facing breakdown (breakdown = outreachEngagement + pipelineVelocity + matchDisposition + total + notApplied), demote any deterministic ordering to a query/service-layer (created_at, id) stabilizer, and the B-2 test plan asserts tieBreak is absent from the output. The three signals are computable over real, populated columns (outreach_activity, pipeline_events, match_candidates.disposition — the shipped wave-20 tables); the scorer is enforced pure and deterministic with NO LLM/SDK/network/credential/randomness and critically NO Date.now() inside (recency + trend window take a caller-supplied referenceInstant / max-event-ts), backed by a determinism snapshot test and a no-Date.now assert/lint — the reproducible-and-auditable boundary this compliance-first product needs. The ceo-reviewer trend/direction expansion is right-sized (an enum + its windowed delta, not a time-series subsystem) and stays deterministic. Isolation is workspace-scoped via getDb (fail-closed on null GUC, RLS FORCE), read-only with no audit rows (correctly, like analytics), RBAC advisor+admin with binary 200/403/401 negative ACs and a T-8 cross-firm negative-read through the REAL service. All three P-0 reviewer verdicts (problem-framer REFRAME, ceo-reviewer SELECTIVE-EXPANSION, mvp-thinner OK+flags) are integrated and resolved. The M9 _TBD success-metric founder poll is DUE and is flagged for the N-block / digest.

## Cross-review integration (P-0 reviewers)
- **problem-framer — REFRAME (tieBreak removal):** RESOLVED. tieBreak removed from score + surfaced breakdown across all 4 tasks; ordering demoted to query-layer (created_at, id) stabilizer; assert-absent test in B-2. Non-blocking join-path notes (outreach_activity.mandateId nullable → join via pipelineId/matchCandidateId; disposition 'pending' bucketed neutral/notApplied; low-n qualification) carried as P-2/P-3 spec notes — correctly non-defect.
- **ceo-reviewer — SELECTIVE-EXPANSION (direction/trend):** INTEGRATED. Deterministic direction ∈ {heating,cooling,flat} added as a windowed delta of the same score; NO-LLM + no-weight-tuning-UI creep vectors held; reproducible/auditable boundary confirmed load-bearing.
- **mvp-thinner — OK + 2 flags:** RESOLVED. (1) metric_unratified → M9 _TBD poll flagged DUE (below); no formal thinness trace possible without a ratified metric (same basis as the non-adopted wave-18/19/20 splits); the 3 real signals are the minimum coherent set, splitting one is over-cut-ward. (2) tieBreak_in_surfaced_breakdown → resolved by the problem-framer REFRAME.

## Judgment findings (per gate request)
1. **tieBreak-removal (PRODUCT #1) — ENFORCED + FALSIFIABLE.** Removed from score + breakdown (formal `specs:` AC #2: "NO tieBreak in the score or the breakdown"); contracts task 1188e7da "NO tieBreak field"; UI task 6840c25d "NO tieBreak shown"; ordering is a query/service-layer (created_at, id) stabilizer, never scored/surfaced; B-2 test asserts absence. PASS.
2. **Computability over real columns — PASS.** outreachEngagement/pipelineVelocity/matchDisposition each map to populated columns on the shipped wave-20 tables; problem-framer confirmed. Not a vanity metric (PRODUCT #1 real-source-column satisfied).
3. **Purity / determinism / no-Date.now-inside — ENFORCED + FALSIFIABLE.** No LLM/SDK/network/credential/randomness; referenceInstant/max-event-ts passed in, not read from the clock inside the scorer; determinism snapshot test + no-Date.now assert/lint. PASS.
4. **Trend/direction — RIGHT-SIZED + DETERMINISTIC.** Enum + windowed delta of the same deterministic score; explicitly minimal (not a time-series subsystem); delivers the heating-vs-cooling promise. PASS.
5. **Workspace-scoped + read-only — PASS.** getDb GUC-derived workspaceId, fail-closed on null, RLS FORCE; read-only, no audit rows; RBAC advisor+admin 200 / analyst+compliance 403 / anon 401 (binary negative ACs); T-8 cross-firm negative-read via the REAL service; empty-data-safe.
6. **_TBD metric — POLL DUE, FLAGGED.** M9 quantitative success metric is founder-TBD and this is M9's last buildable vertical. Building against the qualitative target ("advisors see which mandates are heating up") is acceptable this wave (wave-18/19/20 precedent). Founder poll is DUE before N-1 disposes M9 to done — flagged for the N-block / wave-23 digest.
7. **security_scope — STANDARD.** wave_touches ∩ {auth, payments, sessions, csrf, rate-limit, user-creation} = ∅; isolation inherited from tested M8 (wave-18/19 pattern). The security-scope tightened gate does NOT trip; standard single Phase-2 pass + the T-8 cross-firm negative-read AC + the 403/401 RBAC ACs suffice.

## Non-blocking hygiene note for Phase 2 (Karen) + B-block
The authoritative DB spec (seed 9e54cc11.description) retains the ORIGINAL decomposer "Acceptance sketch" prose at the very bottom, which still literally lists `tieBreak` inside the breakdown. This is explicitly subordinated by the top-of-file "P-0 CORRECTIONS (OVERRIDE the prose below where they conflict)" block and contradicted by the machine-checkable `specs:` acceptance-criteria (which forbid tieBreak) plus the assert-absent B-2 test. NOT a contract defect — the executed contract + falsifiable test are clean and precedence is explicit. Karen should spot-check that the shipped breakdown TYPE (packages/shared Zod, task 1188e7da) has no `tieBreak` field, closing the residual-prose risk at the implementation layer.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

---
## Phase 2 (karen + jenny + Gemini) — merged
- **karen:** APPROVE (6/6 VERIFIED — 3 signals computable over the RIGHT tables/enums [outreach_activity planned/completed/cancelled NOT outreach compose/send — wave-18 trap avoided; pipeline_events fromStage/toStage+createdAt; match_candidates.disposition]; matching.scorer.ts pure-no-Date.now-no-LLM pattern real; getDb+FORCE-RLS on all 4 tenant tables; the REAL-service cross-firm e2e pattern exists; RolesGuard/@Roles+/insights exist). Hygiene: the seed/contract PROSE still lists tieBreak (stale, overridden by the ACs) → folded as SI1.
- **jenny:** APPROVE (4/4 specs + 8/8 drift-checks MATCH — M8-isolation [read-only getDb, no audit rows, wave-18 pattern], tieBreak-removal [PRODUCT #1 enforced-at-authoring], NO-LLM-determinism [mirror matching.scorer.ts, no Date.now-inside] all clean; trend not gold-plating [realizes the seed's heating-vs-cooling promise]; RBAC; /insights additive). 2 determinism-critical B-block gaps (SI2 window/epsilon, SI3 referenceInstant) + 1 process note (SI4 decision-log) folded.
- **Gemini:** UNAVAILABLE (429).

## MERGED P-4 VERDICT: APPROVED (Phase 1 head-product APPROVED + Phase 2 karen+jenny APPROVE + Gemini UNAVAILABLE)
security-scope standard (isolation inherited from tested M8; T-8 negative-read + RBAC ACs suffice). → exit P-block to B-0. design_gap false → B.
## B-BLOCK OBLIGATIONS (BINDING): SI1 author-off-ACs-not-prose + assert-tieBreak-absent | SI2 pin-window-length+flat-epsilon-deterministic+unit-test | SI3 referenceInstant-semantics+boundary-test | SI4 log-decomposer-decision-before-N-3. Plus the standard: workspace-scoped-getDb (cross-firm-negative-read REAL as dealflow_app), pure-no-Date.now-inside-scorer, computable-over-real-columns, read-only, empty-data-safe.
- verdict_complete: true
