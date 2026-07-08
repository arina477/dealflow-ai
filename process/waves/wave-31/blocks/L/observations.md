# Wave 31 L-2 Observations — M9 Twenty CRM DataSourceAdapter

Wave: 31 | Topic: external-SDK CRM adapter (Twenty DataSourceAdapter, dormant; 2nd connector after Affinity)
Promotion this wave: **1 — CI-PRINCIPLES #4 (RATIFIED from a mid-C-block append; consumes the single CI slot)**

---

## PROMOTION — CI-PRINCIPLES #4 (RATIFIED, not newly authored this stage)

**Rule (already in `command-center/principles/CI-PRINCIPLES.md`, appended mid-C-block by head-ci-cd):**
```
4. Pin Railway redeploys to the merged commitSha; a bare serviceInstanceDeployV2 redeploys the stale pinned commit.
   Why: Verifying a redeploy of the old pinned commit greenlights code the merge never shipped.
```

**Provenance / process note (audit-trail honesty):** head-ci-cd appended this rule to CI-PRINCIPLES.md
DURING the C-block (commit d46a42f), bypassing the L-2 gate. V-1 Karen flagged it (finding K-CF) as a
carry-forward for L-2 to ratify-or-revert. L-2 RATIFIES rather than reverts — the substance independently
earns promotion, and reverting only to re-add the identical rule at L-2 is pure churn. This ratification
consumes wave-31's single CI-PRINCIPLES promotion slot; **no second CI rule is promoted this wave.**

**Bar cleared (both roster specialists independently confirmed):**
- **Recurrence (≥2 waves): CONFIRMED across 4 waves** — the bare-`serviceInstanceDeployV2` stale-pinned
  redeploy footgun fired + was caught-and-corrected in wave-6 (`96179b0` stale), wave-15 (`5754fbf` stale —
  admin pages 404'd, the near-miss), wave-29 (`775cd67` stale), and wave-31 (`a6ad02c` = wave-30, no Twenty
  adapter — the case under review). Distinguished from the ~24 waves that merely used `commitSha` pinning as
  routine (category a) — those never hit the footgun as an incident.
- **Non-duplicate vs rule 1:** rule 1 is *post-deploy detection* (verify commitHash after); rule 4 is
  *pre-deploy prevention* (pin the trigger call so the wrong artifact never boots). Complementary layers,
  distinct `Why:` lines, distinct falsifiable checks. Not a near-dup.
- **Not a snack — existential Ghost-Green:** the wave-31 stale deploy (`a6ad02c`) contained NO Twenty
  adapter; verifying it would have signed a C-block APPROVED for code the merge never shipped — a
  provenance-integrity failure of the highest class for a compliance-first product.
- **Format-exact:** rule 112/120 chars, why 87/100, exactly 2 lines, sequential #4, no forbidden tokens,
  no wave ref, falsifiable. Passes the Contract linter.

---

## OBS-W31-1 (NEW — HOLD, do NOT promote) — mirrors-prior-adapter ⇒ expected-not-regression review-noise

**Observation:** When a wave ships an adapter/module deliberately built as a structural mirror of a
prior-wave sibling, reviewers repeatedly re-flag the intended-identical behavior (partial-failure clause,
graceful-dormant boot, page-truncation on boundary-Zod failure) as if it were a novel defect. The correct
framing — "mirrors the shipped prior adapter ⇒ expected, not a regression" — has now recurred as
review-noise across wave-30 (Affinity) and wave-31 (Twenty). V-block flagged it as a 3rd-confirmation
promotion candidate.

**Candidate principle (if ever promoted — target VERIFY-PRINCIPLES):**
```
Behavior a wave deliberately mirrors from an already-shipped sibling is expected-baseline, not a regression finding.
   Why: Re-flagging intended-identical sibling behavior as a defect inflates noise and buries real drift.
```

**Honest judgment — NOT promoting this wave (single CI slot already consumed; and the bar is not cleanly met):**
- This wave's ONE promotion is already spent on CI-PRINCIPLES #4. VERIFY-PRINCIPLES could in principle take
  its own rule (cap is per-file), BUT this candidate does not yet cleanly clear the bar:
- The "3rd confirmation" is softer than it sounds — it is a *review-process* observation (reviewers should
  frame mirror-behavior as baseline), not a hard, deterministically-checkable code invariant. A rule that
  says "don't over-flag expected behavior" risks non-falsifiability (adjacent to the Contract's REJECTED
  "write good error messages" example) unless tightened to a mechanical check.
- Risk of undermining an existing invariant: VERIFY-PRINCIPLES #2 ("Run adversarial /review on every
  B-block diff that builds an auth guard, integrity chain, or merge engine") deliberately errs toward MORE
  scrutiny. A "treat mirror-behavior as baseline" rule could be mis-read as license to under-review a
  sibling adapter. Promoting it would need careful phrasing so it narrows *noise classification*, not
  *review coverage*.
- **Hold: carry to wave-32.** Promote only if a 4th sighting recurs AND it can be phrased as a
  deterministic noise-classification rule that does not soften review coverage.

---

## OBS-W30-1 — CLOSED-LOOP (actioned this wave; retired from HOLD, NOT a promotion)

**Prior observation (wave-30, HELD):** an external-data adapter must safeParse its own output against the
normalized contract before returning; the Affinity adapter skipped it, the fixture adapter did it.

**Resolution this wave:** the Twenty adapter ADDED the output-validation safeParse the Affinity adapter
lacked — the P2-a fold. jenny independently confirmed ("P2-a output-validation genuinely closes wave-30
Affinity gap"; Twenty adds outbound safeParse at `:478`, Affinity has zero). This is a genuine **closed
loop**: a wave-30 held observation drove a concrete wave-31 code action, verified in deployed reality.

**Judgment — NOT a promotion:** the loop closed by *building the fix into this wave's code*, not by
graduating a cross-wave rule. It remains a 1-sighting sibling-pattern nit at the principle level (wave-30's
own judgment). It is now RETIRED from the hold queue (actioned), not promoted. Recording the closed loop is
the honest outcome — this is the "P2-a-output-validation fold worked" observation, real and non-theater.

---

## OBS-W31-2 (NEW — HOLD) — config-schema strict boundary forces env-resolution (base-URL REFRAME)

**Observation:** Twenty is self-hostable, so its base URL is per-instance, not a constant. The wave-31
REFRAME resolved the base URL from env (`TWENTY_BASE_URL`) with an https/SSRF guard, rather than hardcoding
or widening the config schema (config schema was left untouched — DRIFT-1 clarified). This is a potentially
reusable pattern for any self-hostable-SDK adapter: resolve the instance endpoint from env behind an
https-validated boundary, keep the config schema strict.

**Candidate principle (if ever promoted — target BUILD-PRINCIPLES):**
```
Resolve a self-hostable SDK's per-instance base URL from a validated env var, not a hardcoded constant or widened config schema.
   Why: A hardcoded endpoint breaks self-hosted tenants; a widened schema loses the strict-boundary SSRF guard.
```

**Honest judgment — NOT promoting this wave:**
- 1-wave sighting (first self-hostable adapter). BUILD-PRINCIPLES requires 2+ waves.
- Single CI slot already consumed by the ratified rule; and this is a fresh pattern, not yet cross-wave.
- The candidate rule line is 122 chars — OVER the 120 limit as drafted; would need tightening before it
  could ever promote (recorded here as a hold-queue note, not a ready rule).
- **Hold: promote on a 2nd self-hostable / per-instance-endpoint adapter wave, tightened to ≤120 chars.**

---

## HELD QUEUE (carried forward from wave-30, unchanged unless noted)

- **OBS-W27-1** (held): HTTP-boundary producer-vs-consumer tautology (client re-encodes from the same spec
  it implements). Strong, generalizable. No recurrence this wave (adapter uses mocked tests; no live
  HTTP-client test-tautology exposure). Carry to wave-32.
- **OBS-W29-1** (held): assert-by-type over assert-by-value. No recurrence this wave. Carry to wave-32.
- **OBS-W27-4** (held): carry to wave-32.
- **OBS-W25-2** (held): carry to wave-32.
- **readTail-RLS-exempt** (held): carry to wave-32.
- **RLS-on-new-table (gate-enforced)** (held): carry to wave-32.
- **MG1-guard-freeze** (held): carry to wave-32.
- **boot-safety** (held): carry to wave-32.
- **OBS-W30-1** (was held): **RETIRED — closed-loop actioned this wave** (P2-a fold, above).

---

## Promotion decision

Promotions this wave: **1** — CI-PRINCIPLES #4 (RATIFIED from mid-C-block append; consumes the single CI slot).

Everything else held or retired: OBS-W31-1 (mirror-noise, 3rd sighting but not a clean deterministic
rule + slot rule), OBS-W31-2 (base-URL env-resolution, 1-wave + over-length draft), OBS-W30-1 (closed-loop,
retired not promoted). No over-promotion; no snacking. The 5-consecutive-0-promotion streak ends this wave
NOT by relaxing the bar, but because a genuinely recurring (4-wave) Ghost-Green-preventing CI rule was
already in the file and independently cleared every promotion check — L-2 ratifies rather than reverts.
