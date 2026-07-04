# Wave 8 — B-block review artifacts
**Block:** B (Build) · **Wave topic:** Mandate data spine + create/list/detail (M4 first bundle) · **Gate:** B-6 · **Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | branch + 3 tasks + migration 0006 (journal when>0005 ✓) |
| B-1 | stages/B-1-contracts.md | done | shared mandate Zod + rbac /mandates+NAV + audit actions |
| B-2 | stages/B-2-backend.md | done | MandateService one-txn+audit+actor-id+derive-disclaimer+3-acks; RBAC matrix; 787 tests |
| B-3 | stages/B-3-frontend.md | done | 3 pages (list+new+detail SSR-hydrate); D1-D6; 304 web tests (c430bbd) |
| B-4 | stages/B-4-wiring.md | done | repo typecheck+build PASS; 3 routes compile |
| B-5 | stages/B-5-verify.md | done | lint 0-err, ~1091 tests, build pass; runtime→C-2 |
| B-6 | stages/B-6-review.md | pending | head-builder gate + /review; multi-spec commit-per-spec |
## Block-specific context
- **Spec contract:** tasks row ba0edebf (multi-spec, 3 blocks + P-4 D1-D6 addendum). Branch wave-8-mandate-spine.
- **claimed_task_ids:** [ba0edebf (spine), c070ca23 (list), 50227055 (detail)]
- **Schema changes:** migration 0006 — mandates (+ seller_geo, seller_size_band), mandate_buyer_criteria, mandate_compliance_profile (disclaimer_template_id FK + suppression_scope scalar + acknowledgments).
- **Deps/env:** none new.
- **Load-bearing (P-4):** one-txn 3-table create + audit-last-in-txn + actor=app users.id (getUserWithRole); DERIVE disclaimer_template_id from jurisdiction (D2, no-match→400); require 3 acknowledgments (D5, else 400); DrizzleError-unwrap; migration 0006 journal `when` > 0005 (BUILD rule 4); mandate-detail SSR-hydrated + deferred placeholders (D6); read-schema z.string(); apiFetch rid. RBAC advisor(create)/analyst(read).
- **multi-spec commit-per-spec:** each commit cites one of ba0edebf/c070ca23/50227055.
## Gate verdict log
<appended by head-builder at B-6>
