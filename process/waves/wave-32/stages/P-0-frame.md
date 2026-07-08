# Wave 32 — P-0 Frame
## Discover
- wave 32, M9 (in_progress). Task 878c3123 — self-host Twenty as company/contact data store (founder pivot). Foundational: deploy + auto-key + read-activation + live-verify.
## Reframe
### problem-framer — REFRAME (3 catches, all folded)
1. **Deploy under-scoped:** Twenty self-hosting = 4-service stack (twenty-server[NestJS] + frontend + Postgres[**pgvector** ext] + Redis) + **mandatory S3-compatible object storage**. Feasible on Railway but MORE than assumed. → deploy-doc-first research + validate our infra can host all 4 + S3 (else pick a container host — technical decision in B).
2. **API-key auto-provisioning = undocumented GraphQL chain → SPIKE FIRST (load-bearing):** a fresh Twenty has no key; keys are made in an authed workspace. Options: (a) **seed the API-key row DIRECTLY into Twenty's Postgres** (we OWN the DB — robust, bypasses GraphQL) [PRIMARY]; (b) GraphQL mutation chain (signUp→signIn→generateApiKeyToken, discoverable from Twenty's OSS source) [fallback]. B MUST de-risk this EARLY before wiring; if BOTH fail → ESCALATE (wave can't self-complete). Env-store, NEVER commit.
3. **Live-verify unsatisfiable on empty instance → SEED step:** seed a few sample companies into self-hosted Twenty (via GraphQL/REST or DB), THEN verify the wave-31 adapter reads them → sourcing search. "verify real data flows" REQUIRES the seed.
4. **Adapter-reuse CONFIRMED real:** twenty.adapter.ts reads purely from TWENTY_BASE_URL + TWENTY_API_KEY; self-hosted exposes identical /rest/ surface → works UNCHANGED (just point the env at self-hosted).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Self-hosting Twenty traces to both live bets (integrated-platform + compliance/data-ownership) + M9. Incremental phasing (deploy+read now; write/screens later) right ~7/10. UNBLOCKS the loop (no founder key → LIVE data → ends the 3-wave founder-gated stall). FLAG: self-hosting **ops-burden** (upgrades/patching/uptime/backups we now own) — unpriced trade-off, founder-visible (surface at N). M9 _TBD metric → roadmap-refresh warranted (non-blocking).
### mvp-thinner — OK
Deploy+read+verify = ONE coherent wave (splitting deploy-only ships an unproven bare instance). WRITE-path + screen-migration + prod-hardening(backups/HA/monitoring) correctly DEFERRED. All in-wave ACs load-bearing.
### Disposition: PROCEED (with the 3 REFRAME folds)
Final framing → P-1/P-2/P-3:
1. **deploy-doc-FIRST:** command-center/dev/SDK-Docs/Twenty/twenty-selfhost.md — Twenty's official self-hosting (docker-compose: server+frontend+worker+Postgres[pgvector]+Redis+S3 storage; env: APP_SECRET, PG/Redis URLs, STORAGE_*, SERVER_URL; resource needs) + our-infra fit (Railway multi-service/Docker/volumes/S3 — or a container-host alt). Mark version.
2. **Deploy** the self-hosted Twenty stack on our infra (all services healthy; Twenty's own UI/health reachable internally).
3. **[SPIKE-FIRST] API-key auto-provision:** primary = seed the key row into Twenty's Postgres (we own it); fallback = GraphQL chain. Orchestrator-generated, env-stored (TWENTY_API_KEY + TWENTY_BASE_URL=self-hosted URL), NEVER committed.
4. **[SEED] sample companies** into self-hosted Twenty (a handful, via API/DB) so the read path has real data.
5. **Activate read:** set TWENTY_BASE_URL + TWENTY_API_KEY (self-hosted) on the DealFlow API env → the wave-31 adapter (unchanged) reads them.
6. **LIVE-verify:** the seeded companies flow from self-hosted Twenty into the DealFlow sourcing search (genuine live-verify — now possible, we own the instance).
## LOAD-BEARING: deploy-doc-first + deploy-4-service-stack+S3 + API-key-auto-provision (SPIKE, DB-seed primary) + SEED-sample-data + adapter-reuse-unchanged + live-verify-real-data + all-secrets-env-never-committed. Ops-burden = founder-visible flag.
## design_gap_flag: false (infra + existing sourcing UI). D-skip.
## FLAGS: ops-burden (founder-visible); M9 _TBD metric (roadmap-refresh); API-key-spike is the wave's key risk (ESCALATE if both provisioning paths fail).
claimed_task_ids: [878c3123]
