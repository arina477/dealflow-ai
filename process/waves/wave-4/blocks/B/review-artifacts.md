# Wave 4 — B-block review artifacts
**Block:** B (Build) · **Wave topic:** tamper-evident HMAC hash-chain audit log (M2 backbone) · **Gate:** B-6 · **Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | branch wave-4-audit-log; no new deps (node:crypto); schema=YES(migration@B-2); 4 tasks claimed |
| B-1 | stages/B-1-contracts.md | done | audit types + AuditVerifyResponse + roleRoutes (b0eed89); 164 tests; nav⊆RBAC preserved |
| B-2 | stages/B-2-backend.md | done | migration 0002 (immutability PROVEN) + HMAC service/verifier/endpoint (3602994,54ff1b8); 88 tests |
| B-3 | stages/B-3-frontend.md | done | integrity view at /compliance/audit-log (2d6bfda); 95 tests; broken=persistent |
| B-4 | stages/B-4-wiring.md | done | repo typecheck+build PASS; AUDIT_LOG_HMAC_KEY→C-2 |
| B-5 | stages/B-5-verify.md | done | lint 0-err, 347 tests, build pass; golden-vector present; runtime→C-2 |
| B-6 | stages/B-6-review.md | pending | head-builder gate + /review (compliance-critical) |

## Block context
- **Spec:** seed ec1f279d (multi-spec 4 blocks + P-4 remediation addendum). Branch wave-4-audit-log.
- **claimed_task_ids:** [ec1f279d (table), a8b2b5a2 (HMAC service), e6a4cbfe (verifier+endpoint), 031d79fc (integrity view)]
- **Deps:** none new (node:crypto built-in). **Schema:** YES — additive migration 0002 (audit_log_entries + grant + trigger). **Env:** AUDIT_LOG_HMAC_KEY + _VERSION (placeholdered; set real at B-4/C).
- **Load-bearing invariants (P-4):** DB-layer immutability (grant+trigger, blocks even superuser); keyed HMAC-SHA256 chain (genesis anchor, key env-only fail-fast, chain_version rotation); write-atomic append(entry, tx); concurrent-append serialized (pg_advisory_xact_lock); verifier detects content-tamper+link-break+gap; endpoint+screen RBAC compliance/admin (wave-3 guard, roleRoutes single source, nav⊆RBAC); threat-boundary documented (no over-claim); integrity view at /compliance/audit-log per audit-log-export.html §Integrity Validation.
- **Scope:** service+verifier+integrity-view standalone this wave; real audited-action call-sites = M6+.
## Gate verdict log
<appended by head-builder at B-6>
