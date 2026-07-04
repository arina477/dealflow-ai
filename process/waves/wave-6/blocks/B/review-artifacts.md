# Wave 6 — B-block review artifacts
**Block:** B (Build) · **Wave topic:** deal-sourcing data spine (ingest→stage→dedupe→canonical + companies/contacts screen) · **Gate:** B-6 · **Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | branch wave-6-deal-sourcing; no new deps (fixture JSON); schema=YES(0004,7 tables@B-2); 4 tasks claimed |
| B-1 | stages/B-1-contracts.md | done | sourcing types + DataSourceAdapter + roleRoutes /sourcing (e44a5fd); 390 tests |
| B-2 | stages/B-2-backend.md | done | schema+dedupe(cross-source PROVEN)+fixture-ETL+audited-resolve (f6071e7,299e7c1,43fe212); 247 tests |
| B-3 | stages/B-3-frontend.md | done | companies-contacts screen at /sourcing/companies (952207d); 179 tests |
| B-4 | stages/B-4-wiring.md | done | repo typecheck+build PASS; 0004 journal-registered |
| B-5 | stages/B-5-verify.md | done | lint 0-err, 816 tests, build pass; cross-source-dedup test; runtime→C-2 |
| B-6 | stages/B-6-review.md | pending | head-builder gate + /review |

## Block context
- **Spec:** seed ff378a95 (multi-spec 4 blocks + P-4 remediation addendum: 7 tables incl. contact_provenance, normalized_domain unique, reconcile). Branch wave-6-deal-sourcing.
- **claimed_task_ids:** [ff378a95 (connections+adapter+schema), 0241222b (ETL+sync), db274731 (dedupe engine), f5771d13 (companies-contacts screen)]
- **Deps:** none new (fixture JSON adapter; no CSV parser; real provider SDKs deferred). **Schema:** YES — additive migration 0004 (7 tables: data_source_connections, raw_companies, companies, contacts, company_provenance, contact_provenance, dedupe_candidates + normalized_domain partial-unique). **Env:** none new this wave (provider creds env-only, but fixture adapter needs none).
- **Load-bearing invariants (P-4):** staging→canonical two-tier; idempotent ETL upsert (UNIQUE(connection_id,source_record_id)); deterministic dedupe (normalize domain/name/email, auto-merge strong / review-queue ambiguous); cross-source dedup→1 canonical + provenance BOTH (+ contact_provenance); idempotent (normalized_domain partial-unique backstop); provider secrets env-only (NO secret col); dedupe-RESOLUTION audited (M2); RBAC analyst on /sourcing/*; fixtures MUST have cross-source dups.
- **Screen:** view/filter/clean ONLY (NO manual-create this wave). Repoint /companies→/sourcing/companies + UPDATE rbac.test.ts.
## Gate verdict log
<appended by head-builder at B-6>
