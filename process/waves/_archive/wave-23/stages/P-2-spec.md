# Wave 23 — P-2 Spec (pointer)
**Source of truth:** seed 9e54cc11 tasks.description (formal spec head + P-0 CORRECTIONS prepended). wave_type multi-spec. design_gap false.
**claimed_task_ids:** [9e54cc11 (scorer+service), 1188e7da (contracts), 12947422 (RBAC API), 6840c25d (/insights UI)]
## AC summary (M9 seller-intent)
1. **9e54cc11 scorer+service:** PURE deterministic scoreMandateIntent → {score 0-100, breakdown {outreachEngagement, pipelineVelocity, matchDisposition, total, notApplied}, direction heating|cooling|flat}; **NO tieBreak (score or breakdown)**; NO LLM/SDK/network/credential/randomness/**Date.now-inside** (referenceInstant passed in); 3 signals over real columns; workspace-scoped service via getDb (fail-closed); read-only (no audit rows); empty-data-safe.
2. **1188e7da contracts:** shared-Zod output + list shape (no tieBreak field).
3. **12947422 API:** GET seller-intent, RBAC advisor+admin (403/401), workspace-scoped, read-only.
4. **6840c25d UI:** /insights seller-intent surface (score+direction+3-signal breakdown, no tieBreak); design-system reuse; empty/error; RBAC-gated; no gold-plating.
## Load-bearing: workspace-scoped-getDb (cross-firm-negative-read T-8 REAL) | pure-deterministic-no-LLM-no-Date.now-inside | computable-over-real-columns | NO-tieBreak-surfaced (PRODUCT #1) | read-only | empty-data-safe | direction-deterministic. M9 _TBD poll DUE (founder flag).
