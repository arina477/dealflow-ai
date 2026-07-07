verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause CHECK (mandatory): the wave-17 C-2 HOLD surfaced as a symptom
  (migration 0014's audit backfill collided with the WORM BEFORE-UPDATE trigger on
  328 populated prod rows). The proposed fix does NOT chase the symptom (it is not
  "patch trigger 0014" or "special-case that one migration"). The named ROOT CAUSE is
  correct and generalized: migrations are exercised only against an EMPTY CI DB, so
  the class of populated-prod-only failures (WORM-trigger collisions, backfill-vs-
  constraint interactions) cannot fire until deploy. The standing AC — any migration
  touching audit_log_entries or any WORM/append-only table MUST ship a populated-DB
  migration test (seed real rows -> run migration -> assert applies + verifyChain
  ok:true) — moves the detection point upstream to pre-deploy by testing the REAL
  populated shape. That is a cause-layer fix, not symptom theater. No antipattern
  matches: not #4 premature-abstraction (a copy-able test template generalized from
  the already-written AMP-1..5 is 1 concrete instance made reusable, not a speculative
  framework — sound as long as scope stays "template + checklist entry", NOT a
  migration-test DSL); not #6 config-drift; not #7 validation-theater (this validates
  at a real system boundary — the prod migration path — for a failure mode that
  demonstrably HAS occurred). Prior-art check: grep confirms NO promoted principle
  covers this; OBS-W17-3 sits at HOLD and was never promoted, so this wave ESTABLISHES
  the rule (avoids the wave-21 process-theater trap of re-documenting an existing rule).
  Nearest existing rule is T-4 #71 ("An immutable-table mutation trigger rejects the
  cascading update, breaking teardown and CI") — that is a TEST-TEARDOWN rule, distinct
  from a populated-migration-forward-test AC, so the new AC is adjacent-but-genuinely-new.
  ENFORCEMENT (flagged as load-bearing): a standing AC is toothless unless it names
  WHERE/WHEN it is checked. The enforcement home already exists — B-0-branch-and-schema
  (the migration/schema stage) is where the populated-DB migration test obligation must
  be asserted, carried forward as a P-4 spec-contract AC and re-checked at the B-6 build
  gate for any wave whose migration touches a WORM/audit table. P-1/P-2 MUST bind the AC
  to that named checkpoint (B-0 + P-4 AC + B-6 gate) rather than leaving it as a free-
  floating note. design_gap:false is correct — process/testing-infra slice, no UI. This
  is a legitimate M10 compliance-hardening slice: the audit backbone is exactly what
  SOX/FINRA recordkeeping depends on, and a silently-failing WORM migration is a
  compliance-integrity defect, not a cosmetic one. Framing is sound and P-1-sized
  (single seed task: a documented standing AC + a reusable populated-migration test
  template/helper). Proceed to P-1.
sibling_visible: false
