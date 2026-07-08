# V-1 Karen — Reality Verdict (Wave 30, M9 Affinity DataSourceAdapter)

**Verdict: APPROVE**
**Findings: 3 (all INFO/non-blocking — 0 Critical, 0 High, 0 Medium)**
**Independent /health @a6ad02c confirmation: YES (probed prod twice, live version = a6ad02c, db:ok, HTTP 200)**

---

## Deployed-state anchor (proof, not inference)

- Prod `GET https://dealflow-api-production-66d4.up.railway.app/health` → **HTTP 200** `{"status":"ok","db":"ok","version":"a6ad02cb2d613291da7b62f48df2a4d64b08aeef"}` — probed independently, twice, this turn.
- `a6ad02c` **is an ancestor of `main`** (`git merge-base --is-ancestor` → YES). Current main HEAD is `97556e9` (T-block deliverables, `[skip ci]`), and `git diff --stat a6ad02c..main` is **process/docs-only** (8 files under `process/waves/wave-30/`, ZERO code). Therefore the LIVE-deployed adapter code == the code reviewed here.
- LIVE returns 200 with the Affinity key **unset** on Railway → the app **boots cleanly with the adapter registered but dormant**. This is the load-bearing proof of "graceful-no-key + registered."

## Verify checklist

**1. Files exist @a6ad02c / main (REAL).** PASS
- `command-center/dev/SDK-Docs/Affinity/affinity.md` (345 lines) — present.
- `apps/api/src/modules/sourcing/adapters/affinity.adapter.ts` — present, 413 lines, full implementation (not a stub).
- `apps/api/src/modules/sourcing/adapters/affinity.adapter.spec.ts` — present, 12 tests (8 numbered + 4 additional).
- `apps/api/src/modules/sourcing/adapters/adapter.registry.ts` — present; `createDefaultRegistry()` registers `new AffinityDataSourceAdapter()` alongside the fixture (registry.ts:986).

**2. NO key committed (CRUX).** PASS
- Adapter reads `process.env.AFFINITY_API_KEY` ONLY (`affinity.adapter.ts:294`). No literal key value anywhere.
- Full wave diff scan for real-key assignment patterns (`api_key = '...16+ chars'`, excluding fakes) → **NONE**.
- Only literal "keys" present are fake test values: `test-api-key-do-not-use` (spec:92) and `my-test-api-key` (spec:495). No hard-coded `Basic <base64>` auth string — auth header is built at runtime via `Buffer.from(':'+apiKey)` (affinity.adapter.ts:132).
- `.env.example:42` is **name-only**: `AFFINITY_API_KEY=` + comment, no value. (apps/api/.env.example also present.)
- SDK doc references the var by name only (name-only convention documented at affinity.md:336).

**3. Graceful-no-key + registered (lazy read).** PASS
- Key read is **inside `fetchCompanies`** (line 294/295), NOT the constructor. Class body only sets `providerKey` (line 269); `createDefaultRegistry` merely `new`s the adapter — no env access on construction. Confirmed: the ONLY `process.env` read in the file is line 294.
- Absent key → `console.warn(...)` + `return []`, **no throw** (lines 297-303). TEST 6 genuinely asserts `results).toEqual([])`, `mockFetch).not.toHaveBeenCalled()`, and the warning log — proves no-throw + no-network on absent key.
- Registered in `createDefaultRegistry` (registry.ts:986). Fixture adapter still registered (registry.ts:985) → fixture-adapter sourcing search unaffected; Affinity returns [] dormant, no crash. LIVE 200/dormant boot corroborates.

**4. Robustness in code (NOT page-1-only).** PASS
- **Pagination:** `while(true)` loop over `page_token`; sets `page_token` param from `next_page_token`; terminates only when `next_page_token == null` (lines 312-366). TEST 1 asserts all 3 pages fetched (`orgFetchCount).toBe(3)`, 6 orgs returned) — genuine multi-page proof.
- **429 backoff:** reads `X-Ratelimit-Limit-User-Reset` header → falls back to exponential; bounded by MAX_RETRIES (lines 193-208). TEST 2 covers.
- **Retry:** transient 5xx (lines 211-222) + network/timeout errors (lines 174-190), bounded MAX_RETRIES=3. TESTs 3, 7 cover.
- **Timeout:** `AbortController` + `setTimeout(controller.abort, 30_000)` per request (lines 161-162). TEST 4 covers abort → partial [] no-throw.
- **Boundary Zod:** `affinityOrganizationsResponseSchema.safeParse` per page + `affinityPersonSchema.safeParse` per person → malformed logs + skips, no crash (lines 345-352, 395-402). TEST 8 + person-skip test cover.
- **Partial failure:** page error `break`s and returns orgs collected so far (lines 329-342). TEST 7 asserts page-1 records returned after page-2 network failure.

**5. LIVE @a6ad02c + app boots dormant.** PASS (independently confirmed — see anchor above).

## Findings (all INFO, non-blocking)

1. **INFO** — Live paginated Affinity fetch is unexercised until the founder sets `AFFINITY_API_KEY` on Railway. Correctly deferred; no-new-code activation path recorded (`process/session/updates/founder-request-affinity-api-key.md`). Not a completion gap — the wave's contract is "registered + dormant + graceful," which is met.
2. **INFO** — NOTE-1 deviation (interface's conceptual `process.env[providerKey]` vs the concrete `AFFINITY_API_KEY`) is documented in-code and in the SDK doc; self-contained, does not break the registry (registry keys on `.providerKey`, nothing does `process.env['AFFINITY']`). Correct.
3. **INFO** — Contact `title` deferred (Affinity v1 does not return it directly); documented as LATER. Out of this wave's scope.

## Conclusion

No Done-Theater. Claimed state ("adapter deployed, registered, DORMANT; no key leak; graceful-no-key; robust internal pagination/backoff/retry/timeout/Zod") matches the LIVE deployed reality at a6ad02c and the reviewed source. The crux (no committed key) holds. **APPROVE.**

wrote V-1-karen.md
