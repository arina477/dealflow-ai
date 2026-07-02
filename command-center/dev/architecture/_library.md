# Architecture Library — DealFlow AI

> **Unified architecture reference.** This document is the authoritative single source of truth for all architectural domains. Read this document at the start of any multi-domain wave. Each section synthesizes its corresponding architecture branch (modules, services, databases, SDKs, tools, security, devops, test) into a cohesive design contract. Branch files contain expanded detail; this library is the integrated view.

---

## How to use this doc

**This document is authoritative** for its domain. When a domain-specific wave begins (e.g., a database migration wave, a compliance-gate implementation, a CI/CD setup wave), **read the relevant section from this library, then read the corresponding branch file** for additional context and implementation patterns.

- **Section 1–9 summary your domain.** Start here.
- **Branch file (e.g., `modules.md`, `databases.md`) = expanded detail, examples, and reusability patterns.** Read after section 1–9 if you need depth.
- **Stack decisions** (`stack-decisions.md`) — applies to all domains. Reference when making implementation choices.

**Branches are not authoritative on their own.** If a branch file contains pre-resolution detail (e.g., a speculative audit table schema), **this library supersedes it.** The 18 resolved conflicts are noted below and consolidated into sections 1–9.

**Resolved conflicts** (list below) are final. All branches have been reconciled; no re-opening.

---

## Table of contents

1. **Stack**
2. **Modules**
3. **Services**
4. **Databases**
5. **SDKs**
6. **Tools**
7. **Security**
8. **DevOps**
9. **Test**
10. **Cross-domain interactions**
11. **Open items and risks**

---

## 1. Stack

**Selected baseline (applied 2026-06-29):**

| Layer | Choice |
|---|---|
| **Monorepo** | Turborepo + pnpm (v9.x) |
| **Backend** | NestJS (Node.js 22 LTS, TypeScript strict) |
| **Frontend** | Next.js 15 (App Router, React 19, Tailwind, shadcn/ui) |
| **Shared contracts** | Zod schemas in `@dealflow/shared`, bridged to NestJS DTOs via `@anatine/zod-nestjs` |
| **Database** | PostgreSQL (Railway-managed) + Drizzle ORM |
| **Auth** | SuperTokens (self-hosted on Railway, Core + dedicated Postgres) + JWT + refresh tokens |
| **Queue** | BullMQ + Redis (confirmed at v6; Redis is a Railway service) |
| **Realtime** | SSE for MVP (WebSocket/Socket.IO deferred to H2) |
| **Transactional email** | Resend (candidate; email provider SDKs selected at v6) |
| **LLM** | Anthropic API (Claude models) |
| **Storage** | Railway Buckets (S3-compatible) for exports and attachments |
| **Hosting** | Railway (bring-your-own account) |
| **CI/CD** | GitHub Actions (lint, typecheck, test, build gates) |
| **Lint/format** | Biome (single binary, no ESLint) |
| **Testing** | Vitest + Supertest + React Testing Library + Playwright MCP (E2E) |
| **Secrets** | Railway environment variables only (never committed) |

**Compliance-first override** (from founder): features #10–#13 (audit-log, outreach compliance controls, separation-of-duties RBAC) are **MVP-CORE**, not H2. All three domains are production-grade at launch.

**Non-negotiable baseline assumptions:**
- TypeScript strict mode (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled)
- No `UPDATE` or `DELETE` grants on the audit-log table (database-layer enforcement)
- All secrets in Railway env vars (never committed, never in `.env.example`)
- Zod schemas are the single source of truth for all data contracts
- Domain events (via NestJS `EventEmitter2`) decouple module communication

---

## 2. Modules

DealFlow AI is a **NestJS modular monolith** (`apps/api`) with a **separate background-worker process** (`apps/worker`) sharing the same codebase. No microservices at MVP. Module boundaries are enforced via NestJS `@Module()` encapsulation; inter-module communication is via injected service interfaces or domain events.

**12 backend domain modules:**

| # | Module | Horizon | Location | Key responsibility |
|---|---|---|---|---|
| 1 | **Auth / RBAC** | H1 | `apps/api/src/modules/auth/` | SuperTokens integration, invite-only user creation, 4-role RBAC (advisor/analyst/compliance/admin) with separation of duties |
| 2 | **Mandates** | H1 | `apps/api/src/modules/mandates/` | Sell-side engagement CRUD, buyer criteria, compliance profile per mandate, mandate lifecycle audit events |
| 3 | **Data ingestion / ETL** | H1 | `apps/api/src/modules/ingestion/` | Multi-source data pull via pluggable provider adapters, scheduled sync via BullMQ, idempotent upsert to staging table |
| 4 | **Dedupe / Enrichment** | H1 | `apps/api/src/modules/dedupe/` | Entity resolution, non-destructive merge, async enrichment via provider API, provenance tracking |
| 5 | **Buyer-universe** | H1 | `apps/api/src/modules/buyer-universe/` | Analyst-curated candidate buyer list per mandate, buyer snapshots for audit, enrichment-status surfacing |
| 6 | **Matching** | H1 | `apps/api/src/modules/matching/` | Two-pass ranking (rule-based pre-score, then LLM), async via BullMQ, immutable results, advisor accept/reject/flag |
| 7 | **Templates** | H1 | `apps/api/src/modules/templates/` | Outreach template library, merge-field validation, required-compliance-block enforcement, AI-assisted drafting (inline LLM, untrusted) |
| 8 | **Outreach** | H1 | `apps/api/src/modules/outreach/` | Campaign creation, pre-send compliance gate (sync, non-bypassable), async send via BullMQ, webhook processor (email events), bounce/unsubscribe → suppression |
| 9 | **Audit-log** | H1 | `apps/api/src/modules/audit-log/` | **Append-only, tamper-evident.** HMAC-SHA256 hash chain (Railway-secret key), INSERT-only DB grant, integrity verification job, scoped query (compliance-only read) |
| 10 | **Compliance rules** | H1 | `apps/api/src/modules/compliance/` | Pre-send gate engine, suppression/blocklist, required-disclaimer enforcement, approval workflow (SoD-bound), rule management |
| 11 | **Recordkeeping** | H1 | `apps/api/src/modules/recordkeeping/` | Async export generation (BullMQ), verifiable package (JSONL + manifest + integrity attestation), Railway Buckets storage, signed download URLs |
| 12 | **Pipeline** | H1 | `apps/api/src/modules/pipeline/` | Deal record lifecycle (auto-created on shortlist), fixed stage enum (shortlisted→contacted→engaged→diligence→offer→closed/withdrawn), stage-advance suggestions |
| 13 | **Notifications** | H1 | `apps/api/src/modules/notifications/` | Domain-event consumer, in-app delivery via SSE, transactional email alerts (system sender), per-user opt-out (except in-app) |
| 14 | **Admin/settings** | H1 | `apps/api/src/modules/admin/` | Data-source connection mgmt (encrypted credentials), workspace settings, sending-domain verification, user-mgmt delegation to Auth |

**Infrastructure modules:**

| # | Module | Purpose |
|---|---|---|
| **Jobs** | `apps/api/src/modules/jobs/` | BullMQ queue definitions + worker processes (not NestJS services). Jobs registered in modules that own them (e.g., `SourceSyncJob` in Ingestion). Worker process imports only job-owning modules. |

**Frontend shared primitives (6 families):**

| # | Primitive | Purpose |
|---|---|---|
| **FE-1** | Data tables | Server-sortable, filterable TanStack Table + shadcn/ui. Variants: `RankedTable`, `AuditLogTable`, `ComplianceQueueTable` |
| **FE-2** | Forms + validation | React Hook Form + Zod resolver. Same schema as backend DTO. Field-level error mapping on 422 |
| **FE-3** | Modals / drawers | Controlled state via `useModal()`. Variants: `MatchRationaleDrawer`, `ComplianceViolationsModal`, `AuditEventDetailModal` |
| **FE-4** | Toasts / alerts | Sonner + `InlineAlert`. Variants: `ComplianceBlockBanner` (violations list + submit-for-review CTA) |
| **FE-5** | Status badges / stage chips | Domain enum → color + label. Variants per enum (outreach_status, pipeline_stage, compliance_verdict, etc.) |
| **FE-6** | Design tokens | Palette + typography + spacing. Sourced from `apps/web/src/styles/tokens.css` + Tailwind theme. Finalized at v8 D-block |

**Reusability principles:**

1. **Single schema source (Zod).** All data shapes defined once in `@dealflow/shared`; NestJS DTOs, frontend forms, and tests all derive from the same definition.
2. **Domain events over direct calls.** Modules consuming another module's state changes use `EventEmitter2`, not direct service imports.
3. **Repositories never exported.** Only service classes exported from `@Module()`.
4. **Compliance path is sync, blocking.** `OutreachService.sendCampaign()` calls `ComplianceService.checkPreSend()` before enqueuing any job.
5. **Audit-log is one-way.** All modules write to it; only Compliance and Recordkeeping read from it.
6. **Background jobs are fire-and-query.** Every job enqueue writes a status record; UI can query state via API.
7. **Adapter pattern for external services.** Email, LLM, data-source, enrichment providers are accessed via typed interfaces, not directly.
8. **UI primitives are domain-agnostic.** Thin domain-specific wrappers over generic components.

---

## 3. Services

DealFlow AI's backend is a **NestJS modular monolith** with a **separate worker process** on the same codebase. All twelve domain modules run in the API process; background jobs run in the worker process. Both share PostgreSQL and Redis.

**Worker process topology:**

The worker (`apps/worker`) is a separate Railway service that boots a minimal NestJS application. It imports only modules whose job processors it needs (Ingestion, Dedupe, Matching, Outreach, Audit-log, Recordkeeping). It connects to the same Postgres and Redis. No HTTP routes. Job status is communicated via Postgres state columns or Redis queue state.

**Background job inventory (worker-side):**

| Job | Queue | Schedule / Trigger | Idempotent | Module |
|---|---|---|---|---|
| `SourceSyncJob` | `ingestion` | Cron per source (DB config) | Yes (upsert key) | Ingestion |
| `EnrichmentJob` | `enrichment` | Enqueued by ingestion | Yes (check enriched_at) | Dedupe/Enrichment |
| `MatchingJob` | `matching` | Triggered by `runMatch()` | Yes (run status guard) | Matching |
| `OutreachSendJob` | `outreach-send` | Triggered by `sendCampaign()` after gate approval | Yes (idempotency key per message) | Outreach |
| `EmailEventWebhookJob` | `email-events` | HTTP webhook from provider → enqueue | Yes (dedupe on event ID) | Outreach |
| `AuditIntegrityJob` | `audit-integrity` | Nightly cron | Yes (new check row) | Audit-log |
| `ExportJob` | `export` | Triggered by `requestExport()` | Yes (job ID) | Recordkeeping |

All jobs emit structured logs (`job_id`, `queue`, `attempt`, `duration_ms`). Dead-letter queue per queue: `attempts: 3`, exponential backoff starting 5s.

**API REST surface (20 screens, `/api/v1/` prefix):**

**Versioning:** URL prefix (`/api/v1/`). Breaking changes require version bump (`/api/v2/`). Non-breaking additions do not. OpenAPI spec generated from NestJS decorators + Zod.

**HTTP status codes:**
- `200` — read success
- `201` — resource created
- `204` — delete / action, no body
- `400` — validation error (Zod parse failure)
- `401` — unauthenticated
- `403` — authenticated, insufficient role
- `404` — not found (no existence leakage)
- `409` — optimistic lock conflict
- `422` — business logic error (compliance block, merge failure, missing merge vars)
- `429` — rate limit exceeded
- `500` — server error (sanitized message, no traces in production)

**Endpoint roster (per screen in user journey):**

| Screen | Primary endpoints | Roles |
|---|---|---|
| 1. Login / Invite accept | `POST /auth/signin`, `POST /auth/accept-invite`, `POST /auth/reset-password` | Public |
| 2. Dashboard | `GET /dashboard` (aggregated counts) | All |
| 3. Mandates list | `GET /mandates?page=&limit=` (cursor-paginated) | advisor, analyst |
| 4. Mandate detail | `GET /mandates/:id`, `PATCH /mandates/:id`, `DELETE /mandates/:id` | advisor |
| 5. New mandate | `POST /mandates` | advisor |
| 6. Sourcing / companies | `GET /companies`, `GET /companies/:id`, `GET /companies/:id/enrichment-status` | analyst, advisor |
| 7. Buyer-universe builder | `GET /mandates/:id/buyer-universe`, `POST .../entries`, `DELETE .../entries/:companyId`, `POST .../snapshot` | analyst, advisor |
| 8. Matching — run + status | `POST /mandates/:id/match-run`, `GET .../match-run/status` | analyst, advisor |
| 9. Matching — results | `GET /mandates/:id/match-results`, `PATCH /match-results/:id` (shortlist/reject/flag) | advisor |
| 10. Outreach composer | `POST /mandates/:id/campaigns`, `POST /campaigns/:id/send`, `GET /campaigns/:id/status` | advisor |
| 11. Outreach status | `GET /campaigns/:id/messages`, `GET /campaigns/:id/messages/:messageId` | advisor, analyst |
| 12. Pipeline board | `GET /mandates/:id/pipeline`, `PATCH /deals/:id/stage`, `POST /deals/:id/notes`, `PATCH /deals/:id/next-action` | advisor (write), analyst/compliance (read) |
| 13. Template library | `GET /templates`, `POST /templates`, `PATCH /templates/:id`, `DELETE /templates/:id`, `POST /templates/:id/render` | analyst, advisor |
| 14. AI draft template | `POST /templates/ai-draft` | analyst, advisor |
| 15. Compliance queue | `GET /compliance/queue`, `POST /compliance/queue/:campaignId/approve`, `POST .../reject` | compliance |
| 16. Compliance rules | `GET /compliance/rules`, `POST /compliance/rules`, `PATCH /compliance/rules/:id`, `GET /suppression-list`, `POST /suppression-list`, `DELETE /suppression-list/:id` | compliance |
| 17. Audit log | `GET /audit-log`, `GET /audit-log/:id`, `POST /audit-log/verify-integrity` | compliance (full), advisor (own mandate) |
| 18. Recordkeeping export | `POST /exports`, `GET /exports/:jobId/status`, `GET /exports/:jobId/download` | compliance |
| 19. Admin — data sources | `GET /admin/data-sources`, `POST /admin/data-sources`, `PATCH /admin/data-sources/:id`, `DELETE /admin/data-sources/:id`, `POST .../sync` | admin |
| 20. Admin — users + workspace | `GET /admin/users`, `POST /admin/users/invite`, `PATCH /admin/users/:id/role`, `DELETE /admin/users/:id`, `GET /admin/workspace`, `PATCH /admin/workspace`, `POST /admin/workspace/verify-domain` | admin |
| Live stream | `GET /notifications/stream` (SSE) | All |
| Notifications | `GET /notifications`, `POST /notifications/:id/read` | All |
| Webhooks (inbound) | `POST /webhooks/email-events` (HMAC-verified, public) | — |

All list endpoints use **cursor-based pagination**: `limit` (max 100), `cursor` query params; response includes `{ data: [], nextCursor, total }`.

**Module structure (NestJS convention):**

```
src/modules/<module-name>/
  <module-name>.module.ts          — @Module() declaration
  <module-name>.controller.ts      — HTTP handlers; @UseGuards(RolesGuard)
  <module-name>.service.ts         — business logic
  <module-name>.repository.ts      — Drizzle queries only
  <module-name>.events.ts          — domain event classes
  dto/
    create-<entity>.dto.ts         — via createZodDto()
    <entity>-response.dto.ts
  providers/                       — external adapter implementations
  __tests__/
    <module-name>.service.spec.ts
    <module-name>.controller.spec.ts
    <module-name>.repository.spec.ts  — integration; uses TEST_DATABASE_URL
```

**Key enforcement patterns:**

- No service file imports another module's repository directly. Cross-module access via exported service.
- Circular dependency → extract to `packages/shared` or use `EventEmitter2` events.
- `RolesGuard` registered globally as `APP_GUARD`. Controllers declare `@Roles(...)`. Default-deny.
- Compliance path is always sync and blocking. No async pre-send check.
- Audit-log module imports no other module. All dependency arrows point inward.

---

## 4. Databases

DealFlow AI uses a single **PostgreSQL instance** (Railway-managed) as the system of record. Drizzle ORM provides type-safe schema definition and migration generation. The schema is partitioned by module; each module owns its tables under a dedicated Drizzle schema file.

**SuperTokens Core** runs against its own separate Railway-managed Postgres instance (provisioned by SuperTokens, not shared with the application DB).

**Application database connection:** `DATABASE_URL` env var (Railway injects this).

**Canonical table inventory (by module):**

| Module | Tables |
|---|---|
| **mandates** | `mandates`, `mandate_criteria`, `mandate_compliance_profiles` |
| **companies_contacts** | `companies`, `contacts`, `company_data_sources`, `contact_data_sources`, `dedupe_candidates` |
| **buyer_universe** | `buyer_universe_entries`, `buyer_universe_snapshots` |
| **matches** | `match_runs`, `match_results`, `match_reviews` |
| **templates** | `templates`, `template_versions` |
| **outreach_campaigns** | `campaigns`, `campaign_recipients`, `email_events` |
| **audit_log** | `audit_log_entries` (INSERT-only), `audit_log_integrity_checks` |
| **compliance_rules_suppression** | `suppression_list`, `disclaimer_templates`, `compliance_rules`, `compliance_approvals` |
| **notifications** | `notifications`, `notification_preferences` |
| **users_roles** | `users`, `user_roles`, `invitations` |
| **data_source_connections** | `data_source_connections`, `sync_runs` |
| **pipeline** | `pipeline_entries`, `pipeline_events` |

**RESOLVED CONFLICTS:**

1. **Recordkeeping = real H1 module + `export_jobs` table** — not left to auditing. `recordkeeping` module with `export_jobs` table (status, created_at, completed_at, etc.). Exports are async (BullMQ).
2. **Notifications + `notification_preferences` tables** — both added. `notifications` for in-app delivery; `notification_preferences` for per-user per-type email opt-out.
3. **Buyer-universe = real backend module + `buyer_universe` schema** — not stub. `buyer_universe_entries` + `buyer_universe_snapshots` for analyst-curated lists + audit snapshots.
4. **Templates = own module (split from Outreach) + `template_versions`** — `templates` table gets `template_versions` for editing-after-approval invalidation. `version_num`, `snapshot_json`, `created_by`.
5. **Audit integrity = HMAC-SHA256 with Railway-secret key + `chain_version`** — NOT bare SHA-256. Hash function: `HMAC-SHA256(key=<AUDIT_HMAC_KEY>, message)`. `chain_version` column for reproducibility across deploys.
6. **Audit append-only = INSERT-only DB grant AND BEFORE UPDATE/DELETE trigger** — defense-in-depth. Both enforced.
7. **Audit table = `audit_log_entries`, PK `sequence_number` (Databases authority)** — includes `actor_role` + `chain_version`. `content_hash` (payload hash) and `payload_hash` (payload hash) are distinct: `content_hash = HMAC(...)`, `payload_hash = SHA-256(payload_json)`.
8. **Compliance tables: `compliance_approvals` (not compliance_queue), `suppression_list`, `disclaimer_templates`, `compliance_rules`** — schema finalized.
9. **Pipeline = fixed stage enum for MVP** — `shortlisted | contacted | engaged | diligence | offer | closed | withdrawn`. Append-only `pipeline_events` table. Configurable per-mandate stages deferred to H2.
10. **Data-source credentials = Railway env vars only** — `data_source_connections` table is metadata + `provider_key` (e.g., "grata", "cyndx"). Actual API keys stored as Railway `DATA_SOURCE_<VENDOR>_API_KEY` env vars. No DB-encrypted secrets.
11. **App DB env var = `DATABASE_URL`** — not POSTGRES_URL.

**Drizzle schema layout:**

```
apps/api/src/db/schema/
  mandates.ts
  companies-contacts.ts
  buyer-universe.ts
  matches.ts
  templates.ts
  outreach-campaigns.ts
  audit-log.ts
  compliance-rules-suppression.ts
  notifications.ts
  users-roles.ts
  data-source-connections.ts
  pipeline.ts
  index.ts                  ← re-exports all tables
```

**Migration policy:**

- Drizzle Kit is the sole authority: `pnpm db:generate` → review → commit
- `pnpm db:migrate` applies migrations against `DATABASE_URL` (CI + Railway deploy hook)
- Never edit committed migration files; generate a new one for corrections
- Audit-log table migration must embed raw SQL `GRANT`/`REVOKE` statements (Drizzle Kit does not generate GRANTs natively)
- All migrations run in CI before integration tests; in production they run as Railway deploy hook before new revision receives traffic

**Naming conventions:**

- Table names: `snake_case` plural (`companies`, `audit_log_entries`)
- Primary keys: `id UUID DEFAULT gen_random_uuid()` (except audit-log: `sequence_number BIGINT GENERATED ALWAYS AS IDENTITY`)
- Foreign keys: `<table_singular>_id` (e.g., `mandate_id`)
- Timestamps: `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ` (managed by Drizzle `.$onUpdateFn()`)
- Soft delete: `status` enum column (never `deleted_at` boolean)
- Booleans: `is_<adjective>` prefix

**Audit-log integrity hashing (canonical algorithm):**

```
entry_hash = HMAC-SHA256(
  key=<AUDIT_HMAC_KEY>,
  message = sequence_number::text || '|' || event_type || '|' || actor_id::text || '|' || 
            subject_type || '|' || subject_id || '|' || payload_hash || '|' || prev_hash || '|' || 
            created_at::text
)
```

- `prev_hash` for sequence 1 = genesis string `'0000000000000000000000000000000000000000000000000000000000000000'` (64 hex zeros)
- Hash computation is **application-layer** (NestJS service, before INSERT), not DB trigger, so it's version-controlled and testable
- `AUDIT_HMAC_KEY` is a Railway secret; using HMAC (keyed) means DB-write access alone cannot forge a continuation

**Key enforcement (RESOLVED):**

- No UPDATE/DELETE grants to the application Postgres role on `audit_log_entries`
- BEFORE UPDATE/DELETE trigger raises exception (redundant safety)
- Only INSERT is granted
- Reporting role (if needed) gets SELECT only

---

## 5. SDKs

DealFlow AI integrates five categories of external SDKs/services, all MVP-required.

**Provider categories:**

| Category | Vendor | MVP requirement | Location |
|---|---|---|---|
| **Email + webhooks** | Resend (candidate) | Compliant outreach send + event tracking | Outreach + Notification modules |
| **LLM** | Anthropic (Claude models) | Buyer-seller match rationale + AI drafting | Matching + Templates modules |
| **Deal-source data** | TBD (2+ providers) | Target company sourcing | Ingestion module |
| **Contact enrichment** | TBD | Decision-maker discovery + verified email | Dedupe/Enrichment module |
| **Auth** | SuperTokens (self-hosted) | Session management + JWT | Global; Core on separate Railway instance |
| **Platform** | Railway | Hosting + secrets + private network | Infrastructure |

**Provider interface pattern (pluggable):**

All external data/email providers are accessed via typed interfaces. No direct SDK calls in business logic.

```
packages/shared/src/providers/
  IEmailProvider.ts              ← interface
  ResendAdapter.ts               ← implements for Resend
  
  IDataSourceProvider.ts         ← interface
  <VendorName>Adapter.ts         ← one per vendor
  
  IEnrichmentProvider.ts         ← interface
  <VendorName>Adapter.ts         ← one per vendor
```

Adapters registered via NestJS DI; active adapter selected by env var (`EMAIL_PROVIDER`, `DATA_SOURCE_PROVIDER`, `ENRICHMENT_PROVIDER`).

**Email provider (Resend candidate):**

- **Auth:** API key (`RESEND_API_KEY`) bearer header
- **Webhook signature:** HMAC-SHA256 (raw body before JSON parse)
- **Webhook secret:** `EMAIL_WEBHOOK_SECRET` (provider-agnostic naming)
- **Rate limits:** Enforce per-domain and per-recipient limits in outreach queue (independent of provider limits)
- **Error handling:** `4xx` (non-429) = non-retryable, log and mark failed; `429` = retryable with backoff; `5xx` = retryable up to 3 attempts
- **Cost:** Usage-based per email sent. Monitor against plan.

**LLM provider (Anthropic Claude):**

- **Auth:** API key (`ANTHROPIC_API_KEY`) header (server-side only, never frontend)
- **Token budget:** Set `max_tokens` explicitly on every call
- **Rate limits:** TPM/RPM per model tier. Batch heavy operations via BullMQ.
- **Error handling:** `401`/`403` = config error (alert, no retry); `429` = rate limit (backoff); `5xx` = retry up to 3 times
- **Output validation:** LLM responses validated against Zod schema before use. Hallucination guard: rationale stored verbatim.
- **Cost:** Per-token. Budget controls: `max_tokens` cap, off-peak batch jobs, per-job token tracking.

**Deal-source data APIs (pluggable, vendor TBD):**

- **Auth:** Provider-specific (typically API key)
- **Credentials:** All in Railway env vars (`DATA_SOURCE_<VENDOR>_API_KEY`)
- **Rate limits:** Per-provider throttling in ingestion ETL
- **Error handling:** Classify as transient or permanent. Transient → retry; permanent → skip, log provenance fault. Provider outage → mark job degraded, surface alert.
- **Cost:** Track per-provider query count for attribution

**Contact enrichment (pluggable, vendor TBD):**

- **Auth:** Provider-specific API key
- **Deduplication:** Skip re-enrichment within freshness window
- **Cost:** Per-lookup. Dedup + freshness controls are cost-reduction mechanisms.

**SuperTokens Core (auth):**

- **Deployment:** Railway private network only (never public). Separate Postgres instance.
- **Auth mechanism:** API key (`SUPERTOKENS_API_KEY`) for NestJS ↔ Core communication
- **Recipe:** EmailPassword (no public signup). **Invite-only user creation** via app-issued invite tokens.
- **Session:** JWT access + refresh tokens. Refresh-token rotation with reuse detection enabled.
- **Role claim:** Role lives in session claim but is **re-verified server-side** on every request against DB `users.role` (immediate role-change effect).

**Railway (platform):**

- **Services on Railway:** API, Web, Postgres, SuperTokens, Worker, Redis
- **Private network:** All inter-service traffic stays on Railway private network hostnames
- **Secrets:** Railway env vars store all SDK credentials and DB URLs
- **CLI:** Deploy via GraphQL API (not CLI; more stable)

**Secrets naming convention:**

| Env var | Used by |
|---|---|
| `RESEND_API_KEY` | Email adapter |
| `RESEND_WEBHOOK_SECRET` (or `EMAIL_WEBHOOK_SECRET`) | Webhook signature verification |
| `ANTHROPIC_API_KEY` | LLM service |
| `SUPERTOKENS_API_KEY` | NestJS ↔ Core |
| `SUPERTOKENS_CONNECTION_URI` | NestJS ↔ Core (private network URL) |
| `DATA_SOURCE_PROVIDER` | Selects active data-source adapter |
| `DATA_SOURCE_<VENDOR>_API_KEY` | Per-vendor credential |
| `ENRICHMENT_PROVIDER` | Selects active enrichment adapter |
| `ENRICHMENT_<VENDOR>_API_KEY` | Per-vendor credential |
| `AUDIT_HMAC_KEY` | Audit-log integrity hash key |
| `DATABASE_URL` | App Postgres |
| `REDIS_URL` | BullMQ queue |

**Webhook ingestion pattern (standard across all providers):**

1. Dedicated NestJS controller at `/webhooks/<provider>`; no auth middleware (provider signature is auth)
2. Raw body preservation (`rawBody: true` at app bootstrap)
3. Signature verification before JSON parse (HMAC-SHA256 or provider equivalent)
4. Idempotency check on provider event ID (no duplicate processing)
5. Async enqueue for processing (HTTP handler returns 200 immediately)
6. Audit-log entry written for each processed event

---

## 6. Tools

DealFlow AI uses a **Turborepo + pnpm monorepo** with **Biome** as the single lint/format tool and **Vitest** as the test runner across all packages.

**Language / runtime:**
- **TypeScript** strict mode (enabled: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `forceConsistentCasingInFileNames`, `isolatedModules`)
- **Node.js** 22 LTS (pinned in `.nvmrc` and `engines` field)

**Package manager:**
- **pnpm** v9.x (pinned in `packageManager` field)
- Lockfile committed (`pnpm-lock.yaml`)
- CI installs with `pnpm install --frozen-lockfile`

**Build orchestration:**
- **Turborepo** v2+ orchestrates task graph
- Pipeline tasks: `build` (depends on `^build`), `lint`, `typecheck`, `test` (all parallel, no upstream dependency)
- Remote caching: optional Vercel Remote Cache; local cache always on
- Outputs cached: `dist/**`, `.next/**`, `coverage/**`

**Lint + format:**
- **Biome** single binary (replaces ESLint + Prettier)
- Config: `biome.json` at repo root
- Enforced checks: lint rules (recommended set), import ordering, formatter (2-space indent, single quotes, trailing commas ES5)
- CI: `biome check --apply-unsafe --no-errors-on-unmatched`

**Testing:**
- **Vitest** v2+ (unit + integration) across `apps/api`, `apps/web`, `packages/*`
- **React Testing Library** for frontend component tests
- **Supertest** for NestJS HTTP integration tests
- **Playwright MCP** for E2E (5-instance swarm default; Chrome binary install required)
- Coverage target: `branches: 70, lines: 80` (enforced in `vitest.config.ts`)

**CI gates (GitHub Actions, all on every PR to `main` or push):**

| Job | Command | Timeout |
|---|---|---|
| `lint` | `pnpm turbo lint` | 10 min |
| `typecheck` | `pnpm turbo typecheck` | 15 min |
| `test` | `pnpm turbo test -- --coverage` | 20 min |
| `build` | `pnpm turbo build` | 20 min |
| `audit` | `pnpm audit --audit-level=high` | 5 min |

All jobs run in parallel until `deploy-staging` (gates on all four passing). `permissions: contents: read` minimum; no write permissions except deploy job.

**Monorepo package layout:**

```
apps/
  api/              ← NestJS backend
  web/              ← Next.js 15 frontend
packages/
  shared/           ← @dealflow/shared (Zod schemas, DTOs, types)
  db/               ← @dealflow/db (Drizzle schema + migrations)
  config/           ← @dealflow/config (tsconfig.base.json, biome.json, vitest config)
```

Internal imports use package name (`import { ... } from '@dealflow/shared'`); resolved via pnpm workspace protocol.

**No cross-app imports** — `apps/web` and `apps/api` import only from `packages/*`.

---

## 7. Security

DealFlow AI's founder issued a **compliance-first override**: audit-log, outreach compliance controls, and RBAC separation of duties are **MVP-CORE** (not H2), designed in full.

**Compliance-critical domains (MVP-scope, fully designed):**

1. **Tamper-evident audit-log** — hash chain, INSERT-only DB grant, integrity verification
2. **Outreach compliance gate** — pre-send, non-bypassable, requires approval
3. **RBAC + separation of duties** — 4 roles, sender ≠ approver enforced in code

**Crown jewels (defense-in-depth focus):**

1. **Non-public deal + contact data** (client confidentiality + regulatory event on leak)
2. **Audit-log integrity** (evidence — if altered silently, compliance is void)

**Authentication — SuperTokens (self-hosted on Railway):**

- **Deployment:** Core on Railway private network (separate Postgres)
- **Recipe:** EmailPassword + Session (no public signup)
- **Invite-only:** Admin creates user → single-use invite token (72h expiry) → invitee sets password
- **Login:** EmailPassword with password policy (breach/common-password rejection)
- **JWT + refresh:** Short-lived JWT (~1h), long-lived refresh token. Refresh-token rotation with reuse detection enabled.
- **Session:** `httpOnly`, `Secure`, `SameSite=Lax` cookies (frontend cannot reach token)
- **CSRF:** Anti-CSRF token + `SameSite`. All state-changing endpoints are POST/PUT/PATCH/DELETE.
- **Role claim freshness:** Role re-verified server-side on every request against DB `users.role` (immediate role change takes effect; no stale-token privilege escalation)

**RBAC model — 4 roles + separation of duties:**

| Role | Can do | Cannot do |
|---|---|---|
| **advisor** | Mandates CRUD, match review, shortlist, compose outreach, send approved outreach, pipeline | Approve own outreach, edit compliance rules, see audit-log, manage users |
| **analyst** | Sourcing, dedupe, enrichment, buyer-universe, companies, draft templates | Approve compliance, send outreach, see audit-log, manage users |
| **compliance** | Review/approve/reject outreach, manage compliance rules + suppression + disclaimers, read audit-log, run exports | Send outreach, create mandates, source data, manage users |
| **admin** | User/role management, data-source config, workspace settings, domain verification | **Does not** inherit compliance-approval or send rights (no super-role shortcut) |

**Separation of duties (SoD) invariant:** For any outreach, **sender ≠ approver**. Enforced server-side in the send path: assert (a) outreach carries compliance approval, (b) approver has role `compliance`, (c) `approver_user_id != sender_user_id`. Failure is audited.

**Authorization enforcement:**

- **`RolesGuard` registered globally** as `APP_GUARD`; `@Roles(...)` decorator on every controller method
- **Default-deny:** un-annotated endpoints treated as deny; explicit `@Roles()` required to ship
- **Object-level authorization:** queries scoped by mandate/campaign ownership + role (IDOR defense)
- **Frontend role-gating is UX only** — security boundary is server-side

**Input validation — Zod (shared contracts):**

- **Single schema source:** all data shapes in `@dealflow/shared`, used by both NestJS and frontend
- **Validate at boundary:** controller inputs parsed by Zod before any business logic
- **Strict parsing:** `.strict()` rejects unknown keys (mass-assignment defense), explicit coercion for query params, bounded types (enums, string lengths)
- **Untrusted input:** email webhooks + LLM output + enrichment API responses validated + signature-verified before persistence
- **LLM output:** treated as untrusted text; never executed; rendered with output encoding (no `dangerouslySetInnerHTML`)

**Secrets handling on Railway:**

- **Source of truth:** Railway env vars only (never committed)
- **`.env.example`:** lists keys with placeholder values (no real values)
- **Generation:** App-generated secrets via `openssl rand -base64 32` / `crypto.randomBytes()`; account-issued credentials requested from founder
- **Private networking:** API ↔ Core ↔ Postgres ↔ Buckets on Railway private network; only Next.js and public API exposed
- **Egress secrets:** outbound calls carry keys from env only; keys never in logs
- **Rotation:** manual for MVP (Railway var + redeploy); documented procedure for `EMAIL_WEBHOOK_SECRET` dual-key acceptance

**Audit-log security (append-only, tamper-evident):**

**RESOLVED:** Uses HMAC-SHA256 (keyed, not bare hash) with Railway-secret key + `chain_version` column.

- **Append-only:** DB role has INSERT/SELECT only (no UPDATE/DELETE grant); BEFORE UPDATE/DELETE trigger raises exception
- **Hash-chain:** `entry_hash = HMAC-SHA256(key=AUDIT_HMAC_KEY, message=canonical_serialization)`. Each row's `prev_hash` is the prior row's `entry_hash`. Tampering any row breaks every subsequent hash.
- **Canonical serialization:** Fixed field set + order, versioned via `chain_version` so reproducible across deploys.
- **Coverage:** Every outreach communication (compose → approve/reject → send → email event) + every compliance decision (approval, rejection, rule change, suppression, role change, export)
- **Integrity verification:** Background job re-walks chain, reports breaks; verification result is itself an audit event
- **Write path:** Non-bypassable — audit write in same transaction as action (or via outbox guaranteeing eventual write)

**Outreach compliance controls (pre-send gate, non-bypassable):**

- **Gate is synchronous, blocking:** send endpoint calls `ComplianceService.checkPreSend()` before enqueuing any job
- **Re-run at send time:** gate re-checked at send (not just at compose), so records drifting out of compliance are re-blocked
- **Suppression/blocklist:** every recipient checked at send time; match = hard block (compliance-managed list)
- **Required disclaimers:** template must contain jurisdiction-specific disclaimer text before approval
- **Approval workflow:** send requires `compliance`-role approval with `approver != sender` (SoD)
- **Approval is version-bound:** editing message after approval invalidates approval; content hash compared at send time
- **Every step audited:** compose, submit-for-review, approve, reject, gate pass/fail, suppression hit, send

**Webhook signature verification (email events, RESOLVED):**

- **Secret name:** `EMAIL_WEBHOOK_SECRET` (provider-agnostic)
- **Algorithm:** HMAC-SHA256
- **Raw body:** preserved before JSON parse (required for signature verification)
- **Idempotency:** dedupe on provider event ID
- **Async processing:** payload enqueued immediately; HTTP returns 200 (no dropped events on provider retry)

---

## 8. DevOps

DealFlow AI runs on **Railway** (bring-your-own account) with **GitHub Actions** as the CI layer.

**Environments:**

| Env | Purpose | Trigger |
|---|---|---|
| `dev` | Local machines; `.env.local` from `.env.example`; Railway private services accessed via `railway run` or tunnel | Manual |
| `staging` | Full-stack on Railway; mirrors prod topology; QA + E2E + compliance smoke tests | Merge to `main` |
| `prod` | Live on founder's Railway account; private network enforced; no SSH/exec | Tag push `v*.*.*` |

PR branches get ephemeral preview environments on Railway (web service only, pointing at staging API).

**Railway services:**

| Service | Runtime | Notes |
|---|---|---|
| `api` | NestJS (Node 22, Docker) | REST API; internal port 3001; private network; `PORT` env injected by Railway |
| `web` | Next.js 15 (Node 22, Docker) | Frontend; internal port 3000; public Railway domain; `NEXT_PUBLIC_API_URL` points to `api` private hostname |
| `postgres` | Railway-managed Postgres | App DB; `DATABASE_URL` env injected |
| `supertokens` | SuperTokens Core (Docker) | Auth; private network; separate Postgres connection string |
| `worker` | NestJS worker (Node 22, Docker) | Background jobs; no public port; private network |
| `redis` | Railway-managed Redis | BullMQ queues; `REDIS_URL` env injected |

**CI gates (GitHub Actions):**

| Job | Trigger | Runs on | Timeout |
|---|---|---|---|
| `lint` | Every PR + push | `ubuntu-latest` | 10 min |
| `typecheck` | Every PR + push | `ubuntu-latest` | 15 min |
| `test` | Every PR + push | `ubuntu-latest` | 20 min |
| `build` | Every PR + push | `ubuntu-latest` | 20 min |
| `audit` | Every PR + push | `ubuntu-latest` | 5 min |
| `deploy-staging` | Merge to `main` | `ubuntu-latest` | 15 min |
| `test-e2e` | After `deploy-staging` | `ubuntu-latest` | 30 min |
| `deploy-prod` | Tag push `v*.*.*` | `ubuntu-latest` | 15 min |

First four jobs run in parallel. `deploy-staging` gates on all four. `deploy-prod` gates on `deploy-staging` success for same SHA.

**CI gates detail:**

| Gate | Command | Enforces |
|---|---|---|
| `lint` | `pnpm turbo lint` | Biome lint + format check |
| `typecheck` | `pnpm turbo typecheck` | TypeScript strict mode |
| `test` | `pnpm turbo test -- --coverage` | Vitest + coverage threshold (70 branch, 80 lines) |
| `build` | `pnpm turbo build` | Monorepo build success |
| `audit` | `pnpm audit --audit-level=high` | Dependency security (NEW at v6) |

**Test database (CI):**

- Real Postgres container (Docker Compose or testcontainers)
- **Not** pg-mem; real DB required for audit-log permission grant tests
- Seeded from `packages/db/seeds/test-seed.ts` before each test suite
- `TEST_DATABASE_URL` env var (must never equal `DATABASE_URL`)

**Deploy pipeline (Railway GraphQL API, not CLI):**

1. Merge PR to `main` → `deploy-staging` job
   - Query Railway GraphQL API to trigger staging deploy
   - Poll deployment status; advance if successful
   - Run Drizzle migrations (`drizzle-kit migrate`)
   - Health-check `GET /health` endpoint (status: ok, version: git-sha)
   - Run T-5 E2E swarm against staging (Playwright 5-instance swarm)

2. Tag push `v*.*.*` → `deploy-prod` job
   - Same as above, but for prod environment
   - Deploy only if `deploy-staging` succeeded for the same SHA

**Observability:**

| Concern | Tooling | Notes |
|---|---|---|
| Structured logs | Pino (NestJS default) → Railway log drain | JSON lines; `traceId`, `requestId` propagated; drain export when volume exceeds Railway retention |
| Metrics | Railway built-in (CPU/mem/replicas) + app-level deferred to v6 | |
| Distributed tracing | Interface stubs in API; `@opentelemetry/sdk-node` deferred | |
| Error tracking | Unhandled rejections logged to structured output; Sentry DSN deferred | |
| Uptime | Railway health check: `GET /health` | Restarts on failure |
| Audit-log integrity | Background job writes alert log entry on chain break; log-drain rule targets it | |

**Secrets (GitHub Actions + Railway):**

- All secrets stored as **GitHub Actions encrypted secrets** (accessed via `${{ secrets.NAME }}`)
- GitHub Actions holds only deploy tokens (`RAILWAY_TOKEN`), not application secrets
- Application secrets (DB URLs, API keys, etc.) stored in **Railway environment variables per service**
- `.env.example` lists placeholder labels only (no real values)

**Deploy-time credential collection (C-2 stage):**

`RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_STAGING`, `RAILWAY_ENVIRONMENT_PROD` are collected and stored in GitHub Actions secrets before first deploy wave. Until then, deploy jobs are skipped.

**Drizzle migrations in CI:**

- Run as a Railway job (not a service) after successful deploy
- Uses same `DATABASE_URL` as `api` service
- Migration failures block the deployment pipeline
- Never run `drizzle-kit push` in CI; only apply pre-generated `.sql` files

---

## 9. Test

Test suite spans 9 T-layers. T-1/T-2/T-3 run on every wave. T-4–T-9 fire per block dispatcher skip rules.

**CRITICAL:** Playwright Chrome binary installation is a prerequisite before first UI wave's T-5; currently BLOCKED (see Risk).

**T-1 — Static (Biome + TypeScript):**

Fires on every push. No wave skips. Enforces:
- Lint rules (recommended set) + import ordering
- TypeScript strict mode (shared Zod schemas must type-check across NestJS + Next.js)

**T-2 — Unit (Vitest, mocked boundaries):**

Co-locate test files next to source (`*.unit.test.ts`). Coverage target: 70% branch.

**Tier 1 test cases (non-negotiable, 80%+ branch):**

1. **Matching-engine correctness** — score computation (valid + edge cases), ranking order (stable sort), rationale parsing, concurrent updates
2. **Audit-log tamper evidence** — hash chain (row N's prev_hash = row N-1's hash), tampering detection (mutate row, delete row, verify fails), append-only enforcement (UPDATE/DELETE rejected at DB)
3. **Pre-send compliance gate** — blocks on suppression, missing disclaimer, pending approval; allows on pass; cannot be bypassed; approval revocation re-blocks
4. **RBAC + SoD** — 401-before-403 stacking order, role mismatch → 403, sender ≠ approver, object-level authorization (IDOR), invite token expiry/replay

**T-3 — Contract (Zod validation):**

Validate request/response contracts against shared schemas. Key contracts:
- `AuditLogEntrySchema` (hash, prev_hash, chain_version required)
- `ComplianceGateResultSchema` (verdict enum, violations array)
- `MatchScoreSchema` (score [0,1], rationale, IDs)

**T-4 — Integration (Supertest + real test DB):**

Test database: real Postgres (Docker Compose / testcontainers); migrations applied; seeded from `test-seed.ts`; `TEST_DATABASE_URL` env var.

- Audit-log permission-grant tests (UPDATE/DELETE → SQLSTATE 42501)
- Webhook signature verification + idempotency
- RBAC + object-level authorization (cross-mandate access)
- Approval workflow end-to-end
- Suppression-list matching

No mocks for DB. Mock LLM provider, email provider, enrichment/data-source APIs at HTTP boundary via `nock`.

**T-5 — E2E (Playwright MCP swarm):**

**BLOCKED — Chrome binary not installed.** When unblocked:

5-instance swarm (F1–F15 flows mapped to Tester 1–5). Each tester uses dedicated persona from `test-accounts.md`. Compliance-critical flows (F3, F10, F11) receive evidence-grade reporting (network panel, console, screenshots).

**T-6 — Layout (visual regression):**

**BLOCKED — Chrome binary.** Baseline captures scoped to Pages 15, 16, 17 (compliance) + Page 4 (dashboard).

**T-7 — Performance:**

Lighthouse CI budget (`tests/perf/budget.json`). Not CI-gated at MVP.

**T-8 — Security (custom Supertest probes):**

Fires when wave touches auth, sessions, CSRF, rate-limit, user-creation, outreach-send, compliance-gate. Probes:
- Auth smoke (every role)
- CSRF (state-changing endpoints)
- Rate limiting (login/password-reset)
- Replay (invite token, webhook event)
- IDOR (cross-mandate access)
- Audit-log permission (UPDATE rejected)
- Compliance gate bypass (direct send rejected)
- RBAC stacking order

**T-9 — Journey:**

Regenerates `command-center/artifacts/user-journey-map.md` from staging. Verifies every route returns correct status for correct persona.

**Test infrastructure:**

| Aspect | Implementation |
|---|---|
| **Personas** | `ADVISOR_USER`, `ANALYST_USER`, `COMPLIANCE_USER`, `ADMIN_USER`, `UNAUTHENTICATED` |
| **Factories** | `mandateFactory()`, `buyerFactory()`, `auditLogEntryFactory()`, `outreachFactory()`, `inviteTokenFactory()`, `userFactory(role)` |
| **Seed script** | `packages/db/seeds/test-seed.ts` (idempotent, runs before each suite) |
| **Fixtures** | `tests/fixtures/audit-chain-valid.json` (5-entry chain for hash verification tests) |
| **Mocks** | `tests/helpers/llm-mock.ts` (LLM provider HTTP intercept), `nock` for email/enrichment/data-source APIs |
| **File structure** | Unit: co-located; Integration: `tests/integration/`; E2E: `tests/e2e/`; Security: `tests/security/` |

**Conventions:**

- **AAA structure:** Arrange, Act, Assert comments in every test
- **Layer-specific naming:** `*.unit.test.ts`, `*.integration.test.ts`, `*.contract.test.ts`, E2E: `<flow>.spec.ts`
- **Mock cleanup:** `vi.clearAllMocks()` in `afterEach` (no bleeding state)
- **Assertion style:** Assert on types/contracts, not string messages
- **Mock policy:** Unit mocks at boundary; Integration mocks external APIs only (no DB mocks); never mock the module under test
- **Guard-order assertion:** Every RBAC test asserts 401-before-403 explicitly

---

## 10. Cross-domain interactions

The core loop and integration glue across all domains.

**Core workflow (deal sourcing → matching → outreach → compliance → audit):**

```
1. MANDATE CREATION (advisor)
   → Mandate service creates record + compliance profile
   → Audit-log writes MandateCreatedEvent
   → Notification alerts relevant users

2. DATA INGESTION (scheduled or manual)
   → Ingestion module enqueues SourceSyncJob (BullMQ)
   → Worker syncs from external data-source provider
   → Raw records written to staging table
   → Ingestion enqueues EnrichmentJob for each record
   → Notification sends sync-result (counts)

3. DEDUPE/ENRICHMENT (async via BullMQ)
   → EnrichmentJob processor calls enrichment provider
   → Contacts enriched + verified email captured
   → Canonical companies/contacts records upserted
   → Provenance tracked (source, enriched_at, provider)

4. BUYER-UNIVERSE BUILD (analyst)
   → Analyst filters companies by mandate criteria
   → Adds/removes buyers via BuyerUniverseService
   → BuyerUniverseService queries companies + enrichment status
   → Snapshot created for audit trail

5. MATCHING RUN (advisor-triggered, analyst-reviewed)
   → Advisor triggers runMatch(mandateId)
   → Matching service enqueues MatchingJob
   → Worker processor runs two-pass ranking:
     - Deterministic pre-score (rule-based)
     - LLM rationale + score for top-N (Claude API call)
   → Match results written (immutable)
   → Matching emits MatchRunCompletedEvent
   → Notification alerts completion
   → Audit-log writes MatchRunCompletedEvent

6. SHORTLIST (advisor)
   → Advisor reviews match results
   → shortlistBuyer(matchId) → match_reviews record written
   → Matching emits BuyerShortlistedEvent
   → Pipeline module listens to BuyerShortlistedEvent → auto-creates deal record
   → Audit-log writes ShortlistDecisionEvent

7. OUTREACH COMPOSE (advisor)
   → Advisor creates campaign → selects shortlisted buyers + template
   → OutreachService.createCampaign calls TemplateService.renderTemplate(templateId, mergeVars)
   → Template service validates merge fields + required compliance blocks
   → If AI draft requested: inline LLM call (untrusted text, not auto-sent)
   → Campaign record written (status: draft)

8. COMPLIANCE GATE (pre-send, non-bypassable)
   → Advisor triggers sendCampaign(campaignId)
   → OutreachService calls ComplianceService.checkPreSend(campaign_payload)
   → Compliance gate checks:
     - Suppression list (every recipient)
     - Required disclaimer presence
     - Approval status (if mandate.approval_required)
   → If blocked → GateResult with violations; send throws ComplianceBlockedException
   → If pending approval → compliance queue item created; awaits approver
   → If approved → gate returns ALLOWED

9. COMPLIANCE APPROVAL (compliance officer)
   → Compliance officer reviews outreach in compliance queue
   → Compliance role only; must be different person than sender (SoD enforced)
   → approveOutreach(campaignId) → compliance_approvals record
   → Content hash stored (version-binding; edit after approval invalidates)
   → Audit-log writes ComplianceApprovedEvent
   → Notification alerts advisor

10. OUTREACH SEND (async, BullMQ-gated)
    → After approval, OutreachService.sendCampaign enqueues OutreachSendJob
    → Worker processor sends via email provider (Resend)
    → Provider returns message IDs + sending timestamp
    → campaign_recipients + email_events records written
    → Audit-log writes OutreachSentEvent (per recipient)

11. EMAIL EVENT TRACKING (async webhook processor)
    → Email provider webhooks to POST /webhooks/email-events
    → Webhook controller verifies HMAC signature
    → Idempotency check on event ID
    → Enqueues EmailEventWebhookJob
    → Worker processor updates email_events + outreach_messages
    → Pipeline module listens to OutreachOpenedEvent / OutreachRepliedEvent
    → On reply: suggests stage advance to engaged
    → Audit-log writes EmailEventEvent (per event type)
    → Bounce/unsubscribe → ComplianceService adds to suppression list

12. PIPELINE ADVANCEMENT (advisor)
    → Advisor advances deal stage (advanceStage)
    → Stage change written to pipeline_events
    → Audit-log writes DealStageChangedEvent
    → Notification alerts team

13. RECORDKEEPING EXPORT (compliance officer)
    → Compliance triggers requestExport(date_range, mandate_id)
    → RecordkeepingService enqueues ExportJob
    → Worker processor queries audit_log_entries for range
    → Runs AuditIntegrityVerification for range
    → Builds export package: JSONL + manifest + integrity attestation
    → Uploads to Railway Buckets
    → export_jobs record writes (status: complete, signed_url)
    → Audit-log writes ExportRequestedEvent
    → Notification sends download link

14. AUDIT INTEGRITY (nightly + on-demand)
    → AuditIntegrityJob walks audit_log_entries in sequence order
    → Recomputes each entry_hash from stored fields + HMAC key
    → Compares to stored entry_hash; checks prev_hash linkage
    → On break: writes alert to audit_log_integrity_checks + alert log entry
    → Export includes verification attestation
```

**Module call graph (execution path, not deployment):**

```
HTTP Request → Controller → Service (module A)
                 ↓
            Calls Service (module B)  [exported from B's @Module]
                 ↓
            Emits DomainEvent
                 ↓
            Async handlers in modules C, D, E listen
                 ↓
            Audit-log module writes (sync @OnEvent handler ensures completion)
                 ↓
            Notification module writes
                 ↓
            Response returns
```

**Key enforcement points:**

1. **Compliance gate is non-bypassable:** OutreachService.sendCampaign() is the only send path; it always calls ComplianceService.checkPreSend() synchronously.
2. **Audit-log is always written:** Every module emits events to a single AuditLogService; no module writes audit table directly.
3. **Separation of duties enforced in code:** send endpoint asserts `approver_user_id != sender_user_id` and `approver.role == 'compliance'`.
4. **Background jobs are idempotent:** job keys, dedup on event IDs, run guards prevent duplicate execution.
5. **Webhook processing is atomic:** signature verified → idempotency checked → enqueued → 200 returned (provider does not retry on acknowledge).

**Integration glue:** Zod schemas in `@dealflow/shared` are the contract layer across all modules. EventEmitter2 decouples module communication. NestJS DI ensures services are injected by type (circular dependencies resolved via events or extracted shared logic).

---

## 11. Open items and risks

**RESOLVED CONFLICTS (18 items, all final):**

1. ✅ Recordkeeping = real H1 module + `export_jobs` table
2. ✅ Add `notifications` + `notification_preferences` tables
3. ✅ Buyer-universe = real backend module + `buyer_universe` schema
4. ✅ Templates = own module (split from Outreach) + `template_versions` (editing after approval invalidates approval)
5. ✅ Audit integrity = HMAC-SHA256 with Railway-secret key + `chain_version`
6. ✅ Audit append-only = INSERT-only DB grant AND BEFORE UPDATE/DELETE trigger (defense-in-depth)
7. ✅ Audit table = `audit_log_entries`, PK `sequence_number`; includes `actor_role` + `chain_version`; `content_hash` and `payload_hash` distinct
8. ✅ Compliance tables: `compliance_approvals`, `suppression_list`, `disclaimer_templates`, `compliance_rules`
9. ✅ Pipeline = fixed stage enum for MVP; configurable per-mandate stages deferred to H2
10. ✅ Data-source credentials = Railway env vars only; `data_source_connections` = metadata + `provider_key`
11. ✅ SuperTokens = own Railway Postgres instance, separate from app DB
12. ✅ App DB env var = `DATABASE_URL`
13. ✅ Email webhook secret = `EMAIL_WEBHOOK_SECRET` (provider-agnostic)
14. ✅ Background queue = BullMQ + Redis
15. ✅ CI test DB = real Postgres container (Docker Compose / testcontainers), NOT pg-mem
16. ✅ Realtime = SSE for MVP (WebSocket/Socket.IO deferred to H2)
17. ✅ CI adds `pnpm audit --audit-level=high` gate
18. ✅ Playwright Chrome binary install is host-side prerequisite before first UI wave's T-5

**Outstanding open items (not resolved conflicts; genuinely open):**

| # | Item | Owner | Urgency |
|---|---|---|---|
| **R-1** | **Playwright Chrome binary not installed.** Blocks T-5 E2E and T-6 layout tests. Host-side fix required: `pnpm exec playwright install chromium` before any Playwright-dependent test runs. | Host environment setup | **CRITICAL — before first UI wave's T-5** |
| **R-2** | **Deal-source data vendor selection pending.** At least 2 providers required; must evaluate coverage, API quality, rate-limit headroom, cost. Per `external-sdk-integration-rules.md`, research process (research-analyst spawn, SDK doc authoring) runs at P-3 of first sourcing-integration wave. | P-3 research gate | Blocks sourcing feature waves |
| **R-3** | **Contact-enrichment vendor selection pending.** Same research process as above. Must evaluate verified-email accuracy (compliance-critical) and GDPR/CCPA posture. | P-3 research gate | Blocks enrichment feature waves |
| **R-4** | **Email provider SDK doc not authored.** Resend is candidate; final selection at v6 SDK branch. SDK doc required before integration wave. | SDK branch research | Blocks outreach feature waves |
| **R-5** | **LLM provider SDK doc not authored.** Anthropic Claude is the selected provider. SDK doc with prompt versioning strategy required before matching-engine wave. | SDK branch research | Blocks matching-engine wave |
| **R-6** | **Railway Postgres plan PITR confirmation.** Backup strategy assumes ≥7-day PITR window (WAL-based). Must confirm founder's Railway plan provides this before first production deploy. If not, pg_dump export job must shift earlier than H2. | Founder (account access) + C-2 | Before first prod deploy |
| **R-7** | **Hash-chain genesis row + serialization format.** First audit_log_entries row uses hardcoded `prev_hash` genesis value. Field set + ordering for hash input must be locked in code and documented before any compliance export is produced. | Audit-log service implementation wave | Before first audit event write |
| **R-8** | **Audit payload retention + PII policy.** `audit_log_entries.payload_json` may contain PII (contact names, emails). Data minimization policy (what goes in payload vs. referenced by ID) must be decided before implementation to avoid GDPR/CCPA exposure on immutable rows. | Compliance + legal review | Before audit-log service implementation |
| **R-9** | **Multi-tenant schema isolation (H3).** Current schema has no `tenant_id` / `workspace_id` on most tables. H3 multi-tenancy (feature #27) requires either additive column migration (large surface) or schema-per-tenant. Decision deferred but should be flagged at H2 design time. | Architecture review at H2/H3 boundary | H2 planning |
| **R-10** | **Background job queue in-process testing.** Integration tests for queue jobs (enrichment, outreach-send, email-event processor) assume queue boundary (job dispatch mocked). When queue technology confirmed (likely Redis-backed BullMQ), add T-4 tests against real in-process queue or test container. | T-4 test authoring wave | When queue tech finalized |
| **R-11** | **Socket.IO evaluation deferred.** SSE is MVP real-time. Socket.IO should be evaluated at H2 if live-collaborative features (shared pipeline board) are scoped. At that point, use Socket.IO namespaces + Redis adapter for multi-instance. | H2 evaluation | H2 feature planning |
| **R-12** | **Webhook secret rotation procedure not defined.** `EMAIL_WEBHOOK_SECRET` rotation requires coordinated update of Railway env var + provider webhook config with zero dropped events. Procedure should document dual-key acceptance in WebhookProcessorService during overlap window. | DevOps + security branch | Before production launch |
| **R-13** | **LLM token-budget + cost controls need quantification.** Per-request `max_tokens` caps and per-wave batch-job token budgets should be sized against expected mandate count + buyer universe size before matching-engine wave ships. | Matching-engine implementation wave | Before matching-engine wave |
| **R-14** | **SuperTokens Core upgrade path.** Core versioning cadence separate from Node SDK. Minor version drift can cause silent auth failures. Establish policy for keeping them in sync and document in SuperTokens SDK doc. | Auth implementation wave | Before auth wave ships |
| **R-15** | **Dedupe entity-resolution quality.** Fuzzy match threshold needs tuning. Conservative threshold (high confidence only) at MVP; expose manual merge UI for analysts. Threshold is DB-configurable setting, not hardcoded. | Dedupe/enrichment implementation wave | Before dedupe wave ships |
| **R-16** | **RBAC double-check overhead.** Guard-level + service-level role checks add code surface. Risk of divergence. Acceptance test per role per sensitive endpoint in CI verifies guard + service checks. | T-4 test authoring | When RBAC implemented |
| **R-17** | **CI test database container provisioning.** Docker Compose Postgres or testcontainers for CI; must include schema + migrations + seed. `TEST_DATABASE_URL` must be separate from `DATABASE_URL`. Exact provisioning mechanism decided at C-2 / CI setup wave. | CI setup wave | Before first integrated test run |
| **R-18** | **T-5 E2E coverage gap tracking.** Any flow added to user-journey-map.md without corresponding `tests/e2e/<flow>.spec.ts` is an open gap. As of v6 architecture, all 13 flows (F1–F15) are mapped but spec files are not written. Expected — specs authored wave-by-wave once Chrome binary is installed. | T-5 test authoring (post-Chrome install) | Post-Chrome install |

**Deferred to H2 (NOT covered by compliance-first override, which is MVP-scoped to audit-log + outreach controls + SoD-RBAC):**

- Full STRIDE threat model (MVP relies on concrete controls; revisit before broadening beyond design partner)
- Cross-border data residency matrix (required before multi-jurisdiction pilot or H2 pilot-partner workspace)
- Formal consent architecture (suppression + disclaimers + approval cover MVP; jurisdiction-modeled lawful-basis deferred)
- M2M / service-to-service hardening (private network + env secrets sufficient for MVP; harden before multi-tenant or external integrations)
- MFA for human logins (TOTP via SuperTokens deferred; recommend early H2 given data sensitivity)
- Automated secret rotation (manual rotation for MVP; automate alongside H2 hardening)
- Advanced recordkeeping + retention policy enforcement (locked export + attestation deferred; MVP uses `locked_until` column present from day one)
- Pilot-partner workspace isolation (RLS policies additive at H2; `workspace_id` column present on all tables from day one)

---

**END OF ARCHITECTURE LIBRARY**

This document is authoritative. Branch files (`modules.md`, `databases.md`, etc.) contain expanded detail. When implementing a feature or wave spanning multiple domains, read the relevant sections above, then read the corresponding branch files for patterns and examples.
