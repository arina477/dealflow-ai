# V-1 jenny — Semantic Spec Verification (wave-31, M9 Twenty CRM DataSourceAdapter)

**Verdict: APPROVE**
**Findings: 4** (0 spec-drift / 4 spec-gap or confirming-note; 0 blocking)
**Reviewer independence:** did not read Karen's output. Verified against deployed code + spec contract only. No live Twenty HTTP made.
**Date:** 2026-07-08

---

## Authoritative spec
- Pointer: `process/waves/wave-31/stages/P-2-spec.md` (source of truth: task `1eb63a40` description).
- Deployed adapter: `apps/api/src/modules/sourcing/adapters/twenty.adapter.ts`
- Mirror reference: `apps/api/src/modules/sourcing/adapters/affinity.adapter.ts`
- Shared contract: `packages/shared/src/sourcing.ts` (`normalizedSourceRecordSchema` L19-32, `normalizedContactSchema` L9-15)
- Registry: `apps/api/src/modules/sourcing/adapters/adapter.registry.ts`
- SDK doc: `command-center/dev/SDK-Docs/Twenty/twenty.md` + registry row `command-center/dev/SDK-Docs/registry.md:15`
- Founder-request: `process/session/updates/founder-request-twenty-api-key.md`
- Tests: `apps/api/src/modules/sourcing/adapters/twenty.adapter.spec.ts` — **18/18 PASS** (ran live in this review)

---

## AC-by-AC semantic verification

### AC-1 — SDK doc FIRST + registry row → CONFIRMED
`command-center/dev/SDK-Docs/Twenty/twenty.md` documents REST endpoints (`GET /rest/companies`, `/rest/people`), Bearer auth (L27-33), cursor pagination (`starting_after` / `pageInfo.endCursor`, L137-171), rate-limit handling (L173-180), and a complete normalize map (L218-229) that matches the deployed code field-for-field. Registry row present: `registry.md:15`. Git history confirms authoring order: SDK doc + adapter both landed in the B-block (commits `ad16247` → `b1f81d7`); doc is not a post-hoc stub — it cites Twenty open-source server source paths and runtime literals (page-size 60, max 200, `/rest/` prefix). **Confirms spec intent.**

### AC-2 — The adapter → CONFIRMED (all sub-clauses)
- **providerKey='TWENTY'** — `twenty.adapter.ts:84`, `:328`; test 132-136 asserts it.
- **Registered** — `adapter.registry.ts:24,61` (`createDefaultRegistry` registers `TwentyDataSourceAdapter`). Fixture + Affinity registrations retained (L59-61).
- **Mirrors affinity.adapter.ts** — structural mirror is genuine, not cosmetic. Same `fetchWithRetry` inline helper (no shared `withRetry` util — NOTE-2 honored), same `FetchResult` discriminated union, same 429/5xx/network branch order, same partial-failure "return what we have" semantics, same lazy-env read inside `fetchCompanies` (not constructor). See side-by-side below.
- **INTERNAL cursor pagination (ALL pages)** — `twenty.adapter.ts:412-468` genuinely loops. Termination is `!pageInfo?.hasNextPage || pageInfo.endCursor == null` (L464), advancing `cursor = pageInfo.endCursor` (L467) and passing `starting_after` (L418-420). **Not page-1-only** — test 1 (L145-194) proves 3 real pages fetched with cursor threading (`fetchCount===3`, all 6 records, cursor assertions on each call).
- **429/5xx-backoff + retry + timeout** — 429 exponential backoff L248-260; 5xx retry L263-274; network/timeout retry via AbortController L214-245 (`clearTimeout` in `finally`, correct). Tests 2/3/4/13 cover each path.
- **boundary-Zod** — inbound page response validated at L445 (`twentyCompaniesResponseSchema.safeParse`); malformed → logged + return partial (L446-452). Test 10 proves no-crash.
- **base-URL + key from ENV** — `TWENTY_BASE_URL` (L374) + `TWENTY_API_KEY` (L365), read from `process.env` only. **Config schema UNTOUCHED** — verified via git: merge `b1f81d7` diff touches only `.env.example`, registry, adapter(+spec), SDK docs; `dataSourceConnectionConfigSchema` (in `packages/shared/src/data-source-admin.ts`) is NOT in the diff. The only reference to it in the adapter is a code comment (L50, L361).
- **NORMALIZE Twenty → NormalizedSourceRecord** — `normalizeCompany` L292-321; semantics verified in dedicated section below.

### AC-3 — [P2-a FOLD] OUTPUT self-validation → CONFIRMED (genuinely closes the wave-30 gap)
`twenty.adapter.ts:478` — `normalizedSourceRecordSchema.safeParse(normalized)`; on failure → `console.warn(...'failed output schema validation'...)` + `continue` (L479-485), matching the `fixture.adapter.ts:85` skip+log pattern.

**Genuine gap-closure proof:** grep of `affinity.adapter.ts` for `normalizedSourceRecordSchema` returns **zero hits** — Affinity validates only INBOUND (`affinityOrganizationsResponseSchema` L344, `affinityPersonSchema` L394) but never its own normalized OUTPUT. Twenty adds the missing outbound `safeParse`. This is the exact wave-30 P2-a gap and the Twenty adapter closes it for its own output. Test 11 (L468-495) proves it: an empty-name company passes inbound Zod (`twentyCompanySchema.name` is `z.string()`) but fails `normalizedSourceRecordSchema.name` (`z.string().min(1)`), and is skipped while the valid sibling is kept.

*(Note — scope: this closes the gap for the Twenty adapter only. Affinity itself remains un-retrofitted; that is correctly out of wave-31 scope and tracked as a P3 cross-adapter follow-up per commit `91e115c`. Not a wave-31 finding.)*

### AC-4 — Secret + graceful → CONFIRMED
- **Env-only, never committed** — secret scan finds no `TWENTY_API_KEY=`/`TWENTY_BASE_URL=` value in any committed `.env`. `.env.example:43-44` carries name-only placeholders with empty values + guidance. No hard-coded key/URL in the adapter.
- **Graceful no-op if either absent** — absent key → `[]` + warn (L365-372); absent URL → `[]` + warn (L374-381). No throw. Registration is boot-safe: `TwentyDataSourceAdapter` has **no constructor** and reads env lazily inside `fetchCompanies` — instantiating it in `createDefaultRegistry` has zero side effects, so app boot + fixture + Affinity search paths are unaffected. Tests 6/7 confirm `[]` + no `fetch` call.

### AC-5 — Tests: MOCKED-HTTP, no live HTTP → CONFIRMED
All HTTP mocked via `vi.stubGlobal('fetch', ...)`. 18 tests, all required scenarios present: cursor-pagination-all (T1), 429-backoff (T2), 5xx-retry (T3), timeout (T4), normalize (T5 + domain/no-domain/no-email extras), absent-key (T6), absent-URL (T7), base-URL-https (T8) + malformed-URL (T9), boundary-Zod (T10), OUTPUT-validation (T11), auth-Bearer (T12), partial-failure (T13), depth=2 param. **No live network.** Ran the suite: 18/18 PASS.

### AC-6 — Live-verify (C-2) key-gated, deferred not dropped → CONFIRMED
`process/session/updates/founder-request-twenty-api-key.md` stages the founder ask for both instance URL and API key, explicitly scoping the wait to the live end-to-end only ("I build + unit-test the adapter autonomously; only the live end-to-end waits"). Commits `d46a42f` / `3393556` confirm deploy is boot-clean-dormant and the live verify is founder-gated, not silently dropped. Accurately deferred.

---

## Semantic normalize-map verification (Twenty → NormalizedSourceRecord)

| Field | Spec intent | Deployed (`normalizeCompany` L292-321) | Verdict |
|---|---|---|---|
| `sourceRecordId` | `company.id` | `company.id` (L315, UUID string, used directly) | MATCH |
| `name` | `company.name` | `company.name` (L316) | MATCH |
| `domain` | from `domainName.primaryLinkUrl`, protocol-stripped | `extractDomain` L170-187 → `new URL(...).hostname` (protocol + path stripped) | MATCH (see Finding 3 on `www`) |
| `contacts[]` | `company.people` depth=2 → `{name,email,title}` | L295-312: `people ?? []`, name = `[firstName,lastName].filter().join(' ')`, email = `primaryEmail ?? additionalEmails[0]`, title = `jobTitle.trim()` | MATCH |
| `raw` | full Twenty company JSON | `company as Record<string, unknown>` (L319) | MATCH |
| depth=2 request | inline people, no per-company call | `url.searchParams.set('depth','2')` L417; contacts pulled from inline `company.people` | MATCH (mirror-improvement over Affinity's per-person N+1) |

The normalize output conforms to the shared `NormalizedSourceRecord` type (contacts carry optional `name`/`email`/`title` per `normalizedContactSchema` L9-15). Test 5 asserts the full expected shape including `title`.

---

## Mirror-wave-30 structural comparison (genuine mirror confirmed)

| Aspect | Affinity (wave-30) | Twenty (wave-31) | Mirror? |
|---|---|---|---|
| Inline `fetchWithRetry`, no shared util | Yes (L159-232) | Yes (L214-285) | YES |
| `FetchResult` discriminated union | Yes | Yes | YES |
| 429 → 5xx → non-ok branch order | Yes | Yes | YES |
| AbortController timeout + `finally` clear | Yes | Yes | YES |
| Inbound boundary-Zod (`.passthrough()`) | Yes | Yes | YES |
| Partial-failure "return collected" | Yes | Yes | YES |
| Lazy env read (not constructor) | Yes | Yes | YES |
| Auth scheme | Basic (`:key` b64) | **Bearer** (correct per Twenty SDK doc) | Intentional divergence, documented |
| Pagination model | `page_token` (opaque) | cursor `starting_after`/`endCursor` | Provider-appropriate divergence |
| Contacts hydration | N+1 `GET /persons/{id}` | inline `depth=2` (no N+1) | Provider-appropriate improvement |
| **OUTPUT self-validation** | **absent (the gap)** | **present (L478)** | Deliberate super-set — closes P2-a |

The two intentional divergences (Bearer vs Basic; cursor vs token; inline vs N+1 contacts) are provider-mandated and documented in the SDK doc + code comments. The mirror is structural where it should be and diverges only where the two providers' APIs genuinely differ. This is the correct reading of "mirror" — not blind copy.

---

## Findings (all non-blocking; enumerated for the record)

**Finding 1 — [spec-gap, Low] Whole-company drop on a single malformed contact email.**
`normalizedContactSchema.email` is `z.string().email()` (strict) and `normalizedSourceRecordSchema` is `.strict()` over a `contacts` array. In `normalizeCompany`, a person whose Twenty `emails.primaryEmail` is free-text (not RFC-valid) yields a contact that fails `.email()`, which fails the whole-record `safeParse` at L478 → the **entire company** is skipped (L484 `continue`), not just the bad contact. The spec ("skip+log invalid — match fixture.adapter.ts") is satisfied *literally* (fixture drops at record granularity too), so this is a **gap, not drift** — the spec did not distinguish contact-level vs record-level granularity. Real-world M&A CRM data commonly has dirty email fields, so at live-hookup a small number of otherwise-valid companies could silently drop. Recommendation: at live-verify (C-2), consider per-contact validation (drop the bad contact, keep the company) as a P3 follow-up. Not blocking: behavior is safe (no crash, logged) and matches the referenced fixture pattern verbatim.

**Finding 2 — [spec-gap, Low] Boundary-Zod page failure aborts remaining pages.**
On an inbound page failing `twentyCompaniesResponseSchema` (L446), the loop `break`s and returns records collected so far — one malformed page mid-run truncates the rest. This mirrors Affinity exactly (intended parity) and matches the "partial failure returns collected" spec intent, so it is confirming-parity, not drift. Noted only because "all pages" (AC-2) and "partial truncation on one bad page" are in mild tension; the spec's partial-failure clause governs and the code honors it. Not blocking.

**Finding 3 — [confirming-note, informational] `domain` retains `www.` subdomain.**
`extractDomain` returns `url.hostname`, so `https://www.example.com/path` → `www.example.com` (test 585 asserts this). The spec said "protocol-stripped" (satisfied) — it did NOT ask for `www`-stripping at the adapter layer. This is correct by design: `www`/path/case normalization is the downstream persistence concern (`companies.normalizedDomain`, per `packages/shared/src/sourcing.ts:83`), not the adapter's. Affinity likewise emits raw `org.domain`. Confirms spec intent; no action.

**Finding 4 — [confirming-note, informational] `_connection` argument unused.**
`fetchCompanies(_connection)` ignores the connection row; credentials come from env, per the `DataSourceAdapter` contract comment (`sourcing.ts:62-67`) and mirroring both Affinity and fixture. Interface-compliant, intended. No action.

---

## Compliance-first lens (DealFlow AI)
No auth/payments/user-creation/cookie/CSRF/session surface in this wave — a read-only external sourcing adapter. The one security-relevant control (SSRF/misconfig guard on `TWENTY_BASE_URL`: parse + `protocol==='https:'` before any HTTP, L384-401) is present and tested (T8/T9). Secret handling is env-only, never committed (AC-4). No audit-log or RBAC invariant is touched. T-8 security stage already cleared (commit `3393556`); this review concurs from the semantic angle.

---

## Conclusion
Deployed behavior matches P-2 spec intent beyond acceptance-criteria literalism. Cursor pagination genuinely fetches all pages; normalize map matches the shared type and SDK doc field-for-field; the P2-a OUTPUT-validation is real and genuinely closes the wave-30 Affinity outbound-validation gap for the Twenty adapter; base-URL is env-sourced and https-validated with the config schema untouched; graceful-dormant is boot-safe and leaves fixture/Affinity search intact; the founder credential request is properly staged so the live-verify is deferred, not dropped. Four findings, all non-blocking (two Low spec-gaps for the C-2 live-hookup backlog, two confirming-notes). Zero spec-drift.

**VERDICT: APPROVE**
