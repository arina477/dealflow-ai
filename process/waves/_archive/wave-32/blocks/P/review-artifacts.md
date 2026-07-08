# Wave 32 — P-block review artifacts
**Block:** P (Product) | **Wave topic:** M9 — SELF-HOST the open-source Twenty on OUR infra as the company/contact data store (founder pivot 2026-07-08). FOUNDATIONAL slice: deploy self-hosted Twenty + auto-provision its API key + activate DealFlow's READ connection (reuse the wave-31 adapter) + live-verify real companies flow into sourcing search. | **Block exit gate:** P-4
| Stage | Deliverable | Status |
|---|---|---|
| P-0 | stages/P-0-frame.md | done |
| P-1 | done |
| P-2 | done |
| P-3 | done |
## Block-specific context
- **claimed_task_ids:** [878c3123 (self-host Twenty foundational deploy + read-connection)]
- **Founder pivot (2026-07-08):** self-host open-source Twenty as the private data store for companies+contacts; DealFlow UI stays + reads/writes to it. NOT Twenty cloud. Answer = "Private data store, our UI stays". Data-ownership/compliance.
- **This is an INFRA/DEVOPS wave** (deploy a full self-hosted third-party app) — different shape from the code-adapter waves. Route B to a deployment/devops specialist.
- **KEY REUSE:** the wave-31 twenty.adapter.ts (read path) is REUSED — TWENTY_BASE_URL points at the SELF-HOSTED instance. Self-hosted Twenty exposes the SAME REST API → the adapter works unchanged. NOT a rebuild.
- **UNBLOCKS the loop:** NO founder cloud key needed — the orchestrator provisions the self-hosted instance + generates its API key internally (open-source + our infra; rule 6/10). Prior key-gated-live-verify dissolved.
- **LOAD-BEARING framing to validate:**
  - **deploy-doc-FIRST (feasibility):** research Twenty's self-hosting requirements (Docker: twenty-server + Postgres + Redis + worker; resource needs) + whether our deploy target (project.yaml — Railway) can host it (multiple services / Docker), BEFORE committing. If Railway can't host Twenty's stack cleanly, pick an alternative (technical decision — rule 17). Author command-center/dev/SDK-Docs/Twenty/twenty-selfhost.md.
  - **API-key auto-provisioning:** on a FRESH self-hosted Twenty, generate an API key programmatically (seed via Twenty's DB/admin/API during provisioning) — NO founder, NO manual console step. Env-store, never commit.
  - **read-first / write-later:** this wave = deploy + READ activation + live-verify ONLY. The WRITE path (DealFlow creates/updates in Twenty) + screen-migration = LATER waves.
  - **secret hygiene:** the self-hosted instance's DB creds, app secret, API key — all generated + env-stored, NEVER committed.
- **design_gap_flag:** false (infra + reuse existing sourcing UI). D-skip.
- Autonomous mode: automatic.
## Gate verdict log
<appended by head-product at P-4>

## P-4 Phase 1: head-product APPROVED (traces to founder pivot; deploy-doc-first + 4-svc+S3 + adapter-reuse + seed-step + secrets + live-verify; routed karen+jenny+security-auditor).
## P-4 Phase 2: jenny APPROVE (6/6 MATCHES 0-drift) + security-auditor APPROVE (3 B-invariants: secrets-never-in-manifests+strong / private-https-networking-admin-not-public / zero-regression) + karen REJECT→(rework)→APPROVE (API-key DB-seed was architecturally impossible [asymmetric-signed JWT]; reworked to GraphQL createApiKey→generateApiKeyToken PRIMARY + workspace-bootstrap-spike [IS_SIGN_UP_ENABLED GraphQL signUp/signIn → dev-NODE_ENV CLI] + one-time-manual fallback + https-base-URL).
## MERGED P-4 VERDICT: APPROVED (after rework). → B-block (D-skip; INFRA/DEVOPS). BINDING: deploy-doc-first(JWT+GraphQL-provisioning) / deploy-4svc+S3 / workspace-bootstrap-spike→GraphQL-key(NOT-DB-seed) / one-time-manual-fallback+ESCALATE / seed-sample-data / adapter-reused-unchanged / https-TWENTY_BASE_URL / secrets-env-never-committed-incl-manifests / private-networking / zero-regression / LIVE-read-verify.
**Status:** gate-passed
