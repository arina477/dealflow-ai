verdict: REFRAME
verdict_source: problem-framer
matched_antipatterns: [4, 3]
symptom_vs_cause: |
  MANDATORY CHECK (run, cited even though not the primary verdict driver):
  Symptom stated across waves 18-20 = "V/T could never do a REAL authed live check;
  it was deferred every wave." Proposed seed treats this as 4 co-equal process-hardening
  items (B/C/D/E) to author artifacts for. Root cause of items B/D/E is already fixed at
  the principle layer (PRODUCT #1); root cause of C is a MISSING policy, not a missing
  process doc. So 3 of 4 items are symptom-layer re-work of an already-cured cause, and
  the 1 real residue (C) needs its cause named precisely (see below).

reasoning: |
  Reframe crux CONFIRMED. PRODUCT-PRINCIPLES.md rule #1 (verbatim, line 72) reads
  "A spec metric shown to users must have a real source column [=B], not be noise by
  construction [=D], and qualify low-n cases [=E]." It was promoted at wave-19 L-2 and
  is enforced at P-2/P-4. Items B, D, E are therefore DONE-BY-PRINCIPLE — authoring more
  process artifacts for them is snacking / premature-abstraction process-theater
  (antipattern #4). The wave's substantive residue is (C) ONLY.

  (C) is genuinely NOT captured by any existing principle. Grep of VERIFY-PRINCIPLES,
  test-layer-principles T-1..T-9, and test-writing-principles found the prod-fixture
  MECHANISM (test-writing-principles §21 "test every persona incl. authed roles", §22
  "use prod fixtures from test-accounts.md; never dev-seed against prod auth", §24
  executed-count-not-pass-count, and the test-accounts.md registry with advisor/analyst/
  compliance/admin persona slots) — but NO rule covering the case the registry is EMPTY /
  cannot be populated. The registry is an unfilled template shell (every field reads
  "_(populate)_"; project.yaml local_dev: []). The real deferral cause is that no authed
  advisor+admin fixture was ever provisioned AND SuperTokens creds are not committable
  (rule 2; registry is gitignored). §21/§22 ASSUME a populated registry and do not resolve
  the empty-registry → what-is-authoritative gap. That gap is C's true cause.

  On the (a) vs (b) fork for C: the sound causal fix is (b) — formally DECLARE
  CI-e2e-as-authoritative-for-isolation/RBAC + document the deferral rationale as a
  VERIFY/testing-principles artifact. Option (a) real prod-cred provisioning is a
  demo-path/over-build with a security constraint (antipattern #3 + rule 2): committable
  advisor+admin SuperTokens creds cannot exist (gitignored registry, no-secrets-in-repo),
  compliance_regime is "none", and this is a pilot/self-use build with 0 real DAU — so
  standing up live prod fixtures buys little and risks a credential-handling surface. The
  causal fix is the policy declaration + a one-line durable principle, not infrastructure.

proposed_reframe: |
  Re-scope the wave from "author 4 process-hardening artifacts (B/C/D/E)" to a LIGHT
  process/docs wave with exactly two moves:

  1. CLOSE B, D, E by-principle. Record in P-0 discover section that PRODUCT-PRINCIPLES
     rule #1 already supersedes them (real source column / not-noise / qualify low-n).
     Author NO new process artifact for B/D/E — doing so is a discipline violation
     (near-dup of an enforced rule; L-2 authoring-discipline "grep before add, no near-dup").

  2. Scope C to the sound causal fix ONLY: formally declare CI-e2e authoritative for
     cross-tenant isolation + RBAC verification for as long as no committable authed prod
     fixture exists, and document the deferral rationale. Concretely:
       - Add ONE durable rule to VERIFY-PRINCIPLES (or test-writing-principles) of the
         shape: "When no committable authed prod fixture exists, CI e2e (real-role, real
         DB) is the authoritative isolation/RBAC gate; live prod checks cover unauthed
         gating only, and the deferral is recorded." (final wording is L-2/karen's job,
         must pass the Contract-for-new-rules linter — this P-0 only fixes the framing).
       - Record the CI-e2e-authoritative decision + deferral rationale in
         command-center/product/product-decisions.md (append-only).
     Do NOT provision real prod SuperTokens creds this wave (security + no-commit
     constraint); if fixtures ever become committable, revisiting is a future wave.

  Wave shape after reframe: docs/process only — no product code, no migration, no UI.
  D-block SKIP (design_gap = false; confirm at P-1). Likely a single-task wave; the seed
  1d95cac0 narrows to the C policy artifact. This is LIGHT by design and correctly so —
  not over-scoped. Flag for P-1: if after closing B/D/E the residue is a single
  policy-declaration task, do not pad it back to 4 tasks.

escalation_reason: |
  n/a — recoverable at P-0. No product-decisions.md contradiction and no live founder_bet
  conflict detected; the CI-e2e-authoritative call is a testing-policy default (rule 17
  engineering-default territory), not a Tier-3 founder poll.

sibling_visible: false
