# Wave 14 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, Phase 1)
**Reviewed against:** process/waves/wave-14/blocks/B/review-artifacts.md
**Attempt:** 1  (first gate)

## Verdict
REWORK

## Rationale
The wave-14 compliance-hardening work is architecturally excellent on every load-bearing invariant I was asked to be maximally strict on — the hash-chain safety (#1) and the gate-behavior regression (#2) are both clean. `mandate_id` is genuinely hash-EXCLUDED: it is absent from `HashableEntryFields` and `canonicalSerialization`, `appendWithMandate` threads it only to the DB column via `_appendCore` (never into `computeEntryHash`, and explicitly excluded from the write-time self-check), and the hash-safety unit test proves this for real (old-style entries byte-identical, mixed old/new chain `verifyChain {ok:true}`, direct HMAC recompute-without-mandate == stored hash, and a mandate-mutation-not-detectable boundary test). The gate's allow/block logic is untouched — `evaluate()` runs the same four evaluators in the same order and derives the same verdict; the only delta is `append` → `appendWithMandate(…, ctx.mandateId)`, and the gate spec asserts exactly that (append never called, appendWithMandate once, mandateId threaded from ctx). Gate ctx `mandateId` is `.strict()` + required + mandate-only (no `outreachId`) (#3). The recordkeeping docstring reversal is complete and honest — both the class-level docstring and the inline derivation comment now state gate-evaluate rows ARE included and explain the wave-13→wave-14 reversal, closing the wave-13 H1 honesty gap (#4). The mandate-derivation filters on `mandate_id = mid::uuid` with no over-capture. The 07bd1e1a e2e is genuine, real-DB, self-migrating, disjoint UUID namespace, and proves the exact invariant with a symmetric mandate-B counter-test (#5). The oversight page is read-only, RBAC compliance/admin (advisor denied), route-distinct from wave-11 `/compliance-queue`, SSR + non-colliding proxy, reusing the real GET /outreach shape (#6). Boundary is clean — no anthropic/nodemailer/resend/webhook/LLM imports. HOWEVER there is one CRITICAL structural defect that gates the entire wave: **migration 0012 is not registered in Drizzle's migration journal.** `0012_audit_mandate_id.sql` exists on disk, but `meta/_journal.json` still terminates at `idx:11` (`0011`) and there is no `0012_snapshot.json`. Both the production migrate path (`db:migrate` = `drizzle-kit migrate`) and the e2e's `ensureMigrated` helper apply migrations STRICTLY from the journal — drizzle's `migrate()` ignores any on-disk `.sql` not listed in `_journal.json`. Therefore on any FRESH database the `mandate_id` column is never created: prod would deploy without it, and the wave-14 e2e's `ensureMigrated` would not create it either. Assertion D (gate-evaluate capture via `mandate_id`) can only have passed against a DB where the column was added out-of-band, which makes B-5's "full test green" a Ghost Green for the new e2e. The entire feature — column, appendWithMandate, gate ctx, derivation branch, e2e — is load-bearing on a column the committed migration path will not produce. This is a rejectable defect (Iron Law: the audit-trail-adjacent column must exist by the same migration the verifier and export run against).

## Rework instructions

### Stages requiring rework
- B-0: migration 0012 exists on disk but is not registered in the Drizzle journal/snapshot — a fresh DB never gets the `mandate_id` column.

### Per stage

#### B-0
- **What's wrong:** `apps/api/src/db/migrations/0012_audit_mandate_id.sql` (+ `.down.sql`) were hand-authored but never registered in `apps/api/src/db/migrations/meta/_journal.json`, and no `0012_snapshot.json` was generated. `_journal.json` last entry is `{idx:11, tag:'0011_brainy_the_liberteens'}`. Drizzle's `migrate()` (used by both `drizzle-kit migrate` in prod and `ensureMigrated` in e2e) applies ONLY journal-registered migrations, so `mandate_id` is never created on a clean database. The passing e2e was validated against DB state the committed migration does not reproduce (Ghost Green).
- **Heuristic fired:** H-B-Ghost-Green / "The Database Constraint Illusion" adjacent — a schema change validated by a green test that the deploy path cannot reproduce; the load-bearing column will not exist in production.
- **What "good" looks like:** After a clean `drizzle-kit migrate` (or `ensureMigrated`) against an empty DB, `audit_log_entries.mandate_id uuid` exists. `meta/_journal.json` contains an `idx:12` entry tagged `0012_audit_mandate_id` (or the drizzle-generated tag), and a matching `000N_snapshot.json` reflects the new column. The recordkeeping-gate e2e passes against a DB migrated purely from the journal — no out-of-band `ALTER`/`db push`.
- **Re-do instructions:** Route to `postgres-pro` (schema/migration owner). Preferred path: regenerate the migration canonically via `drizzle-kit generate` from the updated `audit-log.ts` schema (which already declares `mandateId: uuid('mandate_id')`) so the journal entry, snapshot, and additive `ALTER TABLE … ADD COLUMN "mandate_id" uuid` are produced together and consistently — then delete the orphaned hand-authored `0012_*.sql`/`.down.sql` if the generated tag differs, keeping exactly one registered additive-nullable migration. If the hand-authored SQL must be retained verbatim, manually add the `idx:12` journal entry AND the corresponding snapshot so `migrate()` picks it up. Keep it additive-nullable, no FK-cascade (matches the schema's documented no-FK rationale). Then re-run B-5 against a FRESHLY-migrated DB (drop + `drizzle-kit migrate` + full suite incl. the recordkeeping-gate e2e) to convert the Ghost Green into a real green, and confirm `verifyChain {ok:true}` over the mixed chain on that fresh DB.

### Cascade

B-block cascade rules (trigger stage = B-0):

| Trigger stage | Stages that must re-run downstream |
|---|---|
| B-0 branch & schema | B-1 (contracts derive from schema), B-2 (services consume schema), B-4 (typecheck), B-5 (full verify) |

- **Stages that must re-run after the above:** B-4 (repo-wide typecheck/build — should be a no-op since the schema TS already declares the column) and **B-5 (full verify against a freshly-journal-migrated DB — the load-bearing re-validation; this is where the Ghost Green must be converted to a real green)**. B-1/B-2 code is correct as-is (the schema `.ts` already declares `mandateId`); they re-run only to confirm no drift after the migration is registered.
- **Stages that stay untouched (logic verified correct this attempt):** hash core (audit.hash.ts), appendWithMandate (audit.service.ts), gate ctx + evaluate (compliance-gate.service.ts + shared contract), outreach compose threading, recordkeeping derivation branch + docstring, the 07bd1e1a e2e logic, the oversight page (B-3), RBAC matrix, next.config proxy. No code changes required in those — only the migration registration + a clean-DB re-verify.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---
# Wave 14 — B-6 Phase-1 attempt 2 (Ghost-Green rework)
REWORK (migration 0012 not journaled) → FIXED (0161e57): journal idx 12 registered (when 1783814400000 > 0011) + 0012_snapshot.json (correct prevId chain + mandate_id column). A clean-DB drizzle migrate now creates the column → the recordkeeping-gate e2e's mandate_id assertions run REAL in CI (no longer skip-masked Ghost Green). Feature code was already APPROVED (hash-safety #1 + gate-regression #2 both genuinely PASSED at attempt 1). Phase-1 defect resolved → Phase 2 /review.

---
# Wave 14 — B-6 Verdict (Phase 2 — /review) → REWORK (M1) then APPROVE-pending
## /review: CLEAN at CRITICAL + HIGH (hash-chain airtight, no gate regression, migration registered [real green], no over-capture, oversight read-only). 1 MEDIUM + 2 LOW:
- **M1 (MEDIUM — recommended before merge):** the recordkeeping-gate e2e distinguishes mandate-A/B gate rows by resourceId (distinct VERSION_A/VERSION_B) — so test F would pass even if the mandate_id derivation branch were removed. The feature's ACTUAL defense (two mandates SHARING a template version, isolated by the mandate_id COLUMN) is NOT exercised. FIX: add a case where mandate-A + mandate-B gate-evaluate the SAME VERSION_ID → assert mandate-A's export contains exactly the gate-evaluate row whose mandate_id=A (not B). This is the assertion that fails if the branch regresses to resource_id-keying.
- **L1 (LOW):** mandate_id tamper is silent to verifyChain BY DESIGN (metadata column, not tamper-evident field) — document this boundary in a durable compliance doc (not only the spec comment) so an auditor doesn't assume mandate attribution is tamper-evident.
- L2 (LOW): redundant /auth/me round-trip (defense-in-depth, consistent w/ wave-13 pattern — no change).
→ Routing M1 (e2e shared-version case) + L1 (doc) to backend-developer.

---
# Wave 14 — B-6 → APPROVED (overall)
M1 RESOLVED (9009abb): new e2e test I — mandate-A + mandate-B gate-evaluate the SAME template version (SHARED_VERSION_ID), isolated ONLY by the mandate_id column; asserts A-export includes the mandate_id=A row + excludes mandate_id=B (count=1 each); FAILS if the branch regresses to resource_id-keying (both share resourceId → count=2) or is removed (count=0). This proves the mandate_id COLUMN does the isolation. L1 RESOLVED: command-center/dev/architecture/audit-mandate-attribution.md documents the tamper-evidence boundary (mandate_id is filterable attribution, NOT in the HMAC preimage; INSERT-only grant + BEFORE-UPDATE/DELETE trigger are the mutation defenses).
## B-6 APPROVED: Phase-1 head-builder (hash-safety #1 + gate-regression #2 genuinely PASSED; Ghost-Green journal fixed) + Phase-2 /review (clean at CRITICAL/HIGH; M1+L1 resolved).
```yaml
verdict_complete: true
verdict: APPROVED
gate: PASSED
rework: [ghost-green-migration-journal (0161e57), M1-shared-version-e2e + L1-doc (9009abb)]
```
---
## B-block exit
```yaml
build_block_status: complete
branch: wave-14-compliance-hardening
review_verdict: APPROVE
ready_for_ci: true
```
