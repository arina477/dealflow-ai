# Wave 32 — P-2 Spec (pointer)
**Source of truth:** task 878c3123 description + this contract. single-spec. design_gap false, D-skip. INFRA/DEVOPS (self-host Twenty).
**claimed_task_ids:** [878c3123]
## AC (M9 self-host Twenty foundational deploy):
1. **deploy-doc FIRST:** command-center/dev/SDK-Docs/Twenty/twenty-selfhost.md (service topology, env, images pinned, API-key mechanism) — before deploying.
2. **Deployed:** the self-hosted Twenty stack (twenty-server + frontend/worker + Postgres[pgvector] + Redis + S3) running on our infra, all services healthy, Twenty's internal health/GraphQL reachable. Secrets orchestrator-generated + env-set + NEVER committed.
3. **[SPIKE] API key auto-provisioned** (NOT a manual console step, NO founder): DB-seed into Twenty's Postgres primary; GraphQL chain fallback. TWENTY_API_KEY captured + env-stored. ESCALATE if no path works.
4. **[SEED] sample companies** seeded into self-hosted Twenty (real data for the read path).
5. **Read activated:** TWENTY_BASE_URL(self-hosted) + TWENTY_API_KEY set on the DealFlow API env; the wave-31 adapter (unchanged) reads them.
6. **LIVE-verify:** the seeded companies FLOW from self-hosted Twenty into the DealFlow sourcing search (real end-to-end, evidence captured). NOT just "deployed".
## Load-bearing: deploy-doc-first + 4-service+S3-deploy + API-key-auto-provision(DB-seed) + seed-sample-data + adapter-reused-unchanged + live-read-verify + secrets-env-never-committed. Ops-burden = founder-visible (surface at N). ESCALATE if API-key has no working path. M9 _TBD (roadmap-refresh).

## P-4 PHASE-2 REWORK (karen — AC-3 corrected):
**AC-3 (API key) SUPERSEDED:** DB-seed is IMPOSSIBLE (Twenty keys = asymmetric-signed JWTs, no presentable DB secret). Correct path: **workspace-bootstrap (spike: IS_SIGN_UP_ENABLED=true GraphQL signUp/signIn, OR dev-NODE_ENV `workspace:generate-api-key` CLI; one-time manual founder bootstrap as fallback) → GraphQL `createApiKey`→`generateApiKeyToken` → capture JWT as TWENTY_API_KEY.** ESCALATE to a single manual instance-init step only if both bootstrap spikes fail.
**AC-2b:** TWENTY_BASE_URL = **https** (adapter SSRF guard). Private networking; Twenty admin UI not public. Secrets never in manifests; strong entropy. Zero-regression to DealFlow RLS/audit/auth.
