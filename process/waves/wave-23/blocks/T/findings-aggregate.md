# Wave 23 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | INFO | C-2 | live authed per-mandate score deferred (no prod advisor fixtures) — CI seller-intent-isolation e2e 3/3 + scorer.spec 26/26 authoritative (wave-21 CI-authoritative policy) |
| 2 | P2 (accepted) | B-6 | O(n2) .find()-in-comparator sort (firm-scale fine, cosmetic) |
| 3 | INFO→N-3 | SI4 | verify the wave-23 decomposer decision is logged in product-decisions.md before N-3 |
## Security substance — PROVEN (CI real-DB as dealflow_app + C-2 live):
- Cross-firm seller-intent isolation: seller-intent-isolation.e2e 3/3 REAL SellerIntentService via ALS as dealflow_app — WS_A appears / WS_B absent (SIT-1); SIT-3 fail-closed throw (fault-killing).
- PURE deterministic NO-LLM (no Date.now inside scorer, no Anthropic/OpenAI/SDK/network/randomness — scorer.spec grep-asserts + snapshot); a compliance-first reproducible auditable score.
- NO tieBreak surfaced (SI1 / PRODUCT #1); computable-over-real-columns (outreach_activity/pipeline_events/match_candidates).
- Read-only (no writes/audit — verify 401); RBAC fail-closed (advisor+admin 200 / 403 / 401).
findings_total: 3 (0 crit/high, 1 P2-accepted, 2 info)
