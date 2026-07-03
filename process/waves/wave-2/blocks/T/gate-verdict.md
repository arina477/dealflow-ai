# Wave 2 — T-9 Verdict

**Reviewer:** head-tester (fresh spawn, agentId head-tester@T-9-wave-2)
**Reviewed against:** process/waves/wave-2/blocks/T/review-artifacts.md + findings-aggregate.md
**Attempt:** 1  (1 = first gate)

## Verdict
ESCALATE

## Rationale

The static/unit/contract/integration/security layers (T-1..T-4, T-8) are genuinely strong and their greens are real, not Ghost-Green: C-1 verifies per-run `headSha == PR HEAD` on `event: pull_request` with live cache-miss on the merged commit, and — notably — caught the `gh run watch --exit-status` false-signal trap at cycle 2 (test FAILED while watch returned 0), re-deriving the merge signal from `gh run view conclusion=success` + all-5 `gh pr checks pass`. The load-bearing compliance/auth invariants are all verified LIVE against the deployed system at the correct (API/backend) layer, not client-side: invite-only enforced (bogus invite → 400, no account created), no-user-enumeration (reset unknown 202 == reset real 202), role claim present in session (`/auth/me` → 200 `{role:advisor}`), session cookies `HttpOnly+Secure+SameSite=Lax` on live `Set-Cookie`, foreign-origin POST rejected 400, and SuperTokens Core on a genuinely isolated Postgres (distinct DB URLs read live). Integration hits real Postgres (no DB mocking); no auth bypass, no session hijack, no secret leak (secret-grep clean, key kept in Railway env). This is not coverage theater — the team refused to fabricate a browser green and honestly labeled the degradation (`testers_spawned: 0`, `swarm_blocked_reason` stated, scenarios marked PARTIAL not PASS). **However**, this is a UI wave (three auth screens: login / accept-invite / reset — the security perimeter's front door) and the Playwright Chrome binary is absent (task fa23349a), so the real-browser E2E (T-5) and visual-regression layout diff (T-6) of those screens genuinely never executed. My standing infra-readiness mandate is explicit and non-negotiable: a T-5/T-6 stage on a wave with UI code changes while the browser binary is absent is a hard ESCALATE, never APPROVED-through — and the framework itself (always-on rule 13, trigger (d)) treats an uninstalled Playwright binary as an infra-readiness hard-stop verdict, not a discretionary call. The fix is host-side (`npx playwright install chrome`, needs root) and outside the orchestrator's control this wave, which is the textbook ESCALATE condition (structural coverage gap the orchestrator cannot fill — REWORK would be futile since the binary cannot be installed in-band). The escalation is clean: it is an infra-readiness block, not a fraud finding, and all compliance invariants are already live-verified, so the residual untested surface is narrow (real-browser wiring of the auth screens + pixel regression), bounded, and mitigated by 50 RTL component tests (incl. redirect-on-401, cookie-forwarding, no-enumeration error render) plus live `/login` 200. The rate-limit finding is correctly triaged (see Escalation notes).

## Escalation

- **Reason:** Infra-readiness hard-stop. The Playwright Chrome binary is absent on the host (task fa23349a; `npx playwright install chrome` requires root), so T-5 real-browser E2E and T-6 visual-regression of the wave's three auth screens could not execute at all. This is a structural coverage gap the T-block orchestrator cannot fill in-band — REWORK would loop back to two stages that physically cannot run until the binary is installed host-side. Per the standing non-negotiable rule (binary absent + UI code changes → hard ESCALATE, never APPROVED-through) and always-on rule 13 trigger (d) (uninstalled Playwright binary = infra-readiness hard-stop), the block cannot exit APPROVED. This is an honest-degradation escalation, not a fraud-catch: no false green was claimed, and every load-bearing compliance/auth invariant (invite-only, no-enumeration, role claim, cookie flags, Core DB isolation, session) is already verified LIVE at C-2/T-8 against real deployed infra at the API layer.

- **Routing target:** founder (mode = `automatic` per `process/session/.autonomous-session`; infra-readiness hard-stops route to founder under automatic mode).

- **What's needed to unblock:**
  1. **Host-side action (founder / infra):** complete task fa23349a — install the Playwright Chrome binary and required Linux shared libraries (e.g., `libnss3`) on the CI/host, then confirm the binary is present.
  2. **Re-run T-5 (E2E):** execute the real-browser Playwright swarm against the deployed auth screens (login submit+redirect, accept-invite token flow, reset request/confirm). Acceptance: executed-test count is **non-zero** (verified against CI artifact logs — a zero-count "green" is a silent false-PASS and remains a hard block), assertions read DOM data attributes / text (not layout-container visibility only), unique randomized identifiers per parallel run, no silent retry-until-green (quarantine flakes).
  3. **Re-run T-6 (Layout):** execute visual-regression pixel-diff with baselines locked to a fixed Docker image + deterministic font rendering; assert mobile-responsive overflow of the auth action buttons.
  4. **Re-enter T-9 Action 0** for a fresh verdict once T-5/T-6 report non-zero executed browser tests.

- **Interim disposition (does NOT substitute for the above):** if the founder elects to ship this auth backbone before the binary install, that is a founder risk-acceptance decision to record explicitly — the compliance invariants are live-verified, so the accepted residual is limited to real-browser UI wiring + visual regression of the auth screens, and task fa23349a plus the rate-limit hardening slice must remain open and tracked. The gate itself cannot grant that acceptance; per my charter I do not APPROVE-through an absent-binary UI wave.

## Findings acknowledged (carried, not gate-clearing)

- **T-8 rate-limit gap (medium):** correctly triaged. No app-level rate-limiting on `/auth/*` (8 rapid invalid signups → all 400, no 429). It is NOT in this wave's acceptance criteria, is mitigated by invite-only signup (random 32-byte tokens make signup brute-force infeasible) + 0 pilot users, and is routed to V-2 / a hardening slice. This is a legitimate medium → V-2, not a gate blocker on its own. It does not change the verdict; the verdict is driven solely by the T-5/T-6 infra-readiness block.
- **T-1 low (test-fixture `as unknown as AuthRepository`):** deliberate DI-metadata mock in a test fixture, non-blocking. Acceptable.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2
