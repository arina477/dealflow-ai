# Wave 32 — B-block review artifacts
**Wave topic:** M9 self-host Twenty foundational deploy (INFRA/DEVOPS). | **Block exit gate:** B-6 | **Status:** gate-passed (B-6 APPROVE after pgvector rework-fix)
**branch:** wave-32-selfhost-twenty
## BINDING (from P-4 after rework; head-builder polices):
- **deploy-doc-FIRST:** command-center/dev/SDK-Docs/Twenty/twenty-selfhost.md — Twenty self-hosting (4-service stack twenty-server+worker+Postgres[pgvector]+Redis+S3, env, images pinned) + the JWT-token architecture + the GraphQL provisioning path (createApiKey→generateApiKeyToken). CORRECT the wave-31 doc "opaque token" note (accurate for consumption, misleading for provisioning).
- **Deploy** the 4-service Twenty stack + S3 on our infra (project.yaml target; container-host alt if Railway cant host cleanly). All services healthy.
- **API-key = GraphQL createApiKey→generateApiKeyToken (NOT DB-seed — impossible, asymmetric-signed JWT).** SPIKE workspace-bootstrap FIRST: (a) IS_SIGN_UP_ENABLED=true → GraphQL signUp/signIn → session → createApiKey+generateApiKeyToken; (b) dev-NODE_ENV workspace:generate-api-key CLI one-shot. Fallback: ONE-TIME manual founder instance-init (first admin once) → then headless; ESCALATE to head-builder to surface the single manual step if both spikes fail.
- **https TWENTY_BASE_URL** (adapter:394 SSRF guard — http:// → silent []). Private networking; Twenty admin UI NOT public.
- **SEED sample companies** into Twenty (GraphQL createCompany / POST /rest/companies) — real data for the read verify.
- **Activate read:** set TWENTY_BASE_URL(https,self-hosted) + TWENTY_API_KEY on the DealFlow API env; reuse the wave-31 twenty.adapter.ts UNCHANGED.
- **LIVE-verify:** seeded companies FLOW into the DealFlow /sourcing/companies (real E2E, evidence). NOT just deployed.
- **SECURITY:** all secrets orchestrator-generated + env-only + NEVER committed (incl. NO literal values in docker-compose/manifests); strong entropy. Zero-regression to DealFlow RLS/audit/auth (adapter read-only unchanged; no DealFlow migration).
## LOAD-BEARING: deploy-doc-first / deploy-4svc+S3 / workspace-bootstrap-spike→GraphQL-key / seed / adapter-reused / https-base-URL / secrets-never-committed / private-networking / live-read-verify. ESCALATE if no headless key path (→ one-time-manual). Ops-burden founder-visible (N).
