# Wave 23 — V-1 Karen (deployed-state reality check)

**Verdict: APPROVE** — 7/7 load-bearing claims TRUE in deployed state @6c22919. 0 blocking findings; 1 non-blocking note.

- Milestone: M9 seller-intent (seed 9e54cc11)
- Deployed API: https://dealflow-api-production-66d4.up.railway.app (`/health` version==`6c229197…`, db:ok)
- Deployed web: https://dealflow-web-production-a4f7.up.railway.app
- Verified SHA: `6c22919` (deployed tip). Checkout HEAD is `9df066b` (post-C+T deliverables, [skip ci]) — all source claims verified via `git show 6c22919:<path>`, NOT the working tree.

---

## Method note
Karen verifies the **deployed** SHA, not the working tree. All source greps run against `git show 6c22919:…`. Live routes hit the two prod URLs directly. Gate/deliverable claims (RLS-GUARD, deploy provenance) cross-checked against C-2 deliverable + B-6/T-9 verdicts.

---

## Claim-by-claim findings

### CLAIM 1 — Deploy serves 6c22919 + dealflow_app RLS-GUARD up — **TRUE**
- Evidence: `curl /health` → `200 {"status":"ok","db":"ok","version":"6c229197f4dfb12352e766e1754502a9f76b51e9"}`. version==deployed tip (not stale 86ddc29).
- RLS-GUARD: `process/waves/wave-23/stages/C-2-deploy-and-verify.md:61` — `db:ok` at deployed tip ⇒ boot-time RLS-GUARD passed (guard fails `/health` if superuser); non-superuser `dealflow_app`, DATABASE_URL unchanged (`C-2…md:8`). Deploy fired to explicit `commitSha 6c22919` via `serviceInstanceDeployV2`, both services SUCCESS (`C-2…md:49-50`), old deployments removed (`:53`).

### CLAIM 2 — PURE scorer @6c22919 (no Date.now/new Date/LLM/random/network) — **TRUE**
- File: `apps/api/src/modules/seller-intent/seller-intent.scorer.ts`
- `Date.now()` / `new Date(` in **code**: NONE. All 8 hits are comments/docstrings (`:9,16,26,72,135,143,284,292,311,390`), each a "NOT Date.now()" disclaimer.
- `Math.random`: NONE in code (2 comment hits `:8,16`).
- Anthropic/openai/@ai-sdk/fetch/axios/http/bullmq/require imports: NONE (1 comment hit `:7`).
- Determinism: only `Date.parse(<fixed string>)` used for epoch conversion (deterministic, pure); `referenceInstant` passed IN via input (`scorer.ts:143`, `SellerIntentScorerInput`), never derived from wall-clock.

### CLAIM 3 — SI1: NO tieBreak (scorer + shared + web) — **TRUE**
- Scorer output (`scorer.ts:434-440`): breakdown = `{outreachEngagement, pipelineVelocity, matchDisposition, total, notApplied}` — no tieBreak field. All 6 `tieBreak` string hits are comments (`:11,18,21,154,287,431`).
- Shared (`packages/shared/src/seller-intent.ts:62-70`): `sellerIntentBreakdownSchema` object keys are the 5 above — no tieBreak. All tieBreak hits are comments/invariant docs (`:6-10,46,59-60,83,108`).
- Web (`apps/web/app/(app)/insights/page.tsx`): no **rendered** tie-break JSX (grep for `>…tie-break…<` / `tieBreak:` excluding comments → NONE). All tieBreak mentions are exclusion comments (`:31,39,220,326`).

### CLAIM 4 — Workspace-scoped: getDb on every query, fail-closed if GUC null — **TRUE**
- Repository (`seller-intent.repository.ts`): `getDb(this.db)` used **3×** (one per query method); `this.db.` never used directly as a query handle (grep `this.db\.` → NONE; `this.db` only ever passed as arg to `getDb`). Every read: `const db = getDb(this.db)` → `.select(...)` (`:104,109,129,153,175`).
- Service fail-closed (`seller-intent.service.ts:59-63`): `const workspaceId = getWorkspaceId(); if (workspaceId === null) { throw new Error(...) }` — SI3 fail-closed, throws when no ALS/GUC context.

### CLAIM 5 — Routes live (NOT 404) — **TRUE**
- `curl anon GET /seller-intent` → **401** (mounted; `@Controller('seller-intent')` `seller-intent.controller.ts:47`, `@Get()` `:61`, `SessionGuard+RolesGuard` `:62`).
- `curl GET /insights` (web) → **307** → redirect `…/login` (route exists, auth-gated; not 404).

### CLAIM 6 — Read-only + audit intact — **TRUE**
- Seller-intent path INSERT/UPDATE/DELETE/AuditService: NONE. Repository `:17` "ZERO writes. No INSERT, UPDATE, DELETE. No audit row." Service `:19,52` "ZERO writes… No audit row appended (same as analytics)." Grep across service+repository → no mutation verbs, no AuditService.
- `curl anon /compliance/audit-log/verify` → **401** (auth gate intact, not 500 — audit-log endpoint healthy).

### CLAIM 7 — RBAC fail-closed + B-6 NaN-seed fix (854bad5) — **TRUE**
- RBAC (`seller-intent.controller.ts:38-40,63`): `SELLER_INTENT_ROLES = [...rolesForRoute('/seller-intent')]`; boot-time guard `if (SELLER_INTENT_ROLES.length === 0) throw` (fail-closed — controller won't mount with empty roles); `@Roles(...SELLER_INTENT_ROLES)` — advisor+admin per header (`:7-10`). Anon → 401 confirmed live (Claim 5).
- **NaN-seed fix (854bad5) — CONFIRMED at both sites @6c22919:**
  - Scorer (`scorer.ts:314-320`): `const seedTs = completed[0]!.completedAt ?? completed[0]!.createdAt;` then `completed.slice(1).reduce((best, a) => Date.parse(ts) >= Date.parse(best) ? ts : best, seedTs)`. Seed is a **real timestamp**, NOT `''` — `Date.parse('')===NaN` edge avoided. Chronological `Date.parse` comparison.
  - Repository (`repository.ts:208-214`): `referenceInstant = allTimestamps.reduce((a,b) => Date.parse(a) >= Date.parse(b) ? a : b)` and mandate fallback `mandateRows.reduce((a,b) => Date.parse(a.createdAt) >= Date.parse(b.createdAt) ? a : b)` — chronological, not lexical.
  - Commit `854bad5` "fix(seller-intent): B-6 chronological timestamp comparison + epsilon docstring" is in history reachable from `6c22919` (touches scorer + repository, 2 files).

---

## Non-blocking note (NOT a rejection)

**N1 (Low)** — `sellerIntentBreakdownSchema` uses `.passthrough()` (`packages/shared/src/seller-intent.ts:70`). This does NOT strip unknown keys, so a hypothetical upstream `tieBreak` would survive validation rather than being rejected. SI1 is nonetheless satisfied **by construction**: the scorer's return object (`scorer.ts:434-440`) contains exactly the 5 known keys and never emits tieBreak, and the web layer never renders one. `.strict()` would harden the invariant defensively, but there is no live defect — no code path produces tieBreak. Logged for L-block consideration, not V-block REWORK.

---

**APPROVE — 7/7 claims TRUE, 0 blocking findings, 1 low non-blocking note (schema .passthrough); wrote V-1-karen.md**
