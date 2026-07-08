# Wave 28 checklist — M10 RETENTION policy (light; UI wave; WORM-preserving)
- [x] P-0
- [x] P-1
- [x] P-2
- [x] P-3
- [x] P-4
- [x] B (B-6 APPROVED @bc49595)
- [x] C-1  (APPROVED — CI run 28927123301 GREEN on 775cd67; all 5 jobs green; migration 0020 applied + RLS enforcing in CI; RET-ISO/RET-WORM ran+passed [not skipped]; 0 regressions)
- [x] C-2  (APPROVED — api+web deployed @775cd67; migration 0020 applied to prod; /health version==775cd67 no-mirage; /compliance/retention 404→307; rollback armed; canary skipped [0 users]; ready for T-block)
