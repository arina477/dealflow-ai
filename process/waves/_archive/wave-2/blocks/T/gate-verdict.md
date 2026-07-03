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

---

# Wave 2 — T-9 Verdict

**Reviewer:** head-tester (fresh spawn, agentId head-tester@T-9-wave-2-attempt-2)
**Reviewed against:** process/waves/wave-2/blocks/T/review-artifacts.md + findings-aggregate.md (updated) + T-5-e2e.md (final) + T-6-layout.md (real capture) + C-2-deploy-and-verify.md (re-run #5)
**Attempt:** 2  (post-infra-resolution re-gate; attempt 1 = ESCALATE on absent Playwright binary)

## Attempt 2

## Verdict
APPROVED

## Rationale

The sole basis for attempt 1's ESCALATE — the absent Playwright Chrome binary that prevented T-5 real-browser E2E and T-6 visual regression from executing at all — is now genuinely resolved, and the resolution is verified against real execution evidence, not a re-degraded or zero-count false-PASS. **T-5** ran chromium-1208 (via the pw-compat shim resolving to the real `~/.cache/ms-playwright/chromium_headless_shell-1208/` binaries) and executed a **non-zero 6 tests, 6 PASS / 0 FAIL** — the exact non-negotiable my infra-readiness mandate demands. This is provably a real browser driving real flows, not a silent skip: a prior run (run 2) legitimately reported 4/6 with two genuine FAILs, and those two failures **caught two CRITICAL browser-only defects that the API-curl smoke and all 50 RTL component tests missed** — (1) SuperTokens middleware+CORS registered after `app.init()` (login preflight 404) and (2) cross-origin session delivered as headers not a first-party cookie (dashboard bounced to /login). That is the antithesis of coverage theater: the E2E layer earned its cost by finding defects no other layer could. Its assertions read DOM data/behavior (`getByRole('alert')`, URL navigation to /dashboard, heading visibility), not layout-container visibility only, and use `Date.now()`-suffixed unique identifiers per run with no silent retry-until-green. **Both critical bugs are fixed AND independently live-verified at the deploy layer** (not merely claimed): C-2 re-run #5 deployed `bc558f7` with provenance verified (`meta.commitHash == bc558f7`, `/health version == bc558f7`, no health-check mirage), and proves `POST web/auth/signin` → SuperTokens 200 `WRONG_CREDENTIALS_ERROR` (same-origin proxy works, not a Next 404) and — the load-bearing check — `POST web/auth/signup` through the proxy returns a **first-party `Set-Cookie: sAccessToken (HttpOnly; Secure; SameSite=Lax)` on the web origin** with the JWT `iss` claim confirming `apiDomain=WEB_ORIGIN`; both services deployed SUCCESS, rollback armed, zero outage. **T-6** established a real pixel baseline (4/4 tests, committed 18-25KB screenshots) with hard assertions confirming SSO and "SOC 2 Type II" badge ABSENT per the jenny P-4 scope decisions, one-primary-CTA hierarchy, and design-system palette conformance across all four auth screens — a legitimate first-baseline capture (correctly no diff on the first run; future waves diff against it). Every load-bearing compliance/auth invariant remains verified LIVE at the correct backend layer, and the cookie posture is in fact **strengthened** since attempt 1 (now first-party on the web origin): invite-only enforced (bogus invite → 400, no account; e2e-4/e2e-5), no-user-enumeration (reset 202 regardless of account existence), role claim present (`/auth/me` 200 `{role:advisor}` + JWT `role=advisor`), session cookies HttpOnly+Secure+SameSite=Lax, foreign-origin POST rejected 400, SuperTokens Core on a genuinely isolated Postgres (distinct DB URLs, no-alias assertion passed at boot), integration on real Postgres (no DB mocking), secret-grep clean. The residual untested surface is narrow, bounded, and correctly triaged: the T-8 rate-limit gap (medium — no app-level 429 on `/auth/*`) is not in this wave's acceptance criteria, is mitigated by invite-only 32-byte random tokens + 0 pilot users, and routes to V-2 / a hardening slice; the T-1 test-fixture cast (low) is a deliberate DI-metadata mock, non-blocking. One carried limitation, non-gate-blocking and consistent with attempt 1: refresh-token rotation + reuse-detection is asserted at the architecture layer rather than live-probed with a concurrent token-replay — worth an adversarial probe in the hardening slice, but with no critical security finding, invite-only signup, and 0 users, it does not clear-block the gate. No coverage theater, no tautological assertions, no layout-only false-PASS, no flaky-retry laundering, no silently-skipped E2E, and all compliance invariants adversarially or live-verified. The block exits APPROVED; T-9 proceeds to Phase 2 (journey crawl / regen against the now-reachable auth screens).

## Findings carried (non-gate-clearing, → V-2)

- **T-8 rate-limit gap (medium):** no app-level rate-limiting on `/auth/*` (8 rapid invalid signups → all 400, no 429). Not in acceptance criteria; mitigated by invite-only + 0 users; → V-2 / hardening slice. Bundle the refresh-token reuse-detection live probe into the same slice.
- **T-1 low (`as unknown as AuthRepository` fixture cast):** deliberate DI-metadata mock, non-blocking.

## Cascade

Both re-run stages (T-5 e2e, T-6 layout) executed clean; per the T-block cascade table their downstream is T-9, which is this gate. No further T-stage re-run required. Phase 2 journey regen now runs against reachable auth screens (web live on bc558f7, no longer 404ing).

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 1
