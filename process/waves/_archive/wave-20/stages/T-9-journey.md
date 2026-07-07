# Wave 20 — T-9 Journey (gate + journey)
**Gate:** APPROVED (head-tester). verdict → blocks/T/gate-verdict.md. next_action: PROCEED_TO_V.
## Journey delta (M9 outreach-activity, LIVE @86ddc29) — canonical user-journey-map.md UPDATED (wave-18 GAP-A lesson)
- **/outreach/activity (Outreach Log)** (NEW) — internal outreach-touch tracker (form + list + status transitions), workspace-scoped WRITE, RBAC advisor+admin, audit-logged, no external send.
- **POST/GET/PATCH /outreach-activity** (NEW) — RBAC + workspace-scoped write API, audit-logged mutations.
- Nav: Outreach Log (server-role-gated).
## Security-invariant coverage (PROVEN — CI real-DB as dealflow_app + C-2 live)
write-path-isolation (R1 own-row-re-home + SF1 no-default-leak + R2 FORCE, non-hollow via real service) | read-negative-read | all-4-FK-tenancy (R3) + createdBy-server-derived | audit-logged-mutations-last-in-txn (R4) + the C-1 readTail-RLS-exempt bug-fix | additive-migration-0018 (GAP-4 populated-safe) | credential-free.
