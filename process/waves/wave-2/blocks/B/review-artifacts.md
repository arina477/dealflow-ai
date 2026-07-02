# Wave 2 — B-block review artifacts

**Block:** B (Build)
**Wave topic:** Auth backbone + user/role data model (SuperTokens + invite-only) — M1 auth vertical slice
**Block exit gate:** B-6
**Status:** in-progress

## Stage deliverables

| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| B-0 | process/waves/wave-2/stages/B-0-branch-and-schema.md | done | branch wave-2-auth-backbone; supertokens-node@24.0.2; additive migration 0001 (f3681f8) |
| B-1 | process/waves/wave-2/stages/B-1-contracts.md | done | auth Zod contracts in @dealflow/shared (49e290a) |
| B-2 | process/waves/wave-2/stages/B-2-backend.md | done | auth module; 6 security invariants; 20 tests pass (f24a56d) |
| B-3 | process/waves/wave-2/stages/B-3-frontend.md | done | 3 auth pages + dashboard placeholder; 41 RTL tests (cb6a6d3) |
| B-4 | process/waves/wave-2/stages/B-4-wiring.md | done | repo typecheck+build PASS; no drift |
| B-5 | process/waves/wave-2/stages/B-5-verify.md | pending | typecheck + lint + unit + dev smoke |
| B-6 | process/waves/wave-2/stages/B-6-review.md | pending | head-builder gate + /review |

## Block-specific context

- **Spec contract:** `tasks` row e15f71dd-8f61-441c-904a-bdfa108bd6e1 (DB); spec at process/waves/wave-2/stages/P-2-spec.md (multi-spec, 3 blocks)
- **Branch name:** wave-2-auth-backbone
- **claimed_task_ids:** [e15f71dd (seed), e1c0e81e (API), af6cbc59 (screens)]
- **New deps added this wave:** supertokens-node@24.0.2 (+ SuperTokens Core Docker service at C-2)
- **New env vars added this wave:** SUPERTOKENS_CONNECTION_URI, SUPERTOKENS_API_KEY, SUPERTOKENS_DATABASE_URL, SESSION_SECRET (already placeholdered in .env.example from onboarding)
- **Schema changes this wave:** additive users/roles/invites migration + down-migration (postgres-pro); app_meta untouched
- **B-1 fast-path approved:** false (B-1 authors real auth contracts)
- **Files implemented (cumulative):** <updated at B-2, B-3, B-4>
- **Deviations from plan logged this block:** <list, or "none">

## B-block execution notes carried from P-4 Phase 2 (jenny)
1. B-4: reconcile auth route naming (`/accept-invite` vs journey-map `/invite/:token`); pick canonical, regen journey at T-9.
2. B-4: remove/soften the "SOC 2 Type II" badge in login screen (compliance_regime=none — accuracy/provenance per CODE-OF-CONDUCT).
3. B-4: reconcile mockup name-field + client password policy with DESIGN-SYSTEM; SSO correctly omitted (deferred M8/M11).

## Open escalations carried into gate

- Host Chrome binary (task fa23349a) required for the auth-screens E2E at T-5 (real UI wave). Surfaced to founder at P-4.

## Gate verdict log

<appended by fresh head-builder spawn at B-6 Action 1>
