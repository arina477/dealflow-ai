# Wave 23 — P-3 Plan (multi-spec: M9 seller-intent, 4 blocks)
## Approach
### Action 1 — Architecture deltas
- **Pure scorer module [seed 9e54cc11]** (new, pattern: apps/api/src/modules/matching/matching.scorer.ts): `scoreMandateIntent(input)` → { score: 0..100, breakdown: { outreachEngagement, pipelineVelocity, matchDisposition, total, notApplied }, direction: 'heating'|'cooling'|'flat' }. **PURE + DETERMINISTIC** — identical inputs → identical output; NO LLM/Anthropic/OpenAI/SDK/network/credential/randomness; **NO Date.now() inside** (recency + the trend window computed against a caller-supplied `referenceInstant` (or the workspace max-event-ts) passed IN). **NO tieBreak in the score or the surfaced breakdown** (PRODUCT #1 — a hash-of-id tiebreaker is noise-as-signal; if a deterministic result ORDER is needed, stabilize it in the query/service layer by (mandate created_at, id), never as a scored/surfaced dimension). The 3 real signals: outreachEngagement (completed vs planned/cancelled touches + channel mix + recency from outreach_activity), pipelineVelocity (stage-progression depth + days-between deltas from pipeline_events), matchDisposition (accepted/flagged vs rejected from match_candidates.disposition). direction = deterministic windowed delta (recent-window score vs prior-window, both from the same inputs against referenceInstant) → heating/cooling/flat.
- **Workspace-scoped service [9e54cc11]** (pattern: analytics aggregation + outreach-activity.service): reads mandates + the 3 sources via getDb (GUC-derived workspaceId, fail-closed if null) under RLS FORCE; aggregates per-mandate scores. READ-ONLY (no mutations → no audit rows, like analytics).
- **Contracts [1188e7da]:** shared-Zod for the scorer output shape + the API list response.
- **RBAC read API [12947422]:** GET seller-intent (advisor+admin), shared-Zod, workspace-scoped, read-only (403/401).
- **/insights UI [6840c25d]:** a seller-intent surface on the advisor /insights area — per-mandate score + direction (heating/cooling/flat) + the 3-signal breakdown; reuse the analytics/calibration cards/table; empty-state; RBAC-gated. NO tieBreak shown.
### Action 2 — Data model: NONE (read-only over existing mandates/outreach_activity/pipeline_events/match_candidates). No migration.
### Action 3 — API: GET /seller-intent (or /insights/seller-intent) → 200 shared-Zod list (per-mandate score+direction+breakdown) | 403 | 401. Web proxy.
### Action 4 — Deps: NONE. NO LLM/SDK/network/credential/spend.
## Plan (by B-stage)
**B-0 Schema:** SKIP (no schema).
**B-1 Contracts** (backend-developer): shared-Zod scorer-output + API-response (breakdown 3 signals + total + notApplied + direction enum; NO tieBreak field).
**B-2 Backend** (backend-developer): the pure scorer (deterministic, no Date.now-inside, no tieBreak-as-signal) + workspace-scoped service (getDb per-mandate) + RBAC controller + module reg. Tests: **determinism** (identical inputs → identical output, snapshot); **empty-data boundary** (0 outreach / 0 pipeline events → defined score/notApplied, no crash/div-by-zero); **cross-firm negative-read** (2 workspaces, firm-A seller-intent excludes firm-B — via the REAL service through workspaceAls.run as dealflow_app, the wave-18/19/20 fault-killing pattern, NOT re-implemented SQL); **direction** (heating/cooling/flat from a windowed delta, deterministic); RBAC (403/401); **NO tieBreak in the output** (assert absent). NO Date.now() in the scorer (assert / lint).
**B-3 Frontend** (nextjs-developer): /insights seller-intent surface (per-mandate score + direction + 3-signal breakdown, no tieBreak) + proxy + empty/error states + RBAC-gate. Reuse the design system.
**B-4/B-5/B-6:** head-builder polices pure-deterministic-no-LLM-no-Date.now-inside, NO-tieBreak-surfaced, workspace-scoped-getDb (cross-firm-negative-read REAL), computable-over-real-columns, read-only, empty-data-safe, direction-deterministic.
### Action 6 — Specialists: backend-developer (B-1/B-2), nextjs-developer (B-3).
### Action 7 — Parallelization: B-0(skip) → B-1 → B-2 → B-3.
### Action 8 — Self-consistency CLEAN.
```yaml
deps_new: []
schema_change: false
new_secret: false
new_sdk: false
specialists: [backend-developer, nextjs-developer]
reuse: [matching.scorer.ts (pure-scorer pattern), wave-18 analytics aggregation + getDb/ALS + workspace GUC + FORCE RLS + /insights, outreach-activity/pipeline_events/match_candidates shipped tables, M1 RolesGuard/@Roles, the design-system cards]
compliance_invariants: [workspace-scoped-getDb-aggregation, cross-firm-negative-read (T-8, REAL service), pure-deterministic-no-LLM-no-Date.now-inside, computable-over-real-columns, NO-tieBreak-surfaced (PRODUCT #1), read-only-no-audit-rows, empty-data-safe, direction-deterministic]
hard_boundaries: "read-only deterministic scoring over EXISTING data; workspace-scoped (no cross-firm leak); PURE NO-LLM/no-SDK/no-network/no-credential/no-randomness/no-Date.now-inside-scorer; NO tieBreak as a scored/surfaced dimension; NO CRM (345dfbc6 blocked) / no #141; reuse only"
design_gap_flag: false
self_consistency: clean
```
