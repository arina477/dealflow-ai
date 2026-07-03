# Wave 4 — L-2 Distill Observations

Synthesized from wave-4 artifacts (tamper-evident HMAC hash-chain audit log, M2 compliance backbone).
Wave archives reviewed in full: wave-1 (OBS-1..OBS-6), wave-2 (OBS-1..OBS-5), wave-3 (OBS-1..OBS-6).
Cross-wave lineage explicitly reconciled per observation. Severity ranked: strong > warning > informational.

---

## Cross-wave reconciliation notes (non-observations)

**Wave-3 OBS-4 (NestJS guard DI: consuming module must export the injected dependency) — NON-FIRING.**
Wave-4 introduced a new `AuditModule` and wired it into `ComplianceModule` as an import. B-2 notes
"keyring via useFactory (avoid DI-resolve of defaulted param)" as a deliberate deviation; C-2 boot logs
show "Nest application successfully started" with no `UnknownDependenciesException`. The exported-provider
pattern (wave-3 fix: `AuthModule` exports `AuthRepository`) was reused cleanly: `AuditModule` exports
`AuditService` + verifier, and `ComplianceModule` imports `AuditModule`. No DI crash. This is an absence
of the wave-3 OBS-4 stimulus, not a new confirmation. Wave-3 OBS-4 remains CONFIRMED-AND-READY for BUILD
promotion at a future wave.

**Wave-3 OBS-5 / wave-1 OBS-1 (pnpm-workspace.yaml overrides) — NON-FIRING.**
No new third-party SDK introduced this wave (`node:crypto` is a Node.js built-in; B-0 `deps_added: []`).
No `pnpm audit` FAIL in T-1 or C-1. Wave-3 OBS-5 / BUILD rule 1 already promoted; no re-observation needed.

---

## OBS-1: A test stub that echoes the value it receives hides serialization-boundary divergence between app and DB wire format

**Title:** Unit tests using a fake/stub repository that echoes stored values verbatim cannot detect serialization divergence between the app layer and the real DB wire format.

**Source:**
- `process/waves/wave-4/stages/B-6-review.md` Phase 2: "CRITICAL created_at serialization mismatch (conf 9): append hashed ISO (T/Z), timestamptz read-back is pg wire format (space/+00/µs) → verifier recompute != stored → chain NEVER verifies live (unit test masked by FakeRepo echo)." The FakeRepo returned `createdAt` exactly as the app stored it (ISO string), so `computeEntryHash` in both append and verify paths saw the same value and the test passed. Against a real Postgres `timestamptz` column, the read-back is in pg wire text format (`YYYY-MM-DD HH:mm:ss.NNNNNN+00`), not ISO; the hash computed at append time diverged from the hash recomputed at verify time, so the chain never actually verified.
- `process/waves/wave-4/stages/T-2-unit.md`: "pg-format-roundtrip regression — proving created_at fix" — this regression test was added AFTER the /review CRITICAL was found, not before. The prior unit run with FakeRepo returned green on all 347 tests while the live chain was broken.
- `process/waves/wave-4/stages/C-2-deploy-and-verify.md` Step 4: "3 real entries appended through the REAL AuditService.appendStandalone() code path … Verifier: ok:true,entriesChecked:3 … proves created_at canonicalization (fix f1ec575) holds against a real pg timestamptz read-back." Only after fix commit `f1ec575` (normalizeCreatedAt in canonicalSerialization) did the live chain verify.
- `process/waves/wave-4/stages/V-1-karen.md` F2: "pg-roundtrip REGRESSION test EXISTS: audit.verifier.spec.ts:131-184 … Feeds toPgWireText() into stored createdAt WITHOUT touching entry_hash, asserts ok:true." This test was not present before /review found the CRITICAL.

**Cross-wave lineage — this is the third firing of the "test didn't exercise the real persistence/serialization boundary" family:**
- Wave-2 OBS-2: `curl`/unit tests miss CORS preflight because they don't go through a real browser's CORS protocol. Real-browser E2E required (promoted to T-5 rule 1).
- Wave-3 OBS-1: Unit tests + head-builder gate pass while RBAC guard has fail-open and stale-privilege paths; adversarial /review found the CRITICALs (FIRST-OBSERVATION at wave-3; VERIFY candidate).
- Wave-4 (this): `FakeRepo` echoes the value verbatim, hiding a pg-wire-format divergence; a live-DB integration test or a pg-wire-format regression test is required.

Wave-2 OBS-2 is already promoted (T-5 rule 1). Wave-3 OBS-1 is a FIRST-OBSERVATION in the VERIFY file. Wave-4's specific failure sub-class is narrower: it is about **stub/fake repositories that echo round-trip values**, masking serialization differences across a real persistence boundary. This is a distinct falsifiable claim from wave-3 OBS-1 (which is about adversarial review catching auth logic bugs) and from wave-2 OBS-2 (which is about CORS preflight). The three firings together are now generalizable enough to propose a VERIFY principle: integrity-critical paths that recompute a value from persisted data must be tested against the real persistence boundary, not a stub that echoes the stored value.

**Severity:** strong

**Candidate principles file:** VERIFY

**Confirmation status:** CONFIRMED-AND-READY (third firing of the real-boundary testing family; the specific stub/fake-repo sub-class has now appeared at wave-4; wave-3 OBS-1 first-observed the adversarial-review surface, and this wave adds the specific fake-repo sub-class with a clear falsifiable safeguard — a pg-wire-format regression test that fails pre-fix and passes post-fix, as documented in T-2 and Karen F2)

**Systemic framing:** The missing automated safeguard is a test that exercises the full serialization round-trip through the real persistence layer: write a value through the app's normal path, read it back using the ORM/driver's actual deserialization, and recompute the derivative (here: `entry_hash`) from the read-back value. A stub or fake that echoes the input skips the DB wire format conversion entirely, making the test meaningless for any property that depends on how the DB serializes and deserializes the stored value. The correct safeguard is not "ban stubs" but "for any path where a correctness property is computed over a persisted value, include at least one test that feeds a real DB wire-format string into the computation and asserts the expected output." The pg-roundtrip regression test added at `audit.verifier.spec.ts:131-184` is the canonical form: it synthesizes a pg-wire-text `created_at` string (the format Postgres actually returns on read) and asserts `ok:true` — a test that would have caught the bug before /review if it had existed.

---

## OBS-2: A BEFORE trigger is the load-bearing DB-layer immutability control; REVOKE is a no-op against the table owner and cannot substitute

**Title:** Append-only tables require a BEFORE UPDATE/DELETE/TRUNCATE trigger, not a REVOKE statement, as the load-bearing immutability control when the app role is the table owner.

**Source:**
- `process/waves/wave-4/stages/C-2-deploy-and-verify.md` Step 4 "Immutability LIVE": "UPDATE audit_log_entries SET content_hash=… WHERE sequence_number=1 → ERROR: audit_log_entries is append-only: UPDATE blocked on row sequence_number=1. … DELETE … → ERROR: … DELETE blocked … TRUNCATE … → ERROR: … TRUNCATE blocked." This is against the app role `postgres` which is the table owner. The REVOKE is explicitly documented as ineffective: "the trigger is the load-bearing control here because the app role owns the table (REVOKE is a no-op vs owner — exactly as the migration's design comments anticipate)."
- `process/waves/wave-4/stages/P-3-plan.md` Architecture delta Δ1: "Alternative B — grant-only (REVOKE UPDATE/DELETE from the app role). Rejected as sole DB control: a grant binds to a specific role. A privileged/superuser connection … bypasses grants entirely — postgres/table-owner is not constrained by its own grants. … BEFORE row triggers execute for the connecting role whatever its privileges."
- `process/waves/wave-4/stages/B-6-review.md` Phase 2: "INFO TRUNCATE gap + no REVOKE PUBLIC + unnecessary SECURITY DEFINER (conf 6) → FIXED (f1ec575): BEFORE TRUNCATE trigger + REVOKE ALL FROM PUBLIC + dropped SECURITY DEFINER (amended 0002, unapplied)." The TRUNCATE guard was found missing by /review — the initial migration only had BEFORE UPDATE/DELETE; the BEFORE TRUNCATE statement trigger was added in fix commit `f1ec575`.
- `process/waves/wave-4/stages/V-1-karen.md` F3: migration `0002_steep_boom_boom.sql` contains both a BEFORE UPDATE OR DELETE row trigger AND a BEFORE TRUNCATE statement trigger; F8: "Trigger is load-bearing: the migration explicitly documents that when app role == table owner, REVOKE is a no-op and Control 2 (the BEFORE UPDATE/DELETE trigger) is the immutability control that blocks even the owner."
- `process/waves/wave-4/blocks/B/gate-verdict.md`: "BEFORE row triggers execute for the connecting role whatever its privileges — Postgres has no 'superuser skips triggers' path; the only escapes (ALTER TABLE … DISABLE TRIGGER, SET session_replication_role = replica) are themselves privileged, non-default, and would be visible/auditable operations."
- `process/waves/wave-4/stages/V-1-jenny.md` Block 1: "The trigger is the load-bearing control since the app role owns the table (REVOKE is a no-op vs owner) — exactly as the migration design anticipates."

**Cross-wave lineage:** FIRST-OBSERVATION. No prior wave introduced a Postgres append-only table or a trigger-enforced immutability pattern.

**Severity:** strong

**Candidate principles file:** BUILD

**Systemic framing:** When a Postgres migration is authored to make a table append-only, the instinctive control is `REVOKE UPDATE, DELETE, TRUNCATE FROM <role>`. This is incomplete when the connecting role is the table owner (e.g., the app connects as `postgres` which created the table): Postgres owners hold implicit full rights and a REVOKE FROM CURRENT_USER is a no-op at the privilege layer. The control that covers every role including the table owner and a DBA/superuser is a `BEFORE UPDATE OR DELETE FOR EACH ROW` trigger plus a `BEFORE TRUNCATE FOR EACH STATEMENT` trigger, each unconditionally raising an exception. Both controls belong in the migration: the REVOKE makes intent auditable and blocks non-owner roles at the privilege layer; the trigger is the load-bearing row-level enforcement. The missing automated safeguard is a live immutability probe in the deploy-verification stage (C-2) that attempts UPDATE, DELETE, and TRUNCATE on the app role and asserts all three are rejected with the trigger's error string — which is exactly what C-2 executed at `cd06e8a`.

---

## OBS-3: The P-4 security-scope tightened gate's multi-iteration jenny review catches plan-level route/design drift before it propagates to B-block; wave-4 confirms wave-3's first observation

**Title:** The P-4 tightened gate's mandatory re-review loop is load-bearing: a single jenny pass would have shipped a plan targeting the wrong route and design file into B-block.

**Source:**
- `process/waves/wave-4/blocks/P/gate-verdict.md` Phase 2: "jenny iter-1 BLOCK — finding 4b HIGH: integrity-view screen pinned to /compliance/settings + compliance-settings.html = the DEFERRED Rules Engine with zero integrity UI; belongs on /compliance/audit-log + audit-log-export.html §Integrity Validation per journey row 16." This is a doc-level defect: the plan's B-3 steps (`page.tsx` path, `next.config.ts` rewrite, nav item anchor) all targeted the wrong route and wrong design file.
- `process/waves/wave-4/blocks/P/gate-verdict.md` Phase 2 continued: "jenny iter-2: BLOCK — plan body still contradicted the remediation footer (body steps un-edited). Remediation: plan body build-instruction sites edited. jenny iter-3: APPROVE — 4b RESOLVED (all body sites target /compliance/audit-log + audit-log-export.html)." Three iterations were required.
- `process/waves/wave-4/stages/P-3-plan.md` P-4 remediation section: documents the retargeting of Δ4 from /compliance/settings to /compliance/audit-log and from compliance-settings.html to audit-log-export.html §Integrity Validation.
- `process/waves/wave-4/stages/V-1-jenny.md` Block 4: "Renders the integrity view (LIVE, compliance session, server-rendered): page shows 'Audit Log Integrity' heading … 'Verify now' button … per design/audit-log-export.html §Integrity Validation." The correct route and design file are live.
- Wave-3 OBS-3 (`process/waves/_archive/wave-3/blocks/L/observations.md`): "jenny iter-1 BLOCK — 2 findings: (HIGH) `/` route drift (journey-map row 4 `/`=authed Dashboard vs plan `/dashboard`+public `/`); (MEDIUM) role→route/nav matrix unspecified." Fixed at P-4 doc-level before B-block. Wave-3 OBS-3 was FIRST-OBSERVATION with candidate file `none` (validates a brain gate procedure; no new principle to author).

**Cross-wave lineage:** CONFIRMS-PRIOR wave-3 OBS-3. The specific defect class is identical: the plan pinned a screen to the wrong route or design file relative to what the journey map and design artifacts specified, and jenny's iteration-1 BLOCK found the drift at the lowest-cost fix point (P-4 doc level, before B-block executed the wrong instructions). Wave-3 found a route-name drift (`/dashboard` vs `/`); wave-4 found a route-and-design-file drift (`/compliance/settings` vs `/compliance/audit-log`, compliance-settings.html vs audit-log-export.html). The mechanism is the same; the pattern has now fired on two consecutive waves with real B-block prevention.

**Severity:** warning

**Candidate principles file:** none (the multi-iteration re-review loop is specified by the P-4 gate procedure in the brain block files; the observation validates the gate earns its cost on auth/security-scope waves but does not identify a new principle to encode outside the gate spec)

**Confirmation status:** CONFIRMS-PRIOR wave-3 OBS-3 (CONFIRMED-AND-READY — two consecutive waves with an identical jenny-iter-1 BLOCK preventing a wrong-route or wrong-design-file propagation to B-block)

**Systemic framing:** The P-4 tightened gate requires jenny to review the plan against the canonical journey map and design artifacts, issue findings, receive a remediation, and re-review. Without the second review pass, a plan body that has been partially corrected in a footer addendum but not in its build-instruction sections would be handed to B-block specialists with contradictory instructions. In wave-4, the first-pass remediation correctly documented the retargeting but left the plan body build steps (Δ4, B-1 1.2, B-3 3.1/3.2) still pointing at the wrong path; jenny iter-2 caught this and blocked again. The three-iteration cycle (iter-1 finds drift, iter-2 finds incomplete remediation, iter-3 approves) is the mechanism operating as designed. The missing automated safeguard at the plan-authoring level is a consistent practice of updating all build-instruction sites atomically with the remediation footer; the gate's iteration loop is the fallback when that discipline slips.

---

## OBS-4: A cross-origin fetch for a route that requires a first-party session cookie silently 401s; same-origin proxy is the correct fix

**Title:** Any client-side fetch to an API route that requires a session cookie must use a same-origin proxy path; cross-origin fetches silently 401 because httpOnly cookies are not sent.

**Source:**
- `process/waves/wave-4/stages/B-6-review.md` Phase 2: "INFO verify-now cross-origin fetch broken (conf 8) → FIXED (19a298b): /compliance/audit-log/verify same-origin proxy (afterFiles rewrite, page not hijacked) + IntegrityPanel relative fetch." The IntegrityPanel originally called `fetch('https://dealflow-api-production.../compliance/audit-log/verify')` — a cross-origin URL. The browser's session cookie is `httpOnly` and scoped to the web origin; it cannot be sent cross-origin in a `fetch` without explicit `credentials: 'include'` AND CORS `Access-Control-Allow-Origin` + `Access-Control-Allow-Credentials` on the API response. Neither was configured for this route.
- `process/waves/wave-4/stages/T-5-e2e.md` S3 "verify-now works — same-origin proxy confirms B-6 fix": "The pre-fix IntegrityPanel called fetch('https://dealflow-api-production-66d4.up.railway.app/compliance/audit-log/verify') — a cross-origin fetch. The browser's session cookie is httpOnly on the web origin; it cannot be sent cross-origin. The API returned 401 (no cookie) → res.ok false → setResult(null) → UnavailableState rendered." Confirmed in real browser after fix: the proxy path returns 200 with `ok:true,entriesChecked:3`.
- `process/waves/wave-4/stages/V-1-karen.md` F6: "next.config.ts: rewrites().afterFiles[] contains {source:'/compliance/audit-log/verify', destination:'${apiProxyTarget}/compliance/audit-log/verify'}. IntegrityPanel.tsx:436 fetches the SAME-ORIGIN RELATIVE path fetch('/compliance/audit-log/verify', { cache:'no-store' }) — NOT cross-origin NEXT_PUBLIC_API_URL. Comment (lines 4-9, 432-435) documents the first-party-cookie rationale. LIVE PROOF: signed in via WEB origin → same-origin GET … → 200 ok:true,entriesChecked:3."
- Wave-2 B-6 / C-2 pattern: wave-2 introduced `NEXT_PUBLIC_API_URL` as the env var for client-side API calls, and the fix for wave-2 FINDING-2 (session not persisting cross-origin) involved switching SuperTokens' token transfer method from headers to cookies — a related but distinct cross-origin session mechanism. The compliance UI fetching `NEXT_PUBLIC_API_URL` directly is the natural consequence of following that wave-2 pattern without accounting for the httpOnly cookie constraint.

**Cross-wave lineage:** CONFIRMS-PRIOR wave-2 OBS-2 (cross-origin session/cookie defects — the broader family). Wave-2 OBS-2 fired on the CORS preflight + session transfer method class; wave-4 fires on the "client-side fetch of a first-party-cookie-guarded route using the cross-origin API URL" class. Both stem from the same root constraint: httpOnly cookies are origin-bound, and a cross-origin fetch that bypasses this is silently rejected. The wave-2 fix established the cookie-based session model; wave-4 shows that any new client-side data-fetch against a guarded route inherits the same constraint and needs a same-origin proxy or `credentials: 'include'` + CORS headers. Wave-2 OBS-2 is already promoted to T-5 rule 1 (real-browser E2E on auth/session/CORS waves). This wave-4 instance is the first time the cross-origin fetch failure appears as a *build-time design decision* (not only a test-layer catch): the IntegrityPanel's fetch URL was cross-origin by default because the developer used the `NEXT_PUBLIC_API_URL` pattern established in wave-2 for server-side fetches, which works with cookie forwarding in SSR but fails in client-side fetches.

**Severity:** warning

**Candidate principles file:** BUILD

**Confirmation status:** CONFIRMS-PRIOR wave-2 OBS-2 (cross-origin cookie/session class; this instance targets the build-time pattern — use a same-origin proxy path for client-side fetches to guarded routes, not the cross-origin API URL)

**Systemic framing:** The missing plan-authoring constraint is: when a client-side component (browser JavaScript, not SSR) fetches an endpoint that requires a session cookie, it must call a same-origin path proxied by the Next.js server (via `rewrites` or a Route Handler), not the raw `NEXT_PUBLIC_API_URL`. The cross-origin URL pattern is correct for server-side data fetches in RSC/`getServerSideProps` contexts (where the cookie is forwarded by the server), but it silently fails in client-side `fetch` calls because the browser does not send httpOnly cookies to a different origin by default. The correct automated safeguard at the build stage is a review checklist item for any new client-side `fetch`: if the target endpoint requires auth, assert that the URL is relative (same-origin) or that `credentials: 'include'` is set with verified CORS `allowedOrigins`. The /review found this as a high-confidence INFO finding; T-5 E2E confirmed it in a real browser.

---

## OBS-5: Adversarial /review on integrity-critical auth surfaces is a mandatory second gate; the first-pass head-builder gate approved code with two CRITICALs

**Title:** Run adversarial /review on every wave building an integrity-critical or auth-adjacent surface; the head-builder gate approves structural correctness while /review catches cryptographic and serialization CRITICALs.

**Source:**
- `process/waves/wave-4/stages/B-6-review.md` Phase 1: "head-builder: APPROVED." Phase 2 /review then found: "CRITICAL created_at serialization mismatch (conf 9) … chain NEVER verifies live … CRITICAL append-return self-inconsistency (conf 7)." Both were fixed before merge (fix commits `f1ec575`, `19a298b`). If Phase 2 /review had not run, both CRITICALs would have been carried through T-block with the FakeRepo test masking the live verification failure.
- `process/waves/wave-4/blocks/B/gate-verdict.md` head-builder rationale: The head-builder verified structural correctness — canonical serialization, key handling, write-atomicity, RBAC, threat-boundary honesty, test discipline. It did not run a live DB round-trip; the FakeRepo-based unit tests were accepted as evidence of chain correctness. The serialization divergence was only discoverable by running the real code against a real Postgres instance.
- Wave-3 OBS-1 (`process/waves/_archive/wave-3/blocks/L/observations.md`): "Run an adversarial diff review on every RBAC/auth-boundary diff; unit tests pass while the guard logic has silent fail-open or stale-privilege paths." FIRST-OBSERVATION, candidate file VERIFY.
- Wave-3 B-6 Phase 1 (per wave-3 OBS-1): "head-builder Phase 1 APPROVED the diff BEFORE /review (critical bugs were present, gate missed them); /review in Phase 2 found both."

**Cross-wave lineage:** CONFIRMS-PRIOR wave-3 OBS-1. The pattern is now: Phase-1 head-builder gate approves; Phase-2 adversarial /review finds CRITICALs that the gate missed. Wave-3: CRITICALs were RBAC logic errors (fail-open, stale-privilege). Wave-4: CRITICALs were cryptographic serialization errors (created_at hash divergence, self-inconsistent append). Different failure domains, same structural gap: the standard build-gate reviewer assesses structural correctness and test discipline but does not execute adversarial probes against the specific security invariants of the surface under review.

**Severity:** strong

**Candidate principles file:** VERIFY

**Confirmation status:** CONFIRMED-AND-READY (CONFIRMS-PRIOR wave-3 OBS-1 — two consecutive waves where Phase-1 gate APPROVED and Phase-2 /review found CRITICALs on auth/integrity-critical surfaces; both CRITICALs blocked from shipping by the /review step)

**Systemic framing:** The head-builder gate reviews the diff for correctness, test coverage, and adherence to the plan. It does not adversarially probe security invariants — it accepts test results as evidence. On auth and integrity-critical surfaces, the test evidence may itself be contaminated (wave-3: mocked guard hid logic errors; wave-4: FakeRepo hid serialization errors). The missing mandatory safeguard is a Phase-2 adversarial review step scoped to the security invariants of the specific surface: for RBAC surfaces, /review checks fail-open and privilege-escalation paths; for cryptographic-integrity surfaces, /review checks the hash-compute path through the real persistence boundary. Without this step, the CRITICALs propagate through T-block (where FakeRepo-masked tests run green), through V-block (where Karen/jenny verify claims, not re-run attacks), and ship to production. The adversarial /review is the only step in the loop that probes the specific invariant rather than accepting test evidence as proof.

---

## Promotion-eligibility summary

### CONFIRMED-AND-READY / CONFIRMS-PRIOR (promotion-eligible)

| Obs | Title (abbreviated) | Confirms | Candidate file | Severity | Promotion note |
|---|---|---|---|---|---|
| OBS-1 | Stub/FakeRepo masks serialization divergence from real DB wire format | wave-3 OBS-1 + wave-2 OBS-2 family (third firing) | VERIFY | strong | First to name the fake-repo sub-class; proposed principle: test integrity-critical recomputation paths against real DB wire format, not a stub. |
| OBS-3 | P-4 multi-iteration jenny gate catches route/design drift before B-block | wave-3 OBS-3 | none | warning | Gate validation; no new principle needed (brain gate spec already encodes this). CONFIRMED-AND-READY as evidence the gate cost is justified; head-learn may treat as corroboration rather than promotion candidate. |
| OBS-4 | Client-side fetch to guarded route must use same-origin proxy, not cross-origin API URL | wave-2 OBS-2 (cookie/session class) | BUILD | warning | Build-time constraint; distinct from T-5 rule 1 (which covers the test-layer catch). Proposed rule: client-side fetches to session-cookie-guarded endpoints must use a same-origin proxy path. |
| OBS-5 | Adversarial /review on integrity-critical surfaces catches CRITICALs the head-builder gate misses | wave-3 OBS-1 | VERIFY | strong | Two-wave confirmation. Proposed VERIFY rule: run adversarial /review on every wave touching auth, RBAC, or cryptographic integrity. |

### FIRST-OBSERVATION (deferred — awaiting a second wave to confirm)

| Obs | Title (abbreviated) | Candidate file | Severity |
|---|---|---|---|
| OBS-2 | BEFORE trigger is load-bearing DB-layer immutability control; REVOKE is no-op against table owner | BUILD | strong |

---

## Head-learn L-2 promotion disposition (synthesizer recommendation only; head-learn makes the final call after karen)

**Priority ranking for promotion this wave:**

**First priority — OBS-5 → VERIFY-PRINCIPLES (rule 1, strong, CONFIRMED-AND-READY).**
Two consecutive waves where Phase-1 gate APPROVED and Phase-2 adversarial /review found CRITICALs. VERIFY-PRINCIPLES has no rules yet (empty); this is the highest-severity confirmed candidate with an empty target file. Proposed 2-line form (pre-draft for karen):
```
1. Run adversarial /review on every B-block diff that touches auth guards, RBAC logic, or cryptographic integrity.
   Why: Head-builder gate reviews structure; only adversarial probing catches fail-open and hash-path CRITICALs.
```
(Rule line 90 chars; Why line 83 chars; no forbidden tokens.)

**Second priority — OBS-1 → VERIFY-PRINCIPLES (rule 2, strong, CONFIRMED-AND-READY).**
If head-learn promotes OBS-5 as rule 1, OBS-1 is eligible as rule 2 in the same wave (the per-file cap is 1 rule per wave per file, so head-learn must choose one). If both are strong and both target VERIFY, head-learn picks one. OBS-5 (adversarial review) is the broader process safeguard; OBS-1 (real persistence boundary) is the specific technical constraint. Recommendation: OBS-5 first (process gate — catches a wider class of failures); OBS-1 second (technical constraint — specific but also strong). If only one can promote this wave, OBS-5. Proposed 2-line form for OBS-1 (pre-draft for karen):
```
1/2. Test any path that recomputes a value from persisted data against the real DB wire format, not a stub that echoes the stored value.
     Why: A stub that echoes the input cannot detect serialization divergence between app format and DB wire format.
```
(Rule line 110 chars; Why line 89 chars; no forbidden tokens. Numbering TBD based on whether OBS-5 promotes first.)

**Third priority — OBS-4 → BUILD-PRINCIPLES (rule 2, warning, CONFIRMS-PRIOR).**
Wave-3 OBS-4 (NestJS DI export) is CONFIRMED-AND-READY for BUILD but did not fire this wave. OBS-4 (same-origin proxy) is newly confirmed and targets a different BUILD constraint. BUILD-PRINCIPLES already has rule 1 (pnpm-workspace.yaml). OBS-4 is a legitimate rule-2 candidate. Proposed 2-line form (pre-draft for karen):
```
2. Use a same-origin proxy path for any client-side fetch to a session-cookie-guarded endpoint, not the cross-origin API URL.
   Why: Browsers do not send httpOnly cookies cross-origin; the fetch silently 401s without a proxy.
```
(Rule line 104 chars; Why line 77 chars; no forbidden tokens.)

**OBS-2 (BEFORE trigger immutability) — deferred (FIRST-OBSERVATION).** Strong BUILD candidate but first firing. Retain for the next wave that introduces Postgres-level immutability or DB security controls.

**OBS-3 (P-4 gate validation) — no promotion.** Confirms the gate procedure earns its cost; no new principle to author outside the brain gate spec. Head-learn may note it as corroboration in internal records.

**Wave-3 OBS-4 (NestJS DI export) — still CONFIRMED-AND-READY; did not fire this wave.** Recommend promoting at the next BUILD wave where NestJS DI wiring is touched, to clear the queue.
