# Wave 9 — L-block Observations

Buyer-universe builder (M4 final: assemble / filter / enrich / gaps / submit) shipped +
live-verified at commit `937ae18`, completing Milestone M4. Synthesized by
`knowledge-synthesizer` against wave-9 deliverables (B-6 review, C-2 deploy-and-verify,
V-1/V-3) + the wave-5..8 carry-forward queue, then reality-checked and dispositioned by
`head-learn`. Cross-wave glob path is canonical `blocks/L/observations.md` (future L-2 reads
`_archive/wave-*/blocks/L/observations.md`).

Reviewer note (head-learn): every claim below was verified against the actual deliverable
text before dispositioning — the 7 B-6 CRITICALs against `stages/B-6-review.md` (Phase 2:
"7 CRITICAL fixed (8e40c08 + 6402d62)"); the C-2-first-try / no-fix-cycle claim against
`C-2-summary.md` ("NO fix-cycles (B-6 /review caught all 7 CRIT pre-deploy)"); the honest
partial-filter, idempotent-container, and submit-guard live behavior against the V-3
proof-carrying verdict at `937ae18`. The T-5 W9-2 (`/buyer-universe-data` 404) was a
FALSE-POSITIVE (deploy-propagation window — Karen independently reproduced a live **401**,
proving the rewrite reaches the API; not a missing route). Migration 0008 journal `when`
ascending — BUILD rule 4 held (no Ghost Green). M4/M5 boundary held live (byte-scan: 0
fitScore/score/rank/rationale; no rank column). CHANGELOG `[0.9.0]` is already authored
(L-1 doc). **M4 is now structurally COMPLETE (both bundles shipped + live-verified) — but
head-learn does NOT hand-transition the milestone; N-block (BOARD under `automatic`) judges
milestone completion.**

**Positive systemic signal this wave:** C-2 PASSED FIRST-TRY with zero fix cycles. All 7
CRITICALs were caught at B-6 `/review` pre-deploy — the compounding cross-wave lessons
(BUILD rule 5, VERIFY rule 2's adversarial-review mandate) have shifted defect-catching
earlier in the pipeline. This is the intended payoff of the distillation loop.

---

## OBS-W9-1: A one-per-parent container entity needs a DB UNIQUE constraint + advisory lock, not a service-level find-or-insert

**Systemic root:** No build convention or B-block spec template requires that an "at most one row per parent" cardinality invariant be encoded as a DB UNIQUE constraint. Without it, a service-level "does a row exist? return it : insert" check has a race window — two concurrent callers both read zero rows and both insert, producing duplicate containers. The advisory lock (`pg_advisory_xact_lock` on the mandate id) is the runtime mitigation; the DB `UNIQUE(mandate_id)` is the structural invariant. Both layers were needed; neither was in the shipped-first implementation. Invisible to typecheck + unit tests (a mocked repository trivially returns the existing row without racing).

**Plan-authoring defect trace:** The B-block spec (task 92a8ff3f) described assemble idempotency in prose ("re-assemble returns the existing universe") but carried no requirement to express "one universe per mandate" as a schema-level uniqueness constraint. The plan treated idempotency as an application-logic property rather than a DB-enforced invariant, so the initial implementation shipped without the constraint or the lock.

**Cross-wave lineage:** FIRST-OBSERVATION of the write-path duplication sub-variant. Confirms OBS-W8-4 (compliance-config ambiguity must 409) only at the FAMILY level ("uniqueness needed at the DB layer, not the application layer"), not as the same firing: W8-4 is READ-path non-determinism (`LIMIT 1` with no `ORDER BY` silently picks a row) fixed by loud 409; W9-1 is WRITE-path duplication (concurrent inserts race) fixed by advisory-lock + idempotent upsert. Distinct failure mode, distinct fix shape.

**Severity:** strong (two persisted compliance containers for one mandate is a correctness defect regardless of traffic). **Candidate file:** BUILD. **2-wave gate:** NOT MET (first distinct observation; family-adjacent to W8-4 but not the same firing). Carry-forward — watch any future "one-per-parent" container shipped without a DB UNIQUE.

---

## OBS-W9-2: A state-advancing compliance write must guard on the semantically-required predicate, not a structurally-available proxy count — PROMOTED to BUILD rule 6

**Systemic root:** The submit guard was authored as "candidate count > 0" (a structural availability check). The invariant it was designed to protect is "at least one buyer has been positively INCLUDED for this mandate." Those diverge when a universe holds default/un-triaged candidates — 4 total, 0 included still passed the total-count guard, so a universe with zero selected buyers could be submitted as ready-to-rank to the M5 engine. No build convention requires that a state-machine guard be expressed in terms of the semantically-relevant condition for the invariant, rather than the easiest-to-query count. The correct precondition was three semantic conditions: `included_count > 0 AND untriaged_count = 0 AND status != draft`.

**Plan-authoring defect trace:** The B-block spec for `submitAsActor` (task c907731f) described the guard as preventing an "empty" submit without defining "empty" in state-machine terms (zero-total vs zero-included). Because "empty" was left semantically underspecified, the implementation defaulted to the simpler total-count query. The spec should have stated the transition precondition in terms of the invariant it protects.

**Cross-wave lineage:** CONFIRMS-PRIOR OBS-W8-3 (wave-8, FIRST-OBSERVATION, strong, BUILD, carry-forward). The family: a write that advances irreversible compliance state must carry a semantic-correctness precondition, not just a structural availability check. Wave-8 = the guard was ABSENT (no state check on a PATCH to an active mandate → edit-after-activation silent correctness failure). Wave-9 = the guard was PRESENT but measured the WRONG condition (total-count instead of included-count → submittable-empty). Same structural gap — the spec did not express the transition precondition in terms of the invariant being protected — distinct sub-variant (absent guard vs guard on wrong metric). SECOND firing across waves. **2-wave gate: MET.** Distinct from BUILD rule 5 (client parse-shape, a wire-format concern, not a state-machine precondition) and from OBS-W8-4 (read-path query non-determinism).

**Severity:** strong (a ready-to-rank universe with zero included buyers is a correctness defect at the M4→M5 handoff). **Candidate file:** BUILD. **2-wave gate:** MET.

**Disposition:** PROMOTED to **BUILD rule 6** (karen APPROVE; deterministic linter PASS). Scoped to the shared root so it covers BOTH failure modes of the family (absent guard AND guard-on-wrong-metric): a compliance state-advancing write must guard on the semantic predicate the transition protects, not a structural proxy. Highest-value, most cross-cutting, 2-wave-confirmed candidate this wave; enforceable against any state-advancing write in the compliance state machine.

---

## OBS-W9-3: When a persisted filter references data dimensions the underlying store cannot support, the unsupported dimensions must be recorded in provenance + audit — a silent no-op filter claiming "filtered" is a compliance-integrity defect

**Systemic root:** No build convention requires a filter/matching operation to account for the case where its input criteria reference dimensions absent from the underlying data. The filter was built from four criteria dims (sector, geography, size-band, deal-type) but M3 companies carry only `sector`, so the filter silently reduced to a single-dimension filter while reporting `status='filtered'` — the caller and the audit believed all four criteria applied. Not a runtime error; the system returns results that misrepresent selection rigor. Fixed HONESTLY: token-match on the supported dim, and the unsupported dims RECORDED in candidate provenance + the audit payload (`partialFilter:true`) — not suppressed and not falsely claimed as applied.

**Plan-authoring defect trace:** The B-block spec (task 92a8ff3f) described filter as "narrows per mandate criteria dims, records include/exclude per candidate" without requiring the implementation to (a) enumerate which criteria dims the underlying schema supports, or (b) record which dims were NOT applied. The prior wave-8 jenny D1 note ("only sector aligns to M3") was an informal design-review comment — never a formalized OBS carry-forward — so it was not present in the spec-authoring context as a named constraint.

**Cross-wave lineage:** FIRST-OBSERVATION. The wave-8 D1 note was an informal jenny design comment, NOT a formalized carry-forward observation with an OBS identifier and NOT in the wave-8 carry-forward queue — it does not count as a prior firing for the 2-wave gate. Shares the "silent failure in a compliance-sensitive context" surface with OBS-W8-4 but the mechanism differs: W8-4 is read-query non-determinism (wrong row); W9-3 is a capability gap silently ignored (criteria not applied) while still reporting "filtered". The honest-close pattern (record the unsupported dims rather than suppress or fake them) is itself the reusable lesson.

**Severity:** strong (a filter that silently ignores criteria while reporting "filtered" gives materially incorrect information to the analyst and the audit chain in an M&A compliance context). **Candidate file:** BUILD. **2-wave gate:** NOT MET (first observation). Carry-forward — watch any future filter/search/scoring op that references criteria dims against a data store for explicit unsupported-dimension handling.

---

## OBS-W9-4 (carry-forward confirmation): the parse-shape family (BUILD rule 5) fires a THIRD wave — NOT promoted (rule already exists; caught pre-deploy)

**Systemic root:** (Carries from OBS-W7-2 / OBS-W8-2.) CRIT-1 = the SSR list-response parse assumed `z.array` but the API returns an object wrapper `{universes:[...]}`, so hydration always failed. CRIT-2 = filter/submit/enrich return a full `BuyerUniverseDetail` but the client parsed a bare row and wiped workspace state. Both are direct members of the "client parse must match the API's real return shape" family already captured at BUILD rule 5.

**Cross-wave lineage:** CONFIRMS-PRIOR BUILD rule 5 (promoted wave-8 from OBS-W8-2, itself confirming OBS-W7-2). THIRD wave of the family (W7 → W8 → W9). The rule is holding: it does not stop the defect from being AUTHORED, but it is now part of the B-6 `/review` checklist that caught BOTH firings PRE-DEPLOY — the direct cause of the C-2-first-try / zero-fix-cycle result this wave. That is the intended payoff, not a rule failure.

**Severity:** informational (rule working as intended; no new principle needed). **Candidate file:** n/a (rule 5 exists). **Disposition:** NOT promoted — do NOT re-promote an existing rule. Recorded as a confirming firing + a positive process signal. Watch: a FOURTH firing that reaches C-2/production (bypassing B-6) would warrant a VERIFY-layer rule targeting review posture, not a new BUILD rule.

---

## OBS-W9-5: Reads issued inside a `runInTransaction` block must use the transaction-scoped read variant throughout; an out-of-transaction read produces an inconsistent audit snapshot

**Systemic root:** No build convention requires that every read within a `runInTransaction` block use the tx-scoped read variant. A NestJS service method calling `this.db` directly (module-level connection) rather than the tx-parameter variant executes on a separate connection that does not see the transaction's in-flight writes, so the final audit snapshot captures pre-transaction state for some fields. Easy to introduce — the in-tx and out-of-tx variants have near-identical signatures and the compiler does not distinguish them. Fixed with InTx read variants throughout the enrich transaction.

**Plan-authoring defect trace:** The B-block spec for `enrichAsActor` required one-txn atomicity + last-in-txn audit but did not enumerate which read paths inside the transaction must be tx-scoped, leaving it to the implementation. Any service method mixing `this.db` calls and tx-parameter calls inside one `runInTransaction` carries this latent risk.

**Cross-wave lineage:** FIRST-OBSERVATION. No prior observation covers in-transaction read consistency at the service layer. Distinct from the ORM/migration families (BUILD 1-4), the parse-shape family (BUILD 5 / OBS-W8-2), the state-machine-guard family (OBS-W8-3 / W9-2 — that governs whether a write may proceed; this governs whether the data a write reads within its own transaction is consistent), and OBS-W8-4 (read-query non-determinism from no uniqueness).

**Severity:** warning (impact is an inconsistent audit snapshot — a compliance-correctness issue — not a functional failure or data corruption). **Candidate file:** BUILD. **2-wave gate:** NOT MET (first observation). Carry-forward — watch any future service method issuing reads inside `runInTransaction` for consistent tx-scoped read use.

---

## Secondary signal (informational, no candidate)

- **Unbounded assemble (perf INFO):** assemble reads ALL M3 companies in one transaction with no pagination/cap → backlog risk as the companies store grows. Not a defect at pilot scale; flagged for a future bounded-assemble or streaming-assemble task. Informational; no promotion. Distinct from the correctness observations above — this is a scale-envelope note, not a missing invariant.

---

## Cross-wave confirmation + carry-forward summary

| Obs | Cluster | Confirmation | Near-dup risk | Candidate | 2-wave gate | Disposition |
|---|---|---|---|---|---|---|
| OBS-W9-1 | one-per-parent container needs DB UNIQUE + advisory lock | FIRST-OBS (family-adjacent W8-4, write-path variant) | W8-4 (distinct: read vs write path) | BUILD | NOT MET | Carry-forward |
| OBS-W9-2 | state-advancing write guards on semantic predicate, not structural proxy | CONFIRMS-PRIOR OBS-W8-3 (2nd firing) | none (distinct from rule 5, W8-4) | BUILD | MET | **PROMOTED → BUILD rule 6** |
| OBS-W9-3 | unsupported filter dims recorded in provenance + audit, not silent no-op | FIRST-OBS (W8 D1 was informal design note) | W8-4 (distinct mechanism) | BUILD | NOT MET | Carry-forward |
| OBS-W9-4 | parse-shape family (BUILD rule 5) | CONFIRMS-PRIOR rule 5 (3rd wave) | n/a (rule exists) | n/a | n/a | Not promoted (rule exists; caught pre-deploy) |
| OBS-W9-5 | in-tx reads must use tx-scoped variant throughout | FIRST-OBSERVATION | none | BUILD | NOT MET | Carry-forward |

**Promoted this wave:** OBS-W9-2 → BUILD rule 6. One principle, format-exact, 2-wave-confirmed (CONFIRMS-PRIOR OBS-W8-3), deterministically enforceable against any state-advancing write in the compliance state machine.

**Carry-forward queue after wave-9:** OBS-W9-1 (DB UNIQUE for one-per-parent containers, BUILD, FIRST-OBS); OBS-W9-3 (unsupported filter dims in provenance/audit, BUILD, FIRST-OBS); OBS-W9-5 (InTx reads within runInTransaction, BUILD, FIRST-OBS); plus prior open: OBS-W8-1 (next.config-rewrite-vs-dynamic-page, BUILD, CONFIRMED-AND-READY — promote next wave the parse-shape family does not occupy the BUILD slot); OBS-W8-4 (compliance-config ambiguity must 409, BUILD, FIRST-OBS); OBS-W8-5 (form enum ↔ seed-data keys, BUILD, FIRST-OBS); OBS-W8-6 (VERIFY live-render method, needs mechanically-checkable rewording). Note: OBS-W8-3's carry-forward is now discharged — its family is 2-wave-confirmed and promoted via OBS-W9-2 (BUILD rule 6).
