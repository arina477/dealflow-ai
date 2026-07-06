# Wave 16 — L-block Observations (knowledge-synthesizer)

**Wave:** 16 — M7 admin-hardening (invite dedup advisory-lock + reactivate + config typed-boundary no-echo + admin-activity read-only + compliance-default cascade). SECURITY-SCOPE-TIGHTENED.
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 11–16 (observations from waves 11–15 fully read; promoted T-4 #1 + VERIFY #3 noted as resolved).
**Net pre-promotion candidates:** 3 promotion-grade (advisory-lock 2-wave, no-echo-on-reject 2-wave, stale-GIT_SHA 2-wave). 3 additional observations at informational/warning severity, each first-sighting.

Each entry is logged with its first-sighting wave so a later wave's L-1 author can detect recurrence deterministically. Recurrence in any later wave promotes on sight (subject to head-X approval + format contract), no re-litigation.

---

## What shipped

- M7 admin-hardening second vertical: invite dedup + live-uniqueness under concurrency (advisory lock), user reactivate (no-priv-esc, WORM-safe), config typed-boundary (uniform-static no-echo, `.strict()` whitelist), admin-activity read-only endpoint (5-field whitelist, zero audit appends), compliance-default cascade (tx-scoped workspace_settings read, explicit-wins).
- 3 P-4 security findings resolved before B-block: Finding-1 invite advisory-lock (partial index rejected as design), Finding-2 config uniform-static no-echo, Finding-3 admin-activity admin-only + read-only-immutable + no-secret metadata.
- 3 B-6 /review P2 findings fixed forward: JSONB `sql`-cast serialization bug (CASCADE-3b object round-trip e2e added), false sequenceNumber docstring removed, reactivate `:id` unvalidated → 500 fixed to 400.
- C-1: 1 fix-forward cycle (HMAC cross-suite key contamination, test-harness only, assertion preserved). Ghost-Green [skip ci]-on-HEAD caught and neutralized before push.
- C-2: GIT_SHA Railway env var was stale (f5455d6 from wave-15); repinned to d72d7cb. Both services SUCCESS, meta.commitHash==d72d7cb independently verified per-service.

---

## Systemic root-cause map (not human-blame)

Four independent classes surfaced this wave, all caught in-gate, none escaped to the deployed artifact:

1. Set-uniqueness invariant (invite live-dedupe) where a partial index with a non-immutable predicate (`expiry > now()`) is rejected by Postgres — the advisory-lock-on-key pattern is the only correct design (P-3/B-2). Recurrence of the wave-15 advisory-lock class (different sub-problem: index-predicate limitation vs write-skew; same conclusion: advisory lock is the only serialization tool).
2. A validation rejection path that echoed the offending config value via the default ZodError — the wave-15 `scrubCredentialFromError` covered `input.credential` but not `input.config`. P-4 Finding 2 caught the gap; B-2 closed it with `safeParse` + static constant (no-echo, no ZodError propagation). Recurrence of the wave-15 no-echo pattern.
3. Parallel real-DB e2e suites writing to the same audit chain with different HMAC keys — `recordkeeping-gate`'s suite-private key caused `verifyChain` to miscompute hashes for foreign rows written by new parallel suites using the shared default. First-sighting of the cross-suite crypto-key contamination class.
4. The `/health` `version` field read from a static `GIT_SHA` Railway service variable that was not repinned during the wave-16 deploy — containers booted correctly on d72d7cb but self-reported the stale f5455d6 string for >10 min. Recurrence of the wave-15 stale-provenance class (wave-15 was a stale serviceInstance pinned commit; wave-16 is a stale env var; same root: trusting the app's self-report over the deployment object's `meta.commitHash`).

The learning targets missing safeguards, not authors.

---

## Observation ledger

### OBS-W16-1 — Advisory lock on key as the ONLY correct design when the live predicate is non-immutable or multi-row (PROMOTION-GRADE; 2-wave recurrence with OBS-W15-3)

**What:** `inviteAsActor` requires a live-invite dedup check: reject if the email has an active user OR a live (unexpired, unconsumed) pending invite. A partial unique index on `invites(email)` is the obvious structural guard, but:
- `WHERE consumed_at IS NULL` alone would block re-inviting an email whose prior invite expired (violates AC3: expired→reinvite-allowed).
- The correct live predicate `WHERE consumed_at IS NULL AND expiry > now()` contains `now()` — a non-immutable expression — which Postgres refuses in a partial unique index.
- No index can express this invariant. A bare SELECT-then-INSERT without serialization is a TOCTOU race.
- Solution: `pg_advisory_xact_lock(hashtext(lower(email))::bigint)` as the FIRST statement in the tx, serializing the SELECT-live-then-INSERT critical section per email.

**Recurrence accounting:**
- Wave-15 (OBS-W15-3, filed as first-sighting HOLD): enforcing "at least one admin must remain active" via `count(*) FOR UPDATE` has a write-skew window when two concurrent transactions touch disjoint rows — the fix is `pg_advisory_xact_lock(<constant admin-guard key>)` on the whole admin set.
- Wave-16: enforcing invite live-uniqueness — the live predicate requires `expiry > now()` (non-immutable), which Postgres refuses in a partial index — the fix is `pg_advisory_xact_lock(hashtext(lower(email)))` on the relevant key.
- Same kernel: when a concurrent uniqueness or cardinality invariant cannot be expressed by a partial index (non-immutable predicate) or by row-level FOR UPDATE (disjoint row problem), an advisory lock on the relevant domain key is the correct serialization mechanism. Two waves, distinct mechanical expressions.

**Source artifacts:**
- Wave-16: `process/waves/wave-16/stages/P-3-plan.md` Action 1 (advisory-lock primary, partial index rejected — "needs `expiry > now()` which is non-immutable → Postgres refuses it in a partial index"); `process/waves/wave-16/stages/B-2-backend.md` §Task c54db02d; `process/waves/wave-16/blocks/B/gate-verdict.md` §c54db02d "No partial unique index (the spec explicitly rejected it)"; `process/waves/wave-16/stages/T-9-journey.md` §invariant-1 INVITE-CONC-1.
- Wave-15: `process/waves/_archive/wave-15/blocks/L/observations.md` OBS-W15-3 ("count(*) FOR UPDATE does not serialize the set"; pre-authored BUILD candidate); `process/waves/_archive/wave-15/stages/P-4-security.md` Inv-1 advisory-lock fix.

**Root class:** Concurrent invariant enforcement where neither a partial unique index (non-immutable/multi-condition predicate) nor SELECT FOR UPDATE (disjoint row locking) can serialize access to the invariant-protected set. Advisory lock on a stable domain key is the only correct design.

**Severity:** warning (both times caught before B-block as a plan-level defect; no write-skew or duplicate-invite shipped; the original designs would have been data-integrity regressions under concurrent load).

**All 3 promotion criteria met:**
- Generalizable: yes — any feature enforcing a uniqueness or cardinality invariant that requires a time-varying or multi-row predicate faces this class.
- Falsifiable: yes — a feature using a partial index with `now()` or a similar non-immutable expression, or `FOR UPDATE` on individual set members for a set-cardinality invariant, fails this rule. Checkable at B-6 by reading the critical section.
- Cited: 2-wave artifact chain above (OBS-W15-3 + wave-16 P-3/B-2/B-6/T-9).

**Candidate principles file:** BUILD (new rule, distinct from existing BUILD #6 "semantic-predicate-not-count": #6 is about guard-correctness at the predicate level; this is about serialization-mechanism selection when indexing fails).
**Promotion status:** PROMOTION-GRADE. DO NOT promote here (karen vets + orchestrator caps ≤1/file).

**Pre-authored BUILD candidate (format-checked against BUILD Contract for new rules):**
```
8. Use an advisory lock when a concurrent uniqueness or cardinality invariant needs a non-immutable or multi-row predicate.
   Why: A partial index rejects non-immutable predicates; FOR UPDATE on rows leaves disjoint members unprotected.
```
_(Rule 119 chars, Why 97 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional — BUILD #8 slot contested by W11-1 store-binding and W12-1 caller-FK; whichever held/new candidate recurs first claims the next number.)_

---

### OBS-W16-2 — Uniform-static no-echo on any validation rejection path (PROMOTION-GRADE; 2-wave recurrence with wave-15 B-6 M1)

**What:** `DataSourceAdminService.validateConfigOrThrow` receives a free-form config value (potentially secret-shaped). On failure, it calls `safeParse` (not `parse`), discards the `ZodError` entirely (which may contain the offending field value in `.issues[].message`), and throws `BadRequestException(CONFIG_VALIDATION_ERROR)` — a module-level string constant with no interpolated values. The secret value is asserted absent from the thrown error at C-4b (unit test, load-bearing). This closes the wave-15 gap: `scrubCredentialFromError` was scoped to `input.credential`, not `input.config`, leaving config values echoed via the default ZodError path.

**Recurrence accounting:**
- Wave-15 B-6 M1 (REWORK): the credential redaction on the error path covered `input.credential` only — a secret in `input.config` would flow through the default ZodError message. Fixed with `scrubCredentialFromError` on the credential input. Filed in wave-15 B-6 verdict as the no-input-echo rework; wave-15 OBS-W15-4 noted the four-layer credential defense-in-depth pattern (informational).
- Wave-16 P-4 Finding 2 + B-2: the config validation path was found to echo the offending field value via ZodError's default `.issues[].message` on a `parse()` throw. Fixed by switching to `safeParse` + discard + static constant — pattern identical to the wave-15 lesson, applied to the config surface.
- P-3 plan explicitly names this as "the wave-15 B-6 M1 'no input echo' rework" applied to config. Direct traceable recurrence.

**Source artifacts:**
- Wave-16: `process/waves/wave-16/stages/P-3-plan.md` Action 1 §Finding-2 ("mirror the wave-15 B-6 M1 'no input echo' rework"); `process/waves/wave-16/stages/B-2-backend.md` §Config boundary (safeParse, CONFIG_VALIDATION_ERROR constant, C-4b load-bearing assertion); `process/waves/wave-16/blocks/B/gate-verdict.md` §2560fecc ("closing the wave-15 leak vector where `scrubCredentialFromError` only redacted `input.credential`, not `input.config`").
- Wave-15: `process/waves/_archive/wave-15/blocks/B/gate-verdict.md` (Phase-1 REWORK: B-6 M1 "uniform-static no-input-echo rework"); `process/waves/_archive/wave-15/blocks/L/observations.md` OBS-W15-4.

**Root class:** On a validation rejection path, the default Zod (and most parser) error includes the offending input value. Discarding the error object and replacing it with a static constant is the only way to guarantee no-echo regardless of which input field triggered the validation.

**Severity:** warning (both times the echo was caught before or at gate; wave-15 caught at B-6, wave-16 caught at P-4; no secret echoed in production).

**All 3 promotion criteria met:**
- Generalizable: yes — any endpoint receiving a sensitive input (credential, secret-shaped config, PII) and validating it faces this class.
- Falsifiable: yes — a `parse()` throw (not `safeParse`-discard) on a sensitive input, or a `BadRequestException` whose message interpolates any field from the parsed object, fails this rule. Mechanically checkable at B-6 by reading the rejection branch.
- Cited: 2-wave artifact chain above (wave-15 B-6 M1 + wave-16 P-4 Finding 2/B-2/B-6).

**Candidate principles file:** BUILD (implementation pattern; security-flavored but applies to any validated input surface with sensitive values).
**Promotion status:** PROMOTION-GRADE. DO NOT promote here (karen vets + orchestrator caps ≤1/file).

**Pre-authored BUILD candidate (format-checked against BUILD Contract for new rules):**
```
9. On any input validation failure, throw a static constant error and discard the input value without logging or interpolating it.
   Why: Zod's default error echoes the offending value; any interpolation can leak credentials or secrets into logs.
```
_(Rule 123 chars — OVER 120. Trimmed:)_
```
9. On any validation failure, throw a static constant message and discard the parsed input without logging or interpolating.
   Why: Zod's default error echoes the offending value; interpolation can leak credentials or secrets into logs.
```
_(Rule 117 chars, Why 91 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional — contiguous with BUILD #8 from OBS-W16-1.)_

---

### OBS-W16-3 — Stale GIT_SHA env var: deployment object's commitHash is the authoritative provenance signal (PROMOTION-GRADE; 2-wave recurrence with wave-15 C-2)

**What:** After wave-16 was deployed, `/health` returned `version: f5455d6` (the wave-15 GIT_SHA) for >10 minutes despite both Railway services having successfully deployed d72d7cb code. Root cause: `/health` reads the `GIT_SHA` Railway service variable, which is a static env var — never auto-updated when a new commit deploys. It was last set during wave-15's STEP 0. Fix: `variableUpsert(GIT_SHA=d72d7cb)` + redeploy. The containers had booted cleanly on d72d7cb code throughout; the stale `/health` version was a config drift artifact, not a routing mirage.

**Recurrence accounting:**
- Wave-15 C-2: the web serviceInstance was pinned to the prior commit (5754fbf) — arg-less `serviceInstanceDeployV2` redeployed the pinned commit, not latest main; wave-15 admin pages 404'd. Caught via `deployment.meta.commitHash` mismatch (5754fbf vs expected f5455d6) and confirmed by the page 404s. Fixed with `serviceInstanceDeployV2(commitSha=f5455d6)`. Root cause: trusting "both SUCCESS" without checking commitHash. The wave-16 C-2 explicitly notes "wave-15 stale-web-build lesson: web serviceInstance meta checked explicitly."
- Wave-16 C-2: the same `meta.commitHash` verification (independently confirmed per-service) correctly showed both services at d72d7cb. But `/health` reported stale f5455d6. Root cause: GIT_SHA is a static Railway env var, not auto-derived from the deployment's commitHash. Wave-15 set it explicitly during STEP 0 for that wave; wave-16 forgot to bump it.
- Both waves: the deployment object's `meta.commitHash` was the authoritative provenance signal that revealed the true state; the app's self-reported version was unreliable. Different mechanical expressions (stale serviceInstance pin vs stale static env var), same root class.

**Source artifacts:**
- Wave-16: `process/waves/wave-16/stages/C-2-deploy-and-verify.md` §Stale-GIT_SHA config-fix ("the `GIT_SHA` Railway service variable ... was pinned to the wave-15 value `f5455d6` and never bumped"; "meta.commitHash independently verified == d72d7cb ... wave-15 stale-web-build lesson: web serviceInstance meta checked explicitly").
- Wave-15: `process/waves/_archive/wave-15/stages/C-2-deploy-and-verify.md` §web FIRST attempt ("SUCCESS but commit meta = 5754fbf — STALE"; corrected via explicit commitSha; "precisely the Phantom-Skip/stale-source class a superficial both-SUCCESS glance would miss").

**Root class:** The app's `/health` version string is a self-reported static env var that can lag or mismatch the deployed commit. The deployment object's `meta.commitHash` is the only authoritative provenance signal.

**Severity:** warning (both times caught at C-2 before V-1; no fabricated green; in wave-15 real pages 404'd; in wave-16 only the /health version field was stale; in both cases the code was either wrong-version or correctly deployed, and commitHash resolved the ambiguity).

**All 3 promotion criteria met:**
- Generalizable: yes — any platform that exposes both a deployment-level commitHash and an app-self-reported version string faces this class whenever the self-reported string is a static env var.
- Falsifiable: yes — a C-2 procedure that trusts `/health version` as the provenance signal without independently verifying `deployment.meta.commitHash` fails this rule.
- Cited: 2-wave artifact chain above (wave-15 C-2 + wave-16 C-2).

**Candidate principles file:** CI-PRINCIPLES (deploy-and-verify provenance pattern; currently zero rules in CI-PRINCIPLES).
**Promotion status:** PROMOTION-GRADE. DO NOT promote here (karen vets + orchestrator caps ≤1/file).

**Pre-authored CI-PRINCIPLES candidate (format-checked against CI Contract for new rules):**
```
1. Verify deployed commit via the deployment's commitHash field, not the app self-reported /health version.
   Why: The /health version reads a static env var that can lag the actual deployed commit.
```
_(Rule 100 chars, Why 80 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number 1 — CI-PRINCIPLES has zero rules; this would be the first.)_

---

### OBS-W16-4 — [skip ci] on a non-docs commit HEAD silently fabricates a green on push (FIRST-SIGHTING; warning)

**What:** Branch HEAD `3b0d037` carried `[skip ci]` in its commit message. Pushing it directly to `main` would have caused GitHub to skip the entire CI run on that push event — every test, lint, audit — while reporting no workflow failure. Result: a wave could ship to main with zero CI coverage while the badge shows green. Detected by head-ci-cd pre-push; mitigation: appended an empty commit `67f3bba` whose tree SHA is byte-identical to `3b0d037` (`fa45770...` == `fa45770...`), so CI validates the exact same code tree while actually running.

**Source artifacts:** `process/waves/wave-16/stages/C-1-pr-ci-merge.md` §Ghost-Green / phantom-skip caught before push ("Pushing it directly to `main` would have SKIPPED the entire CI run — a fabricated green. Mitigation: appended an empty commit `67f3bba` with a clean CI-triggering message whose tree SHA is byte-identical").

**Root class:** `[skip ci]` markers are legitimate for docs-only commits but create a fabricated green if they land on the HEAD commit of a push to `main` carrying code changes. The neutralization pattern — an identical-tree commit with a CI-triggering message — preserves provenance (code tree is byte-identical) while ensuring CI runs.

**Severity:** warning (caught pre-push; no fabricated green reached main; the mitigation is clean and preserves provenance).

**Generalizable?** Yes — any wave where a B-block commit carries `[skip ci]` in its message (e.g., a commit originally authored as a docs fix later amended to carry code) is vulnerable. Checkable: grep HEAD commit message for `[skip ci]` before pushing to a CI-gated branch. First-sighting this wave. 2-wave bar NOT met.

**Candidate principles file:** CI-PRINCIPLES (deploy-and-push CI hygiene; same file as OBS-W16-3 candidate — note the ≤1/file cap means only one of OBS-W16-3 or OBS-W16-4 can promote per wave).
**Promotion status:** HOLD (first-sighting). Carries forward.

**Pre-authored CI candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
2. Before pushing to a CI-gated branch, verify the HEAD commit message carries no [skip ci] or [ci skip] marker.
   Why: GitHub skips all CI jobs for a push whose HEAD commit carries that marker, producing a fabricated green.
```
_(Rule 114 chars, Why 95 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional — if OBS-W16-3 CI rule is promoted first it claims #1; this would be #2.)_

---

### OBS-W16-5 — Cross-suite crypto-key contamination on a shared real-DB audit chain (FIRST-SIGHTING; warning)

**What:** `recordkeeping-gate.e2e-spec.ts` hardcoded a suite-private `AUDIT_LOG_HMAC_KEY` in its `beforeAll`. Wave-16 added two new parallel e2e suites (`admin-activity`, `admin-concurrency`) that write audit rows to the shared `dealflow_test` DB using the vitest-default key. Vitest 3.x runs e2e files in parallel worker forks. When `recordkeeping-gate`'s `verifyChain` walks the FULL chain (all rows including those written by sibling suites), it recomputes each foreign row's HMAC using its own private key, producing a content-hash-mismatch for every foreign row — `verifyChain` returns `{ok:false}`. Fix: replace the suite-private key with the shared `??` pattern (`process.env.AUDIT_LOG_HMAC_KEY ?? 'test-audit-hmac-key-dummy-do-not-use-in-prod'`), aligning all suites. The `expect(pkg.verifyResult.ok).toBe(true)` assertion was preserved, not weakened.

**Source artifacts:** `process/waves/wave-16/stages/C-1-pr-ci-merge.md` §Run-1 RED + §Fix-forward cycle 1 ("suite-private AUDIT_LOG_HMAC_KEY ... recordkeeping-gate's verifyChain ... recomputes the foreign rows' HMAC with its private key → content-hash-mismatch → ok:false"); `process/waves/wave-16/stages/V-1-karen.md` §F8 ("C-1 HMAC cross-suite fix preserved verifyResult.ok, not weakened").

**Root class:** Parallel real-DB e2e suites that collectively walk an append-only hash chain (verifyChain over ALL rows) must share the same HMAC key derivation. A suite-private key is correct for an isolated suite but breaks verifiability when any other parallel suite writes to the same chain with a different key.

**Relationship to prior observations:** Relates to OBS-W12-2 (parallel self-migrate race, CI-PRINCIPLES candidate) — both concern parallel e2e suites sharing a real-DB resource — but this kernel is the HMAC-key alignment class, not the migrate-lock race. Distinct class from OBS-W12-2 and from the WORM-teardown (T-4 #1) pattern. First-sighting.

**Severity:** warning (real CI failure on a load-bearing compliance invariant; caught at C-1 fix-forward; fixed without weakening assertions; no production impact).

**Generalizable?** Yes — any project with multiple parallel real-DB suites that write to a keyed immutable chain faces this class when adding a new audit-writing suite. Checkable: grep e2e suites for hardcoded crypto keys when a shared chain is under test. First-sighting. 2-wave bar NOT met.

**Candidate principles file:** T-4 (parallel real-DB suite isolation — same file as the WORM teardown rule T-4 #1; distinct kernel).
**Promotion status:** HOLD (first-sighting). Carries forward.

**Pre-authored T-4 candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
2. Parallel real-DB suites writing to a shared hash chain must derive their crypto key from a shared env var.
   Why: A private key causes verifyChain to miscompute hashes for foreign rows that parallel suites wrote.
```
_(Rule 107 chars, Why 97 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number 2 — T-4 currently has one rule (#1 WORM teardown, promoted from OBS-W15-1).)_

---

### OBS-W16-6 — Drizzle raw `sql` cast on a JSONB column bypasses the ORM serializer (FIRST-SIGHTING; informational)

**What:** B-6 /review P2 finding: `mandate.repository.ts` used a `sql\`...\`` template literal cast on the `suppressionScope` JSONB column at write time. Drizzle's JSONB type serializer (`jsonb`) runs when a value is assigned as a plain JS object to a column defined with `.jsonb()`. Wrapping the value in a `sql` cast tells Drizzle to treat it as a raw SQL fragment, bypassing serialization — so a JS object `{firmDefault:true}` is coerced to the string `'[object Object]'` and stored literally. Fixed by removing the cast and assigning the value directly: `suppressionScope: input.suppressionScope`. CASCADE-3b was added as a fault-killing e2e asserting the object shape round-trips (not just the string case).

**Source artifacts:** `process/waves/wave-16/stages/B-6-review.md` §Phase 2 /review P2 ("Real latent bug: a `sql` cast bypassed Drizzle's JSONB serialization, so an OBJECT suppressionScope would store as '[object Object]'. Removed the cast"); `process/waves/wave-16/stages/V-1-karen.md` §F1 ("suppressionScope no `sql` cast after /review fix: ... no `sql\`...\`` cast on the column. Confirmed"); `process/waves/wave-16/stages/T-9-journey.md` §invariant-2 ("CASCADE-3b proves the object SHAPE round-trips — the /review bug was an object storing as [object Object]; this is exactly the JSONB-serialization defect, now fault-covered").

**Root class:** Using a Drizzle `sql` template literal to wrap a column value bypasses the column's type serializer. For JSONB columns mapped to structured types (objects, arrays), this means the JS `toString()` representation is stored instead of the JSON-serialized value. The same risk applies to any ORM column with a custom serializer (encrypted, enum, array, composite) when wrapped in a raw SQL expression.

**Severity:** informational (latent bug found by adversarial /review, not by any test failure at B-6; the bug was in pre-existing code, not the wave-16 spec; CASCADE-3b added as a fault-killing test to prevent regression).

**Generalizable?** Yes — any Drizzle JSONB or custom-serialized column wrapped in a `sql` cast faces this class. Mechanically checkable: grep for `sql\`...\`` applied as the VALUE argument to a column defined with `.jsonb()`, `.array()`, or a custom type. First-sighting. 2-wave bar NOT met.

**Candidate principles file:** BUILD (Drizzle/ORM code convention; distinct from existing BUILD #1–7).
**Promotion status:** HOLD (first-sighting). Carries forward.

**Pre-authored BUILD candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
10. Never wrap a column value in a raw sql template cast for a Drizzle JSONB or custom-serialized column.
    Why: A raw sql cast bypasses the ORM serializer, storing objects as their JS toString representation instead.
```
_(Rule 103 chars, Why 99 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional — contiguous after BUILD #9 from OBS-W16-2.)_

---

## Held candidates — recurrence audit (waves 11–15 carry-forward)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W15-3 count-FOR-UPDATE write-skew (BUILD #8 candidate, advisory-lock) | RECURRENCE — OBS-W16-1. Two-wave bar MET. See OBS-W16-1. | PROMOTE-GRADE (merged into OBS-W16-1) |
| OBS-W15-4 Credential defense-in-depth four layers | NON-RECURRENCE. No new feature introduced an admin-entered external secret this wave (config-boundary is a hardening of the wave-15 path, not a new secret primitive; the 4-layer defense held). | HOLD unchanged |
| OBS-W15-5 AC-consumer-half unplanned | NON-RECURRENCE. The cascade consumer (MandateService reading workspace_settings) was explicitly planned and delivered this wave as a corrective — the CROSS-MODULE AC from wave-15 (write half) was now completed by building the read half. No NEW instance of an AC asserting a behavior whose consumer was unplanned. | HOLD unchanged |
| OBS-W11-1 reused-authority store-binding (BUILD #8 candidate) | NON-RECURRENCE. No new decision authority reads from a store the flow failed to write. | HOLD unchanged |
| OBS-W12-1 caller-supplied-FK provenance (BUILD #8 candidate) | NON-RECURRENCE. No new caller-supplied association FK written without provenance check. | HOLD unchanged |
| OBS-W12-2 parallel self-migrate race (CI #1 candidate) | NON-RECURRENCE. No new self-migrating e2e suite; existing suites reuse the race-safe migrate helper. | HOLD unchanged |
| OBS-W13-1 mock-only row-membership derivation (VERIFY #3 candidate) | NON-RECURRENCE. Note: VERIFY #3 was PROMOTED in wave-15 (hollow-mechanism test), occupying that slot. This kernel (mock-only row-membership derivation SQL) is DISTINCT from the promoted VERIFY #3 (hollow-mechanism mocked-seam). However, since VERIFY #3 has been promoted with a different kernel, this candidate needs a new slot designation. The mandate-derivation real-DB test was built as DEV-2 in wave-14/15; the mock-only ROW-MEMBERSHIP class did not independently recur this wave. | HOLD unchanged (new slot pending genuine recurrence) |
| OBS-W13-2 read-path documented-completeness-gap | NON-RECURRENCE. No new read/derivation-path built over a reused authority with an undocumented keying-scheme gap. | HOLD unchanged |
| OBS-W14-2 differential-test discriminator (VERIFY #4 candidate) | NON-RECURRENCE. All differential tests this wave use the invariant-relevant axis as the discriminator (CASCADE-3b: same suppression path, differs on input type object vs string; INVITE-CONC-1: same email, races the same service, discriminates by count). | HOLD unchanged |
| OBS-W14-3 hash-excluded additive metadata on HMAC chain (BUILD candidate) | NON-RECURRENCE. No new field added to the audit hash preimage or excluded from it this wave (no migration, no HashableEntryFields change). | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W16-1 Advisory lock / non-immutable predicate | W15 (OBS-W15-3) + W16 | warning | YES (generalizable + falsifiable + 2-wave cited) | BUILD (provisional #8) | PROMOTION-GRADE |
| OBS-W16-2 No-echo on validation rejection | W15 B-6 M1 + W16 P-4/B-2 | warning | YES (generalizable + falsifiable + 2-wave cited) | BUILD (provisional #9) | PROMOTION-GRADE |
| OBS-W16-3 Stale GIT_SHA / deploy commitHash provenance | W15 C-2 + W16 C-2 | warning | YES (generalizable + falsifiable + 2-wave cited) | CI-PRINCIPLES (#1) | PROMOTION-GRADE |
| OBS-W16-4 [skip ci]-on-HEAD fabricated green | W16 only | warning | 2-wave bar NOT met | CI-PRINCIPLES (#2 provisional) | HOLD |
| OBS-W16-5 Cross-suite HMAC key contamination | W16 only | warning | 2-wave bar NOT met | T-4 (#2 provisional) | HOLD |
| OBS-W16-6 Drizzle sql-cast JSONB serializer bypass | W16 only | informational | 2-wave bar NOT met | BUILD (provisional #10) | HOLD |

**Carry-forward queue after wave-16:**
- OBS-W16-1 — Advisory lock / non-immutable predicate (PROMOTION-GRADE, BUILD #8 provisional, 2-wave W15+W16).
- OBS-W16-2 — No-echo on validation rejection (PROMOTION-GRADE, BUILD #9 provisional, 2-wave W15+W16).
- OBS-W16-3 — Stale GIT_SHA / deploy commitHash provenance (PROMOTION-GRADE, CI-PRINCIPLES #1, 2-wave W15+W16).
- OBS-W16-4 — [skip ci]-on-HEAD (HOLD, CI-PRINCIPLES #2 provisional, own clock).
- OBS-W16-5 — Cross-suite HMAC key contamination (HOLD, T-4 #2 provisional, own clock).
- OBS-W16-6 — Drizzle sql-cast JSONB bypass (HOLD, BUILD #10 provisional, own clock).
- Inherited holds unchanged: W11-1 store-binding (BUILD #8 contested), W12-1 caller-FK (BUILD #8 contested), W12-2 self-migrate race (CI candidate), W13-1 mock-only row-membership derivation (new VERIFY slot pending), W13-2 read-path gap, W14-2 differential discriminator (VERIFY #4 candidate), W14-3 hash-excluded HMAC metadata (BUILD candidate), W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 6
promotion_grade: [OBS-W16-1 (BUILD #8), OBS-W16-2 (BUILD #9), OBS-W16-3 (CI-PRINCIPLES #1)]
hold: [OBS-W16-4, OBS-W16-5, OBS-W16-6]
advisory_lock_2wave_bar_met: true     # W15-OBS-W15-3 + W16-OBS-W16-1
no_echo_on_reject_2wave_bar_met: true # W15-B-6-M1 + W16-P4/B-2
stale_git_sha_2wave_bar_met: true     # W15-C-2 + W16-C-2
skip_ci_ghost_green_1wave_hold: true
hmac_cross_suite_1wave_hold: true
jsonb_sql_cast_1wave_hold: true
prior_held_candidates_recurred: [OBS-W15-3 advisory-lock (merged into OBS-W16-1)]
```
