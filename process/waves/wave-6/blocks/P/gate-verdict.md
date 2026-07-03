# Wave 6 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, agentId head-product-w6-p4)
**Reviewed against:** process/waves/wave-6/blocks/P/review-artifacts.md
**Attempt:** 1
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale

The wave-6 P-block delivers a clean vertical slice of the deal-sourcing data spine (M3 first bundle) with falsifiable, machine-checkable acceptance criteria across all four blocks. The load-bearing hard part — dedupe correctness — is specified to the standard this compliance-first product demands: deterministic normalization (domain/name/email), an explicit auto-merge threshold (exact normalized-domain OR exact normalized-name), ambiguous matches routed to a `dedupe_candidates` review queue rather than auto-merged, provenance preserved via `company_provenance` with a `UNIQUE(company_id, raw_company_id)` idempotency backstop, and cross-source dedup as the primary correctness case. Critically, the P-0 watch-item — sandbox fixtures MUST carry cross-source duplicates so the merge path is exercised rather than shipping happy-path green — is genuinely embedded in three places: the block-3 acceptance criterion, P-3 Delta 2, and file-step #11 (the fixture file is a build deliverable with the cross-source-dup constraint inline and asserted by a dedicated dedupe test). The two-tier staging-vs-canonical model is correct (`raw_companies` source-of-record with idempotent upsert key; `companies`/`contacts` as deduped truth; ETL writes ONLY staging, dedupe owns promotion). Secrets posture is right and testable — `provider_key` name only, NO secret column, env-by-key resolution, grep-asserted. Scope is appropriately thin and not over-engineered: synchronous on-demand sync with no queue/worker is correctly justified against `databases.md` open-item #6, and real provider SDKs, scheduled sync, enrichment, and the sourcing-workspace page are all deferred (all three P-0 reviewers PROCEED; mvp-thinner no-thin, pre-thinned bundle). RBAC=analyst on the sourcing routes traces to journey row 13 (verified: `/companies`, persona Analyst, flow F9 data-quality), nav⊆RBAC holds by construction via the `roleRoutes` single source, and admin reaches resolve/edit APIs without a nav item (journey-faithful). Auditing the human dedupe-candidate resolution (which alters canonical truth) via the M2 AuditService in-transaction — while deliberately NOT auditing mechanical ETL upserts or deterministic auto-merges — is the correct, low-noise, compliance-meaningful call. Every AC maps to at least one build step (P-3 self-consistency sweep CLEAN). Two conditions attach to the pass (below); neither blocks the gate.

## Conditions attached to APPROVED (carry into B-block, non-blocking)

1. **data-engineer catalog-gap: substitution ACCEPTED — route dedupe correctness to `postgres-pro` primary.** `data-engineer` is genuinely absent from `command-center/AGENTS.md` (line 70 = `backend-developer` universal executor; line 91 names the installed per-stack executors `postgres-pro`/`react-specialist`/`nextjs-developer`/`typescript-pro` — no `data-engineer`). I am NOT requiring an agent-creator install. Rationale: this wave's dedupe is deterministic, rule-based, fixture-fed, synchronous promotion — normalize-and-match SQL + NestJS service/transaction logic. It exercises none of a `data-engineer`'s differentiators (pipeline orchestration at scale, streaming, warehouse/dbt/Spark modeling). The load-bearing correctness surface is exactly `postgres-pro`'s domain: the `normalized_domain`/`normalized_name` match indexes, the two idempotency UNIQUEs (`raw_companies(connection_id, source_record_id)`, `company_provenance(company_id, raw_company_id)`), and promote-if-absent semantics. **Binding routing condition for B-block:** dedupe/ETL correctness (P-3 steps #12/#13/#14) routes to `postgres-pro` as primary on the match-key + index + idempotency logic, with `backend-developer` on service/transaction wiring — matching P-3's own substitution note. Do NOT route the dedupe correctness piece to a bare generic executor. Installing `data-engineer` would add process cost for zero correctness gain.

2. **`dedupe_candidates` shape drift vs databases.md — documented, acceptable.** The spec models `dedupe_candidates` as raw→canonical (`raw_company_id`, `matched_company_id`), whereas the `databases.md` inventory sketch is pairwise (`entity_a_id`, `entity_b_id`). This is the correct model for a staging→canonical promotion pipeline (candidate = "this raw record may be this canonical company"), not pairwise entity-merge, and P-3 Action 2 reconciles it as as-built. Flagging for jenny to confirm as intentional drift in Phase 2 (it is not silent — P-3 documents it).

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

---
## Phase 2 — Karen + jenny + Gemini (standard — no security-scope tightening; external-party data)
**Karen (load-bearing claims):** APPROVE-conditional — all buildability claims VERIFIED vs real code (idempotent upsert onConflictDoUpdate [Drizzle 0.45.2, first-use in repo → idempotency test load-bearing]; deterministic cross-source dedupe + provenance + idempotency buildable; cross-source-dup fixture is a real step; env-only secrets no-column; ZERO new deps [fixture JSON, no CSV parser]; additive 0004 per 0002/0003 precedent; specialists exist). Findings: HIGH schema-vs-databases.md divergence (undeclared); MEDIUM no normalized_domain unique backstop; MEDIUM cross-source-dup test must land non-happy-path; LOW data-engineer catalog + rbac.test edit + onConflict first-use.
**jenny (spec-vs-architecture drift):** iter-1 BLOCK — HIGH schema divergence is 90% defensible-evolution (staging tier/dedupe keys/sync_runs-defer/enabled-only supersede the databases.md SKETCH + still satisfy consumers) BUT (i) procedural miss (undeclared, not a Delta + reconcile) + (ii) SUBSTANTIVE: contact-level provenance LOST (principle-3 invariant; feature #9 consumer). Blocks 2-5 MATCH.
**Remediation (doc/schema-decision, no rebuild):** Delta 0 declaring the 5 divergences + databases.md as-built reconcile + product-decisions entry; **contact_provenance table ADDED** (principle-3 contact lineage preserved — the substantive fix); normalized_domain partial-unique backstop added (karen MEDIUM); rbac.test edit named; manual-create out-of-scope; cross-source-dup dedupe test = T requirement. Data-engineer gap resolved (Phase-1: postgres-pro+backend-developer substitution accepted). P-3 body count threaded to 7 tables.
**jenny iter-2:** APPROVE — all 4 findings RESOLVED (divergences declared + reconciled; contact_provenance preserves principle-3; normalized_domain backstop; rbac.test named + manual-create out). (Residual low: P-3 body 7-tables threading — done post-verdict.)
**Gemini:** UNAVAILABLE (HTTP 429 — degraded, non-blocking).

## Phase 2 Verdict: PASS (Karen APPROVE-conditional [conditions met by remediation] + jenny APPROVE iter-2 + Gemini UNAVAILABLE-degraded).

**P-block gate: PASSED.** design_gap_flag=false → next block B.

### B-block execution notes carried from P-4:
1. Schema = 7 tables (migration 0004): data_source_connections (provider_key→env, NO secret col), raw_companies (staging, UNIQUE(connection_id,source_record_id)), companies (+ partial-unique normalized_domain WHERE not null), contacts, company_provenance, **contact_provenance** (principle-3 contact lineage — DO NOT drop), dedupe_candidates (status). Additive + down. Reconciled in databases.md.
2. Idempotent ETL upsert (onConflictDoUpdate — first-use in repo, test load-bearing); writes staging only.
3. Dedupe: deterministic (normalize domain/name/email), auto-merge on strong match, ambiguous→dedupe_candidates review, cross-source→1 canonical + provenance BOTH (+ contact_provenance), idempotent. dedupe-candidate RESOLUTION audited (M2 AuditService, sourcing-dedupe-resolve action).
4. Fixture adapter (JSON, no new SDK); fixtures MUST contain cross-source duplicates (T-block non-happy-path dedupe test = requirement).
5. Screen /sourcing/companies (RBAC analyst): view/filter/clean (resolve dedupe-candidate, edit canonical) ONLY — NO manual-create this wave (stub/omit design's +add buttons). Repoint /companies→/sourcing/companies + UPDATE rbac.test.ts.
6. Specialists: postgres-pro (schema+dedupe correctness primary) + backend-developer (ETL/service wiring) + nextjs-developer (screen) + typescript-pro (contracts).
7. T: T-8-lite (secret-handling grep — no secret in-DB); NOT full security-scope gate.
