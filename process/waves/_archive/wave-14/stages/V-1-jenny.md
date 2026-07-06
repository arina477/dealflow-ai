# V-1 jenny — spec-INTENT vs DEPLOYED-behavior audit (wave-14, M6 compliance hardening)

**Verdict: APPROVE**
Drift: 1 (Low, pre-adjudicated at P-4 — not a defect). Gap: 1 (Low, forward-looking observation).
Deployed target: `5754fbf11818110f47a1c774aa06ebfe4042a8ef` (api + web, Railway, LIVE).
Method: independent DB spec-contract read (task `07bd1e1a`), live anon prod probes (self-run), full source inspection of all three specs' implementations, and reliance on C-2's authed live verification where invite-only auth blocked me from minting my own session (stated precisely below).

---

## Evidence basis + authed-session limitation (stated, not fabricated)

The app is genuinely invite-only. I confirmed this myself live:
- `POST /auth/signup {inviteToken:"bogus"}` → **400 `"Invalid or expired invite"`** (I have no valid invite token, so I could not assemble compliance/advisor authed sessions).
- `POST /outreach {}` anon → **401** (session-gated before the gate body — the non-bypassable path requires auth first).
- `GET /compliance/audit-log/verify` anon → **401**; web `/` and `/compliance/oversight` anon → **307** (auth-guard).
- `GET /health` → **200 `{"status":"ok","db":"ok","version":"5754fbf…"}`** — deployed hash matches, db:ok live.

For the authed-only behavior (verifyChain over the live chain, gate no-regression compose, mandate-filter read, oversight page render for both roles, RBAC 403s) I rely on **C-2's self-performed live verification** (`process/waves/wave-14/stages/C-2-deploy-and-verify.md` lines 32-46), which minted compliance+advisor sessions via invite→signup and exercised each. I independently corroborated every authed claim against source code (below), so the deployed-behavior conclusions are code-anchored, not merely report-trusted. This satisfies the "rely on C-2 + anon surface + code — say so" fallback in my brief.

---

## 1. 487b0f0c — gate mandate-attribution, hash-safe, no-regression — HONORED

**Spec (487b0f0c AC1-3):** gate-evaluate row records `mandateId` (resolved at evaluate-time from compose ctx; outreachId NOT recorded — gate runs before outreach INSERT), hash-EXCLUDED so `verifyChain()` stays green over mixed old/new chain, gate allow/block UNCHANGED.

**Deployed behavior matches intent:**
- **Mandate recorded at evaluate-time, mandate-only, no over-capture.** `compliance-gate.service.ts:117-124` — gate calls `this.audit.appendWithMandate(this.verdictAuditEntry(parsed, verdict), tx, parsed.mandateId)`. `mandateId` is resolved from the parsed compose ctx *at evaluate-time*; there is no outreachId capture and no lossy template-version→mandate back-derivation (AC4 honored). Recorded ONLY on gate-evaluate rows; all other action types leave `mandate_id` NULL.
- **Hash-EXCLUDED — verified in the hash core, not just claimed.** `audit.hash.ts:54-66` `HashableEntryFields` has **no** `mandateId` field; `canonicalSerialization` v1 (`audit.hash.ts:118-131`) serializes exactly `sequence_number, actor_user_id, actor_role, action, resource_type, resource_id, content_hash, payload_hash, chain_version, created_at, prev_hash` — `mandate_id` absent. `audit.service._appendCore` (`audit.service.ts:154-179`) computes `computeEntryHash(hashable, …)` over the mandateId-free `hashable`, then inserts `{...hashable, mandateId}` — column written outside the preimage. The self-check tripwire (`audit.service.ts:190+`) also excludes mandateId. This is precisely the migration-0012 additive-nullable mechanism the P-4 rework mandated.
- **Migration 0012 additive.** `0012_audit_mandate_id.sql` = single `ALTER TABLE audit_log_entries ADD COLUMN mandate_id uuid` (nullable, no default, zero DROP/ALTER-TYPE); DROP only in `.down.sql`; registered in `meta/_journal.json` (`tag: 0012_audit_mandate_id`) — the wave-14 B-6 Ghost-Green journal fix is present.
- **verifyChain green LIVE after the column landed** — C-2 line 35: `GET /compliance/audit-log/verify` → `{ok:true, entriesChecked:310}` over the accumulated production chain *after* 0012, re-checked stable end-of-stage; existing seq-309 entryHash `930bfecc…` == the wave-13 chain tail (hashes byte-identical). This is the load-bearing tamper-evidence proof, observed live.
- **Gate no-regression.** `evaluate(ctx, tx)` signature unchanged (`compliance-gate.service.ts:80`), `allowed: blocks.length === 0` unchanged (line 106); the ONLY change is the audit-write switched `append`→`appendWithMandate` (identical hash behavior + one hash-excluded column). C-2 line 37 confirmed live: `POST /outreach` well-formed nonexistent-refs → 404, malformed → 400, no 500, no silent send.

**Semantics honored: YES — mandate-attributable WITHOUT over-capture (mandate_id at evaluate-time), hash-safe, no allow/block regression.**

## 2. 07bd1e1a — mandate-derivation e2e lifts DEV-2 — HONORED

**Spec:** real-DB e2e proving mandate-scoped export captures ALL producers (incl gate decisions) + excludes cross-mandate rows + shared-template-version isolation → lifts the wave-13 DEV-2 hard-gate.

**Deployed/proven behavior matches intent:**
- `apps/api/test/recordkeeping-gate.e2e-spec.ts` (34 KB, 9 tests A-I) seeds a mandate-A with FOUR producers (mandate event, outreach-compose, pipeline stage_changed, gate-evaluate with `mandate_id` column) + mandate-B rows, and asserts: A-D all captured; E-F mandate-B excluded (no over-capture); **G** exactly one `export_generated` row + `verifyChain {ok:true}`; **H** mandate-B scoped export; **I** the critical shared-VERSION_ID isolation — two mandates' gate-evaluate rows on the SAME `resource_id`, asserting mandate-A export includes only `mandate_id=A` and excludes `mandate_id=B`. This is exactly the over-capture edge the spec worried about, tested non-tautologically.
- Uses the shared race-safe `ensureMigrated` helper (`test/_helpers/ensure-migrated`), skips clean when `TEST_DATABASE_URL` unset (edge-case honored).
- **Ran REAL and GREEN in CI** — C-1 run `28784535052` on exact SHA `0488cd7` against a migrated `dealflow_test` Postgres (C-2 line 8). **DEV-2 hard-gate LIFTED** (git `5754fbf` message + C-2 verdict). The scoped export can now back a live regulator request per the wave-13 V-block directive.
- The recordkeeping repository derivation (`recordkeeping.repository.ts:22-25, 29-37`) gained the gate-evaluate branch: `outreach-template-version` rows filter on `mandate_id = ?` (direct column match, NULL for pre-0012 rows → correctly excluded).

**Matches the wave-13 V-block directive: YES — the hard-gate LIFTS on a real, isolation-proving e2e.**

## 3. f5074df8 REFRAMED — /compliance/oversight — HONORED

**Spec (P-4 REFRAME, option a):** read-only outreach gate-outcome OVERSIGHT surface, DISTINCT from wave-11 `/compliance-queue` (version approval); advisor-blocked; no approve/edit/delete/send/AI; route `/compliance/oversight`.

**Deployed behavior matches intent:**
- **Route `/compliance/oversight`** (NOT `/compliance/queue`). `apps/web/app/(app)/compliance/oversight/page.tsx` ships. The P-4 route DRIFT (initial `/compliance/queue` collided with the reserved F10 slot + the shipped hyphenated `/compliance-queue`) was caught by jenny at P-4 and corrected in the reworked spec — the deployed route is the corrected target.
- **Read-only over outreach + gate verdicts.** Page reuses `GET /outreach` (existing list endpoint — B-2 added NO new endpoint; `oversight-data` proxies to `/outreach` per `next.config.ts:368-371`), renders send_eligible/blocked + block reason, template version, SoD/approver (derived read-only display), mandate. `ComplianceOversightTable.tsx:9` "READ-ONLY: NO approve/reject/edit/delete/send/AI affordance." Only controls: mandate-filter `input` + `Refresh` button. No new approval workflow (none exists in the model — P-4 confirmed).
- **Distinct + non-duplicative.** Page header + description link OUT to `/compliance-queue` for template-version approval (`page.tsx:205-223, 242-245`) — explicitly the separate write surface, not duplicated.
- **RBAC compliance/admin, advisor fail-closed.** `assertRole('/compliance/oversight', me.role)` (`page.tsx:152`); advisor → redirect to `/`. C-2 line 46 confirmed live: advisor `GET /compliance/oversight` → 307 to `/`, zero table content leaked; compliance renders the 24 KB authed page.

**Non-duplicative + matches the P-4 REFRAME: YES. Route correct: YES.**

## 4. Immutable / hash-chain posture — HONORED

- Additive `mandate_id` column, hash-excluded (§1). L1 tamper-non-detection documented: git `9009abb` "L1 attribution-tamper doc" — the mandate_id column is deliberately NOT tamper-evident (outside the HMAC), documented in `audit-log.ts:117-118` and the migration header. This is the correct compliance-first posture: the chain's integrity guarantee is unchanged; the attribution column is additive metadata, and its non-coverage by the chain is disclosed rather than silently assumed tamper-proof. Matches compliance-first honesty.

## 5. Deferrals honored — YES

`git diff 7459184..0488cd7` over all changed `.ts/.tsx` files: **zero** new imports of `anthropic | openai | nodemailer | @sendgrid | resend | smtp | webhook`. No send path, no LLM, no credential, no new SDK introduced. The gate `evaluate()` still documents (`compliance-gate.service.ts:30-31`) that a live send endpoint is a future M6 dependency — no send was smuggled in.

## 6. Spec gaps revealed by deployed behavior

- **(Gap, Low — forward-looking, not a wave-14 defect):** The mandate-attribution WRITE path is currently proven only via the C-1 e2e (real migrated DB), NOT via a full live compose→gate→filtered-rows smoke in production — because minting a non-null `mandate_id` gate-evaluate row live requires assembling an entire owned mandate chain (mandate→buyer-universe→match→accept→template→approve→compose), which would inject substantial production data. C-2 states this un-run honestly (line 39). Consequence: LIVE, `GET /compliance/audit-log-data?mandateId=<uuid>` returns `[]` because every existing gate-evaluate row predates 0012 (mandateId NULL). The mandate-derivation is fully proven at the e2e layer and the read-filter is proven wired live; the *live end-to-end write* is inferred. This is acceptable for this wave (the e2e is the authoritative proof and DEV-2's lift rests on it), but a future wave that ships the live send path should include the first live non-null-mandate gate-evaluate + a live scoped-export smoke to close the inference. Not a blocker.

---

## Drift vs Gap ledger

| # | Type | Severity | Finding | Disposition |
|---|------|----------|---------|-------------|
| 1 | Drift | Low | Initial f5074df8 route `/compliance/queue` drifted from journey-map reservation + shipped `/compliance-queue` | **Pre-adjudicated at P-4** (jenny caught it; reworked to `/compliance/oversight`; deployed route is correct). Closed — not a live defect. |
| 2 | Gap | Low | Live compose→gate→scoped-export write-smoke not run in prod (WRITE path proven only via C-1 migrated-DB e2e) | Accept for wave-14; e2e is authoritative + read-filter proven live. Recommend a live smoke once the send path ships. |

No Critical / High / Medium findings. All three specs' deployed behavior matches spec INTENT beyond the ACs; hash-chain posture, RBAC/SoD, non-bypassable gate, and deferrals all hold; the DEV-2 hard-gate lift is well-founded.

**APPROVE.**
