# Wave 18 — P-3 Plan (multi-spec: M9 advisor-insights analytics, 3 blocks)

## Approach
### Action 1 — Architecture deltas
- **AnalyticsService (new module) [seed a5ba8068].** A read-only service aggregating 4 metric families over the shipped mandates/outreach/pipeline/matching tables. **EVERY query uses `getDb(this.db)`** (the wave-17 ALS request handle) so it runs under the per-request `app.workspace_id` GUC + FORCE RLS → per-firm analytics, no cross-firm leak. On-the-fly aggregation (SQL count/group-by/ratio), NO materialized cache (ceo-reviewer no-gold-plating; if a cache is ever added it MUST carry workspace_id + FORCE RLS). *Alt:* raw pool query for speed — REJECTED (bypasses the GUC → cross-firm leak, the worst post-M8 regression). Failure domain: read-only; reuses the M8 isolation layer.
- **Analytics API [9e05828b].** AnalyticsController GET /analytics (or /analytics/summary), @Roles-guarded (advisor/admin per RBAC), returns the shared-Zod-typed 4-family shape. Read-only, workspace-scoped via the interceptor. *Alt:* per-family endpoints — a single summary endpoint is simpler for the dashboard; decide at B-1.
- **/insights dashboard [4b014689].** Next.js 15 page: metric cards (design-system zinc/emerald cards + lucide) for the 4 families + simple breakdown tables; sourced from /insights-data proxy → GET /analytics (apiFetch/rid). Empty/loading/error states. RBAC-gated (redirect non-permitted). NEW nav entry. NO charts-lib/real-time/export. *Alt:* charts — REJECTED (ceo-reviewer no-gold-plating for a single pilot).

### Action 2 — Data model
NO schema change (reads existing mandates/outreach/pipeline/matching under RLS). IF a perf-cache/materialized table is added at B-2 → additive + JOURNALED (BUILD rule 4) + workspace_id + FORCE RLS (else it bypasses isolation) — but default is on-the-fly, no migration.

### Action 3 — API contracts
- GET /analytics (or /analytics/summary): 200 shared-Zod 4-family shape (workspace-scoped, RBAC) | 403 (wrong role) | 401 (anon). Read-only.
- Web /insights-data proxy → GET /analytics (apiFetch rid).

### Action 4 — Dependencies
NONE new. NO charts library (ceo-reviewer). NO SDK. NO new secret.

## Plan (file-level, by B-stage)
**B-0 Schema** (backend-developer): SKIP (no schema; on-the-fly aggregation). Branch + no deps. (If B-2 finds a perf-cache genuinely needed, re-enter B-0 for an additive+journaled+workspace_id+FORCE-RLS migration — default: none.)
**B-1 Contracts** (backend-developer): packages/shared analytics Zod (the 4 metric-family response shapes + the summary shape); rbac map (/analytics roles); nav config (/insights).
**B-2 Backend** (backend-developer): AnalyticsService + analytics.repository (4 workspace-scoped getDb queries — mandate-throughput, outreach-gate-outcomes (send_eligible-pass-rate + blocked-rate over outreach.status; total=0 guarded — NOT a response-rate, no send data), advisor-productivity, match-disposition; empty-state-safe); AnalyticsController (GET /analytics, @Roles); module registration; specs INCL the cross-firm negative-read e2e (2 workspaces, firm-A analytics exclude firm-B — the T-8 load-bearing proof, real-DB as dealflow_app, WORM-safe teardown) + empty-state + RBAC (403/401) unit tests.
**B-3 Frontend** (nextjs-developer): /insights page + metric-card components (design-system) + nav entry + /insights-data proxy + RBAC-gate (redirect non-permitted) + empty/loading/error states; the black-box RBAC test.
**B-4/B-5/B-6:** head-builder polices workspace-scoped-aggregation (getDb not raw pool — a cross-firm leak here undoes M8), cross-firm-negative-read (real fault-killing e2e), empty-state-div-by-zero, RBAC-scoped, no-gold-plating (no charts-lib/real-time/export), read-only-no-write.

### Action 6 — Specialists: backend-developer (B-1/B-2), nextjs-developer (B-3). Both in AGENTS.md.
### Action 7 — Parallelization: B-0(skip) → B-1 → B-2 → B-3 (serial; dashboard depends on the API shape).
### Action 8 — Self-consistency: CLEAN. Every AC → step. LOAD-BEARING: workspace-scoped-getDb-aggregation, cross-firm-negative-read (T-8), empty-state-safe, RBAC-scoped, perf-cache-RLS-if-added, no-gold-plating. design_gap_flag false. The post-M8 isolation-respect is a HARD invariant (elevated P-4 scrutiny — a leak undoes M8), though not classic auth/payment scope-tightening.

```yaml
deps_new: []
schema_change: false   # on-the-fly aggregation; NO migration (if a perf-cache is added → additive+journaled+workspace_id+FORCE-RLS, but default none)
new_secret: false
new_sdk: false
specialists: [backend-developer, nextjs-developer]
reuse: [wave-17 getDb/ALS-request-handle + the workspace GUC + FORCE RLS, M1 RolesGuard/@Roles, wave-5 apiFetch/rid, the design-system cards/AppShell, mandates/outreach/pipeline/matching shipped tables]
compliance_invariants: [workspace-scoped-aggregation-via-getDb, cross-firm-negative-read-proof (T-8), empty-state-div-by-zero-safe, RBAC-scoped-read, read-only-no-write, perf-cache-carries-workspace_id-FORCE-RLS-if-added]
hard_boundaries: "read-only analytics over EXISTING data; workspace-scoped (no cross-firm leak — undoes M8); NO CRM adapter (345dfbc6 founder-gated); NO charts-lib/real-time/export gold-plating; reuse only"
design_gap_flag: false
self_consistency: clean
```
