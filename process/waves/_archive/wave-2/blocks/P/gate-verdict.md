# Wave 2 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, security-scope tightened lens — auth wave)
**Reviewed against:** process/waves/wave-2/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
This is the auth identity foundation for M1, and under the security-strict lens the P-block holds up on every load-bearing dimension. The acceptance criteria are falsifiable and observable rather than aspirational: invite-only is stated as a two-system observable ("no users row AND no SuperTokens user created"), no-user-enumeration is pinned to identical HTTP responses (reset always 202; login generic error) at both AC and edge-case level, the role claim is required in the session and must survive refresh, and the SuperTokens/app-Postgres isolation invariant is not left as prose — P-3 lands it as a boot-time env assertion (`SUPERTOKENS_DATABASE_URL !== DATABASE_URL` and `!== TEST_DATABASE_URL`, fail-fast), making it machine-checkable. The migration is additive-only with a matching down-migration and idempotent re-run, and the 4-role SoD substrate (advisor/analyst/compliance/admin, seeded from first migration) is genuinely laid so M2 can enforce sender≠approver. Scope discipline is exact: the problem-framer guardrail is honored to the letter — a guard primitive that can read the claim is in scope, per-route RBAC enforcement is explicitly deferred and does not leak into any AC — and SSO/MFA plus the full AppShell are correctly pushed to later bundles. The P-3 plan is concrete and specialist-routed (5 architecture deltas each with alternatives/trade-offs; 3 tables with columns/FKs/indexes; 6 endpoints with req/resp/status/auth-model; 7 specialists all validated against AGENTS.md; migrations ordered before API logic; SDK pre-build checklist complete with a network-confirmed pin of supertokens-node@24.0.2 and the reserved-route collision flagged as the top B-time gotcha). The host-Chrome E2E dependency (task fa23349a) is surfaced honestly at P-1/P-3/P-4 and in the spec edge-cases as blocking-severity for a real UI wave, with an explicit degrade-to-HTTP/component-smoke-and-record path rather than a fabricated green. Load-bearing claims were spot-checked directly: the DB spec contract in task e15f71dd matches (and exceeds) the P-2 pointer copy, all three design mockups exist on disk, and every named specialist resolves in AGENTS.md. Non-blocking observations for the B/T blocks (not verdict-changing): invite token "hashed at rest" is specified in the P-3 data-model note and the token-uniqueness AC is present, but the hashing invariant is not elevated into the block-1 AC list — recommend T-8 asserts it; and `/auth/invite` is intentionally anon this wave with `invited_by` nullable as a documented bootstrap concession consistent with the enforcement-deferred guardrail.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---

## Phase 2 — Karen + jenny + Gemini (merged)

**Karen (load-bearing claim verification):** APPROVE. All 5 claims VERIFIED against ground truth (unpacked supertokens-node@24.0.2 tarball to confirm method signatures; all 7 specialists on disk; migration additive + scoped down-migration; SuperTokens Postgres isolation in .env.example + boot-time non-alias assertion; role-guard built-but-unapplied — no smuggled RBAC). 2 low non-blocking notes (AGENTS.md line-91 citation overstatement; AUDIT_LOG_HMAC_KEY vs AUDIT_HMAC_KEY naming — M2 carry-forward).

**jenny (drift check):** APPROVE. No spec-drift vs decisions #6/#7/#11/#12, journey map, or founder bets. 4 low spec-gaps for B-block execution notes:
- Route naming: plan `/accept-invite` vs journey-map `/invite/:token` — reconcile at B-4, regen journey at T-9.
- Mockup extras: login.html "Continue with Google" SSO (correctly omitted — deferred M8/M11), "Keep me signed in" + accept-invite "Full Legal Name" field + client password policy — reconcile with DESIGN-SYSTEM at B-4.
- **"SOC 2 Type II" badge in login.html — compliance_regime is `none`; remove/soften at B-4 (false compliance claim; CODE-OF-CONDUCT provenance/accuracy).**
- M1 "role-aware dashboard shell" deferred to follow-up bundle (documented, intentional) — N-block tracks M1-close dependency.

**Gemini cross-review:** UNAVAILABLE (HTTP 429 — AI Studio prepay credits depleted). Per gate rule, UNAVAILABLE does not block; gate proceeds on Karen + jenny. (Founder-facing: cross-model review offline until Gemini credits topped up.)

**Security-scope tightened gate:** Phase 2 did NOT return BLOCK (both required reviewers APPROVE) → no forced second iteration required.

## Phase 2 Verdict: PASS (Karen APPROVE + jenny APPROVE + Gemini UNAVAILABLE-degraded)

**P-block gate: PASSED.** design_gap_flag=false → next block B (D skips).

### B-block execution notes carried from Phase 2 (non-blocking):
1. B-4: reconcile auth route naming (`/accept-invite` vs `/invite/:token`); pick canonical, regen journey at T-9.
2. B-4: remove/soften the "SOC 2 Type II" badge in the login screen (compliance_regime=none — accuracy/provenance).
3. B-4: reconcile mockup name-field + client password policy with DESIGN-SYSTEM; SSO correctly omitted.
