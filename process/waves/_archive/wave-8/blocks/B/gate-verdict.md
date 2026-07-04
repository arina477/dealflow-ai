# Wave 8 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId head-builder-w8-b6)
**Reviewed against:** process/waves/wave-8/blocks/B/review-artifacts.md
**Attempt:** 1  (1 = first gate, 2+ = post-rework)

## Verdict
APPROVED

## Rationale

The mandate spine (M4 first bundle: spine+create/configure ba0edebf, list c070ca23, detail 50227055) meets the frozen spec contract including the full P-4 D1–D6 addendum, and it holds the load-bearing compliance invariant this role must never let pass: every mandate mutation is written inside one transaction with the audit entry appended LAST, and the actor is the app `users.id` resolved via `getUserWithRole` (never the raw SuperTokens id — verified in code AND by a regression test asserting `createdBy === appUserId` and `!== stUserId`). All ten verification points pass in CODE, not just in deliverable prose:

1. **One-txn 3-table atomicity** — `MandateService.createAsActor` opens a single `repository.runInTransaction(...)` and performs the disclaimer lookup, mandate insert, buyer-criteria insert, compliance-profile insert, and audit append all inside that one closure; `runInTransaction` delegates to the real Drizzle `db.transaction`, so any throw (including audit failure) aborts the whole transaction. No partial-mandate path exists.
2. **Audit-last-in-txn + actor-id** — `auditService.append` is the final step (7) inside the tx; `actorUserId` = resolved app user id; SHA-256 payload/content hashes computed; `mandate-create`/`mandate-configure` added to `auditActionEnum`. Test asserts action + actorUserId + called-once.
3. **RBAC** — `MANDATES_WRITE_ROLES` (advisor, admin) and `MANDATES_READ_ROLES` (advisor, admin, analyst) are derived from the single `roleRoutes` source, boot-asserted non-empty (fail-closed on config drift), and `@Roles` is sourced from that same map. Tests prove advisor/admin ALLOW-write, analyst/compliance DENY-write (403), anon 401, analyst ALLOW-read. `NAV_MANDATES.allowedRoles` references the same literal as the `/mandates` route entry (nav⊆RBAC holds).
4. **D2 disclaimer derive** — `mandateCreateSchema` is `.strict()` at both the outer and nested `compliance` level and contains NO `disclaimerTemplateId`; a test proves an input carrying it is rejected. The service derives the FK in-tx via `findActiveDisclaimerByJurisdiction`; no match → `BadRequestException` (400), never a null FK.
5. **D5 acknowledgments** — three NOT-NULL boolean columns on `mandate_compliance_profile`; `z.literal(true)` at parse time PLUS a defensive service-level guard; persisted as part of the audited create; each false/missing ack rejected independently in tests.
6. **D3/D4/D6** — `seller_geo` (text[]) + `seller_size_band` (text) columns captured on `mandates`; `suppression_scope` is a captured SCALAR (jsonb; UI is a text/tags input with explicit "CSV upload deferred" copy — no file-parse infra); mandate-detail renders Buyer Engine / Ranked Candidates / Pipeline as three labelled `DeferredPlaceholder` mount points ("coming in a later step") — not built, not dropped.
7. **Migration 0006 journal-registered** — `_journal.json` idx=6, `when=1783296000000` > 0005's `1783209598319` (BUILD rule 4 / wave-7 Ghost-Green lesson satisfied); migration is additive, and the down migration drops only the 3 new tables + the new enum (no shared table touched).
8. **Detail SSR-hydrated** — `[id]/page.tsx` server-fetches `GET /mandates/:id` via `apiBase()` (internal API, never the same-origin page route) and passes a serializable `initialDetail` prop; `MandateDetailClient` renders from the prop with NO client fetch to the page route (grep-confirmed: the only client fetch is the guarded PATCH mutation). Read-schemas use `z.string()` (not `.datetime()`), the repository unwraps `err.cause.code` (DrizzleError, wave-6), and `apiFetch` injects `rid: anti-csrf` (wave-5).
9. **Compliance CAPTURED-not-enforced** — the create stores the profile but does not gate; both the create form and the detail carry explicit "captured for the compliance gate — not enforced at this stage" copy, avoiding false-safety.
10. **Commit-discipline + tests** — commits cite task_ids (ba0edebf / c070ca23+50227055 grouped in the B-3 commit); assertions are semantically substantive (state/FK/actor/rejection assertions, not coverage-theater). API suite verified green live (347 pass + 1 skip; mandate.spec 40 + di-boot 5); shared 440 + web 304 corroborate the ~1091 total.

**One documented condition carried forward to C-block (NOT a rework trigger):** the `one-txn rollback` unit test mocks `runInTransaction` as `async (work) => await work({})`, which does not model Postgres rollback — it proves only that the error PROPAGATES, not that the mandate/criteria rows are actually rolled back on audit failure. Structural atomicity is nonetheless correct (all writes are inside the single real-`db.transaction` closure with audit last), and the live create→derive-disclaimer→list→detail smoke (the only place true rollback can be observed) is legitimately deferred to C-2 per B-5. This is an accepted unit-test boundary, not a hollow-test defect — WITH the binding condition below.

## Escalation
(not applicable — APPROVED)

## Condition on C-block (head-ci-cd to enforce at C-2)
The C-2 deploy-and-verify live smoke MUST exercise the audit-fail rollback path against the live DB: force an audit-append failure inside a mandate create and assert NO orphan `mandates` / `mandate_buyer_criteria` / `mandate_compliance_profile` row persists. If C-2 cannot exercise this, it must be logged as tech debt for the next M4 bundle's T-block (integration layer). This condition exists because the audit trail is the load-bearing compliance invariant and its rollback guarantee is currently proven only structurally, not behaviourally.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

---
## Phase 2 — /review (adversarial)
Found 3 CRITICAL + 3 info (atomicity/actor-id/acks/RBAC/DrizzleError-unwrap/SSR-hydrate/false-safety-copy all verified clean):
- **CRITICAL PATCH→crash** (configure returned bare Mandate; client treated as MandateDetail → detail crashes after save) → FIXED (37998bb): configureAsActor returns full MandateDetail (re-reads criteria+compliance in-txn); client consumes MandateDetail. Tests.
- **CRITICAL no draft-lock** (active mandate freely mutable + active→draft revert) → FIXED: server state-machine (409 on active edit + active→draft); client hides Configure + read-only Locked badge on active. 4 tests.
- **CRITICAL ambiguous disclaimer** (LIMIT 1 no ORDER BY + no DB uniqueness → wrong legal disclaimer silently bound) → FIXED: deterministic (ORDER BY version DESC) + ambiguity→409 + migration 0007 partial unique index disclaimer_templates(jurisdiction) WHERE active (journal when 1783382400000 > 0006 ✓). 2 tests.
- INFO read-schema .strict() fragility (wave-7 class) → FIXED: read schemas .passthrough(); INPUT schemas stay .strict() (mass-assignment guard intact). 5 tests. + next.config comment fixed.
Fix commit 37998bb. Re-verify: repo typecheck clean, lint 0, tests pass (+ all regressions), build pass. 3 CRITICALs encoded as regression tests.

## Action 6 — commit-discipline (multi-spec): commits cite task_ids (ba0edebf schema/backend; c070ca23/50227055/ba0edebf frontend; ba0edebf fix). PASS.
## Phase 2 Verdict: PASS. **B-block gate: PASSED** (head-builder APPROVED + /review 3 CRIT fixed). → next block C.
### C-2 carry (head-builder condition): exercise the audit-fail rollback + active-lock + ambiguous-disclaimer live.
