# Wave 23 — T-9 Journey (gate + journey)
**Gate:** APPROVED (head-tester). verdict → blocks/T/gate-verdict.md. next_action: PROCEED_TO_V.
## Journey delta (M9 seller-intent, LIVE @6c22919) — canonical user-journey-map.md UPDATED
- **/insights seller-intent section** (NEW) — per-mandate intent score + direction + 3-signal breakdown, workspace-scoped, RBAC advisor+admin, pure/deterministic, NO-LLM, NO tieBreak.
- **GET /seller-intent** (NEW) — shared-Zod deterministic scoring API, RBAC-scoped, workspace-scoped via getDb + FORCE RLS. Read-only.
## Security/quality coverage (PROVEN — CI real-DB as dealflow_app + C-2 live)
cross-firm-isolation (seller-intent-isolation.e2e 3/3 REAL service via ALS, SIT-3 fail-closed) | pure-determinism (26/26 no-Date.now-inside/no-LLM, byte-identical repeat) | NO-tieBreak (SI1/PRODUCT #1) | computable-over-real-columns | read-only | RBAC-fail-closed | empty-data-safe (NaN-seed fix).
