# Wave 14 — P-4 Phase 2 Karen claim-verification

Verdict: **APPROVE WITH 1 WRONG + 2 CAVEATS** (no blocking UNVERIFIED; the WRONG is a plan-wording defect B-1 must correct, not a scope failure).

## Per-claim

1. **Hashed CORE is a closed field set** — VERIFIED.
   `HashableEntryFields` (apps/api/src/modules/audit/audit.hash.ts:54-66) + `canonicalSerialization` v1 (audit.hash.ts:107-133) are a pinned, closed, version-locked field set (10 fields; prev_hash appended last). A new nullable column OUTSIDE this set leaves every existing entry's preimage byte-identical → verifyChain stays green. `audit_log_entries` has NO mandate_id column today (schema/audit-log.ts; recordkeeping.repository.ts:11) → a new nullable column is genuinely additive. CAVEAT: `AuditService.append` (audit.service.ts:96-107) enumerates `HashableEntryFields` explicitly from `AuditEntryInput` (audit.ts:197-220, `.strict()`). A NON-hashed mandate/outreach column CANNOT ride through the existing `append(input, tx)` signature — B-1 must thread a separate additive param/column around the hash (exactly the migration-0012 "hash-excluded column" option the plan names). Mechanism credible; not free.

2. **gate verdictAuditEntry is the gate-evaluate append target** — VERIFIED.
   compliance-gate.service.ts:116 appends via `verdictAuditEntry` (lines 139-149), action='gate-evaluate', resourceType=ctx.resourceType (='outreach-template-version' from compose). Correct target for 487b0f0c.

3. **compose context has mandateId + outreachId to pass into gate ctx** — **WRONG (as literally stated).**
   - mandateId: PRESENT (`input.mandateId`, outreach.service.ts:144/187/283). OK.
   - outreachId: **DOES NOT EXIST at gate-evaluate time.** The gate call (outreach.service.ts:274) runs BEFORE the outreach INSERT (line 280) — outreachRecord.id is not yet assigned. Also `GateContext` (compliance-gate.ts:152-184, `.strict()`) carries NEITHER mandateId nor outreachId today; both need additive schema fields. B-1 fix: record MANDATE context (available) on the gate row; drop/defer the outreachId claim OR pre-generate the outreach UUID before the gate call. The AC ("mandateId + outreachId") is over-stated — mandate-attribution alone satisfies the recordkeeping-derivation goal.

4. **shared race-safe ensure-migrated helper** — VERIFIED.
   apps/api/test/_helpers/ensure-migrated.ts exports `ensureMigrated` + `apiMigrationsFolder` with pg_advisory_lock serialization + 42P07/42710/23505 tolerance. Ready for 07bd1e1a.

5. **recordkeeping mandate-derivation is where the new gate-evaluate branch goes** — VERIFIED (with a live-code contradiction to flag).
   recordkeeping.repository.ts:217-307 `buildConditions` holds the per-resource_type OR fragment (mandate/outreach/pipeline/... lines 270-302). BUT lines 25-31 + 264-269 EXPLICITLY document gate-evaluate as INTENTIONALLY EXCLUDED (wave-13 B-6 decision: outreach-template-version is cross-mandate → over-capture risk). 487b0f0c's new branch REVERSES that prior decision — legitimately, because it makes gate rows mandate-attributable at write-time. B must UPDATE that docstring/comment (it currently asserts the opposite) or B-6 will flag a stale-honesty contradiction (same H1 class as wave-13). This is the crux of why 487b0f0c must land BEFORE 07bd1e1a's assertion — ordering claim VERIFIED.

6. **wave-11 /compliance-queue does template-VERSION approval** — VERIFIED.
   apps/web/app/(app)/compliance-queue/page.tsx:88-125 fetches templates → filters `v.approvalStatus === 'pending'` → version-approval queue; mutations to approve/reject endpoints (lines 8-9, 16-17). f5074df8 reframed as an outreach-gate OVERSIGHT surface is genuinely non-duplicative.

7. **Specialists in AGENTS.md** — PARTIAL.
   backend-developer: VERIFIED (AGENTS.md:70, explicit row). nextjs-developer: NOT an explicit row — only a parenthetical "added at v12 per stack" example (AGENTS.md:91). It IS in .capability-sheet.md:125 and is a spawnable agent type. Acceptable (rule 11 satisfied via capability-sheet + closest-match), but AGENTS.md lacks a dedicated row. Non-blocking.

8. **Antipattern sweep** — CREDIBLE.
   The gate change is additive audit-metadata (a new hash-excluded column + mandate context recorded at evaluate-time), NOT logic. Allow/block derives solely from evaluator blocks (compliance-gate.service.ts:105-109); mandate-context recording touches none of it. "gate allow/block unchanged + regression-guarded" is credible PROVIDED the metadata rides a hash-excluded column (claim 1). No claimed-but-fake reuse detected — ensure-migrated, recordkeeping derivation, verdictAuditEntry all real and correctly located. verifyChain-green-over-mixed-chain is architecturally sound given the closed hashed core.

## Bottom line
APPROVE. One WRONG (claim 3 outreachId — unavailable at gate-evaluate time; over-stated AC), two must-fix-at-B caveats (thread the hash-excluded column around append's signature; update the recordkeeping "gate-evaluate intentionally excluded" docstring that 487b0f0c now contradicts). None are scope/spec failures — all are B-1 mechanism corrections the plan already gestures at.
