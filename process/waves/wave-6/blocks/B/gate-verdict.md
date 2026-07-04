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
