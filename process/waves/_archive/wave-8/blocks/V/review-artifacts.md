# Wave 8 — V-block review artifacts
**Block:** V (Verify) · **Wave topic:** mandate spine + create/list/detail — LIVE · **Gate:** V-3 · **Status:** gate-passed
| Stage | Deliverable(s) | Status | Notes |
|---|---|---|---|
| V-1 | stages/V-1-karen.md + V-1-jenny.md + V-1-summary.md | in-progress | seeded |
| V-2 | stages/V-2-triage.md | pending | |
| V-3 | stages/V-3-fast-fix.md | gate-passed | head-verifier APPROVED; CLOSE + redeploy e57be83 (deployed=verified) |
- **Wave topic:** mandate spine + create/list/detail (M4 first bundle), LIVE (46642e7). M4 first-half metric (create a configured mandate) delivered.
- **Deploy note:** core mandate flow LIVE @ 46642e7 (C-2 + T-5 verified: create-via-UI→redirect→detail, derive-disclaimer, 3-acks-server, active-lock, RBAC, audited). T-block fixes (a061c57 3-acks-service-harden [defense-in-depth; normal path was schema-guarded], 1312fb4 hide-button+client-validate) on main @ e57be83, ship next deploy.
- **Fix cycles (all live-confirmed):** B-6 (3 CRIT: PATCH-crash, draft-lock, ambiguous-disclaimer); C-2 (route-collision, jurisdiction-mismatch, advisor-jurisdictions, create-response-shape); T (W8-2 acks-harden, W8-3 hide-button).
- **Deferred:** buyer-universe builder (next M4 bundle).
- **Karen:** APPROVE · **jenny:** APPROVE · **head-verifier V-3:** APPROVED
## Gate verdict log
<appended by head-verifier at V-3>
