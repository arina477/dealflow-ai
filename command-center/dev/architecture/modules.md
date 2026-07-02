# Modules Architecture

> Branch: Modules / Reusable elements
> Author: backend-developer agent
> Date: 2026-06-29
> Status: draft (v6 snapshot)
> Stack: Turborepo/pnpm · NestJS · Next.js 15 · Postgres + Drizzle · SuperTokens · Railway

---

## Summary

DealFlow AI is structured as a NestJS monorepo backend (`apps/api`) with a Next.js 15 frontend (`apps/web`) and a shared contract package (`packages/shared`). All modules below are domain slices of the backend service or shared UI primitives; none are deployed as separate microservices at MVP. Module boundaries are enforced via NestJS `@Module()` encapsulation — no cross-module direct imports of services; inter-module communication is via injected interfaces or internal events.

Twelve backend modules carry the core product: auth/RBAC, mandate, matching engine, outreach engine, audit-log, compliance rules, data ingestion, dedupe/enrichment, pipeline, recordkeeping/export, notification, and admin/settings. Five frontend shared-primitive families complete the UI layer. Background jobs (sourcing sync, enrichment queue, outreach send queue, email-event webhook processor, audit integrity verifier) are housed in a dedicated `jobs` module backed by the queue infrastructure chosen at v6 SDK/Services branch (Redis-backed BullMQ is the expected default).

The compliance wedge — audit-log, compliance rules engine, recordkeeping/export, and the outreach compliance gate — is H1 per the founder's compliance-first override and is therefore production-grade at MVP, not stubbed.

---

## Inventory

Module entries follow this schema:

```
Name            Horizon   Location (monorepo path)
Inputs          public contract this module consumes
Outputs         public contract this module exposes
Key concerns    non-obvious design constraints
```

---

### Backend modules

---

#### 1. Auth / RBAC module

Horizon: MVP (H1)
Location: `apps/api/src/modules/auth/`

Inputs:
- SuperTokens Core (JWT verification, session management) via private Railway network
- HTTP requests carrying SuperTokens session cookie / bearer token
- User invitation tokens (UUID, single-use, expiry-checked)

Outputs:
- `CurrentUser` decorator — resolves `{ userId, role, workspaceId }` for every controller
- `RolesGuard` — NestJS `CanActivate` guard; rejects on role mismatch
- `AuthService` — `createInvite(email, role)`, `acceptInvite(token, password)`, `resetPassword(token)`, `listUsers()`, `updateUserRole(userId, role)`
- `UserRepository` (Drizzle) — `users` table CRUD
- Auth-event records emitted to Audit-log module (login, role change, invite sent)

Key concerns:
- Four roles: `advisor | analyst | compliance | admin`. Least-privilege defaults: analysts cannot send outreach; compliance cannot edit mandates; admin cannot run matching.
- SuperTokens self-hosted on Railway; JWT signed with rotating key stored in Railway env var `SUPERTOKENS_API_KEY`.
- Invitation flow is the only user-creation path — no public signup.
- RBAC guard is applied at controller level; service methods additionally check role for any operation that touches sensitive data (double-check pattern for compliance endpoints).
- Auth-events (login success/fail, role change) are written to the audit log at application layer, not database trigger, so the event carries the acting user context.

---

#### 2. Mandate service

Horizon: MVP (H1)
Location: `apps/api/src/modules/mandates/`

Inputs:
- Authenticated advisor/analyst `CurrentUser`
- Mandate create/update DTOs: seller profile, buyer criteria (EBITDA range, sector, geography, size), compliance profile (jurisdiction, required disclaimers, approval-gate flag)
- Matching engine output (match sets linked to a mandate)
- Pipeline module status updates

Outputs:
- `MandateService` — `createMandate()`, `updateMandate()`, `getMandate(id)`, `listMandates()`, `archiveMandate()`
- `MandateRepository` (Drizzle) — `mandates` table + `mandate_compliance_profiles` table
- `MandateDto` / `MandateListDto` — shared Zod schemas in `packages/shared`
- Mandate-lifecycle audit events emitted to Audit-log module

Key concerns:
- Mandate is the root aggregate. All downstream objects (matches, outreach campaigns, pipeline stages) reference a `mandate_id`.
- `compliance_profile` is a first-class embedded object, not an afterthought. It drives the compliance rules engine's gate configuration per mandate.
- Mandate archival does not delete — sets `status = 'archived'` and retains all linked records for audit.
- Optimistic locking on update (`version` integer column) to prevent concurrent advisor edits.

---

#### 3. Data ingestion / ETL module

Horizon: MVP (H1)
Location: `apps/api/src/modules/ingestion/`

Inputs:
- Scheduled BullMQ jobs (`SourceSyncJob`) triggered by cron per configured data source
- Admin-issued manual sync via `AdminController`
- External data-source API adapters (one adapter class per provider, loaded by factory)
- Data-source connection credentials from `admin_data_sources` table (encrypted at rest)

Outputs:
- Raw company records written to `raw_companies` staging table
- `IngestionService` — `syncSource(sourceId)`, `listSources()`, `getSyncStatus(sourceId)`
- `IngestionJobProducer` — enqueues `SourceSyncJob` for background processing
- Sync-result events (records added/updated/failed counts) emitted to Notification module

Key concerns:
- Adapter interface: `DataSourceAdapter.fetch(cursor?: string): Promise<RawCompany[]>`. All adapters implement this; new sources drop in a new adapter class.
- Rate limiting is adapter-internal — each adapter holds its own throttle config (requests/second, daily quota).
- Raw records land in staging table; dedupe/enrichment module promotes them to `companies`.
- Connection credentials stored encrypted (`pgcrypto` symmetric encryption using `DATA_SOURCE_ENCRYPTION_KEY` env var). Admin module manages credentials; ingestion module reads them but never writes.
- Sync jobs are idempotent — upsert on `(source_id, external_id)` unique key.

---

#### 4. Dedupe / Enrichment engine

Horizon: MVP (H1)
Location: `apps/api/src/modules/dedupe/`

Inputs:
- `raw_companies` records written by ingestion module
- BullMQ `EnrichmentJob` per company record (enqueued by ingestion module post-ingest)
- Contact enrichment provider API (selected at SDK branch)
- Field-enrichment rules (configured in `enrichment_rules` table)

Outputs:
- Canonical `companies` + `contacts` records (upserted with provenance tracking)
- `DedupeService` — `resolveEntity(rawRecord)`, `mergeCompanies(sourceId, targetId)`, `getCompany(id)`, `listCompanies(filters)`
- `EnrichmentService` — `enrich(companyId)`, `getEnrichmentStatus(companyId)`
- Provenance metadata: every field carries `source`, `enriched_at`, `enrichment_provider` columns

Key concerns:
- Entity resolution uses deterministic matching first (normalized name + domain), then fuzzy match score threshold (configurable). No ML at MVP.
- Merge is non-destructive: merged-from company record is soft-deleted with a `merged_into_id` FK reference.
- Enrichment is async (BullMQ queue). UI polls enrichment status via `GET /companies/:id/enrichment-status`.
- Contact email verification is handled by enrichment provider; verified flag stored on `contacts.email_verified`.
- Provenance matters for compliance: every outreach communication can trace the contact back to its source.

---

#### 5. Matching engine

Horizon: MVP (H1)
Location: `apps/api/src/modules/matching/`

Inputs:
- Mandate object (criteria, compliance profile) from mandate service
- Buyer universe (filtered `companies` set) built by analyst via buyer-universe builder
- LLM provider (Claude) for scoring rationale generation
- Analyst accept/reject signals on match results (feedback for H2 tuning)

Outputs:
- `MatchingService` — `runMatch(mandateId)`, `getMatchResults(mandateId)`, `shortlistBuyer(matchId)`, `rejectBuyer(matchId)`, `flagBuyer(matchId, reason)`
- Ranked `match_results` records: `{ company_id, mandate_id, score, rationale, status }`
- `MatchRunCompletedEvent` — emitted to Notification module
- Match decision audit events emitted to Audit-log module (accept/reject/flag are material decisions)

Key concerns:
- Scoring is a two-pass process: deterministic rule-based pre-score (sector fit, size fit, geography) then LLM rationale + score refinement. The deterministic pass runs without LLM cost; LLM is called only for top-N candidates (configurable, default 50).
- LLM prompt constructs mandate criteria + candidate company profile. Rationale is structured JSON (`{ score: 0-100, rationale: string, flags: string[] }`), parsed and validated with Zod before storage.
- LLM calls are async (BullMQ `MatchingJob`). A match run is a job; UI polls `GET /mandates/:id/match-run/status`.
- Match results are immutable after finalization — the advisor shortlists/rejects individual buyers, not re-runs.
- H2 (`#26`) adds feedback-loop fine-tuning. H3 (`#30`) adds predictive models. At MVP, no feedback storage schema migration required: `match_results.advisor_decision` (`accepted | rejected | flagged | null`) column is present from day one.

---

#### 6. Outreach engine

Horizon: MVP (H1)
Location: `apps/api/src/modules/outreach/`

Inputs:
- Shortlisted buyers (from matching engine, linked to mandate)
- Outreach templates from template library (with merge-field schema)
- Compliance gate approval (from compliance rules engine) — send is blocked without approval if gate is configured
- Transactional email provider SDK (selected at SDK branch, e.g. Resend)
- `OutreachSendJob` processed by BullMQ worker

Outputs:
- `OutreachService` — `createCampaign(mandateId, payload)`, `sendCampaign(campaignId)`, `getCampaignStatus(campaignId)`, `getMessageStatus(messageId)`
- `TemplateService` — `createTemplate()`, `updateTemplate()`, `renderTemplate(templateId, mergeVars)`, `listTemplates()`
- `WebhookProcessorService` — ingests email-provider webhook events (opened, clicked, replied, bounced, unsubscribed)
- Outreach events (sent, opened, replied, bounced) emitted to Audit-log module and Pipeline module
- `OutreachStatusUpdatedEvent` for Notification module

Key concerns:
- Every send must pass through compliance gate check before enqueueing. `OutreachService.sendCampaign()` throws `ComplianceBlockedException` if gate returns `blocked`.
- Merge fields are validated against template schema at render time — missing required fields are a hard error.
- AI-assisted drafting (`#8`) calls LLM inline during template editing (not async); result is a draft the user edits, not an auto-send.
- Outreach send queue is rate-limited per sending domain (configurable sends/hour). BullMQ rate limiter used.
- Bounce and unsubscribe webhook events must feed the compliance suppression list automatically.
- Reply detection is provider-webhook-based. A `replied` event on a message sets `outreach_messages.replied_at` and triggers a pipeline stage advance suggestion.
- Template `required_compliance_blocks` field: list of compliance-rule IDs whose disclaimer text must be present in rendered output. Enforcement is at render time.

---

#### 7. Audit-log service (append-only, tamper-evident)

Horizon: MVP (H1) — compliance-first core
Location: `apps/api/src/modules/audit-log/`

Inputs:
- `AuditEvent` objects emitted by all other modules via `AuditLogService.record(event)`
- Integrity verification job (`AuditIntegrityJob`) run on schedule
- Export requests from Recordkeeping/export module

Outputs:
- `AuditLogService` — `record(event: AuditEvent): Promise<void>`, `query(filters): Promise<AuditLogEntry[]>`, `verifyIntegrity(range): Promise<IntegrityReport>`
- `audit_log` table: `(id, timestamp, actor_id, actor_role, event_type, entity_type, entity_id, payload_json, content_hash, prev_hash, chain_sequence)`
- `IntegrityReport` — hash-chain verification result for a date range

Key concerns:
- Append-only by Postgres-level constraint: no `UPDATE` or `DELETE` grants on `audit_log` for any application role. Writes go through a dedicated `audit_writer` DB role with `INSERT`-only grant.
- Hash chain: each row's `content_hash = SHA-256(prev_hash || timestamp || actor_id || event_type || entity_id || payload_json)`. `prev_hash` for row N is the `content_hash` of row N-1. Tampering with any row breaks the chain.
- `AuditEvent` is a discriminated union type in `packages/shared`: `AuthEvent | MandateEvent | MatchDecisionEvent | OutreachEvent | ComplianceEvent | ExportEvent`. Each variant has a fixed `payload` schema validated with Zod before write.
- All modules emit events to `AuditLogService` — they do not write to `audit_log` directly. This single write path is the enforcement point.
- Integrity verification job runs nightly; stores result in `audit_integrity_checks` table (separate from `audit_log`).
- Query interface is read-only and scoped: compliance role can query all; advisor role can query their own mandate events; analyst cannot query.

---

#### 8. Compliance rules engine

Horizon: MVP (H1) — compliance-first core
Location: `apps/api/src/modules/compliance/`

Inputs:
- Compliance rules configured by compliance officer: suppression/blocklist entries, jurisdiction-specific disclaimer requirements, approval-gate policies per mandate
- Pre-send outreach payload (recipients, rendered content, mandate context) from Outreach engine
- Compliance approval actions from compliance officer

Outputs:
- `ComplianceService` — `checkPreSend(payload): Promise<GateResult>`, `submitForApproval(campaignId)`, `approveOutreach(campaignId, reviewerId)`, `rejectOutreach(campaignId, reviewerId, reason)`, `listQueue()`, `upsertRule(rule)`, `listRules()`
- `GateResult` — `{ verdict: 'approved' | 'blocked' | 'pending_review', violations: ComplianceViolation[] }`
- `compliance_rules` table: suppression lists, disclaimer templates, approval-gate configs
- `compliance_queue` table: pending/approved/rejected outreach approvals
- Compliance events emitted to Audit-log module (rule change, approval, rejection)

Key concerns:
- Pre-send check is synchronous and blocking. Campaign send cannot proceed without `verdict: 'approved'`.
- Suppression list check: every recipient email and company domain is checked against `suppression_list` table before send. Match = hard block.
- Disclaimer injection: compliance rules specify required disclaimer text per jurisdiction. Render-time check confirms the disclaimer text (or its ID) is present in the rendered template. Missing = `blocked`.
- Approval gate: if mandate `compliance_profile.requires_approval = true`, all campaigns go through manual review regardless of rule checks. `GateResult.verdict = 'pending_review'` until compliance officer acts.
- Rule changes write an audit event (rule_id, changed fields, acting compliance officer). Rule history is audit-log-queryable.
- H2 (`#25`) adds formal SOX/FINRA certification artifacts. Schema is additive.

---

#### 9. Recordkeeping / export module

Horizon: MVP (H1) — compliance-first core
Location: `apps/api/src/modules/recordkeeping/`

Inputs:
- Audit-log query results for a date range / mandate scope
- Outreach campaign + message records
- Match decision records
- Railway Buckets (S3-compatible) for export package storage

Outputs:
- `RecordkeepingService` — `requestExport(params: ExportParams): Promise<ExportJob>`, `getExportStatus(jobId)`, `downloadExportPackage(jobId): Promise<SignedUrl>`
- Export package: ZIP archive containing audit-log JSONL, message content CSV, integrity report JSON, manifest with package hash
- `export_jobs` table: status tracking for async export generation
- `ExportReadyEvent` for Notification module

Key concerns:
- Export generation is async (BullMQ `ExportJob`). Large exports may take minutes.
- Package manifest includes: date range, mandate scope, row counts per record type, SHA-256 of each enclosed file, package-level hash. This makes the package self-verifying.
- Signed download URL has a short TTL (15 minutes). Re-downloading re-generates a fresh signed URL.
- Compliance officer can scope exports by: date range, mandate ID, event type, actor.
- H2 (`#25`) adds formal retention-policy enforcement (records locked for minimum retention period) and attestation report generation. Retention lock is a `locked_until` timestamp on the export job; delete requests before that date are rejected at application layer.
- Export files stored in Railway Buckets under `exports/{workspace_id}/{job_id}/`. Never stored in DB blob columns.

---

#### 10. Pipeline / deal-stage module

Horizon: MVP (H1)
Location: `apps/api/src/modules/pipeline/`

Inputs:
- Shortlisted buyers from matching engine
- Outreach reply events from outreach engine
- Manual stage advances by advisor
- Notes and next-action inputs

Outputs:
- `PipelineService` — `getBoard(mandateId)`, `advanceStage(dealId, stage)`, `addNote(dealId, note)`, `setNextAction(dealId, action)`, `listDeals(filters)`
- `deals` table: `(id, mandate_id, company_id, stage, notes, next_action_at, created_at, updated_at)`
- Pipeline stages enum: `shortlisted | contacted | engaged | diligence | offer | closed | withdrawn`
- Stage-change events emitted to Audit-log module
- `DealStageChangedEvent` for Notification module

Key concerns:
- Deal record is created automatically when a buyer is shortlisted (matching engine emits `BuyerShortlistedEvent`; pipeline module handles it).
- Stage advancement is advisor-only. Compliance and analyst roles have read-only access to pipeline.
- Outreach reply event from outreach engine triggers a "move to engaged?" suggestion surfaced in UI — not an automatic advance.
- Notes are append-only at application layer (soft delete only). They feed audit log.

---

#### 11. Notification module

Horizon: MVP (H1)
Location: `apps/api/src/modules/notifications/`

Inputs:
- Internal domain events from all other modules (`MatchRunCompletedEvent`, `OutreachStatusUpdatedEvent`, `ComplianceQueueItemAddedEvent`, `DealStageChangedEvent`, `SyncCompletedEvent`, `ExportReadyEvent`, etc.)
- User notification preferences from `notification_preferences` table

Outputs:
- `NotificationService` — `notify(event: DomainEvent): Promise<void>`
- In-app notifications written to `notifications` table (read by SSE or polling endpoint)
- Transactional email alerts via email provider (for compliance queue items, export ready, sync errors)
- `GET /notifications` — paginated notification feed per user
- `POST /notifications/:id/read` — mark as read

Key concerns:
- Notification module is a pure consumer of domain events. It does not call back into other modules.
- In-app delivery uses Server-Sent Events (`GET /notifications/stream`) if Socket.IO is deferred. SSE endpoint is lightweight and Railway-compatible.
- Email alerts go through the same transactional email provider as outreach but use a separate sending identity (system sender, not the firm's verified outreach domain).
- Notification fan-out: events are broadcast to all users of the relevant role unless the event carries a `target_user_id`.
- User preferences can opt out of email alerts per notification type. In-app delivery is always on.

---

#### 12. Admin / settings module

Horizon: MVP (H1)
Location: `apps/api/src/modules/admin/`

Inputs:
- Admin-role `CurrentUser`
- Data-source connection payloads (provider, credentials) — credentials encrypted before storage
- User invite and role-change requests (delegated to Auth module)
- Workspace profile: firm name, logo, verified sending domain, default compliance profile
- Sending-domain verification results from email provider

Outputs:
- `AdminService` — `createDataSource(payload)`, `updateDataSource(id, payload)`, `deleteDataSource(id)`, `listDataSources()`, `getWorkspaceSettings()`, `updateWorkspaceSettings(payload)`, `verifySendingDomain(domain)`
- `admin_data_sources` table: `(id, name, provider, encrypted_credentials, last_sync_at, status)`
- `workspace_settings` table: firm profile, verified domain, default compliance profile
- Admin events emitted to Audit-log module (data source added/removed, sending domain verified)

Key concerns:
- Data-source credentials are encrypted at rest using `pgcrypto` and `DATA_SOURCE_ENCRYPTION_KEY` env var. Credential plaintext is never returned in API responses — only masked tokens.
- Sending-domain verification triggers a real-time check with the email provider's domain verification API. Verification status stored in `workspace_settings.domain_verified`.
- Admin module is the only path to managing `admin_data_sources`. Ingestion module reads (decrypts at job time) but never writes.
- H2 (`#20`) adds pilot-partner workspace creation here (tenant provisioning, data isolation). Schema additive: `workspaces` table gains a `partner_workspace` flag + row-level security policies.

---

### Background jobs module

Horizon: MVP (H1)
Location: `apps/api/src/modules/jobs/`

All BullMQ workers live here. Jobs are defined as NestJS providers injected into the module that owns their logic (e.g. `SourceSyncJob` processor lives in ingestion module but is registered as a BullMQ processor via `@Processor('ingestion')`).

| Job | Queue | Schedule/Trigger | Idempotent |
|---|---|---|---|
| `SourceSyncJob` | `ingestion` | Cron per source (configurable) | Yes — upsert on `(source_id, external_id)` |
| `EnrichmentJob` | `enrichment` | Enqueued by ingestion on new raw record | Yes — skip if `enriched_at` is recent |
| `OutreachSendJob` | `outreach-send` | Triggered by `sendCampaign()` | Yes — idempotency key per message |
| `EmailEventWebhookJob` | `email-events` | HTTP webhook from email provider → enqueue | Yes — dedupe on provider event ID |
| `AuditIntegrityJob` | `audit-integrity` | Nightly cron | Yes — writes new integrity check row |
| `ExportJob` | `export` | Triggered by `requestExport()` | Yes — export job per job ID |

Key concerns:
- Redis connection string in `REDIS_URL` env var. BullMQ workers auto-reconnect.
- Dead-letter queue (`*-dlq`) configured per queue with `attempts: 3, backoff: { type: 'exponential', delay: 5000 }`.
- All jobs emit structured log entries with `job_id`, `queue`, `attempt`, `duration_ms`.
- Job failure rates are tracked via a monitoring provider (Prometheus metrics exposed at `/metrics`).

---

### Frontend shared primitives

Location: `apps/web/src/components/shared/`

---

#### FE-1. Data tables

Horizon: MVP (H1)
Path: `apps/web/src/components/shared/DataTable/`

- Server-side sortable + filterable table built on TanStack Table v8 + shadcn/ui `Table` primitives
- Props contract: `columns: ColumnDef<T>[]`, `data: T[]`, `pagination: PaginationState`, `onSort`, `onFilter`, `isLoading`
- Variants: `RankedTable` (adds score column + rationale expand), `AuditLogTable` (read-only, no row actions), `ComplianceQueueTable` (approve/reject inline actions)
- Used by: Buyer universe (8), Matches (9), Pipeline (11), Companies (13), Compliance queue (15), Audit log (16)

---

#### FE-2. Forms + validation

Horizon: MVP (H1)
Path: `apps/web/src/components/shared/Form/`

- React Hook Form + Zod resolver pattern. Schema defined once in `packages/shared`, imported by both NestJS DTO and RHF resolver — single source of truth.
- `FormField`, `FormInput`, `FormSelect`, `FormCombobox`, `FormTextarea`, `FormCheckbox`, `FormDatePicker`
- Server-side validation errors mapped to field-level errors via `setError()` on API 422 response
- Used by: New mandate (7), Template editor (14), Compliance settings (17), Admin integrations (18), Admin workspace settings (20)

---

#### FE-3. Modals / drawers

Horizon: MVP (H1)
Path: `apps/web/src/components/shared/Modal/`

- `Modal` — centered dialog (shadcn/ui `Dialog` wrapper), `Drawer` — right-side panel for detail views
- Controlled open/close state via `useModal()` hook in `apps/web/src/hooks/`
- `MatchRationaleDrawer` — specialized drawer displaying LLM rationale + score breakdown
- `ComplianceViolationsModal` — displays `GateResult.violations` before blocking a send
- `AuditEventDetailModal` — full event payload display
- Used by: Matches (9), Outreach composer (10), Compliance queue (15), Audit log (16)

---

#### FE-4. Toasts / inline alerts

Horizon: MVP (H1)
Path: `apps/web/src/components/shared/Alert/`

- `Toast` — ephemeral non-blocking notification (shadcn/ui `Sonner` integration)
- `InlineAlert` — persistent banner within page context (compliance blocks, sync errors)
- `ComplianceBlockBanner` — specialized `InlineAlert` variant with violation list and "Submit for review" CTA
- Used by: Outreach composer (10), Compliance queue (15), all form submit paths

---

#### FE-5. Status badges / stage chips

Horizon: MVP (H1)
Path: `apps/web/src/components/shared/Badge/`

- `StatusBadge` — maps domain status enum to color + label. Variants: `outreach_status`, `pipeline_stage`, `compliance_verdict`, `match_decision`, `sync_status`
- `StageChip` — pipeline stage with optional icon; drag-handle variant for kanban (H2)
- Color tokens sourced from design system tokens (set in v8 D-block)
- Used by: Dashboard (4), Pipeline (11), Compliance queue (15), Audit log (16), all list views

---

#### FE-6. Design tokens

Horizon: MVP (H1) — provisional; finalized at v8 D-block
Path: `apps/web/src/styles/tokens.css` + `tailwind.config.ts` custom theme extension

- Color palette: brand primary, neutrals, semantic (success/warning/danger/info)
- Typography scale: display / heading / body / label / mono (for code/hash display in audit log)
- Spacing scale: extends Tailwind default
- Border radius, shadow, z-index tiers
- Consumed by all frontend components. shadcn/ui components are themed via CSS variables mapped to tokens.
- Token file is the single source of truth; hardcoded colors in component files are a lint error (custom Biome rule at v8).

---

## Conventions

### NestJS module structure

Every backend module follows this directory layout:

```
src/modules/<module-name>/
  <module-name>.module.ts       — @Module() declaration; imports + exports
  <module-name>.controller.ts   — HTTP handlers; uses @UseGuards(RolesGuard)
  <module-name>.service.ts      — business logic; injected by controller + other services
  <module-name>.repository.ts   — Drizzle queries; injected by service only
  <module-name>.events.ts       — domain event class definitions (if module emits events)
  dto/
    create-<entity>.dto.ts      — Zod-derived via @anatine/zod-nestjs
    update-<entity>.dto.ts
    <entity>-response.dto.ts
  __tests__/
    <module-name>.service.spec.ts
    <module-name>.controller.spec.ts
    <module-name>.repository.spec.ts (integration test, uses test DB)
```

No service file may import directly from another module's repository. Cross-module access is always via the owning module's service (exported from its `@Module`). If circular dependency arises, extract shared logic to a `packages/shared` utility or emit/handle via NestJS `EventEmitter2`.

### Next.js frontend module structure

```
apps/web/src/
  app/                          — Next.js 15 App Router pages and layouts
    (auth)/                     — unauthenticated group (login, invite, reset)
    (app)/                      — authenticated group; layout applies auth guard
      mandates/
      pipeline/
      compliance/
      admin/
  components/
    shared/                     — reusable primitives (FE-1 through FE-6)
    <feature>/                  — feature-scoped components; never imported by other features
  hooks/                        — shared React hooks (useModal, useNotifications, useCurrentUser)
  lib/
    api-client.ts               — typed fetch wrapper; uses Zod schemas from @dealflow/shared
    query-client.ts             — TanStack Query client config
  styles/
    tokens.css
```

Feature-scoped components under `components/<feature>/` are private to their route group. If a component is needed by two features, it moves to `components/shared/`.

### Shared contracts package

`packages/shared/src/`:
- `schemas/` — Zod schemas (one file per domain entity + one per DTO)
- `types/` — TypeScript types derived from Zod schemas (`z.infer<>`)
- `events/` — `AuditEvent` discriminated union; `DomainEvent` union (all event types)
- `constants/` — role enum, pipeline stage enum, compliance verdict enum

Backend DTOs are created with `createZodDto(schema)` from `@anatine/zod-nestjs`. Frontend forms use the same schema as the Zod resolver argument. This eliminates schema drift.

### Naming conventions

- Module names: `kebab-case` directory + `PascalCase` module class (`MandatesModule`)
- Service methods: `verbNoun` (`createMandate`, `listCompanies`, `runMatch`)
- Repository methods: `findById`, `findMany(filters)`, `insert`, `update`, `softDelete`
- Events: `PastTensePascalCase` (`MandateCreatedEvent`, `BuyerShortlistedEvent`)
- Queue names: `kebab-case` matching the domain (`outreach-send`, `enrichment`)
- Env vars: `SCREAMING_SNAKE_CASE`; documented in `.env.example`

---

## Reusability principles

1. **Schema once, use everywhere.** Zod schemas in `packages/shared` are the single source of truth for all data shapes. NestJS DTOs, frontend form validators, API response types, and test factories all derive from the same schema. Changes propagate at compile time.

2. **Domain events over direct calls.** Modules that need to react to another module's state change (e.g., pipeline needs to know about outreach replies; audit log needs to know about everything) consume NestJS `EventEmitter2` events, not direct service imports. This keeps the dependency graph acyclic at the module level.

3. **Guards are cross-cutting, not per-controller.** `RolesGuard` is registered globally as an `APP_GUARD`. Controllers declare `@Roles(Role.ADVISOR, Role.ANALYST)` metadata; the guard enforces. Default deny — every endpoint requires an explicit `@Roles()` decorator or `@Public()` to opt out.

4. **Compliance path is always synchronous and blocking.** The outreach engine's `sendCampaign()` method calls the compliance engine's `checkPreSend()` synchronously before enqueuing any send job. This is intentional: async pre-send check would introduce a race where sends could slip through during a check lag. Compliance is not a background concern.

5. **Audit log is a one-way bus.** All modules write to audit log; no module reads from it except compliance/export. Audit log module never imports from any other module. Dependency arrow always points inward (toward audit log), never outward.

6. **UI primitives are unopinionated about domain data.** `DataTable`, `StatusBadge`, and `Modal` components accept generic props. Domain-specific variants (e.g., `AuditLogTable`, `MatchRationaleDrawer`) are thin wrappers that pass domain-typed props to the generic primitive. This avoids polluting shared primitives with business logic.

7. **Background jobs are fire-and-query, never fire-and-forget.** Every job writes a status record to a `*_jobs` table (or updates the triggering record's status column) before enqueuing. UI can always query current job state without coupling to queue internals.

8. **Adapter pattern for all external services.** Each external provider (data source, enrichment, email, LLM) is accessed through an adapter interface defined in `packages/shared`. The concrete adapter lives in a `providers/` subdirectory of the consuming module. Swapping providers means swapping the adapter class, not modifying business logic.

---

## Cross-references

| Module | Consumes from | Produces for |
|---|---|---|
| Auth / RBAC | SuperTokens Core (external), `users` table | All modules (CurrentUser, RolesGuard), Audit-log (auth events) |
| Mandate service | Auth/RBAC, `mandates` + `mandate_compliance_profiles` tables | Matching engine, Outreach engine, Pipeline, Compliance rules, Audit-log |
| Data ingestion | External data-source APIs, `admin_data_sources` table, BullMQ | Dedupe/enrichment (`raw_companies`), Audit-log, Notification |
| Dedupe/enrichment | `raw_companies` (from ingestion), contact enrichment provider, BullMQ | `companies` + `contacts` tables (consumed by matching engine, outreach engine, buyer-universe builder) |
| Matching engine | Mandate service, `companies` table, LLM provider, BullMQ | `match_results` table, Pipeline (via event), Audit-log, Notification |
| Outreach engine | Matching engine (shortlisted buyers), Compliance rules engine, email provider, BullMQ | `outreach_campaigns` + `outreach_messages` tables, Pipeline (via event), Audit-log, Notification |
| Audit-log service | All modules (event consumers), `audit_log` table | Compliance rules engine (query), Recordkeeping/export |
| Compliance rules engine | Outreach engine (pre-send check), `compliance_rules` + `compliance_queue` tables, Audit-log (write) | Outreach engine (GateResult), `compliance_queue` (for compliance officer UI), Audit-log (rule change events) |
| Recordkeeping/export | Audit-log service (query), outreach + match records, Railway Buckets | `export_jobs` table, signed download URLs, Notification |
| Pipeline | Matching engine (via event), Outreach engine (via event), `deals` table | Dashboard aggregates, Audit-log, Notification |
| Notification | All modules (domain events), `notification_preferences` | `notifications` table, email provider (system alerts) |
| Admin/settings | Auth/RBAC, `admin_data_sources` + `workspace_settings` tables | Ingestion module (data source credentials), Outreach engine (sending domain), Audit-log |
| Jobs module | All modules that enqueue jobs, Redis/BullMQ | All modules that process jobs (cross-cutting infra) |

---

## Stack-specific decisions

### NestJS

- **Module boundary enforcement:** NestJS's `@Module({ exports: [] })` declaration acts as the module API surface. Only explicitly exported providers are injectable by consumers. Repositories are never exported — only services.
- **Global guards:** `APP_GUARD` token registers `RolesGuard` globally. `JwtStrategy` is registered in `AuthModule` with `PassportModule`; all other modules inherit JWT verification via the global guard chain.
- **Configuration:** `@nestjs/config` + `ConfigService` for all env var access. No `process.env` direct reads outside the config module. Config is validated with Zod at startup — the app fails fast if required env vars are missing.
- **Event bus:** `@nestjs/event-emitter` (wraps EventEmitter2). Async event handlers use `@OnEvent({ async: true })`. Sync handlers (audit log write) use synchronous `@OnEvent()`.
- **Database:** Drizzle ORM with schema-first migration files in `packages/db/migrations/`. `drizzle-kit` generates migration SQL. No Drizzle `push` in production — migrations run via CI migration job before deploy.
- **BullMQ:** `@nestjs/bullmq` adapter. Each queue is declared in the owning module's `@Module({ imports: [BullModule.registerQueue({ name: '...' })] })`.
- **Validation pipe:** `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` registered globally. Every controller DTO is auto-validated.

### Next.js 15

- **App Router + React Server Components:** data fetching in Server Components for all read-heavy pages (companies list, audit log, pipeline board). Client Components only for interactive elements (forms, modals, real-time polling).
- **Auth guard:** `middleware.ts` intercepts all `/(app)/` routes; calls SuperTokens session verification. Unauthenticated requests redirect to `/login`.
- **API client:** `apps/web/src/lib/api-client.ts` is a typed `fetch` wrapper. All API calls use this client; no raw `fetch` calls in components. Uses Zod response schemas from `@dealflow/shared` for runtime response validation.
- **TanStack Query:** server state management for all API-sourced data. Queries are co-located with the feature component. Shared query key factory in `apps/web/src/lib/query-keys.ts`.
- **shadcn/ui:** component library. Components are copied into `apps/web/src/components/ui/` at add time (shadcn CLI). Customization is done in-place; upstream shadcn updates are manual cherry-picks.
- **Biome:** lint + format enforced in CI. No ESLint. Biome config in `biome.json` at repo root.

### Turborepo

- Pipeline tasks: `build` depends on `^build` (transitive); `test` runs in parallel across packages; `lint` runs in parallel.
- Internal packages: `@dealflow/shared` (schemas + types), `@dealflow/db` (Drizzle schema + migrations), `@dealflow/ui` (shadcn components + design tokens, if extracted from `apps/web`).
- Remote caching: Turborepo Remote Cache via Railway or Vercel (configured at CI setup time).

---

## Risk / open items

| # | Risk | Severity | Mitigation / Decision needed |
|---|---|---|---|
| R-1 | **Hash-chain audit log performance under high write volume.** Sequential hash dependency means each write must read the previous row's hash. At low MVP volume this is fine; at scale (thousands of events/minute) it becomes a bottleneck. | Medium | Acceptable at MVP. For scale: batch hash segments (every N rows form a segment; segment hash chains). Defer until load is measured. |
| R-2 | **LLM latency in matching run.** Claude API calls for rationale generation add latency per candidate. 50 LLM calls at 2s each = 100s for a match run. | Medium | Already mitigated: matching is async (BullMQ job). UI polls status. Acceptable for MVP where match runs are infrequent. |
| R-3 | **Queue technology not yet selected.** Redis-backed BullMQ is the strong default but the SDK branch makes the final call. If Redis is not provisioned on Railway, all BullMQ-dependent jobs are unshippable. | High | SDK/Services branch must confirm Redis provisioning + BullMQ as the queue library. This is a blocking dependency for the Jobs module and five job types. |
| R-4 | **Email provider not yet selected.** Outreach engine and notification module both depend on a transactional email + webhook provider. Resend is the leading candidate. | High | SDK/Services branch selects the provider. This unblocks outreach engine, webhook processor, and notification email alerts. |
| R-5 | **Dedupe entity resolution quality.** Fuzzy match threshold needs tuning. Too-aggressive merging loses data; too-conservative creates duplicates that confuse matching. | Medium | At MVP, use conservative threshold (high confidence only) and expose a manual merge UI for analysts. Threshold is a configurable DB setting, not hardcoded. |
| R-6 | **RBAC double-check overhead.** Applying role checks at both guard level and service level adds code surface. Risk of guard-service divergence. | Low | Acceptance test per role per sensitive endpoint in CI. Guard tests verify rejection; service tests verify the check fires. |
| R-7 | **Pilot-partner workspace isolation (H2 #20) is not architected at MVP.** Row-level security policies and tenant-scoping will need to be added to every query if/when H2 is activated. | Medium | All queries already filter by `workspace_id`. Adding RLS is additive. Design doc needed at H2 decomposition before any H2 implementation begins. |
| R-8 | **Socket.IO / SSE for real-time notifications.** SSE is simpler and Railway-compatible; Socket.IO adds complexity. Decision deferred. | Low | Use SSE for MVP notification stream. Re-evaluate at v6 if Socket.IO is needed for other real-time features (live pipeline board). |
