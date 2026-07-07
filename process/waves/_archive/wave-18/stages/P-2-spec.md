# Wave 18 — P-2 Spec (pointer)
**Source of truth:** seed task a5ba8068 tasks.description. wave_type multi-spec (3 blocks). design_gap_flag false.
**claimed_task_ids:** [a5ba8068 (aggregation seed), 9e05828b (API), 4b014689 (/insights page)]
## AC summary (M9 advisor-insights analytics)
1. **a5ba8068 aggregation:** read-only AnalyticsService, 4 metric families (mandate throughput / outreach compliance-gate outcomes (send_eligible pass-rate/blocked-rate — pre-send gate, no response data) / advisor productivity / match disposition) over live data; **EVERY query via getDb → app.workspace_id GUC + FORCE RLS (firm sees ONLY its own — post-M8 load-bearing; NO raw off-GUC query)**; empty-state div-by-zero-safe; read-only (no write; a perf-cache if added carries workspace_id+FORCE RLS).
2. **9e05828b API:** GET /analytics shared-Zod-typed, workspace-scoped, RBAC-scoped (wrong role 403/anon 401), no write side-effect, empty→valid-empty-200.
3. **4b014689 /insights page:** read-only metric cards + breakdowns from the API via apiFetch/rid; empty state graceful; RBAC-gated; own-firm-only; **NO gold-plating (no charts-lib/real-time/export — ceo-reviewer)**; design-system cards; nav entry.
## Load-bearing: workspace-scoped-aggregation (getDb + app.workspace_id) | cross-firm-negative-read (T-8 — analytics of A never include B) | empty-state-safe | RBAC-scoped | perf-cache-RLS-if-added | no-gold-plating. _TBD metric = founder-poll before M9 close.
