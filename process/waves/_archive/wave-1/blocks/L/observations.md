# Wave 1 — L-2 Distill Observations

Synthesized from wave-1 artifacts (first wave; no prior archive). Three candidate lessons
from the task prompt were evaluated against wave-1 evidence; all three are supported. Three
additional observations are drawn from cross-cutting patterns visible in the artifacts.

---

## OBS-1: pnpm 10+ workspace overrides live in pnpm-workspace.yaml, not package.json

**Title:** Dependency-version overrides for pnpm 10+ belong in `pnpm-workspace.yaml` under the `overrides:` key, not in `package.json`.

**Source:**
- `process/waves/wave-1/stages/C-1-pr-ci-merge.md` — "B-stage remediation (commit `feeb7ad`) — `multer: '>=2.2.0'` override in `pnpm-workspace.yaml`"; post-merge verification confirms the key is at `pnpm-workspace.yaml` lines 7-8 on merged main.
- The CI `audit` required check failed on the first push because the advisory was not resolved; it passed after the override was placed in `pnpm-workspace.yaml` and the lockfile regenerated.

**Severity:** warning

**Candidate principles file:** BUILD

**Systemic framing:** The P-3 plan listed pnpm as the package manager but did not capture the pnpm-10 override-key location as an environmental constraint. The gap is missing context at plan-authoring time: the plan assumed `package.json`-style override placement (the pnpm 8/9 convention) without flagging that pnpm 10 moved the override key. The CI `audit` gate is what surfaced the gap, which is the correct catch mechanism, but it added one fix-up cycle to C-1. A rule captured here would let future plan-authors account for this before writing the dep-list, avoiding the cycle.

---

## OBS-2: Railway cannot deploy a private GitHub repo via a project-scoped token; requires GitHub App auth or a public repo

**Title:** Railway's project-scoped API token cannot pull a private GitHub repository; it requires either a GitHub App authorization or a public repo.

**Source:**
- `process/waves/wave-1/stages/C-2-deploy-and-verify.md` — explicit note "Prior blocker RESOLVED: repo `arina477/dealflow-ai` is now public (founder-approved, secret-scanned clean), so Railway pulls the source over its own GitHub App."
- `process/session/status-check.yaml` — `pause_evidence.measurement.captured_error: 'serviceInstanceDeploy -> "Repository arina477/dealflow-ai not found or is not accessible"; githubRepos query -> "Not Authorized" (no GitHub account linked to the project-scoped token)'`. This was filed as a `d-hard-stop-verdict` infra-readiness block.
- `process/waves/wave-1/stages/P-0-frame.md` — the deploy rung was correctly flagged as credential-gated, but the specific Railway+private-repo incompatibility was not anticipated; the hard-stop was the first discovery.

**Severity:** strong

**Candidate principles file:** CI

**Systemic framing:** The P-3 plan acknowledged Railway deployment as credential-gated but did not surface the constraint that Railway's project-scoped token is a Railway-API credential, not a GitHub credential. The missing environmental constraint is: Railway source-deploy requires a GitHub App installation on the target repo (or the repo must be public). Without that constraint documented at plan time, C-2 could not be executed without a founder decision (make-public vs wire GitHub App). This pattern is repeatable across any Railway project that starts with a private repo, making the constraint worth encoding as a CI rule rather than rediscovering it as an infra-readiness hard-stop.

---

## OBS-3: Next.js NEXT_PUBLIC_* env vars must be set before the first web service build

**Title:** `NEXT_PUBLIC_*` env vars must be provisioned before the first web service build, as they are inlined at build time, not resolved at runtime.

**Source:**
- `process/waves/wave-1/stages/C-2-deploy-and-verify.md` lines 41-43 — "env: `NEXT_PUBLIC_API_URL=https://dealflow-api-production-66d4.up.railway.app` (baked at BUILD — set before the web deploy, so the api domain existed first)". The deploy note explicitly records the sequencing decision: api service was created and its domain resolved first so that `NEXT_PUBLIC_API_URL` could be set before the web build ran.
- V-1 jenny (`process/waves/wave-1/stages/V-1-jenny.md`) — confirms the live web page's SSR fetch to `/health` succeeded end-to-end, proving the URL was correctly baked in. The `page.tsx` reads `process.env.NEXT_PUBLIC_API_URL` at build time.

**Severity:** warning

**Candidate principles file:** CI

**Systemic framing:** The constraint is architectural (Next.js build-time inlining of `NEXT_PUBLIC_*`), but it manifests as a deploy-ordering constraint that belongs in the CI/deploy plan: the api service and its stable domain must exist before the web build begins. This was handled correctly in wave 1 by deliberate sequencing, but the constraint was not stated in the P-3 plan's deploy section. A future wave that provisions web before api, or that rotates the api domain, would bake a stale or empty URL silently. An explicit rule prevents that class of silent misconfiguration.

---

## OBS-4: The supply-chain audit gate must resolve advisories with patched-version overrides, not GHSA suppression

**Title:** When a patched version exists for a high-severity advisory, resolve it via a version override rather than suppressing the advisory ID.

**Source:**
- `process/waves/wave-1/stages/C-1-pr-ci-merge.md` — "the multer advisory is resolved by the patched-version override (no `auditConfig.ignoreGhsas` suppression; a patched version exists, so the CVE was fixed, not masked)."
- B-review-artifacts confirm `pnpm audit --audit-level=high` is a required CI check, and the audit fix is verified present on merged main.

**Severity:** informational

**Candidate principles file:** CI

**Systemic framing:** The audit gate fired correctly and the fix was applied correctly. The observation targets the decision rule for future cases: when a patched version exists, suppression via `ignoreGhsas` produces a false-green (the advisory remains exploitable in the lockfile). The distinction between "fix" and "mask" is a missing decision rule at plan-authoring time; without it, a future agent under time pressure might choose suppression as the faster path. The rule is falsifiable: check the lockfile after the fix — if the suppressed GHSA ID still resolves to the vulnerable version, it was masked, not fixed.

---

## OBS-5: Playwright Chrome binary is absent on the CI/build host and requires root to install; must be provisioned before any real UI wave

**Title:** The Playwright Chrome binary is not present on the host and requires elevated permissions to install; it must be provisioned before the first wave with real user-facing UI.

**Source:**
- `process/waves/wave-1/stages/T-5-e2e.md` — "the host has no Chrome binary (`Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome`; `npx playwright install chrome` needs root, unavailable in this environment)." T-5 degraded to HTTP smoke.
- `process/waves/wave-1/checklist.md` — T-5 noted as "Chrome absent; documented."
- V-2 triage (`process/waves/wave-1/stages/V-2-triage.md`) — task `fa23349a-ee2f-497a-b042-7e8d2c1996b5` created: "Install Playwright Chrome on host before first real UI wave."

**Severity:** warning

**Candidate principles file:** CI

**Systemic framing:** The missing automated safeguard is a pre-wave T-5 environment check: does the host have the Chrome binary? The gap was harmless in wave 1 because the UI is a throwaway placeholder with no interactions, but it is a latent blocker for every subsequent UI wave. Without a CI job or a pre-T-5 readiness check that fails fast if Chrome is absent, the T-5 swarm will silently degrade to HTTP smoke again, and real user flows will go unverified. The correct fix is environmental (provision Chrome), not wave-by-wave degradation.

---

## OBS-6: Control-plane DB and app DB share the same env-var name resolution context; independent verification of app DB objects requires app-DB credentials

**Title:** `CLAUDOMAT_DB_URL` resolves to the control-plane database, not the deployed application's database; verification tasks that require querying app-DB objects must hold explicit app-DB credentials.

**Source:**
- `process/waves/wave-1/stages/V-1-karen.md` F4 — "I could not independently query the deployed app's DB: `CLAUDOMAT_DB_URL` resolves to the claudomat control-plane DB (tables `founder_bets/milestones/tasks/waves/...`), NOT DealFlow's app Postgres — so `SELECT to_regclass('public.app_meta')` correctly returned null there (wrong database, expected)." Karen documented migration-applied evidence as indirect (deploy SUCCESS + preDeploy migrate + additive DDL + live `db:ok`) because direct app-DB inspection was unavailable.
- V-2 triage: this was correctly classified as noise (the evidence chain is credible), but karen flagged it as a verification-method limitation for T-block/jenny.

**Severity:** informational

**Candidate principles file:** VERIFY

**Systemic framing:** The missing context at plan-authoring time is the credential topology: the brain's DB access is scoped to the control-plane, while the application's Postgres is a separate service accessible only via its own `DATABASE_URL`. Verification tasks that go beyond live HTTP probes (e.g., asserting a schema object exists in the app DB) need a separate credential and connection path. Without that noted in the V-block setup, reviewers default to the available DB connection and may not realize they are querying the wrong database. A rule here prevents silent scope errors in future V-1 Karen passes that involve DB-object assertions.

---

## L-2 promotion disposition (head-learn gate)

**Promotions this wave: 0.** No candidate cleared the promotion threshold.

- The strongest candidate is **OBS-2** (Railway + private repo, `strong`, CI). It is generalizable, falsifiable, and cited to a measured infra-readiness hard-stop. However, CI-PRINCIPLES' own "Contract for new rules" authoring-discipline clause requires: *"Wave-specific ('broke once') stays in observations.md until a second wave confirms,"* and its promotion path requires an observation to appear *"across 2+ waves."* OBS-2 broke exactly once (wave 1, no prior archive). Promoting it now would violate the target file's contract (premature / temporary-fix promotion). **Deferred to the next deploy wave**; ready to promote to CI-PRINCIPLES once a second wave confirms the constraint holds.
- OBS-1 / OBS-3 / OBS-4 / OBS-5 / OBS-6 are all first-observations this wave; same 2-wave-confirmation gate applies. OBS-5 is additionally already tracked as a follow-up task (Install Playwright Chrome). All retained here for cross-wave synthesis.
- karen vetting + the deterministic linter were correctly skipped (L-2 Action 5: skip when no candidate clears threshold).
