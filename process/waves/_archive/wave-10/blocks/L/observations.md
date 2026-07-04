# Wave 10 — L-block Observations

Deterministic match spine (M5 first bundle: `match_run` + `match_candidates` + scorer + disposition + handoff) shipped and live-verified at commit `57449b6`, completing the B-6-mandated fast-fix cycle. Synthesized by `knowledge-synthesizer` against wave-10 deliverables (P-4 gate-verdict, B-6 gate-verdict + B-6-review, V-1 karen, C-2-summary, V-3-fast-fix) + waves 7-9 archived observations + current BUILD/VERIFY/CI principles files, then reality-checked and dispositioned by `head-learn` (with a second, targeted `karen` reality-check on the promotion lineage + 2-line form).

**Positive systemic signal this wave.** C-2 PASSED FIRST-TRY with zero fix cycles — SECOND consecutive wave. Both CRITs were caught at B-6 `/review` pre-deploy (VERIFY rule 2 posture, working as intended). The V-3 fast-fix (F-1 score_breakdown shape drift) is a post-deploy quality fix caught at V-1, not a C-2-breaking defect — the C-2 first-try record stands. Both hard boundaries held in CODE (byte + grep): deterministic-only (zero LLM/Anthropic/OpenAI dep or import; scorer is a pure integer function, tie-break is a stable char-code hash mod 11, not `Math.random`) and M5/M6 (handoff sets `ready_for_outreach=true` only, no outreach/send logic). CHANGELOG 0.10.0 written. **M5 is NOT complete** — the LLM-rationale bundle remains; the deterministic half only is delivered this wave.

---

## OBS-W10-1: An idempotent re-computation over a container must snapshot and restore user decisions attached to that container, not delete-then-reinsert them

**Symptom:** When `createRunAsActor` re-triggered a scoring run against an existing `match_run` container (the `buyer_universe_id` UNIQUE ON CONFLICT path), the implementation deleted all `match_candidates` and re-inserted them with `disposition='pending'`. An advisor's prior accept/reject decisions were permanently erased. The test even asserted the wipe as intended behavior, encoding the defect as a specification. B-6 Phase 2 (adversarial `/review`) caught it as CRIT-1: "re-run WIPES dispositions (compliance-first data-loss — advisor accept/reject lost on re-score)." Fixed at `8b88519`: snapshot non-pending dispositions before delete, reconcile back per still-included candidate + audit `dispositionsPreserved`; test now asserts accepted survives re-score.

**Systemic root (missing constraint/safeguard):** No build convention or B-block spec template distinguishes two idempotency semantics: (a) idempotent re-computation of a derived quantity (the scored ranking, freely recomputable) vs. (b) preservation of user decisions attached to the container (an advisor's accept/reject disposition is an irreversible human act, not a derived value). Without this distinction, a "re-run" naturally maps to "delete old output + reinsert fresh output" — correct for the derived scoring but destructive to the human decisions co-located in the same rows. The test compounded the gap: it explicitly expected `disposition='pending'` after re-run, so the defect was encoded as intended behavior and no earlier layer flagged the data-loss.

**Plan-authoring defect trace:** The B-block spec for `createRunAsActor` described idempotency in container-level terms ("one run per buyer universe via UNIQUE — re-trigger re-scores") but did not distinguish the scoring output (recomputable) from user decisions (must be preserved). The plan adopted the wave-9 structural invariant (DB UNIQUE + ON CONFLICT) but did not propagate the second-order obligation: once a container can be re-triggered, the plan must state which fields are recomputable vs. which are user-owned and must be snapshotted.

**Cross-wave lineage:** FIRST-OBSERVATION of the snapshot-and-restore variant. Family-adjacent to OBS-W9-1 (one-per-parent container UNIQUE) — that wave established the container structure; this reveals the obligation that follows once the container is re-triggerable. Distinct failure mode (duplicate container rows vs. destroyed user data) and fix shape (UNIQUE+lock vs. merge-preserving recompute). NOT a re-fire of OBS-W8-3 / BUILD rule 6 (those govern whether a state-advancing write may proceed; this governs what happens to user-owned state when a legitimate recomputation fires). OBS-W9-1 is itself an unconfirmed FIRST-OBSERVATION — a first-obs cannot found a 2-wave family on a differently-scoped first-obs.

**Severity:** strong (erasing advisor accept/reject decisions on re-score is a compliance-first data-loss; in an M&A advisory context, silent destruction of human dispositions is a correctness + audit-chain defect regardless of traffic).

**Candidate file:** BUILD. **2-wave gate: NOT MET** (first distinct observation). Carry-forward — watch any future "re-run" / "refresh" operation against a container that co-locates user-authored state with derived output.

---

## OBS-W10-2: A read inside a `runInTransaction` block must use the transaction-scoped handle; a module-level read escapes the transaction snapshot — PROMOTED to BUILD rule 7

**Symptom:** The handoff guard counting accepted candidates (`countAccepted`) was issued via `this.db` (the module-level Drizzle connection) inside the handoff transaction block. A concurrent transaction that accepted candidates after this guard read but before the handoff committed would not be visible to the guard; a still-in-flight transaction could produce an inconsistent count. B-6 Phase 2 caught this as CRIT-2, verbatim in the gate verdict: "CRIT handoff guard escaping-read (countAccepted via this.db not tx — wave-9 CRIT-5 class re-firing) → FIXED: countAcceptedCandidatesByRunIdInTx (tx snapshot)." Fixed at `8b88519`.

**Systemic root (missing constraint/safeguard):** The same structural gap documented in OBS-W9-5: no build convention flags any `this.db` call issued inside a `runInTransaction` block. The in-tx and out-of-tx repository variants have near-identical signatures; the TypeScript compiler does not distinguish them — both compile, both run, neither errors. The gap is invisible to unit tests (a mocked repository trivially returns whatever the test expects). The only mechanical signal is a code-review / grep check for `this.db` inside a transaction block.

**Plan-authoring defect trace:** The B-block spec for `handoffAsActor` required the accepted-count guard (BUILD rule 6, semantic predicate), one-txn execution, and last-in-txn audit — but did not require that the guard read use the tx-scoped variant. The implementation defaulted to the existing non-tx-scoped repository method. Exactly the gap OBS-W9-5 named: "the spec did not enumerate which read paths inside the transaction must be tx-scoped."

**Cross-wave lineage:** CONFIRMS-PRIOR OBS-W9-5 ("reads issued inside a `runInTransaction` block must use the transaction-scoped read variant throughout"). SECOND firing of the family, in consecutive waves. Wave-9 = the enrichment transaction issued `this.db` reads for audit-snapshot fields, producing an inconsistent audit payload (post-hoc inconsistency). Wave-10 = the handoff transaction issued `this.db` for the accepted-count guard that GATES whether the write may proceed — an escalated failure mode (the read is the gating precondition, not just an audit field). Same mechanism (out-of-transaction read inside a transaction block). The B-6 gate verdict explicitly labels it the "wave-9 CRIT-5 class re-firing." The "CRIT-5" tag is a cosmetic naming slip in the verdict prose (the wave-9 carry-forward is filed as OBS-W9-5); the mechanism is unambiguously the OBS-W9-5 family. **2-wave gate: MET.**

**Severity:** strong (a handoff-guard read outside the transaction can permit a handoff under a stale accepted-count; handoff = `ready_for_outreach`, a state-machine precondition with audit-chain consequences).

**Candidate file:** BUILD. **2-wave gate: MET.** **Disposition:** PROMOTED to **BUILD rule 7** (second, targeted karen reality-check APPROVE after a falsifiability rewrite widening "guards or audits" → any in-tx read; deterministic linter PASS). No near-dup with BUILD rules 1-6: rule 6 governs the guard PREDICATE (semantic vs. structural), this governs the read HANDLE/snapshot (tx-scoped vs. module-level) — orthogonal axes, confirmed by OBS-W9-5's own boundary statement. Deterministically checkable: grep `this.db` inside a `runInTransaction` lambda.

---

## OBS-W10-3: A design asset authored against the full product vision must be validated against the active bundle's capability boundary before hydrating into implementation; `design_gap_flag=false` does not imply the design conforms to bundle scope

**Symptom:** `design/matches-shortlist.html` carried false AI-capability framing — "AI Match Analysis," "AI rationale is generated," "Explainability Engine," and a fabricated cross-client "included in shortlists for 5 similar mandates" signal — that this deterministic (no-LLM) bundle must not ship. P-4 karen caught it and made stripping it a MANDATORY B-3 condition + a B-6 grep. The strip was executed (zero hits in shipped `.tsx`; all score presentation reframed "Rule-based fit score" / "Score breakdown"; CONFIRMED-STRONG at V-1, S2: 9 phrases absent), CODE-OF-CONDUCT-clean at C-2. Without the P-4 catch, the shipped UI would have claimed AI capabilities the backend does not provide.

**Systemic root (missing constraint/safeguard):** The P-block gate evaluates design assets for existence (`design_gap_flag=false` = "a design exists, no D-block needed") and product-level accuracy. It has no convention requiring that a design asset be checked against the active bundle's CAPABILITY boundary — whether any claim in the design references a capability the current bundle does not ship. A design legitimately authored against the full product vision (LLM present, cross-client signals, explainability) is correct relative to the eventual product but FALSE relative to the deterministic-only bundle shipping now. The P-4 reviewers caught it through contextual awareness of the wave's hard boundary, not a systematic design-vs-boundary audit step.

**Plan-authoring defect trace:** The P-block plan classified the design as satisfying the D-block skip condition (`design_gap_flag=false` because the HTML existed) and did not include a step to audit the design's capability claims against the wave's declared hard boundary (deterministic-only, no LLM, no cross-client signals). "Design exists" was treated as "design is valid for this bundle." A provenance risk in any multi-phase product where a partial bundle ships before the full feature is built — the design correctly represents the destination but misrepresents the current stop.

**Cross-wave lineage:** FIRST-OBSERVATION. No prior wave observation covers design-vs-bundle-capability-boundary validation (the wave-8 jenny informal design note per OBS-W9-3's own text was NOT a formalized OBS with an identifier and does not count as a prior firing). Adjacent to the BUILD rule 5 "authored-against-wrong-shape" family but distinct mechanism/fix: rule 5 covers client parse sites for API responses; this covers design copy asserting capabilities a bundle does not provide — a CODE-OF-CONDUCT/provenance risk, not a wire-format parse failure.

**Severity:** strong (a shipped UI claiming AI capabilities on a deterministic backend is a provenance violation per CODE-OF-CONDUCT — it misrepresents product behavior in a compliance-sensitive advisory tool). The P-4 catch prevented the violation; the gap is in the planning process that let the unchecked design reach B-block.

**Candidate file:** PRODUCT / DESIGN (plan-authoring convention at the P-block/B-3 interface). **2-wave gate: NOT MET** (first observation). Carry-forward — watch any future bundle shipping a partial phase of a multi-phase feature where the design was authored against the full vision.

---

## OBS-W10-4: A shared-package schema change has blast radius across all consuming packages; a single-package or cache-hit local verify masks the breakage

**Symptom:** V-3 F-1 required tightening `scoreBreakdownSchema` in the shared package (`@dealflow/shared`) to align the flat `ScoreBreakdown` type across API and web. The orchestrator pushed after verifying only the web package locally (typecheck + tests green). CI RED: the API service typecheck broke (its usage of the schema was now type-incorrect) and an API fixture for `notApplied` broke; a turbo/vitest cache had additionally masked the API breakage locally. Restored green at `cf71da8`. V-3 documents it verbatim: a shared-package schema change must be verified with a FULL `pnpm -r typecheck && pnpm -r test` (all packages) before push — a web-only verify masks API breakage, and turbo/vitest cache can mask it locally (CI runs fresh).

**Systemic root (missing constraint/safeguard):** No CI gate or pre-push convention requires that a change to a shared/contracts package be verified across all consuming packages before push. A Turborepo cache can report a prior passing result for a non-touched package during a local run, so `pnpm -r typecheck` locally may be cache-served while CI always runs fresh. The blast-radius concept (a shared package change breaks all consumers) is not enumerated in any current build/CI convention, and the correct fresh full-workspace pre-push command is undocumented for shared-package changes.

**Plan-authoring defect trace:** The V-3 fast-fix plan targeted the shape drift by aligning the schema in `@dealflow/shared` but did not enumerate which packages consume it or require a full-workspace verify (`pnpm -r`) before push. The turbo cache compounded the gap: a local `pnpm -r typecheck` can show green across all packages if non-web packages are cache-hit, making the CI red feel surprising rather than predictable.

**Cross-wave lineage:** FIRST-OBSERVATION. No prior wave observation covers shared-package blast radius or the turbo-cache false-local-green problem. Adjacent to the BUILD rule 5 / OBS-W9-4 parse-shape family (the underlying defect was a shape drift, already covered) but the VERIFICATION-SCOPE gap is genuinely distinct: rule 5 governs where you author the parse; this governs how you verify a fix to the shared source does not break other consumers. CI-PRINCIPLES is the natural home (a CI process rule — what command to run before push on shared-package changes).

**Severity:** warning (CI red during a fast-fix extends the cycle and risks a merged-broken-main state; a process-discipline issue, not a data-correctness or compliance failure). Cost this wave was bounded — main restored at `cf71da8` without a rollback.

**Candidate file:** CI. **2-wave gate: NOT MET** (first observation). Carry-forward — watch any future shared-package (`@dealflow/shared` or equivalent contracts package) change for the same single-consumer-verify pattern. NOTE: CI-PRINCIPLES currently has zero rules; an empty rules section is NOT a vacancy to fill on a first-observation.

---

## OBS-W10-5 (carry-forward confirmation): the parse-shape family (BUILD rule 5) fires a FOURTH wave — rule already exists; F-1 caught at V-1, NOT shipped to users in a broken state

**Symptom:** The `score_breakdown` jsonb written by the scorer (flat: `{sectorMatch, contactCompleteness, tieBreak, total, notApplied}`) was read by the UI as a nested shape (`breakdown?.sectorMatch as {score, weight, label}`). Accessing a property on a number yields `undefined`; all dimension bars rendered blank/NaN. V-1 karen caught it as F-1 (Medium, non-blocking). Fixed at V-3 (`4b70249`) via shared `scoreBreakdownSchema`, drizzle `.$type<ScoreBreakdown>`, and an aligned UI renderer.

**Cross-wave lineage:** CONFIRMS-PRIOR BUILD rule 5 (promoted wave-8 from OBS-W8-2, itself confirming OBS-W7-2; wave-9 OBS-W9-4 confirmed as the third wave). FOURTH wave of the family. This firing is on a PERSISTED jsonb field (written by the scorer, read by the UI) rather than a transient API-response wrapper — a sub-variant where the shape drift persists in the DB — but the root mechanism is identical: the write and read sides of a shared contract were authored against different shapes.

**OBS-W9-4 escalation trigger — NOT MET.** OBS-W9-4 wrote the precise conjunctive trigger: "a FOURTH firing that reaches C-2/production (bypassing B-6) would warrant a VERIFY-layer rule targeting review posture." The load-bearing conjunct is *reaches production*. F-1 was deployed to the production URL at C-2 but was non-crashing, caught at V-1 (post-deploy verify — the verify block working exactly as designed), and fixed same-cycle via V-3; it did NOT ship to users in a broken state undetected. A VERIFY-layer rule would be warranted only if the defect BYPASSED the verify block. The verify layer worked. The B-6 gap (persisted-jsonb variant is harder to catch at review) is real but the existing BUILD rule 5 covers the authoring defect. No new VERIFY rule warranted this wave.

**Severity:** informational (rule working as designed). **Candidate file:** n/a (BUILD rule 5 exists). **Disposition:** NOT promoted — never re-promote an existing rule. Recorded as a confirming firing + a positive process signal. Watch: a future parse-shape drift on a PERSISTED field that BYPASSES V-1 entirely and ships to users undetected would be the trigger for a VERIFY-layer rule.

---

## Cross-wave confirmation + carry-forward summary

| Obs | Cluster | Confirmation | Near-dup risk | Candidate file | 2-wave gate | Disposition |
|---|---|---|---|---|---|---|
| OBS-W10-1 | re-computation must snapshot + restore user decisions, not wipe them | FIRST-OBS (family-adjacent OBS-W9-1, distinct failure mode) | OBS-W9-1 (distinct: container uniqueness vs. content preservation); BUILD rule 6 (distinct: write-may-proceed vs. what survives it) | BUILD | NOT MET | Carry-forward |
| OBS-W10-2 | reads inside runInTransaction must use the tx-scoped handle | CONFIRMS-PRIOR OBS-W9-5 (2nd firing, escalated consequence) | none (BUILD 1-6 distinct; rule 6 = predicate, this = read-handle) | BUILD | **MET** | **PROMOTED → BUILD rule 7** |
| OBS-W10-3 | design asset must be validated against bundle capability boundary, not just existence-checked | FIRST-OBS (no prior formalized OBS) | adjacent to BUILD rule 5 family (distinct: capability claims vs. wire-format parse) | PRODUCT/DESIGN | NOT MET | Carry-forward |
| OBS-W10-4 | shared-package change must be verified across all consuming packages before push | FIRST-OBS | adjacent to BUILD rule 5 family (distinct: verification scope vs. authoring convention) | CI | NOT MET | Carry-forward |
| OBS-W10-5 | parse-shape family (BUILD rule 5) | CONFIRMS-PRIOR rule 5 (4th wave, persisted-jsonb sub-variant) | n/a (rule exists) | n/a | n/a | Not promoted (rule exists; caught at V-1, not shipped broken to users) |

**Promoted this wave: OBS-W10-2 → BUILD rule 7.** Two consecutive waves, two CRITs, identical fix shape, deterministically checkable (grep `this.db` inside `runInTransaction`). One principle, per-wave cap honored.

**Carry-forward queue after wave-10:**

- OBS-W10-1 (re-computation must snapshot user decisions, BUILD, FIRST-OBS) — watch any future "refresh"/"re-score" on a container co-locating user decisions with derived output.
- OBS-W10-3 (design-vs-bundle-capability-boundary audit, PRODUCT/DESIGN, FIRST-OBS) — watch any future multi-phase bundle where the design was authored against the full vision.
- OBS-W10-4 (shared-package blast-radius full-workspace verify before push, CI, FIRST-OBS) — watch any future change to `@dealflow/shared` or equivalent contracts package.
- OBS-W9-1 (DB UNIQUE + advisory lock for one-per-parent containers, BUILD, FIRST-OBS) — pattern absorbed this wave (`match_run` correctly used UNIQUE); no new firing. Still in queue.
- OBS-W9-3 (unsupported filter dims recorded in provenance/audit, BUILD, FIRST-OBS) — pattern absorbed this wave (scorer used `notApplied` provenance); no new firing. Still in queue.
- OBS-W8-1 (next.config rewrite shadows dynamic page, BUILD, CONFIRMED-AND-READY, gate MET) — no competing firing occupied the BUILD slot beyond OBS-W10-2; remains promotable next wave when the BUILD slot is free.
- OBS-W8-4 (compliance-config ambiguity must 409, BUILD, FIRST-OBS) — no re-fire this wave.
- OBS-W8-5 (form enum values must match seed/reference-data keys, BUILD, FIRST-OBS) — no re-fire this wave.
- OBS-W8-6 (V-block live-render method, VERIFY, needs mechanically-checkable reword before next promotion attempt) — no new firing this wave.
