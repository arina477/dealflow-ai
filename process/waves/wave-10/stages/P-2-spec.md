# Wave 10 — P-2 Spec (pointer)
**Source of truth:** multi-spec contract in `tasks.description` of seed **47ed7ddd** (3 blocks). DB wins.
**wave_type:** multi-spec. **design_gap_flag:** false. **claimed_task_ids:** [47ed7ddd (spine), fb82d339 (page), f74dce45 (accept/reject/handoff)].
## AC summary
- **47ed7ddd (spine):** match_run (FK mandates + buyer_universe UNIQUE, one per submitted universe) + match_candidates (FK buyer_universe_candidates, int fit_score 0-100, score_breakdown jsonb, disposition) migration 0009; MatchingService reads SUBMITTED universe → DETERMINISTIC rule-based fit_score (weights/tie-breaks for discrimination on sector+contact-completeness; unsupported dims graceful) → ranked; RBAC advisor-primary + audited + actor-id + idempotent(universe UNIQUE) + submit-guard(400 if not submitted). NO LLM/BullMQ/rationale/spend.
- **fb82d339 (page):** /matches-shortlist ranked-list (company+fit_score+score_breakdown+disposition, DESC) SSR-hydrated; score framed as rule-based (NOT AI rationale).
- **f74dce45 (accept/reject/handoff):** disposition accept/reject/flag → shortlist; ready-for-outreach handoff status (M6 reads; NO outreach here); guard on accepted-count (BUILD rule 6); cross-run-scoped PATCH.
## HARD BOUNDARIES: deterministic-only (NO LLM/Claude/BullMQ/rationale/spend — later bundle) + M5/M6 (handoff not outreach). Reuse M4 buyer_universe + M3 + M4 criteria + M1/M2.
