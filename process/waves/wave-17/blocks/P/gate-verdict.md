# Wave 17 — P-4 Gate Verdict (Phase 1)

**Block:** P (Product) · **Milestone:** M8 — Pilot-partner workspace data-isolation
**Gate:** P-4 · **Phase:** 1 (product-strategy gate) · **Attempt:** 1
**Gating agent:** head-product (fresh spawn)
**wave_type:** multi-spec (4 blocks) · **design_gap_flag:** false · **security_scope_tightened:** true
**Authoritative spec:** seed task `tasks.description` (id 0db154ff) fenced YAML — read direct from Postgres (rule 7); supersedes the older prose "acceptance sketch" bodies in sibling rows.

---

## Verdict: APPROVED

Advance to **P-4 Phase 2 (SECURITY-SCOPE-TIGHTENED)** — mandatory Phase-2 review + `security-auditor` before block exit. This is a multi-tenancy/RLS/auth wave; the tightened gate is non-negotiable.

---

## Judgment against the load-bearing isolation invariants (strict — a data-isolation feature that leaks is worse than none)

| # | Invariant | Authoritative-spec citation | Verdict |
|---|---|---|---|
| 1 | **FORCE RLS** (not just ENABLE) — table-OWNING API role subject to RLS | e45ba68c AC1: "RLS ENABLED and FORCE ROW LEVEL SECURITY (so the table-OWNING API role is ALSO subject to RLS)... without FORCE the owner bypasses RLS and every isolation test is a false-green" | PASS — explicit; names the #1 RLS trap |
| 2 | **Negative-read over the OWNER connection** (not a fresh non-owner role) | df2f3b2f AC2: "runs over the SAME owner/app connection the API uses — NOT a fresh non-owner role — so a missing FORCE ROW LEVEL SECURITY is CAUGHT (else false-green)" | PASS — false-green guard closed |
| 3 | **Deny-by-default / fail-closed** — unset GUC → 0 rows, never workspace-1 default | e45ba68c AC2 "session var UNSET → DENIED (fail-closed, not fail-open)"; 96026365 AC3 "never a default-to-first-workspace leak"; edge-case "Unset → zero rows (deny-all), never all rows" | PASS — unambiguous |
| 4 | **audit_log_entries.workspace_id HASH-EXCLUDED** — verifyChain stays ok:true | seed AC4: "added OUTSIDE HashableEntryFields (wave-14 mandate_id precedent)... every existing entry hash stays byte-identical and GET /compliance/audit-log/verify returns {ok:true}" | PASS — machine-checkable via verify endpoint |
| 5 | **audit_log + recordkeeping-export READ inside the isolation boundary** (WORM ≠ read-isolation) | e45ba68c AC3 (RLS scopes audit + export reads) + df2f3b2f AC1 (negative-read covers primary AND audit_log AND recordkeeping-export) | PASS — ceo-reviewer boundary correction fully absorbed |
| 6 | **GUC SET LOCAL / tx-scoped** — no leak across pooled connections | 96026365 AC2 "set_config(..., is_local=true)... transaction-scoped, NEVER leaks across pooled connections"; edge-case asserts second request on same pooled conn sees its own workspace | PASS |
| 7 | **Backfill before NOT NULL** — no orphan workspace_id | seed AC3 "BACKFILLED... BEFORE workspace_id is set NOT NULL"; edge-case "assert 0 NULL workspace_id post-cutover" | PASS |
| 8 | **Fault-killing negative-read** — fails if FORCE/policy/propagation removed; exact-0 cross-tenant + non-zero same-tenant positive control | df2f3b2f AC3: "removing FORCE RLS, the deny-by-default policy, or the request-scope GUC propagation → workspace-A reads workspace-B → test FAILS (assert exact-zero cross-tenant rows, and assert non-zero same-tenant rows)" | PASS — not a trivially-empty pass |

**All eight load-bearing invariants are present, falsifiable, and observable** (verify endpoint `{ok:true}`, exact-0 / non-zero row assertions, GUC-unset deny-all). No AC dictates implementation mechanism beyond the invariant it must guarantee; ACs describe observable DB/API state, not internal algorithms.

## Stage-exit checklist (P-4)

- [x] All ACs touching audit-log, RLS/isolation gate, and RBAC-adjacent suppression are binary, observable, machine-readable — see table above.
- [x] Cross-review responses (problem-framer PROCEED + 3 correctness obligations; ceo-reviewer SELECTIVE-EXPANSION audit/export boundary; mvp-thinner OK atomic-vertical) are logged, resolved, and INTEGRATED into the authoritative spec — every obligation traces to a named AC (A→e45ba68c AC1 + df2f3b2f AC2; B→seed AC4 + e45ba68c AC4; C→seed AC3; ceo boundary→e45ba68c AC3 + df2f3b2f AC1).
- [x] Every claimed_task_id traces to the P-0 bet: workspaces anchor→RLS→propagation→negative-read proof, all serving the compliance-wedge falsifier (pilot firm trusting live-mandate data separation). No orphan tasks; no scope smuggle.
- [x] [STABLE] Default-No-Go check: NO artifact lacks machine-readability or traceability. All resolvable — no ESCALATE condition.

## Strategic calls resolved

- **Bet alignment + scope:** ONE-firm workspace-isolation-via-RLS is the correct M8 scope — the minimum-correct isolation primitive. NOT premature H3 multi-tenant SaaS (no billing/provisioning/self-serve tenancy), NOT a leaky app-layer half-measure (RLS is the non-leaky DB-level floor). BOARD 7/7 endorsed the milestone; wave-scope is correctly bounded. CONFIRMED.
- **Atomic-vertical soundness:** thinning any of the 4 tasks ships a wave that CLAIMS isolation but leaks (anchor inert without RLS; RLS breaks-app/fails-open-risk without propagation; no isolation CLAIM without the adversarial proof). mvp-thinner confirms no low-sensitivity tenant table exists in an M&A confidentiality context — nothing splittable. CONFIRMED all-mvp-critical.
- **_TBD success metric:** the M8 quantitative metric is founder-TBD. NOT a build hard-stop. The qualitative bar ("no cross-firm data visibility") + the fault-killing negative-read proof is a sufficient, falsifiable bar to build the RLS foundation against now; the quant number is an async founder poll (ceo-reviewer + problem-framer concur; building the foundation is not reversible-cheaper by waiting). ACCEPTED — proceed.

## No missing ACs that would make isolation untrustworthy for real M&A confidential deal data

The eight invariants above cover the complete leak surface: owner-bypass, false-green test, fail-open default, audit-chain breakage, WORM-read confusion, pool cross-contamination, orphan-row cutover, and trivially-empty test. No gap identified at the product-spec layer. Residual mechanism-level assurance (exact SQL, RLS policy authoring correctness, tx-handle wiring) is delegated to Phase-2 `security-auditor` + B-block head-builder policing — the correct owners, not this gate.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: P-4
  phase: 1
  attempt: 1
  reviewers:
    problem-framer: PROCEED (3 correctness obligations — all integrated)
    ceo-reviewer: SELECTIVE-EXPANSION (audit/export read-boundary — integrated)
    mvp-thinner: OK (atomic-vertical; nothing splittable)
  failed_checks: []
  security_scope_tightened: true
  isolation_invariants_verified: [FORCE-RLS, owner-connection-negative-test, deny-by-default-fail-closed, audit_log-workspace_id-hash-excluded-verifyChain-ok, audit+export-read-in-boundary, GUC-SET-LOCAL-tx-scoped-no-pool-leak, backfill-before-NOT-NULL, fault-killing-negative-read]
  rationale: >
    All eight load-bearing isolation invariants are present in the authoritative
    spec (seed tasks.description YAML, read direct from Postgres), each expressed as
    a falsifiable, observable, machine-checkable AC — FORCE RLS with owner-connection
    negative-read (false-green guard), deny-by-default fail-closed on unset GUC,
    audit_log workspace_id hash-excluded with verifyChain ok:true, audit + recordkeeping-export
    reads inside the boundary (WORM != read-isolation), SET LOCAL tx-scoped GUC with no
    pool leak, backfill before NOT NULL, and a fault-killing negative-read test asserting
    exact-0 cross-tenant + non-zero same-tenant. Scope is correctly the minimum-correct
    ONE-firm RLS isolation primitive (not premature H3 SaaS, not a leaky app-layer half-measure);
    the 4-task bundle is genuinely atomic-vertical (thinning any → leaks). All cross-reviewer
    obligations trace to named ACs; every task traces to the P-0 compliance-wedge bet. The
    _TBD quantitative metric is a founder async poll, not a build hard-stop — the negative-read
    proof is the falsifiable proxy. No product-layer AC gap that would make the isolation
    untrustworthy for real M&A confidential deal data.
  next_action: PROCEED_TO_P-4-PHASE-2   # SECURITY-SCOPE-TIGHTENED: mandatory Phase-2 review + security-auditor before block exit
```

---
## Phase 2 iteration 1 (Karen + jenny + Gemini + security-auditor) — security-scope-tightened
- **Karen:** APPROVE (7/7 VERIFIED, 0 WRONG — tenant tables, HashableEntryFields hash-exclude precedent, verifyChain, getUserWithRole, runInTransaction, journal-0013, greenfield-GUC all confirmed against shipped code).
- **jenny:** APPROVE (6/6 MATCHES, 0 DRIFTS — the org-wide-audit→workspace-RLS is a correct refinement security.md:135 pre-authorized as the H2 boundary; hash-exclude consistent with wave-14; WORM+RLS orthogonal; one-firm not H3; server-resolved workspace; _TBD-metric tracked-not-blocking).
- **Gemini:** UNAVAILABLE (429 credits depleted, confirmed wave-16) → degrades, non-blocking.
- **security-auditor:** BLOCK — 4 isolation-defeating findings (1 CRIT F1 pooled-non-tx-read, 1 HIGH F2 resolver-chicken-egg, 2 MED F3 chain-integrity-vs-visibility + F4 hash-exclude-reattribution). → REWORK P-3 + seed spec.
## Iteration 1 verdict: REWORK (security-auditor BLOCK; tightened gate forces a 2nd Phase-2 iteration). Rework applied to P-3 (F1 dedicated-connection+RESET, F2 SECURITY-DEFINER resolver, F3 global-integrity-vs-scoped-projection, F4 WORM-blocks-reattribution-test) + seed-spec addendum. → re-run security-auditor (iteration 2).

---
## Phase 2 iteration 2 (security-auditor re-review of rework) — CLEAN
security-auditor: **CLEAN — all 4 findings CLOSED** (F1 dedicated-connection+RESET, F2 SECURITY-DEFINER resolver, F3 integrity-global-vs-projection-scoped, F4 WORM-owner-proof+tested), no new medium+ isolation defect, verified against shipped code. 4 advisory B-2 carries (handle-binding mechanism, server-derived-resolver-arg, RESET-over-DISCARD, manifest-labeling) — none block.

## MERGED P-4 VERDICT: APPROVED (after security rework; security-scope-tightened ≥2 Phase-2 iterations satisfied)
Phase 1 head-product APPROVED; Phase 2 Karen APPROVE + jenny APPROVE + Gemini UNAVAILABLE(non-blocking) + security-auditor iteration-1 BLOCK(4 findings) → rework → iteration-2 CLEAN. The tightened gate caught 4 architectural isolation-defeating defects (1 CRIT pool-leak, 1 HIGH resolver-deadlock, 2 MED chain/hash) pre-build; all closed in P-3 + seed spec. → exit P-block to B-0 with the 4 advisory B-2 carries.
- verdict_complete: true
- security_scope_tightened: true (2 Phase-2 iterations; rework applied + verified)
- b2_carries: [handle-binding-ALS-or-request-scope, server-derived-resolver-st_user_id, RESET-over-DISCARD-ALL, manifest-label-global-verify-vs-scoped-projection]
