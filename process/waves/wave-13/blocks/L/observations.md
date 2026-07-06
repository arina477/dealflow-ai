# Wave 13 — L-block Observations (reality-checked retro)

**Wave:** 13 — M6 audit-log / recordkeeping EXPORT (compliance-defensibility: filtered read + live integrity verify + tamper-evident downloadable export package, server-side SoD/RBAC, read-only over the immutable M2 hash chain).
**Author:** head-learn (L-2 distill gate).
**Vetted by:** karen (rule-quality + recurrence-honesty reality-check).
**Net promotion this wave:** 0 across all `*-PRINCIPLES.md` files. Every candidate is either a first-sighting of its own kernel, a non-falsifiable snack, or a fake-recurrence of a held candidate. Cap of "at most one per file" is not reached.

Each entry is logged with wave-13 as first-sighting so a later wave's L-1 author can detect recurrence deterministically instead of re-deriving. Recurrence in any later wave promotes on sight (subject to head-X approval + format contract), no re-litigation.

---

## What shipped

- M6 recordkeeping-export vertical: filtered compliance READ over the live M2 immutable HMAC hash chain; live integrity VERIFY (`AuditVerifier.verifyChain` → `{ok, entriesChecked}`) over the real accumulated production chain; a tamper-evident downloadable export package (`{entries + per-entry hashes, verifyResult, manifest{chainRoot, tailHash, entryCount}}`).
- The export appends EXACTLY ONE `export_generated` audit row LAST-in-txn inside one `runInTransaction` (rollback-on-audit-fail: no package without its row); proven live by a verify-delta 309→310 (+1) at deployed commit `2ec4953`.
- Server-side SoD/RBAC: advisor export 403 + advisor verify 403 (RolesGuard, not UI-hidden) + anon 401; advisor read server-scoped to own-outreach. M2 read-validation clamps `limit≤200` and rejects a non-UUID `mandateId` with 400 at the boundary (never 500, never unbounded).
- Read-only over the immutable log: zero update/delete method in the module; zero edit/delete/send/AI affordance on the deployed authed HTML (AC-STRIP clean both roles). `export_generated` added additively to the shared enum on a text `action` column — B-0 correctly skipped (zero schema change, zero migration).
- Deferred (out of scope this wave): send/webhook + auto-advance (founder email key), AI-drafting (LLM-spend gate), PDF/multi-format export, producer-side gate mandate-attribution, and the DEV-2 mandate-derivation real-DB e2e (HIGH-priority hard-gated follow-on → N-block seed candidate).

## Systemic root-cause map (not human-blame)

The load-bearing defects this wave were NOT coding slips — they were **safeguard/coverage gaps that unit-level mocking rendered invisible**, then surfaced by durable adversarial controls (B-6 Phase-2 `/review`, live C-2 verification). Two distinct classes surfaced, both caught in-gate, neither escaped to the deployed artifact:

1. A load-bearing row-selecting derivation SQL (the mandate-scope 8-branch compound-OR) verified ONLY against a param-forwarding mock — the join/WHERE selection logic never executed against real Postgres (DEV-2).
2. A regulator-facing scoped query that originally OVERCLAIMED completeness in its docstring (falsely claiming it captured `gate-evaluate` rows), corrected to an honest documented exclusion rather than a lossy over-capturing branch (B-6 H1).

The learning targets the missing safeguards, not the authors.

---

## Observation ledger (first-sightings — carry-forward)

### OBS-W13-1 — Mock-only row-membership derivation (HIGHEST LEVERAGE; priority carry-forward — NEW kernel)

**What:** The load-bearing mandate-scope derivation SQL (`buildConditions` mandate fragment — an 8-branch per-`resource_type` compound-OR with FK subselects + two-hop joins that decides WHICH audit rows belong to a mandate) is unit-tested ONLY against a mocked repo that asserts the service forwards `mandateId`. The join topology, WHERE predicates, and row-membership logic were never executed against real Postgres in B/T/V; C-2's live export used empty scope `{}`, so the mandate branch never ran live either. A wrong WHERE/JOIN that drops or duplicates rows in a regulator package would go fully undetected.

**Root class:** Over-mocking a **row-selection / result-set-membership** derivation. This is a DISTINCT sub-species from the two prior over-mocking observations, and the distinctness is load-bearing:
- **NOT VERIFY #1** (echoing-stub / serialization). VERIFY #1's kernel is *app-vs-DB wire-format divergence* (how a selected VALUE is represented). A serialization-clean stub would still miss a row-membership bug — no value is echoed here; the failure is *which rows match*. A reviewer applying only VERIFY #1 correctly concludes "a param-forwarding mock is out of my serialization scope" and the selection gap ships — which is exactly what happened.
- **NOT wave-11 OBS-W11-2** (mock-the-claim: the collaborator whose behavior IS the claim is stubbed). That was already adjudicated a re-fire of VERIFY #1. This is a third, separate over-mocking kernel.

**Systemic (not human):** the mock exercises none of the selection logic; the derivation is correct-by-inspection (`/review` + head-verifier independently read all 8 branches, casts, no-double-count, injection-safe) but unproven-by-execution. The durable control is a seeded real-DB integration test asserting the returned row SET (multi-producer rows under one mandate INCLUDED; gate-evaluate EXCLUDED per the documented H1 limitation) — carried live as DEV-2 (N-block seed candidate).

**Recurrence:** FIRST occurrence of the row-membership-derivation-mock-only kernel (wave-13). By the same distinctness that makes it a non-dup of VERIFY #1/W11-2, it is a first-sighting of its OWN kernel — it cannot be both distinct-enough-to-promote and a 3rd-fire-of-an-existing-rule. Holds in observations until a second wave confirms.

**Pre-authored VERIFY #3 candidate (format-checked + karen-APPROVED for format; DO NOT promote until a later wave confirms recurrence):**
```
3. Execute any row-selecting derivation query against seeded real Postgres, not a mock that only asserts the service forwarded a filter param.
   Why: A param-forwarding mock exercises none of the join/WHERE selection logic, so dropped or duplicated rows ship undetected.
```
_(karen APPROVED on format + distinct-`Why` grounds — it will not collapse at a future dedup pass against VERIFY #1. BLOCKED only by the 2-wave recurrence bar. NOTE: the DEV-2 follow-on writing this real-DB test and then finding the derivation wrong is NOT the recurrence — the recurrence clock is for the mock-only-testing PATTERN re-firing on a future wave's derivation SQL.)_

### OBS-W13-2 — Read-path documented-completeness-gap (distinct from W11-1 store-binding — NEW class, NON-RECURRENCE of BUILD #8)

**What:** Building a derived query over another module's records requires knowing HOW that module keys them: the compliance-gate keys its `gate-evaluate` audit rows to `resource_type='outreach-template-version'` (mandate-agnostic), so the mandate-scope derivation cannot attribute them to a mandate via `resource_id=mandateId`. The original docstring FALSELY claimed the derivation captured gate-evaluate. FIX: corrected the docstring to an honest documented limitation (gate-evaluate rows are template-version-keyed, cross-mandate, obtainable via full-chain/time-range export and provable via `verifyChain`, deliberately excluded from mandate-scope) and DELIBERATELY did NOT add an `outreach-template-version` branch that would OVER-capture other mandates' gate decisions (worse than omission for a regulator package).

**Root class:** Read/derivation-path completeness gap over a reused authority's keying scheme, resolved by honest documentation. This is a DISTINCT class from wave-11 OBS-W11-1 (reused-authority STORE-BINDING), and the framing of it as a W11-1 re-fire is a FAKE recurrence:
- **Write-path vs read-path:** W11-1 is a WRITE-path wiring gap (the flow wrote decision inputs into a store the authority never reads). Here the repository is READ-ONLY over `audit_log_entries`; nothing is written wrong (the only write is `export_generated`).
- **Silent-blocked-guard vs deliberately-documented-gap:** W11-1's harm is a liveness defect — a guard over a vacuously empty set, a state-advancing write SILENTLY unreachable. Here there is NO guard, NO state machine, NO unreachable transition, NO incorrect behavior; the export returns exactly the mandate-attributable rows it claims. W11-1's load-bearing word is **silent**; this is the OPPOSITE of silent — the exclusion is deliberate, reasoned, and documented in three code locations. The only overlap is lexical surface ("reused authority," "resolves from a key").

**Recurrence:** DISTINCT-CLASS FIRST-SIGHTING (wave-13). Does NOT satisfy the 2-wave bar for wave-11 BUILD #8 (store-binding) — leave BUILD #8 on HOLD. Starts its OWN 2-wave clock; do not fold into BUILD #8.

### OBS-W13-3 — Compliance-completeness docstring honesty (weak; non-falsifiable — REJECTED as promotable)

**What:** A scoped query that silently omits rows (the gate-evaluate exclusion of OBS-W13-2) must DOCUMENT what it excludes rather than overclaim completeness; for a regulator-facing artifact an honest documented exclusion beats a lossy branch that over-captures.

**Root class:** The engineering JUDGMENT here (correcting a false docstring; declining a lossy over-capturing branch) was excellent. But the GENERALIZED rule — "write honest docstrings / document what a query excludes" — is not deterministically checkable. It fails the same test as the Contract's rejected "Write good error messages": no subsequent reviewer can mechanically check "is this docstring honest about its omissions" the way BUILD #4 (journal `when`) or BUILD #5 (real return shape) can be checked.

**Recurrence:** FIRST occurrence, AND independently disqualified as a non-falsifiable snack. REJECTED as promotable now or on recurrence AS PHRASED. Holds in observations only as context for OBS-W13-2. (The falsifiable kernel that survives is OBS-W13-1's "execute the derivation against real Postgres" — that is where "did the query actually capture what it claims" becomes a runnable assertion.)

### OBS-W13-4 — Prior held candidates (BUILD #8 store-binding + BUILD #8 caller-FK + CI #1 self-migrate race) — NON-RECURRENCE

**What:** Wave-11 OBS-W11-1 (reused-authority store-binding), wave-12 OBS-W12-1 (caller-supplied-FK provenance), and wave-12 OBS-W12-2 (parallel self-migrate race, CI #1 candidate) all remain HOLD pending a genuine second sighting.

**Wave-13 disposition — DID NOT RECUR:** wave-13 wrote nothing into a mis-bound store (store-binding NON-RECURRENCE — OBS-W13-2 is a read-path class, not a write-path store-binding gap); trusted no caller-supplied association FK (the export is read-only, mandateId is a filter not a written association — caller-FK NON-RECURRENCE); and added no second self-migrating e2e suite (B-0 skipped, zero new migration — self-migrate-race NON-RECURRENCE). All three carry forward unchanged.

**Recurrence:** NON-RECURRENCE for all three. BUILD #8 and CI #1 candidates stay HOLD.

---

## Promotion decision (this wave)

| Candidate | Durable/enforceable | Dup? | 2-wave bar | Verdict |
|---|---|---|---|---|
| OBS-W13-1 mock-only row-membership derivation | Yes (strong; format karen-APPROVED) | No (distinct from VERIFY #1 serialization + W11-2 behavior-claim) | FAILS (own-kernel 1st-sighting) | HOLD-in-observations (pre-authored VERIFY #3; priority carry-forward) |
| OBS-W13-2 read-path documented-completeness-gap | Moderate | No (distinct-class, NOT W11-1 store-binding re-fire) | FAILS (distinct-class 1st-sighting) | HOLD-in-observations (own 2-wave clock; NOT BUILD #8) |
| OBS-W13-3 docstring honesty | No (non-falsifiable) | n/a | FAILS | REJECT-snack |
| OBS-W13-4 W11/W12 held candidates | n/a | n/a | NON-RECURRENCE | HOLD (unchanged) |

**Promoted:** 0 to BUILD, 0 to VERIFY, 0 to CI, 0 to any T-layer. Every candidate is a first-occurrence (or a confirmed non-recurrence); the 2-wave recurrence bar blocks all promotions regardless of individual rule quality. This is a valid, disciplined outcome (0 is allowed when nothing clears the bar) — identical in shape to waves 11 and 12. Promoting off a single incident would violate the Contract's own Authoring-discipline ("wave-specific 'broke once' stays in observations until a second wave confirms"); crediting the framed wave-11 recurrences would over-credit a fake recurrence (OBS-W13-2 is read-path, not W11-1's write-path store-binding) and a near-dup misattribution (OBS-W13-1 is a distinct kernel, NOT the already-covered VERIFY #1 lineage).

---

## Footer

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "karen reality-check: net promotion 0 — C1 distinct-but-first-sighting (HOLD, not dup of VERIFY #1), C2 read-path distinct-class (NOT W11-1 re-fire, BUILD #8 stays HOLD), C3 non-falsifiable snack (REJECT)"
  - "recurrence audit vs wave-11/12 ledger: OBS-W11-1 store-binding NON-RECURRENCE (read-path this wave), OBS-W12-1 caller-FK NON-RECURRENCE (read-only export), OBS-W12-2 self-migrate-race NON-RECURRENCE (B-0 skipped, no new suite)"
  - "net promotion 0 across BUILD/VERIFY/CI/T — every candidate first-occurrence or non-recurrence"
note: >
  Priority carry-forward = OBS-W13-1 (mock-only row-membership derivation, pre-authored VERIFY #3 candidate, karen-format-APPROVED).
  Secondary = OBS-W13-2 (read-path documented-completeness-gap, own 2-wave clock). Held from prior waves and unchanged:
  BUILD #8 (W11 store-binding OR W12 caller-FK, whichever recurs first claims #8), CI-PRINCIPLES #1 (self-migrate race).
  DEV-2 mandate-derivation real-DB e2e carried live to N-block as a HIGH-priority hard-gated follow-on (this is the fix for
  OBS-W13-1's live gap; it is NOT the recurrence event — the recurrence clock is for the mock-only PATTERN re-firing).
```
