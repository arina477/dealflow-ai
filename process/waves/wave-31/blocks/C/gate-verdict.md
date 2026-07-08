# Wave 31 — C-block gate verdict (head-ci-cd)

**Wave topic:** M9 Twenty CRM DataSourceAdapter (adapter-only; NO migration).
**Merged HEAD of main (git-verified):** `b1f81d79c44ce1fe7f51f7f678ce8b08f4fa7891` (short `b1f81d7`).
**Deploy platform:** Railway (project `app-arina-5ywq3s` `ce095f75-1f3d-4af9-939e-fe8532541475`, env `production` `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`, service `dealflow-api` `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6`).
**Mode:** automatic.

> **SHA note.** The spawn prompt cited `b1f81d7c44ce…` (dropped a `9`). `git rev-parse HEAD`
> resolves the true merged HEAD to `b1f81d79c44ce…`, matching review-artifacts.md. All
> provenance below is gated against the git-verified SHA `b1f81d79…`, never the prompt string.

---

## C-1 — PR-author + CI-watch

**Result: PASS (genuine green — NOT the recurring CI-billing hard-stop).**

- Check-suite **DID fire** on the exact merged SHA `b1f81d79…`: suite id `78284698632` (`github-actions`), `total_count=1`. This is the opposite of the billing-exhaustion case (zero suites) — CI genuinely ran on this SHA.
- Watched to conclusion (monitor `boystj6pz`): suite `completed / SUCCESS`. All 5 check-runs green:
  - `typecheck = completed/success`
  - `test = completed/success`
  - `lint = completed/success`
  - `audit = completed/success`  ← pnpm-audit security gate concluded success
  - `build = completed/success`
- No `.github/workflows` changes (respected — PAT lacks Workflows:write).
- Merge landed the adapter on main: `twenty.adapter.ts` (+493), `twenty.adapter.spec.ts` (+651), `adapter.registry.ts` (+2, Twenty registered), `.env.example` (+2). `git diff` scan: **zero** migration/schema/`.sql` files → adapter-only claim statically confirmed.

**C-1 verdict: PASS** — CI provenance verified against the exact merged SHA; suite fired, ran, and concluded SUCCESS.

## C-2 — deploy-and-verify (dormant, key-gated)

**Result: PASS (deployed + boot-clean-dormant verified on the exact merged SHA).**

Rollback anchor (armed before mutating): prior known-good `dealflow-api` deployment
`a7d479ac-d264-4604-833a-4fbd2ce2b62d` (SUCCESS, sha `a6ad02c` = wave-30 Affinity). Retained
locally before triggering the new deploy.

**Ghost-Green catch (stale-SHA deploy averted):** the first `serviceInstanceDeployV2` (no
`commitSha`) redeployed the service's *pinned* commit `a6ad02c` (wave-30), NOT the merged
`b1f81d79`. That deploy (`ca49b200`) was stopped/discarded before verification — verifying it
would have been a fabricated green (no Twenty adapter present). Redeployed **pinned to the exact
merged SHA** via `serviceInstanceDeployV2(serviceId, environmentId, commitSha:"b1f81d79…")`.

- New deployment **`986c1b1d-10cd-4727-95c4-0b6b4ebe2347`**, `meta.commitHash = b1f81d79…` (verified pre-watch AND at terminal state).
- Watched to terminal SUCCESS (monitor `bynt0bgkg`): BUILDING → DEPLOYING → **SUCCESS**.
- Pre-deploy `drizzle-kit migrate` ran as gated one-shot before boot → **no-op (0 pending migrations)**, additive-only vacuously satisfied.
- **Active routed deployment** (`serviceInstance.latestDeployment`) = `986c1b1d`, status SUCCESS, sha `b1f81d79…` — authoritative deployed-SHA proof (NOT the lagging `/health.version`).
- **Independent health probe** against the deployed static URL (`https://dealflow-api-production-66d4.up.railway.app/health`, not the global domain): **HTTP 200**, `{"status":"ok","db":"ok","version":"a6ad02c…"}`. `db:"ok"` = DB connected. Root `/` = 404 (expected NestJS, no root route; not 5xx) → boot-clean.
  - `/health.version` self-reports `a6ad02c` (a build-time env var that lags per CI-PRINCIPLES rule 1) — NOT authoritative; deployed SHA is proven via Railway `commitHash` above.
- **Boot-clean-dormant confirmed:** Railway healthcheck gates SUCCESS on `/health` 200, proving the full module graph — incl. `SourcingModule.createDefaultRegistry()` registering Fixture + Affinity + Twenty — initialized without throwing, absent `TWENTY_API_KEY`/`TWENTY_BASE_URL`. Static read of `twenty.adapter.ts` confirms absent-key/URL → `return []` + warn, **no throw** (lines 365-368), with https/SSRF guard on base URL; mirrors wave-30 Affinity dormant pattern.
- Stray deploy `ca49b200` final state = **REMOVED** (superseded); exactly one SUCCESS deployment live. No conflicting/manual deploy state.

**Canary:** skipped — real-user traffic below the 1000-DAU threshold (`deploy_targets[].canary_threshold_dau`). `canary_status: skipped`.

**Key-gated LIVE-verify (founder follow-up, NOT a C-2 blocker):** real Twenty fetch is
unverifiable until the founder supplies `TWENTY_API_KEY` + `TWENTY_BASE_URL`. Request already
staged at `process/session/updates/founder-request-twenty-api-key.md`. C-2 verifies the DORMANT
deploy only, same as wave-30 Affinity.

**C-2 verdict: PASS.**

---

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2 (block-exit)
  reviewers: {}
  failed_checks: []
  rationale: >
    C-1 CI provenance is a genuine green — a github-actions check-suite (id 78284698632) fired on
    the exact git-verified merged SHA b1f81d79 and concluded SUCCESS with all five runs
    (typecheck/test/lint/audit/build) green; this is NOT the recurring Actions-billing hard-stop
    (zero-suite case), so no BLOCKED. C-2 deployed the exact merged SHA to dealflow-api after
    catching and discarding a stale-SHA (wave-30 a6ad02c) accidental redeploy; the commit-pinned
    deploy 986c1b1d reached SUCCESS with Railway-authoritative commitHash b1f81d79, is the active
    routed deployment, and boots clean-dormant (health 200, db ok, module graph incl. Twenty
    adapter initialized without the key, adapter returns [] not throw). No migration (0 pending).
    Rollback anchor a7d479ac was armed pre-mutation. LIVE Twenty fetch is correctly founder-gated
    and out of C-2 scope.
  next_action: PROCEED_TO_T_BLOCK
```

```yaml
ci_stage_verdict: PASS
verdict_source: gh + railway
verdict_evidence:
  - "gh api commits/b1f81d79.../check-suites -> suite 78284698632 completed/SUCCESS"
  - "gh api commits/b1f81d79.../check-runs -> typecheck,test,lint,audit,build all completed/success"
  - "git diff 91e115c..b1f81d79 -> 0 migration/schema/sql files (adapter-only)"
  - "railway serviceInstanceDeployV2(commitSha:b1f81d79) -> deploymentId 986c1b1d"
  - "railway deployments -> 986c1b1d status=SUCCESS commitHash=b1f81d79c44ce1fe7f51f7f678ce8b08f4fa7891"
  - "railway serviceInstance.latestDeployment -> 986c1b1d SUCCESS (active routed)"
  - "curl https://dealflow-api-production-66d4.up.railway.app/health -> 200 {status:ok,db:ok}"
  - "rollback anchor retained: a7d479ac (prior SUCCESS, sha a6ad02c)"
note: >
  canary_status: skipped (traffic < 1000 DAU). Stray no-op redeploy ca49b200 (wave-30 sha)
  caught + REMOVED, zero prod impact. /health.version lags deployed sha per CI-PRINCIPLES rule 1;
  deployed sha proven via Railway commitHash. LIVE Twenty verify founder-gated
  (founder-request-twenty-api-key.md).
```

## Block exit / handoff

```yaml
cicd_block_status:    complete
pr_number:            null            # direct-push-to-main (PAT lacks PR:write); merge commit is the unit
pr_url:               null
merge_commit:         b1f81d79c44ce1fe7f51f7f678ce8b08f4fa7891
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, deployment_id: 986c1b1d-10cd-4727-95c4-0b6b4ebe2347, commit: b1f81d79c44ce1fe7f51f7f678ce8b08f4fa7891, verified_at: 2026-07-08}
canary_status:        skipped
ready_for_test:       true
```

→ next block: T-block. LIVE Twenty end-to-end is founder-gated (TWENTY_API_KEY + TWENTY_BASE_URL);
does not block T.
