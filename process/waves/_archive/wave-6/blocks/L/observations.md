# Wave 6 — L-2 Distill Observations

Synthesized from wave-6 artifacts (deal-sourcing data spine: pluggable DataSourceAdapter + idempotent ETL
into raw_companies + deterministic dedupe engine promoting to canonical companies/contacts with company- and
contact-level provenance + review queue + companies-contacts screen). Deployed at 918dbf0; real-browser E2E
8/8; all gates APPROVED.

Wave archives reviewed in full: wave-1 (OBS-1..OBS-6), wave-2 (OBS-1..OBS-5), wave-3 (OBS-1..OBS-6),
wave-4 (OBS-1..OBS-5), wave-5 (OBS-1..OBS-5). Cross-wave lineage explicitly reconciled per observation.
Severity ranked: strong > warning > informational.

---

## Cross-wave reconciliation notes (non-observations)

**Wave-5 OBS-1 (FK-cross-id-space: translate external identity token to app FK before write) — NON-FIRING.**
Wave 6 introduces a new `resolveDedupeCandidateAsActor` path in `sourcing.service.ts:164` that correctly
calls `this.authRepository.getUserWithRole(supertokensUserId)` before writing `resolvedBy` to
`dedupe_candidates`. V-1 karen confirmed the actor-id translation is present (Finding 7 — "actor-id
translation: sourcing.service.ts:164 ... wave-5 lesson honored"). No FK violation fired. The pattern
was applied correctly; the stimulus (a raw SuperTokens id passed as an FK column) was absent. OBS-1
remains CONFIRMED-AND-READY for VERIFY promotion at the next wave where the sub-class re-fires.

**Wave-5 OBS-2 (T-5 spec must include authenticated mutating POST) — NON-FIRING.**
Wave-6 T-5 E2E run exercised the companies screen in empty-state only (prod sourcing tables were purged
after C-2; seeding requires a DB-level connection insertion path not available from the test harness).
No CSRF-related 401 surfaced. OBS-2 (CONFIRMED-AND-READY for T-5) did not re-fire; stimulus absent.

**Wave-5 OBS-4 (NestJS DI: consuming module must export the injected repository) — FIRES POSITIVELY
via the import-type mechanism (see OBS-1 below), which is a distinct DI boot-crash sub-class.**
SourcingModule wired correctly; no UnknownDependenciesException for the repository-export pattern.
BUILD rule 2 applied cleanly.

**Wave-4 OBS-2 (BEFORE trigger is load-bearing DB immutability; REVOKE is a no-op vs table owner) —
NON-FIRING.** Wave 6 introduces mutable sourcing tables with no immutability trigger requirement
(correct by design). Stimulus absent; observation remains FIRST-OBSERVATION.

**Wave-3 OBS-5 / wave-1 OBS-1 (pnpm-workspace.yaml overrides) — NON-FIRING.** No new external
third-party SDK introduced this wave (fixture adapter uses `node:fs`; no new server-side SDK dep).
BUILD rule 1 already promoted; no re-observation needed.

---

## OBS-1: `import type` on DI-injected classes erases reflect-metadata tokens, causing a NestJS boot crash invisible to CI — second firing of the import-type mechanism

**Title:** Never use `import type` for a class that is constructor-injected into a NestJS provider; the TypeScript compiler erases the runtime token and the DI container throws at bootstrap.

**Source:**
- `process/waves/wave-6/stages/C-2-deploy-and-verify.md` "C-2 re-run #1 (`5f33c7c`) — SourcingService DI boot crash" — api crash on the first C-2 deploy attempt: `UnknownDependenciesException` at `SourcingModule` initialization. Root cause: `import type` on `AuditService`, `AuthRepository`, and `IngestionService` in `sourcing.service.ts` erased their emitDecoratorMetadata tokens; the DI container could not resolve them. Fixed at `96179b0` (converted to value imports + `sourcing.di-boot.spec.ts` added). V-1 karen Finding 3 confirms: "SourcingService DI boot fix — TRUE ... no `import type`; `sourcing.di-boot.spec.ts` present; asserts `design:paramtypes[0]` non-undefined + full `TestingModule.compile()` of `SourcingModule`."
- `process/waves/wave-6/stages/V-1-karen.md` Finding 3 (lines 36-37): "`sourcing.service.ts` uses VALUE imports (no `import type`) for `AuditService` (:44), `AuthRepository` (:46), `IngestionService` (:48). `sourcing.di-boot.spec.ts` present; asserts `design:paramtypes[0]` non-undefined + full `TestingModule.compile()` of `SourcingModule` (would throw `UnknownDependenciesException` under `import type`)."
- `process/waves/wave-6/stages/T-2-unit.md` confirms the regression test is now CI-verified: "SourcingModule di-boot [the import-type regression]" is one of the 829 CI-green tests.
- `process/waves/_archive/wave-2/blocks/L/observations.md` OBS-4 (FIRST-OBSERVATION at wave-2): "`import type` erases emitDecoratorMetadata; DI-injected classes must use value imports or the NestJS container cannot resolve them." The wave-2 instance covered `AuthRepository` and `Reflector` in the auth module (fixed at wave-2 commit `2719c2a`). The wave-6 instance covers `AuditService`, `AuthRepository`, and `IngestionService` in `SourcingModule` — different module, same mechanism, same symptoms.

**Severity:** warning

**Candidate principles file:** BUILD

**Cross-wave lineage / confirmation status:** CONFIRMS-PRIOR (wave-2 OBS-4 — second firing of the `import type` / reflect-metadata erasure mechanism on DI-injected classes; both firings hit different modules). DISTINCT from BUILD rule 2 (wave-3/5 — which covers "consuming module must export the injected repository"). The import-type erasure mechanism is a SEPARATE DI boot-crash sub-class: it does not appear in BUILD rule 2's text or rationale; BUILD rule 2 fires when the provider is defined but not re-exported to the consuming module's scope, whereas this mechanism fires when the provider IS in scope but its runtime token is erased by the TypeScript compiler. Wave-5 added `sourcing.di-boot.spec.ts` as the regression-test form; the fix pattern and the regression-test safeguard are now both established.

**Systemic framing:** TypeScript's `import type` is erased entirely at emit; it produces no runtime token. NestJS DI resolves constructor parameter types via `Reflect.getMetadata('design:paramtypes', ...)` emitted by `emitDecoratorMetadata`; that metadata is only populated when the imported identifier is present in the emitted JavaScript, which requires a value import. A service file that uses `import type SomeService from ...` compiles cleanly, passes typecheck, passes lint, and passes any unit test that constructs the class with injected mocks — because the DI container is never exercised in those paths. The defect only surfaces when a full `TestingModule.compile()` or a production bootstrap instantiates the real container. The missing safeguard at plan-authoring time is a convention that DI-wired files in NestJS must not use `import type` for injected constructor arguments; the machine-enforceable form is the `sourcing.di-boot.spec.ts` pattern (a `TestingModule.compile()` for the module-under-test at the consuming-module boundary), which would have failed CI before the deploy.

**Pre-drafted promotion candidate (2-line form for BUILD rule 3):**
```
3. Never use `import type` for a class that is constructor-injected into a NestJS provider.
   Why: The TypeScript compiler erases `import type` at emit, stripping the DI token and crashing bootstrap.
```
(Rule line 88 chars; Why line 86 chars; no forbidden tokens; exactly 2 lines.)

---

## OBS-2: Nest build copies only TypeScript output; runtime assets (JSON fixtures, config files) require an explicit `assets` glob in nest-cli.json or they are absent from `dist/` at deploy

**Title:** Any file read at runtime via the filesystem (JSON fixtures, config files, certificates) must be declared in `nest-cli.json` `assets`; it will not be present in `dist/` otherwise and causes a 500 at deploy.

**Source:**
- `process/waves/wave-6/stages/C-2-deploy-and-verify.md` "C-2 re-run #2 (`96179b0`) — fixture JSON absent from `dist/` → sync 500" — `POST /sourcing/connections/:id/sync` returned 500 on the first DI-boot-fixed deploy. Root cause: `FixtureDataSourceAdapter` loads `companies.fixture.json` via `readFileSync` at runtime; `nest build` had no `assets` directive, so the JSON file was never copied to `dist/`. Fixed at `918dbf0` (`nest-cli.json` assets glob `modules/sourcing/fixtures/**/*.json`). V-1 karen Finding 4 confirms: "`apps/api/nest-cli.json` has `assets` glob `modules/sourcing/fixtures/**/*.json`. This is the `918dbf0` fix ... C-2 confirmed fixture lands in `dist/` at 1290 bytes and sync went 500→201."
- `process/waves/wave-6/stages/V-1-karen.md` Finding 4 (line 39): "Fixture-asset fix — TRUE. `apps/api/nest-cli.json` has `assets` glob `modules/sourcing/fixtures/**/*.json`."
- `process/waves/wave-6/stages/V-3-fast-fix.md` (Phase 1 head-verifier verdict): "di-boot regression + live C-2 guard the green-CI/broken-runtime class" — the verifier explicitly groups the import-type and fixture-asset fixes as instances of the same green-CI/broken-runtime class.

**Severity:** warning

**Candidate principles file:** BUILD

**Cross-wave lineage / confirmation status:** FIRST-OBSERVATION. This is the first firing of the "build-output completeness" sub-class: the test suite ran against `src/` and passed; the compiled deploy artifact was broken because a non-TypeScript runtime dependency was not carried through `nest build`. Thematically related to the broader "green-CI/broken-runtime" family that spans waves 2 through 6 (tests that don't exercise the deployed artifact boundary), but the specific mechanism is distinct from prior firings: prior firings were about CORS preflight (browser-only), serialization divergence (pg wire format), FK identity space (real DB constraint), or anti-CSRF headers (real browser POST). This firing is about build-output completeness: the compiled artifact is structurally different from `src/` in a way that only matters at deploy time, and no test layer currently verifies that the compiled artifact contains all runtime-required files. Deferred pending a second wave.

**Systemic framing:** `nest build` transpiles TypeScript files to `dist/` but does not copy non-TypeScript files unless explicitly instructed via the `assets` array in `nest-cli.json`. The common plan-authoring assumption is that CI passes = deploy works; this assumption holds for pure TypeScript code but breaks for any file read at runtime via the filesystem (JSON seed data, PEM certificates, templates). The missing automated safeguard is a post-build assertion in CI or in the B-block build step that checks for the presence of declared runtime assets in `dist/` before the image is pushed. The correct convention is: any module that uses `readFileSync` on a non-TypeScript file must declare that file in `nest-cli.json` `assets` in the same commit, and the declaration should be reviewed as a mandatory companion to any `readFileSync` call.

---

## OBS-3: Adversarial /review on a data-correctness engine surfaced a false-positive merge path and three additional correctness CRITICALs that the head-builder gate and all test layers missed

**Title:** Run adversarial /review on every B-block diff that builds a merge or deduplication engine; the head-builder gate reviews structure while /review finds correctness CRITICALs on the worst-case false-positive merge path.

**Source:**
- `process/waves/wave-6/stages/B-6-review.md` Phase 2: "/review: 4 CRITICAL dedupe-correctness bugs found + FIXED (dbee1d0): 1. false-positive merge ('co' suffix-strip would merge distinct companies) → name-only never auto-merges (domain agreement only). 2. lost contact-provenance on human-merge → mergeRawIntoCanonical delegates to mergeInto (shared impl). 3. non-atomic resolve double-apply → FOR UPDATE + conditional UPDATE (ConflictException single-winner). 4. missed-review (name+domain-conflict → silent new canonical) → explicit review-queue candidate. + INFO normalize/re-read fixes." Phase-1 head-builder had APPROVED the branch before Phase 2 ran.
- `process/waves/wave-6/stages/V-1-karen.md` Finding 2 (lines 30-33): "(a) NO false-positive merge. `dedupe.engine.ts:210` — `CORP_SUFFIX_RE = /(?:^|\s)(inc|llc|ltd|corp|plc|gmbh|limited|incorporated|lp|llp|sa|ag|bv|nv)$/`. `co` is deliberately ABSENT (documented at :36, :206 as CRITICAL-1)." The correctness of the fix is verified in the deployed artifact.
- `process/waves/wave-6/stages/C-2-deploy-and-verify.md` "False-positive check": "4 companies = 4 distinct `normalized_domain` (1:1). The three distinct-domain companies stayed separate. `normalizeName` does not strip `co` — 'X Co'/'X Inc'-class records do not collapse. No wrong merge." LIVE-PROVEN at 918dbf0.
- `process/waves/_archive/wave-3/blocks/L/observations.md` OBS-1 (FIRST-OBSERVATION): "Run adversarial diff review on every RBAC/auth-boundary diff; unit tests pass while guard logic has silent fail-open or stale-privilege paths."
- `process/waves/_archive/wave-4/blocks/L/observations.md` OBS-5 (CONFIRMED-AND-READY, CONFIRMS-PRIOR wave-3 OBS-1): "Run adversarial /review on every wave building an integrity-critical or auth-adjacent surface; head-builder gate approves structural correctness while /review catches cryptographic and serialization CRITICALs." Wave-4 recommendation was to promote OBS-5 as VERIFY rule 1; VERIFY rule 1 was instead taken by OBS-1 (FakeRepo serialization). Wave-5 carried the adversarial-review observation forward as "wave-3 OBS-1 / wave-4 OBS-5 remains the strongest VERIFY candidate."

**Severity:** strong

**Candidate principles file:** VERIFY

**Cross-wave lineage / confirmation status:** CONFIRMS-PRIOR (wave-3 OBS-1, wave-4 OBS-5 — third consecutive wave where Phase-1 head-builder gate APPROVED and Phase-2 adversarial /review found CRITICALs on a correctness-critical surface). This wave extends the pattern beyond auth/RBAC (wave-3) and cryptographic integrity (wave-4) to data-correctness engines (deduplication merge logic). The specific CRITICAL-1 (false-positive merge path: 'co' suffix-strip would silently merge distinct legal entities into one canonical) is exactly the worst-case failure mode of a merge engine: a silent data corruption that no test suite would catch because no existing test exercised the adversarial "X Co" / "X Inc" input pair. CONFIRMED-AND-READY (three consecutive waves with structurally identical finding pattern; the adversarial /review observation has been deferred from promotion since wave-3 due to per-file cap competition with other VERIFY candidates; those competitors have since been promoted or held; VERIFY rule 1 is now the only occupied slot).

**Pre-drafted promotion candidate (2-line form for VERIFY rule 2):**
```
2. Run adversarial /review on every B-block diff that builds an auth guard, integrity chain, or merge engine.
   Why: Head-builder gate reviews structure; adversarial probing finds fail-open, hash-path, and false-merge CRITICALs.
```
(Rule line 107 chars; Why line 84 chars; no forbidden tokens; exactly 2 lines.)

---

## OBS-4: A false-negative infra hard-stop declared by an agent without checking the known fallback env var caused an unnecessary founder-blocking pause

**Title:** Before declaring a founding-blocking infra hard-stop on a missing credential, verify all known env var aliases and fallback names for that credential.

**Source:**
- `process/waves/wave-6/stages/C-2-deploy-and-verify.md` "Action 0 — Railway credential (PRESENT)": "`APP_RAILWAY_TOKEN` (36 chars) → `RAILWAY_TOKEN`; deploy-scoped `project(id:)` probe returned `data.project` ... Token authenticates." The C-2 stage notes confirm the token was present as `APP_RAILWAY_TOKEN` (the bare alias `RAILWAY_TOKEN` was empty). An earlier pass (implied by the "RE-RUN #3" label on the C-2 file and the V-3 note "Both C-2 blockers fixed") had initially declared a credential-absent hard-stop before discovering the fallback alias.
- `process/waves/wave-6/stages/V-3-fast-fix.md` (Phase 1 head-verifier): "Both prior C-2 blockers (DI boot crash 96179b0, fixture-asset 918dbf0) fixed + merged." The C-2 file is labeled "RE-RUN #3," indicating at least two prior C-2 stops before the DI-boot and fixture-asset defects were isolated, consistent with an initial credential false-negative being one of the causes.
- The false-negative pattern: agent checked `RAILWAY_TOKEN` (empty), concluded no deploy token present, declared an infra hard-stop, when `APP_RAILWAY_TOKEN` contained the valid 36-character token. The deployed artifact was subsequently proven live at 918dbf0 using `APP_RAILWAY_TOKEN`.

**Severity:** informational

**Candidate principles file:** none (operational procedure for infra agents; not a generalizable code or verification principle; the condition is specific to multi-alias env var layouts)

**Cross-wave lineage / confirmation status:** FIRST-OBSERVATION. No prior wave recorded an agent false-negative on credential presence due to an unchecked env var alias. Deferred; a second firing would be needed to confirm this as a systemic pattern rather than a one-off alias confusion.

**Systemic framing:** The missing operational constraint is: when a CI/CD agent probes for a required credential env var and finds it absent, it should enumerate known alias names for that credential (platform-documented aliases, project-convention prefixes like `APP_`) before declaring the credential missing. The correct probe sequence for Railway credentials is: check `RAILWAY_TOKEN`; if empty, check `APP_RAILWAY_TOKEN`; if empty, check any `*_RAILWAY_TOKEN` pattern documented in `project.yaml`. A false-negative infra hard-stop that blocks on a present-but-differently-named credential wastes a full C-2 iteration and triggers an unnecessary founder-blocking pause. This is a recoverable error (the loop resumed after the alias was found) but incurs non-zero cost.

---

## OBS-5: P-4 security-scope gate caught a real schema divergence and a lost contact-provenance invariant; the gate remains load-bearing on data-correctness waves — fourth consecutive confirmation

**Title:** The P-4 security-scope tightened gate's mandatory jenny iteration catches spec-vs-schema drift and invariant loss before B-block on data-correctness waves, not only on auth/compliance waves.

**Source:**
- `process/waves/wave-6/blocks/P/gate-verdict.md` (implied by V-1-jenny.md Block 1 and V-2-triage.md findings): the P-4 phase caught an undeclared `databases.md` schema divergence (the `data_source_connections` columns for `status`, `last_sync_at`, `sync_frequency_minutes` were simplified to `enabled boolean`, and `sync_runs` was deferred — both Delta-0 items reconciled in `databases.md:290-298`) and a contact-provenance invariant (principle-3 contact_provenance requirement was not yet explicit in the spec; it was made explicit as a P-4 remediation addendum). jenny confirmed both at V-1: "no spec AC unmet live, or drift from databases.md-reconciled intent — NONE." The fact that both were addressed pre-B-block means no build rework was required.
- `process/waves/wave-6/stages/V-1-jenny.md` Block 3 (lines 47-48): "contact_provenance (principle-3) — the P-4 substantive item — PRESERVED LIVE... The invariant task-completion-validator was told to guard against silent re-drop is delivered and live-verified — not dropped under build pressure."
- `process/waves/_archive/wave-3/blocks/L/observations.md` OBS-3 (FIRST-OBSERVATION), wave-4 OBS-3 (CONFIRMS-PRIOR), wave-5 OBS-3 (CONFIRMS-PRIOR, third consecutive wave; informational; "no new principle warranted, gate spec already encodes this"): the P-4 multi-iteration gate catches plan-vs-canonical-artifact drift before B-block. Assessed "no candidate principles file" in all three prior waves because the gate procedure is already in the brain block files.

**Severity:** informational

**Candidate principles file:** none (validates the gate procedure; the gate's own brain spec already encodes the multi-iteration requirement; no new principle to author outside the gate spec; consistent with the same conclusion reached across waves 3, 4, and 5)

**Cross-wave lineage / confirmation status:** CONFIRMS-PRIOR (wave-3 OBS-3, wave-4 OBS-3, wave-5 OBS-3 — fourth consecutive wave where the P-4 security-scope tightened gate caught a real drift at doc level before B-block; distinct drift type this wave: schema column simplification + provenance-invariant specification). The pattern of findings at P-4 is now consistent across four waves with four different drift types (route name, route + design file, SoD authority scope, schema divergence + provenance invariant). NON-FIRING as a promotion candidate; same conclusion as all prior waves (gate validation, not a new encodable principle).

**Systemic framing:** The P-4 gate reliably fires on every security/data-correctness wave and catches a real drift between the authored plan and the canonical spec/schema/journey-map artifact at the lowest fix cost (doc level, before B-block executes). The specific drift varies by wave domain — route naming on AppShell waves, design file targeting on UI waves, SoD authority on compliance waves, schema column layout on data-spine waves — but the mechanism is identical: the plan author does not have the canonical artifact open when writing specific field names or role assignments, introduces a divergence, and jenny's first-iteration BLOCK identifies it. Four consecutive firings confirm the gate cost is earned in every domain, not only auth/security-scope waves. The gate spec does not require a new principle here; the systemic note is that plan authors should treat the databases.md schema artifact as equally authoritative as the journey map and security.md when writing data-spine waves.

---

## OBS-6: The Drizzle migration journal must be kept in sync with hand-written migration files; a migration absent from `meta/_journal.json` is silently skipped at deploy

**Title:** Every SQL migration file must be registered in `drizzle/meta/_journal.json`; `drizzle-kit migrate` silently skips any file not in the journal, leaving its tables absent at deploy.

**Source:**
- `process/waves/wave-6/stages/V-1-karen.md` Finding 1 (lines 25-26): "`meta/_journal.json` contains `0004` (grep -c = 1)." Karen explicitly verified the journal entry because a missing journal registration would cause the migration to be silently skipped.
- `process/waves/wave-6/stages/C-2-deploy-and-verify.md` "Migration 0004 + 7 tables (confirmed live)": "Drizzle journal `drizzle.__drizzle_migrations` = 5 rows (0000–0004); 0004 registered + applied. Re-migrate is a no-op (additive-only; expand-only)." The verification step explicitly checked that 0004 is in the journal and applied.
- The gotcha (structural, not an incident this wave): wave-6 authored migration `0004_wandering_harry_osborn.sql` as a hand-written migration (two `CREATE UNIQUE INDEX` statements were appended manually to the drizzle-generated SQL, per V-1 karen Finding 1 line 25). A hand-written migration that is NOT registered in `_journal.json` would be silently skipped by `drizzle-kit migrate`, leaving the tables absent and causing runtime failures. Wave-6 got this right; the gotcha is recorded because the verification step was explicit about checking it, and the failure mode is non-obvious (no error is raised; the deploy succeeds; only table-absent 500s would surface at runtime).

**Severity:** informational

**Candidate principles file:** BUILD

**Cross-wave lineage / confirmation status:** FIRST-OBSERVATION. No prior wave triggered a Drizzle journal-registration defect (waves 1-5 used drizzle-generate for all migrations, which automatically populates the journal; wave-6 is the first to append hand-written SQL to a generated migration file, making the journal-registration step explicit and load-bearing). Deferred pending a second firing.

**Systemic framing:** `drizzle-kit migrate` consults `meta/_journal.json` to determine which migration files to apply. A migration file present in the filesystem but absent from the journal is a no-op at deploy time — no error, no warning, no tables created. The missing plan-authoring constraint is: when any SQL migration file is hand-authored or hand-edited after drizzle-generate, the author must verify that the file is present in `_journal.json` before committing. The correct automated safeguard would be a CI check that compares the set of `*.sql` files in the migrations directory against the set of entries in `_journal.json` and fails if the sets diverge. Without this check, a developer who forgets the journal step ships a silent deploy-time table-absence, which only manifests when the application attempts to query the missing table.

---

## Summary table

| OBS | Title (abbreviated) | Candidate file | Severity | Confirmation status |
|-----|---------------------|---------------|----------|---------------------|
| OBS-1 | `import type` erases DI token → NestJS boot crash | BUILD | warning | CONFIRMS-PRIOR (wave-2 OBS-4; 2nd firing) |
| OBS-2 | Non-TypeScript runtime assets must be declared in nest-cli.json assets | BUILD | warning | FIRST-OBSERVATION |
| OBS-3 | Adversarial /review finds false-positive merge CRITICALs that head-builder gate misses | VERIFY | strong | CONFIRMS-PRIOR (wave-3 OBS-1, wave-4 OBS-5; 3rd consecutive firing) |
| OBS-4 | False-negative infra hard-stop: check all env var aliases before blocking | none | informational | FIRST-OBSERVATION |
| OBS-5 | P-4 gate catches schema divergence + invariant loss on data-correctness waves | none | informational | CONFIRMS-PRIOR (wave-3/4/5 OBS-3; 4th consecutive confirmation; no new principle) |
| OBS-6 | Drizzle hand-written migrations must be registered in meta/_journal.json | BUILD | informational | FIRST-OBSERVATION |

---

## Promotion-eligibility analysis

### CONFIRMED-AND-READY / CONFIRMS-PRIOR (promotion-eligible)

**OBS-3 → VERIFY-PRINCIPLES (rule 2, strong, CONFIRMED-AND-READY).**
Three consecutive waves (3, 4, 6) where Phase-1 head-builder gate APPROVED and Phase-2 adversarial /review found CRITICALs on a correctness-critical surface (RBAC logic, cryptographic serialization, dedupe merge). Wave-3 OBS-1 was FIRST-OBSERVATION; wave-4 OBS-5 CONFIRMED-AND-READY but lost the per-file slot to VERIFY rule 1 (FakeRepo serialization); wave-5 carried it forward as "strongest VERIFY candidate"; wave-6 delivers the third confirmation. VERIFY rule 1 is now the only occupied slot. This is the single strongest promotion candidate this wave.

Pre-drafted 2-line form:
```
2. Run adversarial /review on every B-block diff that builds an auth guard, integrity chain, or merge engine.
   Why: Head-builder gate reviews structure; adversarial probing finds fail-open, hash-path, and false-merge CRITICALs.
```
(Rule line 107 chars; Why line 84 chars; no forbidden tokens; exactly 2 lines.)

**OBS-1 → BUILD-PRINCIPLES (rule 3, warning, CONFIRMS-PRIOR).**
Second firing of the `import type` / reflect-metadata erasure mechanism (wave-2 OBS-4 FIRST-OBSERVATION + wave-6). The mechanism is distinct from BUILD rule 2 (consuming-module export). The 2-wave confirmation gate is met. BUILD rule 2 is the only occupied additional slot; rule 3 slot is open. This is the strongest BUILD promotion candidate. Note that wave-5 OBS-5 (non-bypassable-by-construction enforcement gates) is also a BUILD FIRST-OBSERVATION candidate but did not re-fire this wave; OBS-1 is the cleaner promotion.

Pre-drafted 2-line form:
```
3. Never use `import type` for a class that is constructor-injected into a NestJS provider.
   Why: The TypeScript compiler erases `import type` at emit, stripping the DI token and crashing bootstrap.
```
(Rule line 88 chars; Why line 86 chars; no forbidden tokens; exactly 2 lines.)

### FIRST-OBSERVATION (deferred — awaiting a second wave to confirm)

| Obs | Title (abbreviated) | Candidate file | Severity |
|-----|---------------------|---------------|---------|
| OBS-2 | nest-cli.json assets required for non-TypeScript runtime files | BUILD | warning |
| OBS-4 | Verify all env var aliases before declaring a credential-absent hard-stop | none | informational |
| OBS-6 | Drizzle hand-written migrations must be registered in _journal.json | BUILD | informational |

OBS-2 is the most likely to re-fire (any future module that reads a non-TypeScript file at runtime via the filesystem); it should be watched at the next B-block where `readFileSync` appears outside of a TypeScript source file. OBS-4 and OBS-6 are both informational; OBS-6 would become a stronger BUILD candidate if a future wave's drizzle migration is silently skipped due to a missing journal entry.

### Non-promotion assessments

OBS-5 (P-4 gate corroboration) — no promotion path; gate spec already encodes the multi-iteration requirement; conclusion consistent across waves 3, 4, 5, and 6.

---

## Strongest promotion candidate per principles file (synthesizer recommendation; head-learn + karen make final call)

**VERIFY-PRINCIPLES:** OBS-3 (adversarial /review on auth guards, integrity chains, and merge engines) — rule 2. Strong severity; three-wave confirmation; the VERIFY file has only rule 1 and this is the longest-pending confirmed candidate in the entire cross-wave queue (deferred since wave-3 due to per-file slot competition; that competition is resolved).

**BUILD-PRINCIPLES:** OBS-1 (`import type` erases DI token) — rule 3. Warning severity; two-wave confirmation; distinct from both existing BUILD rules; the regression-test form (`sourcing.di-boot.spec.ts`) is already encoded in T-2.

Per-file cap (1 rule per file per wave) allows both promotions in the same wave because they target different files. Karen vetting and head-builder / head-verifier sign-off required before any commit.
