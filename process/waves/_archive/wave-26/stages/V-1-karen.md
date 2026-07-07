# V-1 Karen — Wave 26 (M10 FINAL-hardening: RLS connection-split deploy contract + assertUrlsDistinct preflight)

**VERDICT: APPROVE**
**Defect findings: 0** (5 verification checks, all PASS)
**Independently confirmed /health @0825370: YES** — prod returned `{"status":"ok","db":"ok","version":"082537011dc6bb16795929cacd4d7d7605ac0ddb"}` (HTTP 200), version prefix `0825370` = deployed SHA.

Reality mode: "deployed state" = LIVE @0825370 on prod, app booted past BOTH startup guards. Verified against the deployed SHA and the running service, not against tests or the diff alone.

---

## Check 1 — Code + doc artifacts REAL on main @0825370 — PASS
- `command-center/dev/architecture/devops.md:237` — `### RLS connection-split & role-privilege deploy contract` section present, with role table (`devops.md:245-246`), PATH-safe preDeploy form (`devops.md:254`), `[RLS-GUARD]` doc (`devops.md:270`), `assertUrlsDistinct()` doc (`devops.md:274-282`), coupled-rollback procedure (`devops.md:286-292`), and deploy checklist (`devops.md:299-302`).
- `apps/api/src/db/index.ts:57` — `assertNonSuperuserConnection` (FROZEN [RLS-GUARD]) present; `apps/api/src/db/index.ts:105` — `assertUrlsDistinct` present.
- `apps/api/src/main.ts:31` — `assertUrlsDistinct()` wired; `apps/api/src/main.ts:44` — `await assertNonSuperuserConnection()` wired. Order correct: URLs-distinct preflight (L31) runs BEFORE the role check (L44), matching devops.md § "runs *before* … before `assertNonSuperuserConnection()`".
- `apps/api/src/db/url-distinct-preflight.spec.ts` exists — PREFLIGHT-1 (no-op no MIGRATE), PREFLIGHT-2 (throws `[RLS-GUARD]`/`identical` on equal), PREFLIGHT-3 (no-op on distinct). Assertions are real behavioral checks, not tautological.

## Check 2 — MG1 [RLS-GUARD] logic FROZEN — PASS
Read `git show 0825370:apps/api/src/db/index.ts`. Predicates UNCHANGED and correct:
- `row.is_superuser === 'on'` → throw (fail-closed).
- `row.has_bypassrls` (from `pg_roles.rolbypassrls WHERE rolname = current_user`) → throw (fail-closed).
- No-row → throw ("refusing to start with unknown privileges").
`git diff --stat 0825370..HEAD` on both `index.ts` and `main.ts` is EMPTY — the deployed guard byte-for-byte equals the working-tree guard; no post-deploy drift. This was a docs-hardening wave and it did NOT weaken the guard (only surrounding doc-comments/message text reference the new devops.md § — logic identical).

## Check 3 — App LIVE + booted past BOTH guards — PASS (independently confirmed)
- `GET https://dealflow-api-production-66d4.up.railway.app/health` → HTTP 200, `{"status":"ok","db":"ok","version":"0825370…"}`.
- A live `db:ok` boot is positive proof both guards no-op/passed in prod: `assertUrlsDistinct()` passed ⇒ the 2 URLs are distinct; `assertNonSuperuserConnection()` passed ⇒ runtime role is NOSUPERUSER + NOBYPASSRLS (per devops.md:270 / :300, `/health` db:ok is the mechanical proof). Fail-closed design means any guard failure would have `process.exit(1)` and `/health` would be unreachable — it is reachable and green.

## Check 4 — No regression: wave-25 rate-limiter still LIVE — PASS
8x `POST /auth/reset/request` (fake `@example.invalid`, no real account): req 1-5 → `202`, req 6-8 → `429`. Limiter tripped at the documented threshold and survived the 0825370 deploy.

## Check 5 — MG2: devops.md internally consistent + no secret — PASS
- Stale-contradiction grep (`same POSTGRES_URL` / `same DATABASE_URL` / `same connection` / `identical URL`) → ZERO hits. The prior stale "same URL" claim is gone; the doc now consistently mandates two DISTINCT URLs (`devops.md:248` "must always be set to distinct connection strings", `:299` checklist "set and distinct").
- Secret scan of devops.md @0825370 (connection-string-with-password / `password=` / `secret=` / AWS keys / PEM) → ZERO hits. Role table uses placeholder role names (`dealflow_app`, `postgres`), no credentials.

---

**Bottom line:** deliverable is REAL and LIVE. Docs section added + stale § corrected, preflight added and wired ahead of the frozen guard, guard logic provably unchanged, app booted past both guards in prod, rate-limiter regression clean, no secrets. Nothing to REWORK.

wrote V-1-karen.md
