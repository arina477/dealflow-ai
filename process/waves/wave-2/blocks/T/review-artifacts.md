# Wave 2 — T-block review artifacts

**Block:** T (Test)  ·  **Wave topic:** Auth backbone + user/role data model (SuperTokens + invite-only)  ·  **Block exit gate:** T-9  ·  **Status:** in-progress

## Stage deliverables
| Stage | Deliverable | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | stages/T-1-static.md | ci-verified | done | typecheck+lint green; 1 low test-fixture bypass |
| T-2 | stages/T-2-unit.md | ci-verified | done | auth service/di-boot/bootstrap/env + web RTL green |
| T-3 | stages/T-3-contract.md | ci-verified | done | @dealflow/shared auth Zod + live /auth/me shape |
| T-4 | stages/T-4-integration.md | ci-verified | done | real-Postgres CI + live DB round-trip (C-2) |
| T-5 | stages/T-5-e2e.md | active-degraded | done | flows verified LIVE at C-2 + 50 RTL; browser swarm Chrome-blocked |
| T-6 | stages/T-6-layout.md | active-degraded | done | pages to DESIGN-SYSTEM; visual-regression Chrome-blocked |
| T-7 | stages/T-7-perf.md | active | skipped | not a heavy wave |
| T-8 | stages/T-8-security.md | active | done | auth smoke+cookies+CSRF+secret-grep PASS; rate-limit gap (medium) |
| T-9 | stages/T-9-journey.md | active | pending | block-exit gate (head-tester) |

## Block-specific context
- **wave_type:** multi-spec; auth + ui + backend (real login/invite/reset screens + auth API). T-8 fires (auth). T-7 skip (not heavy).
- **Stages skipped:** T-7 (not heavy).
- **Cumulative findings:** 4 (0 critical, 3 medium [2 Chrome-infra + 1 rate-limit], 1 low).
- **Live verification leverage:** C-2 already exercised the full auth flow end-to-end against the deployed system (invite→signup→session+role→/auth/me→bogus-invite→reset), so T-5's acceptance criteria are met by live evidence; the Chrome gap only defers the browser-tooling layer.

## Open escalations carried into gate
- Playwright Chrome binary absent (task fa23349a) → real-browser E2E (T-5) + visual regression (T-6) deferred; flows otherwise verified. Blocking-severity for future pure-UI waves; this wave's auth flows are live-verified.
- Rate-limiting absent on auth endpoints → V-2 triage.

## Gate verdict log
<appended by fresh head-tester spawn at T-9 Action 1>
