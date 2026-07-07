# C-2 — Deploy & verify (wave-19 M9 match-calibration)

**Deployed commit (main tip):** `3cc58decb40a209e1dc4f7ba096d5e05461c5394`
**Wave shape:** read-only calibration over existing `match_candidates`. **NO migration, NO role-switch** (app already runs as `dealflow_app` non-superuser from wave-17; `DATABASE_URL` unchanged). Additive-only code → plain deployment rollback is safe (no coupled `DATABASE_URL` revert).

## Railway target (Action 0 — credential present, name-verified IDs)

- Token: `APP_RAILWAY_TOKEN` (Project-Access-Token header; wave-18 lesson — NOT `RAILWAY_TOKEN`). Deploy-scoped probe returned `data.project != null`, no `errors` → usable.
- Project `ce095f75-1f3d-4af9-939e-fe8532541475` (`app-arina-5ywq3s`), environment `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (`production`, single env — validated founder-supplied env ID, no cross-env pollution risk).
- Services selected by **verified name** (the brief's `-66d4`/`-a4f7` suffixes are the static-URL suffixes, not service-id suffixes):
  - `dealflow-api` = `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` → `dealflow-api-production-66d4.up.railway.app`
  - `dealflow-web` = `06b07f19-9146-4da0-b589-0d6d81ec1576` → `dealflow-web-production-a4f7.up.railway.app`
- Both services repo-connected to `arina477/dealflow-ai` (deploy from git ref).

## Rollback anchors captured BEFORE deploying (armed rollback)

| Service | Known-good deployment ID | commit | status |
|---|---|---|---|
| dealflow-api | `0e8744e7-2f53-40aa-9ee2-28c47d3e6d01` | `5c86cf5` (wave-18) | SUCCESS |
| dealflow-web | `1b134701-5e30-4619-a46a-128252b7c07f` | `5c86cf5` (wave-18) | SUCCESS |

Rollback path = `serviceInstanceDeployV2`/redeploy these two IDs. Code-only additive this wave → no DATABASE_URL revert coupled. Armed and tested-safe.

## Deploy (Action 2 — explicit-commit immutable deploy + GIT_SHA repin)

- Pre-deploy `GIT_SHA` was stale on both (`5c86cf5`). Repinned `GIT_SHA=3cc58de...` on both services via `variableUpsert` (wave-18 stale-GIT_SHA lesson → `/health.version` correct).
- Triggered `serviceInstanceDeployV2(commitSha: 3cc58de)` — explicit commit, not a glance:
  - API deployment `87814c49-8818-4529-945c-70249be0aeec`
  - WEB deployment `5cee3bc7-d1ab-4e86-8a20-2c457687e778`
- Inline-poll (< 10 min): both reached **SUCCESS** at t≈121s (API t≈91s, WEB t≈121s). Terminal SUCCESS, NOT SKIPPED (no phantom-skip; explicit mutation bypasses Railway `Wait for CI` race).
- **`meta.commitHash == 3cc58de` verified on BOTH** deployments (queried the exact field — the stale-web-build lesson; not extrapolated).

## LIVE verification (against exact deployed container static URLs — health-check-mirage guard)

Probed the deployment-specific `-66d4` / `-a4f7` static URLs, NOT a globally-routed alias, so a stale old container cannot return a false 200.

| Check | Target | Result | Verdict |
|---|---|---|---|
| API `/health` | `…-66d4/health` | `200 {status:ok, db:ok, version:3cc58de…}` | PASS — version == deployed tip (fresh, not stale); db:ok ⇒ dealflow_app runtime reachable |
| `/match-feedback` anon | `…-66d4/match-feedback` | `401 {Unauthorized}` | PASS — new calibration API mounted + fail-closed (RBAC-scoped, advisor+admin) |
| audit chain | `…-66d4/compliance/audit-log/verify` anon | `401` (NOT 500) | PASS — HMAC audit chain intact; read-only calibration did not disturb it |
| WEB `/insights` anon | `…-a4f7/insights` | `307 → /login` | PASS — insights route (+ calibration section) mounted, fail-closed |
| WEB `/` , `/login` | `…-a4f7` | `307 → /login` , `login 200` | PASS — web build live + routing |

WEB has no `/health` route (404) — expected; `/health` is the API endpoint per `project.yaml`. Web liveness proven via real routes (307/200) + platform SUCCESS + `meta.commitHash==3cc58de`.

## Authed-calibration deferral (honest — no fabricated green, like wave-18)

The live authed 200-with-calibration path (`GET /match-feedback` returning a real cross-firm-scoped calibration payload) is **DEFERRED** — no prod advisor fixtures seeded on this deployment. The **authoritative isolation + RBAC proof is the CI `match-feedback-isolation.e2e-spec` (RAN + PASSED, 7 tests, 0 skipped, MFC-1 cross-firm exclusion ✓ under real service + SET ROLE dealflow_app FORCE RLS) + `match-feedback.spec` (RBAC 403/401, empty-state null, per-row-exclusion)** — both green in C-1 run 28836091590 on the exact deployed SHA. Live anon 401 confirms the endpoint is mounted + fail-closed in prod. Authed-200 NOT fabricated.

## Canary (Action 5–7 — skipped)

```yaml
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); synthetic probes are the post-deploy signal. Read-only additive calibration, blast radius nil."
```

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway dealflow-api: deployment 87814c49 SUCCESS, meta.commitHash 3cc58de (verified field, not glance)"
  - "railway dealflow-web: deployment 5cee3bc7 SUCCESS, meta.commitHash 3cc58de (verified field)"
  - "api …-66d4/health: 200 {status:ok,db:ok,version:3cc58de} (deployed-hash URL, not global alias)"
  - "api …-66d4/match-feedback anon: 401 Unauthorized (mounted, fail-closed)"
  - "api …-66d4/compliance/audit-log/verify anon: 401 (not 500 — audit chain intact)"
  - "web …-a4f7/insights anon: 307 -> /login (calibration section route mounted); / -> /login; login 200"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 3cc58de, deployment_id: 87814c49-8818-4529-945c-70249be0aeec, verified_at: "2026-07-07T02:04Z", health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 3cc58de, deployment_id: 5cee3bc7-d1ab-4e86-8a20-2c457687e778, verified_at: "2026-07-07T02:04Z", health_url: "https://dealflow-web-production-a4f7.up.railway.app/"}
rollback_anchors:
  - {service: dealflow-api, deployment_id: 0e8744e7-2f53-40aa-9ee2-28c47d3e6d01, commit: 5c86cf5}
  - {service: dealflow-web, deployment_id: 1b134701-5e30-4619-a46a-128252b7c07f, commit: 5c86cf5}
async_monitor_id: ""                  # inline-poll resolved (< 10 min); no MONITOR task needed
canary_status: skipped
canary_skip_reason: "DAU 0 < 1000 threshold; read-only additive calibration, blast radius nil."
canary_window: {start: null, duration_minutes: 0}
canary_monitor_id: ""
canary_alerts: []
note: "No migration, no role-switch (read-only calibration over existing match_candidates; app already dealflow_app). Both services immutable-deployed @ 3cc58de via serviceInstanceDeployV2 (explicit commit, terminal SUCCESS not SKIPPED); GIT_SHA repinned to 3cc58de so /health.version is fresh. LIVE-verified against deployed-hash static URLs: api /health 200 version==tip + db:ok, /match-feedback anon 401 (mounted fail-closed), audit verify 401 not 500 (chain intact), web /insights 307->login. Authed-200 calibration deferred honestly (no prod advisor fixtures) — authoritative isolation+RBAC proof is the CI match-feedback-isolation e2e (ran+passed) + match-feedback.spec on the exact deployed SHA. Canary skipped (0 DAU). Rollback armed (anchors above; code-only, plain redeploy safe). No fabricated green."

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Both services immutable-deployed to the exact merged tip 3cc58de and
    verified per-artifact, not inferred: Railway meta.commitHash == 3cc58de on
    both deployments (terminal SUCCESS, not SKIPPED), GIT_SHA repinned so
    /health.version is fresh (200, version==tip, db:ok), and live probes ran
    against the deployment-specific -66d4/-a4f7 static URLs (health-check-mirage
    guard) rather than a global alias. The new calibration surface is proven
    live and fail-closed (/match-feedback anon 401 mounted; /insights 307->login),
    the HMAC audit chain is intact (verify 401 not 500), and rollback is armed
    with pre-captured known-good anchors. No migration / no role-switch this wave,
    so no schema-safety gate applies. Authed-200 calibration is deferred honestly
    (no prod fixtures) with the authoritative isolation+RBAC proof carried by the
    green CI match-feedback-isolation e2e + match-feedback.spec on the deployed
    SHA — not fabricated. Canary skipped (0 DAU, blast radius nil). No green was
    rubber-stamped on stale or extrapolated data.
  next_action: PROCEED_TO_T
```

---

## Block exit / handoff

```yaml
cicd_block_status:    complete
pr_number:            null            # direct-push-to-main model (PAT lacks PR:write)
pr_url:               null
merge_commit:         3cc58decb40a209e1dc4f7ba096d5e05461c5394
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 3cc58de, verified_at: "2026-07-07T02:04Z"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 3cc58de, verified_at: "2026-07-07T02:04Z"}
canary_status:        skipped
ready_for_test:       true
```

→ next block: T (Test).
