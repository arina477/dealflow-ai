# Wave 9 — T-8 Security (Pattern B, FULL — audit + RBAC + user-scoped writes)
## Scope: buyer-universe assemble/filter/enrich/submit = M2 audit + RBAC + user-FK writes → FULL.
## Action 1 — RBAC: /buyer-universe analyst-primary (+advisor/admin) all ops (DB-authoritative RolesGuard fail-closed + module-load @Roles assertion; route-ordering sub-paths before :id). LIVE (C-2): analyst 2xx, compliance 403, anon 401.
## Action 2 — Actor-id: created_by/actor = app users.id via getUserWithRole (NOT raw ST id — wave-5). Regression-tested.
## Action 3 — Audit integrity: every mutation AUDITED (buyer-universe-assemble/filter/enrich/submit) LAST-IN-TXN via M2 (HMAC chain; rollback on audit-fail). LIVE: chain verify ok (153 entries). filter audit records partialFilter + unsupportedDimensions (honest).
## Action 4 — CSRF: mutations via apiFetch rid + /buyer-universe-data non-page-colliding proxy. GET reads SSR/exempt.
## Action 5 — Integrity: one-txn assemble/filter atomicity; IDEMPOTENT re-assemble (mandate_id UNIQUE + advisory lock + onConflict — no double-universe race, no dup candidates); submit-guard (included-count + un-triaged → 400, no submitted-empty ready-to-rank); patchCandidate cross-universe-scoped (404). DrizzleError.cause.code unwrap.
## Action 6 — M4/M5 boundary: NO score/rank/fit/rationale/LLM (byte-scan clean C-2). Assemble ordering is name-ASC presentation-only (commented, no ranking semantics).
## Action 7 — Secret grep (wave-9 diff): CLEAN. Reuse M3/M4 read-only (no writes to those tables); role-gated reads (single-firm model).
## Triage: no critical open. B-6 (7 CRIT: SSR-hydration/response-shape/double-universe/submit-guard/enrich-tx/filter-dims/re-assemble) all fixed + LIVE-confirmed C-2 first-try. INFO unbounded-assemble → backlog.
```yaml
test_pattern: active
mode: full
skipped: false
applicable_probes: [rbac, actor_id, audit_integrity, csrf, one_txn_idempotency, submit_guard, cross_resource_scope, m4_m5_boundary, secret_grep]
secret_grep_findings: []
findings: []
