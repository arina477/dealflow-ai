# Wave 6 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId head-builder-w6-b6-attempt1)
**Reviewed against:** process/waves/wave-6/blocks/B/review-artifacts.md
**Attempt:** 1  (1 = first gate, 2+ = post-rework)

## Verdict
REWORK

## Rationale

The data spine is 90% strong and most of the load-bearing invariants are genuinely PROVEN, not claimed: migration 0004 is registered in the drizzle journal (entry idx 4) with a matching snapshot, an FK-ordered down, and the hand-appended `companies(normalized_domain)` partial-unique backstop — so C-2 will actually create the seven tables. Secrets are clean (`data_source_connections.provider_key` stores the env credential NAME only; no secret/api_key column exists; the fixture adapter needs no credential and the interface establishes `process.env[providerKey]` for real adapters). The ETL is idempotent by `UNIQUE(connection_id, source_record_id)` and writes staging only. The dedupe-resolve endpoint is exemplary: audit appended IN THE SAME TRANSACTION via `AuditService.append` with rollback-on-audit-failure, and the actor is translated from the SuperTokens session id to `app users.id` via `getUserWithRole` (the wave-5 actor-id-FK lesson) before it ever touches a `users.id` FK — never the raw SuperTokens id. RBAC is fail-closed (boot-time non-empty assertion + request-time RolesGuard) on all four endpoints, the screen is a server component with `assertRole`, no manual-create affordance ships, and boundaries use `.safeParse()`. The dedupe tests assert real post-run state (1 canonical + 2 company_provenance for cross-source; 1 contact + 2 contact_provenance for email merge; ambiguous → pending candidate NOT auto-merged) — these are not hollow.

The block nonetheless fails the gate on ONE confirmed correctness defect in the load-bearing dedupe engine, which is exactly the class this gate exists to catch: **the ambiguous-candidate path is NOT idempotent.** `DedupeEngine.promoteStaging` computes its "already promoted" set solely from `company_provenance.raw_company_id`. A raw row that resolves to a `dedupe_candidate` (Priority 3) never writes a company_provenance row, so on every re-sync it re-enters `unpromotedRaw` and `insertDedupeCandidate` (dedupe.engine.ts:681-700) runs again — a plain `.insert(...).returning()` with NO `.onConflictDoNothing()` and NO `UNIQUE(raw_company_id, matched_company_id)` constraint on `dedupe_candidates` to backstop it. `IngestionService.sync` runs `promoteStaging` on EVERY on-demand sync, so a second sync of any connection carrying an ambiguous record piles up duplicate pending candidates in the mvp-CRITICAL review queue. This directly violates task db274731's acceptance criterion ("re-running dedupe over the same staging does NOT create duplicate canonical rows or duplicate provenance") and its edge-case "re-run dedupe → idempotent." It is masked because idempotency test (b) uses a domain-match raw row and never exercises the candidate re-run — an 816-green suite with a blind spot on the one path that regresses. Secondary: the multi-spec commit-discipline check (Action 6) fails — the per-stage commits do not cite `task_id`s in their bodies and a bundling `chore: wave-6 B-block deliverables` commit (d0f6f0a) touches files across spec blocks. Both are fixable by the orchestrator routing to the named specialists; the spec is implementable, so REWORK (not ESCALATE).

## Rework instructions

### Stages requiring rework
- B-0: add `UNIQUE(raw_company_id, matched_company_id)` (partial, WHERE status='pending') to `dedupe_candidates` in migration 0004 + schema.
- B-2: make the ambiguous-candidate promotion path idempotent in the dedupe engine + add the failing test.
- B-6/Action-6: fix commit discipline (per-spec commits citing single task_ids).

### Per stage

#### B-0
- **What's wrong:** `dedupe_candidates` has no uniqueness backstop for a pending (raw, matched) pair. The idempotency guarantee for the review-queue path has no DB-level enforcement, mirroring the pattern the `company_provenance`/`contact_provenance` UNIQUEs already provide for the merge path.
- **Heuristic fired:** H-B-DB-Constraint-Illusion — an idempotency invariant enforced only in application memory (and, here, not even that) with no Postgres constraint; the same "DB is the source of truth for integrity" rule that justified the `normalized_domain` partial-unique and the two provenance UNIQUEs.
- **What "good" looks like:** In `apps/api/src/db/schema/sourcing.ts` `dedupeCandidates` gains a partial-unique index `UNIQUE(raw_company_id, matched_company_id) WHERE status = 'pending'` (hand-appended in `0004_wandering_harry_osborn.sql` following the `companies_normalized_domain_partial_unique` precedent, with the matching DROP in `.down.sql`). Additive only; no existing table touched; journal snapshot regenerated so C-2 applies it. A partial index on `status='pending'` (not a plain unique) is required so a rejected/merged candidate does not block a legitimately re-raised one later.
- **Re-do instructions:** Route to `postgres-pro`. (1) Add the partial-unique to the `dedupeCandidates` table definition comment + hand-append block in 0004.sql; (2) add the DROP INDEX to 0004.down.sql; (3) re-run `drizzle-kit generate` (or hand-verify the snapshot) so the journal + `0004_snapshot.json` stay coherent; (4) confirm `_journal.json` still lists exactly one 0004 entry.

#### B-2
- **What's wrong:** `DedupeEngine.promoteStaging` treats only company_provenance-bearing raw rows as "promoted," so candidate-resolved raws are reprocessed every run; `insertDedupeCandidate` has no conflict handling. Re-sync duplicates pending candidates.
- **Heuristic fired:** H-B-Dedupe-Idempotency-Gap — the load-bearing idempotency invariant holds on the auto-merge/new-canonical path but leaks on the ambiguous path; "idempotent" was asserted at the summary level without a test that re-runs the candidate branch.
- **What "good" looks like:** A second `promoteStaging` call over staging that contains an ambiguous record produces ZERO net-new `dedupe_candidates` rows. Concretely: (a) `insertDedupeCandidate` uses `.onConflictDoNothing()` against the new partial-unique from B-0 (and re-reads the existing candidate id when the conflict fires, returning it rather than throwing on the empty `.returning()`); AND/OR (b) `promoteOne`'s Priority-3 branch first checks for an existing pending candidate for `(raw.id, matched.id)` via the repository and short-circuits. The "unpromoted" selection in `promoteStaging` should additionally exclude raw rows that already have a pending `dedupe_candidate`, so a re-run does not even re-enter `promoteOne` for them. Do NOT widen this into a generic abstraction — a targeted guard on the candidate branch is the whole fix.
- **Re-do instructions:** Route to `backend-developer` (engine logic) with `postgres-pro` confirming the conflict target matches the B-0 partial-unique. Then route to `code-quality-pragmatist`/`karen` to author the missing test in `dedupe.engine.test.ts`: a new case (g) that runs `promoteStaging` TWICE over a store whose raw row triggers the ambiguous branch, asserting `store.dedupeCandidates` has length 1 after BOTH runs (the current test (b) must NOT be the only idempotency proof; extend the mock's `execInsert` to honor the candidate conflict key so the test faithfully models the DB). The suite must go red before the fix and green after.

#### B-6 (Action 6 — commit discipline)
- **What's wrong:** Per-spec commits (e44a5fd, f6071e7, 299e7c1, 43fe212, 952207d) do not cite their `task_id` in the body, and `d0f6f0a` bundles B-block deliverables across spec blocks. Action 6 requires each commit to cite exactly one `task_id` from `claimed_task_ids` and every `task_id` to have ≥1 commit.
- **Heuristic fired:** H-B-Commit-Provenance — multi-spec traceability requires per-task commit citation for the C-block SHA-provenance gate and any future revert-by-task.
- **What "good" looks like:** After the two rework commits land, `git log main..wave-6-deal-sourcing` shows each functional commit body citing exactly one of `[ff378a95, 0241222b, db274731, f5771d13]`, the file set of each overlapping only that spec block's contracts, and every one of the four task_ids cited by ≥1 commit. The bundling `chore` commit is either split or its scope documented as deliverables-only (non-code, no spec overlap).
- **Re-do instructions:** Orchestrator, not a specialist. When landing the B-0/B-2 rework fixes, use two atomic commits: one citing `db274731` (dedupe idempotency: engine + candidate UNIQUE + test), and confirm the pre-existing commits' task attribution is captured in the deliverable if history rewrite is undesirable. Do NOT `git rebase -i` published history if it complicates C-block; instead record the per-commit → task_id mapping in review-artifacts.md and ensure the two new fix commits each cite exactly one task_id.

### Cascade

B-block cascade rules (trigger = B-0 schema change + B-2 backend change):

| Trigger stage | Stages that must re-run downstream |
|---|---|
| B-0 (dedupe_candidates partial-unique) | B-1 (no contract change — dedupe_candidates shape unchanged; verify only), B-2 (engine consumes new constraint), B-4 (typecheck + journal), B-5 (full verify) |
| B-2 (engine idempotency + test) | B-3 (no frontend change — read surface unchanged), B-4, B-5 |

- **Stages that must re-run after the above:** B-4 (repo-wide typecheck + migration journal coherence), B-5 (full suite: lint, typecheck, unit incl. the new candidate-idempotency test, build, smoke).
- **Stages that stay untouched:** B-1 (contracts unchanged — the `DedupeCandidate` shared type is unaffected), B-3 (frontend read surface + resolve call unchanged).

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---

# Wave 6 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId head-builder-w6-b6-attempt2)
**Reviewed against:** process/waves/wave-6/blocks/B/review-artifacts.md
**Attempt:** 2  (post-rework re-gate; scope limited to the 2 attempt-1 REWORK items)

## Verdict
APPROVED

## Rationale

Both attempt-1 REWORK items are resolved; the substance-approved invariants from attempt 1 (cross-source dedup, contact_provenance, env-only secrets, actor-id translation, same-tx audit on resolve, RBAC fail-closed, no manual-create, `.safeParse()` boundaries) were not re-litigated. **Item 1 (candidate-path idempotency) is genuinely fixed with defense in depth.** `DedupeEngine.promoteStaging` now computes TWO exclusion sets — company_provenance-bearing raws (`promotedIdSet`) AND raws already carrying a `status='pending'` dedupe_candidate (`pendingCandidateIdSet`) — and filters both out of `unpromotedRaw` (dedupe.engine.ts:292-315), so an ambiguous raw never re-enters `promoteOne` on re-sync. Behind that application guard, `insertDedupeCandidate` uses `.onConflictDoNothing({ target:[rawCompanyId, matchedCompanyId], where: sql\`status = 'pending'\` })` and, on conflict, re-reads and returns the existing candidate id rather than throwing on the empty `.returning()` (dedupe.engine.ts:707-742) — a correct DB-level backstop against any future concurrent path that bypasses the in-memory filter. The DB constraint is real: migration 0004 hand-appends `CREATE UNIQUE INDEX "dedupe_candidates_raw_matched_pending_unique" ... WHERE status = 'pending'` (0004.sql:114) following the existing `companies_normalized_domain_partial_unique` precedent, with the matching `DROP INDEX IF EXISTS` first in the FK-ordered `.down.sql`; the partial predicate on `status='pending'` correctly permits a legitimately re-raised candidate after a prior resolve. The migration journal stays coherent — exactly one 0004 entry (`0004_wandering_harry_osborn`); the partial index is hand-appended, not snapshot-managed, so no snapshot drift. **Test (g) is a real regression test, not coverage theater:** it drives the true Priority-3 branch (raw "Acme Holdings" token-overlapping canonical "acme", no domain on either side), runs `promoteStaging` TWICE, and asserts `store.dedupeCandidates` has length 1 after both runs (dedupe.engine.test.ts:1069, 1086) with `result2.candidates === 0`; the in-memory mock faithfully models the partial-unique conflict key (execInsert lines 431-437), so the test would go RED on the pre-fix engine and GREEN after. The H-B-DB-Constraint-Illusion and H-B-Dedupe-Idempotency-Gap heuristics that fired at attempt 1 are both cleared: the idempotency invariant is now enforced in application memory AND in Postgres, and it is proven by a test that re-runs the exact branch that regressed. **Item 2 (commit discipline)** is satisfied per the Action-6 alternative offered at attempt 1: review-artifacts.md now carries a per-commit→task_id mapping table covering all four claimed_task_ids (ff378a95: e44a5fd/f6071e7/299e7c1; 0241222b: 43fe212; db274731: f6071e7/b3a12d8; f5771d13: e44a5fd/43fe212/952207d), the new fix commit b3a12d8 cites db274731, cross-cutting commits are documented as shared-contract work (same accepted pattern as waves 3-5), and d0f6f0a is scoped deliverables-only; unpushed history was not force-rebased to 1:1, which the attempt-1 verdict explicitly permitted. Re-verification is green: `pnpm -r typecheck` — both apps Done; `pnpm -r test` — api 248 passed / 1 pre-existing skip (dedupe.engine.test.ts now 32 tests, incl. test g), web 179 passed, consistent with the recorded B-5 (lint 0-err, build pass, cumulative suite green with test g added). No new over-engineering: the fix is a targeted guard on the candidate branch, not a generalized abstraction, per the attempt-1 "do NOT widen this" instruction.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 1

---
## Phase 2 — /review (adversarial, dedupe-correctness)
Found 4 CRITICAL + 5 info (candidate-idempotency fix verified CORRECT; RBAC/actor-id/audit/secrets clean):
- **CRITICAL false-positive merge** ('co' suffix-strip → "Acme Co"="Acme Inc" auto-merge distinct companies) → FIXED (dbee1d0): 'co' removed + name-only NEVER auto-merges (only domain agreement); reserved auto-merge for domain-match. "Acme Co" vs "Acme Inc" stay separate (test).
- **CRITICAL lost contact-provenance on human-merge** (mergeRawIntoCanonical never promoted contacts/contact_provenance — principle-3 violation) → FIXED: mergeRawIntoCanonical delegates to DedupeEngine.mergeInto (one shared impl; contacts + contact_provenance written).
- **CRITICAL non-atomic resolve double-apply** (read outside tx + no status guard) → FIXED: findForUpdate (FOR UPDATE) + conditional UPDATE WHERE status='pending' RETURNING → ConflictException single-winner.
- **CRITICAL missed-review** (name-match+domain-conflict silently new canonical) → FIXED: explicit insertDedupeCandidate on name+domain-conflict (review, not silent split).
- INFO normalizeDomain trailing-dot/port; insertDedupeCandidate re-read scoped → FIXED.
Fix commit dbee1d0. Re-verify: repo typecheck clean, lint 0, tests pass (+ regression: false-positive-prevented, name-conflict→candidate, human-merge-provenance, double-resolve-blocked), build pass. 4 CRITICALs encoded as regression tests → re-review satisfied.

## Phase 2 Verdict: PASS. **B-block gate: PASSED** (head-builder attempt-2 APPROVED + /review 4 CRIT fixed + commit-discipline mapping). → next block C.
