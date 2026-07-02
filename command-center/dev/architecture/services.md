# Services Architecture

> Branch: Services
> Author: backend-developer agent
> Date: 2026-06-29
> Status: draft (v6 snapshot)
> Stack: Turborepo/pnpm · NestJS · Next.js 15 · Postgres + Drizzle · SuperTokens · Railway · BullMQ (Redis-backed)

---

## Summary

DealFlow AI's backend is a **NestJS modular monolith** (`apps/api`) deployed as a single Railway service at MVP, with a **separate background-worker process** (`apps/worker`) sharing the same codebase but running only BullMQ job processors. No microservices split at MVP — inter-module communication is in-process (injected services + `EventEmitter2` events). The worker is a separate Railway service that connects to the same Postgres and Redis instances.

The API surface exposes **versioned REST endpoints** (`/api/v1/...`) aligned with the 20 product screens. There are no GraphQL or gRPC surfaces at MVP. Server-Sent Events (SSE) replace Socket.IO for live notification streaming; Socket.IO is deferred to a post-MVP evaluation.

Twelve NestJS modules carry the product: **auth/RBAC, mandates, ingestion, dedupe/enrichment, buyer-universe, matching, templates/outreach, compliance, audit-log, pipeline, notifications, admin**. A `jobs` infrastructure module registers all BullMQ queues and is imported by the modules that own job logic. Shared contracts live in `packages/shared` (Zod schemas → NestJS DTOs + frontend form validators).

The compliance wedge — audit-log, compliance rules engine, and outreach compliance gate — is **H1 production-grade**, not stubbed. It is the product's differentiating feature and is designed as a non-bypassable control path, not a layer that can be skipped by configuration or role.

---

## Inventory

### NestJS service / module boundaries

---

#### 1. Auth / RBAC module

Location: `apps/api/src/modules/auth/`
Horizon: MVP (H1)

Responsibilities:
- SuperTokens Core integration: session verification, JWT guard, refresh-token handling
- Invite-only user creation flow (Admin creates invite → single-use tokenized link → invitee sets password)
- RBAC enforcement: `RolesGuard` registered as a global `APP_GUARD`; `@Roles(...)` decorator on every controller method
- Role claim re-verification per request against the canonical `users.role` DB column — mitigates stale-token privilege escalation
- Password reset via SuperTokens reset-token flow
- Auth event emission to Audit-log (login success/failure, role change, invite issued, session revoke)

Public contract:
- `CurrentUser` decorator: resolves `{ userId, role, workspaceId }` from verified session
- `RolesGuard` + `@Roles(Role.X)` decorator — applied to all controller methods; default-deny
- `AuthService`: `createInvite(email, role)`, `acceptInvite(token, password)`, `resetPassword(token)`, `listUsers()`, `updateUserRole(userId, role)`
- `UserRepository` (Drizzle): CRUD on `users` table

Interactions:
- Calls SuperTokens Core over Railway private network
- Emits `AuthEvent` to Audit-log module
- All other modules consume `CurrentUser` and `RolesGuard` from this module

---

#### 2. Mandates module

Location: `apps/api/src/modules/mandates/`
Horizon: MVP (H1)

Responsibilities:
- Sell-side engagement CRUD: seller profile, buyer criteria (sector, geography, EBITDA range, deal type), status lifecycle
- Compliance profile management per mandate: jurisdiction codes, required disclaimer refs, `requires_approval` flag
- Mandate archival (soft delete, all child records retained)
- Optimistic locking on update (`version` column) to guard concurrent advisor edits
- Mandate lifecycle audit events emitted on create/update/archive

Public contract:
- `MandateService`: `createMandate()`, `updateMandate()`, `getMandate(id)`, `listMandates(filters)`, `archiveMandate()`
- `MandateRepository` (Drizzle): `mandates`, `mandate_criteria`, `mandate_compliance_profiles` tables
- Zod schemas in `packages/shared`: `CreateMandateSchema`, `UpdateMandateSchema`, `MandateResponseSchema`

Interactions:
- Consumed by: Matching module (mandate criteria), Outreach module (mandate context for templates), Compliance module (compliance profile drives gate config), Pipeline module (mandate scope for deals)
- Emits `MandateCreatedEvent`, `MandateUpdatedEvent`, `MandateArchivedEvent` to Audit-log

---

#### 3. Data ingestion / ETL module

Location: `apps/api/src/modules/ingestion/`
Horizon: MVP (H1)

Responsibilities:
- Multi-source company data pull via a pluggable adapter pattern (`DataSourceAdapter` interface — one class per provider)
- Scheduled sync via BullMQ `SourceSyncJob` (cron per configured source) and manual Admin-triggered sync
- Idempotent upsert to `raw_companies` staging table (`(source_id, external_id)` unique key)
- Per-adapter rate limiting (adapter-internal throttle config, not global)
- Credential decryption at job time — reads from `admin_data_sources` (encrypted); never returns plaintext

Public contract:
- `IngestionService`: `syncSource(sourceId)`, `listSources()`, `getSyncStatus(sourceId)`
- `IngestionJobProducer`: enqueues `SourceSyncJob` for background processing

Interactions:
- Reads encrypted credentials from `admin_data_sources` (owned by Admin module)
- Writes raw records to `raw_companies` staging table consumed by Dedupe/Enrichment module
- Enqueues `EnrichmentJob` per new raw record
- Emits sync-result events to Notification module
- Emits ingestion events to Audit-log

---

#### 4. Dedupe / Enrichment module

Location: `apps/api/src/modules/dedupe/`
Horizon: MVP (H1)

Responsibilities:
- Entity resolution from `raw_companies` to canonical `companies` + `contacts` records
- Deterministic match (normalized name + domain) followed by configurable fuzzy-score threshold
- Non-destructive merge: merged-from records are soft-deleted with `merged_into_id` FK; merge history preserved
- Async enrichment via BullMQ `EnrichmentJob`: calls contact enrichment provider, writes verified contact data with provenance metadata
- Field-level provenance tracking: `source`, `enriched_at`, `enrichment_provider` on every enriched field

Public contract:
- `DedupeService`: `resolveEntity(rawRecord)`, `mergeCompanies(sourceId, targetId)`, `getCompany(id)`, `listCompanies(filters)`
- `EnrichmentService`: `enrich(companyId)`, `getEnrichmentStatus(companyId)`
- `GET /companies/:id/enrichment-status` for UI polling

Interactions:
- Consumes `raw_companies` (from Ingestion module)
- Writes canonical records to `companies` + `contacts` tables (consumed by Buyer-universe, Matching, Outreach modules)
- Calls contact enrichment provider adapter
- Emits dedupe/enrichment events to Audit-log

---

#### 5. Buyer-universe module

Location: `apps/api/src/modules/buyer-universe/`
Horizon: MVP (H1)

Responsibilities:
- Analyst-curated candidate buyer list per mandate: filter `companies` by criteria, add/remove companies, track inclusion status
- Buyer-universe snapshots: point-in-time snapshots for audit and export
- Enrichment-status surfacing per entry (passes through from Dedupe/Enrichment module)

Public contract:
- `BuyerUniverseService`: `buildUniverse(mandateId, filters)`, `addEntry(mandateId, companyId)`, `removeEntry(mandateId, companyId)`, `getUniverse(mandateId)`, `snapshotUniverse(mandateId)`
- `BuyerUniverseRepository` (Drizzle): `buyer_universe_entries`, `buyer_universe_snapshots` tables

Interactions:
- Reads `companies` records (via DedupeService)
- Reads mandate criteria (via MandateService) to seed initial filter
- Provides universe to Matching module for `runMatch()`
- Emits snapshot events to Audit-log

---

#### 6. Matching module

Location: `apps/api/src/modules/matching/`
Horizon: MVP (H1)

Responsibilities:
- Two-pass buyer-seller ranking: deterministic rule-based pre-score (sector, size, geography fit) then LLM rationale + score refinement for top-N candidates (configurable, default 50)
- Async execution via BullMQ `MatchingJob`; match run status queryable at `GET /mandates/:id/match-run/status`
- Structured LLM output: `{ score: 0-100, rationale: string, flags: string[] }` parsed and Zod-validated before storage
- Match results are immutable after finalization — advisor shortlists/rejects individual buyers; re-run creates a new `match_runs` row
- Advisor accept/reject/flag decisions stored in `match_reviews` (feeds H2 feedback loop)

Public contract:
- `MatchingService`: `runMatch(mandateId)`, `getMatchResults(mandateId)`, `shortlistBuyer(matchId)`, `rejectBuyer(matchId)`, `flagBuyer(matchId, reason)`
- Response types: `MatchRunDto`, `MatchResultDto` (includes score, rationale, rank, advisor decision)

Interactions:
- Consumes mandate criteria (MandateService) and buyer universe (BuyerUniverseService)
- Calls LLM provider adapter (Claude) for rationale generation
- Emits `BuyerShortlistedEvent` consumed by Pipeline module
- Emits `MatchRunCompletedEvent` consumed by Notification module
- Emits match decision events to Audit-log

---

#### 7. Templates module

Location: `apps/api/src/modules/templates/`
Horizon: MVP (H1)

Responsibilities:
- Outreach template library: create/update/delete templates with merge-field schema and required compliance block declarations
- Template rendering with merge-var substitution; merge-field validation at render time (missing required fields are a hard error)
- AI-assisted drafting: inline LLM call during template editing, returns a draft for the user to edit — not auto-sent; LLM output treated as untrusted text (no `dangerouslySetInnerHTML`)
- `required_compliance_blocks` field: list of compliance rule IDs whose disclaimer text must be present in rendered output; checked at render time

Public contract:
- `TemplateService`: `createTemplate()`, `updateTemplate()`, `deleteTemplate()`, `renderTemplate(templateId, mergeVars)`, `listTemplates()`, `aiDraftTemplate(prompt)`
- `TemplateRepository` (Drizzle): `outreach_templates` table
- Zod schema: `CreateTemplateSchema`, `TemplateResponseSchema`

Interactions:
- Consumed by Outreach module (render at send time)
- Calls LLM provider adapter for AI drafting (inline, not async)
- Template render failures (missing merge vars, missing compliance block) surface as 422 with structured errors

---

#### 8. Outreach module

Location: `apps/api/src/modules/outreach/`
Horizon: MVP (H1)

Responsibilities:
- Campaign creation: link shortlisted buyers to a template, generate per-recipient personalized messages
- Pre-send compliance gate: synchronous blocking call to Compliance module `checkPreSend()` before any send job is enqueued — `ComplianceBlockedException` if gate returns `blocked` or `pending_review`
- Async send via BullMQ `OutreachSendJob`; rate-limited per sending domain (configurable sends/hour via BullMQ rate limiter)
- Webhook processor: ingests email-provider events (opened, clicked, replied, bounced, unsubscribed) from HTTP endpoint, enqueues `EmailEventWebhookJob` for async processing
- Bounce/unsubscribe events automatically feed compliance suppression list (via ComplianceService)
- Reply detection: `replied` event sets `outreach_messages.replied_at`, triggers pipeline stage-advance suggestion in UI

Public contract:
- `OutreachService`: `createCampaign(mandateId, payload)`, `sendCampaign(campaignId)`, `getCampaignStatus(campaignId)`, `getMessageStatus(messageId)`
- `WebhookProcessorService`: `ingestEmailEvent(event)` (called from webhook controller after HMAC signature verification)
- Response types: `CampaignDto`, `MessageStatusDto`

Interactions:
- Calls `ComplianceService.checkPreSend()` synchronously — no send proceeds without this
- Calls `TemplateService.renderTemplate()` at campaign creation
- Calls email provider adapter for send
- Emits outreach events (sent, opened, replied, bounced) to Audit-log and Pipeline modules
- Emits `OutreachStatusUpdatedEvent` to Notification module
- Suppression list updates flow back to Compliance module

---

#### 9. Compliance module

Location: `apps/api/src/modules/compliance/`
Horizon: MVP (H1) — compliance-first core

Responsibilities:
- Pre-send gate: synchronous `checkPreSend()` evaluates suppression list, required disclaimers, and approval-gate policy; returns `GateResult` with verdict and structured violation list
- Suppression/blocklist management: every recipient email and company domain checked against `suppression_list` table before send; match = hard block
- Disclaimer enforcement: checks rendered template content for required disclaimer text (by rule ID)
- Approval workflow: campaigns requiring manual review enter `compliance_queue` as `pending`; compliance officer approves or rejects with reason
- Rule management: create/update/disable compliance rules (suppression entries, disclaimer templates, approval-gate configs per jurisdiction)
- Rule change audit events emitted on every rule mutation

Public contract:
- `ComplianceService`: `checkPreSend(payload): Promise<GateResult>`, `submitForApproval(campaignId)`, `approveOutreach(campaignId, reviewerId)`, `rejectOutreach(campaignId, reviewerId, reason)`, `listQueue(filters)`, `upsertRule(rule)`, `listRules()`, `addToSuppressionList(entry)`, `removeFromSuppressionList(entry)`
- `GateResult`: `{ verdict: 'approved' | 'blocked' | 'pending_review', violations: ComplianceViolation[] }`
- `ComplianceViolation`: `{ type: 'suppression_hit' | 'missing_disclaimer' | 'requires_approval', detail: string }`
- `ComplianceRepository` (Drizzle): `compliance_rules`, `suppression_list`, `compliance_queue` tables

Interactions:
- Called synchronously by Outreach module before every send (non-bypassable)
- Receives suppression list updates from Outreach module (bounce/unsubscribe events)
- Reads mandate compliance profile (via MandateService) to determine gate config
- Emits compliance events (approval, rejection, rule change) to Audit-log
- Emits `ComplianceQueueItemAddedEvent` to Notification module

---

#### 10. Audit-log module

Location: `apps/api/src/modules/audit-log/`
Horizon: MVP (H1) — compliance-first core

Responsibilities:
- Append-only, tamper-evident event store for all material application events
- SHA-256 hash chain: each row's `content_hash = SHA-256(prev_hash || timestamp || actor_id || event_type || entity_id || payload_json)`; tampering any row breaks the chain
- Single write path: all modules call `AuditLogService.record(event)` — no module writes to `audit_log_entries` directly; the table has `INSERT`-only grants for the `audit_writer` DB role
- Integrity verification job (`AuditIntegrityJob`): nightly hash-chain verification, result written to `audit_integrity_checks` table
- Scoped query interface: compliance role can query all; advisor role queries their own mandate events; analyst role cannot query

Public contract:
- `AuditLogService`: `record(event: AuditEvent): Promise<void>`, `query(filters: AuditQueryFilters): Promise<AuditLogEntry[]>`, `verifyIntegrity(range): Promise<IntegrityReport>`
- `AuditEvent` discriminated union in `packages/shared`: `AuthEvent | MandateEvent | MatchDecisionEvent | OutreachEvent | ComplianceEvent | ExportEvent | PipelineEvent`
- `audit_log_entries` table: `(id, timestamp, actor_id, actor_role, event_type, entity_type, entity_id, payload_json, content_hash, prev_hash, chain_sequence)`

Interactions:
- Pure consumer of events from every other module — no outgoing calls to other modules
- Write path: called synchronously by all modules via `record()` (synchronous `@OnEvent()` handler ensures write before response returns)
- Read path: consumed by Compliance module (query for compliance review) and Recordkeeping module (export)
- Integrity job writes to `audit_integrity_checks` table

---

#### 11. Pipeline module

Location: `apps/api/src/modules/pipeline/`
Horizon: MVP (H1)

Responsibilities:
- Deal record lifecycle: created automatically on `BuyerShortlistedEvent`; advanced through stages by advisor
- Stage enum: `shortlisted | contacted | engaged | diligence | offer | closed | withdrawn`
- Notes (append-only at application layer) and next-action scheduling per deal
- Outreach reply event triggers a "move to engaged?" suggestion surfaced in UI — not an automatic advance

Public contract:
- `PipelineService`: `getBoard(mandateId)`, `advanceStage(dealId, stage)`, `addNote(dealId, note)`, `setNextAction(dealId, action)`, `listDeals(filters)`
- `PipelineRepository` (Drizzle): `deals` table
- Event handlers: `@OnEvent('buyer.shortlisted')`, `@OnEvent('outreach.replied')`

Interactions:
- Listens to `BuyerShortlistedEvent` (Matching module) to auto-create deal records
- Listens to `OutreachRepliedEvent` (Outreach module) to surface stage-advance suggestion
- Emits `DealStageChangedEvent` to Audit-log and Notification modules

---

#### 12. Notifications module

Location: `apps/api/src/modules/notifications/`
Horizon: MVP (H1)

Responsibilities:
- Pure domain-event consumer: listens to events from all other modules, writes to `notifications` table, and sends email alerts via the email provider's system sender identity (separate from the outreach sending domain)
- In-app delivery via SSE at `GET /notifications/stream` (Socket.IO deferred)
- Per-user notification preferences: email alerts can be opted out per type; in-app delivery always on
- Fan-out: events broadcast to all users of the relevant role unless `target_user_id` is set on the event

Public contract:
- `NotificationService`: `notify(event: DomainEvent): Promise<void>`
- `GET /api/v1/notifications` — paginated notification feed (cursor-based)
- `POST /api/v1/notifications/:id/read` — mark as read
- `GET /api/v1/notifications/stream` — SSE stream

Interactions:
- Listens to: `MatchRunCompletedEvent`, `OutreachStatusUpdatedEvent`, `ComplianceQueueItemAddedEvent`, `DealStageChangedEvent`, `SyncCompletedEvent`, `ExportReadyEvent`, `AuditIntegrityFailedEvent`
- Calls email provider adapter for system alert emails (separate from outreach campaigns)
- Reads `notification_preferences` table; writes `notifications` table

---

#### 13. Admin module

Location: `apps/api/src/modules/admin/`
Horizon: MVP (H1)

Responsibilities:
- Data-source connection management: create/update/delete provider connections; credentials encrypted at rest (`pgcrypto` + `DATA_SOURCE_ENCRYPTION_KEY`); plaintext never returned in API responses (masked tokens only)
- Workspace settings: firm profile, logo, verified sending domain, default compliance profile
- Sending-domain verification: triggers real-time check with email provider domain verification API; status stored in `workspace_settings.domain_verified`
- User management delegated to Auth module (`createInvite`, `updateUserRole`, `listUsers`, `deactivateUser`)

Public contract:
- `AdminService`: `createDataSource(payload)`, `updateDataSource(id, payload)`, `deleteDataSource(id)`, `listDataSources()`, `getWorkspaceSettings()`, `updateWorkspaceSettings(payload)`, `verifySendingDomain(domain)`
- `AdminRepository` (Drizzle): `admin_data_sources`, `workspace_settings` tables

Interactions:
- Credentials read by Ingestion module at job time (decrypt and use; Admin module retains write ownership)
- Sending domain status read by Outreach module to validate the send identity
- Emits admin events (data source added/removed, domain verified) to Audit-log

---

### Background worker process

Location: `apps/worker/` (separate Railway service, shares codebase via Turborepo internal packages)
Horizon: MVP (H1)

The worker process boots a minimal NestJS application that imports only the modules whose job processors it needs. It shares `packages/shared` (Zod schemas), `packages/db` (Drizzle schema + DB client), and the provider adapter implementations. It does not expose HTTP routes.

| Job | Queue | Schedule / Trigger | Idempotent | Owning module |
|---|---|---|---|---|
| `SourceSyncJob` | `ingestion` | Cron per source (configurable in DB) | Yes — upsert on `(source_id, external_id)` | Ingestion |
| `EnrichmentJob` | `enrichment` | Enqueued by ingestion on new raw record | Yes — skip if `enriched_at` is recent | Dedupe/Enrichment |
| `OutreachSendJob` | `outreach-send` | Triggered by `sendCampaign()` after gate approval | Yes — idempotency key per message | Outreach |
| `EmailEventWebhookJob` | `email-events` | HTTP webhook from email provider → enqueue | Yes — dedupe on provider event ID | Outreach |
| `AuditIntegrityJob` | `audit-integrity` | Nightly cron | Yes — new `audit_integrity_checks` row | Audit-log |
| `ExportJob` | `export` | Triggered by `requestExport()` | Yes — export job per job ID | Recordkeeping |
| `MatchingJob` | `matching` | Triggered by `runMatch()` | Yes — run status guards duplicate execution | Matching |

Worker reliability:
- Redis connection via `REDIS_URL` env var with BullMQ auto-reconnect
- Per-queue dead-letter queue (`*-dlq`): `attempts: 3`, exponential backoff starting at 5s
- Every job processor emits structured log entries: `{ job_id, queue, attempt, duration_ms, status }`
- Prometheus metrics exposed at worker's internal `/metrics` endpoint (not public)

---

### API surface — REST resources by screen

All endpoints under `/api/v1/`. Auth required on all routes unless noted. Role enforcement via `@Roles()` decorator.

| Screen | Primary endpoint(s) | Roles |
|---|---|---|
| 1. Login / Invite accept | `POST /auth/signin`, `POST /auth/accept-invite`, `POST /auth/reset-password` | Public |
| 2. Dashboard | `GET /dashboard` (aggregated counts: mandates, pipeline, compliance queue, outreach stats) | All |
| 3. Mandates list | `GET /mandates?page=&limit=&status=` (cursor paginated) | advisor, analyst |
| 4. Mandate detail | `GET /mandates/:id`, `PATCH /mandates/:id`, `DELETE /mandates/:id` | advisor |
| 5. New mandate | `POST /mandates` | advisor |
| 6. Sourcing / company data | `GET /companies?page=&limit=&filters=`, `GET /companies/:id`, `GET /companies/:id/enrichment-status` | analyst, advisor |
| 7. Buyer universe builder | `GET /mandates/:id/buyer-universe`, `POST /mandates/:id/buyer-universe/entries`, `DELETE /mandates/:id/buyer-universe/entries/:companyId`, `POST /mandates/:id/buyer-universe/snapshot` | analyst, advisor |
| 8. Matching — run + status | `POST /mandates/:id/match-run`, `GET /mandates/:id/match-run/status` | analyst, advisor |
| 9. Matching — results | `GET /mandates/:id/match-results?page=&limit=`, `PATCH /match-results/:id` (shortlist/reject/flag) | advisor |
| 10. Outreach composer | `POST /mandates/:id/campaigns`, `POST /campaigns/:id/send`, `GET /campaigns/:id/status` | advisor |
| 11. Outreach status | `GET /campaigns/:id/messages?page=&limit=`, `GET /campaigns/:id/messages/:messageId` | advisor, analyst |
| 12. Pipeline board | `GET /mandates/:id/pipeline`, `PATCH /deals/:id/stage`, `POST /deals/:id/notes`, `PATCH /deals/:id/next-action` | advisor (write), analyst + compliance (read) |
| 13. Template library | `GET /templates`, `POST /templates`, `PATCH /templates/:id`, `DELETE /templates/:id`, `POST /templates/:id/render` | analyst, advisor |
| 14. AI draft template | `POST /templates/ai-draft` | analyst, advisor |
| 15. Compliance queue | `GET /compliance/queue?page=&limit=&status=`, `POST /compliance/queue/:campaignId/approve`, `POST /compliance/queue/:campaignId/reject` | compliance |
| 16. Compliance rules | `GET /compliance/rules`, `POST /compliance/rules`, `PATCH /compliance/rules/:id`, `GET /compliance/suppression-list`, `POST /compliance/suppression-list`, `DELETE /compliance/suppression-list/:id` | compliance |
| 17. Audit log | `GET /audit-log?page=&limit=&filters=`, `GET /audit-log/:id`, `POST /audit-log/verify-integrity` | compliance (full), advisor (own mandate events) |
| 18. Recordkeeping export | `POST /exports`, `GET /exports/:jobId/status`, `GET /exports/:jobId/download` | compliance |
| 19. Admin — data sources | `GET /admin/data-sources`, `POST /admin/data-sources`, `PATCH /admin/data-sources/:id`, `DELETE /admin/data-sources/:id`, `POST /admin/data-sources/:id/sync` | admin |
| 20. Admin — users + workspace | `GET /admin/users`, `POST /admin/users/invite`, `PATCH /admin/users/:id/role`, `DELETE /admin/users/:id`, `GET /admin/workspace`, `PATCH /admin/workspace`, `POST /admin/workspace/verify-domain` | admin |
| Live stream | `GET /notifications/stream` (SSE) | All |
| Notifications | `GET /notifications?page=&limit=`, `POST /notifications/:id/read` | All |
| Webhooks (inbound) | `POST /webhooks/email-events` (HMAC-verified, public) | — |

All list endpoints use **cursor-based pagination** with `limit` (max 100) and `cursor` query params. `GET` requests carry the cursor in query string; response includes `{ data: [], nextCursor: string | null, total: number }`.

HTTP status codes:
- `200` — successful read
- `201` — resource created
- `204` — successful delete / action with no response body
- `400` — validation error (Zod parse failure; structured field-level errors)
- `401` — unauthenticated
- `403` — authenticated but insufficient role
- `404` — resource not found (no existence leakage across role boundaries)
- `409` — optimistic lock conflict (mandate update version mismatch)
- `422` — business logic error (compliance block, merge validation failure, missing merge vars)
- `429` — rate limit exceeded
- `500` — unexpected server error (sanitized message; no stack traces in production)

---

## Conventions

### NestJS module structure

Every backend module follows this directory layout:

```
apps/api/src/modules/<module-name>/
  <module-name>.module.ts          — @Module() declaration; imports + exports
  <module-name>.controller.ts      — HTTP route handlers; @UseGuards applied via global APP_GUARD
  <module-name>.service.ts         — business logic; injected by controller and event handlers
  <module-name>.repository.ts      — Drizzle queries only; injected by service, never exported
  <module-name>.events.ts          — domain event class definitions (if module emits events)
  dto/
    create-<entity>.dto.ts         — created with createZodDto(CreateEntitySchema) from @anatine/zod-nestjs
    update-<entity>.dto.ts
    <entity>-response.dto.ts
  providers/                       — external adapter implementations (email, LLM, data-source, enrichment)
  __tests__/
    <module-name>.service.spec.ts
    <module-name>.controller.spec.ts
    <module-name>.repository.spec.ts  — integration test; uses TEST_DATABASE_URL
```

Rules:
- No service file may import directly from another module's repository. Cross-module data access is always via the owning module's exported service.
- If a circular dependency arises between two modules (A needs B, B needs A), extract the shared logic to `packages/shared` or decouple via NestJS `EventEmitter2` events.
- Repositories are never exported from `@Module({ exports: [] })`. Only service classes are exported.

### DTOs via @anatine/zod-nestjs

All request and response shapes are Zod schemas authored in `packages/shared/src/schemas/`. NestJS DTOs are generated with `createZodDto(schema)` — no manually maintained class-validator decorators. Frontend forms import the same schema as the `zodResolver` argument. This guarantees the server and client validate the same contract; schema drift is a compile-time error.

Global `ValidationPipe` configuration:
```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}))
```

Unknown keys in request bodies are stripped and logged (whitelist mode); requests with explicitly non-whitelisted keys are rejected with 400.

### API versioning policy

All routes are prefixed `/api/v1/`. The version is a URL prefix (not a header or query param) — it is visible, cacheable, and unambiguous. Breaking changes to an endpoint require a new version prefix (`/api/v2/`) and a deprecation notice in the OpenAPI spec for the v1 endpoint. At MVP there is only v1; no v2 infrastructure is scaffolded until needed.

Non-breaking additions (new optional fields, new endpoints in the same resource) do not require a version bump. The OpenAPI spec is the source of truth; it is generated from NestJS decorators via `@nestjs/swagger` + the Zod bridge.

### Error handling

All controllers are wrapped by a global `HttpExceptionFilter` that normalizes every error response to:

```json
{
  "statusCode": 422,
  "error": "COMPLIANCE_BLOCKED",
  "message": "Pre-send compliance check failed",
  "violations": [
    { "type": "suppression_hit", "detail": "contact@example.com is on suppression list" }
  ]
}
```

Error codes are defined in `packages/shared/src/constants/error-codes.ts`. Internal error details (stack traces, DB query text, env var names) are never included in production responses. Structured errors are logged with a correlation ID (`x-correlation-id` header, generated per request if not provided by a load balancer).

### Inter-service / internal-module communication

**In-process modules (the norm):** All twelve modules run in the same NestJS process. Cross-module calls use injected services exported from `@Module()`. This is synchronous and typed.

**Domain events (decoupled fan-out):** When multiple modules need to react to one module's state change, the originating module emits a `DomainEvent` via `EventEmitter2`. Consumers register `@OnEvent()` handlers. Examples: Pipeline module handles `BuyerShortlistedEvent`; Notification module handles every domain event. The audit log handles all events via synchronous `@OnEvent()` handlers so the audit write completes before the originating request returns.

**Background worker (out-of-process):** The worker process shares the same Postgres and Redis instances. It does not expose HTTP. Inter-process communication is solely through the shared DB state and BullMQ queues. The API enqueues jobs; the worker processes them and updates job status rows in Postgres. The UI polls job status via the API's `GET .../status` endpoints — no direct API-to-worker HTTP calls.

**Email webhooks (inbound async):** The email provider calls `POST /webhooks/email-events`. The controller verifies the HMAC signature (using `EMAIL_WEBHOOK_SECRET` env var), validates the payload with Zod, then enqueues an `EmailEventWebhookJob` for the worker. This decouples webhook acknowledgment (fast 200 response) from event processing (retryable async job).

---

## Reusability principles

1. **Single schema source.** Zod schemas in `packages/shared` are the single source of truth for every data shape — NestJS DTOs, frontend form validators, API response types, and test data factories all derive from the same definition. Compile-time propagation of changes; no runtime schema drift.

2. **Domain events over direct calls for fan-out.** Modules that react to another module's state change consume `EventEmitter2` events, not direct service imports. This keeps the module dependency graph acyclic and allows new consumers to be added without modifying the emitting module.

3. **Guards are cross-cutting, not per-controller.** `RolesGuard` is registered as a global `APP_GUARD`. Controllers declare `@Roles()` metadata. Default-deny — every endpoint requires an explicit `@Roles()` decorator or `@Public()` opt-out. This makes authorization omissions a compile-time linting concern, not a runtime oversight.

4. **Compliance is synchronous and blocking.** `OutreachService.sendCampaign()` calls `ComplianceService.checkPreSend()` synchronously before enqueuing any send job. Async pre-send check would introduce a race where sends could slip through during a check lag. Compliance is architecturally non-bypassable.

5. **Audit log is a write-only bus for all other modules.** Every module writes to audit log via `AuditLogService.record()`. No module reads from it except Compliance (query for review) and Recordkeeping (export). The audit log module imports no other module — all dependency arrows point inward.

6. **Background jobs are fire-and-query, not fire-and-forget.** Every job enqueue is preceded by writing a status record to a `*_jobs` or status column in Postgres. UI can always query current job state via the API without coupling to queue internals.

7. **Adapter pattern for all external providers.** Every external provider (data source, enrichment, email, LLM) is accessed via an interface defined in `packages/shared`. Concrete adapter classes live in the `providers/` subdirectory of the consuming module. Swapping a provider means swapping the adapter class — no business logic changes.

8. **UI primitives are domain-agnostic.** Shared frontend components (`DataTable`, `StatusBadge`, `Modal`) accept generic props. Domain-specific variants (`AuditLogTable`, `MatchRationaleDrawer`, `ComplianceBlockBanner`) are thin wrappers. Business logic never lives in shared primitives.

---

## Cross-references

| Branch | File | What this branch depends on |
|---|---|---|
| Modules | `command-center/dev/architecture/modules.md` | Module directory layout, frontend module structure, shared package structure, reusability principles — this file deepens and extends those definitions with API surface and inter-process topology |
| Databases | `command-center/dev/architecture/databases.md` | All table names, schema boundaries, Drizzle migration approach, `audit_writer` DB role, `pgcrypto` encryption — referenced throughout Inventory section |
| Security | `command-center/dev/architecture/security.md` | SuperTokens auth flow, RBAC enforcement model, session management, HMAC webhook verification, secrets handling, `audit_writer` append-only grant — referenced in Auth module, Audit-log module, Compliance module, Webhook processor |
| SDK docs | `command-center/dev/SDK-Docs/` | Concrete adapter implementations for: email provider (Outreach + Notifications), LLM provider (Matching + Templates), data-source providers (Ingestion), enrichment provider (Dedupe) — adapters are defined here; SDK docs supply concrete configuration |
| Feature list | `command-center/product/feature-list.md` | H1 / H2 horizon tags on every module — compliance features #10–#13 promoted to H1 by founder compliance-first override |
| Tools / modules map | `command-center/product/tools-modules-map.md` | Background job inventory, internal module enumeration, external service dependencies |

---

## Stack-specific decisions

### NestJS modular monolith + separate worker process

At MVP, the product does not justify distributed services. All twelve domain modules run in a single NestJS process (`apps/api`). The **sole process boundary** is between the API and the background worker (`apps/worker`). This split is motivated by operational concerns, not scale:

- Job processors should not compete with HTTP request threads for CPU/memory
- Worker can be scaled independently (more replicas for burst job load) without scaling the API
- A job processor crash does not take down the HTTP API

The worker is not a separate codebase — it is a separate NestJS bootstrap entry point in the same Turborepo that selectively imports only the job-relevant modules. Both processes run from the same Docker image; the `CMD` differs (`node dist/main.js` vs `node dist/worker.js`).

This architecture supports an eventual microservices decomposition (H3+) by maintaining strict module boundaries now. The matching engine and compliance engine are the most likely first extractions if/when isolated scaling is needed.

### Zod-to-DTO bridge

`@anatine/zod-nestjs` is the bridge between `packages/shared` Zod schemas and NestJS class-based DTO objects. The DTOs are one-liners:

```typescript
// packages/shared/src/schemas/mandate.schema.ts
export const CreateMandateSchema = z.object({ ... })

// apps/api/src/modules/mandates/dto/create-mandate.dto.ts
export class CreateMandateDto extends createZodDto(CreateMandateSchema) {}
```

NestJS's global `ValidationPipe` picks up the class and validates against the Zod schema. No class-validator decorators. No duplicate schema definitions. When a field changes in `packages/shared`, the DTO, the frontend form, and the API response type all update at once — TypeScript surfaces the breaks at compile time.

OpenAPI generation: `@nestjs/swagger` + the `@anatine/zod-nestjs` Swagger plugin reads Zod schemas and generates accurate OpenAPI 3.1 schema objects. No manual `@ApiProperty()` decorators required.

### When Socket.IO is warranted

Socket.IO is **not scaffolded at MVP**. SSE (`EventSource`) handles the notification stream, which is the only real-time requirement at launch. SSE is:
- Stateless from the server side (HTTP/2 multiplexed on Railway)
- Compatible with Railway's load balancer without sticky sessions
- Sufficient for one-directional push (server → client notifications)

**Socket.IO should be added if and only if** one of these conditions is true:
1. A live-collaborative feature requires bidirectional messaging (e.g., a shared pipeline board where two advisors see each other's cursor/edits in real time)
2. Sub-second latency is required for a feature with a measurable user-facing impact (e.g., live outreach send progress per-message, not just campaign-level status)
3. A feature requires server-to-multiple-specific-clients fan-out that SSE rooms cannot cleanly express

Condition 1 is the most likely trigger for H2 (collaborative pipeline board). Evaluate at H2 decomposition. At that point, use Socket.IO namespaces: one namespace per domain (`/pipeline`, `/outreach`) with room-per-mandate scoping. Redis adapter (`@socket.io/redis-adapter`) required for multi-instance Railway deployments.

---

## Risk / open items

| # | Risk | Severity | Mitigation / Decision needed |
|---|---|---|---|
| R-1 | **Queue infrastructure not yet provisioned.** BullMQ requires Redis on Railway. The SDK/Services branch confirms the provider, but actual Railway Redis provisioning happens at deploy (C-block). Until provisioned, all six job types are unshippable. | High | SDK branch must lock BullMQ + Railway Redis as the queue stack and document the Railway service name in `project.yaml`. The worker process is a compile-time dependency — it is authored before Redis exists, but cannot be integration-tested without it. |
| R-2 | **Email provider not yet selected.** Outreach engine (send), webhook processor (events), and Notification module (system alerts) all depend on a transactional email + webhook provider. Resend is the leading candidate (developer-friendly, webhook support, DKIM management API). | High | SDK branch selects and documents the provider. This is a blocking dependency for outreach feature work (H1 #9) and the compliance audit trail for sent messages. |
| R-3 | **LLM provider latency under match run.** 50 LLM calls at ~2s each = ~100s for a full match run. Already mitigated by async BullMQ job. Risk is user expectation: match runs are not instant. | Medium | UI must clearly communicate async status (polling + progress indicator). Match run should stream partial results as they complete (emit per-result events, poll returns partial result array). Implement in matching module job processor. |
| R-4 | **Audit log hash-chain write throughput.** Sequential hash dependency means each `record()` call reads the latest `content_hash` before writing. Under concurrent high-volume writes this serializes. At MVP outreach volume this is acceptable. | Medium | Acceptable at MVP. Monitor write latency in production. If p95 write latency exceeds 50ms, introduce segment-based hashing (segment every N rows; chain of segment hashes rather than individual rows). Defer until measured. |
| R-5 | **Worker process scope creep.** Risk of the worker importing non-job modules (e.g., controller layers) and silently coupling to HTTP concerns. | Low | Worker bootstrap (`apps/worker/src/main.ts`) imports an explicit whitelist of modules (`IngestionModule`, `DedupeModule`, `MatchingModule`, `OutreachModule`, `AuditLogModule`, `RecordkeepingModule`). CI lint rule: worker entry point may not import `*Controller` classes. |
| R-6 | **SSE connection limit under high concurrent user count.** Each connected user holds an open SSE connection. Railway's load balancer supports HTTP/2; SSE over HTTP/2 multiplexes connections. At MVP user counts (tens of internal users) this is not a concern. | Low | No action at MVP. If concurrent users exceed 500, evaluate Socket.IO with Redis adapter or a dedicated push gateway. |
| R-7 | **Webhook HMAC secret rotation during active outreach.** Rotating `EMAIL_WEBHOOK_SECRET` requires the email provider and the API to be updated atomically; a window exists where events are rejected. | Low | Document the rotation procedure: (1) add new key as `EMAIL_WEBHOOK_SECRET_NEXT` env var; (2) API accepts both old and new during overlap window; (3) update provider webhook config; (4) remove old key after provider confirms new key is live. Implement dual-key acceptance in `WebhookProcessorService`. |
| R-8 | **Pilot-partner workspace isolation (H2 #20) not designed at MVP.** All queries already filter by `workspace_id`. RLS policy additions at H2 are additive. | Low | Design doc required before H2 decomposition begins. No MVP schema changes needed; `workspace_id` column on all tenant-scoped tables is present from day one. |
| R-9 | **OpenAPI spec drift.** `@nestjs/swagger` auto-generation can miss edge cases (discriminated unions, complex nested Zod types). | Low | CI step: `nest generate openapi` runs on every PR; output diff is checked against the committed spec. Uncommitted drift fails the build. |
