# Wave 14 — L-block Observations (reality-checked retro)

**Wave:** 14 — M6 compliance hardening (gate mandate-attribution + mandate-derivation real-DB e2e + read-only compliance-oversight page). DEV-2 hard-gate LIFTED.
**Author:** head-learn (L-2 distill gate).
**Vetted by:** karen (rule-quality + recurrence-honesty reality-check) + knowledge-synthesizer (cross-wave recurrence). Pivotal Candidate-A call additionally confirmed IN-SOURCE (recordkeeping-gate.e2e-spec.ts test F vs test I).
**Net promotion this wave:** 0 across all `*-PRINCIPLES.md` files. One candidate re-validates an EXISTING rule (BUILD #4, not re-promotable); two are DISTINCT first-sightings that fail the 2-wave recurrence bar. Cap of "at most one per file" is not reached.

Each entry is logged with wave-14 as first-sighting so a later wave's L-1 author can detect recurrence deterministically instead of re-deriving. Recurrence in any later wave promotes on sight (subject to head-X approval + format contract), no re-litigation.

---

## What shipped

- Gate mandate-attribution: the compliance gate now records `mandateId` on its `gate-evaluate` audit rows via a HASH-EXCLUDED `mandate_id` column (additive migration 0012, nullable, absent from `HashableEntryFields` / `canonicalSerialization v1`). `verifyChain` stays `{ok:true, entriesChecked:310}` over the mixed old/new production chain; seq-309 `entryHash` byte-identical to the wave-13 tail. Gate allow/block logic UNCHANGED (the only code delta is `append` → `appendWithMandate(…, ctx.mandateId)`).
- Mandate-derivation real-DB e2e (`recordkeeping-gate.e2e-spec.ts`, 9 tests, REAL against migrated `dealflow_test`): captures all mandate-attributable producers incl gate-evaluate, excludes cross-mandate, verify-green. Test I proves the `mandate_id`-COLUMN does the isolation (shared template version). This LIFTS the wave-13 DEV-2 hard-gate — the scoped export can now back a live regulator request.
- Read-only `/compliance/oversight` page (distinct from wave-11 `/compliance-queue`), RBAC compliance/admin (advisor server-side blocked, 307 fail-closed), zero write/send/AI-draft affordance.
- New durable doc: `command-center/dev/architecture/audit-mandate-attribution.md` (documents that `mandate_id` is filterable ATTRIBUTION metadata, NOT in the HMAC preimage → post-insert mutation is silent to verifyChain by design; names the INSERT-only grant + BEFORE-UPDATE/DELETE trigger as the mutation defenses).
- Deferred (out of scope this wave): the end-to-end SEND (founder-credential-gated — the true M6-completion blocker), AI-drafting (LLM-spend gate), a live non-null mandate-scoped compose→gate→filtered-rows WRITE smoke (would inject a whole owned mandate chain; the WRITE path is proven at C-1 by the REAL e2e).

## Systemic root-cause map (not human-blame)

The load-bearing defects this wave were NOT coding slips — they were **safeguard/coverage gaps rendered invisible by a green-but-insufficient signal**, then surfaced by durable adversarial controls (head-builder B-6 Phase-1 gate + B-6 Phase-2 `/review`), and neither escaped to the deployed artifact. Two distinct classes surfaced:

1. A hand-authored migration (0012) not registered in the drizzle journal → a Ghost Green (the e2e's `mandate_id` assertions could only have passed against a DB where the column was added out-of-band; a fresh CI/prod DB would never create it). **This is a BUILD #4 violation — the rule already exists and fired as designed** (head-builder diagnosed it in BUILD #4 terms and gated the wave until 0161e57 registered `idx:12`, `when 1783814400000 > 0011`). The existing rule caught the class; the learning is that BUILD #4 is load-bearing and working, not a new principle.
2. A real-DB e2e whose two isolation cases differed by an INCIDENTAL attribute (distinct template versions / `resourceId`) rather than by the field-under-test (`mandate_id` column) → the assertion was tautological w.r.t. the actual discriminator: it would pass even if the feature regressed to `resource_id`-keying. Surfaced by B-6 Phase-2 `/review` (M1); fixed by test I (shared `SHARED_VERSION_ID`, isolation via the `mandate_id` column only, fault-killing: count=2 under regression, count=0 if the branch is removed).

The learning targets the missing safeguards, not the authors.

---

## Observation ledger (first-sightings — carry-forward)

### OBS-W14-1 — Ghost-Green migration-journal — RE-VALIDATES EXISTING BUILD #4 (NOT a new rule)

**What:** `0012_audit_mandate_id.sql` (+ `.down.sql`) hand-authored but NOT registered in `meta/_journal.json` (last entry `idx:11`); no `0012_snapshot.json`. Drizzle `migrate()` (prod `db:migrate` AND the e2e's `ensureMigrated`) applies ONLY journal-registered migrations, so a fresh DB never gets the `mandate_id` column. The passing e2e was a Ghost Green (validated against out-of-band DB state the deploy path does not reproduce). Caught by head-builder at B-6 Phase-1; FIXED at `0161e57` (journal `idx:12`, `when 1783814400000 > 0011`, matching snapshot). Re-verified against a freshly journal-migrated DB → real green.

**Disposition:** RE-VALIDATES BUILD #4 verbatim ("Any hand-authored drizzle migration must appear in `_journal.json` with a `when` greater than all prior entries. Why: drizzle skips a migration with a missing or stale `when` while reporting success."). Every element — hand-authored migration, missing journal registration, drizzle silently skipping while reporting success — is the BUILD #4 kernel. A rule already in the file is NOT re-promotable. This is a healthy recurrence proving BUILD #4 is load-bearing and the head-builder gate enforces it. Both specialists concur: not promotable.

### OBS-W14-2 — Differential-test discriminator must be the field-under-test (HIGHEST LEVERAGE; NEW kernel; NOT a recurrence of VERIFY #3)

**What:** The mandate-isolation real-DB e2e distinguished mandate-A vs mandate-B gate-evaluate rows by DISTINCT template versions (`VERSION_A_ID` / `VERSION_B_ID` = distinct `resourceId`s). Because the two cases differed on an incidental attribute (`resource_id`), the assertion would PASS even if `mandate_id`-column isolation regressed to `resource_id`-keying — the test was tautological w.r.t. the actual discriminator the feature relies on. FIX (test I, `9009abb`): both mandates gate-evaluate the SAME `SHARED_VERSION_ID`, isolated ONLY by the `mandate_id` column; asserts mandate-A's export sees exactly its own shared-version row (fault-killing: count=2 under `resource_id`-keying regression, count=0 if the branch is removed).

**Root class:** Fault-non-killing differential test — a differential/isolation test whose two cases differ by an INCIDENTAL attribute in addition to the field under test, so a regression that keys on the incidental attribute still passes. This is a DISTINCT kernel from the held VERIFY #3 candidate (OBS-W13-1), and the distinctness is load-bearing + confirmed in-source:
- **VERIFY #3 kernel = execution venue** ("execute the derivation against real Postgres, not a param-forwarding mock that exercises none of the join/WHERE logic"). Its check is binary: *did the derivation SQL run against Postgres?*
- **OBS-W14-2 kernel = fixture discriminator design.** The derivation DID run against real Postgres — the wave-14 e2e was REAL, real-DB, journal-migrated throughout. VERIFY #3's check PASSES on the pre-M1 test. A rule that a fix does not trip cannot recur through that fix. The failure is orthogonal: which axis separates the two fixture cases.
- IN-SOURCE CONFIRMATION (`apps/api/test/recordkeeping-gate.e2e-spec.ts`): test F discriminates A/B by `VERSION_A_ID` vs `VERSION_B_ID` (incidental); test I shares `SHARED_VERSION_ID` and isolates ONLY by the `mandate_id` column (its own header names the count=2 / count=0 regression modes). The B-6/V-3 prose is exact.
- The wave-13 ledger itself pre-warned against this over-credit (OBS-W13-1: the recurrence clock is for "the mock-only-testing PATTERN re-firing on a future wave's derivation SQL," NOT for a downstream real-DB test being deficient in some other way). Folding OBS-W14-2 into VERIFY #3 would be exactly that fake recurrence.

**Systemic (not human):** the real-DB e2e passed with a green that did not exercise the feature's actual defense; B-6 Phase-2 adversarial `/review` (M1) is the durable control that caught it. Fixed and re-verified in-gate; never escaped (V-3 confirmed test I ran REAL 9/9 at the deployed commit).

**Recurrence:** DISTINCT-KERNEL FIRST-SIGHTING (wave-14). Does NOT satisfy the 2-wave bar for VERIFY #3 (which stays HOLD — it did not recur; no mock-only derivation shipped this wave). Starts its OWN 2-wave clock.

**Pre-authored VERIFY #4 candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
4. In a differential test, make the cases share every incidental attribute so they differ only by the field under test.
   Why: Cases differing by an incidental field still pass if the feature regresses to keying on that field.
```
_(Format: rule 116 chars, why 92 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. BLOCKED only by the 2-wave recurrence bar. The VERIFY #4 number is provisional — VERIFY #3, W13-2, and this candidate all promote on their own genuine recurrence; whichever recurs first claims the next number and the others renumber.)_

### OBS-W14-3 — Hash-excluded additive metadata on an immutable HMAC-chained log (NEW kernel; first-sighting)

**What:** Extending the immutable HMAC-hashed `audit_log_entries` with a filterable `mandate_id` column WITHOUT breaking the chain: the new field is placed OUTSIDE the hashed preimage (absent from `HashableEntryFields` / `canonicalSerialization v1`; `_appendCore` writes it to the DB column separately AFTER `computeEntryHash`, and the write-time self-check tripwire also excludes it). Result: all existing entries' hashes are byte-identical, `verifyChain` stays `{ok:true}` over the mixed old/new chain. The trade-off (a post-insert mutation to `mandate_id` is silent to `verifyChain` — the column is attribution metadata, not a tamper-evident field) is DOCUMENTED in a durable compliance doc, not silently assumed tamper-proof.

**Root class:** HMAC-preimage-membership discipline for additive metadata on an append-only / hash-chained structure. No existing BUILD rule (1-7) covers it — BUILD #4 is the migration-journal kernel (the OTHER wave-14 finding); #6/#7 are guard/tx kernels. Not in any held candidate (W11-1 write-path store-binding, W12-1 caller-FK, W12-2 self-migrate race, W13-1 mock-only derivation, W13-2 read-path completeness all concern other surfaces). Clean new territory.

**Durable + testable (NOT a snack — distinct from OBS-W13-3's non-falsifiable docstring-honesty class):** two independent mechanical checks, both demonstrated this wave — STRUCTURAL: the new field must be absent from `HashableEntryFields` + `canonicalSerialization` (a literal grep; V-3 confirmed zero `mandate` refs in `audit.hash.ts`); BEHAVIORAL: `verifyChain` must return `{ok:true}` over a mixed old/new chain with prior entries byte-identical (B-6 hash-safety unit test + live C-2 `{ok:true,310}`). Falsifiable and reviewer-runnable.

**Recurrence:** FIRST occurrence (wave-14). This is the first time the project extended a hash-chained structure with a filterable column — one incident, and a "did it right once," which is the thinnest possible promotion basis. The 2-wave bar blocks it. Holds in observations until a second wave confirms.

**Pre-authored BUILD #8/#9 candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
8. Add metadata to an HMAC-chained record outside the hashed preimage, and document it as attribution-only, not tamper-evident.
   Why: A field inside the preimage breaks all prior hashes; one outside is not covered by chain verification.
```
_(Format: rule 118 chars, why 95 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. BLOCKED only by the 2-wave bar. Number provisional — the BUILD #8 slot is contested by W11-1 store-binding / W12-1 caller-FK; whichever of the held/new BUILD candidates recurs first claims the next number, others renumber on promotion.)_

### OBS-W14-4 — Prior held candidates (BUILD #8 store-binding / caller-FK, CI #1 self-migrate race, VERIFY #3 mock-only derivation, W13-2 read-path gap) — NON-RECURRENCE

**Wave-14 disposition — NONE recurred:**
- **W11-1 reused-authority store-binding (write-path):** NON-RECURRENCE. The gate wrote `mandateId` to the exact column the derivation reads (`mandate_id`); no decision authority reads from a store the flow failed to write. Stays HOLD.
- **W12-1 caller-supplied-FK provenance:** NON-RECURRENCE. `mandateId` here is threaded from validated gate `ctx` onto the row alongside the hashed fields, and the derivation FILTERS on it (read-side); no caller-forged cross-tenant association written on trust. Stays HOLD.
- **W12-2 parallel self-migrate race:** NON-RECURRENCE. No new self-migrating e2e SUITE was added (the existing `recordkeeping-gate` suite reuses the shared race-safe `ensure-migrated` helper); no new race. Stays HOLD.
- **W13-1 mock-only row-membership derivation (VERIFY #3):** NON-RECURRENCE. The wave-14 derivation ran REAL against migrated Postgres from the start (that is precisely why OBS-W14-2 is a distinct kernel, not this one re-firing). Stays HOLD.
- **W13-2 read-path documented-completeness-gap:** NON-RECURRENCE. Wave-14 ADDED the mandate_id direct branch (a write+filter attribution mechanism), it did not re-encounter a reused-authority keying-scheme completeness gap. Stays HOLD.

---

## Promotion decision (this wave)

| Candidate | Class | Durable/enforceable | Dup? | 2-wave bar | Verdict |
|---|---|---|---|---|---|
| OBS-W14-1 Ghost-Green migration-journal | RE-VALIDATES BUILD #4 | Yes (already a rule) | = BUILD #4 | N/A | NOT PROMOTABLE (rule exists; healthy recurrence) |
| OBS-W14-2 differential-discriminator | DISTINCT FIRST-SIGHTING | Yes (strong; format-checked) | No (kernel-distinct from VERIFY #3: venue vs discriminator) | FAILS (own-kernel 1st-sighting) | HOLD-in-observations (pre-authored VERIFY #4; priority carry-forward) |
| OBS-W14-3 hash-excluded additive metadata | DISTINCT FIRST-SIGHTING | Yes (structural grep + behavioral verifyChain) | No (clean vs BUILD 1-7) | FAILS (1st-sighting) | HOLD-in-observations (pre-authored BUILD candidate; own clock) |
| OBS-W14-4 W11/W12/W13 held candidates | n/a | n/a | n/a | NON-RECURRENCE (all 5) | HOLD (unchanged) |

**Promoted:** 0 to BUILD, 0 to VERIFY, 0 to CI, 0 to any T-layer. The migration-journal finding re-validates an existing rule (not re-promotable); the two genuine new kernels are each first-sightings blocked by the 2-wave recurrence bar. This is a valid, disciplined outcome (0 is allowed when nothing clears the bar) — identical in shape to waves 11, 12, 13. Promoting off a single incident would violate the Contract's own Authoring-discipline ("wave-specific 'broke once' stays in observations until a second wave confirms"); crediting OBS-W14-2 as a VERIFY #3 recurrence would over-credit a fake recurrence (venue-kernel vs discriminator-kernel; VERIFY #3's check passes on the pre-fix test), exactly the trap the wave-13 ledger pre-warned against.

**Specialist concurrence:** karen and knowledge-synthesizer INDEPENDENTLY returned identical verdicts — Candidate A (M1) DISTINCT FIRST-SIGHTING (HOLD, not a VERIFY #3 recurrence), Candidate B (hash-excluded metadata) DISTINCT FIRST-SIGHTING (HOLD, durable-not-snack), migration-journal RE-VALIDATES BUILD #4. karen's dispositive test (VERIFY #3's mock-vs-real check PASSES on the pre-M1 test → M1 cannot be its recurrence) was CONFIRMED in-source (test F incidental-version discriminator; test I shared-version mandate_id-only isolation). Net promotion 0.

---

## Footer

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "karen reality-check: A (M1 differential-discriminator) DISTINCT FIRST-SIGHTING HOLD — not a VERIFY #3 recurrence (venue vs discriminator kernel; #3's check passes on the pre-fix real-DB test); B (hash-excluded metadata) DISTINCT FIRST-SIGHTING HOLD — durable+testable, not a snack, but 1st occurrence"
  - "knowledge-synthesizer recurrence: migration-journal RE-VALIDATES BUILD #4 (not re-promotable); M1 DISTINCT (orthogonal to VERIFY #3: execution venue vs fixture discriminator); hash-excluded metadata DISTINCT first-sighting (no BUILD 1-7 match); 0 held candidates recurred"
  - "IN-SOURCE confirmation (recordkeeping-gate.e2e-spec.ts): test F discriminates A/B by VERSION_A_ID/VERSION_B_ID (incidental); test I shares SHARED_VERSION_ID, isolates only by mandate_id column (fault-killing count=2/count=0) — B-6/V-3 prose exact"
  - "net promotion 0 across BUILD/VERIFY/CI/T — one re-validation of an existing rule, two distinct first-sightings, five held candidates non-recurrent"
note: >
  Priority carry-forward = OBS-W14-2 (differential-test discriminator, pre-authored VERIFY #4 candidate, format-checked).
  Secondary = OBS-W14-3 (hash-excluded additive metadata on an HMAC-chained log, pre-authored BUILD candidate, own clock).
  Held from prior waves and unchanged (all NON-RECURRENCE this wave): BUILD #8 slot (W11-1 store-binding OR W12-1 caller-FK),
  CI-PRINCIPLES #1 (W12-2 self-migrate race), VERIFY #3 (W13-1 mock-only row-membership derivation), W13-2 read-path
  completeness gap. Wave-14's Ghost-Green migration-journal is a BUILD #4 re-validation — the existing rule fired and the
  head-builder gate enforced it (not a new principle).
```
