# Wave 7 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId head-builder-w7-b6)
**Reviewed against:** process/waves/wave-7/blocks/B/review-artifacts.md
**Attempt:** 1

## Verdict
APPROVED

## Rationale
This reuse-heavy, single-spec page wave (sourcing-workspace) cleanly discharges the P-4 remediation acceptance surface (AC-SEED, AC-BADGE, AC-CTA) and preserves the compliance and reuse invariants I gate hardest on. AC-SEED is correct end-to-end: `POST /sourcing/connections` inserts a `data_source_connections` row inside a transaction where `AuditService.append(action='sourcing-connection-create')` runs in the same tx (audit failure rolls back the INSERT — verified in `sourcing.service.ts:100-140`), the actor is translated from the SuperTokens session id to the app `users.id` via `getUserWithRole` and that app id (never the raw ST id) is written to `createdBy` and the audit `actorUserId` (the wave-5 FK lesson, enforced by `.not.toBe(MOCK_ST_USER_ID)` regression assertions), and RBAC is fail-closed (analyst/admin ALLOW, advisor/compliance 403, anon 401, plus boot-time empty-role-set assertions). The ≥2-source view is backed by REAL rows, not a false-green: `listConnections` computes `companyCount` via `count(distinct company_provenance.companyId)` and the `SourceFacet` renders one button per real connection with that count; B-5 unit-proves the facet against mocked ≥2 connections and the spec's own AC-SEED addendum explicitly defers the live-DB-rows verification to C-2 (correct layering, not coverage theater). AC-BADGE renders badges/facets from real `connection.displayName` (the design mock's PitchBook/Crunchbase appear only in explanatory comments, never as shipped claims — grep-confirmed). AC-CTA points the floating Review-Import bar and the DetailDrawer footer to `/sourcing/companies` (the wave-6 dedupe queue); no in-page dedupe modal ships (deferred b9141490). Reuse discipline holds: search hits `GET /sourcing/companies` server-side with filters (canonical deduped universe, not client dedup or raw staging), trigger-sync reuses the wave-6 `POST /connections/:id/sync` untouched, and the workspace replaces the `/sourcing` redirect stub via an `afterFiles` proxy that only catches `/sourcing/connections` (the page file exists, so `/sourcing` is never hijacked). Split honesty is intact — the real `DataSourceAdapter` (345dfbc6) is not in the diff and no new SDK/schema/migration/secret/package.json is touched (diff-stat confirmed). Contracts are `.strict()` Zod with `z.infer` and `.safeParse` at every boundary, living in `@dealflow/shared`. Tests carry semantic weight (RBAC matrix, in-tx audit, actor-id regression, ≥2-source facet, sync-trigger endpoint URL, CTA href, create-then-list) rather than syntax-only execution. All 3 commits cite the single claimed task_id (dfa5bd56). No over-engineering: the create endpoint and repository are minimal and procedural.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---
## Phase 2 — /review (adversarial)
Found 2 CRITICAL + 3 info (actor-id/audit/apiFetch/search/SSR-handling verified clean):
- **CRITICAL AC-BADGE hollow** (workspace reads company.connectionIds but GET /sourcing/companies returned only numeric sourceCount → every badge '—') → FIXED (57d79bc): listCompanies returns connectionIds[] per company (distinct connection_id via provenance); web already consumes it. Tests: 1-connection + cross-source-2.
- **CRITICAL providerKey unvalidated → 500** (create persists unknown key → sync 500s forever) → FIXED: validate against adapterRegistry at create (400 unknown) + sync 'no adapter' → BadRequestException. Tests.
- INFO dup connections inflate ≥2-source signal → FIXED: UNIQUE(display_name) migration 0005 (journal-registered, wave-6 lesson) + 409 on dup.
- INFO companyCount optimistic-drift (adds ingested) + admin-RBAC-vs-page → carry to V-2 (low, non-blocking).
Fix commit 57d79bc. Re-verify: repo typecheck clean, lint 0, tests pass (+ connectionIds, providerKey-400, dup-409 regressions), build pass. 2 CRITICALs encoded as regression tests → re-review satisfied.

## Action 6 — commit-discipline (single-spec): all commits cite dfa5bd56.
## Phase 2 Verdict: PASS. **B-block gate: PASSED** (head-builder APPROVED + /review 2 CRIT fixed). → next block C.
