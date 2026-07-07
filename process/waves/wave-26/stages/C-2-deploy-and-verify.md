# C-2 — Deploy & verify (wave-26)

**Wave:** 26 — M10 FINAL-hardening (RLS connection-split deploy contract [docs] + NEW startup preflight `assertUrlsDistinct`)
**Mode:** automatic
**Gate agent:** head-ci-cd

---

## Status: NOT ENTERED — blocked by C-1 (CI still won't dispatch after resume)

C-2 requires C-1 to have exited with a verified-green CI run. C-1 is **HOLD / ESCALATE** even after
the founder's 4th spending-limit raise + Continue: head-ci-cd re-fired CI on a fresh non-`[skip ci]`
tip `4546753`, and GitHub Actions **withheld the run a 5th time** (0 check-suites @`4546753` across
12 polls / ~180s; prior withheld SHA `ca753e48`). **C-2 is deliberately NOT executed.**

### Why C-2 must NOT proceed on unverified code

This wave changes the **app bootstrap**: `apps/api/src/main.ts` now calls `assertUrlsDistinct()` at
startup (`NODE_ENV !== 'test'`), BEFORE `assertNonSuperuserConnection()` and before the Nest app is
created. A C-2 deploy is a **REAL deploy** that must verify the app STILL BOOTS with the new startup
assertion (the preflight must no-op in prod, not brick boot). Deploying a startup-assertion change
whose CI never ran — no typecheck, no unit tests, no `url-distinct-preflight.spec` (PREFLIGHT-1/2/3),
no `[RLS-GUARD]` tests — would be exactly the reckless "debug-by-deploy" the Iron Law forbids. The
risk the task flagged (a new startup assertion bricking prod) is real precisely because the assertion
throws on misconfiguration; it must not be shipped unverified.

### Deploy readiness that WAS confirmed (for the eventual resume, not acted on)

- Railway credential: `APP_RAILWAY_TOKEN` present (len 36) in env; `RAILWAY_PROJECT_ID=ce095f75-1f3d-4af9-939e-fe8532541475` present. `RAILWAY_SERVICE_ID` absent (self-discoverable via GraphQL at deploy time). Credential is NOT the blocker.
- Static code review of the preflight confirms it is prod-safe by design: `assertUrlsDistinct()` no-ops when `MIGRATE_DATABASE_URL` is absent, and only throws when both URLs are present AND equal. In prod both `DATABASE_URL` (dealflow_app) and `MIGRATE_DATABASE_URL` (owner) are set and DISTINCT → preflight no-ops → app boots. **This is static evidence only — NOT a substitute for observing the app actually boot past both guards on a real deploy against the deployed hash.** That observation is deferred to the resumed C-2.
- No migration this wave (docs + a preflight; schema unchanged) — the pre-deploy `preDeployCommand` migration step is a no-op for wave-26.

### Deploy steps DEFERRED to resume (none executed this turn)

1. Arm rollback — capture pre-deploy api deployment id/hash (currently `@987ebb4`). NOT DONE.
2. Deploy api via Railway GraphQL `serviceInstanceDeployV2` (`Project-Access-Token: APP_RAILWAY_TOKEN`). NOT DONE.
3. Verify app BOOTS CLEANLY past `assertUrlsDistinct` AND `[RLS-GUARD] assertNonSuperuserConnection`; `/health` → 200 `{status:ok, db:ok, version==<new sha>}`. NOT DONE.
4. Regression check: rate-limiter (wave-25) still works (429 smoke on `/auth/reset/request`); `[RLS-GUARD]` still fails-closed. NOT DONE.
5. Canary: docs + boot-assertion, 0 external users → careful full deploy, boot+health as gate. NOT DONE.
6. Record deploy_action + new hash + app-booted-past-both-guards + health. NOT DONE.

---

```yaml
ci_stage_verdict: HOLD                 # NOT PASS — stage not entered; blocked upstream by C-1 (CI withheld)
armed_verification_failed: false       # no MONITOR-task armed; deploy never fired
verdict_source: none
verdict_evidence:
  - "C-2 not entered — C-1 HOLD/ESCALATE (GitHub Actions withheld run on 4546753 AND prior ca753e48; 0 check-suites, 5th same-day event after 4th spending-limit raise)"
  - "app bootstrap CHANGED (new assertUrlsDistinct startup assertion) → REAL deploy requires verified-green CI first"
  - "Railway credential present (APP_RAILWAY_TOKEN, RAILWAY_PROJECT_ID) — NOT the blocker"
deploy_targets: []                     # none deployed this turn
async_monitor_id: ""
canary_status: not-entered
canary_skip_reason: ""
rollback_armed: false                  # pre-deploy id @987ebb4 NOT yet captured (deploy not entered)
note: >
  C-2 NOT entered. Blocked by C-1: GitHub Actions withheld the CI run AGAIN (0 check-suites @4546753,
  5th same-day event) even after the founder's 4th spending-limit raise + Continue. Will not
  REAL-deploy the changed app bootstrap (new assertUrlsDistinct startup assertion) without
  verified-green CI — Iron Law / no debug-by-deploy. Resume after Actions actually dispatches (billing
  change saved + no separate hard cap + no GitHub incident) and C-1 goes green: arm rollback @987ebb4
  → deploy api → verify app boots past BOTH assertUrlsDistinct + [RLS-GUARD] → /health 200 @new-hash →
  rate-limit regression smoke → canary disposition.

head_signoff:
  verdict: ESCALATE
  stage: C-2
  reviewers: {}
  failed_checks:
    - "Prerequisite: C-1 exited with verified-green CI — NOT MET (C-1 HOLD/ESCALATE, run withheld)"
  rationale: >
    C-2's sole prerequisite — C-1 merged with all required checks green on the deployed commit — is not
    met, because GitHub Actions never dispatched a run on 4546753 (nor prior ca753e48). A production deploy of a changed app
    bootstrap (a new startup assertion that throws on misconfiguration) demands a health probe against the
    exact deployed hash AND an armed rollback AND verified-green CI — none of which exist yet. Per the
    head-ci-cd closing principle, no production deploy may be authorized without an armed, tested rollback
    path and verified current-artifact CI. C-2 is not entered.
  next_action: ESCALATE_TO_founder
```
