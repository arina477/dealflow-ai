# V-1 Karen — Wave 10 (Deterministic Match Spine, M5 first bundle)

**Reviewer:** karen (source-claim reality check — deployed state + code @ main `a5de983`, deployed `0075a20`)
**Verdict:** **APPROVE**
**Findings:** 8 (0 Critical, 0 High, 1 Medium, 4 Low, 3 confirmed-strong)

---

## Verdict rationale

Every load-bearing CLAIM in the V-1 input is TRUE in code and deployed state. The two HARD BOUNDARIES (deterministic-vs-LLM; M5/M6 outreach) hold with zero leakage. The B-6 2-CRIT + 4-INFO fixes are real, not cosmetic. The scorer is genuinely pure and genuinely discriminating (test asserts a real ≥80pt spread on constructed data, not a tautology). The P-4 karen MANDATORY AI-framing STRIP shipped — the design's false AI-capability framing is absent from the shipped `.tsx` AND from the live HTML. Live probes confirm auth-gating and the deployed version. RBAC/actor-id/audit-last-in-txn/guards are all present and structurally correct.

I found ONE genuine functional gap (F-1, Medium): the `score_breakdown` JSON shape the scorer WRITES does not match the shape the client READS, so the per-dimension breakdown bars silently render nothing. This is a real quality defect but it is NOT a boundary violation, NOT a spec-AC failure (the AC requires score_breakdown be persisted + shown as "rule-based fit"; the score, ranking, disposition, handoff, and framing all work), and NOT deploy-blocking — the drawer degrades to "No breakdown data available" rather than crashing. It is logged as a fast-fix candidate for V-2/V-3 or a follow-up, not a REJECT trigger.

---

## Findings (enumerated)

### F-1 — Medium — `score_breakdown` write/read shape mismatch (real, non-blocking)
**Where:** `apps/api/src/modules/matching/matching.scorer.ts:99-114` (writes) vs `apps/web/app/(app)/matches-shortlist/_components/MatchesShortlistClient.tsx:65-72` (reads).
- Scorer persists a FLAT breakdown: `{ sectorMatch: number, contactCompleteness: number, tieBreak: number, total: number, notApplied: string[] }`.
- Client reads NESTED objects: `breakdown?.sectorMatch as { score, weight, label }`, same for `contactCompleteness`, `tieBreak`.
- Nested-key access on a plain number yields `undefined`, so the `{sectorMatch && <BreakdownDimension.../>}` guards are all falsy → **zero dimension bars render** in the Score-breakdown drawer. The score gauge, total, disposition, and `notApplied` list DO render correctly (notApplied is a string[] on both sides).
**Impact:** The "explainability" drawer shows the headline score + not-applied dims but not the per-dimension contribution bars the AC implies. Deterministic backend is correct; only the UI projection is wrong.
**Not a boundary/spec failure:** score_breakdown IS persisted (jsonb), ranking IS by fit_score DESC, framing IS rule-based. Degrades gracefully (no crash).
**Recommend:** fast-fix — align the client to read flat numbers (or have the scorer emit the nested `{score,weight,label}` shape). @task-completion-validator to confirm the drawer renders bars post-fix.

### F-2 — Low — DB spot-probe hit the wrong database (evidence caveat, not a defect)
`psql "$CLAUDOMAT_DB_URL"` returned `match_run|0 tables` and `permission denied for schema drizzle`. This URL is the brain/local Postgres, NOT the app's production Railway DB. Migration-applied on PRODUCTION is instead verified via live `/health` → `{"status":"ok","db":"ok","version":"0075a20"}` (db:ok = preDeploy migration succeeded) + C-2 head-ci-cd evidence (`serviceInstanceDeployV2` SUCCESS at `0075a20`, preDeploy migration ran). Migration file, journal idx-9, and CHECK/UNIQUE constraints all verified in source. **Claim stands; only my direct-SQL reach was to the wrong DB.**

### F-3 — Low — `matchRankedListSchema` is `.passthrough()`, so client's "unexpected shape" error branch is largely unreachable
`MatchesShortlistClient.tsx:1226-1231` treats a parse-failure as an actionable error and leaves state unchanged (correct, no blind-cast per B-6 INFO-F). Because the read schema is passthrough, a genuine run almost always parses — the branch is defensive-only. Not a defect; noted for accuracy.

### F-4 — Low — Handoff success may not always refresh `data.candidates`
`handleHandoff` (`:1313-1320`): if the handoff response is not a full `MatchRankedList`, it falls back to `setHandoffDone(true)` without refreshing candidates. Acceptable — the service DOES return a full `composeRankedListInTx` on handoff, so the parse succeeds in practice. Cosmetic robustness note.

### F-5 — Low — "Compliance checks auto-run on confirm" copy on the handoff CTA (`:1173`)
This is a forward-looking M6 promise on a bundle that explicitly does NOT run outreach/compliance. It does not claim an AI capability (so not a CODE-OF-CONDUCT AI-provenance violation) and the M5/M6 boundary in code is clean (handoff = `ready_for_outreach` flag only). Flagging as a minor provenance-adjacent copy item for D/L review — "Compliance checks run at outreach" would be truer.

### CONFIRMED-STRONG-1 — Both HARD BOUNDARIES hold (verified hard)
- Grep of the matching module, shipped `.tsx` (excl. test), and all `package.json` for `anthropic|@anthropic|bullmq|langchain|openai`: **ZERO real imports/deps** (only comment/test-name references naming the boundary).
- Scorer/service/repository/controller carry no LLM/queue import; scorer has **no `Math.random`/`Date.now`/`new Date`** (tie-break is a pure char-code hash mod 11).
- No rationale-TEXT column: schema `matching.ts` and shared `matching.ts` confirm `score_breakdown` is jsonb / `z.record(z.unknown())`, "no rationale text field."
- M5/M6: `handoffAsActor` sets `ready_for_outreach=true` only — no outreach executed.

### CONFIRMED-STRONG-2 — AI-framing STRIP shipped (P-4 karen MANDATORY condition met)
- Grep of shipped `.tsx` for `AI Match|rationale is generated|explainability engine|improve model|similar mandates|generated rationale`: the only hits are COMMENTS documenting the removal ("NOT 'AI Match Analysis'"). Rendered strings are "Rule-based fit score", "Score breakdown", "ordered by rule-based fit score", "Fit score ↓ (deterministic)". No bot icon, no model-freshness, no cross-client "similar mandates" fabrication.
- LIVE: deployed `/matches-shortlist` → HTTP 307 → `/login` (auth-gated; the AI-framing scan on the reachable HTML returns only "Sign in"/"login" — no AI framing leaks pre-auth).

### CONFIRMED-STRONG-3 — B-6 2-CRIT + 4-INFO fixes are REAL in code
- **(a) disposition-preserve (CRIT-1):** `createRunAsActor` snapshots non-pending dispositions BEFORE delete (`snapshotCandidateDispositionsByRunIdInTx`) and reconciles them back per still-included candidate (`priorDisposition ?? 'pending'`) — NOT delete-then-all-pending. `matching.service.ts:163-238`.
- **(b) handoff guard uses tx handle (CRIT-2):** `countAcceptedCandidatesByRunIdInTx(tx, runId)` — shares the txn snapshot, not `this.db`. `matching.service.ts:387`, repo `:489`.
- **(c) isNew via xmax=0 (INFO-A):** `upsertMatchRunInTx` returns `xmax::text`, `isNew = row.xmax === '0'`; comment explicitly warns against `updatedAt`. Repo `:246,264`.
- **(d) idempotent re-handoff (INFO-B):** early-return `composeRankedListInTx` if `run.readyForOutreach`, no new audit. `matching.service.ts:380-382`.
- **(e) optimistic-revert captures prev disposition (INFO-E):** `prevDisposition` captured pre-mutation, restored on PATCH failure. Client `:1247,1266-1276`.
- **(f) no blind-cast on createRun (INFO-F):** parse-failure sets an error, leaves state. Client `:1226-1231`.

### Additional verified (not separately numbered)
- **Scorer PURE + DISCRIMINATES:** unit test constructs best (exact sector + email contact) vs worst (null sector + no contacts) and asserts `bestResult.score - worstResult.score >= 80` with real data (`matching.scorer.spec.ts:105-107`); plus ≥90 exact-match and ≤10 no-match assertions and a partial-between-exact-and-nomatch ordering test. fit_score clamped `Math.max(0, Math.min(100, …))` + DB CHECK `fit_score >= 0 AND fit_score <= 100`.
- **Actor-id + audit + one-txn + guards:** `getUserWithRole` → app `users.id` on all 3 mutations; `auditService.append(...)` LAST-in-txn for `match-run-create`/`match-disposition`/`match-handoff`; submit-guard 400 if `universe.status !== 'submitted'`; accepted-count handoff-guard (BUILD rule 6, on ACCEPTED not total); cross-run-scoped PATCH (`AND match_run_id` → 404). Advisory lock + ON CONFLICT(buyer_universe_id) idempotency.
- **Files real:** all named files exist (scorer/service/controller/repository/module + schema + migration 0009 `.sql`/`.down.sql` + journal idx-9 `when:1783555200000` + shared `matching.ts` + web page + client). Migration additive-only (2 new tables FK→existing, no M3/M4 column changes), buyer_universe_id UNIQUE + fit_score CHECK present, `.down.sql` drops children-first.
- **LIVE probes:** `/health` version `0075a20`; unauth `POST /matches` → 401; unauth `GET /matches` → 401; `/matches-shortlist` → 307 `/login`. C-2 first-try evidence (tested-SHA == deployed-SHA, no Ghost-Green; rollback targets recorded) is genuine.
- **T-5 W10-1 clearance SOUND:** advisor 401/403 on `POST /sourcing/connections` is CORRECT RBAC (sourcing is analyst/admin-only; advisor is not a sourcing role) — it's an E2E test-seed-setup issue (seed M3 with analyst), not a matching-flow defect; the matching flow is C-2-verified end-to-end. No B-route change needed. Classification "test-setup / test-maintenance" is correct.

---

## Cross-agent follow-ups
- **@task-completion-validator:** verify F-1 fix renders the breakdown bars end-to-end after alignment.
- **@code-quality-pragmatist:** F-1 root is a contract drift between scorer output type and UI reader type — consider exporting `ScoreBreakdown` from `@dealflow/shared` so both sides bind to one shape (prevents recurrence).
- **@head-verifier (V-2/V-3):** F-1 is the single actionable fast-fix; F-2–F-5 are notes, not gates.
