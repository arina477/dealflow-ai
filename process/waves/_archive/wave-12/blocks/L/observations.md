# Wave 12 — L-block Observations (reality-checked retro)

**Wave:** 12 — M6 pipeline / deal-stage tracking (fixed 7-stage board + append-only audited event timeline).
**Author:** head-learn (L-2 distill gate).
**Vetted by:** knowledge-synthesizer (cross-wave recurrence) + karen (rule-quality reality-check).
**Net promotion this wave:** 0 across all `*-PRINCIPLES.md` files. Every observation is a FIRST-sighting; none clears the 2-waves-recurrence bar. Cap of "at most one per file" is not reached.

Each entry is logged with wave-12 as first-sighting so a later wave's L-1 author can detect recurrence deterministically instead of re-deriving. Recurrence in any later wave promotes on sight (subject to head-X approval + format contract), no re-litigation.

---

## What shipped

- M6 pipeline half: fixed 7-stage board (shortlisted → contacted → engaged → diligence → offer → closed → withdrawn, derived from the shared `pipelineStageEnum.options`) + append-only `pipeline_events` audited timeline.
- 3 mutations (enroll / transition / addNote) each wrap M2 `AuditService.append(input, tx)` LAST-in-txn inside one `runInTransaction`; audit-throw → real Postgres ROLLBACK → zero orphan `pipeline` / `pipeline_events` rows. Proven by an un-mocked real-DB e2e (`pipeline-gate.e2e-spec.ts`, 4/4 GREEN) at the exact deployed commit `989fae9`.
- Migration 0011 additive-only (2 new tables + 2 new enums + FKs into existing tables; zero ALTER/DROP of existing tables). RBAC write-vs-read split (advisor/compliance write; analyst read-blocked → 403; anon → 401). TRACKING-only: zero send/email/AI-draft affordance (AC-STRIP clean on the deployed authed board).
- Deferred (out of scope this wave): automated stage advance, actual send-path, AI-drafting (founder LLM-spend gate).

## Systemic root-cause map (not human-blame)

The load-bearing defects this wave were NOT coding slips — they were **safeguard gaps that unit-level mocking / single-value fixtures rendered invisible**, then surfaced by durable adversarial controls (B-6 Phase-2 `/review`, a real-DB rollback e2e). The learning targets the missing safeguards, not the authors. Two independent classes surfaced: a caller-trust provenance gap on a compliance FK association (H-1), and a CI test-infra concurrency hazard (migration race). Both were caught and fixed in-gate; neither escaped to the deployed artifact.

---

## Observation ledger (first-sightings — carry-forward)

### OBS-W12-1 — Caller-supplied-FK provenance (HIGHEST LEVERAGE; priority carry-forward)

**What:** `enroll` accepted a caller-supplied `mandateId` and wrote it onto the new `pipeline` row (and, transitively, every downstream `pipeline_events` + `audit_log_entries` row) WITHOUT verifying that the enrolled SOURCE row (an `outreach` or `match_candidate`) actually belonged to that mandate. Both the `mandateId` and the source id are valid in-domain UUIDs, so every column-level DB FK constraint is individually satisfied — the violated invariant is CROSS-ROW relational consistency ("does this source belong to the mandate the caller claims?"), which no FK constraint enforces. An advisor could thus write a FALSE mandate association into the pipeline row and its immutable audit trail. Single-mandate test fixtures hid it entirely. Fix: the eligible-source guard now projects the source's OWN `mandate_id` (`outreach.mandate_id` / `match_run.mandate_id` via the existing join) and rejects 400 in-tx before `insertPipeline` when `source.mandateId !== input.mandateId`, for BOTH source types; 2 divergent-mandate spec tests added.

**Root class:** Caller-trust provenance gap on a written FK association. DISTINCT from BUILD #6 (which governs WHICH predicate a compliance guard measures — semantic vs structural-proxy-count) and #7 (tx-scoped read handle). An enroll that checked the correct status predicate (BUILD #6) but still trusted the caller's `mandateId` would pass #6 and still carry this defect. Also distinct from any wave-5 FK id-space observation (that is a wrong-domain-token-as-FK error the DB rejects; here every FK is in-domain and DB-valid). Clean rule space.

**Systemic (not human):** single-value (single-mandate) fixtures made the cross-row inconsistency structurally unreachable in the unit suite. The safeguard that caught it — adversarial `/review` at B-6 Phase-2 (H-1) — is the durable control. Fixed and re-verified in-gate; never escaped (V-3 confirmed the guard live: FK-guarded 404, not a 500).

**Recurrence:** FIRST occurrence (wave-12). No prior OBS in waves 1-11 covers cross-row FK-association provenance. Holds in observations until a second wave confirms.

**Pre-authored BUILD #8 candidate (format-checked + karen-APPROVED for format/impact; DO NOT promote until a later wave confirms recurrence):**
```
8. Verify a caller-supplied association FK against the linked resource's own source-of-truth before writing it.
   Why: A trusted caller FK lets a mutation forge a cross-tenant association into the row and its audit trail.
```
_(karen APPROVED this on format + existential-impact grounds; it is BLOCKED only by the 2-wave recurrence bar. Note: the pre-authored wave-11 carry-forward already reserved BUILD #8 for OBS-W11-1; whichever of the two recurs FIRST claims #8 and the other renumbers on promotion. Both remain HOLD.)_

### OBS-W12-2 — Parallel self-migrating e2e suites race the shared CI DB

**What:** wave-11 introduced ONE self-migrating real-DB e2e (outreach-gate); wave-12 added a SECOND (`pipeline-gate.e2e`). Both call drizzle `migrate()` against the same `dealflow_test` database; under parallel vitest workers the two migrate() calls raced to a duplicate-object `23505`. Fix: a shared race-safe migrate helper (`pg_advisory_lock` + tolerate-already-applied), so migration is serialized and idempotent across workers. Disjoint per-suite fixture namespaces let the two suites co-exist on the shared DB.

**Root class:** Test-infra concurrency hazard — N independently self-migrating suites contend on one shared schema-version store under parallel execution. NOT the same sub-class as wave-11's OBS-W11-3 (uncollected-test Ghost Green — a test-runner include-glob non-collection failure). Contention ≠ non-collection.

**Recurrence — carefully scoped:** FIRST occurrence of the migration-RACE class (wave-12). The race is architecturally impossible until a SECOND self-migrating suite exists; wave-11 had exactly one, so no race could have been observed there. "Second self-migrating suite" is NOT the same as "second observation of the race" — the race itself was observed exactly once, this wave. It therefore does NOT satisfy the 2-wave recurrence bar, and it is NOT a recurrence of OBS-W11-3 (different sub-class). Holds in observations. On the NEXT self-migrating e2e suite / next race sighting, the correct home is CI-PRINCIPLES (currently zero rules), as a deterministic serialize-migration guard.

**Pre-authored CI-PRINCIPLES #1 candidate (format-checked + karen-authored/APPROVED; DO NOT promote until a second race sighting confirms):**
```
1. Serialize schema migration across parallel test workers sharing one database behind an advisory lock.
   Why: Concurrent migrate() calls on a shared test DB race to a duplicate-key failure and flake CI.
```
_(BLOCKED only by the 2-wave bar. karen initially read this as a 2nd occurrence; head-learn corrected: the migration-race is first-sighted in wave-12 because the second racer is what creates the race, not a re-fire of a prior race.)_

### OBS-W12-3 — Immutable-audit-log blocks fixture teardown (weak; ambiguous home)

**What:** deleting a fixture `users` row that is FK-referenced (`ON DELETE SET NULL`) by the trigger-protected immutable `audit_log_entries` fails: the `SET NULL` UPDATE is rejected by the immutability trigger (`P0001`). Fix: retain such fixtures (mirror the wave-11 outreach-gate pattern — do NOT hard-delete rows referenced by an append-only/immutable log); scope per-test cleanup to only the wave's own tables (`pipeline` / `pipeline_events`) in-body.

**Root class:** Test-fixture lifecycle gotcha against a trigger-enforced immutable table. Narrow surface (fires only when a new teardown hard-deletes a row referenced by an immutable-log FK).

**Recurrence:** FIRST occurrence (wave-12). Both specialists rate it weak-to-moderate: low cross-wave leverage and an ambiguous principles home (test-writing-principles, not a scoped `*-PRINCIPLES.md`). REJECTED as promotable now (single-occurrence snack). Holds in observations; promote only if it recurs AND a clear home is resolved.

### OBS-W12-4 — Reused-authority store-binding (wave-11 OBS-W11-1 carry-forward) — NON-RECURRENCE

**What (wave-11 original):** reusing a shared decision authority that resolves EXCLUSIVELY from store X, while the new flow wrote decision inputs into a DIFFERENT store the authority never reads → the guard evaluated a vacuously empty set. Pre-authored as BUILD #8, "promotes on wave-12 recurrence."

**Wave-12 disposition — DID NOT RECUR (exculpatory):** wave-12 reused M2 `AuditService` but called `append()` CORRECTLY — it wrote directly to `audit_log_entries`, the exact store `AuditService` reads/writes, as the last statement in each `runInTransaction` block, proven by the real-DB rollback e2e. `pipeline_events` is a new domain event log, not a decision-authority store the AuditService fails to reach. There is no new approval-state store that an authority silently ignores. The distinct wave-12 defect (OBS-W12-1, caller-supplied FK provenance) is a different class, not a store-binding gap. Wave-12 correctly APPLIED the store-binding pattern rather than re-firing it.

**Recurrence:** NON-RECURRENCE. OBS-W11-1 / pre-authored BUILD #8 remains HOLD-in-observations; carry forward to a later wave. A wave that correctly applies a pattern does not confirm it for promotion — only a genuine re-fire does.

---

## Promotion decision (this wave)

| Candidate | Durable/enforceable | Dup? | 2-wave bar | Verdict |
|---|---|---|---|---|
| OBS-W12-1 caller-supplied-FK provenance | Yes (strong; format+impact karen-APPROVED) | No (clean space vs BUILD #5/#6/#7, vs W5 id-space) | FAILS (1st wave) | HOLD-in-observations (priority carry-forward) |
| OBS-W12-2 parallel self-migrate race | Yes (CI guard; format karen-APPROVED) | No (distinct from OBS-W11-3 Ghost-Green) | FAILS (race 1st-sighted this wave) | HOLD-in-observations (→ CI-PRINCIPLES #1 on 2nd race sighting) |
| OBS-W12-3 immutable-log teardown | Weak (narrow; ambiguous home) | No | FAILS | REJECT-snack |
| OBS-W12-4 reused-authority (W11 carry-fwd) | Yes (already assessed strong) | n/a | NON-RECURRENCE | HOLD (W11 BUILD #8 candidate) |

**Promoted:** 0 to BUILD, 0 to CI, 0 to VERIFY, 0 to any T-layer. Every candidate is first-occurrence (or a confirmed non-recurrence); the 2-wave recurrence bar blocks all promotions regardless of individual rule quality. This is a valid, disciplined outcome (0 is allowed when nothing clears the bar) — identical in shape to wave-11's net-0. Promoting a rule off a single incident would violate the Contract's own Authoring-discipline ("wave-specific 'broke once' stays in observations until a second wave confirms").

**Specialist disagreement adjudicated:** knowledge-synthesizer ruled all four first-sightings (0 promotions). karen APPROVED A + B on rule QUALITY but did not apply the recurrence gate; she explicitly flagged that candidate B's "2nd occurrence" claim must be verified against the wave-11 ledger. Verified: wave-11 OBS-W11-3 is the Ghost-Green/glob sub-class, NOT a migration race — so B is a first-sighting and drops per karen's own stated fallback. head-learn adopts the recurrence gate as dispositive: quality-APPROVED but bar-BLOCKED → HOLD, not promote.

---

## Footer

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "knowledge-synthesizer recurrence: OBS-W12-1/2/3 first-sighting; OBS-W12-4 (W11 reused-authority) NON-RECURRENCE — AuditService wired correctly to its own store"
  - "karen rule-quality: A (FK-provenance) + B (advisory-lock) format+impact APPROVE, C (immutable-teardown) REJECT-snack; A/B bar-blocked by head-learn on 2-wave gate"
  - "net promotion 0 across BUILD/CI/VERIFY/T — every candidate first-occurrence or non-recurrence"
note: >
  Priority carry-forward = OBS-W12-1 (caller-supplied-FK provenance, pre-authored BUILD #8 candidate, karen-format-APPROVED).
  Secondary = OBS-W12-2 (parallel self-migrate race, pre-authored CI-PRINCIPLES #1 candidate). Both promote on genuine
  next-wave recurrence, no re-litigation. wave-11 OBS-W11-1 (reused-authority store-binding) did NOT recur; stays HOLD.
```
