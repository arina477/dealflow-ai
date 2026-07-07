# V-1 jenny — Wave 24 (M10 WORM-migration standing-AC check)

**Verdict: APPROVE** — deliverable matches spec intent (seed fd8f2860 + P-2 SCOPE + MG1). No drift.
**Tally: 6 MATCHES / 0 DRIFTS.**

Reviewed against: P-2-spec.md, P-3-plan.md, worm-migration-testing-policy.md, product-decisions.md (wave-23 N-block M10 disposition L420-427 + BOARD caveats L424). Independently ran the check + self-test + grepped the migration corpus — findings are observed, not inferred from green CI.

## Deliverable inventory (all present, CI-verified @03a710b, run 28863313439 GREEN 5/5)
- `apps/api/scripts/check-worm-migration-tests.ts` — the mechanical classifier + runCheck.
- `apps/api/test/_helpers/worm-migration-coverage-registry.ts` — deterministic coverage registry (5 entries).
- `apps/api/test/_helpers/worm-migration-test-utils.ts` — 2 thin helpers (`seedChainedAuditRows`, `assertVerifyChainOkForRows`).
- `apps/api/test/_helpers/worm-migration-template.ts` — copy-able skeleton (explicitly "do NOT import").
- `apps/api/test/check-worm-migration-tests.spec.ts` — 61-test self-test incl. real-tree runCheck assertion (the CI enforcement point).
- `command-center/testing/worm-migration-testing-policy.md` — the standing AC + policy.

## Check-by-check

**1. Operationalizes wave-17 C-2 HOLD lesson — MATCH.** Policy §"Why empty-CI-DB testing is insufficient" reproduces the exact failure: 0014 Step-3 `UPDATE audit_log_entries SET workspace_id ... WHERE workspace_id IS NULL` vs `audit_log_no_mutate` BEFORE-UPDATE trigger, empty-CI (0 rows match → green) vs 328 populated prod rows (all match → abort). Verified against migration 0014 source (L200-202: DISABLE TRIGGER / UPDATE / ENABLE TRIGGER wrapping). Standing AC (seed rows → migrate → verifyChain ok → invariants) is the direct, consistent operationalization — not a divergent policy.

**2. MECHANICAL not prose (wave-21 lesson) — MATCH.** The check is a real fault-killing CI-enforced guard, not a checklist. Ran it: green 5/5 on current tree. Ran the self-test: 61/61 pass. Self-test is genuinely fault-killing — fixtures assert FAIL for: no-registry-entry (L550), comment-only file / content-empty file → hollow-coverage (L649/L677), missing test file (L698); PASS for the healthy real tree (L760+). The 2 P1 bypasses `/review` caught are each pinned by regression tests: schema-qualified DML (`GRANT ... ON TABLE public.audit_log_entries` — real in 0016 L75; classifier `schemaPrefix` regex L187 + FAULT-KILLING tests L234-294) and hollow-coverage (content/comment-only → FAIL L424-431). Enforcement rides the vitest `runCheck` real-tree assertion inside the spec, caught by vitest glob `test/**/*.{spec,test,e2e-spec}.ts` in the existing CI test job — genuinely load-bearing (not the dropped ci.yml step; PAT-workflow-scope limit correctly worked around, not faked). Consistent with the falsifiability norm.

**3. M10-hardening-not-recordkeeping — MATCH.** Policy doc makes NO claim of M10 recordkeeping progress (grep: zero "M10"/"recordkeeping-artifact-progress" claims — it is a pure testing policy). Consistent with wave-23 N-block disposition (product-decisions L425: "wave-24 is a compliance-HARDENING wave (NOT recordkeeping-artifact progress)") + BOARD caveat #2 (L424): deliverable is additive-read-only over the M2 chain — no HMAC-preimage change, no `audit_log_entries` schema mutation (verified: deliverable is tooling/test/docs only, app bundle unchanged per C-2 NO-OP). No drift.

**4. Template copy-able not a framework — MATCH.** Template header: "Copy this file to apps/api/test/<name>.e2e-spec.ts... Do NOT import from this file — it is a documentation artifact." Helper = 2 thin functions, no DSL/base-class/config-object. Consistent with no-premature-abstraction.

**5. MG1 correct-set + WORM-allow-list — MATCH.** Independently confirmed against the corpus:
- Detected set = exactly {0002, 0012, 0014, 0016, 0017} (ran check; matches grep of forward migrations referencing `audit_log_entries`).
- Row-mutating/structural {0002, 0012, 0014} require full coverage marker; GRANT-only 0016 (`GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.audit_log_entries`, L75) + POLICY-only 0017 (`DROP/CREATE POLICY ON audit_log_entries`, L56-57) require existence-only. Honest classification — GRANT/policy DDL cannot fire the WORM trigger; correctly separated.
- 0018 excluded (only reference is inside a `--` comment, L32) — comment-stripping works. 0003 excluded (zero mention — spec's "0003 comment-only" is slightly imprecise; it is a no-mention, cosmetic-only, not a substantive error).
- Allow-list `WORM_TABLES = ['audit_log_entries']`; `pipeline_events` documented OUT (app-level append-only, no DB trigger → cannot cause wave-17-class collision). Honest and correctly scoped.

**6. Spec-gap / flags → N-block — MATCH.** Both spec FLAGS surfaced + carried in P-0-frame (L18-19): (a) M10 recordkeeping-decomposition ritual due 1-2 waves (M10's 3 candidates all debt/hardening, no purpose-authored recordkeeping vertical); (b) M10 _TBD success-metric founder poll (same class as M9's DUE poll). Both trace to wave-23 product-decisions L424-427. Ready for N-1 re-surface.

## Minor notes (non-blocking, not drift)
- Spec's "0003 comment-only" is imprecise — 0003 has NO audit_log_entries reference at all. Classification outcome (excluded) is correct; wording only. LOW.
- `stripSqlComments` regex-known-limitation (string-literal `--`/`/* */`) is honestly documented in the script header rather than silently accepted — theoretical for the current corpus. Acceptable; no fix needed this wave.

**wrote V-1-jenny.md**
