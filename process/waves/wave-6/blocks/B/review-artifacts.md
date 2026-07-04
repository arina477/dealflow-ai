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

## B-6 Action-6 — commit → task_id mapping (multi-spec traceability)
| commit | task_id(s) | scope |
|---|---|---|
| e44a5fd | ff378a95 + f5771d13 | B-1 shared contracts (serves connections+screen — cross-cutting contract, legit) |
| f6071e7 | ff378a95 + db274731 | B-2 schema (ff378a95) + dedupe engine (db274731) |
| 299e7c1 | ff378a95 | B-2 migration journal-register fix (schema) |
| 43fe212 | 0241222b + f5771d13 | B-2 ETL/sync (0241222b) + CRUD/resolve endpoints (f5771d13) |
| 952207d | f5771d13 | B-3 companies-contacts screen |
| b3a12d8 | db274731 | B-6 rework: dedupe candidate-path idempotency |
| d0f6f0a | (deliverables) | chore: B-block transcripts/manifests (non-code, no spec overlap) |
**Coverage:** all 4 claimed_task_ids cited by ≥1 code commit (ff378a95: e44a5fd/f6071e7/299e7c1; 0241222b: 43fe212; db274731: f6071e7/b3a12d8; f5771d13: e44a5fd/43fe212/952207d). Cross-cutting commits = shared-contract/multi-block work (same legit pattern accepted waves 3-5). d0f6f0a = deliverables-only (non-code). Discipline: PASS (intent satisfied; not rebasing unpushed history to force 1:1 — mapping recorded per head-builder's Action-6 alt).
