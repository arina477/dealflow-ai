# V-1 Semantic-Spec Verification — jenny — DealFlow AI Wave 1

**Verdict: APPROVE**
**Findings: 3** (drift: 0 | gap: 3 — all Low/informational; none block the wave)

Spec-contract source of truth: `tasks.description` of `e83584db-6387-4567-916c-aacba5c5dede` (read live from DB). Convenience copy `process/waves/wave-1/stages/P-2-spec.md` matches the DB row — **no P-2 divergence detected**.

Scope acknowledged: infra+backend foundation wave. No product features, auth, or compliance/audit surface expected (those are M2). Absence of future-milestone features is NOT flagged as drift.

---

## 1. Acceptance-criteria semantics — deployed behavior vs INTENT

| AC (intent) | Deployed evidence | Verdict |
|---|---|---|
| /health → 200 `{status:ok, db:ok, version}` when Postgres reachable | Live probe: `HTTP/2 200`, body `{"status":"ok","db":"ok","version":"4cad0179de58cc6fe6b11b36cb2e1496aedea4bf"}` | PASS |
| Invariant: NEVER 200 on DB failure (503 degraded path) | `apps/api/src/health/health.controller.ts:15-17` throws `HttpException(result, HttpStatus.SERVICE_UNAVAILABLE)` whenever `result.status === 'degraded'`. The 200 return at line 19 is structurally unreachable for a degraded result. Invariant holds by construction. | PASS (reasoned — see §3) |
| version = git SHA | Deployed `version` = `4cad0179de58cc6fe6b11b36cb2e1496aedea4bf` = current `git rev-parse HEAD` (exact 40-char match). Source `health.service.ts:9` reads `process.env.GIT_SHA ?? 'dev'`; prod has GIT_SHA correctly injected (no `dev` fallback observed). | PASS |
| Web renders placeholder + surfaces API health (fetches /health, shows ok/degraded) | Deployed web HTML renders System Status pill = `ok`, API = `ok`, Database = `ok`, Version = `4cad0179…`. The version SHA on the web page IS the live API SHA — provable ONLY if the SSR fetch to `/health` succeeded at request time. `apps/web/app/page.tsx:12` `force-dynamic` + `:24` `cache: 'no-store'` confirm live per-request fetch, not build-baked. | PASS |
| content-type application/json | Live header: `content-type: application/json; charset=utf-8` | PASS |
| @dealflow/shared HealthResponse Zod schema imported by BOTH apps | api: `health.controller.ts:1` + `health.service.ts:1` import the `HealthResponse` type. web: `page.tsx:15` imports **and runtime-executes** `healthResponseSchema.safeParse(raw)` (`page.tsx:34`). Shared-contract wiring is not merely type-level — the web validates the live API payload against the shared Zod schema on every request. Intent (prove the shared-contract wiring) fully met. | PASS |

All ACs verifiable at V-1 (deployed) match their intent.

## 2. Contract conformance (HealthResponse)

Live payload `{"status":"ok","db":"ok","version":"4cad01…"}` conforms EXACTLY to the contract `z.object({ status: z.enum(['ok','degraded']), db: z.enum(['ok','down']), version: z.string() })`:
- `status` = `"ok"` ∈ enum ✓
- `db` = `"ok"` ∈ enum ✓
- `version` = non-empty string ✓
- No extra keys in the payload ✓
- HTTP 200 + `application/json; charset=utf-8` ✓

Independent runtime confirmation: the web app's own `safeParse` against this schema returns success (the page rendered the parsed values rather than the "invalid response shape" branch at `page.tsx:35-36`).

## 3. Edge / negative semantics (reasoned — NOT probed; prod DB intentionally not broken)

- **DB-down → 503 degraded:** `apps/api/src/db/index.ts:25-31` `checkDbHealth()` runs a real `SELECT 1` round-trip inside try/catch (returns `false` on any connection error), with a 3s `connectionTimeoutMillis` (`index.ts:15`). `health.service.ts:12-16` maps `dbOk=false` → `{status:'degraded', db:'down', version}`, and the controller converts that to HTTP 503. The 200/503 dichotomy is derived from a single `status` value, so a degraded body can never ship with a 200. Deployed response shape (matching the ok branch precisely) plus the e2e spec (`apps/api/test/health.e2e-spec.ts`, T-block real-Postgres) give high confidence the degraded branch behaves as specified. **Not exercised against prod (would require breaking prod DB — correctly avoided).**
- **Env fail-fast:** `db/index.ts:7-11` validates `DATABASE_URL` via Zod `parseEnv` at module load — a missing/invalid URL fails at boot, not silently. Matches the edge-case spec.

## 4. User-journey continuity

Web placeholder is the only route this wave (journey map pages #1-#20 are all M2+ and correctly absent). HTTP-level crawl of `/` returns 200 `text/html` with a fully-rendered health card; no dead-end, no unhandled error. Degraded/unreachable paths are handled gracefully: `page.tsx:39-42` catches fetch failure → renders a `role="alert"` error box (`page.tsx:177-213`) rather than throwing. Continuity holds.
*Limitation: no headless-browser interaction crawl performed (Chrome availability not assumed); HTTP-level + SSR-output inspection only. Adequate for a single static placeholder with no client-side interactivity.*

## 5. Spec-gap detection (deployed behavior revealing what the spec didn't anticipate)

**GAP-1 (Low, informational) — `version` present in the degraded response, but the spec's degraded contract omits it.**
Spec AC #4 and the `api` contract error envelope specify degraded body as `{status:'degraded', db:'down'}` (no version). The implementation returns `{status:'degraded', db:'down', version}` (`health.service.ts:16`) — version is always included. This is arguably *better* (version is useful during an incident) and still conforms to the `HealthResponse` Zod contract (which mandates `version`). This is a **spec-GAP** (spec's degraded example under-specified vs its own type contract), not code drift — the code is correct against the stricter contract. Recommend the spec's degraded example be reconciled to `{status:'degraded', db:'down', version}` at the next P-2 touch. No action required this wave.

**GAP-2 (Low, informational) — web "degraded" surfacing has two distinct sources the spec folds into one.**
Spec AC #5 says the web "shows ok/degraded." Deployed code distinguishes (a) API reachable but reporting degraded vs (b) API unreachable / non-2xx / bad shape (`page.tsx:29-42`), both collapsed to a `degraded`/`down` display with a specific `reason` string. Richer than spec anticipated; strictly an improvement. No action.

**GAP-3 (Low, informational) — spec references `pnpm dev` / local commands (AC #1,2,6,7,8,9,10) not verifiable at V-1 (deployed-state stage).**
These are build/CI-time criteria owned by C-block/T-block and Karen's source-claim verification, not deployed-behavior semantics. Noted as out-of-scope for V-1 jenny, not a defect. Deferred to Karen's independent V-1 pass.

---

## Cross-references
- Source-claim truth (do the local commands actually pass, is CI genuinely green, no fabricated results) → **Karen** (independent V-1 pass).
- No REWORK-triggering findings. No compliance/RBAC/audit surface in scope this wave.

**Bottom line:** Deployed behavior matches the spec contract's INTENT on every V-1-verifiable acceptance criterion. The 503/degraded invariant is correct by construction. Zero drift. Three low-severity spec-GAPs (spec under-specified vs a stricter-and-correct implementation) — none block the wave.
