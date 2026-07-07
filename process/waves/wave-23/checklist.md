# Wave 23 checklist — M9 seller-intent vertical
- [x] P-0
- [x] P-1
- [x] P-2
- [x] P-3
- [x] P-4
- [x] B-block (B-0..B-6 APPROVED @854bad5)
- [x] C-1 PR/CI/merge — PASS (run 28858565829 conclusion=success @6c22919; 5/5 jobs green; seller-intent-isolation.e2e 3 tests + scorer.spec 26 tests RAN+GREEN; audit gate exit 0; 2nd Actions hard-stop founder-cleared)
- [x] C-2 Deploy & verify — PASS (both services @6c22919 SUCCESS, meta.commitHash verified; /health 200 version==tip db:ok; /seller-intent anon 401 mounted; /insights 307; audit-log/verify 401 intact; rollback armed @86ddc29; canary skip 0 DAU; NO migration)
- [x] L-1 Docs — COMPLETE (CHANGELOG 0.21.0 seller-intent, lines 3-18; M9 delta {in_progress→in_progress, 17 done/1 blocked/0 buildable — buildable EXHAUSTED, stays open on blocked CRM 345dfbc6}; README skip [additive /insights read, no new env/quick-start/CLI]; N-block flags: M9-buildable-exhausted→M10-promotion + M9 _TBD success-metric poll DUE)
