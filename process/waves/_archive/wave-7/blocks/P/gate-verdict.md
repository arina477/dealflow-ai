# Wave 7 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, agentId head-product-w7-p4-phase1)
**Reviewed against:** process/waves/wave-7/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
The wave ships the sourcing-workspace page (dfa5bd56) on the wave-6 fixture adapter and completes M3's UX loop — search across ≥2 connected sources → results matrix + detail drawer → connection-level trigger-sync → hand-off to the companies review queue — with acceptance criteria that are observable and falsifiable (a real page at /sourcing behind RBAC analyst/admin with a negative deny test, server-side search over the deduped canonical universe, a sync outcome of {ingested, updated}, and enumerated unhappy paths: no-connections empty state, non-analyst route/API denial, one-row-per-deduped-company). The RESCOPE-AUTO-SPLIT was disposed correctly and I verified its load-bearing premises against the codebase: (1) the real DataSourceAdapter (345dfbc6) is genuinely externally blocked — it requires a vendor spend commitment plus an account-issued provider API key, which is not autonomously completable and is correctly a founder/BOARD decision (rules 6 + 19), correctly deferred as non-blocking; (2) the page is NOT a hollow demo without it — the fixture adapter (apps/api/src/modules/sourcing/adapters/fixture.adapter.ts) is purpose-built so two separate data_source_connections on the same fixture produce cross-source duplicates, so the "search across ≥2 sources" M3 metric is honestly verifiable NOW on ≥2 fixture connections rather than being blocked on the real adapter (mvp-thinner's reasoning holds); (3) reuse discipline is real, not claimed — GET /sourcing/companies already exposes the q (name/domain) and source (connection_id) filters over the canonical `companies` table ("deduped company universe"), and POST /sourcing/connections/:id/sync already exists with analyst/admin RBAC, so the plan reuses the wave-6 ETL/dedupe/sync pipeline and searches the deduped canonical universe (not raw staging, not client-side dedup) — Δ2 is even lighter than the plan estimates since the source filter already exists. The deferred in-page dedupe-modal (b9141490) is correctly redundant with the already-shipped /sourcing/companies review queue where cleaning routes. design/sourcing-workspace.html exists (design_gap=false, D-block skip justified), the /sourcing redirect stub the plan replaces exists as described, no new schema/SDK/secret is introduced, and every AC traces back to the P-0 M3 bet. The founder vendor+API-key decision is correctly surfaced as deferred and non-blocking. The one soft spot — the "empty search → all-companies or a prompt (documented)" AC leaves the choice to B-block — is a benign UX default on a non-compliance surface and does not warrant rework.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---
## Phase 2 — Karen + jenny + Gemini (standard)
**Karen:** APPROVE — all reuse claims VERIFIED (conservative even; source filter + sourceCount already exist; POST /sync idempotent; /sourcing redirect stub to replace; apiFetch+proxy exist; no new SDK/schema/secret). 1 MEDIUM: connection-seeding unspecified (no create path) → carried to spec as a B-acceptance item.
**jenny:** iter-1 APPROVE-conditional — items 1-4/6 MATCH (page↔journey row 12+design, ≥2-source metric honestly fixture-verifiable, split honest [345dfbc6 real-adapter deferred to founder vendor+key, b9141490 modal deferred=redundant with /sourcing/companies review queue], reuse canonical-search + wave-6 POST/sync). 1 drift (item 5): the karen connection-seeding item was prose-only, not enforceable + no B-owner. + 2 low (badges from fixture rows; repoint Review-and-Import CTA).
**Remediation (doc-level):** AC-SEED (POST /sourcing/connections create endpoint, RBAC analyst/admin, audited, actor=app users.id) + contracts.api create/list + positive ≥2-source edge-case → enforceable spec surface; plan Δ0 (backend-developer, B-2 owner) + AC-BADGE + AC-CTA.
**jenny iter-2:** APPROVE — item 5 RESOLVED (enforceable AC-SEED + create endpoint + edge-case; plan Δ0 owns it; 2 low notes captured); no residual.
**Gemini:** UNAVAILABLE (HTTP 429 — degraded, non-blocking).

## Phase 2 Verdict: PASS (Karen APPROVE + jenny APPROVE iter-2 + Gemini UNAVAILABLE-degraded).
**P-block gate: PASSED.** design_gap_flag=false → next block B.

### B-block notes carried from P-4:
1. **AC-SEED (Δ0, backend-developer):** POST /sourcing/connections (create; analyst/admin; AUDITED via M2; actor=app users.id via getUserWithRole) + GET /sourcing/connections (list). Creates the ≥2 fixture connections the ≥2-source view needs. roleRoutes B-1; proxy B-3. B-5+C-2 verify facet against REAL rows.
2. Workspace page /sourcing (replace the redirect stub) per sourcing-workspace.html; search over canonical deduped universe; trigger-sync = reuse wave-6 POST /sync; hand-off to /sourcing/companies.
3. Badges from actual data_source_connections rows (NOT literal PitchBook/Crunchbase); repoint Review-and-Import CTA to /sourcing/companies (no dead deferred-modal CTA).
4. RBAC analyst; apiFetch(rid) mutations; no new schema/SDK/secret (real adapter deferred to the founder vendor+key wave).
