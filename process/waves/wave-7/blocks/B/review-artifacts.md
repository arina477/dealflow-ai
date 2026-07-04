# Wave 7 — B-block review artifacts
**Block:** B (Build) · **Wave topic:** sourcing-workspace page (search canonical universe + trigger-sync + connection-create) · **Gate:** B-6 · **Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | branch wave-7-sourcing-workspace; no new deps/schema/secret; 1 task claimed |
| B-1 | stages/B-1-contracts.md | done | connectionCreateSchema + /sourcing/connections roleRoutes + audit action (f4098f1) |
| B-2 | stages/B-2-backend.md | done | connection create/list (audited, actor-id-translated); RBAC matrix (f4098f1); 706 tests |
| B-3 | stages/B-3-frontend.md | done | sourcing-workspace page at /sourcing (f8073e1); 214 tests; AC-BADGE/CTA/SEED |
| B-4 | stages/B-4-wiring.md | done | repo typecheck+build PASS |
| B-5 | stages/B-5-verify.md | done | lint 0-err, 920 tests, build pass; ≥2-source facet test; runtime→C-2 |
| B-6 | stages/B-6-review.md | pending | head-builder gate + /review |

## Block context
- **Spec:** seed dfa5bd56 (single-spec + P-4 remediation: AC-SEED create endpoint, AC-BADGE, AC-CTA). Branch wave-7-sourcing-workspace.
- **claimed_task_ids:** [dfa5bd56 (sourcing-workspace page)]
- **Deps:** none new. **Schema:** NONE (reuses wave-6 tables). **Env:** none new (real adapter deferred).
- **Load-bearing (P-4):** AC-SEED (POST /sourcing/connections create, audited, actor=app users.id via getUserWithRole — creates ≥2 fixture connections; B-5+C-2 verify facet against REAL rows); workspace page (replace /sourcing redirect stub) per sourcing-workspace.html; search over canonical deduped universe; trigger-sync = reuse wave-6 POST /sync; hand-off to /sourcing/companies; badges from real connection rows (NOT literal vendor names); repoint Review-and-Import CTA to /sourcing/companies; RBAC analyst; apiFetch(rid).
- **Deferred:** real adapter (345dfbc6, founder vendor+key), in-page dedupe-modal (b9141490).
## Gate verdict log
<appended by head-builder at B-6>
