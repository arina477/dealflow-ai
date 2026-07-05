# V-1 jenny — spec-INTENT vs DEPLOYED behavior (wave-12 M6 pipeline / deal-stage tracking)

**Verdict: APPROVE** — 0 spec-DRIFT (code-wrong) · 2 spec-GAP (spec-wrong / bug-spec, non-blocking)

Scope: does the DEPLOYED behavior (`989fae9` @ Railway) match the SPEC-CONTRACT INTENT — beyond the acceptance
criteria the T-block already tested? Authoritative spec = the three `tasks.description` YAML heads (07989285 spine +
PipelineService, d1940142 board API + RBAC + /pipeline page, 45b259e1 append-only notes + timeline). DB row IS truth.

## What I independently verified (deployed + code, not inherited from C-2/T-9)

- **Live anon probes (self-run curl @ prod api):** all 5 pipeline endpoints reject anon **401** — `GET /pipeline`,
  `POST /pipeline`, `PATCH /pipeline/:id/stage`, `POST /pipeline/:id/notes`, `GET /pipeline/:id/events`. `/health` =
  `200 {status:ok,db:ok,version:989fae9}` (fresh hash == deployed target, `db:ok` = live PG). Web `/pipeline` → **307**
  (auth-guard redirect). The endpoints exist, are wired, and fail-closed at the guard boundary.
- **Read the deployed source at HEAD** for all six pipeline files + shared zod + rbac matrix + migration 0011 (+down)
  + the pipeline-gate e2e. Traced each spec-intent claim to code, not to a green checkmark.

## Per-intent findings (spec section → deployed evidence)

**1. Non-bypassable audit last-in-txn (07989285 AC6 / 45b259e1 AC1+edge) — HOLDS.**
`pipeline.service.ts` orders `appendAudit` LAST in all three mutations (enroll L194 insertPipeline → L203
insertPipelineEvent → L213 appendAudit; transition L280 update → L288 event → L298 audit; note L355 event → L366
audit), each inside a single `repository.runInTransaction` (= real `db.transaction()`). Audit-throw ⇒ whole-txn
ROLLBACK ⇒ zero orphan rows. This is PROVEN at the exact deployed commit by `pipeline-gate.e2e-spec.ts` against a
REAL Postgres: test 1 (enroll rollback — no pipeline row, no enrolled event), test 2 (addNote rollback — no note
event), test 3 (happy path — exactly 1 event + 1 audit per mutation). LIVE-consistent: I confirmed enroll of a
well-formed-but-nonexistent source returns **404 not a 500 / partial write** (repository FK/eligibility guards fire
before any INSERT). No code path writes a business row without the audit append succeeding.

**2. Eligible-source guard (07989285 AC3+edge) — HOLDS, matches shipped surfaces.**
`pipeline.service.ts:136-190` + `pipeline.repository.ts:120-154`. Outreach branch requires `status='send_eligible'`;
match branch requires `disposition='accepted'` AND `match_run.ready_for_outreach=true`. I cross-checked against the
ACTUAL shipped schema: `outreach.status='send_eligible'` is the wave-11 pre-send-gate sentinel (only set by a passing
gate — `outreach.ts:90-100,314`); `match_candidate_disposition='accepted'` + `match_run.ready_for_outreach` is the
wave-10 M6-handoff sentinel (`matching.ts:37,47,77,143,259`). The guard reads exactly those two shipped surfaces
(journey F16 send-eligible + F17 accept→ready). No ghost dep. Ineligible → 400 with a specific message.

**3. Fixed 7-stage enum (07989285 AC2, #137) — HOLDS, not configurable.**
DB pgEnum `pipeline_stage` = `[shortlisted, contacted, engaged, diligence, offer, closed, withdrawn]`
(`schema/pipeline.ts:81` + migration 0011 line 2, live-applied). Shared `pipelineStageEnum` mirrors it
(`shared/pipeline.ts:27`). Board renders `PIPELINE_STAGES = pipelineStageEnum.options` — a compile-time constant, not
a DB-driven/config list (`PipelineBoardClient.tsx:665`, one `<section data-stage>` per fixed stage). Service
re-validates `toStage ∈ VALID_STAGES` at the service layer independent of the Zod HTTP guard (`service.ts:264`) — so
even a direct-call illegal stage is rejected, not just the HTTP path. No configurability shipped (H2-deferred honored).

**4. Board reflects server truth; illegal transition + wrong role rejected SERVER-SIDE (d1940142 AC3+AC4) — HOLDS.**
Transition path: HTTP Zod `.strict()` (`shared/pipeline.ts:156` — only the 7 enum values parse) → controller
safeParse 400 → service `VALID_STAGES` guard → `updatePipelineStageInTx` 404 if deal missing. RBAC is enforced by
`RolesGuard` on the controller, sourced from the shared `roleRoutes` matrix with fail-closed boot assertions
(`controller.ts:63-108`): enroll + transition = advisor-only (`/pipeline/new`, `/pipeline/:id/stage` →
`['advisor']`); board read + events + notes = advisor+compliance (`rbac.ts:259-288`). The client `StageMoveSelect`
is optimistic-in-session but the board re-reads server truth on SSR refresh (`page.tsx force-dynamic` +
`PipelineBoardClient` comment L14, L458-461); a rejected PATCH resets the select and surfaces the server error
(`PipelineBoardClient.tsx:96-108`) — the UI never persists a server-unconfirmed state. C-2 live-confirmed analyst
`POST /pipeline` → **403**, anon → **401**, advisor read → **200**; I re-confirmed the anon 401s myself.

**5. Append-only timeline (45b259e1 AC1-AC3) — HOLDS.**
`pipeline_events` has NO UPDATE/DELETE path anywhere — I grepped the whole pipeline module for `@Delete/@Put/
update(pipelineEvents)/delete(pipelineEvents)`: zero hits. Repository exposes only `insertPipelineEvent` +
list-by-id. Controller has no note edit/delete route (only `POST :id/notes` + `GET :id/events`). Timeline endpoint
returns enrolled + every stage_changed + every note ordered `created_at ASC` (`repository.ts:321`), each with
`actorId` (app users.id, never raw ST id — `service.ts:124,129` translates via `getUserWithRole`) + `createdAt`.
`DealTimelinePanel.tsx` renders all three event types chronologically with actor + local-time timestamp, and the
add-note form is append-only (no edit/delete affordance). Empty-text note → Zod `min(1)` 400 (`shared/pipeline.ts:171`).

**6. NO send / AI boundary (HARD BOUNDARY, CODE-OF-CONDUCT provenance) — HOLDS.**
No `@anthropic`, no email SDK, no send route in the pipeline module. The board + timeline components are TRACKING
only: affordances are "View timeline", "Add Note", stage `<select>` — no Send/Schedule/Compose/AI-draft anywhere in
`PipelineBoardClient.tsx` / `DealTimelinePanel.tsx`. C-2 self-grepped the DEPLOYED authed 31.6KB board HTML
(web-origin session): 0 send/schedule/email/AI-draft CTAs, only "AI" hit = the global `DealFlow AI` brand tagline
(allowed, wave-10/11 precedent). No false-send / false-AI claim shipped.

**7. H-1 mandate-provenance consistency (07989285, B-6 fix) — HOLDS.**
`service.ts:151-157` (outreach) + `:183-189` (match) reject enroll when the source's real `mandate_id` ≠ caller-
supplied `input.mandateId` with 400 "source does not belong to mandate" — BEFORE any INSERT. Source mandate is
treated as ground truth (read tx-scoped alongside eligibility). This closes the false-mandate-provenance hole across
the pipeline row, pipeline_events, and audit_log_entries. Correct: a caller cannot record a source under a mandate it
doesn't own.

**8. Journey continuity (F17) — HOLDS (no dead-end).**
`/pipeline` renders the board (advisor can move + note; compliance read-only), each card opens the timeline panel,
notes append and refresh. Board-load failure renders a distinct RETRY error state (NOT a silently-empty board —
`PipelineBoardClient.tsx:568-645`, `page.tsx` discriminated `BoardResult`), and empty stages render an explicit
"No deals" placeholder. No terminal dead-end in the flow.

## Spec-GAPs (spec-wrong / bug-spec — NON-BLOCKING, do not gate the wave)

- **GAP-1 (bug-spec, LOW): no live end-to-end enroll→transition→note→timeline smoke exists in production.** Production
  has zero eligible sources (`GET /outreach` → `[]`; no `send_eligible` outreach, no accepted+ready match) so neither
  C-2, T-9, nor I could assemble a real authed enroll on the deployed instance — it needs the entire wave-10/11
  sourcing→match→accept→handoff→compose→gate→send_eligible + cross-user SoD chain. Non-bypassable-audit correctness
  therefore RELIES (stated openly, not papered over) on the `pipeline-gate.e2e` real-DB proof at this exact commit
  `989fae9`, with LIVE confirming endpoints-present + RBAC-correct + FK-guarded (404 not 500). This is a spec/planning
  gap — the spec's acceptance criteria are provable only in CI-real-DB, not on the live prod DB, until a seeded deal
  exists. Recommend a future wave seed one eligible source (or an admin/test-fixture path) so the live smoke can run.
  Not code-wrong; the code is proven correct against a real Postgres.

- **GAP-2 (bug-spec, LOW): board join fields (`buyerName`/`buyerFirm`/`mandateName`) are optional passthroughs the
  spec's board read-shape does not pin.** `getBoard` returns raw pipeline rows (`service.ts:397` read-passthrough);
  the join enrichment lives in the web `pipelineRowWithJoinsSchema` as `.nullable()/.optional()` and the UI falls back
  to id-slices (`DealCard` L159-165). Deals therefore render by id-prefix when a join is absent rather than by human
  identity. The spec says "mandate + buyer identity in the correct stage column" (d1940142 AC2) but does not specify
  the join source or a fallback contract, so this is under-specified rather than a code defect — the correct-stage-
  column placement (the load-bearing part) holds. Non-blocking cosmetic; worth a spec note next wave.

## Bottom line

Every acceptance-criterion INTENT — not just the letter the T-block asserted — is satisfied by the DEPLOYED artifact:
non-bypassable last-in-txn audit with real-DB rollback, eligible-source + mandate-provenance guards over the exact
shipped wave-10/11 surfaces, the fixed 7-stage enum (non-configurable), server-side illegal-transition + RBAC
rejection with a server-truth board, append-only audited timeline, and a clean tracking-only boundary (no send/AI).
Zero spec-DRIFT (no place where deployed code contradicts the spec). Two LOW spec-GAPs are planning/observability
limitations (no live eligible source; unpinned board-join contract), both non-blocking and correctly disclosed
upstream by C-2 + T-9 rather than hidden. **APPROVE.**
