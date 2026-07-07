# V-1 — jenny (semantic spec-vs-deployed verification)

**Wave:** 18 (M9 advisor-insights analytics) · **Stage:** V-1 · **Reviewer:** jenny
**Deployed LIVE @5c86cf5** (api dealflow-api-production-66d4 · web dealflow-web-production-a4f7)
**Authoritative spec:** seed task `a5ba8068-2e1b-48ea-83d9-6da739a41e2b` `tasks.description` (DB), incl. `## P-4 PHASE-2 KAREN CORRECTION`.

## VERDICT: APPROVE

Deployed behavior matches the spec-contract INTENT beyond the literal ACs. Every load-bearing invariant (workspace-scoped analytics isolation, F2 honest gate-outcomes, read-only, RBAC-scoped, empty-state-safe, no gold-plating) is present in the deployed code and corroborated by live probes + the authoritative C-1 CI evidence. **7 findings: 0 drift / 3 gap / 4 confirm-clean.** No REJECT-worthy drift. Gaps are documentation/process + spec-anticipation items for next-wave P-2, not deployed-behavior defects.

---

## Verification evidence (each: spec section → deployed behavior)

### 1. Isolation INTENT (post-M8) — CONFIRM CLEAN
**Spec:** seed prose "THE LOAD-BEARING INVARIANT (post-M8): every analytics read is WORKSPACE-SCOPED via getDb + the `app.workspace_id` GUC + FORCE RLS — a firm sees ONLY its own analytics"; AC-2 "EVERY aggregation query runs through the request-scoped `getDb(this.db)` handle … NO raw off-GUC/module-singleton query."
**Deployed:** `apps/api/src/modules/analytics/analytics.repository.ts` — ALL FOUR family queries (`getMandateThroughput` L64, `getOutreachGateOutcomes` L100, `getAdvisorProductivity` L144/L153, `getMatchDisposition` L199) use `getDb(this.db)`. Zero raw `this.db` query calls; the header comment (L6-17) documents `this.db` as fallback-only for non-request contexts (not served by this repo). Service layer (`analytics.service.ts`) holds no DB handle — isolation enforced structurally at the repo layer.
**Proof:** `apps/api/test/analytics-isolation.e2e-spec.ts` is a REAL-service test (not hollow inline SQL — B-6 rework): invokes the actual `AnalyticsService` via `workspaceAls.run` with a `dealflow_app` (NOSUPERUSER FORCE RLS) GUC-bound handle. AMP-1 F1-F4 assert WS_A counts correct + WS_B rows excluded (secondary raw-SQL confirms WS_B count == 0 under WS_A GUC); AMP-4 is genuinely fault-killing (no-ALS total ≠ ALS-scoped total — a `getDb→raw this.db` regression flips the strict inequality and fails automatically). CI run `28832010151` conclusion=**success** @headSha 5c86cf5 (matches deployed tip); C-2 records e2e 7/7 as dealflow_app. Live: `/health` 200 `{db:ok}` ⇒ app connects as `dealflow_app` (RLS-scoped, not superuser/bypass). A 2-workspace live test is impossible with one prod firm — the CI e2e is authoritative per plan. **Deployed behavior matches the isolation intent: no cross-firm analytics leak path exists.**

### 2. F2 = gate-outcomes (the Karen correction) — CONFIRM CLEAN
**Spec:** `## P-4 PHASE-2 KAREN CORRECTION` — "response rate" is UNCOMPUTABLE (outreach.status enum = compose|send_eligible|blocked; pre-send gate, no send/responded columns; send is #141-founder-gated). Corrected F2 = "outreach compliance-gate outcomes": send-eligible pass-rate = count(send_eligible)/count(total), blocked-rate = count(blocked)/count(total), total=0 guarded; relabel honestly "compliance-gate pass rate"/"blocked rate", NOT "response rate."
**Deployed:** repository `getOutreachGateOutcomes` (L99-124) computes `gatePassRate = totalSendEligible/total` and `blockedRate = totalBlocked/total` over `outreach.status`, with `total>0 ? … : null` div-by-zero guard. Shared contract `packages/shared/src/analytics.ts` (L61-72) names fields `gatePassRate`/`blockedRate` (nullable), NAMING CONTRACT comment explicitly forbids `responseRate`. UI (`insights/page.tsx` L319-364) labels the card "Outreach Compliance-gate Outcomes" with "Compliance-gate pass rate"/"Blocked rate", null→"n/a". Unit test `analytics.spec.ts` B-2 asserts field names ARE gatePassRate/blockedRate and NOT responseRate. **No fabricated vanity metric anywhere in the deployed stack. Consistent with the M6 pre-send-gate design (no send, #141-gated).**

### 3. Read-only over existing data vs CRM deferral — CONFIRM CLEAN
**Spec:** AC-1 "aggregates 4 metric families from ALREADY-LIVE tenant data"; hard_boundaries "read-only analytics over EXISTING data … NO CRM adapter (345dfbc6 founder-gated)."
**Deployed:** repo reads only shipped tables — `mandates`, `outreach`, `pipeline`, `matchCandidates` (imports L40-43). ZERO writes (no INSERT/UPDATE/DELETE; no audit row on read — L19-22 comment + service L13-15). No CRM/`DataSourceAdapter` import anywhere in the analytics module. C-2 live: `/compliance/audit-log/verify` → 401 (not 500) ⇒ read-only analytics deploy did not touch the HMAC chain. **No drift; CRM stays founder-gated + deferred.**

### 4. /insights new page vs journey map — SPEC-GAP (documentation lag, NOT deployed-behavior defect)
**Spec:** item #4 — the journey map needs the /insights + /analytics routes (T-9 regenerated); additive, no collision.
**Deployed:** `/insights` page live (web / → 307, /insights → 307 login-redirect, route registered on new build); `GET /analytics` mounted (anon → 401 not 404); RBAC route entries added in `packages/shared/src/rbac.ts` (`/insights` advisor+admin+NAV_INSIGHTS L637-640; `/analytics` advisor+admin L646-647, non-colliding proxy path). Additive, no route collision — correct.
**GAP:** the canonical `command-center/artifacts/user-journey-map.md` was NOT regenerated with the new routes — `grep` finds NO `/insights` or `GET /analytics` entry; L126 still reads "analytics … deferred — not in this MVP inventory"; last journey-map commit is wave-14/16 (`d169a5f` wave-14). The T-9 stage file (`stages/T-9-journey.md`) DOES document the delta (/insights + GET /analytics + nav entry + security coverage) and head-tester APPROVED, but that delta never landed in the canonical artifact. Deployed product is correct; the T-5-consumed inventory is stale. **Classify: spec/process-gap (T-9 canonical-artifact write skipped), severity Low — surface for next-wave P-2 / L-block, no code impact.**

### 5. No gold-plating — CONFIRM CLEAN
**Spec:** AC (task 4b014689) + ceo-reviewer HOLD-SCOPE — "NO charts library, NO real-time/websocket, NO export."
**Deployed:** `insights/page.tsx` renders design-system zinc/emerald metric cards + plain HTML tables (no recharts/chart.js/d3 import — grep clean); SSR fetch (`force-dynamic`, no-store) — no websocket/polling; no export/download affordance. `P-3-plan.md` deps_new=[], no charts lib. **Consistent with ceo-reviewer HOLD-SCOPE + pilot-scope discipline.**

### 6. RBAC-scoped analytics — CONFIRM CLEAN
**Spec:** AC (9e05828b) "RBAC-scoped — advisor sees firm analytics; non-permitted role → 403, anon → 401"; item #6 advisor+admin own-firm, 403 analyst/compliance, 401 anon, DB-authoritative RBAC.
**Deployed:** controller `analytics.controller.ts` `@UseGuards(SessionGuard, RolesGuard) @Roles(...ANALYTICS_ROLES)` where `ANALYTICS_ROLES = rolesForRoute('/analytics')` = `['advisor','admin']` (rbac.ts L646-647); fail-closed at boot if RBAC config drifts to [] (L40-45). Unit test `analytics.spec.ts` C: analyst→403 (`ForbiddenException` L253-256), + anon→401 coverage. LIVE: anon `GET /analytics` → **401** (SessionGuard fail-closed, route mounted), anon web `/insights` → 307 login-redirect; page-level `assertRole('/insights', me.role)` redirects non-permitted roles (page.tsx L206). Roles resolved from the shared DB-authoritative RBAC map. **Consistent with DB-authoritative RBAC; 200(advisor/admin)/403(analyst,compliance)/401(anon) enforced server-side.** (Live authed 200-with-4-families deferred to T-5/T-8 per C-2 — no prod fixtures this pre-first-prod-test wave; CI analytics.spec 15/15 + isolation e2e 7/7 is authoritative. Not fabricated — I did NOT establish a prod authed session; unauthed gating verified live, authed proof relies on CI.)

### 7. _TBD success metric — CONFIRM CLEAN
**Spec:** seed prose "M9 quantitative success metric stays founder-TBD (poll before M9 close, not a build hard-stop)."
**Deployed:** the wave built to the qualitative intent — advisors see mandate-throughput + gate-outcome + productivity + match-disposition analytics (the 4 families all live). No quantitative-target gating in the build; the founder-TBD metric is a pre-M9-close poll, not a deployed hard-stop. **Consistent with prior _TBD handling (M8/M5/M6 all shipped against qualitative intent with the quantitative metric deferred to a founder poll).**

---

## Spec-gap detection (for next-wave P-2)

- **GAP-A (Low, process):** T-9 did not regenerate the canonical `user-journey-map.md`; the /insights + GET /analytics routes are documented in the stage file but missing from the T-5-consumed canonical inventory (L126 still marks analytics "deferred"). The T-9 canonical-artifact write is a recurring risk — surface at L-block / next P-2 so the inventory doesn't drift from production. NOT a deployed-behavior defect.
- **GAP-B (Info, spec-anticipation):** The DB AC-1 literal text still reads "outreach response rates (sent vs responded ratio)" and the `contracts`/`edge-cases` still say "response-rate" — the P-4 Phase-2 Karen correction OVERRIDES this in an appended section rather than editing the ACs in place. Deployed code correctly follows the correction (F2=gate-outcomes), so this is spec-internal tension, not drift. Next P-2 should author F2 as gate-outcomes from the start (the spec-contract didn't anticipate that "response rate" was uncomputable under a pre-send-gate product until Phase-2 review caught it).
- **GAP-C (Info, spec-anticipation):** The live-authed 200-with-4-families verification was deferred to T-5/T-8 because prod fixtures don't exist this pre-first-prod-test wave (`test-accounts.md` unpopulated). The spec-contract assumed live-authed verifiability; next P-2 should either provision prod fixtures earlier or explicitly declare CI-e2e-as-authoritative up front so the deferral isn't a per-wave rediscovery.

## Scope of my verification (honesty note)
I did NOT establish a prod authed advisor/admin session (invite→signup not attempted; dev-seed creds must not hit prod auth). I verified unauthed gating LIVE (anon /analytics 401, web /insights 307, regression /mandates /outreach /pipeline 401, /health db:ok @5c86cf5), read the deployed source at the deployed tip, and relied on the C-1 CI evidence (run 28832010151 success @5c86cf5; analytics-isolation e2e 7/7 + analytics.spec 15/15 per C-2) as the authoritative 4-family / RBAC-200-403-401 / F2-gate-outcomes / cross-firm-exclusion proof — consistent with the C-2 deferral rationale. No authed results fabricated.
