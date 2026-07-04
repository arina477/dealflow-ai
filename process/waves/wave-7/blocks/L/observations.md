# Wave 7 — L-block Observations

Sourcing-workspace page (`/sourcing`, M3 search entry) shipped + live-verified at `e4debc6`.
Synthesized by `knowledge-synthesizer` against wave-7 deliverables + prior `min(5,N-1)` waves'
observations, then reality-checked and dispositioned by `head-learn`. Cross-wave glob path is
canonical `blocks/L/observations.md` (future L-2 reads `_archive/wave-*/blocks/L/observations.md`).

Reviewer note: the richest wave-7 material is a 5-sibling web-render defect chain, EACH masked by
the previous, ALL in the "web SSR/client render of the REAL API shape" family, NONE caught by green
CI/unit tests, ALL caught only by live post-hydration chromium DOM against real seeded data
(`process/waves/wave-7/stages/V-3-fast-fix.md`). karen's reality-check corrected an initial
over-claim: only defects 1-3 are real-data-shape divergences; defects 4-5 (RSC function-prop 500,
page-route collision) are data-independent and caught by live-browser execution regardless of data.
The load-bearing variable across all 5 is *live post-hydration render*; "real seeded data" is
load-bearing for 3/5. This distinction is preserved below to keep the observations falsifiable.

---

## OBS-W7-1: V-block verification of a UI data-rendering surface must exercise a live post-hydration render (and, for list surfaces, real seeded rows)

**Systemic root:** No gate or plan convention mandates that the V-block render a UI data surface in a live post-hydration browser DOM against real seeded data before declaring it verified. Without a live render, a list that silently drops its payload on a parse/fetch failure is visually indistinguishable from empty data; without a live browser, an RSC-boundary crash or a route collision never executes. Unit + E2E layers used mock shapes (ISO timestamps, no server-added fields) and passed green. The single method that surfaced all 5 siblings was live post-hydration DOM inspection; real seeded data was additionally load-bearing for the 3 schema-parse defects.

**Plan-authoring defect trace:** The wave-7 plan carried no explicit V-block precondition to seed real data and assert rendered rows in the hydrated DOM. Defect #2 (`.datetime()` rejecting PG-wire) was latent since wave-6 precisely because wave-6's V-block rendered against empty tables.

**Cross-wave lineage:** FIRST-OBSERVATION of the V-block live-render-method safeguard. The broader "green-CI/mocks-pass but real-boundary-fails" family is confirmed across waves 2 (CORS), 4 (pg-wire serialization → VERIFY rule 1), 5 (FK id-space), 6 (build-output completeness). Distinct from VERIFY rule 1 (test-layer recompute path, not V-block render method) and T-5 rule 1 (CORS/cookie via real browser, not render-correctness against real data).

**Severity:** strong. **Candidate file:** VERIFY. **Disposition:** NOT promoted (first-observation of the render-method safeguard; per contract "broke once" stays until a second wave confirms; also carries near-duplicate risk with VERIFY rule 1 ∩ T-5 rule 1 per karen). Carry-forward for wave-8; if it re-fires, the promotable form must name *live post-hydration render* (not "real seeded data") as the load-bearing variable and cover both drop-and-crash failure modes.

---

## OBS-W7-2: Web read-schemas parsing an API response must accept the API's real serialization; `.datetime()` and `.strict()` silently drop the payload

**Systemic root:** `z.string().datetime()` accepts ISO 8601 but REJECTS the PostgreSQL wire timestamp (`YYYY-MM-DD HH:mm:ss+00` — no `T`, `+00` not `Z`); `companySchema.strict()` rejects any unrecognized key, including `connectionIds` added server-side at B-6. The list-fetch pattern returns `[]` on `safeParse` failure with no throw and no log, making the drop invisible to any test using mock shapes. Three of the five siblings (defects 1, 2, 3) are this mechanism.

**Plan-authoring defect trace:** The read-schema spec did not require (a) the PG-wire timestamptz read-back format as a mandatory parse fixture, nor (b) a shared-schema update whenever the API response shape gains a server-computed field. B-6 added `connectionIds`; the shared `companySchema` and its mock-based unit tests were not updated → `.strict()` unrecognized_keys in prod.

**Cross-wave lineage:** FIRST-OBSERVATION of the client-read-schema sub-class; CONFIRMS-PRIOR the wave-4 serialization-divergence family at the opposite (client-parse) boundary. Adjacent to VERIFY rule 1 (server recompute against real DB wire format) but distinct layer.

**Severity:** strong. **Candidate file:** BUILD (schema-authoring constraint). **Disposition:** NOT promoted (first firing of the client-read-schema sub-class; family-adjacent to VERIFY rule 1 but the specific client-parse mechanism needs a second wave). Strong wave-8 candidate.

---

## OBS-W7-3: A client fetch to a same-origin path that is also a framework page route is served the page HTML, not API JSON

**Systemic root:** Next.js App Router resolves an incoming path against `app/` page routes before any API/proxy fallback. A programmatic `apiFetch('/sourcing/companies/:id')` to a path that has a `page.tsx` receives the rendered HTML; `JSON.parse` throws (surfaced as "Network error"). The fix required SSR-hydration of the initial render plus a non-colliding proxied path (`/sourcing/company-detail/:id`).

**Plan-authoring defect trace:** The detail-drawer B-block instruction specified a client fetch to `/sourcing/companies/:id` without auditing that path against the `app/` page-route namespace, where an identically-patterned page route existed.

**Cross-wave lineage:** FIRST-OBSERVATION of the page-route-collision mechanism. Shares a *fix* pattern (same-origin proxy at a non-colliding path) with wave-4 OBS-4 (HELD: cookie-guarded route needs same-origin proxy) but a DISTINCT root cause (page-route match returns HTML vs httpOnly cookie not sent cross-origin). Not a duplicate; must not be merged.

**Severity:** warning. **Candidate file:** BUILD. **Disposition:** NOT promoted (first-observation; distinct-mechanism, single firing). Carry-forward.

---

## OBS-W7-4: A hand-authored drizzle migration with a missing or stale `_journal.json` `when` is silently skipped (Ghost Green) — PROMOTED

**Systemic root:** drizzle-orm `migrate()` gates each migration with the coarse guard `lastDbMigration.created_at < migration.folderMillis` (not a per-hash set-difference). A hand-authored `_journal.json` entry whose `when` predates the last applied migration is treated as already-applied and skipped; preDeploy prints "migrations applied successfully!" regardless — a Ghost Green. Migration 0005's idx-5 `when=1751673600000` (2025-07-05) was 364 days older than 0004's `1783123198319`, so 0005 no-op'd; UNIQUE(display_name) was absent in production and duplicate connection-create returned 201 instead of 409. drizzle-generate populates `when` from the clock automatically; hand-authored entries bypass that safeguard.

**Plan-authoring defect trace:** The B-block migration-authoring contract did not require hand-authored journal entries to carry a `when` strictly greater than the most recent existing entry, nor a post-migrate row-count assertion in preDeploy to make "applied nothing" fail hard. The unconditional success log gave no signal of the skip.

**Cross-wave lineage:** CONFIRMS-PRIOR wave-6 OBS-6 — SECOND FIRING of the "hand-authored drizzle migration silently skipped" family. Wave-6 = migration absent from journal (missing registration); wave-7 = entry present with a stale `when`. Wave-6 OBS-6 (BUILD, informational, FIRST-OBSERVATION) explicitly predicted: "OBS-6 would become a stronger BUILD candidate if a future wave's drizzle migration is silently skipped." Same silent-skip outcome, same lying success log; wave-7 upgrades severity because the skip removed a production constraint and cascaded (dup→201, and later unmasked the 23505→500 unwrap bug once the constraint finally fired).

**Severity:** warning→strong (production-constraint absence + downstream cascade). **Candidate file:** BUILD. **Disposition:** PROMOTED to BUILD rule 4 (2-wave-confirmed; karen APPROVE; linter PASS). The promoted rule consolidates both sub-classes: must appear in `_journal.json` AND `when` greater than all prior entries.

---

## OBS-W7-5: drizzle wraps native pg error codes under `err.cause.code`; a catch on `err.code` is a runtime no-op

**Systemic root:** drizzle wraps pg driver errors in `DrizzleQueryError`; the SQLSTATE (e.g. `23505`) lives at `err.cause.code`, while the wrapper's own `.code` is `undefined`. A catch testing `err.code === '23505'` is always false against a real driver error, so the intended `ConflictException(409)` branch is dead and Nest surfaces 500. Doubly masked: the constraint didn't exist until 0005 finally applied (OBS-W7-4), and the B-block unit test threw a bare `{code:'23505'}` object, not a `DrizzleQueryError`.

**Plan-authoring defect trace:** No SDK-doc step (per `external-sdk-integration-rules.md`) captured drizzle's error-nesting model before authoring the catch; the unit-test mock's error shape did not match the real wrapper, so coverage passed while prod broke. Same "stub doesn't match the real boundary" family as VERIFY rule 1, applied to error-handling paths.

**Cross-wave lineage:** FIRST-OBSERVATION of the `DrizzleQueryError.cause.code` nesting sub-class. **Severity:** warning. **Candidate file:** BUILD. **Disposition:** NOT promoted (first firing). Carry-forward; watch any future `23xxx` catch.

---

## Secondary signal (informational, no candidate)

- **409 misdiagnosed as 401 (T-5 S2):** the "session/cookie bug" logged at T-5 S2 was a `UNIQUE(display_name)` 409 conflict from a prior test run by the same email, not an auth failure. A conflict is not an authentication failure; test triage must distinguish `409` (state collision / non-idempotent fixture) from `401` (session absent) before routing to the auth domain. Informational; no promotion.

---

## Cross-wave confirmation + carry-forward summary

| Obs | Cluster | Confirmation | Near-dup risk | Candidate file | Promoted |
|---|---|---|---|---|---|
| OBS-W7-1 | live-render V-block method | FIRST-OBSERVATION | VERIFY-1 ∩ T-5-1 (per karen) | VERIFY | No |
| OBS-W7-2 | web read-schema accepts real serialization | FIRST-OBS (confirms wave-4 family) | adjacent to VERIFY-1 | BUILD | No |
| OBS-W7-3 | page-route collision returns HTML | FIRST-OBSERVATION | none (distinct from wave-4 OBS-4) | BUILD | No |
| OBS-W7-4 | drizzle journal missing/stale `when` skip | CONFIRMS-PRIOR wave-6 OBS-6 (2nd firing) | none | BUILD | **Yes → rule 4** |
| OBS-W7-5 | DrizzleQueryError.cause.code nesting | FIRST-OBSERVATION | none | BUILD | No |

**Carry-forward queue after wave-7:** wave-4 OBS-4 (same-origin proxy for cookie-guarded routes, BUILD, CONFIRMED-AND-READY — wave-7 defect #5 does NOT confirm it, distinct root cause); wave-5 OBS-1 (FK-cross-id-space, VERIFY); wave-5 OBS-2 (T-5 mutating POST); wave-6 OBS-2 (nest-cli.json assets, BUILD). None re-fired in wave-7. New this wave: OBS-W7-1/2/3/5.
