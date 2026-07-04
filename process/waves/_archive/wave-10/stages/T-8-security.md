# Wave 10 — T-8 Security (Pattern B, FULL — audit + RBAC + user-scoped writes + BOTH boundaries)
## Scope: matching create-run/disposition/handoff = M2 audit + RBAC + user-FK writes + the deterministic-vs-LLM + M5/M6 boundaries → FULL.
## Action 1 — RBAC: /matches advisor-primary (+admin) create/mutate; analyst read (RolesGuard fail-closed + module-load @Roles + route-ordering). LIVE (C-2): analyst POST 403, GET 200, anon 401.
## Action 2 — Actor-id: created_by/actor = app users.id via getUserWithRole (NOT raw ST — wave-5). Regression-tested.
## Action 3 — Audit integrity: every mutation AUDITED (match-run-create/disposition/handoff) LAST-IN-TXN via M2 (HMAC chain; rollback on fail; isNew-accurate via xmax). LIVE: chain ok 206→207.
## Action 4 — CSRF: mutations via apiFetch rid + /matches-data non-page-colliding proxy. GET SSR/exempt.
## Action 5 — Integrity: one-txn create-run atomicity; IDEMPOTENT (buyer_universe_id UNIQUE + advisory lock — no double-run); DISPOSITION-PRESERVE on re-run (no compliance data-loss — B-6 CRIT-1); submit-guard (400 if universe not submitted); handoff accepted-count-guard-InTx (BUILD rule 6, no submitted-empty); re-handoff idempotent; cross-run-scoped PATCH (404). fit_score CHECK 0-100 (no out-of-range). DrizzleError-unwrap.
## Action 6 — BOUNDARY 1 (deterministic-vs-LLM): NO Anthropic/Claude/LLM import/call, NO BullMQ, NO rationale-TEXT (score_breakdown structured jsonb), NO API spend (boundary test + C-2 no-LLM 0.13s). **The AI-framing STRIP (karen MANDATORY, CODE-OF-CONDUCT provenance): NO false AI-capability claim on the deployed /matches-shortlist page (C-2 live grep ZERO; rule-based framing).** BOUNDARY 2 (M5/M6): handoff = ready_for_outreach status only, NO outreach (M6).
## Action 7 — Secret grep (wave-10 diff): CLEAN. Reuse M4/M3 read-only; role-gated.
## Triage: no critical open. B-6 (2 CRIT: re-run-wipe, handoff-escaping-read) fixed + LIVE-confirmed C-2 first-try. Boundaries LIVE-clean.
```yaml
test_pattern: active
mode: full
skipped: false
applicable_probes: [rbac, actor_id, audit_integrity, csrf, one_txn_idempotency_disposition_preserve, submit_and_handoff_guards, cross_resource_scope, deterministic_vs_llm_boundary, ai_framing_strip_codeofconduct, m5_m6_boundary, secret_grep]
secret_grep_findings: []
findings: []
