# Wave 10 — P-block review artifacts
**Block:** P (Product) · **Wave topic:** Deterministic match spine + rule-based pre-score (M5 first bundle) · **Block exit gate:** P-4 · **Status:** gate-passed
## Stage deliverables
| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| P-0 | process/waves/wave-10/stages/P-0-frame.md | done | PROCEED — all 3 aligned; deterministic-vs-LLM boundary held; no-prior-spec; design exists |
| P-1 | process/waves/wave-10/stages/P-1-decompose.md | done | PROCEED, multi-spec (3 tasks); design_gap_flag FALSE (design exists → D skips) |
| P-2 | process/waves/wave-10/stages/P-2-spec.md | done | multi-spec (3 self-contained blocks) in seed 47ed7ddd |
| P-3 | process/waves/wave-10/stages/P-3-plan.md | done | matching module (2 tables 0009 + deterministic MatchingService + page); reuse M4/M3/M1/M2; no new dep/SDK/secret; boundaries enforced |
| P-4 | process/waves/wave-10/blocks/P/gate-verdict.md | gate-passed | head-product APPROVED; karen+jenny APPROVE (B-3 strip-AI-framing condition); Gemini 429 |
## Block-specific context
- **Wave topic:** M5 FIRST bundle — deterministic match spine: match_run (FK mandates + buyer_universe, one per submitted universe) + match_candidates (FK buyer_universe_candidates, integer fit_score 0-100, score-breakdown jsonb, disposition pending/accepted/rejected/flagged) + MatchingService (reads SUBMITTED buyer_universe → deterministic rule-based fit_score → ranked) + /matches-shortlist page + accept/reject/flag → shortlist → ready-for-outreach handoff. Seed 47ed7ddd + siblings fb82d339 (page) + f74dce45 (accept/reject/flag/handoff).
- **Roadmap milestone:** M5 (d72b4510…, in_progress, product-feature, T2, FLAGSHIP differentiator). wave.milestone_id backfilled. wave_db_id d09d928c-9f6b-4d3e-be6f-812a0f8956b8 (wave_number 10).
- **claimed_task_ids (bundle):** [47ed7ddd (spine), fb82d339 (page), f74dce45 (accept/reject/handoff)] — confirm at P-1.
- **Spec-contract short-circuit:** no-prior-spec (prose seeds) → full P-1..P-3.
- **design_gap:** FALSE (P-1) — design/matches-shortlist.html exists → D-block SKIPS → next block B.
- **Reuse:** M4 buyer_universe + buyer_universe_candidates (submitted status = the handoff; the score/rank columns M4 deliberately omitted go on match_candidates NOW), M3 companies.sector + contacts (score inputs), M4 mandate_buyer_criteria (score dims), M1 RolesGuard/getUserWithRole, M2 AuditService. Wave-9 unsupportedDimensions graceful-degradation pattern.
- **HARD BOUNDARY (deterministic-this-bundle vs LLM-later-bundle):** NO Anthropic/Claude/LLM call, NO BullMQ async, NO rationale-text — fit_score is a DETERMINISTIC rule-based integer only. The LLM-assisted ranking + rationale + SDK + spend is a LATER M5 bundle (BOARD-gated: external-sdk-rules + LLM-gateway + zero-retention DPA + Tier-3 spend). Police at P-2/P-3/P-4/B-6. (Also M5/M6 boundary: shortlist HANDS OFF to outreach [M6] but does NOT do outreach.)
- **Autonomous mode:** automatic.
## Open escalations carried into gate
- The LATER M5 LLM bundle carries a founder Tier-3 spend decision (flagged at wave-9 N-3) — NOT this deterministic bundle. Real DataSourceAdapter (M9) founder vendor — surfaced, non-blocking.
## Gate verdict log
<appended by fresh head-product spawn at P-4 Action 1>
