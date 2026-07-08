# Wave 32 — B-6 Review gate verdict

**Block:** B (Build) | **Stage:** B-6 Review | **Wave topic:** M9 self-host Twenty foundational deploy (INFRA/DEVOPS)
**Branch:** wave-32-selfhost-twenty | **Gate agent:** head-builder (fresh spawn) | **Date:** 2026-07-08

---

## Deliverable class

Autonomously-buildable artifact = **DEPLOY PACKAGE + provisioning automation + deploy-doc**. NOT DealFlow app code (wave-31 `twenty.adapter.ts` reused unchanged). The LIVE stand-up (deploy the 5-service billable stack + S3 account + read-verify) is founder-gated on a cost/consent + service-creation-access boundary.

---

## Verdict: REWORK

**One-line:** Package is secret-clean, adapter-untouched, provisioning-architecture-correct, and the live-verify is legitimately founder-gated — BUT the load-bearing compose stack will NOT stand up as delivered: the Postgres image lacks pgvector AND the extension is created under the wrong identifier, so the README's headline `docker-compose up -d` fails at DB init. A deploy package whose one-command deploy breaks at container init is not shippable → REWORK (two-line fix).

---

## Checklist walk

| # | Check | Result |
|---|---|---|
| 1 | deploy-doc-first + correct architecture (5-svc topology, pinned images, env, CORRECTED JWT provisioning) | **PASS** — `twenty-selfhost.md` is genuine and thorough. § "API Key Provisioning — JWT Token Architecture" explicitly corrects the wave-31 "opaque token" note: documents asymmetric-signed JWT, states direct DB insert will NOT work, mandates `createApiKey`→`generateApiKeyToken`. Not a stub. |
| 2 | docker-compose correctness (deps, health checks, pgvector init, `${VAR}` placeholders, internal network, no hardcoded secret) | **FAIL** — see Defect 1 + 2 below. Structure/deps/healthchecks/network/placeholders are all correct; the pgvector provisioning is broken. |
| 3 | Provisioning automation sound + runnable (Path-A signup spike, Path-B CLI fallback, seed, one-time-manual documented) | **PASS** — `provision-via-signup.sh` does the real signUp→signIn→createApiKey→generateApiKeyToken JWT-capture flow with per-step error handling; `provision-via-cli.sh` is a genuine dev-NODE_ENV `workspace:generate-api-key` one-shot; `seed-sample-data.sh` seeds companies+people via REST `/rest/companies` `/rest/people`. Real bash, not pseudo-code. README + doc document the one-time-manual UI fallback and the escalation path. |
| 4 | SECRET HYGIENE — no secret VALUES committed anywhere; scripts read from env; `.env.example` placeholder-only | **PASS** — independent leak scan clean (only 40+char hit is a file path). All secrets `${VAR}` / `$(openssl rand)` / placeholders. `.env.example` empty-valued. `.env` confirmed gitignored (root `.gitignore` lines 9-11). Scripts read every secret from env, embed none. |
| 5 | https `TWENTY_BASE_URL` honored (adapter SSRF guard) | **PASS** — README + doc set https base URLs throughout; doc § TLS cites the adapter's `parsedBaseUrl.protocol !== 'https:'` guard (verified live at `twenty.adapter.ts` ~L394: non-https → warn + return `[]`). |
| 6 | Zero-regression: adapter UNCHANGED, no DealFlow migration, wave touches only infra/ + docs | **PASS** — `git diff main...HEAD` on `twenty.adapter.ts` is empty. Changed set = deploy-doc + registry row + `infra/twenty-selfhost/*` + 3 wave stage transcripts. The only `.sql` is Twenty's own pgvector init (Twenty's DB, not a DealFlow migration). No DealFlow app-code change. |
| 7 | Live-verify legitimately founder-gated (not done-theater) | **PASS** — honest, P-4-anticipated deferral. No fabricated live claim anywhere; scripts + README describe the deploy as a to-run procedure, never as executed. The bounded founder step (stand up 5 billable services + S3 account, no service-creation access in this env) is a genuine cost/consent gate, correctly surfaced as founder-visible ops burden (review-artifacts "Ops-burden founder-visible (N)"). |

---

## Defects (REWORK — both in the pgvector provisioning path)

**Defect 1 — Postgres image lacks pgvector (`docker-compose.yml:5`).**
`image: postgres:16-alpine` does not bundle the pgvector shared library. Twenty requires pgvector (doc §Overview, §Database). On this image, `CREATE EXTENSION vector` fails with `extension "vector" is not available` — whether run by `init-pgvector.sql` or by Twenty's own startup migration. Fix: pin `pgvector/pgvector:pg16` (or another pgvector-enabled Postgres 16 image) for the `postgres` service.

**Defect 2 — wrong extension identifier (`init-pgvector.sql:5`, `twenty-selfhost.md:130` + `:172`).**
`CREATE EXTENSION ... pgvector` uses the project/package name. The identifier registered by the pgvector project is `vector` → `CREATE EXTENSION IF NOT EXISTS vector`. As written, init fails even on a correctly-provisioned image. Fix all three occurrences.

**Combined blast radius:** the README's headline one-command deploy (`docker-compose up -d`, README:15) errors at Postgres container init (init-script failure) or Twenty's first-boot migration cannot create its vector columns. The founder's bounded infra step fails through no fault of their own — the exact "almost right but subtly bad" defect this gate exists to catch. Two-line image swap + s/pgvector/vector/ across three files; no architectural change.

---

## What is explicitly NOT a defect

- Live deploy not executed → correct, founder-gated (cost/consent + no service-creation access). Not held against the package.
- Secret hygiene → clean, independently verified.
- Adapter reuse → confirmed byte-identical to wave-31.
- Provisioning scripts → runnable, real, dual-path with documented manual fallback.

---

## Rework scope (tight — re-gate on these only)

1. `docker-compose.yml`: `postgres:16-alpine` → `pgvector/pgvector:pg16` (both the live compose and the doc's §"Full Docker-Compose Example" / §Database sample block).
2. `init-pgvector.sql`, `twenty-selfhost.md:130`, `twenty-selfhost.md:172`: `pgvector` → `vector` in `CREATE EXTENSION`.
3. No other changes required. Adapter, provisioning scripts, secret handling, live-verify disposition all stand approved.

---

```yaml
head_signoff:
  verdict: REWORK
  stage: B-6
  reviewers: {}
  failed_checks:
    - "B-6/compose-correctness: postgres:16-alpine lacks pgvector library (docker-compose.yml:5) → use pgvector/pgvector:pg16"
    - "B-6/compose-correctness: CREATE EXTENSION pgvector uses wrong identifier (init-pgvector.sql:5, twenty-selfhost.md:130,172) → CREATE EXTENSION vector"
  rationale: >
    The deploy package is otherwise strong — deploy-doc-first with genuinely corrected
    JWT-token provisioning architecture, runnable dual-path provisioning + seed scripts,
    clean independently-verified secret hygiene (no committed values, .env gitignored,
    env-only reads), byte-identical reuse of the wave-31 adapter (no DealFlow migration
    or app-code change), and an honest, P-4-anticipated founder-gated live stand-up that
    is NOT done-theater. It fails on one load-bearing item: the Postgres provisioning in
    the compose stack. The pinned image (postgres:16-alpine) does not bundle pgvector, and
    the extension is created under the wrong identifier (pgvector vs vector) in the init
    script and twice in the doc. As delivered, the README's headline `docker-compose up -d`
    errors at Postgres init — the founder's bounded infra step would break through no fault
    of their own. For an infra/deploy wave whose entire deliverable is a working deploy
    package, a compose stack that will not stand up is a blocking defect. Fix is a two-line
    image swap plus s/pgvector/vector/ across three occurrences; no architecture change.
  next_action: REWORK_B-2
```
