# SDKs Architecture

**Branch:** sdks
**Last updated:** 2026-06-29
**Status:** Authoritative — v6 architecture pass

---

## Summary

DealFlow AI integrates five categories of external SDKs/services: transactional email with event tracking (compliant outreach delivery), LLM provider (AI matching + drafting), deal-source data APIs (target and buyer sourcing), contact-enrichment provider (decision-maker discovery), and platform infrastructure (SuperTokens auth + Railway hosting). All five categories are MVP-required; the specific vendors for deal-source data and contact enrichment are TBD and intentionally abstracted behind pluggable provider interfaces.

SDK research (per `claudomat-brain/rules/external-sdk-integration-rules.md`) runs at P-3 when a wave first integrates any of these SDKs. Per-SDK docs land in `command-center/dev/SDK-Docs/<Name>/` and are auto-linked into task descriptions at P-2 Spec.

---

## Inventory

### 1. Transactional Email + Event Tracking — Resend (candidate)

**Purpose:** Send compliant outreach emails; receive real-time webhook events (opens, clicks, replies, bounces, spam complaints) for pipeline status, audit-log writes, and compliance suppression.

**Auth mechanism:** API key (`RESEND_API_KEY`) — Bearer token in request header. Webhook payloads verified via HMAC-SHA256 signature header (`svix-signature` or provider-equivalent); raw body must be preserved before JSON parsing.

**Rate limits:** Resend free tier: 100 emails/day, 3,000/month. Paid tiers scale per plan. Outreach send queue must enforce per-domain and per-recipient rate limits independently of provider limits. Implement exponential backoff with jitter on `429` responses; surface rate-limit headroom in the outreach send queue worker.

**Error-handling pattern:**
- `4xx` (except 429): non-retryable — log structured error, update outreach record status to `failed`, write audit-log entry, surface to compliance queue.
- `429`: retryable with backoff — requeue with delay calculated from `Retry-After` header if present.
- `5xx`: retryable — exponential backoff, max 3 attempts, then dead-letter.
- Webhook delivery failures: provider retries for up to 72 hours; idempotency key on every webhook processor invocation (dedup on event ID).

**Cost model:** Usage-based per email sent; webhook ingestion is included. Monitor monthly send volume against plan limits. Cost spikes possible on large buyer outreach campaigns — add send-volume guardrails in compliance rules engine before bulk dispatch.

**Deprecation / migration path:** Resend is a candidate; final selection at the SDK research step of the first outreach wave. Pluggable email provider interface (see § Conventions) ensures provider swap without touching call sites. If migrated: swap env vars, update DKIM/SPF/DMARC DNS records for new sending domain identity, rewrite the provider adapter, update `command-center/dev/SDK-Docs/` entry.

**Sending-domain identity:** DKIM, SPF, and DMARC DNS records must be configured for the advisory firm's sending domain before any outreach goes live. This is a prerequisite hard-stop in the outreach feature wave, not an afterthought. Domain verification is tracked via the Admin/Settings module (#19).

---

### 2. LLM Provider — Anthropic API (Claude models)

**Purpose:** Generate buyer-seller match rationale (explainable scoring narrative), AI-assisted outreach draft composition, and scoring assist for the matching engine. Features: #6, #8, #26, #30.

**Auth mechanism:** API key (`ANTHROPIC_API_KEY`) — `x-api-key` header. Never passed through the frontend; all LLM calls originate server-side from NestJS services only.

**Rate limits:** Token-based (TPM) and request-based (RPM) limits per model tier. Matching engine calls can be batched but must respect concurrent request caps. Implement a token-budget guard per request: set `max_tokens` explicitly on every call; never allow unbounded completion. Queue heavy batch operations (e.g., re-scoring entire buyer universe) via background job rather than inline request.

**Error-handling pattern:**
- `401` / `403`: configuration error — alert immediately, do not retry.
- `429`: rate-limit — exponential backoff, surface to job queue retry policy.
- `529` (overloaded): treat as `429`, retry with backoff.
- `5xx`: retry up to 3 times with backoff; on exhaustion, mark the task failed and surface to operator alert.
- All LLM responses are validated against expected output shape (Zod schema) before use; hallucination-guard: rationale text is stored verbatim in the audit log alongside the structured match scores.

**Cost model:** Per-token, per-model. Cost scales with number of active mandates × buyer universe size × re-scoring frequency. Budget controls: cap max tokens per call; throttle re-scoring jobs to off-peak windows; log token consumption per job for cost attribution.

**Deprecation / migration path:** Anthropic SDK for Node.js (`@anthropic-ai/sdk`). Model IDs (e.g. `claude-opus-4-5`) are stored in config (env var or DB settings row), not hardcoded — allows model upgrade without deployment. On SDK major version bump: re-run research, update SDK doc, audit message-format changes (system prompt, tool-use schema, vision payloads).

---

### 3. Deal-Source Data APIs — Pluggable (vendor TBD)

**Purpose:** Source target companies and buyer candidates from external private-company data providers. At least two providers are expected to improve coverage. Features: #1, #3, #5, #24 (sourcing/sync jobs, matching engine inputs).

**Auth mechanism:** Provider-specific (typically API key in header or query param). All credentials in Railway env vars; never in application code.

**Rate limits:** Provider-specific; typically request-per-minute and/or daily-quota limits. The data-ingestion / ETL module enforces per-provider rate-limit budgets. Sync jobs use a leaky-bucket scheduler; quota exhaustion triggers a backoff-and-reschedule rather than silent failure.

**Error-handling pattern:**
- Structured provider error → classify as transient (retry) or permanent (skip record, log provenance fault).
- Provider outage → mark sync job as `degraded`, surface to operator alert, continue with stale data until next successful sync.
- Schema drift (unexpected field absence/type change) → validation layer catches at ingestion boundary; quarantine malformed records to a review queue rather than poisoning the entity store.

**Cost model:** Subscription or per-query pricing (provider-dependent). Track per-provider query count in the ETL job metadata for cost attribution.

**Deprecation / migration path:** Provider interface abstraction (see § Conventions) isolates swap cost to the adapter layer. Vendor selection deferred — see § Risk / open items. SDK doc authored at the wave that integrates the first provider.

---

### 4. Contact-Enrichment Provider — Pluggable (vendor TBD)

**Purpose:** Enrich target company records with decision-maker contacts and verified email addresses for compliant outreach. Features: #3, #5, #9 (enrichment queue, outreach engine inputs).

**Auth mechanism:** Provider-specific API key. All credentials in Railway env vars.

**Rate limits:** Typically per-request or per-month lookup limits. Enrichment queue implements per-provider throttling; deduplication prevents re-enrichment of already-verified records within a freshness window (configurable per provider).

**Error-handling pattern:**
- `404` / no-result: record stored with `enrichment_status: not_found`; not retried until freshness window expires.
- `429` / quota: back off and reschedule; alert if quota exhaustion is sustained.
- Returned contact data validated against expected schema; partial results accepted and flagged with `partial_enrichment: true` provenance marker.

**Cost model:** Per-lookup pricing. Deduplication and freshness-window controls are cost-reduction mechanisms, not just performance — they must be implemented before any bulk enrichment run.

**Deprecation / migration path:** Provider interface abstraction (same pattern as deal-source data). Vendor selection deferred — see § Risk / open items.

---

### 5. SuperTokens (Auth)

**Purpose:** Authentication, session management, JWT issuance + refresh, RBAC token claims for the four roles (advisor / analyst / compliance / admin). Self-hosted Core on Railway with its own Postgres instance; communicates with NestJS backend over Railway private network.

**Auth mechanism:** SuperTokens Core API key (`SUPERTOKENS_API_KEY`) for backend-to-core communication. JWTs issued to clients contain role claims consumed by NestJS guards.

**Rate limits:** Not externally rate-limited (private network); Core throughput is a function of its Railway container resources. Session validation is cached per request lifecycle — do not make redundant Core calls within a single request.

**Error-handling pattern:**
- Core unreachable: return `503` to client; do not cache or serve stale session data.
- Invalid/expired token: return `401`; client redirects to login.
- Role claim mismatch: return `403`; log the access attempt to audit log.

**Cost model:** Self-hosted; Railway container compute cost only. No per-MAU pricing at self-hosted tier.

**Deprecation / migration path:** SuperTokens Node SDK (`supertokens-node`). On major version bump: audit recipe API changes, session-claim format changes, and JWT payload schema. Migration involves coordinated Core + SDK upgrade; plan for session invalidation window.

---

### 6. Railway (Platform)

**Purpose:** Hosting for all services (NestJS API, Next.js frontend, SuperTokens Core, Postgres, Redis/queue workers, Railway Buckets). Deploy target and secrets management plane.

**Auth mechanism:** Railway CLI token (`RAILWAY_TOKEN`) for CI/CD deploys from GitHub Actions. Service-to-service communication uses Railway private network hostnames; no public exposure between internal services.

**Rate limits:** Deploy pipeline: no hard rate limit in normal operation. Railway API: standard REST API limits apply to tooling calls.

**Error-handling pattern:**
- Deploy failure: CI fails the workflow; alert via GitHub Actions notification. Do not proceed with partial deploys.
- Service crash / OOM: Railway restarts automatically; NestJS implements graceful shutdown (`SIGTERM` handler, drain in-flight requests before exit).
- Private network DNS resolution failure: surface as `503` from the calling service; do not swallow.

**Cost model:** Usage-based (compute + egress + storage). Monitor via Railway dashboard. No spend surprises expected at pilot scale; revisit at production launch.

**Deprecation / migration path:** Railway is the declared platform (`project.yaml`). Migration off Railway would require re-platforming all services — a strategic decision, not an SDK swap.

---

## Conventions

### Pluggable Provider Interface (Data Sources + Email)

All external data-provider and email-provider integrations are accessed exclusively through a typed provider interface. No application code calls a provider SDK directly; it calls the interface. This isolates vendor swap cost to the adapter layer.

```
packages/
  integrations/
    providers/
      email/
        IEmailProvider.ts          ← interface: send(), getWebhookEvent()
        ResendAdapter.ts           ← implements IEmailProvider
      data-source/
        IDataSourceProvider.ts     ← interface: search(), getCompany(), listChanges()
        <VendorName>Adapter.ts     ← implements IDataSourceProvider (one file per vendor)
      enrichment/
        IEnrichmentProvider.ts     ← interface: enrichContact(), enrichCompany()
        <VendorName>Adapter.ts     ← implements IEnrichmentProvider
```

- Each interface is defined in `@dealflow/shared` or a dedicated `@dealflow/integrations` package.
- Adapters are registered via NestJS dependency injection; the active adapter is selected by env var (`EMAIL_PROVIDER`, `DATA_SOURCE_PROVIDER`, `ENRICHMENT_PROVIDER`).
- Multi-provider fan-out (querying two data sources and merging results) is the responsibility of the data-ingestion / ETL module, not the adapter.
- Interface contracts are Zod-validated at the adapter boundary; raw provider responses never escape the adapter.

### Webhook Ingestion + Signature Verification

All inbound webhooks (email events, future payment events) follow a single ingestion pattern:

1. **Dedicated NestJS controller** at `/webhooks/<provider>` — no auth middleware on this route (provider authenticates via signature, not session token).
2. **Raw body preservation** — `rawBody: true` on the NestJS app instance; the raw buffer is passed to the signature verifier before any JSON parsing.
3. **Signature verification** — HMAC-SHA256 (or provider equivalent) computed over the raw body using the webhook secret (`RESEND_WEBHOOK_SECRET` / provider-equivalent env var). Verification failures return `400` and are logged with the provider name and timestamp; they do not throw to avoid leaking internals.
4. **Idempotency** — every event carries a provider-issued event ID. The webhook processor checks a `processed_webhook_events` table (or Redis set with TTL) before processing; duplicate delivery is a no-op with `200` response.
5. **Async processing** — after signature verification and idempotency check, the verified payload is enqueued for async processing (email-event webhook processor job). The HTTP handler returns `200` immediately; provider retries are avoided by fast acknowledgement.
6. **Audit trail** — every processed webhook event is written to the append-only audit-log service with provider name, event type, timestamp, and relevant entity IDs.

### Secrets via Railway Env Vars

All SDK credentials and secrets are stored as Railway environment variables. The naming convention:

| Variable | Used by |
|---|---|
| `RESEND_API_KEY` | Email provider adapter |
| `RESEND_WEBHOOK_SECRET` | Webhook signature verification |
| `ANTHROPIC_API_KEY` | LLM provider service |
| `SUPERTOKENS_API_KEY` | NestJS → SuperTokens Core |
| `SUPERTOKENS_CONNECTION_URI` | NestJS → SuperTokens Core private network URL |
| `DATA_SOURCE_PROVIDER` | Selects active data-source adapter |
| `DATA_SOURCE_<VENDOR>_API_KEY` | Per-vendor data-source credential |
| `ENRICHMENT_PROVIDER` | Selects active enrichment adapter |
| `ENRICHMENT_<VENDOR>_API_KEY` | Per-vendor enrichment credential |

- Env vars are set in Railway project settings, not committed.
- `.env.example` lists all required variable names with placeholder values; this file is committed.
- NestJS validates all required env vars on startup via a `ConfigModule` schema (Zod); missing vars crash-fast with a clear error rather than failing silently at runtime.

---

## Reusability Principles

1. **One adapter file per provider per interface.** Never mix provider logic across adapters or inline provider calls in service classes.

2. **Interface contracts are Zod schemas.** Input and output types of every provider interface method have a Zod schema. Adapters validate provider responses against these schemas at the boundary; validation failures are classified as `PROVIDER_CONTRACT_ERROR` and sent to the dead-letter path, not silently swallowed.

3. **All retryable operations use a shared retry utility.** A single `withRetry(fn, policy)` utility (exponential backoff + jitter + max attempts) is used for all SDK call sites; per-SDK retry policies are data (config objects), not duplicated logic.

4. **Provider health is observable.** Each adapter exposes a `healthCheck(): Promise<ProviderHealthStatus>` method. The NestJS health endpoint (`/health`) aggregates all provider health checks. This enables Railway uptime monitors and CI smoke tests to catch misconfigured credentials before they surface in production outreach flows.

5. **SDK version pins are explicit.** Every SDK is pinned to an exact version in `package.json` (no `^` or `~` for production deps). Upgrades are deliberate, researched (per `external-sdk-integration-rules.md`), and tested before merge.

6. **LLM prompts are versioned assets.** Prompt templates for matching rationale and outreach drafting are stored in `packages/ai/prompts/` as TypeScript template functions (not inline strings). Each prompt function includes the model it was tested against as a JSDoc `@testedWith` tag. Prompt changes follow the same review process as code changes.

---

## Cross-references

- **Outreach service** (`command-center/dev/architecture/modules.md` § Outreach engine): consumes email provider interface for send + tracks webhook events for pipeline status.
- **Data ingestion / ETL service** (`command-center/dev/architecture/modules.md` § Data ingestion / ETL): consumes data-source provider interface; drives sourcing/sync jobs.
- **Dedupe + enrichment engine** (`command-center/dev/architecture/modules.md` § Dedupe & enrichment engine): consumes enrichment provider interface; drives enrichment queue.
- **Security — webhook verification** (`command-center/dev/architecture/security.md`): webhook signature verification is a security control; the raw-body pattern and HMAC verification steps documented in § Conventions above are normative for the security architecture.
- **Audit-log service** (`command-center/dev/architecture/modules.md` § Audit-log service): every SDK-sourced event (email status change, data sync result, LLM match rationale) that has compliance relevance writes a provenance entry to the append-only audit log; the `source_provider` column carries the adapter name for chain-of-custody.
- **Databases — provenance** (`command-center/dev/architecture/databases.md`): enriched company and contact records carry `source_provider` and `enriched_at` columns; LLM rationale is stored verbatim alongside structured match scores; webhook event IDs are stored for idempotency.
- **DevOps — secrets** (`command-center/dev/architecture/devops.md`): Railway env var injection is the sole mechanism for SDK credentials; CI environment uses Railway's environment-specific variable sets.

---

## Stack-specific Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Email provider | Resend (candidate; final at SDK research step) | Webhook-first API design, DKIM/SPF/DMARC domain verification built-in, Node.js SDK with TypeScript types, straightforward HMAC webhook signature model. |
| LLM provider | Anthropic API (Claude models) | Explicitly required by stack-decisions.md; latest Claude models for matching rationale + drafting. |
| Data-source vendors | TBD; at least 2 providers | Coverage diversification; pluggable interface defers vendor lock-in. |
| Enrichment vendor | TBD | Pluggable interface defers vendor lock-in. |
| SDK call location | Server-side NestJS only | API keys never touch the frontend or browser. |
| Prompt storage | `packages/ai/prompts/` versioned TypeScript templates | Enables review, testing, and model-version tracking without runtime string construction. |
| Webhook raw body | `rawBody: true` on NestJS app | Required for HMAC signature verification before JSON parsing; must be configured at app bootstrap, not per-route. |
| Retry utility | Shared `withRetry` | Prevents per-SDK retry logic drift; policies are config objects. |
| Env var validation | Zod schema in `ConfigModule` at startup | Crash-fast on misconfiguration; prevents silent runtime failures from missing credentials. |

---

## Risk / Open Items

1. **Deal-source data vendor selection is pending.** Two or more providers are required; candidates must be evaluated for coverage of private-company M&A target profiles, API quality, rate-limit headroom, and cost per query. Vendor selection is a spend-commitment decision — surfaces to founder via product-decisions process before the first sourcing wave contracts anything. Per `external-sdk-integration-rules.md`, the research process (spawn `research-analyst`, literal-boundary audit, SDK doc authoring) runs at P-3 of the first sourcing-integration wave.

2. **Contact-enrichment vendor selection is pending.** Same process as above. Must be evaluated for verified-email accuracy (compliance-critical: sending to unverified contacts carries regulatory risk in M&A outreach) and GDPR/CCPA data-handling posture.

3. **Per-SDK docs are not yet authored.** Each SDK listed in this inventory requires a full SDK doc at `command-center/dev/SDK-Docs/<Name>/<name>.md` before the integration wave that first installs it. The research process in `external-sdk-integration-rules.md` governs doc authoring — do not implement before the doc exists.

4. **SDK registry is not yet populated.** `command-center/dev/SDK-Docs/registry.md` should be initialized and rows added as each SDK doc is authored. The registry is the lookup table for P-3 freshness checks.

5. **Webhook secret rotation procedure is not yet defined.** RESEND_WEBHOOK_SECRET (and equivalents) must have a documented rotation procedure before production launch — rotation requires coordinated update of Railway env var and provider webhook endpoint config with zero dropped events during the transition.

6. **LLM token-budget and cost controls need quantification.** Per-request `max_tokens` caps and per-wave batch-job token budgets should be sized against the expected mandate count and buyer universe size before the matching-engine wave ships.

7. **SuperTokens Core upgrade path.** SuperTokens self-hosted Core has its own versioning cadence separate from the Node SDK. A minor version drift between Core and SDK can cause silent auth failures. Establish a policy for keeping them in sync (matching major.minor) and document in the SuperTokens SDK doc when authored.
