# Wave 23 — P-block review artifacts

**Block:** P (Product)
**Wave topic:** M9 SELLER-INTENT vertical — a deterministic read-derived per-mandate intent/engagement score (0-100) + structured breakdown over EXISTING internal data (outreach_activity / pipeline_events / match_candidates.disposition). Pure/NO-LLM scorer + workspace-scoped service + shared-Zod contracts + RBAC read API + /insights UI. A near-clone of the wave-18 analytics / wave-19 calibration read-aggregation pattern.
**Block exit gate:** P-4

## Stage deliverables
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | stages/P-1-decompose.md | done |
| P-2 | stages/P-2-spec.md | done |
| P-3 | stages/P-3-plan.md | done |
| P-4 | stages/P-4-gemini-review.md | done (APPROVED; SI1-SI4) |

## Block-specific context
- **wave_db_id:** f199503b-6f20-4e19-83ab-8a2d5d814209 (wave_number 23, milestone M9)
- **claimed_task_ids:** [9e54cc11 (scorer+service seed), 1188e7da (shared-Zod contracts), 12947422 (RBAC read API), 6840c25d (/insights UI)]
- **Seed spec (9e54cc11):** pure deterministic scoreMandateIntent (mirror matching.scorer.ts) → {score 0-100, breakdown: outreachEngagement/pipelineVelocity/matchDisposition/tieBreak/total/notApplied} + workspace-scoped service (getDb/GUC, RLS FORCE, fail-closed) aggregating per-mandate. Read-only (no mutations → no audit rows, like analytics).
- **LOAD-BEARING invariants:** workspace-scoped-via-getDb (no cross-firm leak — the wave-18/19/20 pattern) | deterministic/PURE (NO Anthropic/LLM/OpenAI/SDK/network/credential/randomness; NO Date.now() inside scorer — recency via caller-supplied reference instant or max-event-ts passed in) | computable-over-real-columns (the wave-18/19 vanity-metric lesson + PRODUCT #1) | read-only (no audit surface) | structured-breakdown-not-prose | credential-free / no-ghost-dep-on-blocked-CRM-345dfbc6-or-#141.
- **WATCH (P-0/P-4 to adjudicate):** the breakdown lists `tieBreak`. Per PRODUCT #1 + the wave-19 lesson, a tieBreak SURFACED to users as meaningful signal is misleading (it's a deterministic ordering component, not predictive lift). Assess whether tieBreak belongs in the USER-FACING breakdown or only as an internal score-ordering component (like matching.scorer.ts's tieBreak).
- **design_gap_flag:** likely false (a /insights-area UI surface reusing the analytics/calibration dashboard patterns) — P-1 confirms.
- Autonomous mode: automatic.

## Gate verdict log
- **P-4 Phase 1 (head-product, attempt 1): APPROVED.** tieBreak REMOVED from score + surfaced breakdown (PRODUCT #1, falsifiable via assert-absent B-2 test); 3 signals computable over real wave-20 columns; scorer pure/deterministic with NO Date.now-inside (determinism snapshot + no-Date.now assert/lint); direction enum right-sized + deterministic; workspace-scoped getDb fail-closed + read-only + RBAC 200/403/401 + T-8 cross-firm negative-read via REAL service; security_scope = STANDARD (tightened gate does NOT trip; isolation inherited from tested M8). All 3 P-0 reviewer verdicts integrated/resolved. M9 _TBD success-metric founder poll DUE — flagged for N-block / digest. One non-blocking hygiene note: residual legacy prose in seed 9e54cc11.description still names tieBreak but is explicitly OVERRIDDEN by the P-0 CORRECTIONS block + machine-checkable specs; Karen (Phase 2) to spot-check the shared-Zod breakdown type has no tieBreak field. Verdict → process/waves/wave-23/blocks/P/gate-verdict.md. Next: Action 2 (Phase 2 — Karen + jenny + Gemini).
