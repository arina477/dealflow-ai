```yaml
verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  All five wave-16 tasks are root-cause fixes, not symptom patches, and cohere as a
  single "finish + harden the shipped M7 admin surface" slice — each closes a concrete
  jenny V-2 follow-up on the vertical wave-15 already shipped. Symptom-vs-cause check
  (mandatory) passes cleanly: task 1 is the highest-value item and is framed at the
  cause layer — code-verified below, workspace_settings defaults are genuinely inert
  because MandateService never reads them. No antipattern in the universal catalog
  matches; the fallback catalog is in force because PRODUCT-PRINCIPLES.md § Antipatterns
  is still empty. Two soft notes below do not rise to a REFRAME verdict; they are AC-shaping
  guidance for P-1/P-2, not wrong-problem framings.

symptom_vs_cause_check: |
  MANDATORY — run and cited even though verdict is PROCEED.

  Task 1 (cascade wire) — ROOT CAUSE, not symptom. Verified in code:
    - apps/api/src/modules/admin/workspace-settings.service.ts lines 9-14 assert a cascade
      "via MandateService reading workspace_settings" — this is a documented-but-unbuilt claim.
    - apps/api/src/modules/mandate/mandate.service.ts createAsActor (lines 88-187) never
      reads workspace_settings: jurisdiction is taken from input.compliance.jurisdiction
      (line 118) and REQUIRED to derive the disclaimer (lines 116-125, 400 if absent);
      suppressionScope is input.compliance.suppressionScope ?? null (line 152);
      disclaimerTemplateId is derived from jurisdiction, never from default_disclaimer_template_id.
    - Conclusion: firm defaults persist but are consumed by NOTHING. This is a half-built
      wave-15 feature, and on a compliance-first product "admin sets firm compliance defaults
      that silently do nothing" is a genuine defect. Fixing it at mandate-create fall-back is
      the correct cause layer. Highest-value of the five. Confirmed as framed.

  Task 2 (admin nav link) — cause is correct (orphaned route, URL-only reachable). Surface-layer
    fix IS the cause layer here; no deeper problem hides behind it.

  Task 3 (duplicate invite → 409/idempotent) — NOT tunnel vision. The DB unique index
    (users_email_unique) already nets the account, so the risk is not data corruption but an
    unmet AC + poor admin UX (unbounded duplicate invites, ambiguous response). Framed at the
    right layer (invite endpoint contract). See note-2 for the one adjacent question P-2 should
    resolve.

  Task 4 (reactivate/undo soft-deactivate) — cause is "deactivate is one-way," a real
    lifecycle gap on a soft-delete already in the schema. Correct layer. Carries an explicit
    prod-cleanup obligation (advisor1 fixture + 3 karen test-records left deactivated) — that
    is data hygiene, correctly bundled with the reactivation path that touches the same rows,
    NOT scope-creep-through-coupling (#5).

  Task 5 (guard config JSONB from raw secrets) — real gap, verified: data-source-admin.service.ts
    has a dedicated `credential` field that is encrypted-at-rest (encryptCredential, lines 143-149)
    SEPARATE from the free-form `config` JSONB written raw (line 159, 236). An admin pasting a
    secret into config defeats the encrypted-at-rest invariant. Cause-layer, security-forward. See
    note-1 for the framing refinement P-2 should weigh.

soft_notes:
  note-1_task5_framing: |
    Task 5 is framed as a "runtime guard" against secrets in the config blob. The stronger framing
    is a BOUNDARY/typing fix: the encrypted `credential` field already exists as the sanctioned
    secret path, so the fix is to (a) type/validate config against a known non-secret shape per
    providerKey and/or (b) steer/route secret-shaped input to the credential path — rather than
    building a heuristic content-scanner that tries to detect "this looks like a secret" at runtime
    (which risks validation-theater, universal antipattern #7, if it guards scenarios a typed schema
    would prevent outright). NOT a REFRAME/blocker — task 5 is Low and security-forward-looking; this
    is guidance for P-2 to shape the AC toward typed-boundary rejection over runtime string-sniffing.
  note-2_task3_framing: |
    "Duplicate invite" is arguably a thin slice of a missing invite-lifecycle state (pending /
    accepted / expired / revoked). The task as scoped (409-or-idempotent on re-invite) is the
    correct MINIMAL fix and should NOT be expanded here — flagging only so P-2 writes the AC to
    define behavior for BOTH an already-registered user AND an already-pending invite, so the fix
    isn't demo-path (universal antipattern #3) by handling only the registered-user case the unique
    index already catches.

rescope_signal: |
  No RESCOPE-AUTO-SPLIT. The five are a coherent vertical "finish + harden M7 admin" bundle, not a
  grab-bag: all trace to one jenny review of one shipped vertical, all touch the admin/settings
  surface (or its M7↔M4 boundary for task 1). No 2+ unrelated changes bundled "while we're in there"
  (universal antipattern #5 does not fire). Sizing (is 5 tasks one wave or two?) is P-1's call, not
  mine — I raise no split signal.

sibling_visible: false
```
